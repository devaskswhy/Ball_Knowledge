"use client";

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Flame, Target, Share2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import FootballPitch from "./FootballPitch";
import HeatmapOverlay, { HeatmapLegend } from "./HeatmapOverlay";
import ShotMapOverlay, { ShotMapLegend } from "./ShotMapOverlay";
import PassingNetwork, { PassingNetworkStats } from "./PassingNetwork";
import {
    generatePlayerHeatmap,
    generateShotMap,
    generatePassingNetwork,
} from "../lib/mockData";

interface PlayerAnalyticsProps {
    teams: { name: string; id: number | null }[];
    selectedTeam: string;
}

interface SquadPlayer {
    id: number;
    name: string;
    position: string;
    photo: string;
    number: number;
}

/**
 * Full Player Analytics section: Heatmap, Shot Map, Passing Network.
 * Uses team/player selectors with mock pitch visualizations.
 */
export default function PlayerAnalytics({
    teams,
    selectedTeam,
}: PlayerAnalyticsProps) {
    const [team, setTeam] = useState(selectedTeam);
    const [squad, setSquad] = useState<SquadPlayer[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<string>("");
    const [selectedPlayerPos, setSelectedPlayerPos] = useState<string>("MID");
    const [activeTab, setActiveTab] = useState<"heatmap" | "shotmap" | "passing">(
        "heatmap"
    );

    // Fetch squad when team changes
    useEffect(() => {
        setTeam(selectedTeam);
    }, [selectedTeam]);

    useEffect(() => {
        const fetchSquad = async () => {
            try {
                const res = await axios.get("http://localhost:8000/squad", {
                    params: { team },
                });
                const players = (res.data.squad || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    position: p.position || "MID",
                    photo: p.photo || "",
                    number: p.number || 0,
                }));
                setSquad(players);
                if (players.length > 0) {
                    setSelectedPlayer(players[0].name);
                    setSelectedPlayerPos(players[0].position);
                }
            } catch {
                // Use mock squad
                const mockSquad = [
                    { id: 1, name: "Ederson", position: "GK", photo: "", number: 31 },
                    { id: 2, name: "Walker", position: "DEF", photo: "", number: 2 },
                    { id: 3, name: "Dias", position: "DEF", photo: "", number: 3 },
                    { id: 4, name: "Stones", position: "DEF", photo: "", number: 5 },
                    { id: 5, name: "Gvardiol", position: "DEF", photo: "", number: 24 },
                    { id: 6, name: "De Bruyne", position: "MID", photo: "", number: 17 },
                    { id: 7, name: "Rodri", position: "MID", photo: "", number: 16 },
                    { id: 8, name: "Silva", position: "MID", photo: "", number: 20 },
                    { id: 9, name: "Foden", position: "ATT", photo: "", number: 47 },
                    { id: 10, name: "Haaland", position: "ATT", photo: "", number: 9 },
                    { id: 11, name: "Grealish", position: "ATT", photo: "", number: 10 },
                ];
                setSquad(mockSquad);
                setSelectedPlayer(mockSquad[0].name);
                setSelectedPlayerPos(mockSquad[0].position);
            }
        };
        fetchSquad();
    }, [team]);

    // Map position strings from API
    const normalizePosition = (pos: string) => {
        if (pos.includes("Goal")) return "GK";
        if (pos.includes("Def")) return "DEF";
        if (pos.includes("Mid")) return "MID";
        if (pos.includes("Att") || pos.includes("For")) return "ATT";
        return pos;
    };

    // Generate data
    const heatmapData = useMemo(
        () =>
            generatePlayerHeatmap(
                selectedPlayer || "Unknown",
                normalizePosition(selectedPlayerPos)
            ),
        [selectedPlayer, selectedPlayerPos]
    );

    const shotData = useMemo(
        () => generateShotMap(team, selectedPlayer || undefined),
        [team, selectedPlayer]
    );

    const passingData = useMemo(
        () => generatePassingNetwork(team),
        [team]
    );

    const tabs = [
        {
            id: "heatmap" as const,
            label: "Player Heatmap",
            icon: Flame,
            color: "text-orange-500",
        },
        {
            id: "shotmap" as const,
            label: "Shot Map (xG)",
            icon: Target,
            color: "text-emerald-400",
        },
        {
            id: "passing" as const,
            label: "Passing Network",
            icon: Share2,
            color: "text-[#CCFF00]",
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <BarChartIcon className="h-5 w-5 text-primary" />
                    Player Analytics
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Tab selector */}
                <div className="flex gap-2 flex-wrap">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${activeTab === tab.id
                                    ? "bg-secondary border-primary/40 text-foreground"
                                    : "bg-transparent border-border text-muted-foreground hover:bg-secondary/50"
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ""}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Control bar */}
                <div className="flex flex-wrap gap-4">
                    {/* Team selector */}
                    <div className="flex-1 min-w-[160px]">
                        <label className="text-xs text-muted-foreground font-medium block mb-1">
                            Team
                        </label>
                        <select
                            value={team}
                            onChange={(e) => setTeam(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:ring-2 focus:ring-primary"
                        >
                            {teams.map((t) => (
                                <option key={t.name} value={t.name}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Player selector (for heatmap and shotmap) */}
                    {activeTab !== "passing" && (
                        <div className="flex-1 min-w-[160px]">
                            <label className="text-xs text-muted-foreground font-medium block mb-1">
                                Player
                            </label>
                            <select
                                value={selectedPlayer}
                                onChange={(e) => {
                                    setSelectedPlayer(e.target.value);
                                    const pl = squad.find((p) => p.name === e.target.value);
                                    if (pl) setSelectedPlayerPos(pl.position);
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:ring-2 focus:ring-primary"
                            >
                                {squad.map((p) => (
                                    <option key={p.id} value={p.name}>
                                        {p.name} ({normalizePosition(p.position)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* ── Heatmap ── */}
                {activeTab === "heatmap" && (
                    <div>
                        <FootballPitch>
                            <HeatmapOverlay data={heatmapData} />
                        </FootballPitch>
                        <HeatmapLegend />
                    </div>
                )}

                {/* ── Shot Map ── */}
                {activeTab === "shotmap" && (
                    <div>
                        <FootballPitch half="right">
                            <ShotMapOverlay shots={shotData} />
                        </FootballPitch>
                        <ShotMapLegend shots={shotData} />
                    </div>
                )}

                {/* ── Passing Network ── */}
                {activeTab === "passing" && (
                    <div>
                        <FootballPitch>
                            <PassingNetwork
                                nodes={passingData.nodes}
                                edges={passingData.edges}
                            />
                        </FootballPitch>
                        <PassingNetworkStats
                            nodes={passingData.nodes}
                            edges={passingData.edges}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Simple bar chart icon (avoiding another lucide import)
function BarChartIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
    );
}
