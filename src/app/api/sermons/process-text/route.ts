import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { processSermonTranscript } from "@/lib/sermon/process";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const payloadSchema = z.object({
  transcript: z.string().min(40).max(120000),
});

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

  let payload: z.infer<typeof payloadSchema>;

  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid payload. Provide transcript text of at least 40 characters." },
      { status: 400 },
    );
  }

  const transcript = payload.transcript.trim();
  const hash = createHash("sha256").update(transcript).digest("hex");
  const idempotencyKey = `text_sha256:${hash}`;

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
    const processed = await processSermonTranscript(transcript);

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
