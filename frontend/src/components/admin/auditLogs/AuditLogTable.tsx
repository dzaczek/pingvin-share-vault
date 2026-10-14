import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Loader,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import auditLogService from "../../../services/auditLog.service";
import { AuditLogEntry, AuditLogFilter } from "../../../types/auditLog.type";
import toast from "../../../utils/toast.util";

export type IdentityKind = "userId" | "visitorId" | "ipAddress";

const POLL_MS = 10_000;

const actionColor = (action: string) => {
  if (action === "AUTH_LOGIN_FAILED") return "red";
  if (action.startsWith("AUTH_")) return "green";
  if (action === "FILE_UPLOAD") return "blue";
  if (action === "FILE_DOWNLOAD") return "violet";
  return "gray";
};

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
              <th>
                <FormattedMessage id="admin.auditLogs.table.time" />
              </th>
              <th>
                <FormattedMessage id="admin.auditLogs.table.action" />
              </th>
              <th>
                <FormattedMessage id="admin.auditLogs.table.user" />
              </th>
              <th>
                <FormattedMessage id="admin.auditLogs.table.visitor" />
              </th>
              <th>
                <FormattedMessage id="admin.auditLogs.table.ip" />
              </th>
              <th>
                <FormattedMessage id="admin.auditLogs.table.resource" />
              </th>
              <th>
                <FormattedMessage id="admin.auditLogs.table.details" />
              </th>
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
                    kind="ipAddress"
                    value={entry.ipAddress}
                    label={entry.ipAddress}
                    onSelect={onSelectIdentity}
                  />
                </td>
                <td style={{ minWidth: 160 }}>
                  {entry.resourceName ?? entry.resourceId ?? "-"}
                </td>
                <td style={{ minWidth: 220 }}>
                  {entry.metadata && (
                    <Code sx={{ overflowWrap: "anywhere" }}>
                      {JSON.stringify(entry.metadata)}
                    </Code>
                  )}{" "}
                  <Text span size="xs" color="dimmed">
                    {entry.shardId}
                  </Text>
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
