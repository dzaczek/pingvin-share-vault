import api from "../services/api.service";
import { fingerprintHash, getDeviceId, getVisitorId } from "./visitorId.util";

describe("fingerprintHash", () => {
  it("gives the same 32 hex characters for the same input", () => {
    const a = fingerprintHash("chrome~en~8");
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(fingerprintHash("chrome~en~8")).toBe(a);
  });

  it("changes with the input", () => {
    expect(fingerprintHash("chrome~en~8")).not.toBe(
      fingerprintHash("chrome~en~4"),
    );
  });
});

describe("getVisitorId", () => {
  it("is stable and lands in a cookie plain downloads will carry", () => {
    const id = getVisitorId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(getVisitorId()).toBe(id);
    expect(document.cookie).toContain(`visitor_id=${id}`);
  });

  it("is sent with every api call", async () => {
    const handler = (api.interceptors.request as any).handlers[0];
    const config = await handler.fulfilled({
      headers: new (require("axios").AxiosHeaders)(),
    });
    expect(config.headers.get("X-Browser-Fingerprint")).toBe(getVisitorId());
    expect(config.headers.get("X-Device-Id")).toBe(getDeviceId());
  });
});

describe("getDeviceId", () => {
  const fresh = () => {
    let mod: typeof import("./visitorId.util");
    jest.isolateModules(() => {
      mod = require("./visitorId.util");
    });
    return mod!.getDeviceId();
  };

  beforeEach(() => {
    document.cookie = "device_id=; max-age=0; path=/";
  });

  it("makes up a random id and keeps it in a cookie", () => {
    const id = fresh();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(document.cookie).toContain(`device_id=${id}`);
    // a new page load finds the cookie and keeps the id
    expect(fresh()).toBe(id);
  });

  it("is not the fingerprint, two equal browsers get two ids", () => {
    const first = fresh();
    document.cookie = "device_id=; max-age=0; path=/";
    expect(fresh()).not.toBe(first);
  });

  it("replaces a cookie that does not look like ours", () => {
    document.cookie = "device_id=<script>; path=/";
    expect(fresh()).toMatch(/^[a-f0-9]{32}$/);
  });
});
