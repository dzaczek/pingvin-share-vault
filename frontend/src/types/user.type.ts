type User = {
  id: string;
  displayName?: string | null;
  username: string;
  email: string;
  isAdmin: boolean;
  isActivated: boolean;
  isLdap: boolean;
  totpVerified: boolean;
  hasPassword: boolean;
  shareSizeLimit?: string;
  storageQuotaLimit?: string;
  allowShare?: boolean;
  allowCreateReverseShares?: boolean;
  maxShares?: number | null;
  maxReverseShares?: number | null;
};

export type CreateUser = {
  displayName?: string | null;
  username: string;
  email: string;
  password?: string;
  isAdmin?: boolean;
  shareSizeLimit?: string | null;
  storageQuotaLimit?: string | null;
  allowShare?: boolean;
  allowCreateReverseShares?: boolean;
  maxShares?: number | null;
  maxReverseShares?: number | null;
};

export type UpdateUser = {
  displayName?: string | null;
  username?: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
  isActivated?: boolean;
  shareSizeLimit?: string | null;
  storageQuotaLimit?: string | null;
  allowShare?: boolean;
  allowCreateReverseShares?: boolean;
  maxShares?: number | null;
  maxReverseShares?: number | null;
};

export type UpdateCurrentUser = {
  displayName?: string | null;
  username?: string;
  email?: string;
};

export type CurrentUser = User & {};

type Identity = {
  value: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};

// what GET /users/:id/overview returns, the admin's page about one account
export type UserOverview = {
  user: User & {
    createdAt: string;
    oauth: { provider: string; providerUsername: string }[];
  };
  storageUsed: number;
  lastLogin: { createdAt: string; ipAddress: string } | null;
  failedLogins30d: number;
  shares: {
    id: string;
    name: string | null;
    createdAt: string;
    expiration: string;
    expired: boolean;
    views: number;
    files: number;
    size: number;
    scanStatus: string;
    blocked: boolean;
    removedReason: string | null;
    passwordProtected: boolean;
    maxViews: number | null;
  }[];
  reverseShares: {
    id: string;
    createdAt: string;
    shareExpiration: string;
    remainingUses: number;
    maxShareSize: string;
    shares: number;
  }[];
  sessions: {
    id: string;
    createdAt: string;
    expiresAt: string;
    oauth: string | null;
  }[];
  identities: Record<"deviceId" | "visitorId" | "ipAddress", Identity[]>;
};

export type UserHook = {
  user: CurrentUser | null;
  refreshUser: () => Promise<CurrentUser | null>;
};

export default User;
