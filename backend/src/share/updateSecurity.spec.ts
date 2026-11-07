import { ShareService } from "./share.service";

// Editing a share restricted to recipients used to delete its whole security
// row whenever no password or view limit was left, and the recipient
// restriction lives in that row.

const service = (prisma: unknown) => {
  const unused = {} as any;
  return new ShareService(
    prisma as any,
    unused,
    unused,
    unused,
    { get: () => "secret" } as any,
    unused,
    unused,
    unused,
    unused,
    unused,
    { t: (key: string) => key } as any,
    unused,
  );
};

const fakePrisma = () => ({
  share: {
    update: jest.fn(async () => ({})),
    findUnique: jest.fn(async () => ({
      id: "s1",
      files: [],
      recipients: [],
      security: null,
      creator: null,
    })),
  },
  shareSecurity: {
    delete: jest.fn(async () => ({})),
    upsert: jest.fn(async () => ({})),
  },
});

const restrictedShare = {
  id: "s1",
  creatorId: "u1",
  security: { restrictToRecipients: true, password: null, maxViews: null },
} as any;

describe("editing share security", () => {
  it("keeps the recipient restriction when the edit form sends no password or view limit", async () => {
    const prisma = fakePrisma();

    await service(prisma).update(
      "s1",
      { name: "renamed", security: { removePassword: false, maxViews: null } },
      { id: "u1", isAdmin: false } as any,
      restrictedShare,
    );

    expect(prisma.shareSecurity.delete).not.toHaveBeenCalled();
  });

  it("still removes the row of an unrestricted share once nothing in it applies", async () => {
    const prisma = fakePrisma();

    await service(prisma).update(
      "s1",
      { security: { removePassword: true, maxViews: null } },
      { id: "u1", isAdmin: false } as any,
      {
        id: "s1",
        creatorId: "u1",
        security: { restrictToRecipients: false, password: "h", maxViews: 3 },
      } as any,
    );

    expect(prisma.shareSecurity.delete).toHaveBeenCalledWith({
      where: { shareId: "s1" },
    });
  });
});
