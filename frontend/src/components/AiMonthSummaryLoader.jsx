import React from "react";

/**
 * Shown while the month-summary API runs — suggests “AI is generating”.
 */
export default function AiMonthSummaryLoader() {
  return (
    <div
      className="mt-4 rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent p-4 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-1 flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-35" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary shadow-[0_0_14px_rgba(34,211,238,0.55)] animate-ai-pulse-glow" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary tracking-tight">
            Generating your summary
          </p>
          <p className="text-xs text-textSecondary mt-0.5">
            AI is reading expenses, categories, and balances…
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {[92, 100, 78, 88, 64].map((widthPct, i) => (
          <div
            key={i}
            className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.08]"
            style={{ width: `${widthPct}%` }}
          >
            <div
              className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-primary/45 to-transparent animate-ai-shimmer"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
