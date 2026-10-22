import { ShareAccessLogService } from "./shareAccessLog.service";

const build = (enabled: boolean) => {
  const created: any[] = [];
  const prisma = {
    shareAccessLog: { create: async (args: any) => created.push(args.data) },
  };
  const config = { get: () => enabled };
  const service = new ShareAccessLogService(prisma as any, config as any);
  return { service, created };
};

describe("ShareAccessLogService.log", () => {
  it("records the access", async () => {
    const { service, created } = build(true);
    await service.log("s1", "203.0.113.7", "VIEWED");
    expect(created).toEqual([
      { shareId: "s1", ip: "203.0.113.7", event: "VIEWED" },
    ]);
  });

  it("writes nothing when audit logging is turned off", async () => {
    const { service, created } = build(false);
    await service.log("s1", "203.0.113.7", "VIEWED");
    expect(created).toEqual([]);
  });
});
