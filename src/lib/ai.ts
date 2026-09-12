import { httpText } from "./http";
import type { AiSettings, IncomingMessage } from "./types";

/** Balasan AI opsional (Gemini) untuk pesan yang tidak cocok aturan apa pun. */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function buildPrompt(message: IncomingMessage): string {
  return [
    `Pengirim: ${message.sender}`,
    `Pesan masuk: ${message.text}`,
    "Tugas: tulis satu balasan WhatsApp singkat (maks 2 kalimat) yang bisa langsung dikirim.",
  ].join("\n");
}

interface GenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export async function generateAiReply(
  settings: AiSettings,
  message: IncomingMessage,
): Promise<{ ok: boolean; text: string; error?: string }> {
  if (!settings.enabled || !settings.apiKey.trim()) {
    return { ok: false, text: "", error: "AI belum dikonfigurasi (API key kosong)." };
  }

  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(message) }] }],
    systemInstruction: { parts: [{ text: settings.persona }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
  });

  const direct = await httpText(`${ENDPOINT}/${settings.model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": settings.apiKey.trim(),
    },
    body: payload,
  });

  if (direct.ok) {
    try {
      const parsed = JSON.parse(direct.body) as GenerateResponse;
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      if (text) return { ok: true, text };
      return { ok: false, text: "", error: parsed.error?.message ?? "Respons AI kosong." };
    } catch {
      return { ok: false, text: "", error: "Respons AI tidak valid." };
    }
  }

  // Cadangan untuk mode web: lewat proxy server dev (menghindari CORS).
  const proxied = await httpText("/api/ai/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message.text, sender: message.sender, settings }),
  });

  if (proxied.ok) {
    try {
      const parsed = JSON.parse(proxied.body) as { replyText?: string };
      if (parsed.replyText) return { ok: true, text: parsed.replyText };
    } catch {
      /* jatuh ke error di bawah */
    }
  }

  return {
    ok: false,
    text: "",
    error: direct.error ?? `Gemini menolak permintaan (status ${direct.status}).`,
  };
}
