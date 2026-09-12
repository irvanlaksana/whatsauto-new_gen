import { useState } from "react";
import { Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, SectionTitle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import type { ContactEntry } from "../lib/types";

const POLICIES: Array<{ id: "everyone" | "whitelist" | "exclude_blacklist"; label: string; desc: string }> = [
  { id: "everyone", label: "Semua orang", desc: "Balas setiap pesan masuk kecuali blacklist." },
  { id: "whitelist", label: "Hanya whitelist", desc: "Balas hanya nomor yang terdaftar di whitelist." },
  { id: "exclude_blacklist", label: "Semua kecuali blacklist", desc: "Sama seperti semua orang, blacklist tetap diblokir." },
];

export function ContactsPanel({ store }: { store: WhatsAutoStore }) {
  const { state, updateSettings, addContact, removeContact } = store;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [list, setList] = useState<"whitelist" | "blacklist">("whitelist");

  const submit = () => {
    if (!name.trim() && !phone.trim()) {
      store.notify("Isi nama atau nomor terlebih dulu.");
      return;
    }
    const entry: ContactEntry = {
      id: `${list}_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim() || undefined,
    };
    addContact(list, entry);
    setName("");
    setPhone("");
    setNote("");
    store.notify(list === "whitelist" ? "Kontak ditambahkan ke whitelist." : "Kontak diblokir.");
  };

  const renderList = (key: "whitelist" | "blacklist") => {
    const entries = state[key];
    if (entries.length === 0) {
      return <EmptyState title={key === "whitelist" ? "Whitelist kosong" : "Blacklist kosong"} />;
    }
    return (
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-700">{entry.name || entry.phone}</span>
              <span className="block truncate text-slate-500">
                {entry.phone}
                {entry.note ? ` · ${entry.note}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => removeContact(key, entry.id)}
              className="rounded-lg bg-white p-1.5 text-rose-500 ring-1 ring-slate-200 hover:bg-rose-50"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle icon={<Users size={16} />} title="Kebijakan penerima" />
        <div className="space-y-2">
          {POLICIES.map((policy) => (
            <button
              key={policy.id}
              type="button"
              onClick={() => updateSettings({ contactPolicy: policy.id })}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                state.settings.contactPolicy === policy.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="block text-sm font-semibold text-slate-800">{policy.label}</span>
              <span className="block text-[11px] text-slate-500">{policy.desc}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<ShieldCheck size={16} />} title="Tambah kontak" />
        <div className="space-y-2">
          <div className="flex gap-2">
            {(["whitelist", "blacklist"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setList(option)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  list === option ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nama">
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Nomor" hint="Format bebas, akan dinormalisasi ke 62…">
              <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </div>
          <Field label="Catatan">
            <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <Button onClick={submit}>
            <Plus size={14} /> Tambahkan
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle title="Whitelist" subtitle={`${state.whitelist.length} kontak`} />
          {renderList("whitelist")}
        </Card>
        <Card>
          <SectionTitle title="Blacklist" subtitle={`${state.blacklist.length} kontak diblokir`} />
          {renderList("blacklist")}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Ringkasan kebijakan aktif" />
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">
            {POLICIES.find((policy) => policy.id === state.settings.contactPolicy)?.label}
          </Badge>
          <Badge tone="slate">Grup {state.settings.replyToGroups ? "dibalas" : "diabaikan"}</Badge>
          <Badge tone="slate">Cooldown {state.settings.cooldownMinutes} menit</Badge>
        </div>
      </Card>
    </div>
  );
}
