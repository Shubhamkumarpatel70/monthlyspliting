import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiConfig } from "../config/ai.js";

function stripJsonFence(text) {
  if (!text || typeof text !== "string") return text;
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

/**
 * Calls Gemini with JSON-only output (system instruction + user text).
 */
export async function geminiChatJson({ system, user }) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (set GEMINI_API_KEY in .env).");
  }

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

  try {
    const result = await genModel.generateContent(user);
    const text = result.response.text();
    if (!text) throw new Error("Empty AI response");
    const raw = stripJsonFence(text);
    return JSON.parse(raw);
  } catch (err) {
    const msg =
      err?.message ||
      err?.errorDetails?.map((d) => d.message).join("; ") ||
      "Gemini request failed";
    throw new Error(msg);
  }
}
