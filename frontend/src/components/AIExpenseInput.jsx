import React, { useState } from "react";
import { ai as aiApi } from "../api";

export default function AIExpenseInput({ groupId, onParsed, disabled }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleParse = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiApi.parseExpense({
        input: input.trim(),
        ...(groupId ? { groupId } : {}),
      });
      onParsed?.(res.parsed, input.trim());
    } catch (err) {
      setError(err.message || "Could not parse expense. Try again.");
    } finally {
      setLoading(false);
    }
  };

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
        disabled={loading || !input.trim() || disabled}
        className="w-full py-2.5 rounded-lg border border-primary/50 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Parsing…" : "Parse with AI"}
      </button>
      {error && (
        <div className="text-sm text-danger border border-danger/30 rounded-lg px-3 py-2 bg-danger/10">
          {error}
        </div>
      )}
    </div>
  );
}
