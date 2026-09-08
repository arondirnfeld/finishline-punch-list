import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database };
const db = () => (env as unknown as Bindings).DB;

const DEFAULT_ROOMS = ["Kitchen", "Living Room", "Primary Bedroom", "Bathroom", "Basement", "Exterior"];

async function ready() {
  const d1 = db();
  await d1.batch([
    d1.prepare(
      `CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_rooms_project_name ON rooms(project_id, name)"),
    d1.prepare("CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
  ]);

  const count = await d1.prepare("SELECT COUNT(*) AS total FROM rooms WHERE project_id = 1").first<{ total: number }>();
  const seedMarker = await d1
    .prepare("INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('starter_rooms_seeded', CURRENT_TIMESTAMP)")
    .run();
  if (seedMarker.meta.changes > 0 && !count?.total) {
    await d1.batch(DEFAULT_ROOMS.map((name) => d1.prepare("INSERT INTO rooms (name) VALUES (?)").bind(name)));
  }
}

export async function GET() {
  await ready();
  const result = await db().prepare("SELECT id, name FROM rooms WHERE project_id = 1 ORDER BY id").all();
  return Response.json({ rooms: result.results });
}

export async function POST(request: Request) {
  await ready();
  const data = (await request.json()) as { name?: string };
  const name = data.name?.trim();
  if (!name) return Response.json({ error: "Room name is required" }, { status: 400 });
  const existing = await db()
    .prepare("SELECT id, name FROM rooms WHERE project_id = 1 AND lower(name) = lower(?)")
    .bind(name)
    .first();
  if (existing) return Response.json({ room: existing });
  const room = await db().prepare("INSERT INTO rooms (name) VALUES (?) RETURNING id, name").bind(name).first();
  return Response.json({ room }, { status: 201 });
}

export async function DELETE(request: Request) {
  await ready();
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim();
  const moveTo = url.searchParams.get("moveTo")?.trim();
  if (!name) return Response.json({ error: "Room name is required" }, { status: 400 });

  const roomCount = await db().prepare("SELECT COUNT(*) AS total FROM rooms WHERE project_id = 1").first<{ total: number }>();
  if ((roomCount?.total ?? 0) <= 1) {
    return Response.json({ error: "Add another room before removing this one." }, { status: 409 });
  }

  const used = await db()
    .prepare("SELECT COUNT(*) AS total FROM items WHERE project_id = 1 AND room = ?")
    .bind(name)
    .first<{ total: number }>();
  if (used?.total && (!moveTo || moveTo.toLowerCase() === name.toLowerCase())) {
    return Response.json({ error: `Choose a room for the ${used.total} lines currently in ${name}.` }, { status: 409 });
  }

  if (used?.total) {
    const destination = await db()
      .prepare("SELECT name FROM rooms WHERE project_id = 1 AND lower(name) = lower(?)")
      .bind(moveTo)
      .first<{ name: string }>();
    if (!destination) return Response.json({ error: "The destination room was not found." }, { status: 400 });
    await db().batch([
      db().prepare("UPDATE items SET room = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = 1 AND room = ?").bind(destination.name, name),
      db().prepare("DELETE FROM rooms WHERE project_id = 1 AND name = ?").bind(name),
    ]);
  } else {
    await db().prepare("DELETE FROM rooms WHERE project_id = 1 AND name = ?").bind(name).run();
  }
  return Response.json({ deleted: true });
}
