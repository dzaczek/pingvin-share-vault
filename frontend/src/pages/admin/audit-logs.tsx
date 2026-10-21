import {
  Group,
  SegmentedControl,
  Select,
  Space,
  Switch,
  Tabs,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import AuditLogTable, {
  IdentityKind,
} from "../../components/admin/auditLogs/AuditLogTable";
import ShardSummary from "../../components/admin/auditLogs/ShardSummary";
import useTranslate from "../../hooks/useTranslate.hook";

const ACTIONS = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_TOTP_REQUIRED",
  "AUTH_LOGIN_FAILED",
  "FILE_UPLOAD",
  "FILE_DOWNLOAD",
  "FILE_PREVIEW",
  "SHARE_VIEW",
];

const AuditLogs = () => {
  const t = useTranslate();
  const [tab, setTab] = useState<string | null>("timeline");

  const [action, setAction] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  const [identityKind, setIdentityKind] = useState<IdentityKind>("visitorId");
  const [identity, setIdentity] = useState("");
  // no request per keystroke while an ip is typed in
  const [debouncedIdentity] = useDebouncedValue(identity, 400);

  // clicking a user, visitor, ip, file, share or shard anywhere opens its
  // own trail
  const selectIdentity = (kind: IdentityKind, value: string) => {
    setIdentityKind(kind);
    setIdentity(value);
    setTab("identity");
  };

  return (
    <>
      <Meta title={t("admin.auditLogs.title")} />
      <Title mb={20} order={3}>
        <FormattedMessage id="admin.auditLogs.title" />
      </Title>

      <Tabs value={tab} onTabChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="timeline">
            <FormattedMessage id="admin.auditLogs.tab.timeline" />
          </Tabs.Tab>
          <Tabs.Tab value="identity">
            <FormattedMessage id="admin.auditLogs.tab.identity" />
          </Tabs.Tab>
          <Tabs.Tab value="shards">
            <FormattedMessage id="admin.auditLogs.tab.shards" />
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="timeline">
          <Group mb="md" position="apart">
            <Select
              clearable
              placeholder={t("admin.auditLogs.filter.action")}
              data={ACTIONS}
              value={action}
              onChange={setAction}
            />
            <Switch
              label={t("admin.auditLogs.live")}
              checked={live}
              onChange={(e) => setLive(e.currentTarget.checked)}
            />
          </Group>
          {tab === "timeline" && (
            <AuditLogTable
              key={action ?? ""}
              filter={{ action: action ?? undefined }}
              live={live}
              onSelectIdentity={selectIdentity}
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="identity">
          <Group mb="md" align="flex-end">
            <SegmentedControl
              value={identityKind}
              onChange={(v) => setIdentityKind(v as IdentityKind)}
              data={[
                {
                  value: "visitorId",
                  label: t("admin.auditLogs.table.visitor"),
                },
                { value: "userId", label: t("admin.auditLogs.table.user") },
                { value: "ipAddress", label: t("admin.auditLogs.table.ip") },
                {
                  value: "resourceId",
                  label: t("admin.auditLogs.table.resource"),
                },
                { value: "shareId", label: t("admin.auditLogs.table.share") },
                { value: "shardId", label: t("admin.auditLogs.table.shard") },
              ]}
            />
            <TextInput
              sx={{ flex: 1 }}
              placeholder={t("admin.auditLogs.filter.identity")}
              value={identity}
              onChange={(e) => setIdentity(e.currentTarget.value.trim())}
            />
          </Group>
          {tab === "identity" && debouncedIdentity && (
            // oldest first, so the trail reads from entry to the last download
            <AuditLogTable
              key={`${identityKind}:${debouncedIdentity}`}
              filter={{ [identityKind]: debouncedIdentity, order: "asc" }}
              onSelectIdentity={selectIdentity}
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="shards">
          {tab === "shards" && <ShardSummary onSelectShard={selectIdentity} />}
        </Tabs.Panel>
      </Tabs>
      <Space h="xl" />
    </>
  );
};

export default AuditLogs;
