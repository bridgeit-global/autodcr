import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { DeadlineItem } from "@/app/userdashboard/dashboardData";

type UpcomingDeadlinesCardProps = {
  deadlines: DeadlineItem[];
};

export default function UpcomingDeadlinesCard({ deadlines }: UpcomingDeadlinesCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-brand-navy">Upcoming Deadlines</h2>
        <Link
          href="/userdashboard/legacy"
          className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover"
        >
          View All
        </Link>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {deadlines.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-surface px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-brand-blue">
                <CalendarClock className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-medium text-gray-800">{item.title}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-gray-500">
              {item.daysRemaining} {item.daysRemaining === 1 ? "day" : "days"}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/userdashboard/legacy"
        className="mt-4 block text-center text-xs font-semibold text-brand-blue hover:text-brand-blue-hover"
      >
        View All
      </Link>
    </div>
  );
}
