import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  await supabase.rpc("ensure_default_rooms");

  const { data, error } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("user_id", user.id)
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rooms: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Room name is required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return NextResponse.json({ room: existing });

  const { data, error } = await supabase
    .from("rooms")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim();
  const moveTo = url.searchParams.get("moveTo")?.trim();
  if (!name) return NextResponse.json({ error: "Room name is required" }, { status: 400 });

  const { count: roomCount } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((roomCount ?? 0) <= 1) {
    return NextResponse.json({ error: "Add another room before removing this one." }, { status: 409 });
  }

  const { count: used } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("room", name);

  if ((used ?? 0) > 0 && (!moveTo || moveTo.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: `Choose a room for the ${used} lines currently in ${name}.` },
      { status: 409 },
    );
  }

  if ((used ?? 0) > 0) {
    const { data: destination } = await supabase
      .from("rooms")
      .select("name")
      .eq("user_id", user.id)
      .ilike("name", moveTo!)
      .maybeSingle();
    if (!destination) {
      return NextResponse.json({ error: "The destination room was not found." }, { status: 400 });
    }

    const { error: moveError } = await supabase
      .from("items")
      .update({ room: destination.name, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("room", name);
    if (moveError) return NextResponse.json({ error: moveError.message }, { status: 500 });
  }

  const { error } = await supabase.from("rooms").delete().eq("user_id", user.id).eq("name", name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
