import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-blue text-white hover:bg-brand-blue-hover shadow-sm hover:shadow-md",
  secondary:
    "border border-brand-blue text-brand-blue bg-white hover:bg-blue-50",
  ghost: "text-gray-600 hover:text-brand-blue hover:bg-gray-50",
  danger: "bg-status-danger text-white hover:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg min-h-9",
  md: "px-4 py-2.5 text-sm rounded-lg min-h-11 sm:min-h-10",
  lg: "px-6 py-3 text-base rounded-xl min-h-12",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center font-semibold transition-all",
        "focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";

export default Button;
