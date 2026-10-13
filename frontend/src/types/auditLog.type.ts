export type AuditLogEntry = {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  visitorId: string | null;
  ipAddress: string;
  userAgent: string;
  shardId: string;
  action: string;
  resourceId: string | null;
  resourceName: string | null;
  metadata: Record<string, unknown> | null;
};

export type AuditLogPage = {
  entries: AuditLogEntry[];
  nextCursor: string | null;
};

export type AuditLogFilter = {
  userId?: string;
  visitorId?: string;
  ipAddress?: string;
  shardId?: string;
  action?: string;
  cursor?: string;
  take?: number;
  order?: "asc" | "desc";
};

export type ShardSummaryRow = {
  shardId: string;
  action: string;
  storage: string | null;
  count: number;
  bytes: number;
  lastSeen: string;
};
