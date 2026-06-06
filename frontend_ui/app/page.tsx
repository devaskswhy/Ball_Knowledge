"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Shield, Star, AlertTriangle, Clock, Sparkles, Users, Calendar, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import InjurySelector, { Injury } from "./components/InjurySelector";
import TeamCombobox from "./components/TeamCombobox";
import LineupBuilder from "./components/LineupBuilder";
import TeamLineup from "./components/TeamLineup";
import HomepageHero from "./components/HomepageHero";
import { Fixture } from "./components/HomepageHero";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import WorldCupGroups from "./components/WorldCupGroups";
import FifaRatingsTable from "./components/FifaRatingsTable";
import MatchAnalyticsPanel from "./components/MatchAnalyticsPanel";
import PlayerAnalytics from "./components/PlayerAnalytics";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

// TODO: Replace gradient with real image from /public/leagues/
const LEAGUE_BG: Record<string, string> = {
  PL: "linear-gradient(135deg, #2b0030 0%, #080f26 100%)", // Premier League: deep purple-to-dark-navy
  LL: "linear-gradient(135deg, #7a0909 0%, #290000 100%)", // La Liga: deep red-to-dark-maroon
  SA: "linear-gradient(135deg, #0b1a30 0%, #000000 100%)", // Serie A: dark navy-to-black
  L1: "linear-gradient(135deg, #0a1f44 0%, #004d4d 100%)", // Ligue 1: dark blue-to-deep-teal
  BL: "linear-gradient(135deg, #2c2c2c 0%, #111111 100%)", // Bundesliga: dark grey-to-charcoal
  WC: "linear-gradient(135deg, #856a00 0%, #2b3b00 100%)", // World Cup: deep gold-to-dark-olive
};

// League Dynamic Styles
const LEAGUE_STYLES: Record<string, { heading: string, text: string }> = {
  PL: { heading: "from-[#38003c] via-[#e90052] to-[#00ff85]", text: "text-purple-200" }, // Premier League colors
  LL: { heading: "from-[#ee8707] via-[#ff4b4b] to-[#121212]", text: "text-orange-200" }, // La Liga 
  SA: { heading: "from-[#004d98] via-[#00a1e0] to-[#ffffff]", text: "text-blue-200" }, // Serie A
  L1: { heading: "from-[#001738] via-[#da291c] to-[#ffffff]", text: "text-gray-200" }, // Ligue 1
  BL: { heading: "from-[#d1101a] via-[#fc1d25] to-[#ffffff]", text: "text-red-100" }, // Bundesliga
  WC: { heading: "from-yellow-300 via-yellow-500 to-yellow-700", text: "text-yellow-100" }, // World Cup
};

export default function Home() {
  const [home, setHome] = useState<string>("Arsenal");
  const [away, setAway] = useState<string>("Liverpool");
  const [league, setLeague] = useState<string>("PL");

  const [showMatches, setShowMatches] = useState(true);
  const [showStats, setShowStats] = useState(true);

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

  const [teams, setTeams] = useState<{ name: string, id: number | null }[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);

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



  return (
    <div className="min-h-screen">
      <Header league={league} setLeague={setLeague} />

      {/* Hero Section with League Background */}
      <div
        id="hero"
        className="relative min-h-[600px] flex items-start justify-center pt-2 pb-12"
        style={{
          backgroundImage: LEAGUE_BG[league],
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/35 to-background" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col justify-between h-full">
          {/* Top Section - Heading */}
          <div className="text-center">
            <h1 className={`text-5xl md:text-7xl font-black mb-4 pb-2 leading-tight bg-clip-text text-transparent bg-gradient-to-r drop-shadow-lg ${LEAGUE_STYLES[league]?.heading || "from-primary via-accent to-primary"}`}>
              {league === "WC" ? "World Cup Mode" : "Ball Knowledge"}
            </h1>
            <p className={`text-lg font-medium drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] ${LEAGUE_STYLES[league]?.text || "text-muted-foreground"}`}>
              Let's see if the AI knows BALL
            </p>
          </div>

          <div className="mt-8">
            {/* View Toggles - Tucked Away */}
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
            <HomepageHero showMatches={showMatches} showStats={showStats} onFixtureClick={(f) => setSelectedFixture(f)} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* WC Groups - Top for World Cup Mode */}
        {league === "WC" && (
          <section id="wc-groups">
            <WorldCupGroups />
          </section>
        )}

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

              {/* Build Lineup Button */}
              <Button
                onClick={() => setShowLineupBuilder(true)}
                disabled={!home}
                variant="outline"
                className="w-full border-primary/30 hover:bg-primary/20 hover:text-primary transition-colors"
              >
                <Users className="mr-2 h-4 w-4" />
                Build Lineup
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
          {league !== "WC" && (
            <Button
              onClick={() => setShowLineup(!showLineup)}
              variant="outline"
              disabled={!home || !away}
              className="border-primary/30 hover:bg-primary/20 hover:text-primary transition-colors"
            >
              <Users className="mr-2 h-4 w-4" />
              {showLineup ? "Hide" : "Show"} Team Lineups
            </Button>
          )}
        </div>

        {/* Player Analytics Section */}
        {league !== "WC" && teams.length > 0 && (
          <section id="analytics">
            <PlayerAnalytics teams={teams} selectedTeam={home} />
          </section>
        )}

        {/* WC Ratings Table (Visible only in WC mode) */}
        {league === "WC" && (
          <section id="wc-ratings" className="pt-8 border-t border-white/10">
            <FifaRatingsTable />
          </section>
        )}
      </main>

      <Footer />

      {/* Match Analytics Slide-Over Panel */}
      <MatchAnalyticsPanel
        fixture={selectedFixture}
        league={league}
        onClose={() => setSelectedFixture(null)}
      />

      {/* LineupBuilder Modal */}
      <LineupBuilder
        team={home}
        isOpen={showLineupBuilder}
        onClose={() => setShowLineupBuilder(false)}
      />
    </div>
  );
}
