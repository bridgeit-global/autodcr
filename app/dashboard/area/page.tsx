"use client";

import { useMemo, useState, useEffect } from "react";
import { loadDraft, saveDraft, markPageSaved } from "@/app/utils/draftStorage";

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
  type: "7/12" | "PRC";
  extractCount: string;
  area: string;
  extracts: ExtractRow[];
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

const createPlot = (): PlotRow => ({
  id: uid(),
  plotNumber: ZERO_VALUE,
  plotName: "",
  ownerName: "",
  type: "7/12",
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
  const [plots, setPlots] = useState<PlotRow[]>([createPlot()]);
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
    const saved = loadDraft<PlotRow[]>("draft-area-details-plots", [createPlot()]);
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
    setPlots((prev) => [...prev, createPlot()]);
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
    console.log("Area Details:", plots);
    alert("Area details saved successfully!");
    markPageSaved("saved-area-details");
  };

  const inputClasses =
    "border border-black rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none";

  // Persist plots draft on change
  useEffect(() => {
    saveDraft("draft-area-details-plots", plots);
  }, [plots]);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      <section className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden">
        <div className="sticky top-0 z-10 bg-white border-b border-black p-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-black">Area Details</h2>
            <p className="text-sm text-black mt-1">
              Add plots and enter area for each extract of the plot. All areas are in sq. mtr.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
          >
            Save
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto pb-6">
          {plots.map((plot, plotIndex) => {
            const plotTotals = getPlotFieldTotals(plot);

            return (
            <div key={plot.id} className="border border-zinc-200 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border-b border-zinc-200 bg-zinc-50 rounded-t-lg">
                <div>
                  <label className="block font-medium text-black mb-1">Plot No.</label>
                  <input
                    value={plot.plotNumber}
                    onChange={(e) => handlePlotChange(plot.id, "plotNumber", e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">Name</label>
                  <input
                    value={plot.plotName}
                    onChange={(e) => handlePlotChange(plot.id, "plotName", e.target.value)}
                    className={inputClasses}
                    placeholder="Enter Plot Name"
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">Owner Name</label>
                  <input
                    value={plot.ownerName}
                    onChange={(e) => handlePlotChange(plot.id, "ownerName", e.target.value)}
                    className={inputClasses}
                    placeholder="Enter Owner Name"
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">Type</label>
                  <div className="flex items-center gap-4 h-10 border border-black rounded-lg px-3">
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
                <table className="w-full text-sm text-black">
                  <thead className="bg-zinc-100 border-b border-zinc-200 text-xs uppercase">
                    <tr>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">Extract no.</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">7/12 OR PRC AREA</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">ULC Area</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">B Form Area</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">Conveyance Area</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">Area in Power of Attorney</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">DILR Measuring Map</th>
                      <th className="border-r border-zinc-200 px-3 py-2 text-left">Least Area</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plot.extracts.map((extract, extractIndex) => (
                      <tr key={extract.id} className="border-b border-zinc-200">
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
                            value={extract.extractNo}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "extractNo", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
                            value={extract.prcArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "prcArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
                            value={extract.ulcArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "ulcArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
                            value={extract.bFormArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "bFormArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
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
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
                            value={extract.attorneyArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "attorneyArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1"
                            value={extract.dilrMapArea}
                            onChange={(e) =>
                              handleExtractChange(plot.id, extract.id, "dilrMapArea", e.target.value)
                            }
                          />
                        </td>
                        <td className="border-r border-zinc-200 px-3 py-2">
                          <input
                            className="w-full border border-zinc-300 rounded px-2 py-1 bg-zinc-100"
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
                    <tr className="bg-zinc-50 font-semibold">
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">Sub Plot Total</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.prcArea}</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.ulcArea}</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.bFormArea}</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.conveyanceArea}</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.attorneyArea}</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.dilrMapArea}</td>
                      <td className="border-r border-zinc-200 px-3 py-2 text-left">{plotTotals.leaseArea}</td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-6 p-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => addExtract(plot.id)}
                  className="text-sky-700 font-semibold hover:underline"
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
              className="text-sky-700 font-semibold hover:underline"
            >
              + Add Plot
            </button>
          </div>

          <div className="mt-6 border border-zinc-200 rounded-lg overflow-hidden">
            <div className="bg-zinc-50 px-4 py-3 font-semibold text-black">Plot Totals</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-black">
                <thead className="bg-white border-b border-zinc-200 uppercase text-xs">
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
                    <tr key={label} className="border-b border-zinc-100">
                      <td className="px-3 py-2 font-medium text-black">{label}</td>
                      <td className="px-3 py-2">{totals.prcArea}</td>
                      <td className="px-3 py-2">{totals.ulcArea}</td>
                      <td className="px-3 py-2">{totals.bFormArea}</td>
                      <td className="px-3 py-2">{totals.conveyanceArea}</td>
                      <td className="px-3 py-2">{totals.attorneyArea}</td>
                      <td className="px-3 py-2">{totals.dilrMapArea}</td>
                      <td className="px-3 py-2">{totals.leaseArea}</td>
                    </tr>
                  ))}
                  <tr className="bg-white font-semibold">
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

          <div className="border-t border-black pt-4">
            <div className="flex items-center justify-between text-black font-semibold">
              <span>Total</span>
              <span>{totalLeaseArea}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

