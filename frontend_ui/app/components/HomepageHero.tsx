"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Image from "next/image";
import { motion } from "framer-motion";
import { Trophy, Star, TrendingUp, Zap, Calendar, ChevronRight } from "lucide-react";
import { useWebSocket } from "@/app/contexts/WebSocketContext";
import { apiUrl } from "@/app/lib/api";

export interface Fixture {
  id: number;
  date: string;
  status: string;
  home: { id: number; name: string; logo: string };
  away: { id: number; name: string; logo: string };
  league: { name: string; logo: string };
  score: { home: number | null; away: number | null };
}

// football-data.org gives goals/assists for the season in progress. It has no
// per-player rating or photo, and inventing either would put a number on the
// page the data never supported - so the cards lead with goals instead.
interface Player {
  id: number;
  name: string;
  nationality: string | null;
  team: string;
  team_crest: string | null;
  competition: string;
  goals: number;
  assists: number;
  penalties: number;
}

// Featured Match Card
function FeaturedMatchCard({ fixture, onClick }: { fixture: Fixture; onClick?: () => void }) {
  const matchTime = new Date(fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Check if match is live
  const isLive = ["1H", "HT", "2H", "ET", "P"].includes(fixture.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] border p-6 group transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
        isLive ? "border-green-500/50 hover:border-green-500/70" : "border-white/10 hover:border-cyan-500/30"
      }`}
    >
      {/* Glowing orb effect */}
      <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl group-hover:transition-all ${
        isLive ? "bg-green-500/20 group-hover:bg-green-500/30" : "bg-cyan-500/20 group-hover:bg-cyan-500/30"
      }`} />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

      {/* League badge */}
      <div className="flex items-center gap-2 mb-4">
        {fixture.league.logo && (
          <Image src={fixture.league.logo} alt="" width={20} height={20} className="object-contain" />
        )}
        <span className="text-xs font-medium text-gray-400">{fixture.league.name}</span>
        <span className="ml-auto flex items-center gap-1 text-xs">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="font-bold text-green-400">LIVE</span>
            </>
          ) : (
            <>
              <Calendar size={12} className="text-cyan-400" /> {matchTime}
            </>
          )}
        </span>
      </div>

      {/* Teams */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        {/* Home */}
        <div className="flex-1 text-center">
          <div className="w-16 h-16 mx-auto mb-2 relative">
            {fixture.home.logo && (
              <Image src={fixture.home.logo} alt={fixture.home.name} fill className="object-contain drop-shadow-lg" />
            )}
          </div>
          <p className="text-sm font-bold text-white truncate">{fixture.home.name}</p>
        </div>

        {/* VS / Score */}
        <div className="flex flex-col items-center">
          {fixture.status === "NS" ? (
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">VS</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black ${isLive ? "text-green-400" : "text-white"}`}>
                {fixture.score.home ?? 0}
              </span>
              <span className="text-xl text-gray-500">-</span>
              <span className={`text-3xl font-black ${isLive ? "text-green-400" : "text-white"}`}>
                {fixture.score.away ?? 0}
              </span>
            </div>
          )}
          <span className={`text-[10px] mt-1 ${isLive ? "text-green-400 font-bold" : "text-gray-500"}`}>
            {fixture.status === "NS" ? "Upcoming" : fixture.status}
          </span>
        </div>

        {/* Away */}
        <div className="flex-1 text-center">
          <div className="w-16 h-16 mx-auto mb-2 relative">
            {fixture.away.logo && (
              <Image src={fixture.away.logo} alt={fixture.away.name} fill className="object-contain drop-shadow-lg" />
            )}
          </div>
          <p className="text-sm font-bold text-white truncate">{fixture.away.name}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Player Card
function PlayerCard({ player, rank }: { player: Player; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.1 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] border border-white/10 hover:border-cyan-500/30 transition-all duration-300 group shadow-lg"
    >
      <span className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
        {rank}
      </span>

      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {player.team_crest && (
          <Image src={player.team_crest} alt="" width={28} height={28} className="object-contain" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {player.team} · {player.competition}
        </p>
      </div>

      <div className="text-right shrink-0">
        <div className="text-lg font-black bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent tabular-nums">
          {player.goals}
        </div>
        <span className="text-[10px] text-gray-500">
          GOAL{player.goals === 1 ? "" : "S"}
        </span>
      </div>
    </motion.div>
  );
}

// Leading scorer card
function PlayerOfWeekCard({ player }: { player: Player }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] border border-amber-500/30 p-6 shadow-xl"
    >
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-4 right-4">
        <Trophy className="w-8 h-8 text-amber-400" />
      </div>

      <div className="flex items-center gap-4">
        <div className="w-20 h-20 shrink-0 rounded-full border-4 border-amber-400/50 bg-white/5 flex items-center justify-center shadow-lg shadow-amber-500/20">
          {player.team_crest && (
            <Image src={player.team_crest} alt={player.team} width={44} height={44} className="object-contain" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-amber-400 font-medium uppercase tracking-wider mb-1">Golden Boot</p>
          <h3 className="text-xl font-black text-white truncate">{player.name}</h3>
          <p className="text-sm text-gray-400 truncate mt-1">
            {player.team}
            {player.nationality ? ` · ${player.nationality}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10 text-center">
        <div>
          <p className="text-2xl font-black text-white tabular-nums">{player.goals}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Goals</p>
        </div>
        <div>
          <p className="text-2xl font-black text-white tabular-nums">{player.assists}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Assists</p>
        </div>
        <div>
          <p className="text-2xl font-black text-amber-400 tabular-nums">{player.penalties}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Penalties</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function HomepageHero({ showMatches = true, showStats = true, onFixtureClick }: { showMatches?: boolean, showStats?: boolean, onFixtureClick?: (fixture: Fixture) => void }) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [playerOfWeek, setPlayerOfWeek] = useState<Player | null>(null);
  const [statsSeason, setStatsSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { wsConnected, setWsConnected } = useWebSocket();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${apiUrl()}/homepage`);
      setFixtures(res.data.featured_fixtures || []);
      setTopPlayers(res.data.top_players || []);
      setPlayerOfWeek(res.data.player_of_week || null);
      setStatsSeason(res.data.player_stats_season || null);
    } catch (err) {
      console.error("Failed to fetch homepage data", err);
      setError("Failed to load homepage data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection for live scores
  useEffect(() => {
    let isMounted = true;
    
    // Resolve URL dynamically to handle cases where frontend is accessed from a different device (e.g. 192.168.x.x)
    const defaultWsUrl = apiUrl().replace(/^http/, "ws") + "/ws/live";
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl;
    
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      if (!isMounted) return;
      
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.error("Invalid WebSocket URL:", wsUrl, err);
        return;
      }
      
      ws.onopen = () => {
        if (!isMounted) {
          ws?.close();
          return;
        }
        console.log("WebSocket connected to", wsUrl);
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "live_scores") {
            // Update fixtures with live scores
            setFixtures((prevFixtures) => {
              const liveMatchesMap = new Map(
                message.matches.map((m: Fixture) => [m.id, m])
              );
              
              return prevFixtures.map((fixture) => {
                const liveMatch = liveMatchesMap.get(fixture.id);
                if (liveMatch) {
                  return { ...fixture, ...liveMatch };
                }
                return fixture;
              });
            });
          } else if (message.type === "ping") {
            // Respond to ping to keep connection alive
            console.log("Received ping from server");
          } else if (message.type === "error") {
            console.error("WebSocket error:", message.message);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        console.log("WebSocket disconnected, reconnecting in 5 seconds...");
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        if (!isMounted) return;
        console.error(`WebSocket connection error to ${wsUrl} - will attempt reconnection`);
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Featured Matches Skeleton */}
        {showMatches && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-48 bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-gray-800/50 rounded-2xl border border-white/5 animate-pulse" />
              ))}
            </div>
          </section>
        )}
        {/* Top Players Skeleton */}
        {showStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-40 bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-800/50 rounded-xl border border-white/5 animate-pulse" />
                ))}
              </div>
            </section>
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-32 bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="h-48 bg-gray-800/50 rounded-2xl border border-white/5 animate-pulse" />
            </section>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left">
      {/* Featured Matches */}
      {showMatches && fixtures.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Today's Matches</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fixtures.map((f) => (
              <FeaturedMatchCard key={f.id} fixture={f} onClick={() => onFixtureClick?.(f)} />
            ))}
          </div>
        </section>
      )}

      {/* Two columns: Top Players + Player of Week */}
      {showStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Players */}
          {topPlayers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Top Scorers</h2>
                {statsSeason && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {statsSeason} season
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {topPlayers.map((p, i) => (
                  <PlayerCard key={p.id} player={p} rank={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Player of the Week */}
          {playerOfWeek && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Leading Scorer</h2>
                {statsSeason && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {statsSeason}
                  </span>
                )}
              </div>
              <PlayerOfWeekCard player={playerOfWeek} />
            </section>
          )}
        </div>
      )}

      {/* Empty state */}
      {fixtures.length === 0 && topPlayers.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>Live fixtures and player stats are unavailable right now.</p>
          <p className="text-sm mt-2">
            These come from API-Football. Tables, title races, the bracket and
            predictions are computed locally and work regardless — pick a
            competition below.
          </p>
        </div>
      )}
    </div>
  );
}
