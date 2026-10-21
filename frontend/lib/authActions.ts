"use server";

// Log in, sign up and log out as Server Actions. The backend checks the password and
// creates or ends the session; these copy its session cookie into the browser and
// redirect. Setting or deleting a cookie in a Server Action also clears the router's cache
// of pages rendered for the previous user.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "./api";

const COOKIE_NAME = "prelegal_session";

export type AuthState = { error: string; email: string } | undefined;

function errorMessage(status: number, body: { detail?: unknown } | null) {
  if (typeof body?.detail === "string") return body.detail;
  // FastAPI validation errors: a list of {msg} objects.
  if (Array.isArray(body?.detail) && typeof body.detail[0]?.msg === "string")
    return body.detail[0].msg.replace(/^Value error, /, "");
  return `Something went wrong (error ${status}). Please try again.`;
}

async function authenticate(mode: "login" | "signup", formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: "Prelegal’s backend isn’t reachable. Please try again in a moment.", email };
  }
  if (!response.ok) return { error: errorMessage(response.status, await response.json().catch(() => null)), email };

  // Copy the session cookie the backend issued, with its lifetime and flags.
  const setCookie = response.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_NAME}=`));
  const token = setCookie?.split(";")[0].slice(COOKIE_NAME.length + 1);
  if (!setCookie || !token) return { error: "Something went wrong logging you in. Please try again.", email };
  const maxAge = Number(setCookie.match(/Max-Age=(\d+)/i)?.[1]) || undefined;
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: /;\s*Secure/i.test(setCookie),
    path: "/",
    maxAge,
  });
  redirect("/");
}

export async function login(_: AuthState, formData: FormData) {
  return authenticate("login", formData);
}

export async function signup(_: AuthState, formData: FormData) {
  return authenticate("signup", formData);
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    // End the session on the server too, so a copy of the cookie stops working.
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", headers: { cookie: `${COOKIE_NAME}=${token}` } }).catch(
      () => null,
    );
  }
  store.delete(COOKIE_NAME);
  redirect("/login");
}
