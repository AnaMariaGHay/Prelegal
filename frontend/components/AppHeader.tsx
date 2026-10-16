import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/api";
import { LogoutButton } from "./LogoutButton";

export function AppHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-lg font-bold text-zinc-900">Prelegal</span>
          <span className="hidden text-sm text-zinc-600 sm:inline">Draft legal agreements with AI</span>
        </Link>
        <Suspense fallback={null}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

// Reads the session, so it streams in behind the Suspense boundary.
async function UserMenu() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  return (
    <nav aria-label="Account" className="flex items-center gap-3 text-sm">
      <Link href="/" className="font-medium text-zinc-700 hover:text-zinc-900">
        My documents
      </Link>
      <span className="hidden text-zinc-400 sm:inline" aria-hidden>
        |
      </span>
      <span className="hidden max-w-48 truncate text-zinc-600 sm:inline" title={user.email}>
        {user.email}
      </span>
      <LogoutButton />
    </nav>
  );
}
