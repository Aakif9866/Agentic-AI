"use client";

import { useSyncExternalStore } from "react";

// Per-browser "completed modules" list. Lives in localStorage; never required for the page to render.
const KEY = "agentic-course-done";
const EVENT = "course-progress";
const EMPTY: number[] = [];
let cache: { raw: string | null; ids: number[] } = { raw: null, ids: EMPTY };

function read(): number[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw !== cache.raw) {
    let ids = EMPTY;
    try { ids = raw ? JSON.parse(raw) : EMPTY; } catch {}
    cache = { raw, ids };
  }
  return cache.ids;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb); };
}

export function useDone() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

function toggle(id: number) {
  const ids = read();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function Check({ id, className = "" }: { id: number; className?: string }) {
  const done = useDone().includes(id);
  return (
    <span
      aria-label={done ? "Completed" : undefined}
      className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors ${done ? "bg-[#34c759] text-white" : "ring-1 ring-line ring-inset"} ${className}`}
    >
      {done ? "✓" : ""}
    </span>
  );
}

export function CompleteButton({ id }: { id: number }) {
  const done = useDone().includes(id);
  return (
    <button
      onClick={() => toggle(id)}
      aria-pressed={done}
      className={`press rounded-full px-5 py-2.5 text-sm font-medium ${done ? "bg-[#34c759] text-white" : "bg-accent text-white hover:brightness-110"}`}
    >
      {done ? "✓ Completed" : "Mark as complete"}
    </button>
  );
}

export function ProgressSummary({ total }: { total: number }) {
  const n = useDone().length;
  const pct = Math.round((n / total) * 100);
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
        <div className="h-full rounded-full bg-[#34c759] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {n} of {total} complete
    </div>
  );
}
