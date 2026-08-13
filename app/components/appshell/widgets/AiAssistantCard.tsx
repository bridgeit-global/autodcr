import { Sparkles } from "lucide-react";
import type { AiInsight } from "@/app/userdashboard/dashboardData";

type AiAssistantCardProps = {
  insights: AiInsight[];
};

const severityDot: Record<AiInsight["severity"], string> = {
  danger: "bg-status-danger",
  warning: "bg-status-warning",
  info: "bg-brand-blue",
};

export default function AiAssistantCard({ insights }: AiAssistantCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-brand-navy">AI Assistant</h2>
      </div>

      <ul className="mt-4 flex-1 space-y-3">
        {insights.map((insight) => (
          <li key={insight.id} className="flex gap-2.5 text-sm text-gray-700">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[insight.severity]}`}
            />
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-blue-hover"
      >
        View Suggestions
      </button>
    </div>
  );
}
