import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Group,
  Loader,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { TbInfoCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import auditLogService from "../../../services/auditLog.service";
import { AuditLogEntry, AuditLogFilter } from "../../../types/auditLog.type";
import toast from "../../../utils/toast.util";

export type IdentityKind =
  | "userId"
  | "visitorId"
  | "deviceId"
  | "ipAddress"
  | "resourceId"
  | "shareId"
  | "shardId";

const COLUMNS = [
  "time",
  "action",
  "user",
  "visitor",
  "device",
  "ip",
  "resource",
  "details",
];

// the name with what the column means on hover, visitor and device are
// easy to mix up
const ColumnHeader = ({ column }: { column: string }) => (
  <Tooltip
    multiline
    width={280}
    withinPortal
    label={
      <FormattedMessage id={`admin.auditLogs.table.${column}.description`} />
    }
  >
    <Group spacing={4} noWrap sx={{ cursor: "help" }}>
      <FormattedMessage id={`admin.auditLogs.table.${column}`} />
      <TbInfoCircle size={14} />
    </Group>
  </Tooltip>
);

const POLL_MS = 10_000;

const actionColor = (action: string) => {
  if (action === "AUTH_LOGIN_FAILED") return "red";
  if (action.startsWith("AUTH_")) return "green";
  if (action === "FILE_UPLOAD") return "blue";
  if (action === "FILE_DOWNLOAD") return "violet";
  return "gray";
};

// share views and zips log the share itself as their resource
const resourceKind = (entry: AuditLogEntry): IdentityKind =>
  entry.action === "SHARE_VIEW" || entry.metadata?.zip
    ? "shareId"
    : "resourceId";

const Identity = ({
  kind,
  value,
  label,
  onSelect,
}: {
  kind: IdentityKind;
  value: string | null;
  label?: string | null;
  onSelect?: (kind: IdentityKind, value: string) => void;
}) => {
  if (!value) return <Text color="dimmed">-</Text>;
  return (
    <Tooltip label={value} withinPortal>
      <Anchor
        component="button"
        size="sm"
        // emails and file or share names read better in the normal font
        data-mono={
          kind === "userId" || (label && kind !== "ipAddress")
            ? undefined
            : true
        }
        onClick={() => onSelect?.(kind, value)}
      >
        {label ?? (value.length > 12 ? `${value.slice(0, 12)}…` : value)}
      </Anchor>
    </Tooltip>
  );
};

const AuditLogTable = ({
  filter,
  live = false,
  onSelectIdentity,
}: {
  filter: AuditLogFilter;
  live?: boolean;
  onSelectIdentity?: (kind: IdentityKind, value: string) => void;
}) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // keyed on the serialized filter, a new object with the same content must
  // not refetch. The parent remounts this table when the filter changes, so
  // the loading state starts over on its own.
  const filterKey = JSON.stringify(filter);
  const load = useCallback(
    (cursor?: string) =>
      auditLogService.list({ ...JSON.parse(filterKey), cursor }),
    [filterKey],
  );

  useEffect(() => {
    load()
      .then((page) => {
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
      })
      .catch(toast.axiosError)
      .finally(() => setIsLoading(false));
  }, [load]);

  // new entries arrive at the top, whatever was loaded further down stays
  const pollNewest = useCallback(() => {
    load()
      .then((page) =>
        setEntries((prev) => {
          const known = new Set(prev.map((e) => e.id));
          const fresh = page.entries.filter((e) => !known.has(e.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        }),
      )
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!live || filter.order === "asc") return;
    const interval = setInterval(pollNewest, POLL_MS);
    return () => clearInterval(interval);
  }, [live, filter.order, pollNewest]);

  const loadMore = () => {
    if (!nextCursor) return;
    load(nextCursor)
      .then((page) => {
        setEntries((prev) => [...prev, ...page.entries]);
        setNextCursor(page.nextCursor);
      })
      .catch(toast.axiosError);
  };

  if (isLoading)
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );

  if (entries.length === 0)
    return (
      <Center p="xl">
        <Text color="dimmed">
          <FormattedMessage id="admin.auditLogs.empty" />
        </Text>
      </Center>
    );

  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table verticalSpacing="xs" fontSize="sm" striped>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column}>
                  <ColumnHeader column={column} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Tooltip label={entry.userAgent || "-"} withinPortal>
                    <span>{moment(entry.createdAt).format("L LTS")}</span>
                  </Tooltip>
                </td>
                <td>
                  <Badge color={actionColor(entry.action)} variant="light">
                    {entry.action}
                  </Badge>
                </td>
                <td>
                  {entry.userId ? (
                    <Identity
                      kind="userId"
                      value={entry.userId}
                      label={entry.userEmail}
                      onSelect={onSelectIdentity}
                    />
                  ) : (
                    <Text color="dimmed">{entry.userEmail ?? "-"}</Text>
                  )}
                </td>
                <td>
                  <Identity
                    kind="visitorId"
                    value={entry.visitorId}
                    onSelect={onSelectIdentity}
                  />
                </td>
                <td>
                  <Identity
                    kind="deviceId"
                    value={entry.deviceId}
                    onSelect={onSelectIdentity}
                  />
                </td>
                <td>
                  <Identity
                    kind="ipAddress"
                    value={entry.ipAddress}
                    label={entry.ipAddress}
                    onSelect={onSelectIdentity}
                  />
                </td>
                <td style={{ minWidth: 160 }}>
                  <Identity
                    kind={resourceKind(entry)}
                    value={entry.resourceId}
                    label={entry.resourceName}
                    onSelect={onSelectIdentity}
                  />
                </td>
                <td style={{ minWidth: 220 }}>
                  {entry.metadata && (
                    <Code sx={{ overflowWrap: "anywhere" }}>
                      {JSON.stringify(entry.metadata)}
                    </Code>
                  )}{" "}
                  {typeof entry.metadata?.shareId === "string" &&
                    entry.metadata.shareId !== entry.resourceId && (
                      <Identity
                        kind="shareId"
                        value={entry.metadata.shareId}
                        onSelect={onSelectIdentity}
                      />
                    )}{" "}
                  <Identity
                    kind="shardId"
                    value={entry.shardId}
                    onSelect={onSelectIdentity}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>
      {nextCursor && (
        <Center mt="md">
          <Button variant="light" onClick={loadMore}>
            <FormattedMessage id="admin.auditLogs.loadMore" />
          </Button>
        </Center>
      )}
    </>
  );
};

export default AuditLogTable;
