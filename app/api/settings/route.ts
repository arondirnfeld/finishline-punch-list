import { env } from "cloudflare:workers";

type Bindings = { DB: D1Database };
const db = () => (env as unknown as Bindings).DB;

async function ready() {
  await db()
    .prepare(
      `CREATE TABLE IF NOT EXISTS project_settings (
        project_id INTEGER PRIMARY KEY DEFAULT 1,
        address TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
  await db().prepare("INSERT OR IGNORE INTO project_settings (project_id, address) VALUES (1, '')").run();
}

export async function GET() {
  await ready();
  const row = await db()
    .prepare("SELECT address FROM project_settings WHERE project_id = 1")
    .first<{ address: string }>();
  return Response.json({ address: row?.address ?? "" });
}

export async function PATCH(request: Request) {
  await ready();
  const data = (await request.json()) as { address?: string };
  const address = data.address?.trim();
  if (!address) return Response.json({ error: "Address is required" }, { status: 400 });
  await db()
    .prepare("UPDATE project_settings SET address = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = 1")
    .bind(address)
    .run();
  return Response.json({ address });
}
