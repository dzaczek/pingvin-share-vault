import { fireEvent, screen, waitFor } from "@testing-library/react";
import UserPage from "../../pages/admin/users/[id]";
import { UserOverview } from "../../types/user.type";
import { renderWithProviders } from "../renderWithProviders";

// The admin's page about one account. The histories are the audit log table,
// tested on its own, so this is about what the page builds around them.

const USER_ID = "7ee8caa8-e33d-4eba-89f8-3569f4a6c93c";
const overview = jest.fn();
const revokeSessions = jest.fn();
const list = jest.fn();
const push = jest.fn();
let query: Record<string, string> = {};

jest.mock("../../services/user.service", () => ({
  __esModule: true,
  default: {
    overview: (...args: unknown[]) => overview(...args),
    revokeSessions: (...args: unknown[]) => revokeSessions(...args),
  },
}));

jest.mock("../../services/auditLog.service", () => ({
  __esModule: true,
  default: { list: (...args: unknown[]) => list(...args) },
}));

jest.mock("next/router", () => ({
  useRouter: () => ({
    query,
    pathname: "/admin/users/[id]",
    push,
    replace: jest.fn(),
  }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

const data: UserOverview = {
  user: {
    id: USER_ID,
    username: "jan",
    email: "jan@example.invalid",
    displayName: "Jan Kowalski",
    isAdmin: false,
    isActivated: true,
    isLdap: false,
    totpVerified: true,
    hasPassword: true,
    storageQuotaLimit: "1000",
    createdAt: "2026-01-01T00:00:00Z",
    oauth: [{ provider: "github", providerUsername: "jank" }],
  },
  storageUsed: 950,
  lastLogin: { createdAt: new Date().toISOString(), ipAddress: "192.0.2.1" },
  failedLogins30d: 4,
  shares: [
    {
      id: "live-share",
      name: null,
      createdAt: "2026-10-01T00:00:00Z",
      expiration: "1970-01-01T00:00:00.000Z",
      expired: false,
      views: 2,
      files: 3,
      size: 2048,
      scanStatus: "CLEAN",
      blocked: false,
      removedReason: null,
      passwordProtected: true,
      maxViews: 10,
    },
  ],
  reverseShares: [],
  sessions: [
    {
      id: "t1",
      createdAt: "2026-10-20T00:00:00Z",
      expiresAt: "2026-11-20T00:00:00Z",
      oauth: null,
    },
  ],
  identities: {
    deviceId: [
      {
        value: "d".repeat(32),
        count: 5,
        firstSeen: "2026-10-01T00:00:00Z",
        lastSeen: "2026-10-20T00:00:00Z",
      },
    ],
    visitorId: [],
    ipAddress: [],
  },
};

beforeEach(() => {
  query = { id: USER_ID };
  overview.mockReset().mockResolvedValue(data);
  revokeSessions.mockReset().mockResolvedValue({ count: 1 });
  list.mockReset().mockResolvedValue({ entries: [], nextCursor: null });
  push.mockReset();
});

describe("admin user page", () => {
  it("shows who the account is and what it holds", async () => {
    renderWithProviders(<UserPage />);

    expect(await screen.findByText("Jan Kowalski")).toBeInTheDocument();
    expect(overview).toHaveBeenCalledWith(USER_ID);
    expect(screen.getByText("2FA on")).toBeInTheDocument();
    expect(screen.getByText("github: jank")).toBeInTheDocument();
    expect(screen.getByText(/^of .+ quota$/)).toBeInTheDocument();
    expect(screen.getByText("4 failed logins in 30 days")).toBeInTheDocument();
    // a share that never expires
    expect(screen.getByText("live-share")).toBeInTheDocument();
    expect(screen.getByText("∞")).toBeInTheDocument();
    expect(screen.getByText("2 / 10")).toBeInTheDocument();
  });

  it("asks the audit log for the logins of this account", async () => {
    renderWithProviders(<UserPage />);
    fireEvent.click(
      await screen.findByRole("tab", { name: "Logins", hidden: true }),
    );

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ loginsOf: USER_ID });
  });

  it("asks for what others did with the files of this account", async () => {
    renderWithProviders(<UserPage />);
    fireEvent.click(
      await screen.findByRole("tab", {
        name: "Downloads of their files",
        hidden: true,
      }),
    );

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ filesOf: USER_ID });
  });

  it("opens the trail of a device in the audit log", async () => {
    renderWithProviders(<UserPage />);
    fireEvent.click(
      await screen.findByRole("tab", { name: "Devices and IPs", hidden: true }),
    );
    fireEvent.click(await screen.findByText("d".repeat(32)));

    expect(push).toHaveBeenCalledWith({
      pathname: "/admin/audit-logs",
      query: { kind: "deviceId", value: "d".repeat(32) },
    });
  });

  it("signs the account out everywhere after a confirmation", async () => {
    renderWithProviders(<UserPage />);
    fireEvent.click(await screen.findByText("Sign out everywhere"));
    expect(revokeSessions).not.toHaveBeenCalled();

    const confirm = await screen.findAllByText("Sign out everywhere");
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(revokeSessions).toHaveBeenCalledWith(USER_ID));
    // and loads the page again to show no sessions
    await waitFor(() => expect(overview).toHaveBeenCalledTimes(2));
  });

  it("never asks the api for an id that is no user id", async () => {
    query = { id: "../configs" };
    renderWithProviders(<UserPage />);

    expect(
      await screen.findByText("This account could not be loaded"),
    ).toBeInTheDocument();
    expect(overview).not.toHaveBeenCalled();
  });
});
