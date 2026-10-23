import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ShareService } from '../src/share/share.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../src/email/email.service';
import { FileService } from '../src/file/file.service';
import { JwtService } from '@nestjs/jwt';
import { ReverseShareService } from '../src/reverseShare/reverseShare.service';
import { ClamScanService } from '../src/clamscan/clamscan.service';
import { SystemService } from '../src/system/system.service';
import { ShareAccessLogService } from '../src/shareAccessLog/shareAccessLog.service';
import { I18nService } from 'nestjs-i18n';
import { ConfigService as AppConfigService } from '../src/config/config.service';
import { AuditLogService } from '../src/auditLog/auditLog.service';

describe('ShareService Optimization', () => {
  let shareService: ShareService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
            },
            shareUserRecipient: {
              upsert: jest.fn(),
            },
            reverseShare: {
              updateMany: jest.fn(),
            },
            share: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'share.enableUserRecipients') return true;
              if (key === 'security.enableEmailVerification') return true;
              return false;
            }),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'share.enableUserRecipients') return true;
              if (key === 'security.enableEmailVerification') return true;
              return false;
            }),
          },
        },
        { provide: FileService, useValue: {} },
        { provide: EmailService, useValue: { sendMailToShareRecipients: jest.fn() } },
        { provide: JwtService, useValue: {} },
        { provide: ReverseShareService, useValue: {} },
        { provide: ClamScanService, useValue: { checkAndRemove: jest.fn() } },
        { provide: SystemService, useValue: {} },
        { provide: ShareAccessLogService, useValue: {} },
        { provide: I18nService, useValue: { t: jest.fn() } },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: 'bull_Queue_jobs', useValue: {} },
      ],
    }).compile();

    shareService = module.get<ShareService>(ShareService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  // the dashboard counts new shares from this entry
  it('logs a finished share with its file count and size', async () => {
    jest.spyOn(shareService, 'isShareCompleted').mockResolvedValue(false);
    (prismaService.share.findUnique as jest.Mock).mockResolvedValue({
      id: 'share1',
      name: 'holiday',
      files: [{ size: '10' }],
      recipients: [],
      creator: {},
    });
    (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);

    await shareService.complete('share1');

    expect(shareService['auditLog'].log).toHaveBeenCalledWith('SHARE_CREATE', {
      resourceId: 'share1',
      resourceName: 'holiday',
      metadata: { files: 1, size: 10, reverseShareId: undefined },
    });
  });

  describe('complete share recipient transaction optimization', () => {
    it('should wrap upsert calls inside a transaction', async () => {

      const shareMock = {
        id: 'share1',
        files: [{ id: 'f1' }],
        recipients: [
          { email: 'user1@example.com', id: 'rec1' },
          { email: 'user2@example.com', id: 'rec2' },
        ],
        creator: {},
      };

      // Mock isShareCompleted false
      jest.spyOn(shareService, 'isShareCompleted').mockResolvedValue(false);
      jest.spyOn(shareService as any, 'createZip').mockResolvedValue(null);

      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(shareMock);

      const matchedUsers = [
        { id: 'u1', email: 'user1@example.com', isActivated: true, activationToken: null },
        { id: 'u2', email: 'user2@example.com', isActivated: true, activationToken: null },
      ];
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(matchedUsers);

      (prismaService.shareUserRecipient.upsert as jest.Mock).mockImplementation((opts) => opts);

      await shareService.complete('share1');

      // Assert that a transaction was created with the mapped upserts
      expect(prismaService.$transaction).toHaveBeenCalled();

      const transactionCalls = (prismaService.$transaction as jest.Mock).mock.calls[0][0];

      expect(transactionCalls.length).toBe(2);
      expect(transactionCalls[0]).toEqual({
          where: { userId_shareId: { userId: 'u1', shareId: 'share1' } },
          create: { userId: 'u1', shareId: 'share1' },
          update: {}
      });
      expect(transactionCalls[1]).toEqual({
          where: { userId_shareId: { userId: 'u2', shareId: 'share1' } },
          create: { userId: 'u2', shareId: 'share1' },
          update: {}
      });

    });

    it('should handle zero matched users without error', async () => {

      const shareMock = {
        id: 'share1',
        files: [{ id: 'f1' }],
        recipients: [
          { email: 'notregistered@example.com', id: 'rec1' },
        ],
        creator: {},
      };

      // Mock isShareCompleted false
      jest.spyOn(shareService, 'isShareCompleted').mockResolvedValue(false);
      jest.spyOn(shareService as any, 'createZip').mockResolvedValue(null);

      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(shareMock);

      const matchedUsers = [];
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(matchedUsers);

      await shareService.complete('share1');

      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

  });

  describe('reverse share uses', () => {
    it('takes a use in one conditional write and stops when none is left', async () => {
      jest.spyOn(shareService, 'isShareCompleted').mockResolvedValue(false);
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue({
        id: 'share1',
        files: [{ id: 'f1' }],
        recipients: [],
        creator: null,
        reverseShare: { id: 'rs1', creator: {} },
      });
      const updateMany = (prismaService as any).reverseShare.updateMany as jest.Mock;
      updateMany.mockResolvedValue({ count: 0 });

      await expect(shareService.complete('share1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'rs1', remainingUses: { gt: 0 } },
        data: { remainingUses: { decrement: 1 } },
      });
      expect(prismaService.share.update).not.toHaveBeenCalled();
    });
  });
});
