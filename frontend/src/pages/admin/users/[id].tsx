import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Space,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import moment from "moment";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { TbArrowLeft, TbEdit, TbLogout } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../../components/Meta";
import AuditLogTable, {
  IdentityKind,
} from "../../../components/admin/auditLogs/AuditLogTable";
import showUpdateUserModal from "../../../components/admin/users/showUpdateUserModal";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import userService from "../../../services/user.service";
import { UserOverview } from "../../../types/user.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import { resolvePasswordPolicy } from "../../../utils/passwordPolicy.util";
import toast from "../../../utils/toast.util";

// The admin's page about one account: who it is, what it may do, what it
// holds, and every history the audit log keeps about it.

const TABS = [
  "shares",
  "logins",
  "uploads",
  "downloads",
  "files-of",
  "identities",
  "sessions",
];

const date = (value: string | null | undefined) =>
  value ? moment(value).format("L LT") : "-";

// a zero date is a share or reverse share that never expires
const expiry = (value: string) =>
  new Date(value).getTime() === 0 ? "∞" : date(value);

const Stat = ({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
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
    {children}
  </Paper>
);

const HeaderRow = ({
  prefix,
  columns,
}: {
  prefix: string;
  columns: string[];
}) => (
  <thead>
    <tr>
      {columns.map((column) => (
        <th key={column}>
          <FormattedMessage id={`${prefix}.${column}`} />
        </th>
      ))}
    </tr>
  </thead>
);

const Empty = ({ id }: { id: string }) => (
  <Center p="xl">
    <Text color="dimmed">
      <FormattedMessage id={id} />
    </Text>
  </Center>
);

const UserPage = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const t = useTranslate();
  const modals = useModals();
  const config = useConfig();
  const [overview, setOverview] = useState<UserOverview>();
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      userService
        .overview(id)
        .then(setOverview)
        .catch((e) => {
          toast.axiosError(e);
          setFailed(true);
        }),
    [id],
  );

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  // anything clicked in a history opens its whole trail in the audit log
  const openTrail = (kind: IdentityKind, value: string) =>
    router.push({ pathname: "/admin/audit-logs", query: { kind, value } });

  const revokeSessions = () =>
    modals.openConfirmModal({
      title: t("admin.userOverview.sessions.revoke.title"),
      children: (
        <Text size="sm">
          <FormattedMessage id="admin.userOverview.sessions.revoke.description" />
        </Text>
      ),
      labels: {
        confirm: t("admin.userOverview.sessions.revoke"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: () =>
        userService
          .revokeSessions(id)
          .then(({ count }) => {
            toast.success(
              t("admin.userOverview.sessions.revoke.done", { count }),
            );
            load();
          })
          .catch(toast.axiosError),
    });

  if (failed) return <Empty id="admin.userOverview.not-found" />;
  if (!overview)
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );

  const { user, shares, identities } = overview;
  const quota = user.storageQuotaLimit
    ? parseInt(user.storageQuotaLimit)
    : undefined;
  const activeShares = shares.filter((s) => !s.expired).length;

  return (
    <>
      <Meta title={user.displayName || user.username} />
      <Anchor component={Link} href="/admin/users" size="sm">
        <Group spacing={4}>
          <TbArrowLeft />
          <FormattedMessage id="admin.users.title" />
        </Group>
      </Anchor>

      <Group position="apart" align="flex-start" mt="md" mb="lg">
        <div>
          <Title order={3}>{user.displayName || user.username}</Title>
          <Text color="dimmed">
            {user.username} · {user.email}
          </Text>
          <Group spacing="xs" mt="xs">
            {user.isAdmin && <Badge color="violet">Admin</Badge>}
            {user.isLdap && <Badge>LDAP</Badge>}
            {user.oauth.map((o) => (
              <Badge key={o.provider} color="gray">
                {o.provider}: {o.providerUsername}
              </Badge>
            ))}
            <Badge color={user.totpVerified ? "green" : "gray"}>
              <FormattedMessage
                id={
                  user.totpVerified
                    ? "admin.userOverview.badge.totp"
                    : "admin.userOverview.badge.no-totp"
                }
              />
            </Badge>
            {!user.isActivated && (
              <Badge color="orange">
                <FormattedMessage id="admin.userOverview.badge.inactive" />
              </Badge>
            )}
            {!user.hasPassword && (
              <Badge color="gray">
                <FormattedMessage id="admin.userOverview.badge.no-password" />
              </Badge>
            )}
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            <FormattedMessage
              id="admin.userOverview.created"
              values={{ date: date(user.createdAt) }}
            />
          </Text>
        </div>
        <Group>
          {!user.isLdap && (
            <Button
              variant="light"
              leftIcon={<TbEdit />}
              onClick={() =>
                showUpdateUserModal(
                  modals,
                  user,
                  load,
                  resolvePasswordPolicy(config.get),
                )
              }
            >
              <FormattedMessage id="common.button.edit" />
            </Button>
          )}
          <Button
            variant="light"
            color="red"
            leftIcon={<TbLogout />}
            disabled={overview.sessions.length === 0}
            onClick={revokeSessions}
          >
            <FormattedMessage id="admin.userOverview.sessions.revoke" />
          </Button>
        </Group>
      </Group>

      <SimpleGrid
        cols={4}
        breakpoints={[
          { maxWidth: "md", cols: 2 },
          { maxWidth: "xs", cols: 1 },
        ]}
        mb="lg"
      >
        <Stat
          label={t("admin.userOverview.stat.storage")}
          value={byteToHumanSizeString(overview.storageUsed)}
          hint={
            quota
              ? t("admin.userOverview.stat.storage.of", {
                  quota: byteToHumanSizeString(quota),
                })
              : t("admin.userOverview.stat.storage.no-quota")
          }
        >
          {quota && (
            <Progress
              mt="xs"
              value={Math.min((overview.storageUsed / quota) * 100, 100)}
              color={overview.storageUsed > quota * 0.9 ? "red" : undefined}
            />
          )}
        </Stat>
        <Stat
          label={t("admin.userOverview.stat.shares")}
          value={activeShares}
          hint={t("admin.userOverview.stat.shares.hint", {
            expired: shares.length - activeShares,
            reverse: overview.reverseShares.length,
          })}
        />
        <Stat
          label={t("admin.userOverview.stat.last-login")}
          value={
            overview.lastLogin
              ? moment(overview.lastLogin.createdAt).fromNow()
              : "-"
          }
          hint={t("admin.userOverview.stat.last-login.hint", {
            failed: overview.failedLogins30d,
          })}
        />
        <Stat
          label={t("admin.userOverview.stat.devices")}
          value={identities.deviceId.length}
          hint={t("admin.userOverview.stat.devices.hint", {
            ips: identities.ipAddress.length,
            sessions: overview.sessions.length,
          })}
        />
      </SimpleGrid>

      <Text size="sm" color="dimmed" mb="lg">
        <FormattedMessage
          id="admin.userOverview.permissions"
          values={{
            share: user.allowShare === false ? "✗" : "✓",
            reverse: user.allowCreateReverseShares === false ? "✗" : "✓",
            maxShares: user.maxShares ?? "∞",
            maxReverseShares: user.maxReverseShares ?? "∞",
            shareSize: user.shareSizeLimit
              ? byteToHumanSizeString(parseInt(user.shareSizeLimit))
              : "-",
          }}
        />
      </Text>

      <Tabs defaultValue="shares" keepMounted={false}>
        <Tabs.List mb="md">
          {TABS.map((tab) => (
            <Tabs.Tab key={tab} value={tab}>
              <FormattedMessage id={`admin.userOverview.tab.${tab}`} />
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="shares">
          <SharesTable overview={overview} />
        </Tabs.Panel>
        <Tabs.Panel value="logins">
          <AuditLogTable
            filter={{ loginsOf: id }}
            onSelectIdentity={openTrail}
          />
        </Tabs.Panel>
        <Tabs.Panel value="uploads">
          <AuditLogTable
            filter={{ userId: id, action: "FILE_UPLOAD" }}
            onSelectIdentity={openTrail}
          />
        </Tabs.Panel>
        <Tabs.Panel value="downloads">
          <AuditLogTable
            filter={{ userId: id, action: "FILE_DOWNLOAD" }}
            onSelectIdentity={openTrail}
          />
        </Tabs.Panel>
        <Tabs.Panel value="files-of">
          <Text size="sm" color="dimmed" mb="sm">
            <FormattedMessage id="admin.userOverview.files-of.description" />
          </Text>
          <AuditLogTable
            filter={{ filesOf: id }}
            onSelectIdentity={openTrail}
          />
        </Tabs.Panel>
        <Tabs.Panel value="identities">
          <Stack spacing="lg">
            {(["deviceId", "visitorId", "ipAddress"] as const).map((kind) => (
              <IdentityTable
                key={kind}
                kind={kind}
                rows={identities[kind]}
                onSelect={openTrail}
              />
            ))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="sessions">
          {overview.sessions.length === 0 ? (
            <Empty id="admin.userOverview.sessions.none" />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table fontSize="sm" striped>
                <HeaderRow
                  prefix="admin.userOverview.sessions"
                  columns={["created", "expires", "method"]}
                />
                <tbody>
                  {overview.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{date(s.createdAt)}</td>
                      <td>{date(s.expiresAt)}</td>
                      <td>
                        {s.oauth ?? t("admin.userOverview.sessions.password")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Box>
          )}
        </Tabs.Panel>
      </Tabs>
      <Space h="xl" />
    </>
  );
};

const scanColor = (status: string) =>
  status === "INFECTED" ? "red" : status === "CLEAN" ? "green" : "gray";

const SharesTable = ({ overview }: { overview: UserOverview }) => {
  if (overview.shares.length === 0 && overview.reverseShares.length === 0)
    return <Empty id="admin.userOverview.shares.none" />;

  return (
    <Stack spacing="lg">
      <Box sx={{ overflowX: "auto" }}>
        <Table fontSize="sm" striped>
          <HeaderRow
            prefix="admin.userOverview.shares"
            columns={[
              "share",
              "created",
              "expires",
              "files",
              "size",
              "views",
              "state",
            ]}
          />
          <tbody>
            {overview.shares.map((share) => (
              <tr key={share.id}>
                <td>
                  <Anchor
                    href={`/share/${share.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {share.name || share.id}
                  </Anchor>
                </td>
                <td>{date(share.createdAt)}</td>
                <td>{expiry(share.expiration)}</td>
                <td>{share.files}</td>
                <td>{byteToHumanSizeString(share.size)}</td>
                <td>
                  {share.views}
                  {share.maxViews ? ` / ${share.maxViews}` : ""}
                </td>
                <td>
                  <Group spacing={4} noWrap>
                    {share.expired && (
                      <Badge color="gray">
                        <FormattedMessage id="admin.userOverview.shares.expired" />
                      </Badge>
                    )}
                    {share.blocked && (
                      <Badge color="red">
                        <FormattedMessage id="admin.userOverview.shares.blocked" />
                      </Badge>
                    )}
                    {share.passwordProtected && (
                      <Badge>
                        <FormattedMessage id="admin.userOverview.shares.password" />
                      </Badge>
                    )}
                    <Badge
                      color={scanColor(share.scanStatus)}
                      variant="outline"
                    >
                      {share.scanStatus}
                    </Badge>
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>

      {overview.reverseShares.length > 0 && (
        <div>
          <Title order={5} mb="xs">
            <FormattedMessage id="admin.userOverview.reverse-shares" />
          </Title>
          <Box sx={{ overflowX: "auto" }}>
            <Table fontSize="sm" striped>
              <HeaderRow
                prefix="admin.userOverview.reverse-shares"
                columns={[
                  "created",
                  "expires",
                  "uses-left",
                  "max-size",
                  "received",
                ]}
              />
              <tbody>
                {overview.reverseShares.map((rs) => (
                  <tr key={rs.id}>
                    <td>{date(rs.createdAt)}</td>
                    <td>{expiry(rs.shareExpiration)}</td>
                    <td>{rs.remainingUses}</td>
                    <td>{byteToHumanSizeString(parseInt(rs.maxShareSize))}</td>
                    <td>{rs.shares}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Box>
        </div>
      )}
    </Stack>
  );
};

const IdentityTable = ({
  kind,
  rows,
  onSelect,
}: {
  kind: "deviceId" | "visitorId" | "ipAddress";
  rows: UserOverview["identities"]["deviceId"];
  onSelect: (kind: IdentityKind, value: string) => void;
}) => (
  <div>
    <Title order={5} mb="xs">
      <FormattedMessage id={`admin.userOverview.identities.${kind}`} />
    </Title>
    {rows.length === 0 ? (
      <Text size="sm" color="dimmed">
        -
      </Text>
    ) : (
      <Box sx={{ overflowX: "auto" }}>
        <Table fontSize="sm" striped>
          <HeaderRow
            prefix="admin.userOverview.identities"
            columns={["value", "events", "first-seen", "last-seen"]}
          />
          <tbody>
            {rows.map((row) => (
              <tr key={row.value}>
                <td>
                  <Anchor
                    component="button"
                    size="sm"
                    data-mono={kind === "ipAddress" ? undefined : true}
                    onClick={() => onSelect(kind, row.value)}
                  >
                    {row.value}
                  </Anchor>
                </td>
                <td>{row.count}</td>
                <td>{date(row.firstSeen)}</td>
                <td>{date(row.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>
    )}
  </div>
);

export default UserPage;
