"use client";

type AuthorityChip = {
  id: string;
  label: string;
  description?: string;
};

type AuthorityChipsProps = {
  authorities: AuthorityChip[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export default function AuthorityChips({
  authorities,
  selected,
  onToggle,
}: AuthorityChipsProps) {
  if (!authorities.length) {
    return <p className="text-sm text-gray-500">Loading authorities…</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {authorities.map((a) => {
        const active = selected.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            title={a.description || a.id}
            onClick={() => onToggle(a.id)}
            className={[
              "min-h-9 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:min-h-8 sm:px-3",
              active
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-brand-blue/40 hover:bg-blue-50",
            ].join(" ")}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
