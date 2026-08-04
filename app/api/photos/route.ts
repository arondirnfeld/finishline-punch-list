import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database; MEDIA: R2Bucket };
const bindings = () => env as unknown as Bindings;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file"); const itemId = Number(form.get("itemId")); const kind = form.get("kind") === "after" ? "after" : "before";
  if (!(file instanceof File) || !itemId) return Response.json({ error: "Photo and item are required" }, { status: 400 });
  if (!file.type.startsWith("image/") || file.size > 12_000_000) return Response.json({ error: "Photo must be an image under 12MB" }, { status: 400 });
  const key = `project-1/items/${itemId}/${kind}-${crypto.randomUUID()}.jpg`;
  await bindings().MEDIA.put(key, file.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  const url = `/api/photos?key=${encodeURIComponent(key)}`;
  const column = kind === "after" ? "after_photo" : "before_photo";
  await bindings().DB.prepare(`UPDATE items SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = 1`).bind(url, itemId).run();
  return Response.json({ url }, { status: 201 });
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("project-1/")) return new Response("Not found", { status: 404 });
  const object = await bindings().MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
