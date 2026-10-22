import { ExecutionContext } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ShareOwnerGuard } from "./guard/shareOwner.guard";
import { StrictShareOwnerGuard } from "./guard/strictShareOwner.guard";
import { ShareService } from "./share.service";

// create makes the share folder, keep it out of the real data directory
jest.mock("../constants", () => ({
  get SHARE_DIRECTORY() {
    return root;
  },
}));

let root = "";

const i18n = { t: (key: string) => key } as any;

const service = (prisma: unknown, reverseShareService: unknown) => {
  const unused = {} as any;
  const config = {
    get: (key: string) =>
      key === "share.maxExpiration" ? { value: 0, unit: "days" } : undefined,
  };
  return new ShareService(
    prisma as any,
    config as any,
    unused,
    unused,
    config as any,
    unused,
    reverseShareService as any,
    unused,
    unused,
    { log: jest.fn() } as any,
    i18n,
  );
};

describe("creating a share with a reverse share cookie", () => {
  const user = { id: "u1", isAdmin: false, allowShare: true, maxShares: 0 };
  let prisma: any;
  let reverseShares: any;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-share-spec-"));
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  beforeEach(() => {
    prisma = {
      share: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ id: "s1", ...data })),
      },
      reverseShare: { update: jest.fn() },
    };
    reverseShares = {
      isValid: jest.fn(async () => false),
      getByToken: jest.fn(async () => ({
        id: "rs1",
        token: "old",
        creator: { id: "someone-else" },
        shareExpiration: new Date(0),
      })),
    };
  });

  const create = () =>
    service(prisma, reverseShares).create(
      { id: "s1", expiration: "never" } as any,
      user as any,
      "old",
    );

  it("does not attach the share to an expired or used up reverse share", async () => {
    await create();

    expect(reverseShares.isValid).toHaveBeenCalledWith("old");
    expect(reverseShares.getByToken).not.toHaveBeenCalled();
    expect(prisma.reverseShare.update).not.toHaveBeenCalled();
    expect(prisma.share.create.mock.calls[0][0].data.creator).toEqual({
      connect: { id: "u1" },
    });
  });

  it("still attaches it while the reverse share is valid", async () => {
    reverseShares.isValid.mockResolvedValue(true);
    await create();

    expect(prisma.reverseShare.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { shares: { connect: { id: "s1" } } },
      }),
    );
  });
});

describe("reopening a completed share", () => {
  const run = async (share: unknown) => {
    const prisma = {
      share: { findUnique: jest.fn(async () => share), update: jest.fn() },
      reverseShare: { update: jest.fn() },
    };
    await service(prisma, {}).revertComplete("s1");
    return prisma;
  };

  it("gives the reverse share its use back", async () => {
    const prisma = await run({
      id: "s1",
      uploadLocked: true,
      reverseShare: { id: "rs1" },
    });
    expect(prisma.reverseShare.update).toHaveBeenCalledWith({
      where: { id: "rs1" },
      data: { remainingUses: { increment: 1 } },
    });
    expect(prisma.share.update).toHaveBeenCalled();
  });

  it("gives nothing back for a share that was not completed", async () => {
    const prisma = await run({
      id: "s1",
      uploadLocked: false,
      reverseShare: { id: "rs1" },
    });
    expect(prisma.reverseShare.update).not.toHaveBeenCalled();
  });

  it("gives nothing back without a reverse share", async () => {
    const prisma = await run({
      id: "s1",
      uploadLocked: true,
      reverseShare: null,
    });
    expect(prisma.reverseShare.update).not.toHaveBeenCalled();
  });
});

describe("ShareOwnerGuard and reverse shares", () => {
  let share: any;
  let config: Record<string, unknown>;

  const contextFor = (request: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const run = (
    Guard: typeof ShareOwnerGuard,
    user: unknown,
    cookies: Record<string, string> = {},
  ) => {
    const prisma = { share: { findUnique: jest.fn(async () => share) } };
    const configService = { get: (key: string) => config[key] };
    const guard = new Guard(configService as any, prisma as any, i18n);
    // the jwt part only puts the user on the request
    jest
      .spyOn(Object.getPrototypeOf(ShareOwnerGuard.prototype), "canActivate")
      .mockResolvedValue(true as never);
    const request = { params: { id: "s1" }, cookies, user };
    return guard.canActivate(contextFor(request));
  };

  beforeEach(() => {
    share = {
      id: "s1",
      creatorId: null,
      blockedAt: null,
      uploadLocked: false,
      reverseShare: { id: "rs1", token: "rs-token", creatorId: "rs-owner" },
    };
    config = { "security.allowUnauthenticatedShares": false };
  });

  afterEach(() => jest.restoreAllMocks());

  it("lets the reverse share creator manage the share", async () => {
    share.uploadLocked = true;
    await expect(run(ShareOwnerGuard, { id: "rs-owner" })).resolves.toBe(true);
  });

  it("keeps the reverse share creator out of owner only actions", async () => {
    share.uploadLocked = true;
    await expect(run(StrictShareOwnerGuard, { id: "rs-owner" })).resolves.toBe(
      false,
    );
  });

  it("lets the anonymous uploader in with the matching cookie", async () => {
    await expect(
      run(StrictShareOwnerGuard, undefined, {
        reverse_share_token: "rs-token",
      }),
    ).resolves.toBe(true);
  });

  it("keeps out an anonymous caller with another cookie", async () => {
    await expect(
      run(StrictShareOwnerGuard, undefined, {
        reverse_share_token: "other-token",
      }),
    ).resolves.toBe(false);
  });

  it("keeps out an anonymous caller without the cookie", async () => {
    await expect(run(StrictShareOwnerGuard, undefined)).resolves.toBe(false);
  });

  it("keeps out a signed in stranger without the cookie", async () => {
    await expect(run(StrictShareOwnerGuard, { id: "stranger" })).resolves.toBe(
      false,
    );
  });

  it("closes the share to the uploader once it is completed", async () => {
    share.uploadLocked = true;
    await expect(
      run(StrictShareOwnerGuard, undefined, {
        reverse_share_token: "rs-token",
      }),
    ).resolves.toBe(false);
  });

  it("lets anyone work on a plain anonymous upload while those are allowed", async () => {
    share.reverseShare = null;
    config["security.allowUnauthenticatedShares"] = true;
    await expect(run(StrictShareOwnerGuard, undefined)).resolves.toBe(true);
  });

  it("closes plain anonymous uploads once those are turned off", async () => {
    share.reverseShare = null;
    await expect(run(StrictShareOwnerGuard, undefined)).resolves.toBe(false);
  });

  it("closes a completed plain anonymous share", async () => {
    share.reverseShare = null;
    share.uploadLocked = true;
    config["security.allowUnauthenticatedShares"] = true;
    await expect(run(StrictShareOwnerGuard, undefined)).resolves.toBe(false);
  });
});
