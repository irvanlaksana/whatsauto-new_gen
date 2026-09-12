import type { ChannelId, IncomingMessage } from "./types";

/**
 * Substitusi variabel pada teks balasan.
 *
 * Variabel bawaan: {sender} {phone} {received_msg} {time} {date} {datetime}
 * {day} {channel}. Semua kolom tambahan dari spreadsheet otomatis menjadi
 * variabel, misalnya kolom "Harga" bisa dipakai sebagai {harga}.
 */

const PLACEHOLDER = /\{\s*([a-z0-9_.\- ]+)\s*\}/gi;

export function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function timeParts(date: Date) {
  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    datetime: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`,
    day: DAY_NAMES[date.getDay()],
  };
}

export function renderTemplate(
  template: string,
  message: IncomingMessage,
  extra: Record<string, string> = {},
  now: Date = new Date(),
): string {
  const parts = timeParts(now);
  const base: Record<string, string> = {
    sender: message.sender,
    nama: message.sender,
    phone: message.phone,
    nomor: message.phone,
    received_msg: message.text,
    pesan: message.text,
    time: parts.time,
    jam: parts.time,
    date: parts.date,
    tanggal: parts.date,
    datetime: parts.datetime,
    day: parts.day,
    hari: parts.day,
    channel: message.channel,
    platform: message.channel,
  };

  const lookup: Record<string, string> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const normalized = normalizeKey(key);
    if (normalized && !(normalized in lookup)) lookup[normalized] = value;
  }

  return template.replace(PLACEHOLDER, (match, rawKey: string) => {
    const key = normalizeKey(rawKey);
    return key in lookup ? lookup[key] : match;
  });
}

export function describeChannel(channel: ChannelId): string {
  return channel.replace(/_/g, " ");
}
