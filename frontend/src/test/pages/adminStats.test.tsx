import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import AdminStats from "../../pages/admin/stats";
import { Stats } from "../../types/stats.type";
import { renderWithProviders } from "../renderWithProviders";

// The admin dashboard. The charts measure their container, which jsdom does
// not have, so they are left out here and checked in a browser.

const get = jest.fn();

jest.mock("../../services/stats.service", () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => get(...args) },
}));

jest.mock("next/dynamic", () => () => () => null);

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

const user = (id: string, username: string) => ({
  id,
  username,
  email: `${username}@example.invalid`,
  displayName: null,
});

const stats = (over: Partial<Stats> = {}): Stats => ({
  days: 30,
  since: "2026-09-24T00:00:00.000Z",
  generatedAt: "2026-10-23T12:00:00.000Z",
  totals: { users: 12, admins: 2, activeShares: 7, files: 41, storage: 3e9 },
  period: {
    newUsers: 3,
    shares: 5,
    uploads: 40,
    uploadBytes: 2e9,
    downloads: 99,
    views: 120,
    logins: 30,
    failedLogins: 4,
  },
  daily: [],
  top: {
    storage: [
      { user: user("u1", "alice"), value: 2e9 },
      { user: user("u2", "bob"), value: 1e9 },
    ],
    shares: [{ user: user("u2", "bob"), value: 4 }],
    files: [],
    uploads: [{ user: user("u1", "alice"), value: 2e9, count: 12 }],
    downloads: [],
  },
  shards: [
    {
      shardId: "node-a",
      uploads: 40,
      uploadBytes: 2e9,
      downloads: 99,
      views: 120,
      logins: 30,
      lastSeen: new Date().toISOString(),
    },
  ],
  auditLog: { enabled: true, retentionDays: 90, oldest: "2026-08-01" },
  ...over,
});

beforeEach(() => get.mockReset());

it("shows what is stored now and what happened in the period", async () => {
  get.mockResolvedValue(stats());
  renderWithProviders(<AdminStats />);

  expect(await screen.findByText("Active shares")).toBeInTheDocument();
  expect(screen.getByText("2 admins, 3 new")).toBeInTheDocument();
  expect(screen.getByText("3.0 GB")).toBeInTheDocument();
  expect(screen.getByText("4 failed")).toBeInTheDocument();
  expect(screen.getByText("node-a")).toBeInTheDocument();
  expect(screen.getByText(/keeps entries for 90 days/)).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith(30);
});

it("links the top users to their own page", async () => {
  get.mockResolvedValue(stats());
  renderWithProviders(<AdminStats />);

  const alice = await screen.findByRole("link", { name: "alice" });
  expect(alice).toHaveAttribute("href", "/admin/users/u1");

  fireEvent.click(screen.getByRole("tab", { name: "Uploaded" }));
  expect(await screen.findByText("12 files")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Files" }));
  // the other tabs stay mounted, hidden, so look in the one that is open
  expect(
    within(await screen.findByRole("tabpanel")).getByText("Nothing yet"),
  ).toBeInTheDocument();
});

it("loads another period when one is picked", async () => {
  get.mockResolvedValue(stats());
  renderWithProviders(<AdminStats />);

  fireEvent.click(await screen.findByText("7 days"));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith(7));
});

it("says so when the audit log is off", async () => {
  get.mockResolvedValue(
    stats({ auditLog: { enabled: false, retentionDays: 0, oldest: null } }),
  );
  renderWithProviders(<AdminStats />);

  expect(
    await screen.findByText(/The audit log is turned off/),
  ).toBeInTheDocument();
});
