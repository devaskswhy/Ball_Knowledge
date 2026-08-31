"use client";

import { useParams, usePathname } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Table2, Swords, Sparkles } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { WebSocketProvider } from "../contexts/WebSocketContext";
import { getCompetition } from "../lib/competitions";
import { territoryFont } from "../lib/fonts";

export default function CompetitionLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ competition: string }>();
  const pathname = usePathname();
  const code = params.competition?.toUpperCase();
  const meta = getCompetition(code);

  if (!meta) {
    notFound();
  }

  const base = `/${meta.code}`;
  const tabs = [
    { href: base, label: "Table", icon: Table2, exact: true },
    { href: `${base}/predict`, label: "Predict", icon: Swords, exact: false },
    { href: `${base}/ask`, label: "Ask the AI", icon: Sparkles, exact: false },
  ];

  return (
    <WebSocketProvider>
      <div className="min-h-screen">
        <Header />

        <div className="relative" style={{ backgroundImage: meta.gradient }}>
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/50 to-background" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 pt-10 pb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {meta.kind === "cup" ? "Knockout competition" : "League"} · {meta.country}
            </span>
            <h1 className={`mt-2 text-4xl md:text-5xl bg-clip-text text-transparent bg-gradient-to-r ${meta.heading} drop-shadow-lg ${territoryFont(meta.code)}`}>
              {meta.name}
            </h1>
            <p className={`mt-2 text-sm ${meta.accentText}`}>{meta.vibe}</p>

            <nav className="mt-6 flex gap-2">
              {tabs.map((tab) => {
                const active = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-black/30 text-foreground border-white/10 hover:bg-black/50 backdrop-blur-sm"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">{children}</main>

        <Footer />
      </div>
    </WebSocketProvider>
  );
}
