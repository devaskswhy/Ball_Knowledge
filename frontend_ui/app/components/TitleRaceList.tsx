"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "../lib/gsap";

type TitleRaceTeam = {
  team: string;
  current_position: number;
  current_points: number;
  played: number;
  projected_points: number;
  title_probability: number;
  top_4_probability: number;
  relegation_probability: number;
};

export type TitleRacePayload = {
  competition: string;
  league: string;
  season: string;
  as_of: string;
  matches_played: number;
  total_matches: number;
  fixtures_remaining: number;
  simulations: number;
  relegation_spots: number;
  teams: TitleRaceTeam[];
};

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
      <div
        className={`bar-fill h-full rounded-full ${className}`}
        data-target={Math.max(pct, pct > 0 ? 1.5 : 0)}
        style={{ width: 0 }}
      />
    </div>
  );
}

// The API reports probabilities as fractions (0-1), not percentages.
const pct = (fraction: number) => fraction * 100;

export default function TitleRaceList({ data }: { data: TitleRacePayload }) {
  const teams = [...data.teams].sort((a, b) => b.title_probability - a.title_probability);
  const container = useRef<HTMLDivElement>(null);

  // The bars are the one place a number in this app is worth watching grow
  // rather than just reading — they're what a Monte Carlo simulation
  // actually looks like, so the fill animates in instead of appearing static.
  useGSAP(
    () => {
      if (!container.current) return;
      const bars = gsap.utils.toArray<HTMLElement>(container.current.querySelectorAll(".bar-fill"));
      if (!bars.length) return;

      if (prefersReducedMotion()) {
        bars.forEach((bar) => (bar.style.width = `${bar.dataset.target}%`));
        return;
      }

      bars.forEach((bar) => {
        gsap.to(bar, {
          width: `${bar.dataset.target}%`,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: { trigger: bar, start: "top 90%", once: true },
        });
      });
    },
    { scope: container, dependencies: [data] }
  );

  return (
    <div ref={container}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-muted-foreground">
          Monte Carlo projection · {data.simulations.toLocaleString()} simulations of the
          {" "}{data.fixtures_remaining} fixtures left, from the table as of {data.as_of}.
        </p>
      </div>

      <div className="space-y-3">
        {teams.map((t) => (
          <div key={t.team} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold">{t.team}</span>
                <span className="text-xs text-muted-foreground">
                  #{t.current_position} · {t.current_points} pts · proj. {t.projected_points}
                </span>
              </div>
              <span className="text-lg font-black text-primary tabular-nums">
                {pct(t.title_probability).toFixed(1)}%
              </span>
            </div>

            <Bar pct={pct(t.title_probability)} className="bg-primary" />

            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Top 4: <span className="text-foreground font-medium">{pct(t.top_4_probability).toFixed(1)}%</span></span>
              {t.relegation_probability > 0 && (
                <span className="text-red-400">
                  Relegation: <span className="font-medium">{pct(t.relegation_probability).toFixed(1)}%</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
