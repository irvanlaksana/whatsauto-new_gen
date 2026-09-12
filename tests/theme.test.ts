import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Penjaga tema "dark soft":
 * 1. token warna terdefinisi di src/index.css,
 * 2. tidak ada lagi kelas warna terang (slate/emerald/rose/...) di komponen,
 * 3. utility hasil build benar-benar ada di CSS (Tailwind membuang kelas tak dikenal
 *    tanpa error, jadi ini satu-satunya cara mendeteksi token yang salah tulis).
 */

const SRC_DIR = path.resolve(import.meta.dirname, "..", "src");

const LIGHT_PATTERNS = [
  /\bbg-white\b/,
  /\btext-white\b/,
  /\b(bg|text|border|ring|divide)-(slate|emerald|rose|sky|amber)-\d{2,3}\b/,
];

function tsxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsxFiles(full));
    else if (entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

describe("tema dark soft", () => {
  it("mendefinisikan token warna di index.css", () => {
    const css = fs.readFileSync(path.join(SRC_DIR, "index.css"), "utf-8");
    for (const token of [
      "--color-base",
      "--color-surface",
      "--color-line",
      "--color-ink",
      "--color-ink-soft",
      "--color-ink-mute",
      "--color-brand",
      "--color-brand-strong",
      "--color-brand-soft",
      "--color-danger",
      "--color-warn",
      "--color-info",
    ]) {
      expect(css, `token ${token} hilang`).toContain(token);
    }
    expect(css).toContain("color-scheme: dark");
  });

  it("komponen tidak memakai kelas warna terang", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC_DIR)) {
      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of LIGHT_PATTERNS) {
        const match = content.match(pattern);
        if (match) offenders.push(`${path.relative(SRC_DIR, file)} → ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("utility token ikut ter-generate di CSS hasil build", () => {
    const distDir = path.resolve(import.meta.dirname, "..", "dist", "assets");
    if (!fs.existsSync(distDir)) return; // build belum dijalankan — dilewati
    const cssFile = fs
      .readdirSync(distDir)
      .find((name) => name.endsWith(".css"));
    if (!cssFile) return;

    const css = fs.readFileSync(path.join(distDir, cssFile), "utf-8");
    for (const utility of [
      ".bg-base",
      ".bg-surface",
      ".bg-surface-2",
      ".bg-surface-3",
      ".border-line",
      ".text-ink",
      ".text-ink-soft",
      ".text-ink-mute",
      ".bg-brand-strong",
      ".text-brand",
      ".bg-brand-soft",
      ".text-danger",
      ".text-warn",
      ".text-info",
    ]) {
      expect(css, `utility ${utility} tidak ter-generate`).toContain(utility);
    }
  });
});
