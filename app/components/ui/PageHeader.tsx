import { type ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={["mb-6", className].filter(Boolean).join(" ")}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-brand-blue transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-gray-900">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
