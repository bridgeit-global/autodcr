import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
};

type CardHeaderProps = {
  children: ReactNode;
  className?: string;
};

type CardBodyProps = {
  children: ReactNode;
  className?: string;
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={[
        "rounded-xl border border-gray-100 bg-white shadow-sm",
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={["border-b border-gray-100 pb-4 mb-4", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={className}>{children}</div>;
}
