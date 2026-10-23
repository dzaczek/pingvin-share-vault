export type StatsUser = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
};

export type StatsTopRow = { user: StatsUser; value: number; count?: number };

export type StatsDay = {
  day: string;
  users: number;
  shares: number;
  uploads: number;
  uploadBytes: number;
  downloads: number;
  views: number;
  logins: number;
  failedLogins: number;
};

export type StatsShard = {
  shardId: string;
  uploads: number;
  uploadBytes: number;
  downloads: number;
  views: number;
  logins: number;
  lastSeen: string;
};

export type Stats = {
  days: number;
  since: string;
  generatedAt: string;
  totals: {
    users: number;
    admins: number;
    activeShares: number;
    files: number;
    storage: number;
  };
  period: {
    newUsers: number;
    shares: number;
    uploads: number;
    uploadBytes: number;
    downloads: number;
    views: number;
    logins: number;
    failedLogins: number;
  };
  daily: StatsDay[];
  top: Record<
    "shares" | "files" | "storage" | "uploads" | "downloads",
    StatsTopRow[]
  >;
  shards: StatsShard[];
  auditLog: {
    enabled: boolean;
    retentionDays: number;
    oldest: string | null;
  };
};
