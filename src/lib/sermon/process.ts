import { generateGammaWebpage } from "@/lib/gamma/client";
import { serverEnv } from "@/lib/env";
import { getOpenAiClient } from "@/lib/openai/client";
import { extractSermonOutline } from "@/lib/sermon/orchestrator";
import type { ProcessedSermon } from "@/lib/sermon/types";

const MAX_TRANSCRIPT_EXCERPT_LENGTH = 3000;

const buildGammaInputText = (args: {
  title: string;
  heroVerse: string | null;
  verseReferences: string[];
  keyPoints: string[];
  summary: string;
}) => {
  const points = args.keyPoints.map((point, index) => `${index + 1}. ${point}`).join("\n");
  const references = args.verseReferences.length > 0 ? args.verseReferences.join(", ") : "None explicitly cited";

  return [
    "Create a clean sermon summary webpage.",
    "Do not include any CTA/action buttons or sections.",
    "Do not include text like 'Watch Message', 'Share Sermon', 'Learn More', or similar actions.",
    "The page should contain only title, hero verse, scripture references, key points, and summary content.",
    `Sermon Title: ${args.title}`,
    `Hero Verse: ${args.heroVerse ?? "None explicitly cited"}`,
    `Scripture References: ${references}`,
    "Key Points:",
    points,
    "Summary:",
    args.summary,
  ].join("\n\n");
};

export const processSermonTranscript = async (transcriptText: string): Promise<ProcessedSermon> => {
  const cleanedTranscript = transcriptText.trim();

  if (!cleanedTranscript) {
    throw new Error("Transcript is empty.");
  }

  const outline = await extractSermonOutline(cleanedTranscript);

  const gammaResult = await generateGammaWebpage({
    gammaId: serverEnv.gammaTemplateId || undefined,
    prompt: buildGammaInputText(outline),
    themeId: serverEnv.gammaThemeId,
    folderId: serverEnv.gammaFolderId,
  });

  return {
    title: outline.title,
    heroVerse: outline.heroVerse,
    verseReferences: outline.verseReferences,
    keyPoints: outline.keyPoints,
    summary: outline.summary,
    transcriptExcerpt: cleanedTranscript.slice(0, MAX_TRANSCRIPT_EXCERPT_LENGTH),
    gammaUrl: gammaResult.gammaUrl,
    gammaRequestId: gammaResult.requestId,
  };
};

export const processSermonAudio = async (audioFile: File): Promise<ProcessedSermon> => {
  const openai = getOpenAiClient();

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
  });

  return processSermonTranscript(transcription.text);
};
