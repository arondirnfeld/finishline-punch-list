import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the simple Punch House list and its three designs", async () => {
  const [page, layout, hosting, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Punch House/);
  assert.match(page, /House punch list/);
  assert.match(page, /Field notes/);
  assert.match(page, /Blueprint/);
  assert.match(page, /Clean ledger/);
  assert.match(page, /Add a room/);
  assert.match(page, /room-tag/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": null/);
  assert.match(schema, /idx_rooms_project_name/);
  assert.doesNotMatch(page, /Photo markup|Verify repair|Contractor/);
});
