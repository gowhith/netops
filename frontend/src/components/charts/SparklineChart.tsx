import type { CSSProperties } from "react";

type SparklineTone = "healthy" | "warning" | "critical" | "degraded" | "info" | "teal";

interface SparklineChartProps {
  values: number[];
  tone?: SparklineTone;
  ariaLabel?: string;
}

const toneMap: Record<SparklineTone, { stroke: string; fill: string }> = {
  healthy: {
    stroke: "var(--healthy)",
    fill: "rgba(29, 122, 78, 0.14)",
  },
  warning: {
    stroke: "var(--warning)",
    fill: "rgba(217, 119, 6, 0.14)",
  },
  critical: {
    stroke: "var(--critical)",
    fill: "rgba(194, 65, 12, 0.14)",
  },
  degraded: {
    stroke: "var(--teal)",
    fill: "rgba(15, 118, 110, 0.14)",
  },
  info: {
    stroke: "#2563eb",
    fill: "rgba(37, 99, 235, 0.14)",
  },
  teal: {
    stroke: "var(--teal)",
    fill: "rgba(20, 184, 166, 0.14)",
  },
};

export function SparklineChart({
  values,
  tone = "teal",
  ariaLabel = "Trend chart",
}: SparklineChartProps) {
  if (values.length === 0) {
    return null;
  }

  const width = 220;
  const height = 74;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(" ");
  const latestPoint = points[points.length - 1]?.split(",").map(Number) ?? [width, height / 2];
  const palette = toneMap[tone];

  return (
    <svg
      aria-label={ariaLabel}
      className="sparkline"
      preserveAspectRatio="none"
      style={
        {
          "--sparkline-stroke": palette.stroke,
          "--sparkline-fill": palette.fill,
        } as CSSProperties
      }
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline className="sparkline__area" points={areaPoints} />
      <polyline className="sparkline__line" points={points.join(" ")} />
      <circle
        className="sparkline__marker"
        cx={latestPoint[0]}
        cy={latestPoint[1]}
        r="4.5"
      />
    </svg>
  );
}
