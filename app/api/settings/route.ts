import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("project_settings")
    .select("address")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ address: data?.address ?? "" });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const body = (await request.json()) as { address?: string };
  const address = body.address?.trim();
  if (!address) return NextResponse.json({ error: "Address is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_settings")
    .upsert(
      {
        user_id: user.id,
        address,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("address")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ address: data.address });
}
