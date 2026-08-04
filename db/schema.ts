import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().default(1),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_rooms_project_name").on(table.projectId, table.name),
]);

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().default(1),
  room: text("room").notNull(),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: ["open", "in_progress", "completed"] }).notNull().default("open"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  beforePhoto: text("before_photo"),
  afterPhoto: text("after_photo"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_items_project_room").on(table.projectId, table.room),
  index("idx_items_project_status").on(table.projectId, table.status),
]);
