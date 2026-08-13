/**
 * Shared dashboard types + static placeholders for widgets not yet wired to live data.
 * Metric cards on `/userdashboard` are loaded live in `page.tsx`.
 */

export type MetricHintTone = "up" | "down" | "neutral" | "danger";

export type DashboardMetric = {
  id: string;
  label: string;
  value: string | number;
  hint?: { text: string; tone: MetricHintTone };
};

export type ProjectHealthSplit = {
  total: number;
  submitted: number;
  draft: number;
  /** Percentage of projects that are submitted (non-draft) */
  percentSubmitted: number;
};

export type DeadlineItem = {
  id: string;
  title: string;
  daysRemaining: number;
};

export type AiInsightSeverity = "danger" | "warning" | "info";

export type AiInsight = {
  id: string;
  text: string;
  severity: AiInsightSeverity;
};

export type QuickAction = {
  id: string;
  label: string;
  href?: string;
  /** When false, the action is shown but not navigable yet */
  enabled: boolean;
};

export const DASHBOARD_METRICS: DashboardMetric[] = [
  {
    id: "total-projects",
    label: "Total Projects",
    value: 0,
    hint: { text: "All your projects", tone: "neutral" },
  },
  {
    id: "submitted-projects",
    label: "Submitted Projects",
    value: 0,
    hint: { text: "Ready for applications", tone: "neutral" },
  },
  {
    id: "draft-projects",
    label: "Draft Projects",
    value: 0,
    hint: { text: "Not yet submitted", tone: "neutral" },
  },
  {
    id: "total-applications",
    label: "Total Applications",
    value: 0,
    hint: { text: "Across all projects", tone: "neutral" },
  },
];

export const PROJECT_HEALTH: ProjectHealthSplit = {
  total: 0,
  submitted: 0,
  draft: 0,
  percentSubmitted: 0,
};

export const UPCOMING_DEADLINES: DeadlineItem[] = [
  { id: "d1", title: "Fire Consultant Report", daysRemaining: 3 },
  { id: "d2", title: "DP Remarks Reply", daysRemaining: 5 },
  { id: "d3", title: "Owner Undertaking", daysRemaining: 7 },
  { id: "d4", title: "SWD Certificate", daysRemaining: 10 },
];

export const AI_INSIGHTS: AiInsight[] = [
  { id: "a1", text: "2 documents missing", severity: "danger" },
  {
    id: "a2",
    text: "Fire consultant licence expiring in 7 days",
    severity: "warning",
  },
  {
    id: "a3",
    text: "DP remarks received — action needed",
    severity: "warning",
  },
];

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "create-project",
    label: "Create New Project",
    href: "/dashboard/project-details",
    enabled: true,
  },
  {
    id: "generate-document",
    label: "Generate Document",
    href: "/create-application",
    enabled: true,
  },
  {
    id: "edit-project",
    label: "Edit Project",
    enabled: true,
  },
  { id: "check-compliance", label: "Check Compliance", enabled: false },
];
