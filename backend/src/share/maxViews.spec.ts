import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { FileSecurityGuard } from "src/file/guard/fileSecurity.guard";
import { ShareService } from "./share.service";

// The limit used to be read first and the view written later, so visitors
// arriving together all saw room for one more view. Now the limit is part of
// the write itself.

const i18n = { t: (key: string) => key } as any;

// a stand in for the database that applies the conditional write in one step,
// the way sqlite does
const fakePrisma = (views: number) => {
  const state = { views };
  const updateMany = jest.fn(async ({ where, data }) => {
    if (where.views?.lt !== undefined && !(state.views < where.views.lt))
      return { count: 0 };
    state.views += data.views.increment;
    return { count: 1 };
  });
  return { state, prisma: { share: { updateMany } } };
};

const service = (prisma: unknown, accessLog = { log: jest.fn() }) => {
  const unused = {} as any;
  return new ShareService(
    prisma as any,
    unused,
    unused,
    unused,
    { get: () => "secret" } as any,
    { sign: () => "token" } as any,
    unused,
    unused,
    unused,
    accessLog as any,
    i18n,
    unused,
  );
};

const rejectsWithMaxViews = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
  await expect(promise).rejects.toMatchObject({
    response: { error: "share_max_views_exceeded" },
  });
};

describe("counting share views", () => {
  const share = (views: number, maxViews?: number) =>
    ({
      id: "s1",
      views,
      expiration: new Date(0),
      createdAt: new Date(),
      security: maxViews ? { maxViews, password: null } : null,
    }) as any;

  it("checks the limit inside the same write that counts the view", async () => {
    const { prisma } = fakePrisma(0);
    await service(prisma).increaseViewCount(share(0, 3));

    expect(prisma.share.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", views: { lt: 3 } },
      data: { views: { increment: 1 } },
    });
  });

  it("counts without a condition when there is no limit", async () => {
    const { prisma } = fakePrisma(10);
    await service(prisma).increaseViewCount(share(10));

    expect(prisma.share.updateMany).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { views: { increment: 1 } },
    });
  });

  it("refuses a view at the limit and logs nothing", async () => {
    const { prisma, state } = fakePrisma(2);
    const accessLog = { log: jest.fn() };
    await rejectsWithMaxViews(
      service(prisma, accessLog).increaseViewCount(share(2, 2), "1.2.3.4"),
    );
    expect(state.views).toBe(2);
    expect(accessLog.log).not.toHaveBeenCalled();
  });

  it("still logs the visitor of a counted view", async () => {
    const { prisma } = fakePrisma(0);
    const accessLog = { log: jest.fn() };
    await service(prisma, accessLog).increaseViewCount(share(0, 1), "1.2.3.4");
    expect(accessLog.log).toHaveBeenCalledWith("s1", "1.2.3.4", "VIEWED");
  });

  it("lets only one of two visitors at the same time take the last view", async () => {
    const { prisma, state } = fakePrisma(0);
    const s = service(prisma);
    // both read the share before either was counted
    const results = await Promise.allSettled([
      s.increaseViewCount(share(0, 1)),
      s.increaseViewCount(share(0, 1)),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(state.views).toBe(1);
  });

  it("hands out no share token at the limit", async () => {
    const { prisma } = fakePrisma(1);
    const s = service({
      share: { ...prisma.share, findFirst: async () => share(1, 1) },
    });
    const sign = jest.spyOn(s as any, "generateShareToken");

    await rejectsWithMaxViews(s.getShareToken("s1", undefined));
    expect(sign).not.toHaveBeenCalled();
  });

  it("hands out a share token below the limit", async () => {
    const { prisma, state } = fakePrisma(0);
    const s = service({
      share: { ...prisma.share, findFirst: async () => share(0, 1) },
    });

    await expect(s.getShareToken("s1", undefined)).resolves.toBe("token");
    expect(state.views).toBe(1);
  });
});

describe("FileSecurityGuard and the view limit", () => {
  it("leaves the limit to the counting write for a direct file link", async () => {
    const share = {
      id: "s1",
      views: 0,
      expiration: new Date(0),
      blockedAt: null,
      reverseShare: null,
      security: { maxViews: 1, password: null },
    };
    const shareService = {
      increaseViewCount: jest.fn(async () => {
        throw new ForbiddenException("x", "share_max_views_exceeded");
      }),
    };
    const prisma = { share: { findUnique: async () => share } };
    const guard = new FileSecurityGuard(
      shareService as any,
      prisma as any,
      { get: () => false } as any,
      i18n,
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { shareId: "s1" },
          cookies: {},
          ip: "ip",
        }),
      }),
    } as unknown as ExecutionContext;

    await rejectsWithMaxViews(guard.canActivate(context));
    expect(shareService.increaseViewCount).toHaveBeenCalledWith(share, "ip");
  });
});
