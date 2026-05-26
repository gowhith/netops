import { cn, getSeverityTone } from "../lib/utils";

interface StatusBadgeProps {
  label: string;
  tone?: string;
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const resolvedTone = tone ?? getSeverityTone(label as never);

  return (
    <span className={cn("status-badge", `status-badge--${resolvedTone}`)}>
      {label}
    </span>
  );
}
