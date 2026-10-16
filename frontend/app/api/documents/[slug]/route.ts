import { API_URL } from "@/lib/api";

// Forwards a request for one document's spec and Standard Terms to the backend, so the
// browser can load a document once the user (or the assistant) chooses it.
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[slug]">) {
  const { slug } = await params;
  try {
    const response = await fetch(`${API_URL}/api/documents/${encodeURIComponent(slug)}`);
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ detail: "The Prelegal backend isn't reachable. Is it running?" }, { status: 502 });
  }
}
