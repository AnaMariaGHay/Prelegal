// Server-side client for the Prelegal FastAPI backend (see ../backend).

const API_URL = process.env.PRELEGAL_API_URL ?? "http://127.0.0.1:8000";

export type TemplateDetail = {
  slug: string;
  name: string;
  description: string;
  filename: string;
  content: string;
};

export async function getTemplate(slug: string): Promise<TemplateDetail> {
  const response = await fetch(`${API_URL}/api/templates/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for template '${slug}'`);
  }
  return response.json();
}
