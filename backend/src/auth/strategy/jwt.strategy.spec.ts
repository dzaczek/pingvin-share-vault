import { JwtStrategy } from "./jwt.strategy";

// An access token lives 15 minutes. Without a look at its session, signing
// out or an admin revoking the sessions would leave it working until then.

const build = () => {
  const calls: any[] = [];
  const prisma = {
    user: {
      findFirst: async (args: any) => {
        calls.push(args);
        return null;
      },
    },
  };
  const config = { get: () => "secret" };
  return { strategy: new JwtStrategy(config as any, prisma as any), calls };
};

describe("JwtStrategy.validate", () => {
  it("only accepts a token whose session still exists", async () => {
    const { strategy, calls } = build();

    await strategy.validate({ sub: "u1", refreshTokenId: "t1" });

    expect(calls[0].where).toEqual({
      id: "u1",
      refreshTokens: { some: { id: "t1" } },
    });
  });

  it("still takes a token from before sessions were named in it", async () => {
    const { strategy, calls } = build();

    await strategy.validate({ sub: "u1" });

    expect(calls[0].where).toEqual({ id: "u1" });
  });
});
