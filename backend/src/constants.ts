import { LogLevel } from "@nestjs/common";

export const CONFIG_FILE = process.env.CONFIG_FILE || "../config.yaml";

export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || "./data";
export const SHARE_DIRECTORY = `${DATA_DIRECTORY}/uploads/shares`;
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  "file:../data/pingvin-share.db?connection_limit=1";
export const CLAMAV_HOST =
  process.env.CLAMAV_HOST ||
  (process.env.NODE_ENV == "docker" ? "clamav" : "127.0.0.1");
export const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT) || 3310;

// Turns off the request rate limits. Only for running the integration suite,
// which otherwise burns through the 20 auth calls per 5 minutes. Never set
// this on a reachable instance, it is what stops password guessing.
export const RATE_LIMIT_DISABLED = process.env.DISABLE_RATE_LIMIT === "true";

// "true" keeps only a shortened address of every visitor, "mask" only its
// first and last part, for addresses shown in public like in a demo
export const ANONYMIZE_IP = process.env.ANONYMIZE_IP;

// for a public demo whose admin account anyone may use: settings, the logo,
// passwords and accounts cannot be changed
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const LOG_LEVEL_AVAILABLE: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];
export const LOG_LEVEL_DEFAULT: LogLevel = process.env.NODE_ENV === 'development' ? "verbose" : "log";
export const LOG_LEVEL_ENV = `${process.env.PV_LOG_LEVEL || ""}`;
// Which node wrote an audit entry. One instance means one shard, so the
// default is fine until there is more than one.
export const SHARD_ID = process.env.SHARD_ID || "main-node";
// 0 keeps audit entries forever
export const AUDIT_LOG_RETENTION_DAYS = parseInt(
  process.env.AUDIT_LOG_RETENTION_DAYS ?? "90",
);
