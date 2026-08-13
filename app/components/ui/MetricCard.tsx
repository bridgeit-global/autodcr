import { type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type HintTone = "up" | "down" | "neutral" | "danger";

type MetricCardProps = {
  label: string;
  value: string | number;
  /** @deprecated Prefer `hint` for richer tone support */
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  hint?: {
    text: string;
    tone: HintTone;
  };
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
};

const hintToneClasses: Record<HintTone, string> = {
  up: "text-status-success",
  down: "text-status-danger",
  neutral: "text-gray-500",
  danger: "text-status-danger",
};

export default function MetricCard({
  label,
  value,
  trend,
  hint,
  icon,
  className = "",
  onClick,
}: MetricCardProps) {
  const resolvedHint = hint
    ? hint
    : trend
      ? { text: trend.value, tone: (trend.direction === "up" ? "up" : "down") as HintTone }
      : null;

  const classes = [
    "w-full rounded-xl border border-gray-100 bg-white p-5 text-left shadow-sm",
    onClick
      ? "cursor-pointer transition-all hover:border-brand-blue/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-brand-navy sm:text-3xl">{value}</p>
        {resolvedHint && (
          <p
            className={[
              "mt-1.5 flex items-center gap-1 text-xs font-medium",
              hintToneClasses[resolvedHint.tone],
            ].join(" ")}
          >
            {resolvedHint.tone === "up" && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
            {resolvedHint.tone === "down" && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{resolvedHint.text}</span>
          </p>
        )}
      </div>
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
          {icon}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
