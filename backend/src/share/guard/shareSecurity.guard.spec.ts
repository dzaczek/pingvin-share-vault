import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ShareSecurityGuard } from "./shareSecurity.guard";

const contextFor = (request: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("ShareSecurityGuard and recipients", () => {
  const recipient = {
    id: "u1",
    email: "anna@example.com",
    isActivated: true,
    activationToken: null as string | null,
  };

  let share: any;
  let config: Record<string, unknown>;
  let prisma: any;
  let guard: ShareSecurityGuard;

  const run = (user: unknown, token?: string) => {
    jest
      .spyOn(guard as any, "authenticateUser")
      .mockResolvedValue(user as never);
    return guard.canActivate(
      contextFor({
        params: { id: "s1" },
        cookies: token ? { share_s1_token: token } : {},
      }),
    );
  };

  const rejectsWith = async (promise: Promise<unknown>, code: string) => {
    await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promise).rejects.toMatchObject({
      response: { error: code },
    });
  };

  beforeEach(() => {
    share = {
      id: "s1",
      creatorId: "owner",
      expiration: new Date(0),
      blockedAt: null,
      reverseShare: null,
      security: { restrictToRecipients: true, password: null },
      userRecipients: [],
      recipients: [{ email: "anna@example.com" }],
    };
    config = {
      "share.enableUserRecipients": true,
      "security.enableEmailVerification": true,
      "security.allowAdminAccessAllShares": false,
    };
    prisma = {
      share: { findUnique: jest.fn(async () => share) },
      shareUserRecipient: { upsert: jest.fn() },
    };
    const shareService = {
      verifyShareToken: jest.fn(async (_s, token) => token === "valid"),
    };
    const configService = { get: (key: string) => config[key] };
    const i18n = { t: (key: string) => key };
    guard = new ShareSecurityGuard(
      shareService as any,
      prisma,
      configService as any,
      i18n as any,
    );
  });

  it("lets a linked recipient into a restricted share with a token", async () => {
    share.userRecipients = [{ userId: "u1" }];
    await expect(run(recipient, "valid")).resolves.toBe(true);
  });

  it("still asks a recipient for the share password", async () => {
    share.userRecipients = [{ userId: "u1" }];
    share.security.password = "hash";
    await rejectsWith(run(recipient), "share_password_required");
  });

  it("still asks a recipient for a share token", async () => {
    share.userRecipients = [{ userId: "u1" }];
    await rejectsWith(run(recipient), "share_token_required");
  });

  it("keeps everyone else out of a restricted share", async () => {
    await rejectsWith(
      run({ ...recipient, id: "u2", email: "eve@example.com" }, "valid"),
      "share_restricted_to_recipients",
    );
  });

  it("links a recipient by a confirmed address", async () => {
    await expect(run(recipient, "valid")).resolves.toBe(true);
    expect(prisma.shareUserRecipient.upsert).toHaveBeenCalled();
  });

  it("does not match by address without email verification", async () => {
    config["security.enableEmailVerification"] = false;
    await rejectsWith(
      run(recipient, "valid"),
      "share_restricted_to_recipients",
    );
    expect(prisma.shareUserRecipient.upsert).not.toHaveBeenCalled();
  });

  it("does not match a changed address that is not confirmed yet", async () => {
    await rejectsWith(
      run({ ...recipient, activationToken: "pending" }, "valid"),
      "share_restricted_to_recipients",
    );
    expect(prisma.shareUserRecipient.upsert).not.toHaveBeenCalled();
  });
});
