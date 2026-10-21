import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AuditLogEntry } from "../../../types/auditLog.type";
import AuditLogTable from "./AuditLogTable";

// Every resource in a row opens its own trail: the file itself, the share it
// belongs to and the shard that wrote the entry.

const list = jest.fn();

jest.mock("../../../services/auditLog.service", () => ({
  __esModule: true,
  default: { list: (...args: unknown[]) => list(...args) },
}));

const row = (data: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: Math.random().toString(),
  createdAt: new Date().toISOString(),
  userId: null,
  userEmail: null,
  visitorId: null,
  ipAddress: "192.0.2.1",
  userAgent: "test",
  shardId: "main-node",
  action: "FILE_DOWNLOAD",
  resourceId: null,
  resourceName: null,
  metadata: null,
  ...data,
});

const renderRows = async (entries: AuditLogEntry[]) => {
  list.mockResolvedValue({ entries, nextCursor: null });
  const onSelect = jest.fn();
  renderWithProviders(
    <AuditLogTable filter={{}} onSelectIdentity={onSelect} />,
  );
  await screen.findByText(entries[0].resourceName!);
  return onSelect;
};

describe("AuditLogTable", () => {
  it("opens the trail of a file, of its share and of the shard", async () => {
    const onSelect = await renderRows([
      row({
        resourceId: "f1",
        resourceName: "report.pdf",
        metadata: { shareId: "s1" },
        shardId: "node-2",
      }),
    ]);

    fireEvent.click(screen.getByText("report.pdf"));
    fireEvent.click(screen.getByText("s1"));
    fireEvent.click(screen.getByText("node-2"));

    expect(onSelect.mock.calls).toEqual([
      ["resourceId", "f1"],
      ["shareId", "s1"],
      ["shardId", "node-2"],
    ]);
  });

  it("treats the resource of a share view and of a zip as the share", async () => {
    const onSelect = await renderRows([
      row({ action: "SHARE_VIEW", resourceId: "s1", resourceName: "Holiday" }),
      row({
        resourceId: "s2",
        resourceName: "s2.zip",
        metadata: { shareId: "s2", zip: true },
      }),
    ]);

    fireEvent.click(screen.getByText("Holiday"));
    fireEvent.click(screen.getByText("s2.zip"));

    expect(onSelect.mock.calls).toEqual([
      ["shareId", "s1"],
      ["shareId", "s2"],
    ]);
  });
});
