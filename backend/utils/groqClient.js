import { getGroqConfig } from "../config/ai.js";

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

function flattenError(err) {
  if (!err) return "Groq request failed";
  return String(err.message || err).trim() || "Groq request failed";
}

function isModelOrNotFoundError(msg) {
  return /404|not found|model.*not exist|invalid model|does not exist|unknown model|No such model/i.test(
    msg,
  );
}

function isInvalidApiKeyMessage(msg) {
  if (!msg) return false;
  if (/invalid.?api.?key|incorrect api key|invalid_api_key|401|Unauthorized|authentication/i.test(msg)) {
    return true;
  }
  return false;
}

function isRateLimitHeavy(msg) {
  if (!msg) return false;
  return /429|Too Many Requests|rate limit|too many requests|tokens per minute|TPM|RPM/i.test(msg);
}

function isSoftTransient(msg) {
  if (!msg) return false;
  if (isModelOrNotFoundError(msg) || isInvalidApiKeyMessage(msg)) return false;
  return /503|504|502|overloaded|timeout|ECONNRESET|ETIMEDOUT|\b500\b|internal error|try again later|temporarily|unavailable/i.test(
    msg,
  );
}

function isRetryable(msg) {
  return isRateLimitHeavy(msg) || isSoftTransient(msg);
}

function backoffMsFor(prevErrorMsg, nextAttempt) {
  if (isRateLimitHeavy(prevErrorMsg)) {
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

async function postGroq({
  apiKey,
  model,
  apiUrl,
  system,
  user,
  maxOutputTokens,
  jsonMode,
}) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: Math.min(Math.max(64, maxOutputTokens || 1024), 8192),
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
    const e = new Error(msg);
    e.statusCode = res.status;
    throw e;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    throw new Error("Empty AI response");
  }
  return parseJsonFromModelText(content);
}

async function generateJsonOnce({ apiKey, model, apiUrl, system, user, maxOutputTokens }) {
  try {
    return await postGroq({
      apiKey,
      model,
      apiUrl,
      system,
      user,
      maxOutputTokens,
      jsonMode: true,
    });
  } catch (err) {
    const msg = flattenError(err);
    const code = err.statusCode;
    if (
      code === 400 &&
      /response_format|json_object|unknown parameter|not support/i.test(msg)
    ) {
      return await postGroq({
        apiKey,
        model,
        apiUrl,
        system,
        user,
        maxOutputTokens,
        jsonMode: false,
      });
    }
    throw err;
  }
}

const MAX_ATTEMPTS = 3;

async function generateJsonOnceWithBackoff({
  apiKey,
  model,
  apiUrl,
  system,
  user,
  maxOutputTokens,
}) {
  let lastErr;
  let lastMsg = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const wait = backoffMsFor(lastMsg, attempt);
      console.warn(
        `[groq] waiting ${wait}ms before retry ${attempt}/${MAX_ATTEMPTS} (after: ${lastMsg.slice(0, 80)}…)`,
      );
      await sleep(wait);
    }
    try {
      return await generateJsonOnce({
        apiKey,
        model,
        apiUrl,
        system,
        user,
        maxOutputTokens,
      });
    } catch (err) {
      lastErr = err;
      lastMsg = flattenError(err);
      console.error(`[groq] model=${model} attempt=${attempt}/${MAX_ATTEMPTS}`, lastMsg);

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
  throw lastErr || new Error(lastMsg || "Groq request failed");
}

/** If primary model 404s, try common Groq model ids (see console.groq.com/docs/models). */
const MODEL_FALLBACKS = ["llama-3.1-8b-instant", "mixtral-8x7b-32768"];

/**
 * OpenAI-compatible JSON chat via Groq.
 */
export async function groqChatJson({ system, user, maxOutputTokens = 1024 }) {
  const { apiKey, model: configuredModel, apiUrl } = getGroqConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (set GROQ_API_KEY on the server).");
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
        apiUrl,
        system,
        user,
        maxOutputTokens,
      });
    } catch (err) {
      lastMsg = flattenError(err);
      console.error(`[groq] model=${model} failed`, lastMsg);

      const tryNextModel = isModelOrNotFoundError(lastMsg) && i < modelsToTry.length - 1;
      if (tryNextModel) {
        console.warn(`[groq] model missing — trying: ${modelsToTry[i + 1]}`);
        continue;
      }

      if (isInvalidApiKeyMessage(lastMsg)) {
        throw new Error(
          "Groq rejected the API key. Create a key at https://console.groq.com/keys and set GROQ_API_KEY on your host (no extra spaces).",
        );
      }

      if (isRateLimitHeavy(lastMsg)) {
        throw new Error(
          "Groq rate limit (429): too many requests per minute. Wait 1–2 minutes or upgrade limits at console.groq.com. Avoid clicking Parse / Summary repeatedly.",
        );
      }

      if (isRetryable(lastMsg)) {
        throw new Error(
          `Groq still unavailable after ${MAX_ATTEMPTS} attempts. ${lastMsg.slice(0, 200)}${lastMsg.length > 200 ? "…" : ""}`,
        );
      }

      throw new Error(lastMsg.length > 360 ? `${lastMsg.slice(0, 357)}…` : lastMsg);
    }
  }

  throw new Error(lastMsg || "Groq request failed");
}
