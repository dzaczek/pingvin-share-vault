import * as moment from "moment";
import { PrismaService } from "src/prisma/prisma.service";

export async function getUserActiveStorageUsage(
  prisma: PrismaService,
  userId: string,
): Promise<number> {
  const files = await prisma.file.findMany({
    where: {
      share: {
        removedReason: null,
        OR: [
          { expiration: { gt: new Date() } },
          { expiration: moment(0).toDate() },
        ],
        AND: [
          {
            OR: [
              { reverseShare: { creatorId: userId } },
              { reverseShareId: null, creatorId: userId },
            ],
          },
        ],
      },
    },
    select: { size: true },
  });

  return files.reduce((sum, file) => sum + parseInt(file.size), 0);
}

// The most one share may hold: the reverse share's own limit first, then the
// creator's, then the instance wide maximum
export function getShareSizeLimit(
  share: {
    reverseShare?: { maxShareSize: string } | null;
    creator?: { shareSizeLimit: string | null } | null;
  },
  maxSize: number,
): number {
  if (share.reverseShare?.maxShareSize)
    return parseInt(share.reverseShare.maxShareSize);
  if (share.creator?.shareSizeLimit)
    return parseInt(share.creator.shareSizeLimit);
  return maxSize;
}
