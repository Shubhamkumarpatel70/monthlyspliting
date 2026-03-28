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

/** Only switch to another model when this name is wrong / not enabled for the key. */
function isModelOrNotFoundError(msg) {
  return /404|not found|NOT_FOUND|invalid model|model.*not (found|supported)|does not exist|is not supported|ListModels/i.test(
    msg,
  );
}

/**
 * True only when the key itself is wrong or missing — NOT generic 403 (quota/billing often use 403 too).
 */
function isInvalidApiKeyMessage(msg) {
  if (!msg) return false;
  if (/API_KEY_INVALID|INCORRECT_API_KEY|invalid authentication credentials|No API.?KEY|api key is missing|must pass an API key/i.test(msg)) {
    return true;
  }
  if (/Incorrect API key|API key not valid|invalid api key|not a valid API key/i.test(msg)) {
    return true;
  }
  if (/\[401\b/.test(msg) || /\b401\b[^\d]*Unauthorized/i.test(msg)) {
    return true;
  }
  return false;
}

function isRetryableGeminiError(msg) {
  if (!msg) return false;
  if (isModelOrNotFoundError(msg) || isInvalidApiKeyMessage(msg)) return false;
  if (/billing not enabled|exceeded your daily|quota.*0\b|limit: 0\b/i.test(msg)) return false;
  if (
    /429|503|504|UNAVAILABLE|overloaded|RESOURCE_EXHAUSTED|rate limit|too many requests|Quota exceeded|quota metric|Deadline|deadline exceeded|timeout|ECONNRESET|ETIMEDOUT|\b500\b|internal error|try again later|temporarily|PERMISSION_DENIED.*quota/i.test(
      msg,
    )
  ) {
    return true;
  }
  // Some Gemini errors only say PERMISSION_DENIED with consumer quota — still worth retrying once
  if (/PERMISSION_DENIED/i.test(msg) && /GenerateContent|generativelanguage/i.test(msg)) {
    return true;
  }
  return false;
}

async function generateJsonOnce({ apiKey, model, system, user, maxOutputTokens }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens,
    },
  });

  const result = await genModel.generateContent(user);
  const text = result.response.text();
  if (!text || !String(text).trim()) {
    throw new Error("Empty AI response. Try again or shorten the text.");
  }
  return parseJsonFromModelText(text);
}

const RETRY_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [0, 1200, 2800, 5500];

async function generateJsonOnceWithBackoff({ apiKey, model, system, user, maxOutputTokens }) {
  let lastErr;
  let lastMsg = "";
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? 5000;
    if (attempt > 0) {
      const jitter = 0.88 + Math.random() * 0.2;
      await sleep(Math.round(delay * jitter));
    }
    try {
      return await generateJsonOnce({ apiKey, model, system, user, maxOutputTokens });
    } catch (err) {
      lastErr = err;
      lastMsg = flattenGeminiError(err);
      console.error(`[gemini] model=${model} attempt=${attempt + 1}/${RETRY_ATTEMPTS}`, lastMsg);

      if (isModelOrNotFoundError(lastMsg)) {
        throw err;
      }
      if (isInvalidApiKeyMessage(lastMsg)) {
        throw err;
      }

      if (isRetryableGeminiError(lastMsg) && attempt < RETRY_ATTEMPTS - 1) {
        console.warn(`[gemini] retrying transient error (${attempt + 1}/${RETRY_ATTEMPTS})`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error(lastMsg || "Gemini request failed");
}

/**
 * Calls Gemini with JSON-only output.
 * - Retries transient limits with backoff on **one** model (does not burn quota cycling models).
 * - Tries fallback models **only** when the error is clearly “model not found / not supported”.
 */
export async function geminiChatJson({ system, user, maxOutputTokens = 1024 }) {
  const { apiKey, model: configuredModel } = getGeminiConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (set GEMINI_API_KEY on the server).");
  }

  const fallbacks = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.0-flash"];
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
      return await generateJsonOnceWithBackoff({
        apiKey,
        model,
        system,
        user,
        maxOutputTokens,
      });
    } catch (err) {
      lastMsg = flattenGeminiError(err);
      console.error(`[gemini] model=${model} failed`, lastMsg);

      const tryNextModel = isModelOrNotFoundError(lastMsg) && i < modelsToTry.length - 1;
      if (tryNextModel) {
        console.warn(`[gemini] switching model after not-found: ${modelsToTry[i + 1]}`);
        continue;
      }

      if (isInvalidApiKeyMessage(lastMsg)) {
        throw new Error(
          "Gemini rejected the API key (wrong or revoked). Create a new key at https://aistudio.google.com/apikey and set GEMINI_API_KEY on your host (no extra spaces).",
        );
      }

      if (isRetryableGeminiError(lastMsg)) {
        throw new Error(
          `Gemini is busy or your quota is tight after ${RETRY_ATTEMPTS} attempts. Wait 2–5 minutes, reduce how often you click AI actions, or check usage limits in Google AI Studio. Details: ${lastMsg.slice(0, 220)}${lastMsg.length > 220 ? "…" : ""}`,
        );
      }

      throw new Error(lastMsg.length > 360 ? `${lastMsg.slice(0, 357)}…` : lastMsg);
    }
  }

  throw new Error(lastMsg || "Gemini request failed");
}
