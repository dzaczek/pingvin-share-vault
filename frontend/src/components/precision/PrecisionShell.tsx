import {
  ActionIcon,
  Anchor,
  AppShell,
  Box,
  Breadcrumbs,
  Burger,
  ColorScheme,
  Group,
  Header,
  MediaQuery,
  Navbar,
  NavLink,
  ScrollArea,
  Text,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";
import { IconType } from "react-icons";
import {
  TbArrowLoopLeft,
  TbChevronsLeft,
  TbChevronsRight,
  TbInbox,
  TbLayoutDashboard,
  TbLink,
  TbList,
  TbMoon,
  TbSettings,
  TbSun,
  TbUpload,
  TbUser,
  TbUsers,
} from "react-icons/tb";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import { precisionTokens } from "../../styles/precision.style";
import userPreferences from "../../utils/userPreferences.util";
import Footer from "../footer/Footer";
import ActionAvatar from "../header/ActionAvatar";
import Logo from "../Logo";

type Item = { link: string; label: string; icon: IconType };

// pages that hold wide tables get the full width, forms stay readable
const WIDE_ROUTES = [
  "/admin/shares",
  "/admin/users",
  "/admin/audit-logs",
  "/account/shares",
  "/account/reverseShares",
  "/account/received",
];

const COLLAPSED_KEY = "precisionNavCollapsed";

const PrecisionShell = ({ children }: { children: ReactNode }) => {
  const theme = useMantineTheme();
  const t = useTranslate();
  const config = useConfig();
  const router = useRouter();
  const { user } = useUser();
  const { toggleColorScheme } = useMantineColorScheme();
  const tokens = precisionTokens(theme);

  const [opened, setOpened] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {}
  }, []);
  useEffect(() => setOpened(false), [router.asPath]);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(!collapsed));
    } catch {}
  };

  const main: Item[] = [
    ...(user?.allowShare !== false
      ? [{ link: "/upload", label: t("navbar.upload"), icon: TbUpload }]
      : []),
    { link: "/account/shares", label: t("navbar.links.shares"), icon: TbLink },
    {
      link: "/account/reverseShares",
      label: t("navbar.links.reverse"),
      icon: TbArrowLoopLeft,
    },
    ...(config.get("share.enableUserRecipients")
      ? [
          {
            link: "/account/received",
            label: t("navbar.links.received"),
            icon: TbInbox,
          },
        ]
      : []),
    { link: "/account", label: t("navbar.avatar.account"), icon: TbUser },
  ];

  const admin: Item[] = user?.isAdmin
    ? [
        {
          link: "/admin",
          label: t("precision.nav.overview"),
          icon: TbLayoutDashboard,
        },
        { link: "/admin/users", label: t("admin.button.users"), icon: TbUsers },
        {
          link: "/admin/shares",
          label: t("admin.button.shares"),
          icon: TbLink,
        },
        {
          link: "/admin/audit-logs",
          label: t("admin.button.auditLogs"),
          icon: TbList,
        },
        {
          link: "/admin/config/general",
          label: t("admin.button.config"),
          icon: TbSettings,
        },
      ]
    : [];

  const path = router.asPath.split(/[?#]/)[0];
  const isActive = (link: string) =>
    link === "/admin" || link === "/account"
      ? path === link
      : path === link || path.startsWith(link + "/");

  const current = admin.slice(1).find((item) => isActive(item.link));
  const crumbs = current
    ? [{ link: "/admin", label: t("navbar.avatar.admin") }, current]
    : [];

  // the narrow rail only shows on desktop, the drawer always has labels
  const rail = collapsed && !opened;

  const renderItem = (item: Item) => {
    const link = (
      <NavLink
        key={item.link}
        component={Link}
        href={item.link}
        label={rail ? undefined : item.label}
        aria-label={item.label}
        icon={<item.icon size={18} />}
        active={isActive(item.link)}
        sx={{
          borderRadius: 6,
          height: 36,
          color: tokens.text,
          justifyContent: rail ? "center" : undefined,
          "& .mantine-NavLink-icon": { marginRight: rail ? 0 : undefined },
          "&[data-active], &[data-active]:hover": {
            background: tokens.soft,
            color: tokens.text,
            boxShadow: `inset 3px 0 0 ${tokens.accent}`,
            fontWeight: 600,
          },
        }}
      />
    );
    return rail ? (
      <Tooltip key={item.link} label={item.label} position="right" withinPortal>
        <div>{link}</div>
      </Tooltip>
    ) : (
      link
    );
  };

  const sectionLabel = (label: string) =>
    !rail && (
      <Text
        size={11}
        weight={600}
        color="dimmed"
        px={12}
        pt={16}
        pb={4}
        sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}
      >
        {label}
      </Text>
    );

  return (
    <AppShell
      padding={0}
      navbarOffsetBreakpoint="sm"
      styles={{ main: { background: "transparent", minHeight: "100vh" } }}
      header={
        <Header height={60} px="md">
          <Group position="apart" h="100%" noWrap>
            <Group spacing="sm" noWrap>
              <MediaQuery largerThan="sm" styles={{ display: "none" }}>
                <Burger
                  opened={opened}
                  onClick={() => setOpened(!opened)}
                  size="sm"
                  aria-label={t("precision.nav.menu")}
                />
              </MediaQuery>
              <Link href="/" passHref>
                <Group spacing="sm" noWrap>
                  <Logo height={30} width={30} />
                  <Text weight={650} size="md" lineClamp={1}>
                    {config.get("general.appName")}
                  </Text>
                </Group>
              </Link>
            </Group>
            <Group spacing={6} noWrap>
              <Tooltip label={t("precision.nav.color-scheme")} withinPortal>
                <ActionIcon
                  size="lg"
                  aria-label={t("precision.nav.color-scheme")}
                  onClick={() => {
                    const next: ColorScheme =
                      theme.colorScheme === "dark" ? "light" : "dark";
                    userPreferences.set("colorScheme", next);
                    toggleColorScheme(next);
                  }}
                >
                  {theme.colorScheme === "dark" ? (
                    <TbSun size={18} />
                  ) : (
                    <TbMoon size={18} />
                  )}
                </ActionIcon>
              </Tooltip>
              <ActionAvatar />
            </Group>
          </Group>
        </Header>
      }
      navbar={
        <Navbar
          width={{ sm: rail ? 64 : 240 }}
          hiddenBreakpoint="sm"
          hidden={!opened}
          p={8}
        >
          <Navbar.Section grow component={ScrollArea}>
            {main.map(renderItem)}
            {admin.length > 0 && sectionLabel(t("navbar.avatar.admin"))}
            {admin.map(renderItem)}
          </Navbar.Section>
          <MediaQuery smallerThan="sm" styles={{ display: "none" }}>
            <Navbar.Section>
              <Tooltip
                label={t(
                  rail ? "precision.nav.expand" : "precision.nav.collapse",
                )}
                position="right"
                withinPortal
              >
                <ActionIcon
                  size="lg"
                  m={4}
                  onClick={toggleCollapsed}
                  aria-label={t(
                    rail ? "precision.nav.expand" : "precision.nav.collapse",
                  )}
                >
                  {rail ? (
                    <TbChevronsRight size={18} />
                  ) : (
                    <TbChevronsLeft size={18} />
                  )}
                </ActionIcon>
              </Tooltip>
            </Navbar.Section>
          </MediaQuery>
        </Navbar>
      }
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <Box
          sx={{
            flex: 1,
            width: "100%",
            maxWidth: WIDE_ROUTES.includes(router.pathname) ? undefined : 1000,
            margin: "0 auto",
            padding: "20px 24px",
            [theme.fn.smallerThan("md")]: { padding: 16 },
            [theme.fn.smallerThan("xs")]: { padding: 12 },
          }}
        >
          {crumbs.length > 0 && (
            <Box
              component="nav"
              aria-label={t("precision.nav.breadcrumbs")}
              mb="sm"
            >
              <Breadcrumbs sx={{ fontSize: 13 }}>
                {crumbs.map((crumb, i) =>
                  i === crumbs.length - 1 ? (
                    <Text key={crumb.link} size={13} color="dimmed">
                      {crumb.label}
                    </Text>
                  ) : (
                    <Anchor
                      key={crumb.link}
                      component={Link}
                      href={crumb.link}
                      size={13}
                    >
                      {crumb.label}
                    </Anchor>
                  ),
                )}
              </Breadcrumbs>
            </Box>
          )}
          {children}
        </Box>
        {/* the footer is fixed by default and would cover the sidebar */}
        <Box sx={{ ".mantine-Footer-root": { position: "static" } }}>
          <Footer />
        </Box>
      </Box>
    </AppShell>
  );
};

export default PrecisionShell;
