import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the simple Punch House list and its three designs", async () => {
  const [page, layout, hosting, schema, report] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/report-pdf.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Punch House/);
  assert.match(layout, /width: "device-width"/);
  assert.match(page, /House punch list/);
  assert.match(page, /Field notes/);
  assert.match(page, /Blueprint/);
  assert.match(page, /Clean ledger/);
  assert.match(page, /Add a room/);
  assert.match(page, /room-tag/);
  assert.match(page, /Open camera/);
  assert.match(page, /Choose photo/);
  assert.match(page, /MarkupEditor/);
  assert.match(page, /EditItemDialog/);
  assert.match(page, /deleteRoom/);
  assert.match(page, /quickCamera/);
  assert.match(page, /AddressEditor/);
  assert.match(page, /Undo/);
  assert.match(page, /"text"/);
  assert.match(page, /print-photo-links/);
  assert.match(page, /Photo \{photoIndex \+ 1\}/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "MEDIA"/);
  assert.match(schema, /idx_rooms_project_name/);
  assert.match(schema, /idx_photos_project_item/);
  assert.match(schema, /projectSettings/);
  assert.match(page, /Download PDF/);
  assert.match(report, /textWithLink/);
  assert.match(report, /new URL\(photo.url, origin\)/);
  assert.doesNotMatch(page, /window\.print/);
  assert.doesNotMatch(page, /Verify repair|Contractor/);
});
