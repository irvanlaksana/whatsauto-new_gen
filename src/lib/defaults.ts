import type { AppSettings, ContactEntry, ReplyProgram, ReplyRule } from "./types";

export const PROGRAM_VERSION = 3;

export function defaultSettings(): AppSettings {
  return {
    autoReplyEnabled: true,
    welcomeMessage:
      "Halo {sender}, terima kasih sudah menghubungi kami 🙏\nKetik *menu* untuk melihat daftar layanan.",
    defaultReply:
      "Maaf {sender}, pesan kamu belum kami kenali. Ketik *menu* atau tunggu admin membalas ya.",
    cooldownMinutes: 2,
    replyDelayMs: 800,
    activeHours: { mode: "always", start: "08:00", end: "22:00" },
    contactPolicy: "everyone",
    replyToGroups: false,
    channels: ["whatsapp", "whatsapp_business"],
    ai: {
      enabled: false,
      mode: "fallback",
      apiKey: "",
      model: "gemini-2.0-flash",
      persona:
        "Kamu asisten toko yang ramah, jawab singkat dalam bahasa Indonesia, jangan mengaku sebagai bot.",
    },
  };
}

export function emptyProgram(): ReplyProgram {
  return {
    version: PROGRAM_VERSION,
    generatedAt: new Date().toISOString(),
    settings: defaultSettings(),
    rules: [],
    whitelist: [],
    blacklist: [],
  };
}

export function rule(partial: Partial<ReplyRule> & { keyword: string; reply: string }): ReplyRule {
  return {
    id: partial.id ?? `manual_${Math.random().toString(36).slice(2, 10)}`,
    keyword: partial.keyword,
    matchType: partial.matchType ?? "contains",
    reply: partial.reply,
    active: partial.active ?? true,
    delayMs: partial.delayMs ?? null,
    priority: partial.priority ?? 0,
    channels: partial.channels ?? [],
    source: partial.source ?? "manual",
    row: partial.row,
    note: partial.note,
    extra: partial.extra ?? {},
  };
}

/** Contoh aturan bawaan agar aplikasi langsung bisa dicoba. */
export function seedRules(): ReplyRule[] {
  return [
    rule({
      id: "seed_menu",
      keyword: "menu",
      matchType: "contains",
      reply:
        "Halo {sender}! Ini daftar layanan kami:\n1. Cek harga\n2. Jam operasional\n3. Alamat toko\n4. Bicara dengan admin\n\nBalas dengan angka ya.",
      priority: 10,
    }),
    rule({
      id: "seed_harga",
      keyword: "harga",
      matchType: "contains",
      reply:
        "Untuk harga {produk}, saat ini Rp {harga}. Ada promo gratis ongkir sampai {tanggal_promo} 🎉",
      priority: 5,
      extra: { produk: "paket standar", harga: "150.000", tanggal_promo: "akhir bulan" },
    }),
    rule({
      id: "seed_jam",
      keyword: "jam",
      matchType: "contains",
      reply: "Toko buka setiap hari pukul 08.00 - 22.00 WIB.",
    }),
    rule({
      id: "seed_alamat",
      keyword: "alamat",
      matchType: "contains",
      reply: "Alamat kami: Jl. Merdeka No. 45, Jakarta Selatan.",
    }),
    rule({
      id: "seed_admin",
      keyword: "admin",
      matchType: "contains",
      reply: "Baik {sender}, pesan kamu sudah kami teruskan ke admin. Mohon ditunggu ya 🙏",
    }),
  ];
}

export function seedContacts(): { whitelist: ContactEntry[]; blacklist: ContactEntry[] } {
  return {
    whitelist: [
      { id: "w1", name: "Budi Santoso", phone: "+6281234567890", note: "Pelanggan VIP" },
    ],
    blacklist: [{ id: "b1", name: "Spam Promo", phone: "+628111999222", note: "Spam" }],
  };
}

/** Contoh isi spreadsheet — dipakai untuk tombol "muat contoh" & dokumentasi. */
export const SAMPLE_SHEET_CSV = `keyword,match,reply,active,delay_ms,priority,produk,harga
menu,contains,"Daftar layanan:\n1. Harga\n2. Jam buka\n3. Alamat",TRUE,500,10,,
harga,contains,"Harga {produk} Rp {harga} ya Kak {sender} 😊",TRUE,0,5,Paket Hemat,125000
jam,contains,"Kami buka 08.00-22.00 WIB setiap hari.",TRUE,0,0,,
alamat,contains,"Alamat: Jl. Merdeka No. 45, Jakarta Selatan.",TRUE,0,0,,
admin,exact,"Sebentar ya, admin akan segera membalas.",TRUE,1200,0,,`;

export const SAMPLE_SETTINGS_CSV = `key,value
auto_reply_enabled,true
welcome_message,"Halo {sender}, ada yang bisa dibantu? Ketik *menu* ya."
default_reply,"Maaf pesan belum dikenali, ketik *menu* untuk pilihan."
cooldown_minutes,2
reply_delay_ms,800
active_hours,custom
active_hours_start,08:00
active_hours_end,22:00
contact_policy,everyone
reply_to_groups,false
channels,"whatsapp,whatsapp_business"`;
