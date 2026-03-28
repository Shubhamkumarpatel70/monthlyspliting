/**
 * Google Gemini (Google AI Studio) — see https://aistudio.google.com/apikey
 * Put GEMINI_API_KEY in backend/.env — never commit real keys.
 * Trimmed automatically (Render/Vercel sometimes add stray spaces/newlines).
 *
 * Where AI output is stored:
 * - Parsed / suggested expenses: MongoDB `Expense` (`aiGenerated`, `aiRawInput`)
 * - Month summary: on demand only unless you add persistence
 */

export function getGeminiConfig() {
  const raw = process.env.GEMINI_API_KEY || "";
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  const modelRaw = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  return {
    apiKey,
    model: typeof modelRaw === "string" ? modelRaw.trim() : "gemini-1.5-flash",
  };
}

export function isAiConfigured() {
  return Boolean(getGeminiConfig().apiKey);
}
