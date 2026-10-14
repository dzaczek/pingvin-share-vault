import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "./config.service";

// The style settings are read straight into the theme, so anything outside
// the known values would leave the frontend guessing.

const variables = [
  { category: "appearance", name: "uiStyle", type: "string" },
  { category: "appearance", name: "glassVariant", type: "string" },
  { category: "appearance", name: "glassBlur", type: "number" },
  { category: "appearance", name: "glassBackground", type: "string" },
  { category: "appearance", name: "glassBackgroundColor", type: "string" },
  { category: "appearance", name: "glassBackgroundUrl", type: "string" },
] as any[];

const service = () => new ConfigService(variables, {} as any);

const rejects = (key: string, value: unknown) =>
  expect(() => service().validateConfigVariable(key, value as string)).toThrow(
    BadRequestException,
  );

const accepts = (key: string, value: unknown) =>
  expect(() =>
    service().validateConfigVariable(key, value as string),
  ).not.toThrow();

describe("validateConfigVariable, appearance style", () => {
  it("accepts the three styles and nothing else", () => {
    accepts("appearance.uiStyle", "standard");
    accepts("appearance.uiStyle", "glass");
    accepts("appearance.uiStyle", "precision");
    rejects("appearance.uiStyle", "liquid");
  });

  it("accepts the two glass variants", () => {
    accepts("appearance.glassVariant", "regular");
    accepts("appearance.glassVariant", "clear");
    rejects("appearance.glassVariant", "frosted");
  });

  it("keeps the blur between 0 and 40", () => {
    accepts("appearance.glassBlur", 0);
    accepts("appearance.glassBlur", 40);
    rejects("appearance.glassBlur", -1);
    rejects("appearance.glassBlur", 41);
  });

  it("accepts the known backgrounds", () => {
    for (const background of [
      "gradient",
      "aurora",
      "color",
      "image",
      "video",
      "none",
    ])
      accepts("appearance.glassBackground", background);
    rejects("appearance.glassBackground", "photo");
  });

  it("takes a hex color or nothing for the color background", () => {
    accepts("appearance.glassBackgroundColor", "");
    // what update() hands over when the field is cleared
    accepts("appearance.glassBackgroundColor", null);
    accepts("appearance.glassBackgroundColor", "#4c6ef5");
    rejects("appearance.glassBackgroundColor", "blue");
    rejects("appearance.glassBackgroundColor", "#4c6ef5; color: red");
  });

  it("takes only wallpaper addresses that are safe inside a CSS url()", () => {
    accepts("appearance.glassBackgroundUrl", "");
    accepts("appearance.glassBackgroundUrl", null);
    accepts("appearance.glassBackgroundUrl", "https://example.com/sea.jpg");
    accepts("appearance.glassBackgroundUrl", "/img/wallpaper.webp");
    rejects("appearance.glassBackgroundUrl", "javascript:alert(1)");
    rejects("appearance.glassBackgroundUrl", 'https://x.com/a.jpg") ; x("');
    rejects("appearance.glassBackgroundUrl", "https://x.com/a b.jpg");
  });
});
