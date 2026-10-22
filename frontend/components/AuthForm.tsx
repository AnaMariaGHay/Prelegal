"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/lib/authActions";
import { ui } from "@/lib/ui";

type Props = { mode: "login" | "signup" };

/** Log in or sign up with an email and password. */
export function AuthForm({ mode }: Props) {
  const isSignup = mode === "signup";
  // The action redirects on success; otherwise it returns the error to show. React tracks
  // `pending` for the submission, so it can't be left stuck after a navigation.
  const [state, action, pending] = useActionState(isSignup ? signup : login, undefined);
  const error = state?.error;

  return (
    <div className={`${ui.card} mx-auto w-full max-w-sm p-6 sm:p-8`}>
      <h1 className="text-xl font-semibold text-zinc-900">{isSignup ? "Create your account" : "Log in"}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {isSignup ? "Your documents are saved to your account and private to you." : "Welcome back to Prelegal."}
      </p>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-800">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state?.email}
            className={`${ui.input} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            aria-describedby={isSignup ? "password-hint" : undefined}
            className={`${ui.input} mt-1`}
          />
          {isSignup && (
            <p id="password-hint" className="mt-1 text-xs text-zinc-500">
              At least 8 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className={ui.errorBox}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`${ui.primaryButton} w-full`}
        >
          {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        {isSignup ? "Already have an account? " : "New to Prelegal? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-sky-800 underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
