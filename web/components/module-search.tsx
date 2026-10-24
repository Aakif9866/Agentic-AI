"use client";

import Link from "next/link";
import { useState } from "react";

export type SearchItem = { id: number; title: string; tagline: string; haystack: string };

// ponytail: substring match over ~23 modules; swap for a fuzzy index if the course grows to hundreds.
export function ModuleSearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState("");
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? items.filter((m) => terms.every((t) => m.haystack.includes(t))) : [];

  return (
    <div className="mx-auto mt-10 max-w-xl text-left">
      <label className="sr-only" htmlFor="module-search">Search modules</label>
      <input
        id="module-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search topics — e.g. checkpointer, MCP, json_mode"
        className="card w-full rounded-full px-5 py-3.5 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
      />
      {terms.length > 0 && (
        <ul className="card mt-2 max-h-80 overflow-y-auto p-2" aria-live="polite">
          {hits.length === 0 && <li className="px-4 py-3 text-sm text-muted">No module mentions “{q}”.</li>}
          {hits.map((m) => (
            <li key={m.id}>
              <Link href={`/modules/${m.id}`} className="press block rounded-xl px-4 py-2.5 hover:bg-line">
                <span className="text-xs font-semibold text-accent">Module {m.id}</span>
                <span className="block font-medium leading-snug">{m.title}</span>
                <span className="block text-sm text-muted">{m.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
