"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, X, Trophy, Activity, Target, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";

interface PlayerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerId: number;
    playerName: string;
    season?: number;
    leagueId?: number;
}

export default function PlayerStatsModal({
    isOpen,
    onClose,
    playerId,
    playerName,
    season = 2024,
    leagueId = 39
}: PlayerStatsModalProps) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchStats = async () => {
        // Don't set loading on subsequent refreshes to keep it smooth
        if (!stats) setLoading(true);

        try {
            const res = await axios.get("http://localhost:8000/player_stats", {
                params: { player_id: playerId, season, league: leagueId }
            });

            if (res.data && res.data.player) {
                setStats(res.data);
                setError("");
            } else {
                setError("No stats available for this season.");
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load player stats.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && playerId) {
            setStats(null); // Reset on open
            fetchStats();

            // Auto-refresh logic (60s)
            const interval = setInterval(() => {
                console.log(`Refreshing stats for ${playerName}...`);
                fetchStats();
            }, 60000);

            return () => clearInterval(interval);
        }
    }, [isOpen, playerId]);

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#111827] border-[#1F2937] text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        <span>Player Statistics</span>
                    </DialogTitle>
                </DialogHeader>

                {loading && !stats ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
                    </div>
                ) : error ? (
                    <div className="text-red-400 text-center p-4">{error}</div>
                ) : stats ? (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500 bg-[#1F2937] flex items-center justify-center">
                                {stats?.player?.photo ? (
                                    <Image
                                        src={stats.player.photo}
                                        alt={stats?.player?.name || "Player"}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <span className="text-2xl">⚽</span>
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{stats.player.name}</h2>
                                <p className="text-gray-400 text-sm">
                                    {stats?.player?.nationality} • {stats?.statistics?.team?.name || "Unknown Team"}
                                </p>
                                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                    <Activity size={12} /> Season stats (updated periodically)
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#1F2937] p-3 rounded-lg flex items-center gap-3">
                                <div className="bg-blue-500/20 p-2 rounded-full text-blue-400">
                                    <Target size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Goals</p>
                                    <p className="font-bold text-lg">{stats?.statistics?.goals?.total || 0}</p>
                                </div>
                            </div>

                            <div className="bg-[#1F2937] p-3 rounded-lg flex items-center gap-3">
                                <div className="bg-green-500/20 p-2 rounded-full text-green-400">
                                    <Activity size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Assists</p>
                                    <p className="font-bold text-lg">{stats?.statistics?.goals?.assists || 0}</p>
                                </div>
                            </div>

                            <div className="bg-[#1F2937] p-3 rounded-lg flex items-center gap-3">
                                <div className="bg-yellow-500/20 p-2 rounded-full text-yellow-400">
                                    <Trophy size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Rating</p>
                                    <p className="font-bold text-lg">{stats?.statistics?.games?.rating || "N/A"}</p>
                                </div>
                            </div>

                            <div className="bg-[#1F2937] p-3 rounded-lg flex items-center gap-3">
                                <div className="bg-red-500/20 p-2 rounded-full text-red-400">
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Appearances</p>
                                    <p className="font-bold text-lg">{stats?.statistics?.games?.appearences || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
