import { ConfigService } from "./config.service";

// The admin page used to get every saved password and client secret back in
// plain text. It only learns whether one is saved now.

const variables = [
  {
    category: "smtp",
    name: "password",
    type: "string",
    obscured: true,
    value: "hunter2",
    defaultValue: "",
    order: 0,
  },
  {
    category: "smtp",
    name: "username",
    type: "string",
    obscured: false,
    value: "mailer",
    defaultValue: "",
    order: 1,
  },
  {
    category: "smtp",
    name: "unused",
    type: "string",
    obscured: true,
    value: null,
    defaultValue: "",
    order: 2,
  },
] as any[];

describe("ConfigService.getByCategory secrets", () => {
  it("never hands out an obscured value, only whether one is saved", async () => {
    const list = await new ConfigService(variables, {} as any).getByCategory(
      "smtp",
    );
    const byName = Object.fromEntries(list.map((v) => [v.name, v]));

    expect(JSON.stringify(list)).not.toContain("hunter2");
    expect(byName.password).toMatchObject({ value: "", isSet: true });
    expect(byName.unused).toMatchObject({ value: "", isSet: false });
    expect(byName.username).toMatchObject({ value: "mailer" });
  });
});
