import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { ShareService } from "./share.service";

// SQLite compares the stored dates as text. A year past 9999 ("+010026-...")
// sorts before "2026-...", so the queries took the share for expired while the
// guards, comparing real times, kept it live. The expiry job then stopped for
// everyone, and the share fell out of the quota and maxShares counts.

const t = { t: (key: string) => key } as any;

describe("expirations past year 9999", () => {
  const parse = (value: string) => {
    const unused = {} as any;
    const service = new ShareService(
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      t,
      unused,
    ) as any;
    return () => service.parseExpiration(value);
  };

  it("are refused for a share", () => {
    for (const value of ["8000-years", "+010026-01-01T00:00:00Z"]) {
      expect(parse(value)).toThrow(expect.objectContaining({ status: 400 }));
    }
    expect(parse("2-years")).not.toThrow();
    expect(parse("never")).not.toThrow();
  });

  it("are refused for a reverse share", async () => {
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ id: "u1", isAdmin: true })) },
      reverseShare: { create: jest.fn() },
    };
    const config = { get: () => ({ value: 0, unit: "days" }) };
    const service = new ReverseShareService(
      config as any,
      prisma as any,
      {} as any,
      t,
    );
    await expect(
      service.create(
        { shareExpiration: "8000-years", maxShareSize: "1000" } as any,
        "u1",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.reverseShare.create).not.toHaveBeenCalled();
  });
});
