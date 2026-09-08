import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database; MEDIA: R2Bucket };
const bindings = () => env as unknown as Bindings;
const db = () => bindings().DB;

async function ready() {
  const d1 = db();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL DEFAULT 1,
      room TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_items_project_room ON items(project_id, room)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_items_project_status ON items(project_id, status)`),
  ]);
}

function row(item: Record<string, unknown>) {
  return {
    id: item.id,
    room: item.room,
    title: item.title,
    status: item.status,
    sortOrder: item.sort_order,
  };
}

export async function GET() {
  await ready();
  const result = await db()
    .prepare("SELECT id, room, title, status, sort_order FROM items WHERE project_id = 1 ORDER BY sort_order, id")
    .all();
  return Response.json({ items: result.results.map((r) => row(r as Record<string, unknown>)) });
}

export async function POST(request: Request) {
  await ready();
  const data = (await request.json()) as { room?: string; title?: string };
  if (!data.title?.trim() || !data.room?.trim()) {
    return Response.json({ error: "Room and description are required" }, { status: 400 });
  }
  const result = await db()
    .prepare(
      `INSERT INTO items (room, title, sort_order)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM items WHERE project_id = 1))
       RETURNING id, room, title, status, sort_order`,
    )
    .bind(data.room.trim(), data.title.trim())
    .first();
  return Response.json({ item: row(result as Record<string, unknown>) }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ready();
  const data = (await request.json()) as {
    id?: number;
    order?: number[];
    room?: string;
    title?: string;
    status?: string;
  };

  if (Array.isArray(data.order)) {
    const ids = [...new Set(data.order.filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return Response.json({ error: "At least one item is required" }, { status: 400 });
    await db().batch(
      ids.map((id, index) =>
        db()
          .prepare("UPDATE items SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = 1")
          .bind(index + 1, id),
      ),
    );
    return Response.json({ reordered: true });
  }

  if (!data.id) return Response.json({ error: "Item id is required" }, { status: 400 });
  const current = await db()
    .prepare("SELECT id, room, title, status, sort_order FROM items WHERE id = ? AND project_id = 1")
    .bind(data.id)
    .first();
  if (!current) return Response.json({ error: "Item not found" }, { status: 404 });

  const c = current as Record<string, unknown>;
  const status = data.status === "open" || data.status === "completed" ? data.status : c.status;
  const result = await db()
    .prepare(
      `UPDATE items
       SET room = ?, title = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING id, room, title, status, sort_order`,
    )
    .bind(data.room ?? c.room, data.title ?? c.title, status, data.id)
    .first();
  return Response.json({ item: row(result as Record<string, unknown>) });
}

export async function DELETE(request: Request) {
  await ready();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Item id is required" }, { status: 400 });
  const keys = await db()
    .prepare("SELECT object_key FROM photos WHERE item_id = ? AND project_id = 1")
    .bind(id)
    .all<{ object_key: string }>();
  if (keys.results.length) await bindings().MEDIA.delete(keys.results.map((entry) => entry.object_key));
  await db().batch([
    db().prepare("DELETE FROM photos WHERE item_id = ? AND project_id = 1").bind(id),
    db().prepare("DELETE FROM items WHERE id = ? AND project_id = 1").bind(id),
  ]);
  return Response.json({ deleted: true });
}
