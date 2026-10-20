// Shared Tailwind class names, so buttons, cards and messages look the same everywhere.

const button =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const ui = {
  primaryButton: `${button} bg-sky-700 text-white shadow-sm hover:bg-sky-800`,
  secondaryButton: `${button} bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50`,
  dangerButton: `${button} bg-white text-red-700 ring-1 ring-zinc-300 hover:bg-red-50`,
  card: "rounded-lg bg-white ring-1 ring-zinc-200",
  errorBox: "rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200",
  input:
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600",
  muted: "text-sm text-zinc-600",
};
