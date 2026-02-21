"use client";

import {
  type ChartVisualContent,
  chartVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";
import { useExtracted } from "next-intl";
import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

function isValidChartPayload<T>(
  payload: unknown,
): payload is [{ payload: T }, ...{ payload: T }[]] {
  if (!Array.isArray(payload) || payload.length === 0) {
    return false;
  }
  const first: unknown = payload[0];
  return typeof first === "object" && first !== null && "payload" in first;
}

type ChartDataPoint = ChartVisualContent["data"][number];

const BAR_RADIUS = 3;

// oxlint-disable-next-line eslint/id-length -- `r` is the SVG circle radius attribute required by recharts
const ACTIVE_DOT_STYLE = { fill: "var(--foreground)", r: 4, strokeWidth: 0 };

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: unknown }) {
  if (!(active && isValidChartPayload<ChartDataPoint>(payload))) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-sm">
      <p className="text-muted-foreground text-xs">{data.name}</p>
      <p className="text-sm font-medium">{data.value}</p>
    </div>
  );
}

function BarChartVisual({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer height={224} width="100%">
      <BarChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

        <XAxis
          axisLine={false}
          dataKey="name"
          fontSize={12}
          interval={0}
          stroke="var(--muted-foreground)"
          tickLine={false}
          tickMargin={8}
        />

        <Tooltip content={ChartTooltip} />

        <Bar
          dataKey="value"
          fill="var(--foreground)"
          isAnimationActive={false}
          radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartVisual({ data }: { data: ChartDataPoint[] }) {
  const gradientId = useId();

  return (
    <ResponsiveContainer height={224} width="100%">
      <AreaChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.12} />
            <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

        <XAxis
          axisLine={false}
          dataKey="name"
          fontSize={12}
          interval={0}
          stroke="var(--muted-foreground)"
          tickLine={false}
          tickMargin={8}
        />

        <Tooltip content={ChartTooltip} />

        <Area
          activeDot={ACTIVE_DOT_STYLE}
          dataKey="value"
          dot={false}
          fill={`url(#${gradientId})`}
          fillOpacity={1}
          isAnimationActive={false}
          stroke="var(--foreground)"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PieChartVisual({ data }: { data: ChartDataPoint[] }) {
  const t = useExtracted();
  const coloredData = data.map((entry, index) => ({
    ...entry,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div>
      <ResponsiveContainer height={192} width="100%">
        <PieChart>
          <Tooltip content={ChartTooltip} />

          <Pie
            data={coloredData}
            dataKey="value"
            innerRadius="55%"
            isAnimationActive={false}
            nameKey="name"
            outerRadius="80%"
            stroke="var(--background)"
            strokeWidth={2}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul aria-label={t("Legend")} className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {coloredData.map((entry) => (
          <li className="flex items-center gap-1.5 text-sm" key={entry.name}>
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartContent({ parsed }: { parsed: ChartVisualContent }) {
  if (parsed.chartType === "bar") {
    return <BarChartVisual data={parsed.data} />;
  }

  if (parsed.chartType === "line") {
    return <LineChartVisual data={parsed.data} />;
  }

  return <PieChartVisual data={parsed.data} />;
}

export function ChartVisual({ content }: { content: unknown }) {
  const parsed = chartVisualContentSchema.parse(content);

  return (
    <figure aria-label={parsed.title} className="w-full max-w-xl">
      <figcaption className="text-muted-foreground mb-4 text-center text-sm font-medium">
        {parsed.title}
      </figcaption>

      <ChartContent parsed={parsed} />
    </figure>
  );
}
