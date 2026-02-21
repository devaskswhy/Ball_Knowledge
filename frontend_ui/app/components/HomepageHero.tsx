"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Image from "next/image";
import { motion } from "framer-motion";
import { Trophy, Star, TrendingUp, Zap, Calendar, ChevronRight } from "lucide-react";

interface Fixture {
  id: number;
  date: string;
  status: string;
  home: { id: number; name: string; logo: string };
  away: { id: number; name: string; logo: string };
  league: { name: string; logo: string };
  score: { home: number | null; away: number | null };
}

interface Player {
  id: number;
  name: string;
  photo: string;
  age: number;
  nationality: string;
  team: { name: string; logo: string };
  goals: number;
  assists: number;
  rating: string;
}

// Featured Match Card
function FeaturedMatchCard({ fixture }: { fixture: Fixture }) {
  const matchTime = new Date(fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] border border-white/10 p-6 group hover:border-cyan-500/30 transition-all duration-300"
    >
      {/* Glowing orb effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl group-hover:bg-cyan-500/30 transition-all" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

      {/* League badge */}
      <div className="flex items-center gap-2 mb-4">
        {fixture.league.logo && (
          <Image src={fixture.league.logo} alt="" width={20} height={20} className="object-contain" />
        )}
        <span className="text-xs font-medium text-gray-400">{fixture.league.name}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-cyan-400">
          <Calendar size={12} /> {matchTime}
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
              <span className="text-3xl font-black text-white">{fixture.score.home ?? 0}</span>
              <span className="text-xl text-gray-500">-</span>
              <span className="text-3xl font-black text-white">{fixture.score.away ?? 0}</span>
            </div>
          )}
          <span className="text-[10px] text-gray-500 mt-1">
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
  const ratingNum = parseFloat(player.rating || "0");

  const getRatingColor = () => {
    if (ratingNum >= 7.5) return "from-yellow-400 to-amber-500";
    if (ratingNum >= 7.0) return "from-green-400 to-emerald-500";
    return "from-blue-400 to-cyan-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.1 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 transition-all group"
    >
      <div className="relative">
        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white z-10">
          {rank}
        </span>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-cyan-400/50">
          {player.photo && (
            <Image src={player.photo} alt={player.name} width={48} height={48} className="object-cover" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.name}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {player.team?.logo && (
            <Image src={player.team.logo} alt="" width={14} height={14} className="object-contain" />
          )}
          <span className="truncate">{player.team?.name}</span>
        </div>
      </div>

      <div className="text-right">
        <div className={`text-lg font-black bg-gradient-to-r ${getRatingColor()} bg-clip-text text-transparent`}>
          {player.rating || "N/A"}
        </div>
        <span className="text-[10px] text-gray-500">RATING</span>
      </div>
    </motion.div>
  );
}

// Player of the Week Card
function PlayerOfWeekCard({ player }: { player: Player }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-[#1e293b] to-purple-500/20 border border-amber-500/30 p-6"
    >
      {/* Crown/Trophy */}
      <div className="absolute top-4 right-4">
        <Trophy className="w-8 h-8 text-amber-400" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-amber-400/50 shadow-lg shadow-amber-500/20">
            {player.photo && (
              <Image src={player.photo} alt={player.name} width={80} height={80} className="object-cover" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-[10px] font-bold text-black">
            ⭐ TOP
          </div>
        </div>

        <div className="flex-1">
          <p className="text-xs text-amber-400 font-medium uppercase tracking-wider mb-1">Player of the Week</p>
          <h3 className="text-xl font-black text-white">{player.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {player.team?.logo && (
              <Image src={player.team.logo} alt="" width={16} height={16} className="object-contain" />
            )}
            <span className="text-sm text-gray-400">{player.team?.name}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center">
          <div className="text-2xl font-black text-white">{player.goals}</div>
          <div className="text-[10px] text-gray-500 uppercase">Goals</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-white">{player.assists || 0}</div>
          <div className="text-[10px] text-gray-500 uppercase">Assists</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
            {player.rating || "N/A"}
          </div>
          <div className="text-[10px] text-gray-500 uppercase">Rating</div>
        </div>
      </div>
    </motion.div>
  );
}

// Main Homepage Hero Section
export default function HomepageHero({ showMatches = true, showStats = true }: { showMatches?: boolean, showStats?: boolean }) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [playerOfWeek, setPlayerOfWeek] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("http://localhost:8000/homepage");
        setFixtures(res.data.featured_fixtures || []);
        setTopPlayers(res.data.top_players || []);
        setPlayerOfWeek(res.data.player_of_week || null);
      } catch (err) {
        console.error("Failed to fetch homepage data", err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
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
              <FeaturedMatchCard key={f.id} fixture={f} />
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
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Impact Players</h2>
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
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Star Player</h2>
              </div>
              <PlayerOfWeekCard player={playerOfWeek} />
            </section>
          )}
        </div>
      )}

      {/* Empty state */}
      {fixtures.length === 0 && topPlayers.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No matches or player data available today.</p>
          <p className="text-sm mt-2">Try again later or check API connection.</p>
        </div>
      )}
    </div>
  );
}
