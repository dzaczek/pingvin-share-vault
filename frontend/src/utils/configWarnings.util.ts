// Settings that only work together with another one. Saving them alone is
// still allowed, the admin page just says what is missing.

const MAIL_FEATURES = [
  "share.enableShareEmailRecipients",
  "share.enableShareDownloadNotifications",
  "security.enableEmailVerification",
];

const UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
  months: 2_592_000_000,
  years: 31_536_000_000,
};

const toMs = (timespan: string) => {
  const [value, unit] = timespan.split(" ");
  return parseInt(value) * (UNIT_MS[unit] ?? NaN);
};

export type ConfigWarning = { id: string; categories: string[] };

export function getConfigWarnings(
  value: (key: string) => string,
): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];

  // without mail, verification links never arrive and new accounts stay locked
  if (
    value("smtp.enabled") !== "true" &&
    MAIL_FEATURES.some((key) => value(key) === "true")
  ) {
    warnings.push({
      id: "admin.config.warning.smtp-off",
      categories: ["security", "share", "email", "smtp"],
    });
  }

  // a max of 0 means no limit, a default of 0 means never expires
  const max = toMs(value("share.maxExpiration"));
  const fallback = toMs(value("share.defaultExpiration"));
  if (max > 0 && (fallback === 0 || fallback > max)) {
    warnings.push({
      id: "admin.config.warning.default-over-max",
      categories: ["share"],
    });
  }

  return warnings;
}
