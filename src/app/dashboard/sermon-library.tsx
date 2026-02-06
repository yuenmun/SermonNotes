"use client";

import {
  ExternalLink,
  Grid2X2,
  List,
  Pencil,
  Save,
  Share2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Sermon = {
  id: string;
  title: string;
  gamma_url: string;
  created_at: string;
  status: "processing" | "ready" | "failed";
  pastor_name: string | null;
  tags: string[] | null;
  hero_verse: string | null;
  scripture_references: string[] | null;
};

interface SermonLibraryProps {
  initialSermons: Sermon[];
  error?: string;
}

type ViewMode = "grid" | "list";

type EditState = {
  id: string;
  title: string;
  pastorName: string;
  tags: string[];
  newTag: string;
};

const normalizeArray = (tags: string[] | null | undefined) => tags?.filter(Boolean) ?? [];

const sermonDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatSermonDate = (value: string) => sermonDateFormatter.format(new Date(value));

export function SermonLibrary({ initialSermons, error }: SermonLibraryProps) {
  const [sermons, setSermons] = useState<Sermon[]>(initialSermons);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  useEffect(() => {
    setSermons(initialSermons);
  }, [initialSermons]);

  const allTags = useMemo(() => {
    const map = new Map<string, string>();

    for (const sermon of sermons) {
      for (const tag of normalizeArray(sermon.tags)) {
        const key = tag.toLowerCase();
        if (!map.has(key)) {
          map.set(key, tag);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [sermons]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sermons.filter((sermon) => {
      const tags = normalizeArray(sermon.tags);

      if (selectedTag !== "all" && !tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [sermon.title, sermon.hero_verse ?? "", sermon.pastor_name ?? "", ...tags].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, selectedTag, sermons]);

  const openGamma = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareGamma = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setInfo("Gamma link copied.");
      setTimeout(() => setInfo(null), 1500);
    } catch {
      setLocalError("Unable to copy link. Copy manually from Open.");
    }
  };

  const startEdit = (sermon: Sermon) => {
    setEdit({
      id: sermon.id,
      title: sermon.title,
      pastorName: sermon.pastor_name ?? "",
      tags: normalizeArray(sermon.tags),
      newTag: "",
    });
    setLocalError(null);
    setInfo(null);
  };

  const saveEdit = async () => {
    if (!edit) {
      return;
    }

    setBusyId(edit.id);
    setLocalError(null);

    try {
      const response = await fetch(`/api/sermons/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: edit.title,
          pastor_name: edit.pastorName || null,
          tags: edit.tags,
        }),
      });

      const payload = (await response.json()) as { error?: string; sermon?: Sermon };

      if (!response.ok || !payload.sermon) {
        throw new Error(payload.error ?? "Failed to update sermon.");
      }

      setSermons((current) => current.map((sermon) => (sermon.id === edit.id ? payload.sermon! : sermon)));
      setEdit(null);
      setInfo("Sermon updated.");
      setTimeout(() => setInfo(null), 1500);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const deleteSermon = async (id: string) => {
    const confirmed = window.confirm("Delete this sermon? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setBusyId(id);
    setLocalError(null);

    try {
      const response = await fetch(`/api/sermons/${id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete sermon");
      }

      setSermons((current) => current.filter((sermon) => sermon.id !== id));
      if (edit?.id === id) {
        setEdit(null);
      }
      setInfo("Sermon deleted.");
      setTimeout(() => setInfo(null), 1500);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const addTagToEdit = () => {
    if (!edit) {
      return;
    }

    const tag = edit.newTag.trim();
    if (!tag) {
      return;
    }

    if (edit.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setEdit({ ...edit, newTag: "" });
      return;
    }

    setEdit({ ...edit, tags: [...edit.tags, tag], newTag: "" });
  };

  const removeTagFromEdit = (tag: string) => {
    if (!edit) {
      return;
    }

    setEdit({ ...edit, tags: edit.tags.filter((item) => item !== tag) });
  };

  return (
    <Card className="glass-panel rounded-3xl">
      <CardHeader className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Sermon Library</CardTitle>
          </div>
          <div className="inline-flex rounded-xl border border-white/10 bg-black/35 p-1">
            <Button
              className="h-8 px-2.5"
              onClick={() => setViewMode("list")}
              size="sm"
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="h-8 px-2.5"
              onClick={() => setViewMode("grid")}
              size="sm"
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <Input onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search title, verse, pastor, tag" value={query} />
          <select
            className="h-10 rounded-xl border border-input bg-black/35 px-3 text-sm text-foreground"
            onChange={(event) => setSelectedTag(event.currentTarget.value)}
            value={selectedTag}
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">Unable to load sermons: {error}</p> : null}
        {localError ? <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{localError}</p> : null}
        {info ? <p className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</p> : null}
      </CardHeader>

      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No sermons found.</p> : null}

        <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3"}>
          {filtered.map((sermon, index) => {
            const isEditing = edit?.id === sermon.id;
            const tags = isEditing ? edit.tags : normalizeArray(sermon.tags);
            const verseReferences = normalizeArray(sermon.scripture_references);
            const reference = verseReferences[0] ?? sermon.hero_verse ?? "No explicit verse detected";
            const isProcessing = sermon.status === "processing";
            const canOpen = sermon.gamma_url && sermon.gamma_url !== "#";
            const statusVariant = sermon.status === "ready" ? "success" : sermon.status === "processing" ? "secondary" : "destructive";

            return (
              <article
                className={`rounded-2xl border border-white/10 bg-black/35 p-3 ${viewMode === "list" ? "sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3" : ""}`}
                key={sermon.id}
                style={{ "--delay": `${Math.min(index * 35, 260)}ms` } as CSSProperties}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant}>{sermon.status}</Badge>
                    <p className="text-xs text-muted-foreground">{formatSermonDate(sermon.created_at)}</p>
                  </div>

                  {isEditing ? (
                    <Input onChange={(event) => setEdit({ ...edit, title: event.currentTarget.value })} value={edit.title} />
                  ) : (
                    <h3 className="text-base">{sermon.title}</h3>
                  )}

                  {isEditing ? (
                    <Input
                      onChange={(event) => setEdit({ ...edit, pastorName: event.currentTarget.value })}
                      placeholder="Pastor name (optional)"
                      value={edit.pastorName}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {sermon.pastor_name ? (
                        <span className="inline-flex items-center gap-1 pr-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {sermon.pastor_name}
                        </span>
                      ) : null}
                      {isProcessing ? "Generating notes..." : reference}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                        {isEditing ? (
                          <button className="ml-1" onClick={() => removeTagFromEdit(tag)} type="button">
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                  </div>

                  {isEditing ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        onChange={(event) => setEdit({ ...edit, newTag: event.currentTarget.value })}
                        placeholder="Add tag"
                        value={edit.newTag}
                      />
                      <Button onClick={addTagToEdit} size="sm" type="button" variant="secondary">
                        Add
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className={viewMode === "list" ? "mt-3 grid gap-2 sm:mt-0 sm:w-[170px]" : "mt-3 grid grid-cols-2 gap-2"}>
                  <Button disabled={!canOpen} onClick={() => openGamma(sermon.gamma_url)} size="sm" type="button">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button disabled={!canOpen} onClick={() => shareGamma(sermon.gamma_url)} size="sm" type="button" variant="secondary">
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>

                  {!isEditing ? (
                    <Button onClick={() => startEdit(sermon)} size="sm" type="button" variant="secondary">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button disabled={busyId === sermon.id} onClick={saveEdit} size="sm" type="button">
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button onClick={() => setEdit(null)} size="sm" type="button" variant="secondary">
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </>
                  )}

                  <Button
                    disabled={busyId === sermon.id}
                    onClick={() => deleteSermon(sermon.id)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
