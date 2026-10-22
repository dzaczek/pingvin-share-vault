import { BadRequestException } from "@nestjs/common";
import { ShareService } from "./share.service";

// The browser sends the expiration as the date it showed, counted in its own
// calendar. Over a clock change seven local days are an hour longer than seven
// days on a server in UTC, so a share at exactly the admin's maximum must
// still get through.

const service = () => {
  const unused = {} as any;
  const config = {
    get: (key: string) =>
      key === "share.maxExpiration" ? { value: 7, unit: "days" } : undefined,
  };
  return new ShareService(
    unused,
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
  ) as any;
};

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000);

describe("the maximum expiration", () => {
  it("lets through seven days that ran an hour long over a clock change", () => {
    expect(() =>
      service().validateExpiration(inHours(7 * 24 + 1)),
    ).not.toThrow();
  });

  it("still refuses a day too many", () => {
    expect(() => service().validateExpiration(inHours(8 * 24))).toThrow(
      BadRequestException,
    );
  });

  it("refuses never when there is a maximum", () => {
    expect(() => service().validateExpiration(new Date(0))).toThrow(
      BadRequestException,
    );
  });
});
