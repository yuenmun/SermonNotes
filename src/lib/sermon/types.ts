import { z } from "zod";

export const sermonOutlineSchema = z.object({
  title: z.string().min(3).max(140),
  heroVerse: z.string().min(3).max(600).nullable(),
  verseReferences: z.array(z.string().min(2).max(120)).max(20).default([]),
  keyPoints: z.array(z.string().min(3).max(1000)).min(3).max(3),
  summary: z.string().min(20).max(3000),
});

export type SermonOutline = z.infer<typeof sermonOutlineSchema>;

export interface ProcessedSermon {
  title: string;
  heroVerse: string | null;
  verseReferences: string[];
  keyPoints: string[];
  summary: string;
  transcriptExcerpt: string;
  gammaUrl: string;
  gammaRequestId?: string;
}
