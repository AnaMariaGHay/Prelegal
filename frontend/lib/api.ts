// Server-side client for the Prelegal FastAPI backend (see ../backend). Requests that need
// the logged-in user pass the browser's cookies through.

import { cookies } from "next/headers";
import type { ChatMessage } from "@/components/Chat";
import type { DocumentSpec, DocumentState } from "./documents";

export const API_URL = process.env.PRELEGAL_API_URL ?? "http://127.0.0.1:8000";

export type User = { id: string; email: string };

export type DraftSummary = {
  id: string;
  type: string | null;
  title: string;
  missingCount: number | null;
  updatedAt: string;
};

export type Draft = { id: string; document: DocumentState; messages: ChatMessage[]; updatedAt: string };

export class BackendError extends Error {
  constructor(
    public status: number,
    path: string,
  ) {
    super(`Backend returned ${status} for ${path}`);
  }
}

async function getJson<T>(path: string, withSession = false): Promise<T> {
  const headers: HeadersInit = withSession ? { cookie: (await cookies()).toString() } : {};
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) throw new BackendError(response.status, path);
  return response.json();
}

/** The logged-in user, or null if there isn't one (no cookie, or an expired session). */
export async function getCurrentUser(): Promise<User | null> {
  if (!(await cookies()).has("prelegal_session")) return null;
  try {
    return await getJson<User>("/api/auth/me", true);
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) return null;
    throw error;
  }
}

export function getDrafts(): Promise<DraftSummary[]> {
  return getJson("/api/drafts", true);
}

/** One of the user's drafts, or null if it doesn't exist or belongs to someone else. */
export async function getDraft(id: string): Promise<Draft | null> {
  try {
    return await getJson<Draft>(`/api/drafts/${encodeURIComponent(id)}`, true);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

export function getDocuments(): Promise<DocumentSpec[]> {
  return getJson("/api/documents");
}

export async function getGreeting(): Promise<string> {
  return (await getJson<{ greeting: string }>("/api/chat")).greeting;
}
