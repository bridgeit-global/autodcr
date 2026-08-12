import { Check } from "lucide-react";

export type StepperStep = {
  label: string;
  description?: string;
};

type StepperProps = {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
};

export default function Stepper({ steps, currentStep, className = "" }: StepperProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li
              key={step.label}
              className={["relative flex-1", index !== steps.length - 1 ? "pr-8 sm:pr-16" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {index !== steps.length - 1 && (
                <div
                  className="absolute left-0 top-4 -mr-px h-0.5 w-full translate-x-1/2 bg-gray-200"
                  aria-hidden="true"
                >
                  <div
                    className={[
                      "h-full transition-all",
                      isComplete ? "w-full bg-brand-blue" : "w-0",
                    ].join(" ")}
                  />
                </div>
              )}

              <div className="relative flex flex-col items-center group">
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    isComplete
                      ? "bg-brand-blue text-white"
                      : isCurrent
                        ? "border-2 border-brand-blue bg-white text-brand-blue"
                        : "border-2 border-gray-200 bg-white text-gray-400",
                  ].join(" ")}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={[
                    "mt-2 text-xs font-medium text-center hidden sm:block",
                    isCurrent ? "text-brand-blue" : isComplete ? "text-gray-900" : "text-gray-400",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
