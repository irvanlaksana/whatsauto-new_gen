import { useState } from "react";
import { FileSpreadsheet, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, SectionTitle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import { rule as makeRule } from "../lib/defaults";
import type { MatchType, ReplyRule } from "../lib/types";

export function RulesPanel({ store }: { store: WhatsAutoStore }) {
  const { state, addRule, updateRule, removeRule } = store;
  const [keyword, setKeyword] = useState("");
  const [reply, setReply] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("contains");
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (rule: ReplyRule) => {
    setEditingId(rule.id);
    setKeyword(rule.keyword);
    setReply(rule.reply);
    setMatchType(rule.matchType);
  };

  const submit = () => {
    if (!keyword.trim() || !reply.trim()) {
      store.notify("Keyword dan balasan wajib diisi.");
      return;
    }
    if (editingId) {
      updateRule(editingId, { keyword: keyword.trim(), reply, matchType });
      store.notify("Aturan diperbarui.");
    } else {
      addRule(makeRule({ keyword: keyword.trim(), reply, matchType }));
      store.notify("Aturan manual ditambahkan.");
    }
    setEditingId(null);
    setKeyword("");
    setReply("");
    setMatchType("contains");
  };

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle
          icon={<Plus size={16} />}
          title={editingId ? "Ubah aturan" : "Tambah aturan manual"}
          subtitle="Aturan sheet dan manual digabung; sheet menang bila prioritas sama."
        />
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Keyword">
              <input
                className={inputClass}
                value={keyword}
                placeholder="mis. harga"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Field>
            <Field label="Tipe cocok">
              <select
                className={inputClass}
                value={matchType}
                onChange={(event) => setMatchType(event.target.value as MatchType)}
              >
                <option value="contains">mengandung</option>
                <option value="exact">persis sama</option>
                <option value="regex">regex</option>
              </select>
            </Field>
          </div>
          <Field label="Balasan" hint="Variabel: {sender} {phone} {time} {date} {received_msg} + kolom sheet">
            <textarea
              className={`${inputClass} min-h-[90px]`}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={submit}>
              <Plus size={14} /> {editingId ? "Simpan perubahan" : "Tambah aturan"}
            </Button>
            {editingId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setKeyword("");
                  setReply("");
                }}
              >
                Batal
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon={<MessageSquare size={16} />}
          title="Aturan manual"
          subtitle={`${state.manualRules.length} aturan tersimpan di perangkat.`}
        />
        {state.manualRules.length === 0 ? (
          <EmptyState title="Belum ada aturan manual" />
        ) : (
          <ul className="space-y-2">
            {state.manualRules.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-slate-800">{rule.keyword}</span>
                      <Badge tone="slate">{rule.matchType}</Badge>
                      {rule.priority !== 0 ? <Badge tone="sky">prio {rule.priority}</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs whitespace-pre-wrap text-slate-600">{rule.reply}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => updateRule(rule.id, { active: !rule.active })}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                        rule.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {rule.active ? "aktif" : "off"}
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(rule)}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="rounded-lg bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {state.sheetRules.length > 0 ? (
        <Card>
          <SectionTitle
            icon={<FileSpreadsheet size={16} />}
            title="Aturan dari spreadsheet"
            subtitle="Baca-saja — ubah di Google Sheets lalu sinkron ulang."
          />
          <ul className="space-y-1.5">
            {state.sheetRules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="truncate font-semibold text-slate-700">{rule.keyword}</span>
                <span className="max-w-[60%] truncate text-slate-500">{rule.reply}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
