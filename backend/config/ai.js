/**
 * Google Gemini (Google AI Studio) — see https://aistudio.google.com/apikey
 * Put GEMINI_API_KEY in backend/.env — never commit real keys.
 *
 * Where AI output is stored:
 * - Parsed / suggested expenses: MongoDB `Expense` (`aiGenerated`, `aiRawInput`)
 * - Month summary: on demand only unless you add persistence
 */

export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY || "",
    // Default 1.5-flash: widely available on AI Studio keys; override with GEMINI_MODEL if needed
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  };
}

export function isAiConfigured() {
  return Boolean(getGeminiConfig().apiKey);
}
