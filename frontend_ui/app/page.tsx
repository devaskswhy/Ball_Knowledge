"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, TrendingUp, ArrowRight, Trophy } from "lucide-react";
import HomepageHero from "./components/HomepageHero";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { COMPETITION_ORDER, COMPETITIONS } from "./lib/competitions";
import { territoryFont } from "./lib/fonts";
import Reveal from "./components/Reveal";

function Home() {
  const [showMatches, setShowMatches] = useState(true);
  const [showStats, setShowStats] = useState(true);

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <div
        id="hero"
        className="relative min-h-[560px] flex items-start justify-center pt-2 pb-12"
        style={{
          backgroundImage: "linear-gradient(135deg, #0b1a2a 0%, #050a14 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/35 to-background" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col justify-between h-full">
          <Reveal trigger="mount" stagger={0.12} className="text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-4 pb-2 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary drop-shadow-lg">
              Ball Knowledge
            </h1>
            <p className="text-lg font-medium text-muted-foreground drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              Real tables, real form, a model that shows its work — pick a competition to start.
            </p>
          </Reveal>

          <div className="mt-8">
            <div className="flex justify-center md:justify-end gap-2 mb-4">
              <Button
                variant={showMatches ? "default" : "secondary"}
                onClick={() => setShowMatches(!showMatches)}
                size="sm"
                className={`rounded-full shadow-lg border border-white/10 transition-all duration-300 font-bold ${showMatches ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md' : 'bg-black/50 hover:bg-black/70 text-gray-300 backdrop-blur-sm'}`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Today's Matches
              </Button>
              <Button
                variant={showStats ? "default" : "secondary"}
                onClick={() => setShowStats(!showStats)}
                size="sm"
                className={`rounded-full shadow-lg border border-white/10 transition-all duration-300 font-bold ${showStats ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md' : 'bg-black/50 hover:bg-black/70 text-gray-300 backdrop-blur-sm'}`}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Impact Players
              </Button>
            </div>
            <Reveal trigger="mount">
              <HomepageHero showMatches={showMatches} showStats={showStats} />
            </Reveal>
          </div>
        </div>
      </div>

      {/* Competition picker */}
      <main className="max-w-7xl mx-auto px-4 py-12 space-y-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Competitions</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-4">
          Current tables, a Monte Carlo title race for every league, and a knockout
          bracket for the Champions League — each computed from real results, not placeholders.
        </p>

        <Reveal stagger={0.08} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {COMPETITION_ORDER.map((code) => {
            const meta = COMPETITIONS[code];
            return (
              <Link key={code} href={`/${code}`} className="group">
                <Card
                  className="h-full overflow-hidden border-border transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-primary/40"
                  style={{ backgroundImage: meta.gradient }}
                >
                  <CardContent className="pt-6 pb-5 relative">
                    <div className="absolute inset-0 bg-background/70 group-hover:bg-background/55 transition-colors" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {meta.kind === "cup" ? "Knockout" : "League"} · {meta.country}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                      </div>
                      <h3 className={`text-2xl bg-clip-text text-transparent bg-gradient-to-r ${meta.heading} ${territoryFont(meta.code)}`}>
                        {meta.name}
                      </h3>
                      <p className={`mt-2 text-xs ${meta.accentText}`}>{meta.vibe}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}

export default function Page() {
  return (
    <WebSocketProvider>
      <Home />
    </WebSocketProvider>
  );
}
