import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateShareDTO } from "./dto/createShare.dto";
import { ShareService } from "./share.service";

// complete() read "not completed yet" and the maxShares count, sent the
// recipient mail, and only then wrote uploadLocked. Two requests at once both
// got through: past maxShares, and every recipient mailed twice. Reopening
// refunded the reverse share use on a stale read, so two reopenings at once
// gave two uses back.

const t = { t: (key: string) => key } as any;

const build = (prisma: any) => {
  const unused = {} as any;
  const config = { get: () => false };
  const mail = { sendMailToShareRecipients: jest.fn() };
  const service = new ShareService(
    prisma,
    config as any,
    unused,
    mail as any,
    config as any,
    unused,
    unused,
    { checkAndRemove: jest.fn(async () => undefined) } as any,
    unused,
    unused,
    t,
    { log: jest.fn() } as any,
  );
  return { service, mail };
};

const share = (extra: object = {}) => ({
  id: "s1",
  uploadLocked: false,
  files: [{ id: "f1", size: "1" }],
  recipients: [{ id: "r1", email: "anna@example.com" }],
  creator: { id: "u1", allowShare: true, maxShares: 1 },
  reverseShare: null,
  ...extra,
});

describe("completing a share", () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      share: {
        findUnique: jest.fn(async () => share()),
        updateMany: jest.fn(async () => ({ count: 1 })),
        count: jest.fn(async () => 0),
        update: jest.fn(async () => share({ uploadLocked: true })),
      },
      user: { findMany: jest.fn(async () => []) },
    };
  });

  it("claims the share before it mails anyone", async () => {
    const { service, mail } = build(prisma);
    await service.complete("s1");
    expect(prisma.share.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", uploadLocked: false },
      data: { uploadLocked: true },
    });
    expect(prisma.share.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mail.sendMailToShareRecipients.mock.invocationCallOrder[0],
    );
  });

  it("sends nothing when another request completed it first", async () => {
    prisma.share.updateMany.mockResolvedValue({ count: 0 });
    const { service, mail } = build(prisma);
    await expect(service.complete("s1")).rejects.toMatchObject({
      status: 400,
    });
    expect(mail.sendMailToShareRecipients).not.toHaveBeenCalled();
  });

  it("gives the claim back when two completions went past maxShares", async () => {
    // before the claim nothing is active, after it this and another are
    prisma.share.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    const { service, mail } = build(prisma);
    await expect(service.complete("s1")).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.share.updateMany).toHaveBeenLastCalledWith({
      where: { id: "s1" },
      data: { uploadLocked: false },
    });
    expect(mail.sendMailToShareRecipients).not.toHaveBeenCalled();
  });
});

describe("reopening a share", () => {
  it("gives a reverse share use back only once", async () => {
    const prisma = {
      share: {
        findUnique: jest.fn(async () =>
          share({ uploadLocked: true, reverseShare: { id: "rs1" } }),
        ),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      reverseShare: { update: jest.fn() },
    };
    const { service } = build(prisma);
    jest
      .spyOn(service as any, "discardPrebuiltZip")
      .mockResolvedValue(undefined);

    // both read uploadLocked = true, only one turns it off
    await service.revertComplete("s1");
    await service.revertComplete("s1");

    expect(prisma.reverseShare.update).toHaveBeenCalledTimes(1);
  });
});

describe("share recipients", () => {
  it("are capped", async () => {
    const dto = plainToInstance(CreateShareDTO, {
      id: "abc",
      expiration: "never",
      recipients: Array.from({ length: 101 }, (_, i) => `r${i}@example.com`),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "recipients")).toBe(true);
  });
});
