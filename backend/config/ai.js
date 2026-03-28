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
    // e.g. gemini-2.0-flash, gemini-1.5-flash — see Google AI Studio model list
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  };
}

export function isAiConfigured() {
  return Boolean(getGeminiConfig().apiKey);
}
