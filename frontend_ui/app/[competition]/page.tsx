"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Sparkles, ListOrdered, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import StandingsTable, { StandingsPayload } from "../components/StandingsTable";
import TitleRaceList, { TitleRacePayload } from "../components/TitleRaceList";
import BracketBoard, { BracketPayload } from "../components/BracketBoard";
import { getCompetition } from "../lib/competitions";
import { apiUrl } from "../lib/api";
import Reveal from "../components/Reveal";

const RELEGATION_SPOTS: Record<string, number> = { PL: 3, LL: 3, SA: 3, L1: 2, BL: 2 };

export default function CompetitionHub() {
  const params = useParams<{ competition: string }>();
  const code = params.competition?.toUpperCase() || "";
  const meta = getCompetition(code);

  const [standings, setStandings] = useState<StandingsPayload | null>(null);
  const [titleRace, setTitleRace] = useState<TitleRacePayload | null>(null);
  const [bracket, setBracket] = useState<BracketPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [narration, setNarration] = useState<string | null>(null);
  const [narrationError, setNarrationError] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNarration(null);
    setNarrationError(null);

    (async () => {
      try {
        const standingsRes = await axios.get(`${apiUrl()}/standings`, { params: { league: code } });
        if (cancelled) return;
        setStandings(standingsRes.data);

        if (meta.kind === "cup") {
          const bracketRes = await axios.get(`${apiUrl()}/bracket`, { params: { competition: code } });
          if (!cancelled) setBracket(bracketRes.data);
        } else {
          const raceRes = await axios.get(`${apiUrl()}/title_race`, { params: { league: code } });
          if (!cancelled) setTitleRace(raceRes.data);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.detail || "Could not load this competition's data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, meta]);

  const askForNarration = async () => {
    if (meta?.kind === "cup") return;
    setNarrating(true);
    setNarrationError(null);
    try {
      const res = await axios.post(`${apiUrl()}/ai/title_race`, { league: code });
      if (res.data.ai?.summary) {
        setNarration(res.data.ai.summary);
      } else {
        setNarrationError(res.data.ai?.error || "The AI couldn't narrate this one right now.");
      }
    } catch (e: any) {
      setNarrationError(e.response?.data?.detail || "The AI couldn't narrate this one right now.");
    } finally {
      setNarrating(false);
    }
  };

  if (!meta) return null;

  return (
    <Reveal trigger="mount" replayKey={loading} stagger={0.12} className="space-y-8">
      {loading && (
        <div className="text-center py-16 text-muted-foreground">Loading {meta.name}...</div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && standings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              Table
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StandingsTable data={standings} relegationSpots={RELEGATION_SPOTS[code]} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && titleRace && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Title Race
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={askForNarration}
              disabled={narrating}
              className="border-primary/30 hover:bg-primary/20 hover:text-primary"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {narrating ? "Thinking..." : "Ask Claude to narrate this"}
            </Button>
          </CardHeader>
          <CardContent>
            {narration && (
              <p className="mb-4 text-sm rounded-lg border border-primary/20 bg-primary/5 p-4 whitespace-pre-wrap">
                {narration}
              </p>
            )}
            {narrationError && (
              <p className="mb-4 text-sm text-muted-foreground">{narrationError}</p>
            )}
            <TitleRaceList data={titleRace} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && bracket && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Knockout Bracket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BracketBoard data={bracket} />
          </CardContent>
        </Card>
      )}
    </Reveal>
  );
}
