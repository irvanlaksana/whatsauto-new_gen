import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Badge, Button, Card, Field, SectionTitle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import type { ChannelId } from "../lib/types";
import { CHANNELS } from "../lib/types";
import { REASON_LABEL } from "../lib/engine";

interface Bubble {
  id: string;
  from: "user" | "bot";
  text: string;
  meta?: string;
}

const QUICK_TESTS = ["menu", "harga", "jam buka", "alamat", "admin", "pesan acak"];

export function SimulatorPanel({ store }: { store: WhatsAutoStore }) {
  const { program, simulate } = store;
  const [channel, setChannel] = useState<ChannelId>("whatsapp");
  const [sender, setSender] = useState("Budi Santoso");
  const [phone, setPhone] = useState("+6281234567890");
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: "hint",
      from: "bot",
      text: "Simulator memakai engine yang sama dengan layanan Android. Kirim pesan untuk menguji aturan spreadsheet.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles]);

  const send = async (value: string) => {
    const message = value.trim();
    if (!message || busy) return;
    setBusy(true);
    setText("");
    setBubbles((current) => [...current, { id: `u${Date.now()}`, from: "user", text: message }]);

    const result = await simulate({
      sender,
      phone,
      text: message,
      channel,
      isGroup: false,
      isFirstMessage,
    });
    setIsFirstMessage(false);

    if (result.decision.shouldReply && result.text) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(result.decision.delayMs, 1200)));
      setBubbles((current) => [
        ...current,
        {
          id: `b${Date.now()}`,
          from: "bot",
          text: result.text,
          meta: `${result.decision.source.toUpperCase()} · ${REASON_LABEL[result.decision.reason]}`,
        },
      ]);
    } else {
      setBubbles((current) => [
        ...current,
        {
          id: `s${Date.now()}`,
          from: "bot",
          text: `Tidak dibalas — ${REASON_LABEL[result.decision.reason]}.`,
          meta: "SKIPPED",
        },
      ]);
    }

    if (result.aiError) {
      setBubbles((current) => [
        ...current,
        { id: `e${Date.now()}`, from: "bot", text: `AI error: ${result.aiError}`, meta: "AI" },
      ]);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle
          icon={<Sparkles size={16} />}
          title="Uji balasan"
          subtitle={`${program.rules.length} aturan aktif · cooldown ${program.settings.cooldownMinutes} menit`}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Pengirim">
            <input className={inputClass} value={sender} onChange={(event) => setSender(event.target.value)} />
          </Field>
          <Field label="Nomor">
            <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {CHANNELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChannel(item.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                channel === item.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-600"
              checked={isFirstMessage}
              onChange={(event) => setIsFirstMessage(event.target.checked)}
            />
            Pesan pertama (sambutan)
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_TESTS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => void send(sample)}
              className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
            >
              {sample}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col">
        <div className="h-[320px] space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={`flex ${bubble.from === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  bubble.from === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-800 ring-1 ring-slate-200"
                }`}
              >
                {bubble.text}
                {bubble.meta ? (
                  <span
                    className={`mt-1 block text-[10px] font-bold tracking-wide ${
                      bubble.from === "user" ? "text-emerald-100" : "text-slate-400"
                    }`}
                  >
                    {bubble.meta}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
          {busy ? (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Bot size={13} /> mesin sedang memproses…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(text);
          }}
        >
          <input
            className={inputClass}
            placeholder="Ketik pesan masuk…"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            <Send size={14} /> Kirim
          </Button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Status mesin" />
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge tone={program.settings.autoReplyEnabled ? "emerald" : "rose"}>
            Auto-reply {program.settings.autoReplyEnabled ? "aktif" : "mati"}
          </Badge>
          <Badge tone="slate">{program.rules.filter((rule) => rule.active).length} aturan aktif</Badge>
          <Badge tone="sky">{program.settings.channels.length} channel</Badge>
          <Badge tone={program.settings.ai.enabled ? "amber" : "slate"}>
            AI {program.settings.ai.enabled ? program.settings.ai.mode : "off"}
          </Badge>
          <Badge tone="slate">
            Jam {program.settings.activeHours.mode === "always" ? "24 jam" : `${program.settings.activeHours.start}-${program.settings.activeHours.end}`}
          </Badge>
        </div>
      </Card>
    </div>
  );
}
