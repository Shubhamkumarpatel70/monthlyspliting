import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiConfig } from "../config/ai.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripJsonFence(text) {
  if (!text || typeof text !== "string") return text;
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

function parseJsonFromModelText(text) {
  const raw = stripJsonFence(text);
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("AI returned invalid JSON. Try again.");
  }
}

function flattenGeminiError(err) {
  if (!err) return "Gemini request failed";
  const parts = [];
  if (err.message) parts.push(err.message);
  if (Array.isArray(err.errorDetails)) {
    err.errorDetails.forEach((d) => {
      if (d?.message) parts.push(d.message);
    });
  }
  const nested = err.cause || err.response?.data?.error;
  if (nested?.message) parts.push(nested.message);
  return parts.filter(Boolean).join(" — ") || "Gemini request failed";
}

function isModelOrNotFoundError(msg) {
  return /404|not found|NOT_FOUND|invalid model|model.*not (found|supported)|does not exist|is not supported/i.test(
    msg,
  );
}

/** Errors that often succeed if we wait and retry (burst limits, cold overload). */
function isRetryableGeminiError(msg) {
  if (!msg) return false;
  if (
    /not found|invalid model|does not exist|API key|401|403|invalid.*key|PERMISSION_DENIED|API_KEY_INVALID/i.test(
      msg,
    )
  ) {
    return false;
  }
  if (
    /429|503|504|UNAVAILABLE|overloaded|RESOURCE_EXHAUSTED|rate limit|too many requests|Deadline|deadline exceeded|timeout|ECONNRESET|ETIMEDOUT|\b500\b|internal error|try again later/i.test(
      msg,
    )
  ) {
    return true;
  }
  // Daily / billing quota — retry usually does not help
  if (/billing not enabled|exceeded your daily|quota.*0\b|limit: 0\b/i.test(msg)) {
    return false;
  }
  return false;
}

async function generateJsonOnce({ apiKey, model, system, user }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  const result = await genModel.generateContent(user);
  const text = result.response.text();
  if (!text || !String(text).trim()) {
    throw new Error("Empty AI response. Try again or shorten the text.");
  }
  return parseJsonFromModelText(text);
}

const RETRY_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [0, 900, 1900, 3500, 6000];

async function generateJsonOnceWithBackoff({ apiKey, model, system, user }) {
  let lastErr;
  let lastMsg = "";
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? 4000;
    if (attempt > 0) {
      const jitter = 0.85 + Math.random() * 0.25;
      await sleep(Math.round(delay * jitter));
    }
    try {
      return await generateJsonOnce({ apiKey, model, system, user });
    } catch (err) {
      lastErr = err;
      lastMsg = flattenGeminiError(err);
      console.error(`[gemini] model=${model} attempt=${attempt + 1}/${RETRY_ATTEMPTS}`, lastMsg);

      if (isModelOrNotFoundError(lastMsg)) {
        throw err;
      }
      if (/API key|API_KEY|401|403|invalid.*key/i.test(lastMsg)) {
        throw err;
      }

      if (isRetryableGeminiError(lastMsg) && attempt < RETRY_ATTEMPTS - 1) {
        console.warn(`[gemini] retrying after transient error (${attempt + 1}/${RETRY_ATTEMPTS})`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error(lastMsg || "Gemini request failed");
}

/**
 * Calls Gemini with JSON-only output. Retries transient limits with backoff; tries fallback models if needed.
 */
export async function geminiChatJson({ system, user }) {
  const { apiKey, model: configuredModel } = getGeminiConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (set GEMINI_API_KEY on the server).");
  }

  const fallbacks = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
  const seen = new Set();
  const modelsToTry = [];
  for (const m of [configuredModel, ...fallbacks]) {
    if (m && !seen.has(m)) {
      seen.add(m);
      modelsToTry.push(m);
    }
  }

  let lastMsg = "";
  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      return await generateJsonOnceWithBackoff({ apiKey, model, system, user });
    } catch (err) {
      lastMsg = flattenGeminiError(err);
      console.error(`[gemini] model=${model} failed after retries`, lastMsg);

      const tryNextModel = isModelOrNotFoundError(lastMsg) && i < modelsToTry.length - 1;
      if (tryNextModel) continue;

      if (/API key|API_KEY|permission|401|403|invalid.*key/i.test(lastMsg)) {
        throw new Error(
          "Gemini API key rejected. Check GEMINI_API_KEY in your host (e.g. Render) environment.",
        );
      }

      if (isRetryableGeminiError(lastMsg)) {
        throw new Error(
          "Gemini is still busy or rate-limited after several retries. Wait a few minutes and try again, or check your Google AI quota / billing.",
        );
      }

      throw new Error(lastMsg.length > 320 ? `${lastMsg.slice(0, 317)}…` : lastMsg);
    }
  }

  throw new Error(lastMsg || "Gemini request failed");
}
