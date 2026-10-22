import { screen, waitFor } from "@testing-library/react";
import AuditLogsPage from "../../pages/admin/audit-logs";
import { renderWithProviders } from "../renderWithProviders";

// The user page links into the audit log with ?kind=&value=, which has to
// open that trail straight away.

const list = jest.fn();
let query: Record<string, string> = {};

jest.mock("../../services/auditLog.service", () => ({
  __esModule: true,
  default: {
    list: (...args: unknown[]) => list(...args),
    shards: async () => [],
  },
}));

jest.mock("../../services/config.service", () => ({
  __esModule: true,
  default: {
    getByCategory: async () => [],
    get: jest.requireActual("../../services/config.service").default.get,
  },
}));

jest.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

beforeEach(() => {
  list.mockReset().mockResolvedValue({ entries: [], nextCursor: null });
});

describe("audit log page", () => {
  it("opens the trail named in the address", async () => {
    query = { kind: "deviceId", value: "d".repeat(32) };
    renderWithProviders(<AuditLogsPage />);

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toEqual({
      deviceId: "d".repeat(32),
      order: "asc",
    });
    expect(
      screen.getByRole("tab", { name: "Trail", hidden: true }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a kind it does not know and shows the timeline", async () => {
    query = { kind: "password", value: "x" };
    renderWithProviders(<AuditLogsPage />);

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toEqual({ action: undefined });
  });
});
