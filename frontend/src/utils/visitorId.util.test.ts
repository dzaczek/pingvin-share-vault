import api from "../services/api.service";
import { fingerprintHash, getVisitorId } from "./visitorId.util";

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
  });
});
