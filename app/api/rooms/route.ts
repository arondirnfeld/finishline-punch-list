import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database };
const db = () => (env as unknown as Bindings).DB;

async function ready() {
  const d1 = db();
  await d1.batch([
    d1.prepare("CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_rooms_project_name ON rooms(project_id, name)"),
  ]);
  const count = await d1.prepare("SELECT COUNT(*) AS total FROM rooms WHERE project_id = 1").first<{ total: number }>();
  if (!count?.total) {
    await d1.batch(["Kitchen", "Living Room", "Primary Bedroom", "Bathroom", "Basement", "Exterior"].map((name) => d1.prepare("INSERT INTO rooms (name) VALUES (?)").bind(name)));
  }
}

export async function GET() {
  await ready();
  const result = await db().prepare("SELECT id, name FROM rooms WHERE project_id = 1 ORDER BY id").all();
  return Response.json({ rooms: result.results });
}

export async function POST(request: Request) {
  await ready();
  const data = await request.json() as { name?: string };
  const name = data.name?.trim();
  if (!name) return Response.json({ error: "Room name is required" }, { status: 400 });
  const existing = await db().prepare("SELECT id, name FROM rooms WHERE project_id = 1 AND lower(name) = lower(?)").bind(name).first();
  if (existing) return Response.json({ room: existing });
  const room = await db().prepare("INSERT INTO rooms (name) VALUES (?) RETURNING id, name").bind(name).first();
  return Response.json({ room }, { status: 201 });
}

export async function DELETE(request: Request) {
  await ready();
  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!name) return Response.json({ error: "Room name is required" }, { status: 400 });
  const used = await db().prepare("SELECT COUNT(*) AS total FROM items WHERE project_id = 1 AND room = ?").bind(name).first<{ total: number }>();
  if (used?.total) return Response.json({ error: `Move or delete the ${used.total} items in ${name} first.` }, { status: 409 });
  await db().prepare("DELETE FROM rooms WHERE project_id = 1 AND name = ?").bind(name).run();
  return Response.json({ deleted: true });
}
