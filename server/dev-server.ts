import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

/**
 * Server opsional untuk mode web.
 *
 * Aplikasi Android tidak membutuhkannya — semua data tersimpan di perangkat dan
 * sheet dibaca langsung. Server ini hanya:
 *   1. proxy Gemini (menghindari CORS / menyembunyikan API key), dan
 *   2. penyaji bundle produksi (dist/).
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "..");
const distDir = path.join(rootDir, "dist");

interface AiSettingsDto {
  enabled?: boolean;
  mode?: "fallback" | "always";
  apiKey?: string;
  model?: string;
  persona?: string;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

let client: GoogleGenAI | null = null;
function getClient(apiKey: string): GoogleGenAI {
  if (!client || (process.env.GEMINI_API_KEY && apiKey !== process.env.GEMINI_API_KEY)) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

app.post("/api/ai/reply", async (req, res) => {
  const { message, sender, settings } = req.body as {
    message?: string;
    sender?: string;
    settings?: AiSettingsDto;
  };

  const apiKey = settings?.apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!message || !apiKey) {
    res.status(400).json({ error: "Pesan dan API key wajib diisi." });
    return;
  }

  try {
    const ai = getClient(apiKey);
    const response = await ai.models.generateContent({
      model: settings?.model?.trim() || "gemini-2.0-flash",
      contents: `Pengirim: ${sender ?? "pelanggan"}\nPesan: ${message}\nTulis satu balasan WhatsApp singkat.`,
      config: {
        systemInstruction:
          settings?.persona?.trim() ||
          "Kamu asisten toko yang ramah. Jawab singkat dalam bahasa Indonesia.",
        temperature: 0.7,
      },
    });
    res.json({ replyText: response.text ?? "" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    res.status(502).json({ error: detail });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res.status(200).send("Jalankan <code>npm run build</code> lebih dulu, atau pakai <code>npm run dev</code>."),
  );
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, "0.0.0.0", () => {
  console.log(`[whatsauto] server dev siap di http://localhost:${port}`);
});
