"use client";

type StandingsRow = {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form?: string[];
};

export type StandingsPayload = {
  competition: string;
  league: string;
  kind: "league" | "cup";
  season: string;
  as_of: string | null;
  matches_played: number;
  total_matches: number;
  complete: boolean;
  table: StandingsRow[];
};

const FORM_STYLES: Record<string, string> = {
  W: "bg-emerald-500/90 text-emerald-950",
  D: "bg-amber-400/90 text-amber-950",
  L: "bg-red-500/90 text-red-950",
};

function FormPill({ result }: { result: string }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${FORM_STYLES[result] || "bg-muted text-muted-foreground"}`}>
      {result}
    </span>
  );
}

export default function StandingsTable({ data, relegationSpots }: { data: StandingsPayload; relegationSpots?: number }) {
  const relegationCutoff = relegationSpots ? data.table.length - relegationSpots : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{data.season}</span>
          {data.as_of ? (
            <span>as of {data.as_of} · {data.matches_played}/{data.total_matches} matches played</span>
          ) : (
            <span>{(data as any).stage || "Final table"}</span>
          )}
        </div>
        {!data.complete && (
          <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Season in progress
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/60 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-center px-2 py-2">P</th>
              <th className="text-center px-2 py-2">W</th>
              <th className="text-center px-2 py-2">D</th>
              <th className="text-center px-2 py-2">L</th>
              <th className="text-center px-2 py-2 hidden sm:table-cell">GF</th>
              <th className="text-center px-2 py-2 hidden sm:table-cell">GA</th>
              <th className="text-center px-2 py-2">GD</th>
              <th className="text-center px-2 py-2 font-bold">Pts</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Form</th>
            </tr>
          </thead>
          <tbody>
            {data.table.map((row) => {
              const isRelegation = relegationCutoff !== null && row.position > relegationCutoff;
              return (
                <tr
                  key={row.team}
                  className={`border-t border-border hover:bg-secondary/40 transition-colors ${isRelegation ? "bg-red-500/5" : ""}`}
                >
                  <td className="px-3 py-2 text-muted-foreground relative">
                    {isRelegation && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />}
                    {row.position}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.team}</td>
                  <td className="text-center px-2 py-2">{row.played}</td>
                  <td className="text-center px-2 py-2">{row.won}</td>
                  <td className="text-center px-2 py-2">{row.drawn}</td>
                  <td className="text-center px-2 py-2">{row.lost}</td>
                  <td className="text-center px-2 py-2 hidden sm:table-cell">{row.goals_for}</td>
                  <td className="text-center px-2 py-2 hidden sm:table-cell">{row.goals_against}</td>
                  <td className="text-center px-2 py-2">
                    {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                  </td>
                  <td className="text-center px-2 py-2 font-bold text-foreground">{row.points}</td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="flex gap-1">
                      {(row.form || []).map((r, i) => (
                        <FormPill key={i} result={r} />
                      ))}
                    </div>
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
