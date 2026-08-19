export type DrawingReviewMode = "view" | "overlay" | "compare" | "redline";

export type DrawingVersionStatus = "current" | "approved" | "previous";

export type DrawingVersion = {
  id: string;
  name: string;
  fileName: string;
  dateLabel: string;
  status: DrawingVersionStatus;
};

export type KeyChangeTone = "up" | "down" | "ok" | "note";

export type KeyChange = {
  id: string;
  label: string;
  tone: KeyChangeTone;
};

export type DrawingRemark = {
  id: string;
  author: string;
  role: string;
  initials: string;
  dateLabel: string;
  body: string;
};

export type RedlineMark = {
  id: string;
  kind: "rect" | "pin";
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  label?: string;
};

export const SAMPLE_KEY_CHANGES: KeyChange[] = [
  { id: "kc-1", label: "Floor Area increased by 2%", tone: "up" },
  { id: "kc-2", label: "Stair width reduced", tone: "down" },
  { id: "kc-3", label: "Fire tank location updated", tone: "ok" },
  { id: "kc-4", label: "Utility area reconfigured", tone: "note" },
];

export const SAMPLE_REMARKS: DrawingRemark[] = [
  {
    id: "rm-1",
    author: "Fire Consultant",
    role: "Fire Consultant",
    initials: "FC",
    dateLabel: "May 31, 2024",
    body: "Please review fire stair width as per latest circular.",
  },
  {
    id: "rm-2",
    author: "Architect",
    role: "Architect",
    initials: "AR",
    dateLabel: "May 30, 2024",
    body: "Updated drawing uploaded for review.",
  },
];

export const REDLINE_COLORS = ["#dc2626", "#16a34a", "#d97706", "#2563eb"];
