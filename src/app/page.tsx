import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, AudioLines, BookOpenText, WandSparkles } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const pipeline = [
  { step: "Capture", detail: "Mic first, upload optional." },
  { step: "Transcribe", detail: "Whisper converts speech to text." },
  { step: "Design", detail: "Gamma builds the shareable page." },
  { step: "Archive", detail: "Supabase stores everything." },
];

const valueCards = [
  { title: "Fast Capture", body: "Record and generate in one flow." },
  { title: "Clean Output", body: "Structured pages with references." },
  { title: "Private Library", body: "Search, tag, and reopen quickly." },
];

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-3 py-5 sm:px-6 sm:py-8">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            <p className="mono-kicker">Sermon Notes</p>
            <h1>Capture sermons. Generate polished notes.</h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Built for mobile-first church workflows: record, process, archive, and share in minutes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:-translate-y-0.5 hover:bg-primary/90" href="/login">
                Open App
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-foreground/90 transition hover:bg-white/10" href="/login">
                Sign in
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Whisper</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">GPT-5 mini</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Gamma</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Supabase</span>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <p className="mono-kicker mb-2">Flow</p>
            <ul className="space-y-2">
              {pipeline.map((item) => (
                <li className="rounded-xl border border-white/10 bg-black/40 p-2.5" key={item.step}>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.step}</p>
                  <p className="mt-1 text-sm text-foreground/90">{item.detail}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {valueCards.map((card) => (
          <article className="glass-panel rounded-2xl p-4" key={card.title}>
            <div className="mb-2 inline-flex rounded-lg border border-white/10 bg-white/5 p-1.5">
              {card.title === "Fast Capture" ? (
                <AudioLines className="h-4 w-4" />
              ) : card.title === "Clean Output" ? (
                <WandSparkles className="h-4 w-4" />
              ) : (
                <BookOpenText className="h-4 w-4" />
              )}
            </div>
            <h3 className="mb-1">{card.title}</h3>
            <p className="text-sm text-muted-foreground">{card.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
