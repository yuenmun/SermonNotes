import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { processSermonAudio } from "@/lib/sermon/process";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 150 * 1024 * 1024;
const SERMON_SELECT =
  "id,title,gamma_url,created_at,status,pastor_name,tags,hero_verse,scripture_references";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio");

  if (!(audioFile instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  if (!audioFile.type.startsWith("audio/")) {
    return NextResponse.json({ error: "File must be an audio format" }, { status: 400 });
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio file exceeds 150MB limit" }, { status: 400 });
  }

  const hash = createHash("sha256").update(Buffer.from(await audioFile.arrayBuffer())).digest("hex");
  const idempotencyKey = `audio_sha256:${hash}`;

  const { data: existing, error: existingError } = await supabase
    .from("sermons")
    .select(SERMON_SELECT)
    .eq("user_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!existingError && existing) {
    return NextResponse.json({ sermon: existing, reused: true }, { status: 200 });
  }

  const { data: created, error: createError } = await supabase
    .from("sermons")
    .insert({
      user_id: user.id,
      title: "Processing notes...",
      gamma_url: "#",
      status: "processing",
      idempotency_key: idempotencyKey,
    })
    .select(SERMON_SELECT)
    .single();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? "Unable to create processing job" }, { status: 500 });
  }

  try {
    const processed = await processSermonAudio(audioFile);

    const { data: updated, error: updateError } = await supabase
      .from("sermons")
      .update({
        title: processed.title,
        gamma_url: processed.gammaUrl,
        status: "ready",
        hero_verse: processed.heroVerse,
        scripture_references: processed.verseReferences,
        key_points: processed.keyPoints,
        transcript_excerpt: processed.transcriptExcerpt,
        gamma_request_id: processed.gammaRequestId ?? null,
      })
      .eq("id", created.id)
      .select(SERMON_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Unable to update sermon row");
    }

    return NextResponse.json({ sermon: updated }, { status: 200 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Processing failed";
    await supabase
      .from("sermons")
      .update({
        status: "failed",
        title: "Processing failed",
      })
      .eq("id", created.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
