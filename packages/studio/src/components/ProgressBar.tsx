"use client";

type Step = "upload" | "plan" | "review" | "merge";

const steps: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "plan", label: "Scene Plan" },
  { key: "review", label: "Review" },
  { key: "merge", label: "Merge" },
];

export function ProgressBar({ currentStep }: { currentStep: Step }) {
  const currentIdx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-1">
        {steps.map((s, i) => {
          const isActive = i <= currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div key={s.key} className="flex items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-red-600 text-white"
                    : "bg-neutral-800 text-neutral-500"
                } ${isCurrent ? "ring-2 ring-red-400 ring-offset-2 ring-offset-neutral-950" : ""}`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm ${
                  isActive ? "text-neutral-200" : "text-neutral-600"
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 h-px w-8 ${
                    i < currentIdx ? "bg-red-600" : "bg-neutral-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
