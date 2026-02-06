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

  try {
    const processed = await processSermonAudio(audioFile);

    const { data: inserted, error: insertError } = await supabase
      .from("sermons")
      .insert({
        user_id: user.id,
        title: processed.title,
        gamma_url: processed.gammaUrl,
        status: "ready",
        hero_verse: processed.heroVerse,
        scripture_references: processed.verseReferences,
        key_points: processed.keyPoints,
        transcript_excerpt: processed.transcriptExcerpt,
        idempotency_key: idempotencyKey,
        gamma_request_id: processed.gammaRequestId ?? null,
      })
      .select(SERMON_SELECT)
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Unable to archive sermon row");
    }

    return NextResponse.json({ sermon: inserted }, { status: 200 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
