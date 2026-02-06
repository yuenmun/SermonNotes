import { redirect } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SermonLibrary } from "@/app/dashboard/sermon-library";
import { SermonUploader } from "@/app/dashboard/sermon-uploader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const formatShortDate = (value?: string) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: sermons, error } = await supabase
    .from("sermons")
    .select("id,title,gamma_url,created_at,status,pastor_name,tags,hero_verse,scripture_references")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const total = sermons?.length ?? 0;
  const ready = sermons?.filter((sermon) => sermon.status === "ready").length ?? 0;
  const lastDate = sermons?.[0]?.created_at;
  const normalizedSermons = (sermons ?? []).map((sermon) => ({
    ...sermon,
    tags: Array.isArray(sermon.tags) ? sermon.tags.filter((tag) => typeof tag === "string") : [],
    scripture_references: Array.isArray(sermon.scripture_references)
      ? sermon.scripture_references.filter((ref) => typeof ref === "string")
      : [],
  }));

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-3 py-5 sm:px-6 sm:py-8">
      <Card className="glass-panel animate-in rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="mono-kicker">Sermon Notes</p>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/70" />
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">All {total}</Badge>
            <Badge variant="success">Ready {ready}</Badge>
            <Badge variant="secondary">Last {formatShortDate(lastDate)}</Badge>
            <form action={signOut}>
              <Button className="gap-2" size="sm" type="submit" variant="secondary">
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <SermonUploader />

      <SermonLibrary error={error?.message} initialSermons={normalizedSermons} />
    </main>
  );
}
