import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/api";
import { AuthForm } from "./AuthForm";

/** The login or sign-up page. */
export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="py-6 sm:py-12">
      <AuthForm mode={mode} />
      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
    </div>
  );
}

// Someone who is already logged in goes straight to their documents.
async function RedirectIfLoggedIn() {
  if (await getCurrentUser().catch(() => null)) redirect("/");
  return null;
}
