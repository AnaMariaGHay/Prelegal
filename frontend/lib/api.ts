// Server-side client for the Prelegal FastAPI backend (see ../backend).

import type { DocumentSpec } from "./documents";

export const API_URL = process.env.PRELEGAL_API_URL ?? "http://127.0.0.1:8000";

/** A document spec plus its Standard Terms markdown. */
export type DocumentDetail = DocumentSpec & { content: string };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for ${path}`);
  }
  return response.json();
}

export function getDocuments(): Promise<DocumentSpec[]> {
  return getJson("/api/documents");
}

export async function getGreeting(): Promise<string> {
  return (await getJson<{ greeting: string }>("/api/chat")).greeting;
}
