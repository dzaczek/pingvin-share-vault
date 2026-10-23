import { Paper, SimpleGrid, Text, useMantineTheme } from "@mantine/core";
import moment from "moment";
import { ReactElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useTranslate from "../../../hooks/useTranslate.hook";
import { Stats } from "../../../types/stats.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";

const HEIGHT = 240;

const bytes = (value: number) => (value ? byteToHumanSizeString(value) : "0");

const Chart = ({
  title,
  children,
}: {
  title: string;
  children: ReactElement;
}) => (
  <Paper withBorder p="md" radius="md">
    <Text weight={600} mb="sm">
      {title}
    </Text>
    <div style={{ width: "100%", height: HEIGHT }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  </Paper>
);

// Loaded only on the stats page and only in the browser, recharts measures
// its container and there is nothing to measure on the server.
const StatsCharts = ({ stats }: { stats: Stats }) => {
  const theme = useMantineTheme();
  const t = useTranslate();
  const dark = theme.colorScheme === "dark";

  const color = (name: string) => theme.colors[name][dark ? 4 : 6];
  const primary = color(theme.primaryColor);
  const muted = dark ? theme.colors.dark[2] : theme.colors.gray[6];
  const grid = dark ? theme.colors.dark[4] : theme.colors.gray[2];

  const axis = {
    stroke: muted,
    tick: { fill: muted, fontSize: 12 },
    tickLine: false,
    axisLine: false,
  };
  const tooltip = {
    contentStyle: {
      background: dark ? theme.colors.dark[7] : theme.white,
      border: `1px solid ${grid}`,
      borderRadius: theme.radius.md,
      fontSize: 13,
    },
    labelStyle: { color: dark ? theme.colors.dark[0] : theme.black },
    cursor: { fill: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" },
  };

  const daily = stats.daily.map((d) => ({
    ...d,
    label: moment(d.day).format("D MMM"),
  }));

  const series = [
    { key: "uploads", color: primary },
    { key: "downloads", color: color("teal") },
    { key: "views", color: color("violet") },
    { key: "shares", color: color("orange") },
  ];

  const storage = stats.top.storage.map((r) => ({
    name: r.user.displayName || r.user.username,
    value: r.value,
  }));

  return (
    <SimpleGrid cols={2} breakpoints={[{ maxWidth: "md", cols: 1 }]} mb="lg">
      <Chart title={t("admin.stats.chart.activity")}>
        <AreaChart data={daily} margin={{ left: -16, right: 8 }}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`stats-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="label" minTickGap={24} {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={t(`admin.stats.series.${s.key}`)}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#stats-${s.key})`}
            />
          ))}
        </AreaChart>
      </Chart>

      <Chart title={t("admin.stats.chart.volume")}>
        <BarChart data={daily} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="label" minTickGap={24} {...axis} />
          <YAxis tickFormatter={bytes} width={64} {...axis} />
          <Tooltip {...tooltip} formatter={(value) => bytes(Number(value))} />
          <Bar
            dataKey="uploadBytes"
            name={t("admin.stats.series.uploadBytes")}
            fill={primary}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </Chart>

      <Chart title={t("admin.stats.chart.logins")}>
        <BarChart data={daily} margin={{ left: -16, right: 8 }}>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="label" minTickGap={24} {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="logins"
            name={t("admin.stats.series.logins")}
            stackId="logins"
            fill={color("green")}
          />
          <Bar
            dataKey="failedLogins"
            name={t("admin.stats.series.failedLogins")}
            stackId="logins"
            fill={color("red")}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="users"
            name={t("admin.stats.series.users")}
            fill={color("cyan")}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </Chart>

      <Chart title={t("admin.stats.chart.storage")}>
        <BarChart
          data={storage}
          layout="vertical"
          margin={{ left: 8, right: 16 }}
        >
          <CartesianGrid horizontal={false} stroke={grid} />
          <XAxis type="number" tickFormatter={bytes} {...axis} />
          <YAxis type="category" dataKey="name" width={96} {...axis} />
          <Tooltip {...tooltip} formatter={(value) => bytes(Number(value))} />
          <Bar
            dataKey="value"
            name={t("admin.stats.series.storage")}
            fill={primary}
            radius={[0, 4, 4, 0]}
            barSize={14}
          />
        </BarChart>
      </Chart>
    </SimpleGrid>
  );
};

export default StatsCharts;
