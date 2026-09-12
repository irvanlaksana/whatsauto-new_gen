import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../server/index";
import { normalizeParams } from "../src/lib/backend";
import { decideReply } from "../src/lib/engine";
import { defaultSettings } from "../src/lib/defaults";

/**
 * Test integrasi backend web: server Express benar-benar dinyalakan, lalu
 * endpoint parameter dipanggil lewat HTTP (bukan mock).
 */

let server: Server;
let baseUrl = "";
let tmpFile = "";

beforeAll(async () => {
  tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "whatsauto-")), "params.json");
  const app = createApp({ paramsFile: tmpFile });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

const payload = {
  settings: {
    ...defaultSettings(),
    welcomeMessage: "Halo {sender} dari backend",
    cooldownMinutes: 7,
  },
  rules: [
    {
      id: "backend_harga",
      keyword: "harga",
      matchType: "contains",
      reply: "Harga {produk} Rp {harga}",
      active: true,
      delayMs: 0,
      priority: 5,
      channels: [],
      source: "backend",
      extra: { produk: "Paket Web", harga: "99000" },
    },
  ],
  whitelist: [],
  blacklist: [],
};

describe("backend parameter API", () => {
  it("menyediakan health check", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("menyimpan lalu mengembalikan parameter", async () => {
    const put = await fetch(`${baseUrl}/api/params`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(put.status).toBe(200);
    const saved = (await put.json()) as { ok: boolean; params: { rules: unknown[] } };
    expect(saved.ok).toBe(true);
    expect(saved.params.rules).toHaveLength(1);

    const get = await fetch(`${baseUrl}/api/params`);
    const stored = (await get.json()) as Record<string, unknown>;
    expect(stored.settings).toMatchObject({ cooldownMinutes: 7 });
    expect(fs.existsSync(tmpFile)).toBe(true);
  });

  it("menambah, mengubah, dan menghapus aturan", async () => {
    const created = await fetch(`${baseUrl}/api/params/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: "ongkir", reply: "Ongkir gratis", source: "backend" }),
    });
    expect(created.status).toBe(201);

    let current = (await (await fetch(`${baseUrl}/api/params`)).json()) as {
      rules: Array<{ id: string; active: boolean }>;
    };
    expect(current.rules).toHaveLength(2);

    const target = current.rules[1];
    const patched = await fetch(`${baseUrl}/api/params/rules/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    expect(patched.status).toBe(200);

    current = (await (await fetch(`${baseUrl}/api/params`)).json()) as {
      rules: Array<{ id: string; active: boolean }>;
    };
    expect(current.rules.find((rule) => rule.id === target.id)?.active).toBe(false);

    const removed = await fetch(`${baseUrl}/api/params/rules/${target.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    const missing = await fetch(`${baseUrl}/api/params/rules/tidak-ada`, { method: "DELETE" });
    expect(missing.status).toBe(404);
  });

  it("menyajikan halaman admin", async () => {
    const response = await fetch(`${baseUrl}/admin`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("WhatsAuto — Admin Parameter");
    expect(html).toContain("/api/params");
  });

  it("mengirim header CORS untuk klien web", async () => {
    const response = await fetch(`${baseUrl}/api/params`, { method: "OPTIONS" });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("klien backend", () => {
  it("payload backend dipakai engine sebagai aturan 'backend'", async () => {
    const response = await fetch(`${baseUrl}/api/params`);
    const params = normalizeParams(await response.json());
    expect(params).not.toBeNull();
    expect(params?.rules[0].source).toBe("backend");

    const decision = decideReply(
      {
        version: 3,
        generatedAt: new Date().toISOString(),
        settings: params!.settings,
        rules: params!.rules,
        whitelist: [],
        blacklist: [],
      },
      {
        sender: "Dewi",
        phone: "+6281200001111",
        text: "harga paket?",
        channel: "whatsapp",
        isGroup: false,
        isFirstMessage: false,
      },
      { now: new Date(2026, 8, 12, 9, 0) },
    );

    expect(decision.source).toBe("backend");
    expect(decision.text).toBe("Harga Paket Web Rp 99000");
  });
});
