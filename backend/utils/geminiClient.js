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
  return /404|not found|NOT_FOUND|invalid model|model.*not (found|supported)|does not exist|is not supported|ListModels/i.test(
    msg,
  );
}

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

/** 429 / RPM — wait seconds between retries (Google dashboard shows TooManyRequests). */
function isRateLimitHeavy(msg) {
  if (!msg) return false;
  return /429|TooManyRequests|RESOURCE_EXHAUSTED|rate limit|too many requests|Quota exceeded for quota metric/i.test(
    msg,
  );
}

function isSoftTransient(msg) {
  if (!msg) return false;
  if (isModelOrNotFoundError(msg) || isInvalidApiKeyMessage(msg)) return false;
  return /503|504|UNAVAILABLE|overloaded|Deadline|deadline exceeded|timeout|ECONNRESET|ETIMEDOUT|\b500\b|internal error|try again later|temporarily/i.test(
    msg,
  );
}

function isRetryable(msg) {
  return isRateLimitHeavy(msg) || isSoftTransient(msg);
}

/** Milliseconds to wait *before* attempt `nextAttempt` (1-based, after a failure). */
function backoffMsFor(prevErrorMsg, nextAttempt) {
  if (isRateLimitHeavy(prevErrorMsg)) {
    // Spread calls across minutes so we don’t amplify 429s (see Google “Total API Errors” chart).
    if (nextAttempt === 2) return 8000 + Math.round(Math.random() * 2000);
    if (nextAttempt === 3) return 22000 + Math.round(Math.random() * 4000);
    return 45000 + Math.round(Math.random() * 5000);
  }
  if (isSoftTransient(prevErrorMsg)) {
    if (nextAttempt === 2) return 1400 + Math.round(Math.random() * 600);
    return 3200 + Math.round(Math.random() * 800);
  }
  return 2000;
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

/** Few attempts + long gaps on 429 — avoids stacking errors in the same minute. */
const MAX_ATTEMPTS = 3;

async function generateJsonOnceWithBackoff({ apiKey, model, system, user, maxOutputTokens }) {
  let lastErr;
  let lastMsg = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const wait = backoffMsFor(lastMsg, attempt);
      console.warn(`[gemini] waiting ${wait}ms before retry ${attempt}/${MAX_ATTEMPTS} (after: ${lastMsg.slice(0, 80)}…)`);
      await sleep(wait);
    }
    try {
      return await generateJsonOnce({ apiKey, model, system, user, maxOutputTokens });
    } catch (err) {
      lastErr = err;
      lastMsg = flattenGeminiError(err);
      console.error(`[gemini] model=${model} attempt=${attempt}/${MAX_ATTEMPTS}`, lastMsg);

      if (isModelOrNotFoundError(lastMsg)) {
        throw err;
      }
      if (isInvalidApiKeyMessage(lastMsg)) {
        throw err;
      }
      if (!isRetryable(lastMsg) || attempt >= MAX_ATTEMPTS) {
        throw err;
      }
    }
  }
  throw lastErr || new Error(lastMsg || "Gemini request failed");
}

/**
 * Fallbacks only if the primary model returns 404. Do not use `gemini-1.5-flash-8b` — it is not a valid
 * generateContent model ID (Google returns 404). See ListModels in AI Studio.
 */
const MODEL_FALLBACKS = ["gemini-1.5-pro", "gemini-2.0-flash"];

export async function geminiChatJson({ system, user, maxOutputTokens = 1024 }) {
  const { apiKey, model: configuredModel } = getGeminiConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (set GEMINI_API_KEY on the server).");
  }

  const seen = new Set();
  const modelsToTry = [];
  for (const m of [configuredModel, ...MODEL_FALLBACKS]) {
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
        console.warn(`[gemini] 404/model missing — trying next model: ${modelsToTry[i + 1]}`);
        continue;
      }

      if (isInvalidApiKeyMessage(lastMsg)) {
        throw new Error(
          "Gemini rejected the API key (wrong or revoked). Create a new key at https://aistudio.google.com/apikey and set GEMINI_API_KEY on your host (no extra spaces).",
        );
      }

      if (isRateLimitHeavy(lastMsg)) {
        throw new Error(
          "Gemini rate limit (429): too many requests per minute for your API key. Wait 1–2 minutes before using AI again, or upgrade quota in Google AI Studio. Avoid clicking Parse / Summary repeatedly.",
        );
      }

      if (isRetryable(lastMsg)) {
        throw new Error(
          `Gemini is still unavailable after ${MAX_ATTEMPTS} spaced attempts. ${lastMsg.slice(0, 200)}${lastMsg.length > 200 ? "…" : ""}`,
        );
      }

      throw new Error(lastMsg.length > 360 ? `${lastMsg.slice(0, 357)}…` : lastMsg);
    }
  }

  throw new Error(lastMsg || "Gemini request failed");
}
