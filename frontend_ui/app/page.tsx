"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Shield, Star, AlertTriangle, Clock, Sparkles, Users } from "lucide-react";
import { motion } from "framer-motion";
import InjurySelector, { Injury } from "./components/InjurySelector";
import MatchContext from "./components/MatchContext";
import TeamCombobox from "./components/TeamCombobox";
import LineupBuilder from "./components/LineupBuilder";
import TeamLineup from "./components/TeamLineup";
import HomepageHero from "./components/HomepageHero";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

// Background Map
const LEAGUE_BG: Record<string, string> = {
  PL: "/leagues/pl.png",
  LL: "/leagues/laliga.png",
  SA: "/leagues/seriea.jpg",
  L1: "/leagues/ligue1.png",
  WC: "/leagues/worldcup.jpg",
};

export default function Home() {
  const [home, setHome] = useState<string>("Arsenal");
  const [away, setAway] = useState<string>("Liverpool");
  const [league, setLeague] = useState<string>("PL");

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [preview, setPreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [injuryData, setInjuryData] = useState<any>(null);
  const [loadingInjuries, setLoadingInjuries] = useState(false);
  const [showLineup, setShowLineup] = useState(false);

  const [homeInjuries, setHomeInjuries] = useState<Injury[]>([]);
  const [awayInjuries, setAwayInjuries] = useState<Injury[]>([]);

  const [homeRest, setHomeRest] = useState<number>(7);
  const [awayRest, setAwayRest] = useState<number>(7);

  const [teams, setTeams] = useState<{ name: string, id: number | null }[]>([]);

  // Fetch teams when league changes
  useEffect(() => {
    const getTeams = async () => {
      try {
        const res = await axios.get("http://localhost:8000/teams", { params: { league } });
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
  }, [league]);

  const predict = async () => {
    setLoading(true);
    setPreview("");
    try {
      const response = await axios.post("http://localhost:8000/predict", {
        home: home.trim(),
        away: away.trim(),
        home_injuries: homeInjuries,
        away_injuries: awayInjuries,
        home_rest_days: homeRest,
        away_rest_days: awayRest,
        league: league
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
    try {
      const res = await axios.get("http://localhost:8000/preview", {
        params: {
          home,
          away,
          league
        }
      });
      setPreview(res.data.preview);
    } catch (error) {
      console.error("Preview error:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const fetchLiveData = async () => {
    setLoadingInjuries(true);
    try {
      const [homeRes, awayRes] = await Promise.all([
        axios.get("http://localhost:8000/injuries", { params: { team: home } }),
        axios.get("http://localhost:8000/injuries", { params: { team: away } })
      ]);

      setHomeInjuries(homeRes.data.injuries || []);
      setAwayInjuries(awayRes.data.injuries || []);
      setHomeRest(homeRes.data.rest_days || 7);
      setAwayRest(awayRes.data.rest_days || 7);
    } catch (error) {
      console.error("Live data error:", error);
    } finally {
      setLoadingInjuries(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header league={league} setLeague={setLeague} />

      {/* Hero Section with League Background */}
      <div
        id="hero"
        className="relative min-h-[500px] flex items-center justify-center"
        style={{
          backgroundImage: `url(${LEAGUE_BG[league]})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary">
              {league === "WC" ? "World Cup Mode" : "Ball Knowledge"}
            </h1>
            <p className="text-muted-foreground text-lg">
              Let's see if the AI knows BALL
            </p>
            <div className="mt-4">
              <Button onClick={fetchLiveData} className="gap-2">
                <Sparkles size={16} />
                Fetch Live Data
              </Button>
            </div>
          </div>

          <HomepageHero />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Match Predictor */}
        <section id="predictor">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Match Predictor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <TeamCombobox
                    label="Home Team"
                    teams={teams}
                    selectedTeam={home}
                    setSelectedTeam={setHome}
                  />
                </div>
                <div>
                  <TeamCombobox
                    label="Away Team"
                    teams={teams}
                    selectedTeam={away}
                    setSelectedTeam={setAway}
                  />
                </div>
              </div>

              {/* Injuries & Rest Days */}
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

              {/* Predict Button */}
              <Button
                onClick={predict}
                disabled={loading || !home || !away}
                className="w-full"
                size="lg"
              >
                {loading ? "Predicting..." : "Predict Match"}
              </Button>

              {/* Results */}
              {result && !result.error && result.home_win !== undefined && (
                <Card className="bg-secondary">
                  <CardContent className="pt-6">
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
                    <Button onClick={generatePreview} variant="outline" className="w-full mt-4 border-primary/30 hover:bg-primary/20 hover:text-primary transition-colors">
                      Generate AI Preview
                    </Button>
                    {preview && <p className="mt-4 text-sm">{preview}</p>}
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

        {/* Team Lineups */}
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
                  {/* Home Team Lineup */}
                  <div>
                    <h3 className="text-lg font-bold mb-4 text-center border-b border-border pb-2">{home}</h3>
                    <TeamLineup teamName={home} />
                  </div>

                  {/* Away Team Lineup */}
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
      </main>

      <Footer />
    </div>
  );
}
