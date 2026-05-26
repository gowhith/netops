import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  delta: string;
  detail: string;
  tone?: "healthy" | "warning" | "critical" | "degraded" | "info";
  visual?: ReactNode;
  caption?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  detail,
  tone = "healthy",
  visual,
  caption,
}: MetricCardProps) {
  return (
    <article className={cn("metric-card", "stagger-in")}>
      <div className="metric-card__label">
        <span>{label}</span>
        <span className={`tone-chip tone-chip--${tone}`}>{tone}</span>
      </div>
      <div className="metric-card__value">{value}</div>
      {visual ? <div className="metric-card__visual">{visual}</div> : null}
      <div className="metric-card__subline">
        <span className="metric-card__trend">{delta}</span>
        <span>{detail}</span>
      </div>
      {caption ? <p className="metric-card__caption">{caption}</p> : null}
    </article>
  );
}
