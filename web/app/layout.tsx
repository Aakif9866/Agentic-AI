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
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="chrome sticky top-0 z-40 border-b border-line">
          <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="text-[15px] font-semibold tracking-tight">
              Agentic AI <span className="text-muted font-normal">Course</span>
            </Link>
            <div className="flex items-center gap-5 text-[13px] text-muted">
              <Link href="/#tracks" className="hover:text-ink">Modules</Link>
              <Link href="/#method" className="hover:text-ink hidden sm:inline">How to study</Link>
              <a href={REPO} className="hover:text-ink">GitHub</a>
            </div>
          </nav>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl px-4 py-12 text-xs text-muted sm:px-6">
          Content generated from the course repo’s <code>topics.md</code> and module notes · MIT License
        </footer>
      </body>
    </html>
  );
}
