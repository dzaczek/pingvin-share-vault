import { Center, Loader, Paper, Table, Text, Title } from "@mantine/core";
import moment from "moment";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import auditLogService from "../../../services/auditLog.service";
import { ShardSummaryRow } from "../../../types/auditLog.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";

const ShardSummary = () => {
  const [rows, setRows] = useState<ShardSummaryRow[] | null>(null);

  useEffect(() => {
    auditLogService.shards().then(setRows).catch(toast.axiosError);
  }, []);

  if (!rows)
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );

  if (rows.length === 0)
    return (
      <Center p="xl">
        <Text color="dimmed">
          <FormattedMessage id="admin.auditLogs.empty" />
        </Text>
      </Center>
    );

  const byShard = new Map<string, ShardSummaryRow[]>();
  for (const row of rows)
    byShard.set(row.shardId, [...(byShard.get(row.shardId) ?? []), row]);

  return (
    <>
      {[...byShard.entries()].map(([shardId, shardRows]) => (
        <Paper withBorder p="md" mb="md" key={shardId}>
          <Title order={5} mb="xs">
            {shardId}
          </Title>
          <Table fontSize="sm" verticalSpacing="xs">
            <thead>
              <tr>
                <th>
                  <FormattedMessage id="admin.auditLogs.table.action" />
                </th>
                <th>
                  <FormattedMessage id="admin.auditLogs.shards.storage" />
                </th>
                <th>
                  <FormattedMessage id="admin.auditLogs.shards.count" />
                </th>
                <th>
                  <FormattedMessage id="admin.auditLogs.shards.bytes" />
                </th>
                <th>
                  <FormattedMessage id="admin.auditLogs.shards.lastSeen" />
                </th>
              </tr>
            </thead>
            <tbody>
              {shardRows.map((row) => (
                <tr key={`${row.action}-${row.storage}`}>
                  <td>{row.action}</td>
                  <td>{row.storage ?? "-"}</td>
                  <td>{row.count}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.bytes ? byteToHumanSizeString(row.bytes) : "-"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {moment(row.lastSeen).format("lll")}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Paper>
      ))}
    </>
  );
};

export default ShardSummary;
