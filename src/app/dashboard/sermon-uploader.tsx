"use client";

import { useRouter } from "next/navigation";
import { AudioLines, CircleDot, Loader2, Mic, StopCircle, Upload, WandSparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ProcessResponse {
  sermon: {
    id: string;
    title: string;
    gamma_url: string;
  };
  reused?: boolean;
}

const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
};

const extensionFromMimeType = (mimeType?: string) => {
  if (!mimeType) {
    return "webm";
  }

  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
};

const formatDuration = (seconds: number) => {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

export function SermonUploader() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [inputMode, setInputMode] = useState<"audio" | "text">("audio");
  const [file, setFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<ProcessResponse | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = isProcessingAudio || isProcessingText;

  const isRecorderSupported =
    isHydrated &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    setIsHydrated(true);

    return () => {
      stopTimer();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      stopStream();
    };
  }, []);

  const uploadLabel = useMemo(() => {
    if (!file) {
      return "No file selected";
    }

    const sizeMb = Math.max(1, Math.round(file.size / 1024 / 1024));
    return `${file.name} (${sizeMb} MB)`;
  }, [file]);

  const startRecording = async () => {
    if (!isRecorderSupported || isRecording || isBusy) {
      return;
    }

    try {
      setError(null);
      setLatest(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
      };

      recorder.onstop = () => {
        stopTimer();

        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });

        if (blob.size === 0) {
          setError("No audio captured. Please record again.");
          stopStream();
          return;
        }

        const extension = extensionFromMimeType(finalMimeType);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const recordedFile = new File([blob], `sermon-${timestamp}.${extension}`, {
          type: finalMimeType,
          lastModified: Date.now(),
        });

        setFile(recordedFile);
        setIsRecording(false);
        stopStream();
      };

      recorder.start(1000);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch {
      setError("Microphone access denied or unavailable.");
      setIsRecording(false);
      stopTimer();
      stopStream();
    }
  };

  const stopRecording = () => {
    if (!isRecording) {
      return;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const onAudioSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Record or select an audio file first.");
      return;
    }

    const body = new FormData();
    body.append("audio", file);

    setError(null);
    setLatest(null);
    setIsProcessingAudio(true);

    try {
      const response = await fetch("/api/sermons/process", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as { error?: string } & ProcessResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Processing failed.");
      }

      setLatest(payload);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unexpected failure.";
      setError(message);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const onTextSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (transcriptText.trim().length < 40) {
      setError("Paste at least 40 characters of sermon text.");
      return;
    }

    setError(null);
    setLatest(null);
    setIsProcessingText(true);

    try {
      const response = await fetch("/api/sermons/process-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });

      const payload = (await response.json()) as { error?: string } & ProcessResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Text processing failed.");
      }

      setLatest(payload);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unexpected failure.";
      setError(message);
    } finally {
      setIsProcessingText(false);
    }
  };

  return (
    <Card className="glass-panel rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="mono-kicker">Command</p>
          <CardTitle className="text-base sm:text-lg">Create Sermon Page</CardTitle>
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-black/35 p-1">
          <Button
            className="h-8 px-3"
            onClick={() => setInputMode("audio")}
            size="sm"
            type="button"
            variant={inputMode === "audio" ? "default" : "ghost"}
          >
            <AudioLines className="h-3.5 w-3.5" />
            Audio
          </Button>
          <Button
            className="h-8 px-3"
            onClick={() => setInputMode("text")}
            size="sm"
            type="button"
            variant={inputMode === "text" ? "default" : "ghost"}
          >
            Paste
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        {inputMode === "audio" ? (
          <form className="space-y-4" onSubmit={onAudioSubmit}>
            <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/35 p-5">
              <Button
                className={`h-28 w-28 rounded-full text-sm ${isRecording ? "animate-pulse-soft" : ""}`}
                disabled={!isHydrated || !isRecorderSupported || isBusy}
                onClick={isRecording ? stopRecording : startRecording}
                size="icon"
                type="button"
                variant={isRecording ? "destructive" : "default"}
              >
                {isRecording ? <StopCircle className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
              </Button>

              <p className="mt-3 text-sm text-muted-foreground">
                {isRecording ? `Recording ${formatDuration(recordingSeconds)}` : "Tap mic to start recording"}
              </p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="secondary">
                  <Upload className="h-3.5 w-3.5" />
                  Upload audio
                </Button>
                <Badge className="max-w-[240px] truncate" variant="outline">
                  {uploadLabel}
                </Badge>
              </div>
            </div>

            {isHydrated && !isRecorderSupported ? (
              <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                This browser does not support microphone capture.
              </p>
            ) : null}

            <input
              accept="audio/*"
              className="hidden"
              id="audio"
              name="audio"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />

            <Button className="w-full" disabled={isBusy || isRecording} type="submit">
              {isProcessingAudio ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" />
                  Generate Notes
                </>
              )}
            </Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={onTextSubmit}>
            <Textarea
              className="min-h-[170px]"
              onChange={(event) => setTranscriptText(event.currentTarget.value)}
              placeholder="Paste sermon transcript..."
              value={transcriptText}
            />
            <Button className="w-full" disabled={isBusy || isRecording} type="submit">
              {isProcessingText ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" />
                  Generate from Text
                </>
              )}
            </Button>
          </form>
        )}

        {isBusy ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-white/80" />
              <p className="text-sm">Processing</p>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant={isProcessingAudio ? "secondary" : "outline"}>Whisper</Badge>
              <Badge variant="secondary">GPT-5 mini</Badge>
              <Badge variant="secondary">Gamma</Badge>
              <Badge variant="secondary">Supabase</Badge>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="absolute inset-y-0 w-1/3 animate-shimmer bg-white/70" />
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
        ) : null}

        {latest ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 sm:flex-row sm:items-center">
            <p className="text-sm text-emerald-200">
              Ready: <strong>{latest.sermon.title}</strong>
              {latest.reused ? " (reused)" : ""}
            </p>
            <Button asChild size="sm" variant="secondary">
              <a href={latest.sermon.gamma_url} rel="noreferrer" target="_blank">
                Open Gamma
              </a>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
