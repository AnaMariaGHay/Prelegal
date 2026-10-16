import { API_URL } from "@/lib/api";

// Forwards a chat turn from the browser to the backend, which calls Claude. Keeps the
// backend address server-side and the browser on a single origin.
export async function POST(request: Request) {
  try {
    const response = await fetch(`${API_URL}/api/chat/mutual-nda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ detail: "The Prelegal backend isn't reachable. Is it running?" }, { status: 502 });
  }
}
