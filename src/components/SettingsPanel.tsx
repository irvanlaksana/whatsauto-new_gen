import { Bot, Power, SlidersHorizontal } from "lucide-react";
import { Card, Field, SectionTitle, Toggle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import { CHANNELS } from "../lib/types";

export function SettingsPanel({ store }: { store: WhatsAutoStore }) {
  const { state, updateSettings } = store;
  const { settings } = state;

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
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {channel.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
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
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600"
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
