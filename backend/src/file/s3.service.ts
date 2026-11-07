import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  UploadPartCommand,
  UploadPartCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as contentDisposition from "content-disposition";
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "src/config/config.service";
import { I18nService } from "nestjs-i18n";
import * as crypto from "crypto";
import * as mime from "mime-types";
import { byteToHumanSizeString } from "src/utils/fileSize.util";
import {
  getShareSizeLimit,
  getUserActiveStorageUsage,
} from "src/utils/storageQuota.util";
import { File } from "./file.service";
import { streamedZipLevel } from "./zipLevel";
import { Readable } from "stream";
import { validate as isValidUUID } from "uuid";
import * as archiver from "archiver";
import { safeFileName } from "src/utils/fileName.util";

@Injectable()
export class S3FileService {
  private readonly logger = new Logger(S3FileService.name);

  private multipartUploads: Record<
    string,
    {
      shareId: string;
      uploadId: string;
      parts: Array<{ ETag: string | undefined; PartNumber: number }>;
      uploadedBytes: number;
    }
  > = {};

  // bytes the share's other files have sent so far, uploads running at the
  // same time each saw room for themselves otherwise
  private otherUploadsBytes(shareId: string, fileId: string) {
    return Object.entries(this.multipartUploads)
      .filter(([id, upload]) => id !== fileId && upload.shareId === shareId)
      .reduce((n, [, upload]) => n + upload.uploadedBytes, 0);
  }

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    shareId: string,
  ) {
    if (!file.id) {
      file.id = crypto.randomUUID();
    } else if (!isValidUUID(file.id)) {
      throw new BadRequestException(this.i18n.t("file.invalidIdFormat"));
    }

    const buffer = Buffer.from(data, "base64");
    const key = `${this.getS3Path()}${shareId}/${file.name}`;
    const bucketName = this.config.get("s3.bucketName");
    const s3Instance = this.getS3Instance();
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        files: true,
        creator: true,
        reverseShare: { include: { creator: true } },
      },
    });

    if (share.uploadLocked)
      throw new BadRequestException(this.i18n.t("file.alreadyCompleted"));

    // the object key is the file name, so a second file of the same name
    // would silently replace the first one in the bucket
    if (chunk.index === 0 && share.files.some((f) => f.name === file.name))
      throw new BadRequestException(this.i18n.t("file.nameInUse"));

    // same limit as a local upload, checked before anything goes to the bucket
    const otherUploads = this.otherUploadsBytes(shareId, file.id);
    const shareSizeSum =
      share.files.reduce((n, { size }) => n + parseInt(size), 0) +
      otherUploads +
      (chunk.index === 0
        ? 0
        : (this.multipartUploads[file.id]?.uploadedBytes ?? 0)) +
      buffer.byteLength;
    if (
      shareSizeSum > getShareSizeLimit(share, this.config.get("share.maxSize"))
    ) {
      throw new HttpException(
        this.i18n.t("file.maxSizeExceeded"),
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    try {
      // Initialize multipart upload if it's the first chunk
      if (chunk.index === 0) {
        // a first chunk sent again starts over, the upload it replaces would
        // otherwise stay open in the bucket and keep its parts
        const replaced = this.multipartUploads[file.id];
        if (replaced) {
          delete this.multipartUploads[file.id];
          await s3Instance
            .send(
              new AbortMultipartUploadCommand({
                Bucket: bucketName,
                Key: key,
                UploadId: replaced.uploadId,
              }),
            )
            .catch((e) =>
              this.logger.warn(`Could not abort a replaced upload: ${e}`),
            );
        }

        const multipartInitResponse = await s3Instance.send(
          new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
          }),
        );

        const uploadId = multipartInitResponse.UploadId;
        if (!uploadId) {
          throw new Error(this.i18n.t("file.s3UploadInitError"));
        }

        // Store the uploadId and parts list in memory
        this.multipartUploads[file.id] = {
          shareId,
          uploadId,
          parts: [],
          uploadedBytes: 0,
        };
      }

      // Get the ongoing multipart upload
      const multipartUpload = this.multipartUploads[file.id];
      if (!multipartUpload) {
        throw new InternalServerErrorException(
          this.i18n.t("file.s3SessionNotFound"),
        );
      }

      const quotaOwner = share?.reverseShare
        ? share.reverseShare.creator
        : share?.creator;
      const quotaOwnerId = share?.reverseShare
        ? share.reverseShare.creatorId
        : share?.creatorId;

      if (quotaOwnerId && quotaOwner?.storageQuotaLimit) {
        const quotaLimit = parseInt(quotaOwner.storageQuotaLimit);
        const activeStorageUsage = await getUserActiveStorageUsage(
          this.prisma,
          quotaOwnerId,
        );
        const projectedUsage =
          activeStorageUsage +
          otherUploads +
          multipartUpload.uploadedBytes +
          buffer.byteLength;

        if (projectedUsage > quotaLimit) {
          const exceededBytes = projectedUsage - quotaLimit;
          const exceededSize = byteToHumanSizeString(exceededBytes);
          throw new BadRequestException(
            share?.reverseShare
              ? this.i18n.t("file.reverseShareQuotaExceeded", {
                  args: { exceededSize },
                })
              : this.i18n.t("file.storageQuotaExceeded", {
                  args: { exceededSize },
                }),
          );
        }
      }

      const uploadId = multipartUpload.uploadId;

      // Upload the current chunk
      const partNumber = chunk.index + 1; // Part numbers start from 1

      const uploadPartResponse: UploadPartCommandOutput = await s3Instance.send(
        new UploadPartCommand({
          Bucket: bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: buffer,
        }),
      );

      // Store the ETag and PartNumber for later completion
      multipartUpload.parts.push({
        ETag: uploadPartResponse.ETag,
        PartNumber: partNumber,
      });
      multipartUpload.uploadedBytes += buffer.byteLength;

      // Complete the multipart upload if it's the last chunk
      if (chunk.index === chunk.total - 1) {
        // The lock was read when this chunk arrived. Completing the share
        // locks it before the virus scan lists the files, so an object
        // finished now would never be scanned. Another upload of the same
        // name may also have finished meanwhile, under the same key.
        const current = await this.prisma.share.findUnique({
          where: { id: shareId },
          select: { uploadLocked: true, files: { select: { name: true } } },
        });
        if (
          current?.uploadLocked ||
          current?.files.some((f) => f.name === file.name)
        ) {
          throw new BadRequestException(this.i18n.t("file.alreadyCompleted"));
        }

        await s3Instance.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: multipartUpload.parts,
            },
          }),
        );

        // Remove the completed upload from memory
        delete this.multipartUploads[file.id];
      }
    } catch (error) {
      // Abort the multipart upload if it fails
      const multipartUpload = this.multipartUploads[file.id];
      if (multipartUpload) {
        try {
          await s3Instance.send(
            new AbortMultipartUploadCommand({
              Bucket: bucketName,
              Key: key,
              UploadId: multipartUpload.uploadId,
            }),
          );
        } catch (abortError) {
          console.error("Error aborting multipart upload:", abortError);
        }
        delete this.multipartUploads[file.id];
      }
      this.logger.error(error);
      throw new Error(this.i18n.t("file.s3UploadFailed"));
    }

    const isLastChunk = chunk.index == chunk.total - 1;
    if (isLastChunk) {
      const fileSize: number = await this.getFileSize(shareId, file.name);

      await this.prisma.file.create({
        data: {
          id: file.id,
          name: file.name,
          size: fileSize.toString(),
          share: { connect: { id: shareId } },
        },
      });
    }

    return file;
  }

  async get(
    shareId: string,
    fileId: string,
    range?: { start: number; end?: number } | string,
  ): Promise<File> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
    });
    if (!file) throw new NotFoundException(this.i18n.t("file.notFound"));
    const fileName = file.name;

    let rangeString: string | undefined;
    if (typeof range === "string") {
      rangeString = range;
    } else if (range && typeof range === "object") {
      rangeString = `bytes=${range.start}-${range.end ?? ""}`;
    }

    const s3Instance = this.getS3Instance();
    const key = `${this.getS3Path()}${shareId}/${fileName}`;
    const response = await s3Instance.send(
      new GetObjectCommand({
        Bucket: this.config.get("s3.bucketName"),
        Key: key,
        Range: rangeString,
      }),
    );

    return {
      metaData: {
        id: fileId,
        size: response.ContentLength?.toString() || "0",
        name: fileName,
        shareId: shareId,
        createdAt: response.LastModified || new Date(),
        mimeType:
          mime.contentType(fileId.split(".").pop()) ||
          "application/octet-stream",
      },
      file: response.Body as Readable,
    } as File;
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
    });

    if (!fileMetaData)
      throw new NotFoundException(this.i18n.t("file.notFound"));

    const key = `${this.getS3Path()}${shareId}/${fileMetaData.name}`;
    const s3Instance = this.getS3Instance();

    try {
      await s3Instance.send(
        new DeleteObjectCommand({
          Bucket: this.config.get("s3.bucketName"),
          Key: key,
        }),
      );
    } catch {
      throw new Error(this.i18n.t("file.s3DeleteError"));
    }

    await this.prisma.file.delete({ where: { id: fileId } });
  }

  async deleteAllFiles(shareId: string) {
    const prefix = `${this.getS3Path()}${shareId}/`;
    const s3Instance = this.getS3Instance();
    const bucketName = this.config.get("s3.bucketName");

    const fallbackDeleteByDb = async (reason: string) => {
      const files = await this.prisma.file.findMany({
        where: { shareId },
        select: { name: true },
      });
      void reason;

      for (const f of files) {
        const key = `${this.getS3Path()}${shareId}/${f.name}`;
        try {
          await s3Instance.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            }),
          );
        } catch {
          // ignore per-object failure
        }
      }
    };

    try {
      // List all objects under the given prefix
      const listResponse = await s3Instance.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
        }),
      );

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return;
      }

      // Extract the keys of the files to be deleted
      const objectsToDelete = listResponse.Contents.map((file) => ({
        Key: file.Key!,
      }));

      // Delete all files in a single request (up to 1000 objects at once)
      await s3Instance.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: objectsToDelete,
          },
        }),
      );
    } catch (error) {
      // try deleting by known file names from DB instead.
      await fallbackDeleteByDb("list_or_bulk_delete_failed");
      void error;
    }
  }

  async getFileSize(shareId: string, fileName: string): Promise<number> {
    const key = `${this.getS3Path()}${shareId}/${fileName}`;
    const s3Instance = this.getS3Instance();

    try {
      // Get metadata of the file using HeadObjectCommand
      const headObjectResponse = await s3Instance.send(
        new HeadObjectCommand({
          Bucket: this.config.get("s3.bucketName"),
          Key: key,
        }),
      );

      // Return ContentLength which is the file size in bytes
      return headObjectResponse.ContentLength ?? 0;
    } catch {
      throw new Error(this.i18n.t("file.s3SizeError"));
    }
  }

  getS3Instance(): S3Client {
    const checksumCalculation =
      this.config.get("s3.useChecksum") === true ? null : "WHEN_REQUIRED";

    return new S3Client({
      endpoint: this.config.get("s3.endpoint"),
      region: this.config.get("s3.region"),
      credentials: {
        accessKeyId: this.config.get("s3.key"),
        secretAccessKey: this.config.get("s3.secret"),
      },
      forcePathStyle: true,
      requestChecksumCalculation: checksumCalculation,
      responseChecksumValidation: checksumCalculation,
    });
  }

  async getZip(shareId: string) {
    const files = await this.prisma.file.findMany({
      where: { shareId },
    });

    if (files.length === 0) {
      throw new NotFoundException(`No files found for share ${shareId}`);
    }

    const s3Instance = this.getS3Instance();
    const bucketName = this.config.get("s3.bucketName");
    const compressionLevel = this.config.get("share.zipCompressionLevel");
    const s3Path = this.getS3Path();

    const archive = archiver("zip", {
      zlib: { level: streamedZipLevel(parseInt(compressionLevel)) },
    });

    archive.on("error", (err) => {
      this.logger.error("Archive error", err);
    });

    const processFiles = async () => {
      for (const file of files) {
        // the download was given up on, stop asking the bucket for more
        if (archive.destroyed) return;
        const key = `${s3Path}${shareId}/${file.name}`;
        try {
          const response = await s3Instance.send(
            new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            }),
          );

          if (response.Body instanceof Readable) {
            const body = response.Body as Readable;
            archive.append(body, { name: safeFileName(file.name) || file.id });
            // Wait for this file to be fully appended before moving to the next one to avoid overwhelming memory/connections
            // a destroyed archive never reads the rest of this body
            const onArchiveClose = () => body.destroy();
            archive.once("close", onArchiveClose);
            await new Promise<void>((resolve, reject) => {
              body.on("end", resolve);
              body.on("error", reject);
              body.on("close", resolve);
            }).finally(() => archive.off("close", onArchiveClose));
          }
        } catch (error) {
          this.logger.error(`Error processing file ${file.name}`, error);
        }
      }
      if (!archive.destroyed) archive.finalize();
    };

    void processFiles();

    return archive;
  }

  async createPreSignedUploadUrls(
    shareId: string,
    fileName: string,
    totalChunks: number,
  ): Promise<{ uploadId: string; key: string; urls: string[] }> {
    const key = `${this.getS3Path()}${shareId}/${fileName}`;
    const bucketName = this.config.get("s3.bucketName");
    const s3Instance = this.getS3Instance();

    try {
      const multipartInitResponse = await s3Instance.send(
        new CreateMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      const uploadId = multipartInitResponse.UploadId;
      if (!uploadId) {
        throw new InternalServerErrorException(
          this.i18n.t("file.s3UploadInitError"),
        );
      }

      const urls: string[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const partNumber = i + 1;
        const command = new UploadPartCommand({
          Bucket: bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
        });
        const url = await getSignedUrl(s3Instance, command, {
          expiresIn: 3600,
        });
        urls.push(url);
      }

      return { uploadId, key, urls };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        this.i18n.t("file.s3UploadInitError"),
      );
    }
  }

  // The parts of a presigned upload went straight to the bucket, so its size
  // is only known once it is complete. The same share size limit and storage
  // quota as a chunked upload apply, an object over either is removed again.
  private async assertPresignedUploadFits(
    shareId: string,
    size: number,
    key: string,
  ) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        files: true,
        creator: true,
        reverseShare: { include: { creator: true } },
      },
    });
    const shareSize =
      share.files.reduce((n, file) => n + parseInt(file.size), 0) + size;

    let error: HttpException | undefined;
    if (
      shareSize > getShareSizeLimit(share, this.config.get("share.maxSize"))
    ) {
      error = new HttpException(
        this.i18n.t("file.maxSizeExceeded"),
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    } else {
      const quotaOwner = share.reverseShare
        ? share.reverseShare.creator
        : share.creator;
      const quotaOwnerId = share.reverseShare
        ? share.reverseShare.creatorId
        : share.creatorId;
      if (quotaOwnerId && quotaOwner?.storageQuotaLimit) {
        const exceededBytes =
          (await getUserActiveStorageUsage(this.prisma, quotaOwnerId)) +
          size -
          parseInt(quotaOwner.storageQuotaLimit);
        if (exceededBytes > 0) {
          const exceededSize = byteToHumanSizeString(exceededBytes);
          error = new BadRequestException(
            this.i18n.t(
              share.reverseShare
                ? "file.reverseShareQuotaExceeded"
                : "file.storageQuotaExceeded",
              { args: { exceededSize } },
            ),
          );
        }
      }
    }
    if (!error) return;

    await this.getS3Instance()
      .send(
        new DeleteObjectCommand({
          Bucket: this.config.get("s3.bucketName"),
          Key: key,
        }),
      )
      .catch((e) =>
        this.logger.error("Failed to remove an S3 upload over the limit:", e),
      );
    throw error;
  }

  async completePreSignedUpload(
    shareId: string,
    fileId: string,
    fileName: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
  ): Promise<{ id: string; name: string }> {
    if (!fileId) {
      fileId = crypto.randomUUID();
    } else if (!isValidUUID(fileId)) {
      throw new BadRequestException(this.i18n.t("file.invalidIdFormat"));
    }

    const key = `${this.getS3Path()}${shareId}/${fileName}`;
    const bucketName = this.config.get("s3.bucketName");
    const s3Instance = this.getS3Instance();

    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

    try {
      await s3Instance.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: sortedParts,
          },
        }),
      );
    } catch (error) {
      this.logger.error("Failed to complete S3 multipart upload:", error);
      throw new BadRequestException(this.i18n.t("file.s3UploadFailed"));
    }

    let fileSize: number;
    try {
      fileSize = await this.getFileSize(shareId, fileName);
    } catch (error) {
      this.logger.error("Failed to read the size of an S3 upload:", error);
      throw new InternalServerErrorException(
        this.i18n.t("file.s3UploadFailed"),
      );
    }
    await this.assertPresignedUploadFits(shareId, fileSize, key);

    try {
      const existingFile = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!existingFile) {
        await this.prisma.file.create({
          data: {
            id: fileId,
            name: fileName,
            size: fileSize.toString(),
            share: { connect: { id: shareId } },
          },
        });
      }

      return { id: fileId, name: fileName };
    } catch (error) {
      this.logger.error(
        "Error creating database record after S3 upload completion:",
        error,
      );
      throw new InternalServerErrorException(
        this.i18n.t("file.s3UploadFailed"),
      );
    }
  }

  async abortPreSignedUpload(
    shareId: string,
    fileName: string,
    uploadId: string,
  ): Promise<void> {
    const key = `${this.getS3Path()}${shareId}/${fileName}`;
    const bucketName = this.config.get("s3.bucketName");
    const s3Instance = this.getS3Instance();

    try {
      await s3Instance.send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (error) {
      this.logger.error("Error aborting multipart upload:", error);
    }
  }

  async getPreSignedDownloadUrl(
    shareId: string,
    fileId: string,
    isDownload: boolean,
  ): Promise<string> {
    const fileRecord = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
    });
    if (!fileRecord) {
      throw new NotFoundException(this.i18n.t("file.notFound"));
    }

    const key = `${this.getS3Path()}${shareId}/${fileRecord.name}`;
    const bucketName = this.config.get("s3.bucketName");
    const s3Instance = this.getS3Instance();

    // The local preview sends the type, nosniff and a CSP sandbox, none of
    // which a bucket redirect can carry. So the type is pinned here, and only
    // what a browser shows without running anything is opened inline: passive
    // media, plain text and PDF (the preview opens those). Pages, SVG and the
    // rest are downloaded instead of rendering on the bucket's origin.
    const mimeType = mime.lookup(fileRecord.name) || "application/octet-stream";
    const showInline =
      !isDownload &&
      (mimeType.startsWith("video/") ||
        mimeType.startsWith("audio/") ||
        (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") ||
        mimeType === "text/plain" ||
        mimeType === "application/pdf");

    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ResponseContentType: mimeType,
      ResponseContentDisposition: contentDisposition(
        fileRecord.name,
        showInline ? { type: "inline" } : undefined,
      ),
    });

    return await getSignedUrl(s3Instance, getObjectCommand, { expiresIn: 300 });
  }

  getS3Path(): string {
    const configS3Path = this.config.get("s3.bucketPath");
    if (!configS3Path) return "";
    const normalized = `${configS3Path}`.replace(/^\/+|\/+$/g, "");
    return normalized ? `${normalized}/` : "";
  }
}
