"use client";

import { todayIso, type NdaData, type Party } from "@/lib/nda";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      {children}
    </label>
  );
}

function YearsSelect({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

type Props = { data: NdaData; onChange: (data: NdaData) => void };

export function NdaForm({ data, onChange }: Props) {
  const set = <K extends keyof NdaData>(key: K, value: NdaData[K]) => onChange({ ...data, [key]: value });
  const setParty = (which: "party1" | "party2", key: keyof Party, value: string) =>
    set(which, { ...data[which], [key]: value });

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold text-zinc-900">Agreement terms</legend>

        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea
            rows={3}
            value={data.purpose}
            onChange={(e) => set("purpose", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Effective Date">
          <div className="flex gap-2">
            <input
              type="date"
              value={data.effectiveDate}
              onChange={(e) => set("effectiveDate", e.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => set("effectiveDate", todayIso())}
              className="mt-1 shrink-0 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Today
            </button>
          </div>
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">MNDA Term</legend>
          <span className="block text-xs text-zinc-500">The length of this MNDA</span>
          <div className="mt-2 space-y-2 text-sm text-zinc-800">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mndaTerm"
                checked={data.mndaTerm.kind === "expires"}
                onChange={() => set("mndaTerm", { kind: "expires", years: 1 })}
              />
              Expires
              <YearsSelect
                label="MNDA term in years"
                value={data.mndaTerm.kind === "expires" ? data.mndaTerm.years : 1}
                onChange={(years) => set("mndaTerm", { kind: "expires", years })}
              />
              year(s) from Effective Date
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mndaTerm"
                checked={data.mndaTerm.kind === "untilTerminated"}
                onChange={() => set("mndaTerm", { kind: "untilTerminated" })}
              />
              Continues until terminated
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Term of Confidentiality</legend>
          <span className="block text-xs text-zinc-500">How long Confidential Information is protected</span>
          <div className="mt-2 space-y-2 text-sm text-zinc-800">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="confidentialityTerm"
                checked={data.confidentialityTerm.kind === "years"}
                onChange={() => set("confidentialityTerm", { kind: "years", years: 1 })}
              />
              <YearsSelect
                label="Term of confidentiality in years"
                value={data.confidentialityTerm.kind === "years" ? data.confidentialityTerm.years : 1}
                onChange={(years) => set("confidentialityTerm", { kind: "years", years })}
              />
              year(s) from Effective Date (trade secrets protected while they remain trade secrets)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="confidentialityTerm"
                checked={data.confidentialityTerm.kind === "perpetual"}
                onChange={() => set("confidentialityTerm", { kind: "perpetual" })}
              />
              In perpetuity
            </label>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Governing Law" hint="State, e.g. Delaware">
            <input value={data.governingLaw} onChange={(e) => set("governingLaw", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Jurisdiction" hint="e.g. courts located in New Castle, DE">
            <input value={data.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="MNDA Modifications" hint="Optional. List any modifications to the Standard Terms">
          <textarea
            rows={2}
            value={data.modifications}
            onChange={(e) => set("modifications", e.target.value)}
            className={inputClass}
          />
        </Field>
      </fieldset>

      {(["party1", "party2"] as const).map((which, i) => (
        <fieldset key={which} className="space-y-4">
          <legend className="mb-2 text-base font-semibold text-zinc-900">Party {i + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <input value={data[which].company} onChange={(e) => setParty(which, "company", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Signatory name">
              <input value={data[which].name} onChange={(e) => setParty(which, "name", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Title">
              <input value={data[which].title} onChange={(e) => setParty(which, "title", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Notice address" hint="Email or postal address">
              <input
                value={data[which].noticeAddress}
                onChange={(e) => setParty(which, "noticeAddress", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>
      ))}
    </form>
  );
}
