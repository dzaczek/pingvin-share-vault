import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { LocalFileService } from "./local.service";
import { S3FileService } from "./s3.service";
import { ConfigService } from "src/config/config.service";
import { createHash } from "crypto";
import { Readable } from "stream";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "src/email/email.service";
import { I18nService } from "nestjs-i18n";
import { AuditLogService } from "src/auditLog/auditLog.service";
import { safeFileName } from "src/utils/fileName.util";

const UPDATED_AT_THROTTLE_MS = 5 * 60 * 1000;
const DOWNLOAD_NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000;
const FILE_HASH_CACHE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FileService {
  constructor(
    private prisma: PrismaService,
    private localFileService: LocalFileService,
    private s3FileService: S3FileService,
    private configService: ConfigService,
    private emailService: EmailService,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private auditLog: AuditLogService,
  ) {}
  private readonly logger = new Logger(FileService.name);

  // Determine which service to use based on the current config value
  // shareId is optional -> can be used to overwrite a storage provider
  private getStorageService(
    storageProvider?: string,
  ): S3FileService | LocalFileService {
    if (storageProvider != undefined)
      return storageProvider == "S3"
        ? this.s3FileService
        : this.localFileService;
    return this.configService.get("s3.enabled")
      ? this.s3FileService
      : this.localFileService;
  }

  private cleanName(name: string) {
    const clean = safeFileName(name);
    if (!clean) throw new BadRequestException(this.i18n.t("file.invalidName"));
    return clean;
  }

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: {
      id?: string;
      name: string;
    },
    shareId: string,
  ) {
    await this.touchShare(shareId);
    const storageService = this.getStorageService();
    const created = await storageService.create(
      data,
      chunk,
      { ...file, name: this.cleanName(file.name) },
      shareId,
    );
    if (chunk.index == chunk.total - 1)
      void this.auditUpload(shareId, created.id);
    return created;
  }

  // read back from the database, that is where the final size is. Never
  // awaited by the upload, a failed lookup must not fail it.
  private async auditUpload(shareId: string, fileId: string) {
    const file = await this.prisma.file
      .findUnique({
        where: { id: fileId },
        select: {
          name: true,
          size: true,
          share: { select: { storageProvider: true } },
        },
      })
      .catch(() => null);
    if (!file) return;
    this.auditLog.log("FILE_UPLOAD", {
      resourceId: fileId,
      resourceName: file.name,
      metadata: {
        shareId,
        size: parseInt(file.size, 10),
        storage: file.share.storageProvider,
      },
    });
  }

  private async touchShare(shareId: string) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: { updatedAt: true },
    });
    if (!share) return;
    if (
      share.updatedAt &&
      Date.now() - share.updatedAt.getTime() < UPDATED_AT_THROTTLE_MS
    )
      return;
    await this.prisma.share.update({
      where: { id: shareId },
      data: { updatedAt: new Date() },
    });
  }

  async createPreSignedUploadUrls(
    shareId: string,
    fileName: string,
    totalChunks: number,
  ) {
    await this.touchShare(shareId);
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    if (share?.storageProvider !== "S3") {
      return { directToS3: false };
    }
    const res = await this.s3FileService.createPreSignedUploadUrls(
      shareId,
      this.cleanName(fileName),
      totalChunks,
    );
    return { directToS3: true, ...res };
  }

  async completePreSignedUpload(
    shareId: string,
    fileId: string,
    fileName: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
  ) {
    await this.touchShare(shareId);
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    if (share?.storageProvider !== "S3") {
      throw new BadRequestException(this.i18n.t("file.s3NotSupported"));
    }
    const completed = await this.s3FileService.completePreSignedUpload(
      shareId,
      fileId,
      this.cleanName(fileName),
      uploadId,
      parts,
    );
    void this.auditUpload(shareId, completed.id);
    return completed;
  }

  async abortPreSignedUpload(
    shareId: string,
    fileName: string,
    uploadId: string,
  ) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    if (share?.storageProvider !== "S3") {
      throw new BadRequestException(this.i18n.t("file.s3NotSupported"));
    }
    return this.s3FileService.abortPreSignedUpload(
      shareId,
      this.cleanName(fileName),
      uploadId,
    );
  }

  async getPreSignedDownloadUrl(
    shareId: string,
    fileId: string,
    isDownload: boolean,
  ): Promise<string> {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    if (share?.storageProvider !== "S3") {
      throw new BadRequestException(this.i18n.t("file.s3NotSupported"));
    }
    return this.s3FileService.getPreSignedDownloadUrl(
      shareId,
      fileId,
      isDownload,
    );
  }

  async get(
    shareId: string,
    fileId: string,
    range?: { start: number; end?: number } | string,
  ): Promise<File> {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
    });
    const storageService = this.getStorageService(share?.storageProvider);
    return storageService.get(shareId, fileId, range);
  }

  // Reads the file once and hands back its sha256, so an admin can look the
  // file up on VirusTotal without anything being uploaded there. No column
  // holds the digest: adding one and backfilling every existing file is a
  // bigger change than this needed to be.
  //
  // The whole file goes through the hash, so this sits behind an admin guard
  // and a low rate limit. The answer is cached because a file is never
  // rewritten once uploaded, which keeps a second look at the same file off
  // the disk entirely. On S3 it also pulls the object back through the
  // server, which costs egress, so the cache matters more there.
  async computeSha256(shareId: string, fileId: string): Promise<string> {
    const cacheKey = `file-sha256:${shareId}:${fileId}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const { file } = await this.get(shareId, fileId);

    if (!file) throw new NotFoundException(this.i18n.t("file.notFound"));

    const hash = createHash("sha256");
    for await (const chunk of file) {
      hash.update(chunk);
    }
    const digest = hash.digest("hex");

    await this.cache.set(cacheKey, digest, FILE_HASH_CACHE_MS);

    return digest;
  }

  async remove(shareId: string, fileId: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    const storageService = this.getStorageService(share?.storageProvider);
    return storageService.remove(shareId, fileId);
  }

  async deleteAllFiles(shareId: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { id: true, storageProvider: true },
    });
    const storageService = this.getStorageService(share?.storageProvider);
    return storageService.deleteAllFiles(shareId);
  }

  async getZip(shareId: string): Promise<Readable> {
    if (!this.configService.get("share.downloadAll").startsWith("zip-"))
      throw new NotFoundException();

    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    const storageService = this.getStorageService(share?.storageProvider);
    return await storageService.getZip(shareId);
  }

  async notifyRecipientDownload(
    shareId: string,
    fileName: string,
    recipientId?: string,
  ) {
    try {
      if (
        !recipientId ||
        !this.configService.get("smtp.enabled") ||
        !this.configService.get("share.enableShareEmailRecipients") ||
        !this.configService.get("share.enableShareDownloadNotifications")
      )
        return;

      const notificationKey = `share-download-notification:${shareId}:${recipientId}`;
      if (await this.cache.get<true>(notificationKey)) return;

      const share = await this.prisma.share.findUnique({
        where: { id: shareId },
        select: {
          id: true,
          creator: {
            select: { email: true, username: true, displayName: true },
          },
          recipients: {
            where: { id: recipientId },
            select: { email: true },
          },
        },
      });

      const recipient = share?.recipients[0];
      if (!share?.creator?.email || !recipient) return;

      const recipientUser = await this.prisma.user.findUnique({
        where: { email: recipient.email },
        select: { displayName: true, username: true },
      });

      await this.cache.set(
        notificationKey,
        true,
        DOWNLOAD_NOTIFICATION_COOLDOWN_MS,
      );

      await this.emailService.sendShareDownloadNotification(
        share.creator.email,
        share.id,
        fileName,
        recipient.email,
        share.creator?.displayName || share.creator?.username,
        recipientUser?.displayName || recipientUser?.username,
      );
    } catch (e) {
      this.logger.error(
        `Failed to notify recipient download for share ${shareId}`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  async getStorageProvider(shareId: string): Promise<string> {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      select: { storageProvider: true },
    });
    return share?.storageProvider || "LOCAL";
  }

  async getFileName(shareId: string, fileId: string): Promise<string> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: { name: true },
    });
    if (!file) throw new NotFoundException(this.i18n.t("file.notFound"));
    return file.name;
  }

  private async streamToUint8Array(stream: Readable): Promise<Uint8Array> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      stream.on("error", reject);
    });
  }
}

export interface File {
  metaData: {
    id: string;
    size: string;
    createdAt: Date;
    mimeType: string | false;
    name: string;
    shareId: string;
  };
  file?: Readable;
  range?: { start: number; end: number };
  isRangeNotSatisfiable?: boolean;
}
