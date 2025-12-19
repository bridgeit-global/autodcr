"use client";

import { useMemo, useState, useEffect } from "react";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";

type ExtractRow = {
  id: string;
  extractNo: string;
  prcArea: string;
  ulcArea: string;
  bFormArea: string;
  conveyanceArea: string;
  attorneyArea: string;
  dilrMapArea: string;
  leaseArea: string;
};

type PlotRow = {
  id: string;
  plotNumber: string;
  plotName: string;
  ownerName: string;
  // Make type optional initially so no option is pre-selected
  type: "7/12" | "PRC" | "";
  extractCount: string;
  area: string;
  extracts: ExtractRow[];
};

type AreaDetailsTotalsDraft = {
  allPlotsTotal: {
    prcArea: number;
    ulcArea: number;
    bFormArea: number;
    conveyanceArea: number;
    attorneyArea: number;
    dilrMapArea: number;
    leaseArea: number;
  };
  totalLeaseArea: number;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const ZERO_VALUE = "0";

const createExtract = (): ExtractRow => ({
  id: uid(),
  extractNo: ZERO_VALUE,
  prcArea: ZERO_VALUE,
  ulcArea: ZERO_VALUE,
  bFormArea: ZERO_VALUE,
  conveyanceArea: ZERO_VALUE,
  attorneyArea: ZERO_VALUE,
  dilrMapArea: ZERO_VALUE,
  leaseArea: ZERO_VALUE,
});

const createPlot = (index?: number): PlotRow => ({
  id: uid(),
  // Default plot numbers as 1, 2, 3... when index is provided; fallback to "0"
  plotNumber: index ? index.toString() : ZERO_VALUE,
  plotName: "",
  ownerName: "",
  type: "",
  extractCount: ZERO_VALUE,
  area: ZERO_VALUE,
  extracts: [createExtract()],
});

const calculateLeaseArea = (extract: ExtractRow) => {
  const numericValues = [
    extract.prcArea,
    extract.ulcArea,
    extract.bFormArea,
    extract.conveyanceArea,
    extract.attorneyArea,
    extract.dilrMapArea,
  ]
    .map((value) => Number(value) || 0)
    .filter((value) => value > 0);

  if (!numericValues.length) {
    return ZERO_VALUE;
  }

  return Math.min(...numericValues).toString();
};

const getPlotFieldTotals = (plot: PlotRow) => {
  const totals = {
    prcArea: 0,
    ulcArea: 0,
    bFormArea: 0,
    conveyanceArea: 0,
    attorneyArea: 0,
    dilrMapArea: 0,
    leaseArea: 0,
  };

  plot.extracts.forEach((extract) => {
    totals.prcArea += Number(extract.prcArea) || 0;
    totals.ulcArea += Number(extract.ulcArea) || 0;
    totals.bFormArea += Number(extract.bFormArea) || 0;
    totals.conveyanceArea += Number(extract.conveyanceArea) || 0;
    totals.attorneyArea += Number(extract.attorneyArea) || 0;
    totals.dilrMapArea += Number(extract.dilrMapArea) || 0;
    totals.leaseArea += Number(extract.leaseArea) || 0;
  });

  return totals;
};

const getPortalFieldTotals = (plots: PlotRow[]) => {
  const initialTotals = {
    prcArea: 0,
    ulcArea: 0,
    bFormArea: 0,
    conveyanceArea: 0,
    attorneyArea: 0,
    dilrMapArea: 0,
    leaseArea: 0,
  };

  return plots.reduce((acc, plot) => {
    const plotTotals = getPlotFieldTotals(plot);
    acc.prcArea += plotTotals.prcArea;
    acc.ulcArea += plotTotals.ulcArea;
    acc.bFormArea += plotTotals.bFormArea;
    acc.conveyanceArea += plotTotals.conveyanceArea;
    acc.attorneyArea += plotTotals.attorneyArea;
    acc.dilrMapArea += plotTotals.dilrMapArea;
    acc.leaseArea += plotTotals.leaseArea;
    return acc;
  }, initialTotals);
};

export default function AreaDetailsPage() {
  // Start with Plot No. 1 by default
  const [plots, setPlots] = useState<PlotRow[]>([createPlot(1)]);
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-area-details"));
  const portalTotals = useMemo(() => getPortalFieldTotals(plots), [plots]);
  const plotTotalsSummary = useMemo(
    () =>
      plots.map((plot, index) => ({
        label: plot.plotName?.trim() ? plot.plotName : `Plot ${index + 1}`,
        totals: getPlotFieldTotals(plot),
      })),
    [plots]
  );

  const handlePlotChange = (plotId: string, key: keyof PlotRow, value: string) => {
    setPlots((prev) =>
      prev.map((plot) => (plot.id === plotId ? { ...plot, [key]: value } : plot))
    );
  };

  // Load saved plots from localStorage after initial render to avoid hydration mismatch
  useEffect(() => {
    const saved = loadDraft<PlotRow[]>("draft-area-details-plots", [createPlot(1)]);
    setPlots(saved);
  }, []);

  const handleExtractChange = (
    plotId: string,
    extractId: string,
    key: keyof ExtractRow,
    value: string
  ) => {
    setPlots((prev) =>
      prev.map((plot) =>
        plot.id === plotId
          ? {
              ...plot,
              extracts: plot.extracts.map((extract) => {
                if (extract.id !== extractId) {
                  return extract;
                }

                const updatedExtract = { ...extract, [key]: value };

                if (key !== "leaseArea") {
                  updatedExtract.leaseArea = calculateLeaseArea(updatedExtract);
                }

                return updatedExtract;
              }),
            }
          : plot
      )
    );
  };

  const addExtract = (plotId: string) => {
    setPlots((prev) =>
      prev.map((plot) =>
        plot.id === plotId ? { ...plot, extracts: [...plot.extracts, createExtract()] } : plot
      )
    );
  };

const removeExtract = (plotId: string, extractId: string) => {
  setPlots((prev) =>
    prev.map((plot) =>
      plot.id === plotId
        ? {
            ...plot,
            extracts: plot.extracts.filter((extract) => extract.id !== extractId),
          }
        : plot
    )
  );
};

  const addPlot = () => {
    setPlots((prev) => [...prev, createPlot(prev.length + 1)]);
  };

const removePlot = (plotId: string) => {
  setPlots((prev) => (prev.length > 1 ? prev.filter((plot) => plot.id !== plotId) : prev));
};

  const totalLeaseArea = useMemo(() => {
    return plots.reduce((sum, plot) => {
      return (
        sum +
        plot.extracts.reduce(
          (innerSum, extract) => innerSum + Number(extract.leaseArea || 0),
          0
        )
      );
    }, 0);
  }, [plots]);

  const handleSave = () => {
    // Basic validation: ensure each plot has Name, Owner Name, and Type selected
    const invalidPlots = plots.filter(
      (plot) =>
        !plot.plotName.trim() ||
        !plot.ownerName.trim() ||
        !plot.type
    );

    if (invalidPlots.length > 0) {
      alert("Please fill Plot Name, Owner Name, and select Type (7/12 or PRC) for all plots before saving.");
      return;
    }

    console.log("Area Details:", plots);
    alert("Area details saved successfully!");
    markPageSaved("saved-area-details");
    setIsSaved(true);
  };

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";

  // Persist plots draft on change
  useEffect(() => {
    saveDraft("draft-area-details-plots", plots);
  }, [plots]);

  // Persist derived totals draft on change (e.g., "All Plots Total" row)
  useEffect(() => {
    const totalsDraft: AreaDetailsTotalsDraft = {
      allPlotsTotal: portalTotals,
      totalLeaseArea,
    };
    saveDraft("draft-area-details-totals", totalsDraft);
  }, [portalTotals, totalLeaseArea]);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      <section className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
        <div className="bg-white border-b border-gray-200 p-6 flex flex-wrap items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Area Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              Add plots and enter area for each extract of the plot. All areas are in sq. mtr.
            </p>
          </div>

          <div className="w-full md:w-auto flex md:justify-end">
            <button
              onClick={handleSave}
              className={`px-6 py-2 rounded-lg font-semibold shadow transition-colors ${
                isSaved
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8 pb-6">
          {plots.map((plot, plotIndex) => {
            const plotTotals = getPlotFieldTotals(plot);

            return (
            <div key={plot.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border-b border-gray-200 bg-gray-50">
                <div>
                  <label className="block font-medium text-black mb-1">Plot No.</label>
                  <input
                    value={plot.plotNumber}
                    onChange={(e) => handlePlotChange(plot.id, "plotNumber", e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={plot.plotName}
                    onChange={(e) => handlePlotChange(plot.id, "plotName", e.target.value)}
                    className={inputClasses}
                    placeholder="Enter Plot Name"
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Owner Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={plot.ownerName}
                    onChange={(e) => handlePlotChange(plot.id, "ownerName", e.target.value)}
                    className={inputClasses}
                    placeholder="Enter Owner Name"
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-4 h-10 border border-gray-200 rounded-xl px-3 bg-white">
                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="radio"
                        checked={plot.type === "7/12"}
                        onChange={() => handlePlotChange(plot.id, "type", "7/12")}
                      />
                      7/12
                    </label>
                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="radio"
                        checked={plot.type === "PRC"}
                        onChange={() => handlePlotChange(plot.id, "type", "PRC")}
                      />
                      PRC
                    </label>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block font-medium text-black mb-1">Extract</label>
                    <input
                      value={plot.extractCount}
                      onChange={(e) => handlePlotChange(plot.id, "extractCount", e.target.value)}
                      className={inputClasses}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium text-black mb-1">Area</label>
                    <input
                      value={plot.area}
                      onChange={(e) => handlePlotChange(plot.id, "area", e.target.value)}
                      className={inputClasses}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removePlot(plot.id)}
                    className={`text-sm ${
                      plots.length === 1 ? "text-gray-400 cursor-not-allowed" : "text-red-600 hover:underline"
                    }`}
                    disabled={plots.length === 1}
                    >
                      Remove Plot
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-900">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">Extract no.</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">7/12 OR PRC AREA</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">ULC Area</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">B Form Area</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">Conveyance Area</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">Area in Power of Attorney</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">DILR Measuring Map</th>
                      <th className="border-r border-gray-200 px-3 py-2 text-left">Least Area</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plot.extracts.map((extract, extractIndex) => (
                      <tr
                        key={extract.id}
                        className={`border-b border-gray-200 ${extractIndex % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                      >
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.extractNo}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "extractNo", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.prcArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "prcArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.ulcArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "ulcArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.bFormArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "bFormArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.conveyanceArea}
                            onChange={(e) =>
                              handleExtractChange(
                                plot.id,
                                extract.id,
                                "conveyanceArea",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.attorneyArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "attorneyArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={extract.dilrMapArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "dilrMapArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-gray-100 text-gray-900"
                            value={extract.leaseArea}
                            readOnly
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className={`text-xs ${
                              plot.extracts.length === 1
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-red-600 hover:underline"
                            }`}
                            onClick={() => removeExtract(plot.id, extract.id)}
                            disabled={plot.extracts.length === 1}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Sub Plot Total row inside the same table */}
                    <tr className="bg-emerald-50 font-semibold text-gray-900">
                      <td className="border-r border-gray-200 px-3 py-2 text-left">Sub Plot Total</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.prcArea}</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.ulcArea}</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.bFormArea}</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.conveyanceArea}</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.attorneyArea}</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.dilrMapArea}</td>
                      <td className="border-r border-gray-200 px-3 py-2 text-left">{plotTotals.leaseArea}</td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-6 p-4 border-t border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => addExtract(plot.id)}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  + Extract
                </button>
              </div>
            </div>
          );
          })}

          <div className="pt-2">
            <button
              type="button"
              onClick={addPlot}
              className="text-emerald-700 font-semibold hover:underline"
            >
              + Add Plot
            </button>
          </div>

          <div className="mt-6 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-900">Plot Totals</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead className="bg-white border-b border-gray-200 uppercase text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Plot</th>
                    <th className="px-3 py-2 text-left">7/12 OR PRC AREA</th>
                    <th className="px-3 py-2 text-left">ULC Area</th>
                    <th className="px-3 py-2 text-left">B Form Area</th>
                    <th className="px-3 py-2 text-left">Conveyance Area</th>
                    <th className="px-3 py-2 text-left">Area in Power of Attorney</th>
                    <th className="px-3 py-2 text-left">DILR Measuring Map</th>
                    <th className="px-3 py-2 text-left">Least Area</th>
                  </tr>
                </thead>
                <tbody>
                  {plotTotalsSummary.map(({ label, totals }) => (
                    <tr key={label} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{label}</td>
                      <td className="px-3 py-2">{totals.prcArea}</td>
                      <td className="px-3 py-2">{totals.ulcArea}</td>
                      <td className="px-3 py-2">{totals.bFormArea}</td>
                      <td className="px-3 py-2">{totals.conveyanceArea}</td>
                      <td className="px-3 py-2">{totals.attorneyArea}</td>
                      <td className="px-3 py-2">{totals.dilrMapArea}</td>
                      <td className="px-3 py-2">{totals.leaseArea}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 font-semibold text-gray-900">
                    <td className="px-3 py-2">All Plots Total</td>
                    <td className="px-3 py-2">{portalTotals.prcArea}</td>
                    <td className="px-3 py-2">{portalTotals.ulcArea}</td>
                    <td className="px-3 py-2">{portalTotals.bFormArea}</td>
                    <td className="px-3 py-2">{portalTotals.conveyanceArea}</td>
                    <td className="px-3 py-2">{portalTotals.attorneyArea}</td>
                    <td className="px-3 py-2">{portalTotals.dilrMapArea}</td>
                    <td className="px-3 py-2">{portalTotals.leaseArea}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between text-gray-900 font-semibold">
              <span>Total</span>
              <span>{totalLeaseArea}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

