"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, TrendingUp, Trophy } from "lucide-react";
import Image from "next/image";

interface WCTeam {
    name: string;
    id: number;
    rank: number;
}

export default function FifaRatingsTable() {
    const [teams, setTeams] = useState<WCTeam[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRatings = async () => {
            try {
                // League=WC returns teams sorted by rank now
                const res = await axios.get("http://localhost:8000/teams", { params: { league: "WC" } });
                setTeams(res.data.teams);
            } catch (err) {
                console.error("Failed to fetch ratings", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRatings();
    }, []);

    if (loading) return (
        <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-primary h-8 w-8" />
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
                <Trophy className="text-yellow-400 h-6 w-6" />
                <h2 className="text-xl font-bold text-white">
                    FIFA World Rankings
                </h2>
                <span className="text-xs text-muted-foreground ml-auto">
                    Live Updates
                </span>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-[#1e293b] text-gray-400 text-xs uppercase tracking-wider">
                            <th className="px-6 py-3 font-medium">Rank</th>
                            <th className="px-6 py-3 font-medium">Team</th>
                            <th className="px-6 py-3 font-medium text-right">Trend</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]">
                        {teams.map((team, idx) => (
                            <tr key={team.name} className="hover:bg-[#1e293b]/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${idx < 3 ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-gray-800 text-gray-400"
                                        }`}>
                                        {team.rank || idx + 1}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-black/20 shrink-0">
                                            <Image
                                                src={`https://media.api-sports.io/football/teams/${team.id}.png`}
                                                alt={team.name}
                                                fill
                                                className="object-contain p-1"
                                            />
                                        </div>
                                        <span className="font-semibold text-gray-200 group-hover:text-white">{team.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <TrendingUp className="h-4 w-4 text-green-400 ml-auto opacity-50" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
