import type { ReactNode } from "react";

/** Komponen UI kecil yang dipakai di semua panel. */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-4 shadow-sm shadow-black/20 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      {icon ? <span className="mt-0.5 text-brand">{icon}</span> : null}
      <div>
        <h2 className="text-sm font-bold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="text-xs text-ink-mute">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-brand-strong text-brand-ink hover:bg-brand-hover disabled:bg-line disabled:text-ink-mute",
    soft: "bg-brand-soft text-brand hover:bg-brand-soft disabled:text-ink-mute",
    ghost: "bg-surface-2 text-ink-soft ring-1 ring-line hover:bg-surface-3 hover:text-ink disabled:text-ink-mute",
    danger: "bg-danger-soft text-danger hover:bg-danger-soft disabled:text-danger",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-ink-mute">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-mute transition focus:border-brand focus:ring-2 focus:ring-brand/25";

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition hover:border-line-strong"
    >
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description ? <span className="block text-[11px] text-ink-mute">{description}</span> : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-brand" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-ink shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "sky";
}) {
  const tones: Record<string, string> = {
    slate: "bg-surface-2 text-ink-soft",
    emerald: "bg-brand-soft text-brand",
    amber: "bg-warn-soft text-warn",
    rose: "bg-danger-soft text-danger",
    sky: "bg-info-soft text-info",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <p className="text-sm font-semibold text-ink-soft">{title}</p>
      {hint ? <p className="mt-1 text-xs text-ink-mute">{hint}</p> : null}
    </div>
  );
}
