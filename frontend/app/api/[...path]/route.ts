import { API_URL } from "@/lib/api";

// Forwards every /api/* request from the browser to the backend, so the browser talks to a
// single origin and the backend address stays server-side. The login session cookie is
// passed through in both directions; the backend sets it and checks it.

async function forward(request: Request, { params }: RouteContext<"/api/[...path]">) {
  const { path } = await params;
  const search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of ["content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/${path.map(encodeURIComponent).join("/")}${search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      redirect: "manual",
    });
  } catch (error) {
    console.error(error);
    return Response.json({ detail: "The Prelegal backend isn't reachable. Is it running?" }, { status: 502 });
  }

  const out = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  for (const cookie of response.headers.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(response.status === 204 ? null : response.body, { status: response.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
