/**
 * Google Gemini (Google AI Studio) — see https://aistudio.google.com/apikey
 * Put GEMINI_API_KEY in backend/.env — never commit real keys.
 * Trimmed automatically (Render/Vercel sometimes add stray spaces/newlines).
 *
 * Where AI output is stored:
 * - Parsed / suggested expenses: MongoDB `Expense` (`aiGenerated`, `aiRawInput`)
 * - Month summary: on demand only unless you add persistence
 */

/** IDs must match ListModels / AI Studio — `gemini-1.5-flash-8b` is not valid for generateContent (404). */
function resolveModelName(raw) {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return "gemini-1.5-flash";
  if (t === "gemini-1.5-flash-8b") return "gemini-1.5-flash";
  return t;
}

export function getGeminiConfig() {
  const raw = process.env.GEMINI_API_KEY || "";
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  const modelRaw = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  return {
    apiKey,
    model: resolveModelName(modelRaw),
  };
}

export function isAiConfigured() {
  return Boolean(getGeminiConfig().apiKey);
}
