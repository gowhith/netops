type BarTone = "healthy" | "warning" | "critical" | "degraded" | "info";

interface BarListItem {
  label: string;
  value: number;
  tone: BarTone;
  valueLabel?: string;
  description?: string;
}

interface BarListChartProps {
  items: BarListItem[];
  maxValue?: number;
}

export function BarListChart({
  items,
  maxValue,
}: BarListChartProps) {
  const resolvedMax =
    maxValue ?? (Math.max(...items.map((item) => item.value), 0) || 1);

  return (
    <div className="bar-list">
      {items.map((item) => {
        const width = Math.max(6, (item.value / resolvedMax) * 100);
        return (
          <div className="bar-list__row" key={item.label}>
            <div className="bar-list__head">
              <div>
                <strong>{item.label}</strong>
                {item.description ? (
                  <div className="small-text muted-text">{item.description}</div>
                ) : null}
              </div>
              <span className="bar-list__value">
                {item.valueLabel ?? `${Math.round(item.value)}`}
              </span>
            </div>
            <div className="bar-list__track">
              <span
                className={`bar-list__fill bar-list__fill--${item.tone}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
