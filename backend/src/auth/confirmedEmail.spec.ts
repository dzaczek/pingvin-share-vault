import { AuthService } from "./auth.service";
import { hasConfirmedEmail } from "src/share/recipientEmail.util";
import { UserSevice } from "src/user/user.service";

jest.mock("./authTotp.service", () => ({ AuthTotpService: class {} }));

// "Confirmed" used to mean activated with no pending token, which is also
// what an account made while verification was off, an LDAP sign in with a
// typed address, or an OIDC address nobody vouched for looked like. Once
// verification was on, any of them opened shares sent to that address.

const t = { t: (key: string) => key } as any;

describe("hasConfirmedEmail", () => {
  const user = {
    email: "anna@example.com",
    isActivated: true,
    activationToken: null,
  };

  it("needs the address that was actually proven", () => {
    expect(hasConfirmedEmail({ ...user, confirmedEmail: null }, true)).toBe(
      false,
    );
    expect(
      hasConfirmedEmail({ ...user, confirmedEmail: "old@example.com" }, true),
    ).toBe(false);
    expect(
      hasConfirmedEmail({ ...user, confirmedEmail: "anna@example.com" }, true),
    ).toBe(true);
  });
});

describe("AuthService and the confirmed address", () => {
  let prisma: any;
  let mail: any;
  let verification: boolean;
  let auth: AuthService;

  beforeEach(() => {
    verification = false;
    prisma = {
      user: {
        create: jest.fn(async ({ data }) => ({ id: "u1", ...data })),
        count: jest.fn(async () => 1),
        findUnique: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      refreshToken: {
        create: jest.fn(async () => ({ id: "r1", token: "rt" })),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    mail = { sendVerificationEmail: jest.fn() };
    const config = {
      get: (key: string) =>
        key === "security.enableEmailVerification"
          ? verification
          : key === "security.sessionDuration"
            ? { value: 1, unit: "day" }
            : "",
    };
    auth = new AuthService(
      prisma,
      { sign: () => "at" } as any,
      config as any,
      mail,
      {} as any,
      {} as any,
      {} as any,
      t,
      {} as any,
    );
  });

  const created = () => prisma.user.create.mock.calls[0][0].data;

  it("does not count an address nobody checked", async () => {
    await auth.signUp(
      { email: "Anna@Example.com", username: "anna", password: null },
      "ip",
    );
    expect(created().isActivated).toBe(true);
    expect(created().confirmedEmail).toBeNull();
  });

  it("counts the address a sign in provider vouches for", async () => {
    await auth.signUp(
      { email: "anna@example.com", username: "anna", password: null },
      "ip",
      false,
      true,
      true,
    );
    expect(created().confirmedEmail).toBe("anna@example.com");
  });

  it("confirms the address the token was mailed to, nothing else", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "anna@example.com",
      activationToken: "tok",
    });
    await auth.verifyAccount("tok");
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", activationToken: "tok", email: "anna@example.com" },
      data: expect.objectContaining({ confirmedEmail: "anna@example.com" }),
    });

    // the address changed, and with it the token, in between
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(auth.verifyAccount("tok")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("lets an account made while verification was off confirm its address", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "anna@example.com",
      username: "anna",
      isActivated: true,
      activationToken: null,
      confirmedEmail: null,
    });
    await auth.resendVerification("anna@example.com");
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      "anna@example.com",
      expect.any(String),
      "anna",
    );
  });

  it("refuses an account whose address is confirmed already", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "anna@example.com",
      isActivated: true,
      activationToken: null,
      confirmedEmail: "anna@example.com",
    });
    await expect(
      auth.resendVerification("anna@example.com"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("sends no token once the address changed after the lookup", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "b@example.com",
      isActivated: true,
      activationToken: "pending",
      confirmedEmail: "a@example.com",
    });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await auth.resendVerification("b@example.com");
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1", email: "b@example.com" },
      }),
    );
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("LDAP sign in and the account address", () => {
  let prisma: any;
  const signIn = async (
    directoryMail: string | undefined,
    typed?: string,
    existing?: object,
  ) => {
    prisma = {
      user: {
        upsert: jest.fn(async ({ create }) => ({
          id: "u1",
          ...create,
          ...existing,
        })),
        update: jest.fn(async ({ data }) => ({ id: "u1", ...data })),
      },
    };
    const config = {
      get: (key: string) =>
        ({
          "ldap.fieldNameMemberOf": "memberOf",
          "ldap.fieldNameEmail": "mail",
          "ldap.fieldNameDisplayName": "displayName",
        })[key] ?? "",
    };
    const service = new UserSevice(
      prisma as any,
      {} as any,
      {} as any,
      config as any,
      t,
    );
    await service.findOrCreateFromLDAP(
      { username: "anna", email: typed, password: "x" },
      {
        dn: "cn=anna",
        memberOf: [],
        ...(directoryMail && { mail: directoryMail }),
      } as any,
    );
    return prisma.user.upsert.mock.calls[0][0].create;
  };

  it("keeps the directory's address over the one typed at sign in", async () => {
    const created = await signIn("Anna@Corp.example", "victim@corp.example");
    expect(created.email).toBe("anna@corp.example");
    expect(created.confirmedEmail).toBe("anna@corp.example");
  });

  it("uses a typed address only as a fallback, and does not count it", async () => {
    const created = await signIn(undefined, "anna@home.example");
    expect(created.email).toBe("anna@home.example");
    expect(created.confirmedEmail).toBeNull();
  });

  // the migration leaves LDAP accounts unconfirmed, the directory decides
  it("confirms the directory's address of an existing account", async () => {
    await signIn("anna@corp.example", undefined, {
      username: "anna",
      email: "anna@corp.example",
      confirmedEmail: null,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        email: "anna@corp.example",
        confirmedEmail: "anna@corp.example",
      },
    });
  });
});
