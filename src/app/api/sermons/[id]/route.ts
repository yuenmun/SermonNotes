import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeTags } from "@/lib/sermon/tags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  pastor_name: z.string().max(140).nullable().optional(),
  tags: z.array(z.string()).max(30).optional(),
});

const SERMON_SELECT =
  "id,title,gamma_url,created_at,status,pastor_name,tags,hero_verse,scripture_references";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof patchSchema>;

  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (typeof payload.title === "string") {
    update.title = payload.title.trim();
  }

  if (payload.pastor_name !== undefined) {
    update.pastor_name = payload.pastor_name?.trim() || null;
  }

  if (payload.tags) {
    update.tags = normalizeTags(payload.tags);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sermons")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select(SERMON_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Sermon not found" }, { status: 404 });
  }

  return NextResponse.json({ sermon: data }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sermons")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Sermon not found" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id }, { status: 200 });
}
