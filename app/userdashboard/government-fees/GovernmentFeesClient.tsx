"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FolderKanban, IndianRupee, Loader2, MapPin } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import {
  filterNonDraftProjects,
  getProjectLabel,
} from "@/app/userdashboard/ownerWorkspaceConsultants";
import {
  formatIndianCurrency,
  majorUseToRateType,
  RATE_TYPE_LABELS,
  type ReadyReckonerEntry,
  type ReadyReckonerRateType,
} from "@/app/utils/readyReckoner";

type TabId = "fee-calculator" | "payment-tracking" | "receipts";

type SavePlotDetails = {
  ward?: string;
  villageName?: string;
  proposedCtsNumber?: string[] | string;
  majorUseOfPlot?: string;
};

type ReckonerResponse = {
  found: boolean;
  village?: string;
  surveyNo?: string;
  requestedSurveyNo?: string;
  marathiVillage?: string | null;
  rates?: ReadyReckonerEntry;
  message?: string;
};

function readSavePlotDetails(project: { save_plot_details?: unknown }): SavePlotDetails {
  const raw = project.save_plot_details;
  if (!raw || typeof raw !== "object") return {};
  return raw as SavePlotDetails;
}

function readSurveyNumbers(details: SavePlotDetails): string[] {
  const raw = details.proposedCtsNumber;
  if (Array.isArray(raw)) {
    return raw.map(String).filter((s) => s.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

const RATE_TYPES: ReadyReckonerRateType[] = [
  "openLand",
  "residential",
  "office",
  "commercial",
  "industrial",
];

export default function GovernmentFeesClient() {
  const searchParams = useSearchParams();
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const nonDraftProjects = useMemo(
    () => filterNonDraftProjects(projects),
    [projects]
  );

  const [activeTab, setActiveTab] = useState<TabId>("fee-calculator");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState("");
  const [loadingRates, setLoadingRates] = useState(false);
  const [rateData, setRateData] = useState<ReckonerResponse | null>(null);

  const selectedProject =
    nonDraftProjects.find((p) => p.id === selectedProjectId) ?? null;
  const plotDetails = selectedProject ? readSavePlotDetails(selectedProject) : {};
  const surveyNumbers = readSurveyNumbers(plotDetails);
  const villageName = String(plotDetails.villageName ?? "").trim();
  const ward = String(plotDetails.ward ?? "").trim();
  const majorUse = String(plotDetails.majorUseOfPlot ?? "").trim();

  useEffect(() => {
    if (projectsLoading) return;
    const fromQuery = searchParams.get("projectId");
    if (fromQuery && nonDraftProjects.some((p) => p.id === fromQuery)) {
      setSelectedProjectId(fromQuery);
      return;
    }
    if (!selectedProjectId && nonDraftProjects[0]) {
      setSelectedProjectId(nonDraftProjects[0].id);
    }
  }, [searchParams, projectsLoading, nonDraftProjects, selectedProjectId]);

  useEffect(() => {
    if (surveyNumbers.length === 0) {
      setSelectedSurvey("");
      return;
    }
    if (!selectedSurvey || !surveyNumbers.includes(selectedSurvey)) {
      setSelectedSurvey(surveyNumbers[0]);
    }
  }, [surveyNumbers, selectedSurvey]);

  useEffect(() => {
    if (!villageName || !selectedSurvey) {
      setRateData(null);
      return;
    }

    const ac = new AbortController();
    setLoadingRates(true);

    const qs = new URLSearchParams({
      village: villageName,
      survey: selectedSurvey,
    });

    fetch(`/api/ready-reckoner?${qs}`, { signal: ac.signal })
      .then(async (res) => {
        const body = (await res.json()) as ReckonerResponse;
        if (res.ok && body.found) {
          setRateData(body);
        } else {
          setRateData({
            found: false,
            village: villageName,
            surveyNo: selectedSurvey,
            message: body.message ?? "No ready reckoner rate found.",
          });
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setRateData({
          found: false,
          village: villageName,
          surveyNo: selectedSurvey,
          message: "Failed to load ready reckoner rates.",
        });
      })
      .finally(() => setLoadingRates(false));

    return () => ac.abort();
  }, [villageName, selectedSurvey]);

  const primaryRateType = majorUseToRateType(majorUse);
  const primaryRateValue =
    rateData?.found && rateData.rates
      ? rateData.rates[primaryRateType] ?? 0
      : 0;

  const contextPills: { label: string; value: string }[] = [];
  if (ward) contextPills.push({ label: "Ward", value: ward });
  if (villageName) contextPills.push({ label: "Village", value: villageName });
  if (surveyNumbers.length > 0) {
    contextPills.push({
      label: "CTS / Survey",
      value: surveyNumbers.join(", "),
    });
  }

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: "fee-calculator", label: "Fee Calculator" },
    { id: "payment-tracking", label: "Payment Tracking", disabled: true },
    { id: "receipts", label: "Receipts", disabled: true },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">
            Government Fees &amp; ASR
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ready reckoner rates based on your project village and survey number.
          </p>
        </div>
        <div className="w-full min-w-0 lg:max-w-sm">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            <FolderKanban className="h-3.5 w-3.5" />
            Project
          </label>
          <CustomSelect
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={
              projectsLoading
                ? []
                : nonDraftProjects.map((project) => ({
                    value: project.id,
                    label: getProjectLabel(project),
                  }))
            }
            placeholder={
              projectsLoading
                ? "Loading projects…"
                : nonDraftProjects.length === 0
                  ? "No submitted projects"
                  : "Select a project"
            }
            disabled={projectsLoading || nonDraftProjects.length === 0}
          />
        </div>
      </div>

      {contextPills.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {contextPills.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600"
            >
              <span className="font-medium text-gray-400">{pill.label}</span>
              <span className="font-semibold text-brand-navy">{pill.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="border-b border-gray-200">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className={[
                "shrink-0 border-b-2 pb-3 text-sm font-semibold transition-colors",
                activeTab === tab.id
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-gray-400",
                tab.disabled ? "cursor-not-allowed opacity-60" : "hover:text-brand-navy",
              ].join(" ")}
            >
              {tab.label}
              {tab.disabled ? (
                <span className="ml-1.5 text-[10px] font-normal uppercase">Soon</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "fee-calculator" ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="px-4 py-5 sm:px-6">
            {!selectedProject ? (
              <EmptyState message="Select a project to view ready reckoner rates." />
            ) : !villageName || surveyNumbers.length === 0 ? (
              <EmptyState
                message="This project is missing village or survey number details."
                action={
                  <Link
                    href={`/dashboard/project-details?projectId=${selectedProjectId}&tab=save-plot`}
                    className="mt-3 inline-flex text-sm font-semibold text-brand-blue hover:underline"
                  >
                    Complete Property Details →
                  </Link>
                }
              />
            ) : (
              <>
                {surveyNumbers.length > 1 ? (
                  <div className="mb-5">
                    <p className="mb-2 text-sm font-medium text-brand-navy">
                      Select survey number
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {surveyNumbers.map((survey) => (
                        <button
                          key={survey}
                          type="button"
                          onClick={() => setSelectedSurvey(survey)}
                          className={[
                            "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                            selectedSurvey === survey
                              ? "border-brand-blue bg-blue-50 text-brand-blue"
                              : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300",
                          ].join(" ")}
                        >
                          {survey}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {loadingRates ? (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
                      Loading ready reckoner rates…
                    </div>
                  </div>
                ) : rateData?.found && rateData.rates ? (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <h2 className="text-base font-bold text-brand-navy">
                        Ready Reckoner Rates
                      </h2>
                      <ul className="mt-4 space-y-3">
                        {RATE_TYPES.map((type) => (
                          <li
                            key={type}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-600">{RATE_TYPE_LABELS[type]}</span>
                            <span
                              className={[
                                "font-semibold tabular-nums",
                                type === primaryRateType
                                  ? "text-brand-blue"
                                  : "text-brand-navy",
                              ].join(" ")}
                            >
                              {formatIndianCurrency(rateData.rates![type])}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white">
                        <span>Rate Unit</span>
                        <span>{rateData.rates.rateUnit || "चौरस मीटर"} / sq.m</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          {majorUse ? "Rate for major use" : "Primary rate"}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {majorUse || RATE_TYPE_LABELS[primaryRateType]}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-brand-blue">
                          {formatIndianCurrency(primaryRateValue)}
                        </p>
                        <p className="mt-1 text-xs italic text-gray-400">
                          (as per latest ready reckoner assessment)
                        </p>
                      </div>

                      <div
                        className={[
                          "rounded-2xl border p-5 shadow-sm",
                          primaryRateValue > 0
                            ? "border-emerald-100 bg-emerald-50/60"
                            : "border-amber-100 bg-amber-50/60",
                        ].join(" ")}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Lookup
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                          {rateData.village} · {rateData.surveyNo}
                        </p>
                        {rateData.requestedSurveyNo &&
                        rateData.requestedSurveyNo !== rateData.surveyNo ? (
                          <p className="mt-1 text-xs text-emerald-700/70">
                            Matched from CTS {rateData.requestedSurveyNo}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm text-emerald-700/80">
                          {primaryRateValue > 0
                            ? "Rate found for selected village and survey number"
                            : "Rate entry exists but selected use has zero value"}
                        </p>
                      </div>

                      {rateData.rates.address ? (
                        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                Reckoner location
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-gray-700">
                                {rateData.rates.address}
                              </p>
                              {rateData.marathiVillage ? (
                                <p className="mt-2 text-xs text-gray-400">
                                  {rateData.marathiVillage}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    message={
                      rateData?.message ??
                      `No ready reckoner rate found for ${villageName} / ${selectedSurvey}.`
                    }
                    icon={<IndianRupee className="h-7 w-7" />}
                  />
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  message,
  action,
  icon,
}: {
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
        {icon ?? <IndianRupee className="h-7 w-7" />}
      </span>
      <p className="mt-4 max-w-md text-sm text-gray-500">{message}</p>
      {action}
    </div>
  );
}
