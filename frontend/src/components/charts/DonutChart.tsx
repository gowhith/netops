type DonutTone = "healthy" | "warning" | "critical" | "degraded" | "info";

interface DonutSegment {
  label: string;
  value: number;
  tone: DonutTone;
  description?: string;
}

interface DonutChartProps {
  valueLabel: string;
  value: string;
  segments: DonutSegment[];
}

const toneColors: Record<DonutTone, string> = {
  healthy: "var(--healthy)",
  warning: "var(--warning)",
  critical: "var(--critical)",
  degraded: "var(--teal)",
  info: "#2563eb",
};

export function DonutChart({
  valueLabel,
  value,
  segments,
}: DonutChartProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let offset = 0;

  return (
    <div className="donut-chart">
      <div className="donut-chart__canvas">
        <svg
          aria-label={valueLabel}
          className="donut-chart__svg"
          viewBox="0 0 160 160"
        >
          <circle
            className="donut-chart__track"
            cx="80"
            cy="80"
            r={radius}
            strokeWidth="16"
          />
          {segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const strokeDasharray = `${length} ${circumference - length}`;
            const strokeDashoffset = -offset;
            offset += length;

            return (
              <circle
                key={segment.label}
                className="donut-chart__segment"
                cx="80"
                cy="80"
                r={radius}
                stroke={toneColors[segment.tone]}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeWidth="16"
              />
            );
          })}
        </svg>
        <div className="donut-chart__center">
          <span>{valueLabel}</span>
          <strong>{value}</strong>
        </div>
      </div>

      <div className="donut-chart__legend">
        {segments.map((segment) => (
          <div className="donut-chart__legend-item" key={segment.label}>
            <div className="donut-chart__legend-head">
              <div className="donut-chart__legend-label">
                <span
                  className={`donut-chart__swatch donut-chart__swatch--${segment.tone}`}
                />
                <strong>{segment.label}</strong>
              </div>
              <span>{segment.value}</span>
            </div>
            {segment.description ? (
              <div className="small-text muted-text">{segment.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
