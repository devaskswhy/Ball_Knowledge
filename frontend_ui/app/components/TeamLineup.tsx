"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Image from "next/image";
import { Users, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface Player {
    id: number;
    name: string;
    age: number;
    number: number;
    position: string;
    photo: string;
    rating: number;
}

interface TeamLineupProps {
    teamName: string;
}

const FORMATIONS: Record<string, { GK: number; DEF: number; MID: number; ATT: number }> = {
    "4-3-3": { GK: 1, DEF: 4, MID: 3, ATT: 3 },
    "4-4-2": { GK: 1, DEF: 4, MID: 4, ATT: 2 },
    "4-2-3-1": { GK: 1, DEF: 4, MID: 5, ATT: 1 },
    "3-5-2": { GK: 1, DEF: 3, MID: 5, ATT: 2 },
};

export default function TeamLineup({ teamName }: TeamLineupProps) {
    const [squad, setSquad] = useState<Player[]>([]);
    const [startingXI, setStartingXI] = useState<Player[]>([]);
    const [bench, setBench] = useState<Player[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showBench, setShowBench] = useState(false);
    const [formation, setFormation] = useState("4-3-3");

    useEffect(() => {
        if (teamName) fetchSquad();
    }, [teamName]);

    const fetchSquad = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await axios.get(`http://localhost:8000/squad`, { params: { team: teamName } });
            const squadData: Player[] = res.data.squad;
            const lineupIds: number[] = res.data.lineup_ids || [];

            setSquad(squadData);
            initializeLineup(squadData, formation, lineupIds);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load squad");
        }
        setLoading(false);
    };

    const initializeLineup = (squadData: Player[], form: string, lineupIds: number[] = []) => {
        const config = FORMATIONS[form];
        let xi: Player[] = [];

        if (lineupIds.length >= 11) {
            xi = lineupIds.slice(0, 11).map(id => squadData.find(p => p.id === id)).filter(Boolean) as Player[];
        }

        if (xi.length < 11) {
            const gks = squadData.filter(p => p.position === "GK" && !xi.includes(p));
            const defs = squadData.filter(p => p.position === "DEF" && !xi.includes(p));
            const mids = squadData.filter(p => p.position === "MID" && !xi.includes(p));
            const atts = squadData.filter(p => p.position === "ATT" && !xi.includes(p));

            while (xi.filter(p => p.position === "GK").length < config.GK && gks.length) xi.push(gks.shift()!);
            while (xi.filter(p => p.position === "DEF").length < config.DEF && defs.length) xi.push(defs.shift()!);
            while (xi.filter(p => p.position === "MID").length < config.MID && mids.length) xi.push(mids.shift()!);
            while (xi.filter(p => p.position === "ATT").length < config.ATT && atts.length) xi.push(atts.shift()!);
        }

        const benchPlayers = squadData.filter(p => !xi.includes(p));
        setStartingXI(xi.slice(0, 11));
        setBench(benchPlayers);
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 85) return "bg-gradient-to-br from-yellow-400 to-yellow-600";
        if (rating >= 80) return "bg-gradient-to-br from-green-400 to-green-600";
        if (rating >= 75) return "bg-gradient-to-br from-blue-400 to-blue-600";
        return "bg-gradient-to-br from-gray-400 to-gray-600";
    };

    const PlayerCard = ({ player }: { player: Player }) => (
        <div className="flex flex-col items-center">
            <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-lg bg-muted">
                    <Image src={player.photo} alt={player.name} width={48} height={48} className="object-cover" />
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getRatingColor(player.rating)} flex items-center justify-center text-[9px] font-black text-white shadow border border-white/20`}>
                    {player.rating}
                </div>
                <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-black/80 flex items-center justify-center text-[8px] font-bold text-white border border-white/20">
                    {player.number}
                </div>
            </div>
            <p className="mt-1 text-[9px] font-semibold text-center truncate max-w-[60px]">
                {player.name.split(" ").pop()}
            </p>
        </div>
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="text-sm">Loading squad...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
            </div>
        );
    }

    if (startingXI.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No lineup data available</p>
            </div>
        );
    }

    const config = FORMATIONS[formation];
    const gks = startingXI.filter(p => p.position === "GK");
    const defs = startingXI.filter(p => p.position === "DEF");
    const mids = startingXI.filter(p => p.position === "MID");
    const atts = startingXI.filter(p => p.position === "ATT");

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Formation</span>
                <select
                    value={formation}
                    onChange={(e) => {
                        setFormation(e.target.value);
                        initializeLineup(squad, e.target.value);
                    }}
                    className="bg-secondary text-xs font-medium rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                    suppressHydrationWarning
                >
                    {Object.keys(FORMATIONS).map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
            </div>

            <div className="relative bg-gradient-to-b from-green-700 to-green-800 rounded-lg p-4 min-h-[400px]">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white"></div>
                    <div className="absolute left-1/2 top-1/2 w-16 h-16 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                </div>

                <div className="relative z-10 flex flex-col justify-between h-full gap-6">
                    <div className="flex justify-around">
                        {atts.slice(0, config.ATT).map(player => (
                            <PlayerCard key={player.id} player={player} />
                        ))}
                    </div>

                    <div className="flex justify-around">
                        {mids.slice(0, config.MID).map(player => (
                            <PlayerCard key={player.id} player={player} />
                        ))}
                    </div>

                    <div className="flex justify-around">
                        {defs.slice(0, config.DEF).map(player => (
                            <PlayerCard key={player.id} player={player} />
                        ))}
                    </div>

                    <div className="flex justify-center">
                        {gks.slice(0, config.GK).map(player => (
                            <PlayerCard key={player.id} player={player} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="text-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBench(!showBench)}
                    className="gap-2"
                >
                    <Users className="h-4 w-4" />
                    {showBench ? "Hide" : "Show"} Bench ({bench.length} players)
                </Button>
            </div>

            {showBench && bench.length > 0 && (
                <div className="bg-secondary/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-3">Substitutes</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                        {bench.map(player => (
                            <PlayerCard key={player.id} player={player} />
                        ))}
                    </div>
                </div>
            )}

            <div className="text-xs text-muted-foreground text-center">
                Starting XI: {startingXI.length} players | Bench: {bench.length} players
            </div>
        </div>
    );
}
