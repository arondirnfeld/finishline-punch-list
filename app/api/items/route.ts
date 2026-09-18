import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";

function row(item: {
  id: number;
  room: string;
  title: string;
  status: string;
  sort_order: number;
}) {
  return {
    id: item.id,
    room: item.room,
    title: item.title,
    status: item.status,
    sortOrder: item.sort_order,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("items")
    .select("id, room, title, status, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map(row) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const body = (await request.json()) as { room?: string; title?: string };
  if (!body.title?.trim() || !body.room?.trim()) {
    return NextResponse.json({ error: "Room and description are required" }, { status: 400 });
  }

  const { data: maxRow } = await supabase
    .from("items")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? 0) + 1;
  const { data, error } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      room: body.room.trim(),
      title: body.title.trim(),
      sort_order: sortOrder,
    })
    .select("id, room, title, status, sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: row(data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const body = (await request.json()) as {
    id?: number;
    order?: number[];
    room?: string;
    title?: string;
    status?: string;
  };

  if (Array.isArray(body.order)) {
    const ids = [...new Set(body.order.filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return NextResponse.json({ error: "At least one item is required" }, { status: 400 });

    const updates = ids.map((id, index) =>
      supabase
        .from("items")
        .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    return NextResponse.json({ reordered: true });
  }

  if (!body.id) return NextResponse.json({ error: "Item id is required" }, { status: 400 });

  const { data: current, error: currentError } = await supabase
    .from("items")
    .select("id, room, title, status, sort_order")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const status = body.status === "open" || body.status === "completed" ? body.status : current.status;
  const { data, error } = await supabase
    .from("items")
    .update({
      room: body.room ?? current.room,
      title: body.title ?? current.title,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("id, room, title, status, sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: row(data) });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Item id is required" }, { status: 400 });

  const { data: photoRows } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("item_id", id)
    .eq("user_id", user.id);

  const paths = (photoRows ?? []).map((photo) => photo.storage_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from("punch-photos").remove(paths);
  }

  const { error } = await supabase.from("items").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
