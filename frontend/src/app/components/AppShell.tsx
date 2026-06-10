"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "./Header";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/upload",
    label: "Upload Documents",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 16V4" />
        <path d="M7.5 8.5 12 4l4.5 4.5" />
        <path d="M4 16.5v1.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-1.5" />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "AI Chat",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 10h8" />
        <path d="M8 14h5" />
        <path d="M6 19.5V18a2 2 0 0 0-2-2h-.5A1.5 1.5 0 0 1 2 14.5v-8A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 2.5Z" />
      </svg>
    ),
  },
];

const PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  "/upload": {
    title: "Document Workspace",
    subtitle: "Upload, organize, and prepare your sources for grounded Q&A.",
  },
  "/chat": {
    title: "Conversation Dashboard",
    subtitle: "Ask questions, switch models, and inspect citation-backed answers.",
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageCopy = PAGE_COPY[pathname] ?? PAGE_COPY["/upload"];
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem("qa-copilot-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("qa-copilot-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  return (
    <div className="panel-grid h-screen overflow-hidden bg-background text-foreground">
      <div className="grid h-full lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden h-full border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 lg:flex lg:flex-col">
          <div className="px-7 py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-[#3c82f6] to-[#2554ea] text-white shadow-[0_12px_30px_rgba(59,130,246,0.28)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  QA Copilot
                </h1>
              </div>
            </div>
          </div>

          <nav className="px-4">
            <div className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-[#edf3ff] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                    ].join(" ")}
                  >
                    <span
                      className={
                        active
                          ? "text-[#2563eb] dark:text-blue-300"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto border-t border-slate-200/80 px-4 py-5 dark:border-slate-800">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M20 19V5" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col bg-[#f7f9fc] dark:bg-slate-950">
          <Header />

          <main className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
