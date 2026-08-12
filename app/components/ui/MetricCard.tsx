import { type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  icon?: ReactNode;
  className?: string;
};

export default function MetricCard({ label, value, trend, icon, className = "" }: MetricCardProps) {
  return (
    <div
      className={[
        "rounded-xl border border-gray-100 bg-white p-5 shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p
              className={[
                "mt-1 flex items-center gap-1 text-xs font-medium",
                trend.direction === "up" ? "text-green-600" : "text-red-600",
              ].join(" ")}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
