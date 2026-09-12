import "dotenv/config";
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { createParamsStore, type StoredParams } from "./params-store";

/**
 * Backend web WhatsAuto.
 *
 * Menyediakan:
 *   1. API parameter  → GET/PUT /api/params (sumber balasan selain spreadsheet)
 *   2. Halaman admin  → /admin (atur parameter lewat browser)
 *   3. Proxy Gemini   → POST /api/ai/reply (opsional)
 *   4. Static bundle  → dist/ (bila sudah di-build)
 *
 * Aplikasi Android memanggil API ini lewat HTTP native (tanpa CORS), sedangkan
 * browser dilayani header CORS di bawah.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "..");
const distDir = path.join(rootDir, "dist");
const adminPage = path.join(dirname, "admin.html");

const DEFAULT_PARAMS_FILE = path.join(rootDir, "server-data", "params.json");

export interface ServerOptions {
  paramsFile?: string;
}

export function createApp(options: ServerOptions = {}): Express {
  const store = createParamsStore(options.paramsFile ?? process.env.PARAMS_FILE ?? DEFAULT_PARAMS_FILE);
  const app = express();

  app.use(express.json({ limit: "2mb" }));

  // CORS: aplikasi web (origin preview/localhost) boleh memanggil API ini.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    const params = store.read();
    res.json({
      ok: true,
      time: new Date().toISOString(),
      rules: params.rules.length,
      updatedAt: params.updatedAt,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // ------------------------------------------------------------ parameter

  app.get("/api/params", (_req, res) => {
    res.json(store.read());
  });

  app.put("/api/params", (req, res) => {
    const saved = store.write(req.body as StoredParams);
    res.json({ ok: true, params: saved });
  });

  app.post("/api/params/rules", (req, res) => {
    const current = store.read();
    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    const saved = store.write({ ...current, rules: [...current.rules, ...incoming] });
    res.status(201).json({ ok: true, params: saved });
  });

  app.patch("/api/params/rules/:id", (req, res) => {
    const current = store.read();
    const patch = (req.body ?? {}) as Record<string, unknown>;
    const rules = current.rules.map((rule) =>
      rule.id === req.params.id ? { ...rule, ...patch, id: rule.id, source: "backend" as const } : rule,
    );
    if (!rules.some((rule) => rule.id === req.params.id)) {
      res.status(404).json({ ok: false, error: "Aturan tidak ditemukan." });
      return;
    }
    const saved = store.write({ ...current, rules });
    res.json({ ok: true, params: saved });
  });

  app.delete("/api/params/rules/:id", (req, res) => {
    const current = store.read();
    const rules = current.rules.filter((rule) => rule.id !== req.params.id);
    if (rules.length === current.rules.length) {
      res.status(404).json({ ok: false, error: "Aturan tidak ditemukan." });
      return;
    }
    const saved = store.write({ ...current, rules });
    res.json({ ok: true, params: saved });
  });

  // ------------------------------------------------------------------- AI

  let aiClient: GoogleGenAI | null = null;
  const getAiClient = (apiKey: string) => {
    if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
    return aiClient;
  };

  app.post("/api/ai/reply", async (req, res) => {
    const { message, sender, settings } = req.body as {
      message?: string;
      sender?: string;
      settings?: { apiKey?: string; model?: string; persona?: string };
    };
    const apiKey = settings?.apiKey?.trim() || process.env.GEMINI_API_KEY;
    if (!message || !apiKey) {
      res.status(400).json({ error: "Pesan dan API key wajib diisi." });
      return;
    }
    try {
      const response = await getAiClient(apiKey).models.generateContent({
        model: settings?.model?.trim() || "gemini-2.0-flash",
        contents: `Pengirim: ${sender ?? "pelanggan"}\nPesan: ${message}\nTulis satu balasan WhatsApp singkat.`,
        config: {
          systemInstruction:
            settings?.persona?.trim() || "Kamu asisten toko yang ramah. Jawab singkat dalam bahasa Indonesia.",
          temperature: 0.7,
        },
      });
      res.json({ replyText: response.text ?? "" });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "AI gagal menjawab." });
    }
  });

  // ---------------------------------------------------------- halaman admin

  app.get("/admin", (_req, res) => {
    fs.readFile(adminPage, "utf-8", (error, html) => {
      if (error) {
        res.status(500).send("admin.html tidak ditemukan");
        return;
      }
      res.type("html").send(html);
    });
  });

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get("/", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  } else {
    app.get("/", (_req, res) =>
      res
        .status(200)
        .type("html")
        .send(
          `<h1>WhatsAuto backend aktif</h1>
           <p>Halaman admin: <a href="/admin">/admin</a></p>
           <p>UI aplikasi: jalankan <code>npm run dev</code> atau <code>npm run build</code> lebih dulu.</p>`,
        ),
    );
  }

  return app;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, "0.0.0.0", () => {
    console.log(`[whatsauto] backend siap di http://localhost:${port}`);
    console.log(`[whatsauto] halaman admin: http://localhost:${port}/admin`);
  });
}
