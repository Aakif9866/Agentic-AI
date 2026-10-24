import Link from "next/link";
import { byTrack, modules, ordered, REPO } from "@/lib/course";
import { Check, ProgressSummary } from "@/components/progress";
import { ModuleSearch } from "@/components/module-search";

const corePath = [4, 6, 7, 8];

const method = [
  ["Run it", "Run the file before you read it. Say in one sentence what it did."],
  ["Guess the shape", "How many steps? What passed between them? Wrong guesses make answers stick."],
  ["Read once", "Top to bottom, no stopping. You’re getting the map, not the detail."],
  ["Read the notes", "Only the NOTES.md section for that file — every module has one."],
  ["Break it", "Change one thing, write down a prediction, run it. Surprise is the lesson."],
  ["Explain it", "File closed, out loud. Where you stall is exactly your gap."],
];

const statusLabel = { built: "Built & verified", theory: "Reading", spec: "Build spec" } as const;

export default function Home() {
  const resourceCount = modules.reduce((n, m) => n + m.resources.length, 0);
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-16 pb-14 text-center sm:pt-24 sm:pb-20">
        <p className="text-sm font-semibold text-accent">From Python basics to production agents</p>
        <h1 className="mx-auto mt-3 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1.04] tracking-[-0.035em]">
          Build AI agents that{" "}
          <span className="bg-linear-to-r from-sky-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">actually work.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
          {modules.length} modules of runnable LangGraph code, plain-English notes, and {resourceCount} hand-picked videos, courses and papers — arranged as one clear path.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/modules/${ordered[0].id}`} className="press rounded-full bg-accent px-6 py-3 font-medium text-white hover:brightness-110">
            Start from Module 0
          </Link>
          <Link href="/modules/4" className="press rounded-full px-6 py-3 font-medium text-accent ring-1 ring-accent/40 ring-inset hover:bg-accent/10">
            Jump to LangGraph →
          </Link>
        </div>
        <div className="mt-8 flex justify-center"><ProgressSummary total={modules.length} /></div>
        <ModuleSearch items={modules.map((m) => ({ id: m.id, title: m.title, tagline: m.tagline, haystack: [m.title, m.tagline, ...m.topics, ...m.toc.map((h) => h.text)].join(" ").toLowerCase() }))} />
      </section>

      {/* Core path */}
      <section className="card relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-linear-to-br from-violet-500/25 to-sky-400/25 blur-3xl" />
        <p className="text-sm font-semibold text-muted">If you only have a week</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">The four modules that matter.</h2>
        <p className="mt-2 max-w-2xl text-muted">Everything else in the course is built out of these. Learn them deeply and the rest reads easily.</p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {corePath.map((id, i) => {
            const m = modules.find((x) => x.id === id)!;
            return (
              <li key={id}>
                <Link href={`/modules/${id}`} className="press flex h-full flex-col rounded-2xl bg-bg p-5 hover:ring-1 hover:ring-accent/40">
                  <span className="text-xs font-semibold text-accent">Step {i + 1} · Module {id}</span>
                  <span className="mt-1 font-semibold leading-snug">{m.title}</span>
                  <span className="mt-2 text-sm text-muted">{m.tagline}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Tracks */}
      <div id="tracks" className="scroll-mt-16 space-y-16 pt-20">
        {byTrack.map((t, ti) => (
          <section key={t.id}>
            <div className="mb-6 flex items-end gap-4">
              <div className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br ${t.gradient} text-lg font-bold text-white shadow-sm`}>{ti + 1}</div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.name}</h2>
                <p className="text-muted">{t.blurb}</p>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.modules.map((m) => (
                <li key={m.id}>
                  <Link href={`/modules/${m.id}`} className="press card group flex h-full flex-col p-6 hover:shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className={`bg-linear-to-r ${t.gradient} bg-clip-text text-sm font-bold text-transparent`}>Module {m.id}</span>
                      <Check id={m.id} />
                    </div>
                    <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight">{m.title}</h3>
                    <p className="mt-2 flex-1 text-[15px] text-muted">{m.tagline}</p>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
                      <span className="rounded-full bg-bg px-2.5 py-1">{statusLabel[m.status]}</span>
                      <span className="rounded-full bg-bg px-2.5 py-1">{m.topics.length} topics</span>
                      <span className="rounded-full bg-bg px-2.5 py-1">{m.resources.length} resources</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Method */}
      <section id="method" className="scroll-mt-16 pt-24">
        <p className="text-sm font-semibold text-accent">How to study</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Working code feels like knowledge. It isn’t.</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Do these six steps for one file at a time, 20–40 minutes each. Full method in{" "}
          <a className="text-accent hover:underline" href={`${REPO}/blob/main/LEARNPLAN.md`}>LEARNPLAN.md</a>.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {method.map(([title, body], i) => (
            <li key={title} className="card p-6">
              <span className="text-4xl font-bold tracking-tight text-muted/40">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1 text-[15px] text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
