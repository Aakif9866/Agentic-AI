"use client";

import Link from "next/link";
import { useRef } from "react";
import { Check } from "./progress";

export type NavTrack = { id: string; name: string; modules: { id: number; title: string }[] };

function List({ tracks, current, onPick }: { tracks: NavTrack[]; current: number; onPick?: () => void }) {
  return (
    <div className="space-y-6">
      {tracks.map((t) => (
        <div key={t.id}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t.name}</p>
          <ul>
            {t.modules.map((m) => {
              const active = m.id === current;
              return (
                <li key={m.id}>
                  <Link
                    href={`/modules/${m.id}`}
                    onClick={onPick}
                    aria-current={active ? "page" : undefined}
                    className={`press flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] leading-snug ${active ? "bg-accent text-white" : "hover:bg-line"}`}
                  >
                    <span className={`w-5 shrink-0 text-right tabular-nums text-[12px] ${active ? "text-white/80" : "text-muted"}`}>{m.id}</span>
                    <span className="flex-1">{m.title}</span>
                    <Check id={m.id} className={active ? "ring-white/50" : ""} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Sidebar(props: { tracks: NavTrack[]; current: number }) {
  return (
    <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-72 shrink-0 overflow-y-auto py-8 pr-4 lg:block">
      <List {...props} />
    </aside>
  );
}

// Native <dialog>: focus trap, Esc and backdrop for free.
export function MobileNav({ tracks, current, label }: { tracks: NavTrack[]; current: number; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <div className="lg:hidden">
      <div className="chrome sticky top-12 z-30 -mx-4 border-b border-line px-4 sm:-mx-6 sm:px-6">
        <button onClick={() => ref.current?.showModal()} className="press flex h-11 w-full items-center justify-between text-[14px]">
          <span className="truncate"><span className="text-muted">Module {current} · </span>{label}</span>
          <span className="ml-3 shrink-0 text-accent">All modules</span>
        </button>
      </div>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && close()}
        className="sheet card mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-0 text-ink"
      >
        <div className="chrome sticky top-0 z-10 flex items-center justify-between border-b border-line px-5 py-3">
          <span className="font-semibold">All modules</span>
          <button onClick={close} className="press rounded-full px-3 py-1 text-[14px] text-accent">Done</button>
        </div>
        <div className="p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <List tracks={tracks} current={current} onPick={close} />
        </div>
      </dialog>
    </div>
  );
}
