export type DrawingReviewMode = "view" | "overlay" | "compare" | "redline";

export type DrawingVersionStatus = "current" | "approved" | "previous" | "revision_requested";

export type DrawingRemarkKind = "comment" | "revision_request" | "approval";

export type DrawingVersion = {
  id: string;
  name: string;
  fileName: string;
  storagePath: string;
  dateLabel: string;
  status: DrawingVersionStatus;
  keyChanges: KeyChange[];
};

export type KeyChangeTone = "up" | "down" | "ok" | "note";

export type KeyChange = {
  id: string;
  label: string;
  tone: KeyChangeTone;
};

export type DrawingRemark = {
  id: string;
  versionId: string;
  author: string;
  role: string;
  initials: string;
  dateLabel: string;
  body: string;
  kind: DrawingRemarkKind;
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

export const REDLINE_COLORS = ["#dc2626", "#16a34a", "#d97706", "#2563eb"];
