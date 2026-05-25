import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to ensure database files exist or get default fallback path
  const getFilePath = (filename: string) => path.join(__dirname, "src/data", filename);

  // Generic data loader
  const loadJSONFile = async (filename: string, fallback: any) => {
    try {
      const data = await fs.readFile(getFilePath(filename), "utf-8");
      return JSON.parse(data);
    } catch (e) {
      return fallback;
    }
  };

  // Generic data saver
  const saveJSONFile = async (filename: string, data: any) => {
    await fs.writeFile(getFilePath(filename), JSON.stringify(data, null, 2), "utf-8");
  };

  // API Paths for WhatsAuto
  app.get("/api/whatsauto/data", async (req, res) => {
    try {
      const rules = await loadJSONFile("whatsauto-rules.json", []);
      const contacts = await loadJSONFile("whatsauto-contacts.json", { selectedOption: "Everyone", whitelist: [], blacklist: [], groups: [] });
      const spreadsheets = await loadJSONFile("whatsauto-spreadsheets.json", []);
      const settings = await loadJSONFile("whatsauto-settings.json", {});
      const history = await loadJSONFile("whatsauto-history.json", []);
      
      res.json({ rules, contacts, spreadsheets, settings, history });
    } catch (error) {
      res.status(500).json({ error: "Failed to load database files" });
    }
  });

  app.post("/api/whatsauto/rules", async (req, res) => {
    try {
      const { rules } = req.body;
      await saveJSONFile("whatsauto-rules.json", rules);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save rules" });
    }
  });

  app.post("/api/whatsauto/contacts", async (req, res) => {
    try {
      const { contacts } = req.body;
      await saveJSONFile("whatsauto-contacts.json", contacts);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save contacts" });
    }
  });

  app.post("/api/whatsauto/spreadsheets", async (req, res) => {
    try {
      const { spreadsheets } = req.body;
      await saveJSONFile("whatsauto-spreadsheets.json", spreadsheets);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save spreadsheet data" });
    }
  });

  app.post("/api/whatsauto/settings", async (req, res) => {
    try {
      const { settings } = req.body;
      await saveJSONFile("whatsauto-settings.json", settings);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save app settings" });
    }
  });

  app.post("/api/whatsauto/history", async (req, res) => {
    try {
      const { logEntry } = req.body;
      const history = await loadJSONFile("whatsauto-history.json", []);
      
      const newEntry = {
        id: `t_${Date.now()}`,
        ...logEntry,
        timestamp: new Date().toISOString()
      };
      
      history.push(newEntry);
      await saveJSONFile("whatsauto-history.json", history);
      res.json({ success: true, entry: newEntry });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert transaction log" });
    }
  });

  app.post("/api/whatsauto/clear-logs", async (req, res) => {
    try {
      await saveJSONFile("whatsauto-history.json", []);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset transaction logs" });
    }
  });

  // Lazy initialization of Gemini client to prevent crashing on startup when api key is not yet configured
  let aiClient: GoogleGenAI | null = null;
  const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY server-side environment variable is missing.");
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  };

  app.post("/api/whatsauto/gemini", async (req, res) => {
    try {
      const { text, sender, profile = {} } = req.body;
      
      const ownerName = profile.ownerName || "Budi";
      const businessNiche = profile.businessNiche || "Konsultan Jasa Kreatif";
      const obstacleStatus = profile.obstacleStatus || "Sedang melayani klien di kantor";
      const speakingStyle = profile.speakingStyle || "Ramah, sopan, sedikit santai";
      const promoInfo = profile.promoInfo || "Diskon 5% untuk klien baru minggu ini";
      const marketingGoal = profile.marketingGoal || "Mendapatkan nomor telepon atau mengajak mereka menjadwalkan konsultasi gratis";

      const systemInstruction = `Anda adalah asisten otomatis pintar yang berpura-pura menjadi ${ownerName} atau asisten pribadinya secara alami tanpa terlihat kaku atau formal seperti bot asisten biasa.
Peran/Bidang Usaha Anda: ${businessNiche}
Status aktivitas/kesibukan Anda saat ini: ${obstacleStatus}
Gaya berbicara yang diinginkan: ${speakingStyle}
Informasi Promo produk/layanan: ${promoInfo}
Tujuan Marketing & Call to Action (CTA): ${marketingGoal}

ATURAN STRUKTURAL UTAMA ("ANTI-AI SLOP / BEBAS JARGON BOT FORMAL"):
1. JANGAN PERNAH menyertakan kalimat pembuka bertipe robot seperti "Halo! Saya adalah asisten AI Anda...", "Tentu, dengan senang hati...", "Ada yang bisa saya bantu sebagai asisten digital...", atau salam formal bersablon AI lainnya.
2. Jelas, ringkas, dan serealistis mungkin seperti manusia asli yang sedang membalas chat teks cepat (tidak terlalu bertele-tele, hindari daftar nomor/poin panjang berlebihan kecuali sangat dibutuhkan). Gunakan emoji secara wajar.
3. Gunakan bahasa Indonesia natural yang hangat, bersahabat, dan manusiawi sesuai dengan gaya bicara: "${speakingStyle}".
4. Berikan respon langsung dan praktis terhadap pesan pengguna berikut.`;

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: text,
        config: {
          systemInstruction,
          temperature: 0.8,
        }
      });

      const replyText = response.text || "Halo! Mohon maaf sedang sibuk, nanti kami kabari lagi ya.";
      res.json({ success: true, replyText });
    } catch (error: any) {
      console.error("Gemini API Error in endpoint:", error);
      res.status(500).json({ error: error.message || "Gemini AI pipeline failed to reply." });
    }
  });

  // Legacy fallback compatibility check for index or specific triggers
  app.get("/api/data", async (req, res) => {
    try {
      const subjectBank = await loadJSONFile("subject-bank.json", []);
      const antiRepetition = await loadJSONFile("anti-repetition.json", {});
      const history = await loadJSONFile("history.json", []);
      res.json({ subjectBank, antiRepetition, history });
    } catch (error) {
      res.status(500).json({ error: "Failed to load legacy data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
