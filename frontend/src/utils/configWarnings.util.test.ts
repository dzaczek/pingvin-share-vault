import { getConfigWarnings } from "./configWarnings.util";

const warningsFor = (values: Record<string, string>) =>
  getConfigWarnings((key) => values[key] ?? "").map((w) => w.id);

describe("getConfigWarnings", () => {
  it("says when a mail feature is on without SMTP", () => {
    expect(
      warningsFor({
        "smtp.enabled": "false",
        "security.enableEmailVerification": "true",
      }),
    ).toEqual(["admin.config.warning.smtp-off"]);
    expect(
      warningsFor({
        "smtp.enabled": "true",
        "security.enableEmailVerification": "true",
      }),
    ).toEqual([]);
  });

  it("says when the default expiration is longer than the maximum", () => {
    const over = {
      "share.maxExpiration": "7 days",
      "share.defaultExpiration": "2 weeks",
    };
    expect(warningsFor(over)).toEqual([
      "admin.config.warning.default-over-max",
    ]);
    expect(
      warningsFor({ ...over, "share.defaultExpiration": "0 days" }),
    ).toEqual(["admin.config.warning.default-over-max"]);
    expect(
      warningsFor({ ...over, "share.defaultExpiration": "3 days" }),
    ).toEqual([]);
    expect(warningsFor({ ...over, "share.maxExpiration": "0 days" })).toEqual(
      [],
    );
  });
});
