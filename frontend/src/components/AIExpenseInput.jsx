import React, { useState } from "react";
import { ai as aiApi } from "../api";
import { useAiCooldown } from "../hooks/useAiCooldown";

export default function AIExpenseInput({ groupId, onParsed, disabled }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { onCooldown, remainingSec, startCooldown } = useAiCooldown(45_000);

  const handleParse = async () => {
    if (onCooldown) return;
    setLoading(true);
    setError("");
    try {
      const res = await aiApi.parseExpense({
        input: input.trim(),
        ...(groupId ? { groupId } : {}),
      });
      onParsed?.(res.parsed, input.trim());
      startCooldown(45_000);
    } catch (err) {
      const msg = err.message || "Could not parse expense. Try again.";
      setError(msg);
      if (/429|rate limit|too many/i.test(msg)) {
        startCooldown(90_000);
      } else {
        startCooldown(30_000);
      }
    } finally {
      setLoading(false);
    }
  };

  const buttonBlocked = disabled || loading || onCooldown;

  return (
    <div className="rounded-xl border border-white/10 bg-darkBg/40 p-4 space-y-3">
      <p className="text-sm text-textSecondary">
        Describe the expense in plain language — we&apos;ll fill the form for you.
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        disabled={disabled || loading}
        placeholder='e.g. I paid 1200 for pizza with Rahul and Aman'
        className="w-full px-3 py-2.5 rounded-lg bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-y min-h-[4.5rem]"
      />
      <button
        type="button"
        onClick={handleParse}
        disabled={buttonBlocked || !input.trim()}
        className="w-full py-2.5 rounded-lg border border-primary/50 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Parsing…"
          : onCooldown
            ? `Wait ${remainingSec}s (rate limit protection)`
            : "Parse with AI"}
      </button>
      {onCooldown && !loading && (
        <p className="text-xs text-textSecondary">
          The AI provider limits how often you can call the API. Short pause avoids errors.
        </p>
      )}
      {error && (
        <div className="text-sm text-danger border border-danger/30 rounded-lg px-3 py-2 bg-danger/10">
          {error}
        </div>
      )}
    </div>
  );
}
