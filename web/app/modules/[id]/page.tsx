import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { byTrack, githubDir, githubFile, headingText, modules, ordered, resolveLink, slugify } from "@/lib/course";
import type { Kind, Resource } from "@/lib/resources";
import { CompleteButton } from "@/components/progress";
import { MobileNav, Sidebar, type NavTrack } from "@/components/module-nav";

export function generateStaticParams() {
  return modules.map((m) => ({ id: String(m.id) }));
}

export async function generateMetadata({ params }: PageProps<"/modules/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const m = modules.find((x) => x.id === id);
  return m ? { title: `Module ${m.id}: ${m.title} · Agentic AI Course`, description: m.tagline } : {};
}

const navTracks: NavTrack[] = byTrack.map((t) => ({ id: t.id, name: t.name, modules: t.modules.map(({ id, title }) => ({ id, title })) }));

const kindLabel: Record<Kind, string> = { video: "Video", course: "Course", docs: "Docs", article: "Article", paper: "Paper" };
const kindTint: Record<Kind, string> = {
  video: "bg-red-500/10 text-red-600 dark:text-red-400",
  course: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  docs: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  article: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paper: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

type HastNode = { type: string; value?: string; children?: HastNode[] };
const hastText = (n: HastNode): string => n.value ?? (n.children ?? []).map(hastText).join("");

const ytId = (url: string) => url.match(/[?&]v=([\w-]{11})/)?.[1];

function VideoCard({ r }: { r: Resource }) {
  const id = ytId(r.url);
  return (
    <a href={r.url} target="_blank" rel="noreferrer" className="press card group relative block overflow-hidden">
      <div className="relative aspect-video overflow-hidden bg-linear-to-br from-zinc-800 to-zinc-950">
        {id && (
          // eslint-disable-next-line @next/next/no-img-element -- static export, remote thumbnail
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <span className="absolute inset-0 grid place-items-center">
          <span className="klyro-corners grid size-12 place-items-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110" style={{ background: "var(--brand)" }}>
            {id ? "▶" : "⌕"}
          </span>
        </span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 font-semibold leading-snug text-heading">{r.title}</p>
        <p className="mt-1 text-sm italic text-muted">{r.by}</p>
      </div>
      <span className="absolute inset-x-0 -bottom-12 bg-accent py-2.5 text-center text-sm font-semibold text-on-accent transition-all duration-300 group-hover:bottom-0 group-focus-visible:bottom-0">
        Watch on YouTube ↗
      </span>
    </a>
  );
}

function ReadRow({ r }: { r: Resource }) {
  return (
    <a href={r.url} target="_blank" rel="noreferrer" className="press klyro-corners group flex items-center gap-4 border-l-2 border-transparent px-4 py-3.5 hover:border-accent hover:bg-surface-2">
      <span className={`w-16 shrink-0 klyro-corners py-1 text-center text-[11px] font-semibold ${kindTint[r.kind]}`}>{kindLabel[r.kind]}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-heading group-hover:text-accent">{r.title}</span>
        <span className="block text-sm text-muted">{r.by}</span>
      </span>
      <span className="text-accent transition-transform group-hover:translate-x-0.5" aria-hidden>↗</span>
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="brand-rule" />
      <h2 className="mt-3 mb-5 text-2xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default async function ModulePage({ params }: PageProps<"/modules/[id]">) {
  const id = Number((await params).id);
  const m = modules.find((x) => x.id === id);
  if (!m) notFound();

  const track = byTrack.find((t) => t.id === m.track)!;
  const i = ordered.findIndex((x) => x.id === id);
  const prev = ordered[i - 1];
  const next = ordered[i + 1];
  const videos = m.resources.filter((r) => r.kind === "video");
  const reads = m.resources.filter((r) => r.kind !== "video");

  const md: Components = {
    a: ({ href = "", children }) => <a href={resolveLink(m.dir, href)} target={href.startsWith("#") ? undefined : "_blank"} rel="noreferrer">{children}</a>,
    table: ({ children }) => <div className="table-wrap"><table>{children}</table></div>,
    h2: ({ node, children }) => <h2 id={slugify(headingText(hastText(node as HastNode)))}>{children}</h2>,
  };

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 sm:px-6">
      <Sidebar tracks={navTracks} current={id} />

      <main className="min-w-0 flex-1 pb-16">
        <MobileNav tracks={navTracks} current={id} label={m.title} />

        {/* Header */}
        <header className="pt-10 sm:pt-14">
          <Link href="/#tracks" className={`bg-linear-to-r ${track.gradient} bg-clip-text text-sm font-bold text-transparent`}>
            {track.name} · Module {m.id}
          </Link>
          <h1 className="mt-2 text-3xl font-bold leading-[1.08] tracking-[-0.03em] lg:text-6xl">{m.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted sm:text-xl">{m.tagline}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CompleteButton id={m.id} />
            <a href={githubDir(m.dir)} target="_blank" rel="noreferrer" className="press btn btn-outline">
              View code on GitHub ↗
            </a>
            {m.status === "spec" && <span className="klyro-corners bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Build spec — not built yet</span>}
          </div>
        </header>

        <Section title="What you’ll learn">
          <ul className="grid gap-3 sm:grid-cols-2">
            {m.topics.map((t, i) => (
              <li key={t} className="card reveal flex gap-3 p-4 text-[15px] leading-snug" style={{ "--d": `${Math.min(i, 10) * 40}ms` } as React.CSSProperties}>
                <span className={`mt-1.5 size-2 shrink-0 rotate-45 bg-linear-to-br ${track.gradient}`} />
                <span className="prose min-w-0 text-[15px]! leading-snug!"><Markdown components={md}>{t}</Markdown></span>
              </li>
            ))}
          </ul>
        </Section>

        {m.prereqs && (
          <Section title="Before you start">
            <div className="card prose p-6 text-[15px]!"><Markdown remarkPlugins={[remarkGfm]} components={md}>{m.prereqs}</Markdown></div>
          </Section>
        )}

        {videos.length > 0 && (
          <Section title="Watch">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {videos.map((r) => <VideoCard key={r.url} r={r} />)}
            </div>
          </Section>
        )}

        {reads.length > 0 && (
          <Section title="Read & practice">
            <div className="card p-2">{reads.map((r) => <ReadRow key={r.url} r={r} />)}</div>
          </Section>
        )}

        {m.files.length > 0 && (
          <Section title="Files in this module">
            <div className="card grid gap-6 p-6 sm:grid-cols-3">
              {(["Docs", "Code", "Data"] as const).map((g) => {
                const list = m.files.filter((f) => f.group === g);
                return list.length > 0 && (
                  <div key={g}>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent">{g}</p>
                    <ul className="space-y-1">
                      {list.map((f) => (
                        <li key={f.path}>
                          <a href={githubFile(m.dir, f.path)} target="_blank" rel="noreferrer" className="break-all font-mono text-[13px] text-accent hover:underline">{f.path}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Course notes">
          {m.toc.length > 2 && (
            <details open className="card group mb-4 p-6">
              <summary className="cursor-pointer list-none font-semibold">
                On this page <span className="text-muted transition-transform group-open:rotate-90 inline-block">›</span>
              </summary>
              <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
                {m.toc.map((h) => (
                  <li key={h.slug}><a href={`#${h.slug}`} className="text-muted hover:text-accent hover:underline">{h.text}</a></li>
                ))}
              </ol>
            </details>
          )}
          <article className="card prose p-6 sm:p-10">
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={md}>{m.notes}</Markdown>
          </article>
        </Section>

        <nav className="mt-12 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={`/modules/${prev.id}`} className="press card p-5">
              <span className="text-sm font-semibold text-accent">← Previous · Module {prev.id}</span>
              <span className="mt-1 block font-semibold">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={`/modules/${next.id}`} className="press card p-5 text-right">
              <span className="text-sm font-semibold text-accent">Next · Module {next.id} →</span>
              <span className="mt-1 block font-semibold">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
