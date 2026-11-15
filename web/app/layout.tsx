import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { REPO } from "@/lib/course";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic AI Course",
  description: "A hands-on path from Python basics to production multi-agent systems with LangGraph.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="border-t-8 border-accent" />
        <header className="chrome sticky top-0 z-40 border-b border-line">
          <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-heading">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" className="size-7" />
              Agentic AI <span className="font-normal text-muted">Course</span>
            </Link>
            <div className="flex items-center gap-5 text-[14px] font-medium text-muted">
              <Link href="/#tracks" className="hover:text-accent">Modules</Link>
              <Link href="/#method" className="hidden hover:text-accent sm:inline">How to study</Link>
              <a href={REPO} className="hover:text-accent">GitHub</a>
            </div>
          </nav>
        </header>
        {children}
        <footer className="mx-auto mt-16 max-w-6xl border-t border-line px-4 py-10 text-xs text-muted sm:px-6">
          Content generated from the course repo’s <code>topics.md</code> and module notes · MIT License
        </footer>
      </body>
    </html>
  );
}
