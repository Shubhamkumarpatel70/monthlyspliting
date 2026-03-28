import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiConfig } from "../config/ai.js";

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

function isRateOrOverloadError(msg) {
  return /429|503|UNAVAILABLE|overloaded|quota|RESOURCE_EXHAUSTED|rate limit|too many requests/i.test(msg);
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

/**
 * Calls Gemini with JSON-only output. Retries with fallback models if the primary is unavailable.
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
      return await generateJsonOnce({ apiKey, model, system, user });
    } catch (err) {
      lastMsg = flattenGeminiError(err);
      console.error(`[gemini] model=${model}`, lastMsg);

      if (isRateOrOverloadError(lastMsg)) {
        throw new Error(
          "Gemini is rate-limited or busy. Wait a minute and try again.",
        );
      }

      const tryNext = isModelOrNotFoundError(lastMsg) && i < modelsToTry.length - 1;
      if (tryNext) continue;

      if (/API key|API_KEY|permission|401|403|invalid.*key/i.test(lastMsg)) {
        throw new Error(
          "Gemini API key rejected. Check GEMINI_API_KEY in your host (e.g. Render) environment.",
        );
      }

      throw new Error(lastMsg.length > 280 ? `${lastMsg.slice(0, 277)}…` : lastMsg);
    }
  }

  throw new Error(lastMsg || "Gemini request failed");
}
