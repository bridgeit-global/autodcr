import Link from "next/link";
import {
  FilePlus2,
  FileText,
  Pencil,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { QuickAction } from "@/app/userdashboard/dashboardData";

type QuickActionsCardProps = {
  actions: QuickAction[];
  /** Called for enabled actions that have no `href` (e.g. Edit Project picker). */
  onActionClick?: (actionId: string) => void;
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  "create-project": FilePlus2,
  "generate-document": FileText,
  "edit-project": Pencil,
  "check-compliance": ShieldCheck,
};

export default function QuickActionsCard({
  actions,
  onActionClick,
}: QuickActionsCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-brand-navy">Quick Actions</h2>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {actions.map((action) => {
          const Icon = ACTION_ICONS[action.id] ?? FileText;
          const className =
            "flex min-h-11 w-full items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue/40 hover:bg-blue-50";

          if (action.enabled && action.href) {
            return (
              <li key={action.id}>
                <Link href={action.href} className={className}>
                  <Icon className="h-4 w-4 shrink-0 text-brand-blue" />
                  {action.label}
                </Link>
              </li>
            );
          }

          if (action.enabled && onActionClick) {
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => onActionClick(action.id)}
                  className={className}
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand-blue" />
                  {action.label}
                </button>
              </li>
            );
          }

          return (
            <li key={action.id}>
              <button
                type="button"
                disabled
                title="Coming soon"
                className={`${className} cursor-not-allowed opacity-55`}
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-blue" />
                {action.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
