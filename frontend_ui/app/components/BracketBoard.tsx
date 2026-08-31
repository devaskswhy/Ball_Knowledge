"use client";

type BracketTeam = {
  seed: number;
  team: string;
  logo?: string | null;
  league_phase_points: number;
  goal_difference: number;
  entry: "round of 16" | "play-off" | "eliminated";
  reach_r16: number;
  reach_qf: number;
  reach_sf: number;
  reach_final: number;
  win_probability: number;
  actual_stage_reached?: string | null;
};

export type BracketPayload = {
  competition: string;
  name: string;
  season: string;
  format: string;
  simulations: number;
  actual_winner?: string | null;
  teams: BracketTeam[];
};

const STAGE_LABEL: Record<string, string> = {
  playoff: "Play-off",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

const ENTRY_STYLE: Record<string, string> = {
  "round of 16": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "play-off": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  eliminated: "bg-muted text-muted-foreground border-border",
};

// The API reports these as fractions (0-1), not percentages.
const pct = (fraction: number) => fraction * 100;

function MiniBar({ fraction }: { fraction: number }) {
  const value = pct(fraction);
  return (
    <div className="h-1.5 w-14 rounded-full bg-secondary overflow-hidden mx-auto">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(value, value > 0 ? 4 : 0)}%` }} />
    </div>
  );
}

export default function BracketBoard({ data }: { data: BracketPayload }) {
  return (
    <div>
      <div className="mb-4 space-y-1">
        <p className="text-sm text-muted-foreground">{data.format}</p>
        <p className="text-sm text-muted-foreground">
          {data.simulations.toLocaleString()} simulated brackets, resolved with each side's real
          expected goals over two legs (extra time and penalties split 50/50).
        </p>
        {data.actual_winner && (
          <p className="text-xs text-muted-foreground">
            Actual {data.season} winner: <span className="font-semibold text-foreground">{data.actual_winner}</span> — shown against the model's own odds below.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/60 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2 w-10">Seed</th>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-left px-2 py-2 hidden sm:table-cell">Entry</th>
              <th className="text-center px-2 py-2 hidden lg:table-cell">R16</th>
              <th className="text-center px-2 py-2 hidden lg:table-cell">QF</th>
              <th className="text-center px-2 py-2 hidden md:table-cell">SF</th>
              <th className="text-center px-2 py-2 hidden md:table-cell">Final</th>
              <th className="text-center px-2 py-2 font-bold">Win %</th>
              <th className="text-left px-3 py-2 hidden sm:table-cell">Actually reached</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => {
              const isWinner = data.actual_winner && t.team === data.actual_winner;
              return (
                <tr
                  key={t.team}
                  className={`border-t border-border hover:bg-secondary/40 transition-colors ${isWinner ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{t.seed}</td>
                  <td className="px-3 py-2 font-medium">
                    {t.team}
                    {isWinner && <span className="ml-2 text-[10px] font-bold text-primary uppercase">Winner</span>}
                  </td>
                  <td className="px-2 py-2 hidden sm:table-cell">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${ENTRY_STYLE[t.entry]}`}>
                      {t.entry}
                    </span>
                  </td>
                  <td className="px-2 py-2 hidden lg:table-cell"><MiniBar fraction={t.reach_r16} /></td>
                  <td className="px-2 py-2 hidden lg:table-cell"><MiniBar fraction={t.reach_qf} /></td>
                  <td className="px-2 py-2 hidden md:table-cell"><MiniBar fraction={t.reach_sf} /></td>
                  <td className="px-2 py-2 hidden md:table-cell"><MiniBar fraction={t.reach_final} /></td>
                  <td className="text-center px-2 py-2 font-bold text-primary tabular-nums">
                    {pct(t.win_probability).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell text-xs text-muted-foreground">
                    {t.actual_stage_reached ? STAGE_LABEL[t.actual_stage_reached] || t.actual_stage_reached : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
