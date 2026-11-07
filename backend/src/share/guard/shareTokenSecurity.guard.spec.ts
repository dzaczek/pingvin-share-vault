import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ShareTokenSecurity } from "./shareTokenSecurity.guard";

// POST /shares/:id/token counts a view. It used to check only that the share
// existed, so anyone with the link could use up maxViews of a share they were
// never allowed to open.

const contextFor = (request: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("ShareTokenSecurity", () => {
  let share: any;
  let guard: ShareTokenSecurity;

  const run = (user: unknown) => {
    jest
      .spyOn(guard as any, "authenticateUser")
      .mockResolvedValue(user as never);
    return guard.canActivate(contextFor({ params: { id: "s1" }, cookies: {} }));
  };

  beforeEach(() => {
    share = {
      id: "s1",
      creatorId: "owner",
      expiration: new Date(0),
      blockedAt: null,
      reverseShare: null,
      security: { restrictToRecipients: false, password: null, maxViews: 1 },
      userRecipients: [],
      recipients: [{ email: "anna@example.com" }],
    };
    const config = {
      get: (key: string) =>
        ({
          "share.enableUserRecipients": true,
          "security.enableEmailVerification": true,
          "security.allowAdminAccessAllShares": false,
        })[key],
    };
    const prisma = {
      share: { findUnique: jest.fn(async () => share) },
      shareUserRecipient: { upsert: jest.fn() },
    };
    guard = new ShareTokenSecurity(
      {} as any,
      prisma as any,
      config as any,
      { t: (key: string) => key } as any,
    );
  });

  it("issues a token for an ordinary public share", async () => {
    await expect(run(undefined)).resolves.toBe(true);
  });

  it("refuses a non-recipient on a share restricted to recipients", async () => {
    share.security.restrictToRecipients = true;
    await expect(run(undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      run({ id: "stranger", email: "x@example.com" }),
    ).rejects.toMatchObject({
      response: { error: "share_restricted_to_recipients" },
    });
  });

  it("lets the creator and a confirmed recipient of a restricted share through", async () => {
    share.security.restrictToRecipients = true;
    await expect(run({ id: "owner" })).resolves.toBe(true);
    await expect(
      run({
        id: "u1",
        email: "anna@example.com",
        isActivated: true,
        activationToken: null,
      }),
    ).resolves.toBe(true);
  });

  it("hides a blocked share from everyone but admins", async () => {
    share.blockedAt = new Date();
    await expect(run({ id: "owner" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(run({ id: "admin", isAdmin: true })).resolves.toBe(true);
  });

  it("refuses outsiders on a private reverse share", async () => {
    share.reverseShare = { publicAccess: false, creatorId: "rs-owner" };
    await expect(run(undefined)).rejects.toMatchObject({
      response: { error: "private_share" },
    });
    await expect(run({ id: "rs-owner" })).resolves.toBe(true);
  });
});
