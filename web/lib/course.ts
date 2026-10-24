import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { meta, tracks, type Meta } from "./resources";

// The course lives one level up; topics.md + each module's NOTES.md are the
// single source of truth — this site only re-arranges them.
const ROOT = path.join(process.cwd(), "..");
export const REPO = "https://github.com/Aakif9866/Agentic-AI";

export type Module = Meta & {
  id: number;
  title: string;
  dir: string;
  topics: string[];
  prereqs: string; // markdown
  notes: string; // markdown
  toc: { text: string; slug: string }[];
  files: { path: string; group: "Docs" | "Code" | "Data" }[];
};

// Only files git tracks, so every GitHub link resolves. Empty if git isn't available.
function trackedFiles(): string[] {
  try {
    return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");
  } catch {
    return [];
  }
}

const SKIP = /(^|\/)(\.[^/]+|uv\.lock|pyproject\.toml)$/;
const groupOf = (f: string) => (/\.(md|txt|docx)$/.test(f) ? "Docs" : /\.(py|ipynb|ya?ml)$|Dockerfile$/.test(f) ? "Code" : "Data");

// Plain text of a markdown heading — must match what the rendered <h2> contains.
export const headingText = (md: string) => md.replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*+/g, "").trim();
export const slugify = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

function load(): Module[] {
  const dirs = fs.readdirSync(ROOT).filter((d) => /^Module \d+ - /.test(d));
  const topicsMd = fs.readFileSync(path.join(ROOT, "topics.md"), "utf8");
  const sections = topicsMd.split(/^## Module /m).slice(1);
  const tracked = trackedFiles();

  return sections
    .map((s) => {
      const [head, ...rest] = s.split("\n");
      const id = Number(head.match(/^(\d+)/)![1]);
      const title = head.replace(/^\d+\s+—\s+/, "").replace(/\s*\*\(.*\)\*\s*$/, "").trim();
      const body = rest.join("\n").replace(/\n---\s*$/, "");
      const [topicsPart, prereqPart = ""] = body.split(/^Prerequisites[^:\n]*:/m);
      const topics = topicsPart.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));

      const dir = dirs.find((d) => d.startsWith(`Module ${id} - `))!;
      const file = ["NOTES.md", "README.md"].map((f) => path.join(ROOT, dir, f)).find(fs.existsSync)!;
      const notes = fs.readFileSync(file, "utf8").replace(/^# .*\n/, "");
      const toc = [...notes.replace(/^```[\s\S]*?^```/gm, "").matchAll(/^## (.+)$/gm)].map(([, h]) => {
        const text = headingText(h);
        return { text, slug: slugify(text) };
      });
      const shown = path.relative(ROOT, file);
      const files = tracked
        .filter((f) => f.startsWith(`${dir}/`) && f !== shown && !SKIP.test(f))
        .map((f) => ({ path: f.slice(dir.length + 1), group: groupOf(f) as Module["files"][number]["group"] }));

      return { id, title, dir, topics, prereqs: prereqPart.trim(), notes, toc, files, ...meta[id] };
    })
    .sort((a, b) => a.id - b.id);
}

export const modules = load();

export const byTrack = tracks.map((t) => ({ ...t, modules: modules.filter((m) => m.track === t.id) }));

// Course order follows the tracks, so prev/next walks the same path as the home page.
export const ordered = byTrack.flatMap((t) => t.modules);

export const githubDir = (dir: string) => `${REPO}/tree/main/${encodeURI(dir)}`;
export const githubFile = (dir: string, file: string) => `${REPO}/blob/main/${encodeURI(`${dir}/${file}`)}`;

// Relative links inside NOTES.md (./async.ipynb, ../LEARNPLAN.md) point at repo files.
export const resolveLink = (dir: string, href: string) =>
  /^(https?:|mailto:|#)/.test(href) ? href : new URL(href, `${REPO}/blob/main/${encodeURI(dir)}/`).href;
