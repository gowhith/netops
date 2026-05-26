interface ProgressBarProps {
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="progress" aria-hidden="true">
      <div className="progress__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
