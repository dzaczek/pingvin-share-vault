import {
  Alert,
  Anchor,
  Center,
  Group,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import moment from "moment";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TbInfoCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import statsService from "../../services/stats.service";
import { Stats } from "../../types/stats.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";

const StatsCharts = dynamic(
  () => import("../../components/admin/stats/StatsCharts"),
  { ssr: false },
);

const PERIODS = ["7", "30", "90"];
const TOPS = ["storage", "shares", "files", "uploads", "downloads"] as const;

const bytes = (value: number) => (value ? byteToHumanSizeString(value) : "0");
const number = (value: number) => value.toLocaleString();

const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <Paper withBorder p="md" radius="md">
    <Text size="xs" color="dimmed" transform="uppercase" weight={600}>
      {label}
    </Text>
    <Text size="xl" weight={700} mt={4}>
      {value}
    </Text>
    {hint && (
      <Text size="xs" color="dimmed">
        {hint}
      </Text>
    )}
  </Paper>
);

const grid = {
  cols: 4,
  breakpoints: [{ maxWidth: "md", cols: 2 }],
  mb: "lg",
};

const AdminStats = () => {
  const t = useTranslate();
  const [days, setDays] = useState("30");
  const [stats, setStats] = useState<Stats>();

  useEffect(() => {
    statsService.get(Number(days)).then(setStats).catch(toast.axiosError);
  }, [days]);

  if (!stats)
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );

  const { totals, period, auditLog } = stats;
  const sizeTop = (key: (typeof TOPS)[number]) =>
    key === "storage" || key === "uploads";

  return (
    <>
      <Meta title={t("admin.stats.title")} />
      <Group position="apart" mb="lg">
        <Title order={3}>
          <FormattedMessage id="admin.stats.title" />
        </Title>
        <SegmentedControl
          value={days}
          onChange={setDays}
          data={PERIODS.map((value) => ({
            value,
            label: t("admin.stats.period", { days: value }),
          }))}
        />
      </Group>

      <Alert icon={<TbInfoCircle />} color="gray" mb="lg">
        {auditLog.enabled
          ? t("admin.stats.history", {
              retention: auditLog.retentionDays
                ? t("admin.stats.history.retention", {
                    days: auditLog.retentionDays,
                  })
                : t("admin.stats.history.forever"),
              oldest: auditLog.oldest
                ? moment(auditLog.oldest).format("L")
                : "-",
            })
          : t("admin.stats.history.disabled")}
      </Alert>

      <Title order={5} mb="xs">
        <FormattedMessage id="admin.stats.now" />
      </Title>
      <SimpleGrid {...grid}>
        <Stat
          label={t("admin.stats.users")}
          value={number(totals.users)}
          hint={t("admin.stats.users.hint", {
            admins: totals.admins,
            new: period.newUsers,
          })}
        />
        <Stat
          label={t("admin.stats.shares")}
          value={number(totals.activeShares)}
          hint={t("admin.stats.shares.hint", { new: period.shares })}
        />
        <Stat label={t("admin.stats.files")} value={number(totals.files)} />
        <Stat label={t("admin.stats.storage")} value={bytes(totals.storage)} />
      </SimpleGrid>

      <Title order={5} mb="xs">
        <FormattedMessage id="admin.stats.in-period" values={{ days }} />
      </Title>
      <SimpleGrid {...grid}>
        <Stat
          label={t("admin.stats.uploads")}
          value={number(period.uploads)}
          hint={bytes(period.uploadBytes)}
        />
        <Stat
          label={t("admin.stats.downloads")}
          value={number(period.downloads)}
        />
        <Stat label={t("admin.stats.views")} value={number(period.views)} />
        <Stat
          label={t("admin.stats.logins")}
          value={number(period.logins)}
          hint={t("admin.stats.logins.hint", { failed: period.failedLogins })}
        />
      </SimpleGrid>

      <StatsCharts stats={stats} />

      <Paper withBorder p="md" radius="md" mb="lg">
        <Title order={5} mb="sm">
          <FormattedMessage id="admin.stats.top" />
        </Title>
        <Tabs defaultValue="storage">
          <Tabs.List>
            {TOPS.map((key) => (
              <Tabs.Tab value={key} key={key}>
                <FormattedMessage id={`admin.stats.top.${key}`} />
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {TOPS.map((key) => {
            const rows = stats.top[key];
            const max = rows[0]?.value || 1;
            return (
              <Tabs.Panel value={key} key={key} pt="sm">
                <Text size="xs" color="dimmed" mb="xs">
                  <FormattedMessage id={`admin.stats.top.${key}.hint`} />
                </Text>
                {rows.length === 0 ? (
                  <Text color="dimmed" size="sm">
                    <FormattedMessage id="admin.stats.empty" />
                  </Text>
                ) : (
                  <Table verticalSpacing="xs" fontSize="sm">
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.user.id}>
                          <td style={{ width: 32 }}>
                            <Text color="dimmed">{i + 1}</Text>
                          </td>
                          <td>
                            <Anchor
                              component={Link}
                              href={`/admin/users/${row.user.id}`}
                            >
                              {row.user.displayName || row.user.username}
                            </Anchor>
                            <Text size="xs" color="dimmed">
                              {row.user.email}
                            </Text>
                          </td>
                          <td style={{ width: "35%" }}>
                            <Progress value={(row.value / max) * 100} />
                          </td>
                          <td style={{ textAlign: "right", width: 110 }}>
                            <Text weight={600} style={{ whiteSpace: "nowrap" }}>
                              {sizeTop(key)
                                ? bytes(row.value)
                                : number(row.value)}
                            </Text>
                            {row.count !== undefined && (
                              <Text size="xs" color="dimmed">
                                {t("admin.stats.top.files-count", {
                                  count: row.count,
                                })}
                              </Text>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Tabs.Panel>
            );
          })}
        </Tabs>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">
          <FormattedMessage id="admin.stats.shards" />
        </Title>
        {stats.shards.length === 0 ? (
          <Text color="dimmed" size="sm">
            <FormattedMessage id="admin.stats.empty" />
          </Text>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table verticalSpacing="xs" fontSize="sm">
              <thead>
                <tr>
                  <th>
                    <FormattedMessage id="admin.stats.shards.shard" />
                  </th>
                  <th>{t("admin.stats.uploads")}</th>
                  <th>{t("admin.stats.shards.bytes")}</th>
                  <th>{t("admin.stats.downloads")}</th>
                  <th>{t("admin.stats.views")}</th>
                  <th>{t("admin.stats.logins")}</th>
                  <th>
                    <FormattedMessage id="admin.stats.shards.last-seen" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.shards.map((s) => (
                  <tr key={s.shardId}>
                    <td>
                      <Text weight={600} style={{ whiteSpace: "nowrap" }}>
                        {s.shardId}
                      </Text>
                    </td>
                    <td>{number(s.uploads)}</td>
                    <td>{bytes(s.uploadBytes)}</td>
                    <td>{number(s.downloads)}</td>
                    <td>{number(s.views)}</td>
                    <td>{number(s.logins)}</td>
                    <td>{moment(s.lastSeen).fromNow()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Paper>
    </>
  );
};

export default AdminStats;
