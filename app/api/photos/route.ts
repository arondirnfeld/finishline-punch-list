import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";

function metadata(row: { id: number; item_id: number; created_at: string }) {
  return {
    id: row.id,
    itemId: row.item_id,
    createdAt: row.created_at,
    url: `/api/photos?id=${row.id}&file=1`,
  };
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));

  if (id && url.searchParams.get("file") === "1") {
    const { data: row } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return new NextResponse("Not found", { status: 404 });

    const { data, error } = await supabase.storage.from("punch-photos").download(row.storage_path);
    if (error || !data) return new NextResponse("Not found", { status: 404 });

    const headers = new Headers();
    headers.set("content-type", data.type || "image/jpeg");
    headers.set("cache-control", "private, max-age=3600");
    return new NextResponse(data.stream(), { headers });
  }

  const itemId = Number(url.searchParams.get("itemId"));
  let query = supabase
    .from("photos")
    .select("id, item_id, created_at")
    .eq("user_id", user.id)
    .order("id", { ascending: true });

  if (itemId) query = query.eq("item_id", itemId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: (data ?? []).map(metadata) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const form = await request.formData();
  const file = form.get("file");
  const itemId = Number(form.get("itemId"));
  if (!(file instanceof File) || !itemId) {
    return NextResponse.json({ error: "Photo and item are required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size > 15_000_000) {
    return NextResponse.json({ error: "Use an image smaller than 15 MB" }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("items")
    .select("id")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${itemId}/${crypto.randomUUID()}.${extension}`;
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from("punch-photos").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("photos")
    .insert({
      user_id: user.id,
      item_id: itemId,
      storage_path: path,
    })
    .select("id, item_id, created_at")
    .single();

  if (error) {
    await supabase.storage.from("punch-photos").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ photo: metadata(data) }, { status: 201 });
}
