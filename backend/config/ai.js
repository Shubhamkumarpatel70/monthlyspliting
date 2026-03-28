/**
 * Groq — OpenAI-compatible chat API (https://console.groq.com/keys)
 * Put GROQ_API_KEY in backend/.env — never commit real keys.
 *
 * Where AI output is stored:
 * - Parsed / suggested expenses: MongoDB `Expense` (`aiGenerated`, `aiRawInput`)
 * - Month summary: on demand only unless you add persistence
 */

export function getGroqConfig() {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  const model = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
  const apiUrl = (
    process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions"
  ).trim();
  return { apiKey, model, apiUrl };
}

export function isAiConfigured() {
  return Boolean(getGroqConfig().apiKey);
}
