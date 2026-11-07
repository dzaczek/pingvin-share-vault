import { ShareService } from "./share.service";

// A share made through a reverse share gets the reverse share's expiration,
// and its files count against the reverse share owner's quota. The uploader
// could still PATCH it to "never", keeping the files on someone else's quota
// for good.

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

describe("updating a share made through a reverse share", () => {
  let prisma: any;
  let service: ShareService;
  const share = {
    id: "s1",
    creatorId: "uploader",
    reverseShareId: "rs1",
    security: null,
  } as any;

  beforeEach(() => {
    prisma = {
      share: {
        update: jest.fn(async () => ({})),
        findUnique: jest.fn(async () => share),
      },
      reverseShare: {
        findUnique: jest.fn(async () => ({
          creatorId: "owner",
          shareExpiration: inDays(1),
        })),
      },
    };
    const unused = {} as any;
    const config = {
      get: (key: string) =>
        key === "share.maxExpiration" ? { value: 0, unit: "days" } : undefined,
    };
    service = new ShareService(
      prisma,
      unused,
      unused,
      unused,
      config as any,
      unused,
      unused,
      unused,
      unused,
      unused,
      { t: (key: string) => key } as any,
      unused,
    );
    jest.spyOn(service as any, "transformShare").mockReturnValue({});
  });

  const update = (expiration: string, user: any) =>
    service.update("s1", { expiration } as any, user, share);

  it("keeps the uploader within the reverse share's expiration", async () => {
    const uploader = { id: "uploader", isAdmin: false };
    await expect(update("never", uploader)).rejects.toMatchObject({
      status: 400,
    });
    await expect(update("20-days", uploader)).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.share.update).not.toHaveBeenCalled();

    await update("1-hours", uploader);
    expect(prisma.share.update).toHaveBeenCalled();
  });

  it("lets the reverse share's owner and admins choose", async () => {
    await update("never", { id: "owner", isAdmin: false });
    await update("never", { id: "admin", isAdmin: true });
    expect(prisma.share.update).toHaveBeenCalledTimes(2);
  });
});

// Quota and maxShares only count shares that have not expired. Letting a
// share expire, uploading more, then moving its expiration back brought the
// old files back on top of the limits without any check.
describe("bringing an expired share back", () => {
  const expired = {
    id: "s2",
    creatorId: "u1",
    reverseShareId: null,
    uploadLocked: true,
    expiration: inDays(-1),
    security: null,
  } as any;

  const build = (creator: object, active: number, usage: number) => {
    const prisma = {
      share: {
        update: jest.fn(async () => ({})),
        findUnique: jest.fn(async () => ({
          ...expired,
          files: [{ size: "600" }],
          creator: { id: "u1", ...creator },
          reverseShare: null,
        })),
        count: jest.fn(async () => active),
      },
      file: { findMany: jest.fn(async () => [{ size: `${usage}` }]) },
    };
    const unused = {} as any;
    const config = {
      get: (key: string) =>
        key === "share.maxExpiration" ? { value: 0, unit: "days" } : undefined,
    };
    const service = new ShareService(
      prisma as any,
      unused,
      unused,
      unused,
      config as any,
      unused,
      unused,
      unused,
      unused,
      unused,
      { t: (key: string) => key } as any,
      unused,
    );
    jest.spyOn(service as any, "transformShare").mockReturnValue({});
    return { service, prisma };
  };

  const restore = (service: ShareService, isAdmin = false) =>
    service.update(
      "s2",
      { expiration: "7-days" } as any,
      { id: "u1", isAdmin } as any,
      expired,
    );

  it("checks maxShares again", async () => {
    const { service, prisma } = build({ maxShares: 1 }, 1, 0);
    await expect(restore(service)).rejects.toMatchObject({ status: 400 });
    expect(prisma.share.update).not.toHaveBeenCalled();
  });

  it("checks the storage quota again", async () => {
    const { service, prisma } = build({ storageQuotaLimit: "1000" }, 0, 500);
    await expect(restore(service)).rejects.toMatchObject({ status: 400 });
    expect(prisma.share.update).not.toHaveBeenCalled();
  });

  it("lets it back when there is room, and admins always", async () => {
    const roomy = build({ maxShares: 5, storageQuotaLimit: "10000" }, 1, 0);
    await restore(roomy.service);
    expect(roomy.prisma.share.update).toHaveBeenCalled();

    const full = build({ maxShares: 1 }, 1, 0);
    await restore(full.service, true);
    expect(full.prisma.share.update).toHaveBeenCalled();
  });
});
