"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Star, AlertTriangle, Users } from "lucide-react";
import InjurySelector, { Injury } from "../../components/InjurySelector";
import TeamCombobox from "../../components/TeamCombobox";
import LineupBuilder from "../../components/LineupBuilder";
import TeamLineup from "../../components/TeamLineup";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { getCompetition } from "../../lib/competitions";
import { apiUrl } from "../../lib/api";
import Reveal from "../../components/Reveal";

export default function PredictPage() {
  const params = useParams<{ competition: string }>();
  const code = params.competition?.toUpperCase() || "";
  const meta = getCompetition(code);

  const [home, setHome] = useState<string>("");
  const [away, setAway] = useState<string>("");
  const [teams, setTeams] = useState<{ name: string; id: number | null }[]>([]);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [preview, setPreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  const [showLineup, setShowLineup] = useState(false);
  const [showLineupBuilder, setShowLineupBuilder] = useState(false);

  const [homeInjuries, setHomeInjuries] = useState<Injury[]>([]);
  const [awayInjuries, setAwayInjuries] = useState<Injury[]>([]);
  const [homeRest, setHomeRest] = useState<number>(7);
  const [awayRest, setAwayRest] = useState<number>(7);

  useEffect(() => {
    if (!meta) return;
    const getTeams = async () => {
      try {
        const res = await axios.get(`${apiUrl()}/teams`, { params: { league: code } });
        setTeams(res.data.teams);
        if (res.data.teams.length > 1) {
          setHome(res.data.teams[0].name);
          setAway(res.data.teams[1].name);
        }
      } catch (err) {
        console.error("Failed to fetch teams", err);
      }
    };
    getTeams();
  }, [code, meta]);

  const predict = async () => {
    setLoading(true);
    setResult(null);
    setPreview("");
    try {
      const response = await axios.post(`${apiUrl()}/predict`, {
        home: home.trim(),
        away: away.trim(),
        home_injuries: homeInjuries,
        away_injuries: awayInjuries,
        home_rest_days: homeRest,
        away_rest_days: awayRest,
        league: code,
      });
      setResult(response.data);
    } catch (error: any) {
      console.error("Prediction error:", error);
      setResult({ error: error.response?.data?.detail || "Prediction failed." });
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async () => {
    if (!result || result.error) return;
    setLoadingPreview(true);
    setPreview("");
    try {
      const response = await fetch(`${apiUrl()}/ai/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home, away, league: code }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`AI preview failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          const parsed = JSON.parse(payload);
          if (parsed.text) setPreview((prev) => prev + parsed.text);
          if (parsed.error) setPreview((prev) => prev || `(AI preview unavailable: ${parsed.error})`);
        }
      }
    } catch (error) {
      console.error("Preview error:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  if (!meta) return null;

  return (
    <div className="space-y-8">
      <Reveal trigger="scroll">
      <section id="predictor">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Match Predictor — {meta.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <TeamCombobox label="Home Team" teams={teams} selectedTeam={home} setSelectedTeam={setHome} />
              </div>
              <div>
                <TeamCombobox label="Away Team" teams={teams} selectedTeam={away} setSelectedTeam={setAway} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {home || "Home"} Injuries
                </label>
                <InjurySelector teamName={home} injuries={homeInjuries} setInjuries={setHomeInjuries} />
                <div className="mt-4">
                  <label className="text-xs text-muted-foreground">Rest Days</label>
                  <input
                    type="number"
                    value={homeRest}
                    onChange={(e) => setHomeRest(parseInt(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border focus:ring-2 focus:ring-primary"
                    suppressHydrationWarning
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {away || "Away"} Injuries
                </label>
                <InjurySelector teamName={away} injuries={awayInjuries} setInjuries={setAwayInjuries} />
                <div className="mt-4">
                  <label className="text-xs text-muted-foreground">Rest Days</label>
                  <input
                    type="number"
                    value={awayRest}
                    onChange={(e) => setAwayRest(parseInt(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border focus:ring-2 focus:ring-primary"
                    suppressHydrationWarning
                  />
                </div>
              </div>
            </div>

            <Button onClick={predict} disabled={loading || !home || !away} className="w-full" size="lg">
              {loading ? "Predicting..." : "Predict Match"}
            </Button>

            <Button
              onClick={() => setShowLineupBuilder(true)}
              disabled={!home}
              variant="outline"
              className="w-full border-primary/30 hover:bg-primary/20 hover:text-primary transition-colors"
            >
              <Users className="mr-2 h-4 w-4" />
              Build Lineup
            </Button>

            {result && !result.error && result.home_win !== undefined && (
              <Card className="bg-secondary">
                <CardContent className="pt-6">
                  <Reveal trigger="mount" replayKey={result} stagger={0.1} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-primary">{result.home_win}%</p>
                        <p className="text-xs text-muted-foreground">Home Win</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{result.draw}%</p>
                        <p className="text-xs text-muted-foreground">Draw</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-accent">{result.away_win}%</p>
                        <p className="text-xs text-muted-foreground">Away Win</p>
                      </div>
                    </div>

                    {result.expected_goals && (
                      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground border-t border-border pt-4">
                        <span>xG: <span className="text-foreground font-medium">{result.expected_goals.home}</span> - <span className="text-foreground font-medium">{result.expected_goals.away}</span></span>
                        <span>Likely score: <span className="text-foreground font-medium">{result.likely_scoreline}</span> ({result.scoreline_probability}%)</span>
                      </div>
                    )}

                    <Button onClick={generatePreview} disabled={loadingPreview} variant="outline" className="w-full border-primary/30 hover:bg-primary/20 hover:text-primary transition-colors">
                      {loadingPreview && !preview ? "Thinking..." : "Generate AI Preview"}
                    </Button>
                    {preview && <p className="text-sm whitespace-pre-wrap">{preview}</p>}
                  </Reveal>
                </CardContent>
              </Card>
            )}

            {result?.error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
                {result.error}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      </Reveal>

      {showLineup && home && away && (
        <section id="lineup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Lineups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold mb-4 text-center border-b border-border pb-2">{home}</h3>
                  <TeamLineup teamName={home} />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-4 text-center border-b border-border pb-2">{away}</h3>
                  <TeamLineup teamName={away} />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="text-center">
        <Button
          onClick={() => setShowLineup(!showLineup)}
          variant="outline"
          disabled={!home || !away}
          className="border-primary/30 hover:bg-primary/20 hover:text-primary transition-colors"
        >
          <Users className="mr-2 h-4 w-4" />
          {showLineup ? "Hide" : "Show"} Team Lineups
        </Button>
      </div>

      <LineupBuilder team={home} isOpen={showLineupBuilder} onClose={() => setShowLineupBuilder(false)} />
    </div>
  );
}
