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
    <a href={r.url} target="_blank" rel="noreferrer" className="press card group block overflow-hidden hover:shadow-lg">
      <div className="relative aspect-video bg-linear-to-br from-zinc-800 to-zinc-950">
        {id && (
          // eslint-disable-next-line @next/next/no-img-element -- static export, remote thumbnail
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <span className="absolute inset-0 grid place-items-center">
          <span className="chrome grid size-12 place-items-center rounded-full text-white shadow-lg" style={{ background: "rgb(0 0 0 / 0.45)" }}>
            {id ? "▶" : "⌕"}
          </span>
        </span>
      </div>
      <div className="p-4">
        <p className="font-medium leading-snug">{r.title}</p>
        <p className="mt-1 text-sm text-muted">{r.by}</p>
      </div>
    </a>
  );
}

function ReadRow({ r }: { r: Resource }) {
  return (
    <a href={r.url} target="_blank" rel="noreferrer" className="press flex items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-line">
      <span className={`w-16 shrink-0 rounded-full py-1 text-center text-[11px] font-semibold ${kindTint[r.kind]}`}>{kindLabel[r.kind]}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug">{r.title}</span>
        <span className="block text-sm text-muted">{r.by}</span>
      </span>
      <span className="text-muted" aria-hidden>↗</span>
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">{title}</h2>
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
          <h1 className="mt-2 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.03em]">{m.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted sm:text-xl">{m.tagline}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CompleteButton id={m.id} />
            <a href={githubDir(m.dir)} target="_blank" rel="noreferrer" className="press rounded-full px-5 py-2.5 text-sm font-medium text-accent ring-1 ring-accent/40 ring-inset hover:bg-accent/10">
              View code on GitHub ↗
            </a>
            {m.status === "spec" && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Build spec — not built yet</span>}
          </div>
        </header>

        <Section title="What you’ll learn">
          <ul className="grid gap-3 sm:grid-cols-2">
            {m.topics.map((t) => (
              <li key={t} className="card flex gap-3 p-4 text-[15px] leading-snug">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full bg-linear-to-br ${track.gradient}`} />
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
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g}</p>
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
                  <li key={h.slug}><a href={`#${h.slug}`} className="text-muted hover:text-accent">{h.text}</a></li>
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
            <Link href={`/modules/${prev.id}`} className="press card p-5 hover:shadow-lg">
              <span className="text-sm text-muted">← Previous · Module {prev.id}</span>
              <span className="mt-1 block font-semibold">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={`/modules/${next.id}`} className="press card p-5 text-right hover:shadow-lg">
              <span className="text-sm text-muted">Next · Module {next.id} →</span>
              <span className="mt-1 block font-semibold">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
