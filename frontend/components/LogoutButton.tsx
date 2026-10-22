"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/lib/authActions";
import { ui } from "@/lib/ui";

export function LogoutButton() {
  return (
    <form action={logout}>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${ui.secondaryButton} px-3 py-1.5`}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
