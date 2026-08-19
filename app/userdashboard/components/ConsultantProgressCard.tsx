"use client";

import { Check } from "lucide-react";
import type { AssignedConsultantCard } from "@/app/userdashboard/ownerWorkspaceConsultants";

function CredentialRow({
  label,
  value,
  verified,
}: {
  label: string;
  value?: string;
  verified: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        {value ? (
          <span className="truncate font-medium text-gray-800">{value}</span>
        ) : null}
        <span
          className={[
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            verified ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400",
          ].join(" ")}
          aria-label={verified ? `${label} verified` : `${label} pending`}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      </span>
    </div>
  );
}

type ConsultantProgressCardProps = {
  card: AssignedConsultantCard;
  onViewDetails: (card: AssignedConsultantCard) => void;
};

export default function ConsultantProgressCard({
  card,
  onViewDetails,
}: ConsultantProgressCardProps) {
  return (
    <article className="flex min-w-[280px] max-w-sm flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
          {card.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-brand-navy">
                {card.consultantType}
              </h3>
              <p className="truncate text-sm text-gray-600">{card.name}</p>
              <p className="mt-0.5 truncate text-xs text-gray-400">{card.projectLabel}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {card.isActive ? "Active" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-4">
        <CredentialRow
          label="Licence"
          value={card.credentials.licence !== "—" ? card.credentials.licence : undefined}
          verified={card.credentials.licence !== "—"}
        />
        <CredentialRow label="Letterhead" verified={card.credentials.hasLetterhead} />
        <CredentialRow label="DSC" verified={card.credentials.hasDsc} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-center">
        <div>
          <p className="text-lg font-bold text-brand-blue">{card.stats.pending}</p>
          <p className="text-[11px] font-medium text-gray-500">Pending</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-navy">{card.stats.completed}</p>
          <p className="text-[11px] font-medium text-gray-500">Completed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-blue">{card.stats.openRemarks}</p>
          <p className="text-[11px] font-medium text-gray-500">Open Remarks</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onViewDetails(card)}
        className="mt-4 w-full text-center text-sm font-semibold text-brand-blue hover:text-brand-blue-hover"
      >
        View Details →
      </button>
    </article>
  );
}

export function WorkspaceDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}
