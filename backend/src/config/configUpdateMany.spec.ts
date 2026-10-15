import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "./config.service";

// Saving the admin page sends every changed setting at once. One bad value
// used to stop the loop after the earlier ones were already written.

const variables = [
  { category: "share", name: "shareIdLength", type: "number" },
  { category: "share", name: "downloadAll", type: "string" },
  { category: "general", name: "appName", type: "string" },
] as any[];

const build = () => {
  const prisma = {
    config: {
      findUnique: jest.fn(async ({ where }) =>
        variables.find((v) => v.name === where.name_category.name),
      ),
      update: jest.fn((args) => args),
      findMany: jest.fn(async () => variables),
    },
    $transaction: jest.fn(async (writes) => writes),
  };
  return { prisma, service: new ConfigService(variables, prisma as any) };
};

describe("ConfigService.updateMany", () => {
  it("writes nothing when one of the values is refused", async () => {
    const { prisma, service } = build();
    await expect(
      service.updateMany([
        { key: "share.shareIdLength", value: 10 },
        { key: "share.downloadAll", value: "everything" },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.config.update).not.toHaveBeenCalled();
  });

  it("writes every value together and tells listeners after", async () => {
    const { prisma, service } = build();
    const heard: string[] = [];
    service.on("update", (key) => heard.push(key));
    await service.updateMany([
      { key: "general.appName", value: "" },
      { key: "share.downloadAll", value: "files" },
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(prisma.config.update.mock.calls[0][0].data.value).toBeNull();
    expect(prisma.config.update.mock.calls[1][0].data.value).toBe("files");
    expect(heard).toEqual(["general.appName", "share.downloadAll"]);
  });
});
