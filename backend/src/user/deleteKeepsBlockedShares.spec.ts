import { UserSevice } from "./user.service";

// Blocking a share keeps it for investigation, and the guards stop its owner
// from deleting it. Deleting the account went around that: the owner's files
// were removed and the cascades dropped the share rows and their access logs.

describe("deleting an account with a blocked share", () => {
  it("detaches blocked shares and keeps their files, deletes the rest", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => ({
          id: "u1",
          isAdmin: false,
          shares: [
            { id: "blocked", blockedAt: new Date() },
            { id: "normal", blockedAt: null },
          ],
        })),
        delete: jest.fn(async () => ({ id: "u1" })),
      },
      share: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    const files = { deleteAllFiles: jest.fn(async () => undefined) };
    const service = new UserSevice(
      prisma as any,
      {} as any,
      files as any,
      { get: () => undefined } as any,
      { t: (key: string) => key } as any,
    );

    await service.delete("u1");

    expect(files.deleteAllFiles).toHaveBeenCalledTimes(1);
    expect(files.deleteAllFiles).toHaveBeenCalledWith("normal");
    expect(prisma.share.updateMany).toHaveBeenCalledWith({
      where: {
        blockedAt: { not: null },
        OR: [{ creatorId: "u1" }, { reverseShare: { creatorId: "u1" } }],
      },
      data: { creatorId: null, reverseShareId: null },
    });
    // the detach has to happen before the cascade runs
    expect(prisma.share.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.delete.mock.invocationCallOrder[0],
    );
  });
});
