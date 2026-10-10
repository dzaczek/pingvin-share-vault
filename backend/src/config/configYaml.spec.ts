import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ConfigService } from "./config.service";

jest.mock("src/constants", () => ({
  get CONFIG_FILE() {
    return configFile;
  },
}));

// config.yaml is read once at startup and laid over the values from the
// database. The example file promises that a key left out keeps the value set
// in the UI, and people write booleans without quotes.

let configFile = "";

const load = async (yaml: string) => {
  fs.writeFileSync(configFile, yaml);
  const variables = [
    { category: "general", name: "appName", type: "string", value: "From UI", defaultValue: "Pingvin" },
    { category: "general", name: "showHomePage", type: "boolean", value: "false", defaultValue: "true" },
    { category: "share", name: "maxSize", type: "filesize", value: "100", defaultValue: "1000" },
  ] as any[];
  const service = new ConfigService(variables, {} as any);
  const events: [string, unknown][] = [];
  service.on("update", (key, value) => events.push([key, value]));
  await service.initialize();
  return { service, events };
};

beforeEach(() => {
  configFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "pingvin-config-")),
    "config.yaml",
  );
});

afterEach(() =>
  fs.rmSync(path.dirname(configFile), { recursive: true, force: true }),
);

describe("config.yaml", () => {
  it("starts without an initUser section", async () => {
    const { service } = await load("general:\n  appName: From file\n");
    expect(service.get("general.appName")).toBe("From file");
  });

  it("keeps the UI value for a key the file leaves out", async () => {
    const { service } = await load("general:\n  showHomePage: \"true\"\n");
    expect(service.get("general.appName")).toBe("From UI");
  });

  it("reads a boolean written without quotes", async () => {
    const { service } = await load("general:\n  showHomePage: true\n");
    expect(service.get("general.showHomePage")).toBe(true);
  });

  it("reads a number written without quotes", async () => {
    const { service } = await load("share:\n  maxSize: 5000\n");
    expect(service.get("share.maxSize")).toBe(5000);
  });

  it("announces each value under its full key", async () => {
    const { events } = await load("general:\n  appName: From file\n");
    expect(events).toContainEqual(["general.appName", "From file"]);
  });
});
