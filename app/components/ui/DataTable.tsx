import { type ReactNode } from "react";
import Badge from "./Badge";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  badge?: (row: T) => { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" };
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  emptyMessage?: string;
  className?: string;
};

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = "No data available",
  className = "",
}: DataTableProps<T>) {
  return (
    <div className={["overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm", className].join(" ")}>
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={String(row[keyField])} className="hover:bg-gray-50/50 transition-colors">
                {columns.map((col) => {
                  const badge = col.badge?.(row);
                  return (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                      {badge ? (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      ) : col.render ? (
                        col.render(row)
                      ) : (
                        String(row[col.key] ?? "")
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
