import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function requireUser(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: User; error?: undefined }
  | { supabase?: undefined; user?: undefined; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}
