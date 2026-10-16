// Server-side client for the Prelegal FastAPI backend (see ../backend).

export const API_URL = process.env.PRELEGAL_API_URL ?? "http://127.0.0.1:8000";

export type TemplateDetail = {
  slug: string;
  name: string;
  description: string;
  filename: string;
  content: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for ${path}`);
  }
  return response.json();
}

export function getTemplate(slug: string): Promise<TemplateDetail> {
  return getJson(`/api/templates/${encodeURIComponent(slug)}`);
}

export async function getMutualNdaGreeting(): Promise<string> {
  return (await getJson<{ greeting: string }>("/api/chat/mutual-nda")).greeting;
}
