import { OAuthService } from "./oauth.service";

// Admin rights of a returning OIDC user follow the role claim. isAdmin is
// undefined when no admin role is configured, false when it is configured and
// the user no longer carries it.

const buildService = () => {
  const prisma = {
    oAuthUser: { findFirst: jest.fn().mockResolvedValue({ userId: "u1" }) },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({ id: "u1" }),
    },
  };
  const auth = { generateToken: jest.fn().mockResolvedValue({}) };
  const service = new OAuthService(
    prisma as any,
    {} as any,
    auth as any,
    [],
    {},
  );
  return { service, prisma };
};

const signIn = (service: OAuthService, isAdmin?: boolean) =>
  service.signIn(
    {
      provider: "oidc",
      providerId: "p1",
      providerUsername: "someone",
      email: "someone@example.com",
      isAdmin,
    } as any,
    "127.0.0.1",
  );

describe("OAuthService.signIn admin role", () => {
  it("grants admin when the role is present", async () => {
    const { service, prisma } = buildService();
    await signIn(service, true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isAdmin: true } }),
    );
  });

  it("revokes admin when the role is gone", async () => {
    const { service, prisma } = buildService();
    await signIn(service, false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isAdmin: false } }),
    );
  });

  it("leaves admin alone when no admin role is configured", async () => {
    const { service, prisma } = buildService();
    await signIn(service, undefined);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
