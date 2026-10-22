import { JwtStrategy } from "./jwt.strategy";

// An access token lives 15 minutes. Without a look at its session, signing
// out or an admin revoking the sessions would leave it working until then.

const build = (session: any = null) => {
  const calls: any[] = [];
  const prisma = {
    refreshToken: {
      findFirst: async (args: any) => {
        calls.push(args);
        return session;
      },
    },
  };
  const config = { get: () => "secret" };
  return { strategy: new JwtStrategy(config as any, prisma as any), calls };
};

describe("JwtStrategy.validate", () => {
  it("returns the user of a live session", async () => {
    const user = { id: "u1" };
    const { strategy, calls } = build({ id: "t1", user });

    expect(await strategy.validate({ sub: "u1", refreshTokenId: "t1" })).toBe(
      user,
    );
    expect(calls[0].where).toEqual({
      id: "t1",
      userId: "u1",
      expiresAt: { gt: expect.any(Date) },
    });
  });

  it("rejects a token once its session is gone or expired", async () => {
    const { strategy } = build(null);

    expect(
      await strategy.validate({ sub: "u1", refreshTokenId: "t1" }),
    ).toBeNull();
  });

  it("rejects a token that names no session", async () => {
    const { strategy, calls } = build({ id: "t1", user: { id: "u1" } });

    expect(await strategy.validate({ sub: "u1" })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
