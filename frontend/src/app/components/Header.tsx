"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";




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
function Header() {
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

    return (
        <header className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                        {pageCopy.title}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{pageCopy.subtitle}</p>
                </div>

                <div className="flex items-center gap-3">

                    {/* User profile will appear here later */}
                </div>
            </div>
        </header>
    )
}

export default Header