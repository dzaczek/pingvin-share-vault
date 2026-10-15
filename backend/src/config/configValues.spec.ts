import { BadRequestException, ParseArrayPipe } from "@nestjs/common";
import { ConfigService } from "./config.service";
import UpdateConfigDTO from "./dto/updateConfig.dto";

// Values that used to be stored as given. A chunk size of 0 stops every
// upload, and an app URL without a scheme breaks every link in every mail.

const service = () => new ConfigService([], {} as any);

const rejects = (key: string, value: unknown) =>
  expect(() => service().validateConfigVariable(key, value as string)).toThrow(
    BadRequestException,
  );

const accepts = (key: string, value: unknown) =>
  expect(() =>
    service().validateConfigVariable(key, value as string),
  ).not.toThrow();

describe("validateConfigVariable, numbers and choices", () => {
  it("wants a positive whole chunk and share size", () => {
    rejects("share.chunkSize", 0);
    rejects("share.chunkSize", -5);
    rejects("share.maxSize", 1.5);
    accepts("share.chunkSize", 10000000);
    accepts("share.maxSize", null);
  });

  it("keeps the smtp port and password length in range", () => {
    rejects("smtp.port", 70000);
    accepts("smtp.port", 587);
    rejects("security.minLength", 0);
    accepts("security.minLength", 12);
  });

  it("only takes the choices the admin page offers", () => {
    accepts("appearance.themeRadius", "md");
    rejects("appearance.themeRadius", "huge");
    accepts("appearance.themeColorScheme", "system");
    rejects("appearance.themeColorScheme", "sepia");
    accepts("appearance.uploadProgressStyle", "percentage-time");
    rejects("appearance.uploadProgressStyle", "bar");
    accepts("appearance.themePrimaryColor", "custom");
    rejects("appearance.themePrimaryColor", "chartreuse");
    accepts("appearance.themePrimaryColorOverride", "#12b886");
    rejects("appearance.themePrimaryColorOverride", "red;}");
    accepts("general.defaultLanguage", "pl-PL");
    rejects("general.defaultLanguage", "../en");
  });

  it("wants an http(s) app URL", () => {
    accepts("general.appUrl", "https://share.example.com");
    rejects("general.appUrl", "share.example.com");
    rejects("general.appUrl", "javascript:alert(1)");
  });
});

describe("the config update body", () => {
  const pipe = new ParseArrayPipe({ items: UpdateConfigDTO, whitelist: true });
  const parse = (body: unknown) => pipe.transform(body, { type: "body" });

  it("takes values of every setting type and the ones that clear", async () => {
    await expect(
      parse([
        { key: "a.b", value: "text" },
        { key: "a.c", value: 3 },
        { key: "a.d", value: false },
        { key: "a.e", value: "" },
        { key: "a.f", value: null },
      ]),
    ).resolves.toHaveLength(5);
  });

  it("refuses items that are not settings", async () => {
    await expect(parse([{ key: 5, value: "x" }])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(parse([{ key: "a.b" }])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      parse([{ key: "a.b", value: { nested: true } }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(parse({ key: "a.b", value: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
