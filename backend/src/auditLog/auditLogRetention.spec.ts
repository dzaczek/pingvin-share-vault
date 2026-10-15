import { AuditLogService } from "./auditLog.service";

// How long the audit log is kept is a setting of the admin page now. The old
// environment variable only provides its default.

const build = (days: number) => {
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const service = new AuditLogService(
    { auditLog: { deleteMany } } as any,
    { get: () => days } as any,
  );
  return { service, deleteMany };
};

describe("AuditLogService.deleteExpired", () => {
  afterEach(() => jest.restoreAllMocks());

  it("deletes what is older than the configured number of days", async () => {
    const { service, deleteMany } = build(30);
    const now = Date.UTC(2026, 9, 15);
    jest.spyOn(Date, "now").mockReturnValue(now);
    await service.deleteExpired();
    const cutoff = deleteMany.mock.calls[0][0].where.createdAt.lt.getTime();
    expect(cutoff).toBe(now - 30 * 86_400_000);
  });

  it("keeps everything when set to 0", async () => {
    const { service, deleteMany } = build(0);
    await service.deleteExpired();
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
