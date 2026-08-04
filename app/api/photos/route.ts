import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database; MEDIA: R2Bucket };
const bindings = () => env as unknown as Bindings;

async function ready() {
  const { DB } = bindings();
  await DB.batch([
    DB.prepare("CREATE TABLE IF NOT EXISTS photos (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL DEFAULT 1, item_id INTEGER NOT NULL, object_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    DB.prepare("CREATE INDEX IF NOT EXISTS idx_photos_project_item ON photos(project_id, item_id)"),
  ]);
}

function metadata(row: Record<string, unknown>) {
  return { id: row.id, itemId: row.item_id, createdAt: row.created_at, url: `/api/photos?id=${row.id}&file=1` };
}

export async function GET(request: Request) {
  await ready();
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (id && url.searchParams.get("file") === "1") {
    const row = await bindings().DB.prepare("SELECT object_key FROM photos WHERE id = ? AND project_id = 1").bind(id).first<{ object_key: string }>();
    if (!row) return new Response("Not found", { status: 404 });
    const object = await bindings().MEDIA.get(row.object_key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "private, max-age=3600");
    return new Response(object.body, { headers });
  }
  const itemId = Number(url.searchParams.get("itemId"));
  const query = itemId
    ? bindings().DB.prepare("SELECT id, item_id, created_at FROM photos WHERE project_id = 1 AND item_id = ? ORDER BY id").bind(itemId)
    : bindings().DB.prepare("SELECT id, item_id, created_at FROM photos WHERE project_id = 1 ORDER BY item_id, id");
  const result = await query.all();
  return Response.json({ photos: result.results.map((row) => metadata(row as Record<string, unknown>)) });
}

export async function POST(request: Request) {
  await ready();
  const form = await request.formData();
  const file = form.get("file"); const itemId = Number(form.get("itemId"));
  if (!(file instanceof File) || !itemId) return Response.json({ error: "Photo and item are required" }, { status: 400 });
  if (!file.type.startsWith("image/") || file.size > 15_000_000) return Response.json({ error: "Use an image smaller than 15 MB" }, { status: 400 });
  const item = await bindings().DB.prepare("SELECT id FROM items WHERE id = ? AND project_id = 1").bind(itemId).first();
  if (!item) return Response.json({ error: "Item not found" }, { status: 404 });
  const extension = file.type === "image/png" ? "png" : "jpg";
  const key = `project-1/items/${itemId}/${crypto.randomUUID()}.${extension}`;
  await bindings().MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const row = await bindings().DB.prepare("INSERT INTO photos (item_id, object_key) VALUES (?, ?) RETURNING id, item_id, created_at").bind(itemId, key).first();
  return Response.json({ photo: metadata(row as Record<string, unknown>) }, { status: 201 });
}
