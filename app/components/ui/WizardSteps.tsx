"use client";

import { Check } from "lucide-react";

export type WizardStep = {
  id: string;
  label: string;
};

type WizardStepsProps = {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
};

export default function WizardSteps({
  steps,
  currentStep,
  onStepClick,
  className = "",
}: WizardStepsProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center gap-1 overflow-x-auto sm:gap-2">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = Boolean(onStepClick);

          return (
            <li key={step.id} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={isClickable ? () => onStepClick?.(index) : undefined}
                disabled={!isClickable}
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm transition-colors",
                  isCurrent
                    ? "bg-blue-50 font-semibold text-sky-600"
                    : isComplete
                      ? "font-medium text-sky-700/80 hover:text-sky-600"
                      : "font-medium text-gray-400",
                  isClickable ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold lowercase",
                    isCurrent
                      ? "bg-sky-500 text-white"
                      : isComplete
                        ? "bg-sky-100 text-sky-600"
                        : "border border-gray-300 bg-white text-gray-400",
                  ].join(" ")}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(97 + index)}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </button>

              {index !== steps.length - 1 && (
                <span
                  className={[
                    "mx-2 hidden h-px w-8 sm:block lg:mx-3 lg:w-12",
                    isComplete ? "bg-sky-200" : "bg-gray-200",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
