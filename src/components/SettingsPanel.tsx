import { Bot, ExternalLink, Power, Server, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Card, Field, SectionTitle, Toggle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import { CHANNELS } from "../lib/types";

export function SettingsPanel({ store }: { store: WhatsAutoStore }) {
  const { state, updateSettings, updateBackend, testBackend, pullFromBackend, pushToBackend } = store;
  const { settings, backend } = state;

  const toggleChannel = (id: string) => {
    const active = settings.channels.includes(id as never);
    updateSettings({
      channels: active
        ? settings.channels.filter((channel) => channel !== id)
        : [...settings.channels, id as never],
    });
  };

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle
          icon={<Server size={16} />}
          title="Backend parameter (web)"
          subtitle="Atur balasan lewat browser, lalu tarik ke aplikasi."
        />
        <div className="space-y-2">
          <Field
            label="Alamat backend"
            hint="Contoh: http://192.168.1.10:8787 — jalankan `npm run server` di komputer, lalu pakai IP-nya dari HP."
          >
            <input
              className={inputClass}
              placeholder="http://192.168.1.10:8787"
              value={backend.url}
              onChange={(event) => updateBackend({ url: event.target.value })}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Toggle
              checked={backend.autoPull}
              onChange={(value) => updateBackend({ autoPull: value })}
              label="Tarik otomatis"
              description="Ambil parameter terbaru dari backend secara berkala."
            />
            <Field label="Interval (menit)">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={1440}
                value={backend.pullIntervalMinutes}
                onChange={(event) =>
                  updateBackend({ pullIntervalMinutes: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void testBackend()} disabled={!backend.url.trim()}>
              Tes koneksi
            </Button>
            <Button onClick={() => void pullFromBackend()} disabled={!backend.url.trim()}>
              Tarik parameter
            </Button>
            <Button variant="soft" onClick={() => void pushToBackend()} disabled={!backend.url.trim()}>
              Kirim parameter
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                window.open(`${backend.url.replace(/\/+$/, "")}/admin`, "_blank", "noopener,noreferrer")
              }
              disabled={!backend.url.trim()}
            >
              <ExternalLink size={14} /> Buka /admin
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge tone={backend.lastStatus === "error" ? "rose" : backend.lastStatus === "ok" ? "emerald" : "slate"}>
              {backend.lastStatus === "error" ? "gagal" : backend.lastStatus === "ok" ? "terhubung" : "menunggu"}
            </Badge>
            <span className="text-ink-mute">{backend.lastMessage}</span>
            {backend.lastSyncAt ? (
              <span className="text-ink-mute">
                · {new Date(backend.lastSyncAt).toLocaleTimeString("id-ID", { hour12: false })}
              </span>
            ) : null}
            <span className="text-ink-mute">· {state.backendRules.length} aturan backend</span>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Power size={16} />} title="Mesin auto-reply" />
        <div className="space-y-2">
          <Toggle
            checked={settings.autoReplyEnabled}
            onChange={(value) => updateSettings({ autoReplyEnabled: value })}
            label="Auto-reply aktif"
            description="Saklar utama untuk semua balasan otomatis."
          />
          <Toggle
            checked={settings.replyToGroups}
            onChange={(value) => updateSettings({ replyToGroups: value })}
            label="Balas pesan grup"
            description="Matikan agar bot tidak ramai di grup."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Cooldown (menit)" hint="Jeda minimal antar balasan ke nomor yang sama.">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={settings.cooldownMinutes}
                onChange={(event) =>
                  updateSettings({ cooldownMinutes: Math.max(0, Number(event.target.value) || 0) })
                }
              />
            </Field>
            <Field label="Jeda ketik (ms)" hint="Meniru jeda manusia sebelum mengirim.">
              <input
                className={inputClass}
                type="number"
                min={0}
                step={100}
                value={settings.replyDelayMs}
                onChange={(event) =>
                  updateSettings({ replyDelayMs: Math.max(0, Number(event.target.value) || 0) })
                }
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<SlidersHorizontal size={16} />} title="Channel yang dipantau" />
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => {
            const active = settings.channels.includes(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => toggleChannel(channel.id)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-brand-strong text-brand-ink"
                    : "bg-surface-2 text-ink-soft hover:bg-surface-3"
                }`}
              >
                {channel.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">
          Nama paket aplikasi sudah dipetakan di kode, jadi notifikasi dari aplikasi lain akan diabaikan.
        </p>
      </Card>

      <Card>
        <SectionTitle title="Pesan sambutan & default" />
        <div className="space-y-2">
          <Field label="Pesan sambutan (kontak baru)">
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={settings.welcomeMessage}
              onChange={(event) => updateSettings({ welcomeMessage: event.target.value })}
            />
          </Field>
          <Field label="Balasan default (tidak ada aturan cocok)">
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={settings.defaultReply}
              onChange={(event) => updateSettings({ defaultReply: event.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Jam aktif" />
        <div className="flex gap-2">
          {(["always", "custom"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateSettings({ activeHours: { ...settings.activeHours, mode } })}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                settings.activeHours.mode === mode
                  ? "bg-surface-3 text-brand-ink"
                  : "bg-surface-2 text-ink-soft"
              }`}
            >
              {mode === "always" ? "24 jam" : "Jam tertentu"}
            </button>
          ))}
        </div>
        {settings.activeHours.mode === "custom" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Mulai">
              <input
                className={inputClass}
                type="time"
                value={settings.activeHours.start}
                onChange={(event) =>
                  updateSettings({ activeHours: { ...settings.activeHours, start: event.target.value } })
                }
              />
            </Field>
            <Field label="Selesai">
              <input
                className={inputClass}
                type="time"
                value={settings.activeHours.end}
                onChange={(event) =>
                  updateSettings({ activeHours: { ...settings.activeHours, end: event.target.value } })
                }
              />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle
          icon={<Bot size={16} />}
          title="Balasan AI (opsional)"
          subtitle="Dipakai bila tidak ada aturan spreadsheet yang cocok."
        />
        <div className="space-y-2">
          <Toggle
            checked={settings.ai.enabled}
            onChange={(value) => updateSettings({ ai: { ...settings.ai, enabled: value } })}
            label="Aktifkan AI"
            description="Butuh API key Gemini; tanpa itu engine memakai balasan default."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Mode">
              <select
                className={inputClass}
                value={settings.ai.mode}
                onChange={(event) =>
                  updateSettings({ ai: { ...settings.ai, mode: event.target.value as "always" | "fallback" } })
                }
              >
                <option value="fallback">Fallback (disarankan)</option>
                <option value="always">Selalu AI</option>
              </select>
            </Field>
            <Field label="Model">
              <input
                className={inputClass}
                value={settings.ai.model}
                onChange={(event) => updateSettings({ ai: { ...settings.ai, model: event.target.value } })}
              />
            </Field>
          </div>
          <Field label="API key Gemini" hint="Disimpan lokal di perangkat.">
            <input
              className={inputClass}
              type="password"
              value={settings.ai.apiKey}
              onChange={(event) => updateSettings({ ai: { ...settings.ai, apiKey: event.target.value } })}
            />
          </Field>
          <Field label="Persona / gaya bahasa">
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={settings.ai.persona}
              onChange={(event) => updateSettings({ ai: { ...settings.ai, persona: event.target.value } })}
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}
