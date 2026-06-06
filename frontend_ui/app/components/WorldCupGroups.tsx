"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Globe } from "lucide-react";
import Image from "next/image";

interface WCTeam {
    name: string;
    id: number;
    rank: number;
}

interface WCGroup {
    name: string;
    teams: WCTeam[];
}

export default function WorldCupGroups() {
    const [groups, setGroups] = useState<WCGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await axios.get("http://localhost:8000/wc_groups");
            setGroups(res.data);
        } catch (err) {
            console.error("Failed to fetch WC groups", err);
            setError("Could not load expected groups. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-6 h-6 bg-gray-700 rounded animate-pulse" />
                <div className="h-7 w-64 bg-gray-700 rounded animate-pulse" />
                <div className="ml-auto h-6 w-32 bg-gray-700 rounded-full animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-gray-800/50 rounded-xl overflow-hidden animate-pulse">
                        <div className="h-10 bg-gray-700/50" />
                        <div className="p-3 space-y-2">
                            {[1, 2, 3, 4].map((j) => (
                                <div key={j} className="h-10 bg-gray-700/30 rounded-lg" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (error) return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
                onClick={fetchGroups}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
                Retry
            </button>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
                <Globe className="text-blue-400 h-6 w-6" />
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                    Expected World Cup 2026 Groups
                </h2>
                <span className="text-xs text-muted-foreground ml-auto border border-white/10 px-2 py-1 rounded-full">
                    Based on FIFA Rankings
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {groups.map((group) => (
                    <div
                        key={group.name}
                        className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-lg hover:border-blue-500/30 transition-colors"
                    >
                        <div className="bg-[#1e293b] px-4 py-2 border-b border-[#334155] flex justify-between items-center">
                            <span className="font-bold text-white">{group.name}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Pot 1-4</span>
                        </div>

                        <div className="p-3 space-y-2">
                            {group.teams.map((team, idx) => (
                                <div key={team.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1e293b] transition-colors group">
                                    <span className="text-xs font-mono text-gray-500 w-4">{idx + 1}</span>
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-black/20 shrink-0">
                                        <Image
                                            src={`https://media.api-sports.io/football/teams/${team.id}.png`}
                                            alt={team.name}
                                            fill
                                            className="object-contain p-0.5"
                                            onError={(e) => {
                                                // Fallback to a generic icon or hide
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                target.parentElement!.innerHTML = '<span class="flex items-center justify-center w-full h-full text-[10px] text-gray-500">⚽</span>';
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                                        {team.name}
                                    </span>
                                    <span className="ml-auto text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                                        #{team.rank}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
