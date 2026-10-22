import Link from "next/link";
import { ui } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className={`${ui.card} mx-auto mt-6 max-w-md p-6 text-center sm:p-8`}>
      <h1 className="text-lg font-semibold text-zinc-900">Page not found</h1>
      <p className={`mt-2 ${ui.muted}`}>This page or document doesn’t exist, or it belongs to another account.</p>
      <Link href="/" className={`${ui.primaryButton} mt-6`}>
        Go to My documents
      </Link>
    </div>
  );
}
