"use client";

import { useRouter } from "next/navigation";
import { AudioLines, Loader2, Mic, RotateCcw, StopCircle, Upload, WandSparkles, XCircle } from "lucide-react";
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

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: { [key: number]: { transcript: string }; isFinal: boolean }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

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
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [audioSource, setAudioSource] = useState<"recorded" | "uploaded" | null>(null);
  const [liveSubtitle, setLiveSubtitle] = useState("");
  const [canLiveTranscribe, setCanLiveTranscribe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<ProcessResponse | null>(null);
  const [showReadyBanner, setShowReadyBanner] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const discardOnStopRef = useRef(false);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);

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
    if (typeof window !== "undefined") {
      const constructor = (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
        .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition;
      setCanLiveTranscribe(Boolean(constructor));
    }

    return () => {
      stopTimer();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
      }
      stopStream();
    };
  }, []);

  const uploadLabel = useMemo(() => {
    if (!file) {
      return "No audio selected";
    }

    if (audioSource === "recorded") {
      return `Recorded audio ready${recordedSeconds > 0 ? ` (${formatDuration(recordedSeconds)})` : ""}`;
    }

    return "Uploaded audio ready";
  }, [audioSource, file, recordedSeconds]);

  const stopLiveTranscription = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
  };

  const startLiveTranscription = () => {
    if (!canLiveTranscribe || typeof window === "undefined") {
      return;
    }

    const constructor = (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
      .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition;
    if (!constructor) {
      return;
    }

    const recognition = new constructor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let latestText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        latestText += `${event.results[i][0].transcript} `;
      }
      const cleaned = latestText.trim().replace(/\s+/g, " ");
      setLiveSubtitle(cleaned);
    };
    recognition.onerror = () => {
      // Ignore soft failures; recording continues.
    };
    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch {
          // Ignore restart failures.
        }
      }
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!isRecorderSupported || isRecording) {
      return;
    }

    try {
      setError(null);
      setLatest(null);
      setShowReadyBanner(false);
      setLiveSubtitle("");

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
      discardOnStopRef.current = false;
      chunksRef.current = [];
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

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
        setIsRecording(false);

        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });

        if (discardOnStopRef.current) {
          chunksRef.current = [];
          stopStream();
          discardOnStopRef.current = false;
          return;
        }

        if (blob.size === 0) {
          setError("No audio captured. Please record again.");
          stopStream();
          return;
        }

        const extension = extensionFromMimeType(finalMimeType);
        const recordedFile = new File([blob], `recording.${extension}`, {
          type: finalMimeType,
          lastModified: Date.now(),
        });

        setFile(recordedFile);
        setAudioSource("recorded");
        setRecordedSeconds(recordingSecondsRef.current);
        stopStream();
      };

      recorder.start(1000);
      setIsRecording(true);
      startLiveTranscription();
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => {
          const next = seconds + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch {
      setError("Microphone access denied or unavailable.");
      setIsRecording(false);
      stopLiveTranscription();
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
    stopLiveTranscription();
  };

  const cancelRecording = () => {
    if (!isRecording) {
      return;
    }

    discardOnStopRef.current = true;
    stopTimer();
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      stopLiveTranscription();
      return;
    }

    stopLiveTranscription();
    stopStream();
    setIsRecording(false);
  };

  const resetAudioSelection = () => {
    setFile(null);
    setAudioSource(null);
    setRecordedSeconds(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startLibraryRefreshLoop = () => {
    if (refreshIntervalRef.current !== null) {
      window.clearInterval(refreshIntervalRef.current);
    }
    window.setTimeout(() => router.refresh(), 500);
    refreshIntervalRef.current = window.setInterval(() => {
      router.refresh();
    }, 3000);
  };

  const stopLibraryRefreshLoop = () => {
    if (refreshIntervalRef.current !== null) {
      window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
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
    startLibraryRefreshLoop();

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
      setShowReadyBanner(true);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unexpected failure.";
      setError(message);
    } finally {
      setIsProcessingAudio(false);
      stopLibraryRefreshLoop();
      router.refresh();
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
    setShowReadyBanner(false);
    setIsProcessingText(true);
    startLibraryRefreshLoop();

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
      setShowReadyBanner(true);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unexpected failure.";
      setError(message);
    } finally {
      setIsProcessingText(false);
      stopLibraryRefreshLoop();
      router.refresh();
    }
  };

  const captureStatusText = isRecording
    ? `Recording ${formatDuration(recordingSeconds)}`
    : file && audioSource === "recorded"
      ? `Recorded ${formatDuration(recordedSeconds)} ready`
      : file && audioSource === "uploaded"
        ? "Uploaded audio ready"
        : "Tap mic to start recording";

  return (
    <Card className="glass-panel rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5">
        <CardTitle className="text-base sm:text-lg" />

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
                className="h-28 w-28 rounded-full text-sm"
                disabled={!isHydrated || !isRecorderSupported}
                onClick={isRecording ? stopRecording : startRecording}
                size="icon"
                type="button"
                variant={isRecording ? "destructive" : "default"}
              >
                {isRecording ? <StopCircle className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
              </Button>

              <p className="mt-3 text-sm text-muted-foreground">{captureStatusText}</p>

              {isRecording ? (
                <div aria-hidden className="recording-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {isRecording ? (
                <p className="subtitle-preview">{liveSubtitle || "Listening..."}</p>
              ) : null}

              {isRecording && !canLiveTranscribe ? (
                <p className="text-xs text-muted-foreground">Live subtitle preview is not supported in this browser.</p>
              ) : null}

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="secondary">
                  <Upload className="h-3.5 w-3.5" />
                  Upload audio
                </Button>
                <Badge className="max-w-[240px] truncate" variant="outline">
                  {uploadLabel}
                </Badge>
                {file ? (
                  <Button onClick={resetAudioSelection} size="sm" type="button" variant="ghost">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                ) : null}
                {isRecording ? (
                  <Button onClick={cancelRecording} size="sm" type="button" variant="destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                ) : null}
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
              onChange={(event) => {
                const selectedFile = event.currentTarget.files?.[0] ?? null;
                setFile(selectedFile);
                setAudioSource(selectedFile ? "uploaded" : null);
                setRecordedSeconds(0);
              }}
              ref={fileInputRef}
              type="file"
            />

            <Button className="w-full" disabled={isRecording || isProcessingAudio} type="submit">
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
            <Button className="w-full" disabled={isRecording || isProcessingText} type="submit">
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

        {error ? (
          <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
        ) : null}

        {latest && showReadyBanner ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 sm:flex-row sm:items-center">
            <p className="text-sm text-emerald-200">
              Notes ready: <strong>{latest.sermon.title}</strong>
              {latest.reused ? " (reused)" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <a href={latest.sermon.gamma_url} rel="noreferrer" target="_blank">
                  Open Notes
                </a>
              </Button>
              <Button onClick={() => setShowReadyBanner(false)} size="sm" type="button" variant="ghost">
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
