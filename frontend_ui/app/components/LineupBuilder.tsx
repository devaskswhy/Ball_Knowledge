"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { apiUrl } from "@/app/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Users, Loader2, ChevronDown, RotateCcw } from "lucide-react";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    closestCenter,
    useSensor,
    useSensors,
    PointerSensor,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FORMATIONS } from "@/app/lib/formations";

interface Player {
    id: number;
    name: string;
    age: number;
    number: number;
    position: string;
    photo: string;
    rating: number;
}

interface LineupBuilderProps {
    team: string;
    isOpen: boolean;
    onClose: () => void;
}

// Draggable Player Card
function DraggablePlayer({ player, isOnPitch }: { player: Player; isOnPitch?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: player.id.toString(),
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 85) return "bg-gradient-to-br from-yellow-400 to-yellow-600";
        if (rating >= 80) return "bg-gradient-to-br from-green-400 to-green-600";
        if (rating >= 75) return "bg-gradient-to-br from-blue-400 to-blue-600";
        return "bg-gradient-to-br from-gray-400 to-gray-600";
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`flex flex-col items-center cursor-grab active:cursor-grabbing transition-transform hover:scale-105 ${isOnPitch ? "" : "opacity-80 hover:opacity-100"}`}
        >
            <div className="relative">
                <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${isOnPitch ? "border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "border-white/30"} shadow-lg bg-gray-800`}>
                    <Image src={player.photo} alt={player.name} width={56} height={56} className="object-cover" />
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${getRatingColor(player.rating)} flex items-center justify-center text-[10px] font-black text-white shadow border border-white/20`}>
                    {player.rating}
                </div>
                <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-black/80 flex items-center justify-center text-[10px] font-bold text-white border border-white/20">
                    {player.number}
                </div>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-white text-center truncate max-w-[70px]">
                {player.name.split(" ").pop()}
            </p>
        </div>
    );
}

export default function LineupBuilder({ team, isOpen, onClose }: LineupBuilderProps) {
    const [squad, setSquad] = useState<Player[]>([]);
    const [startingXI, setStartingXI] = useState<Player[]>([]); // Ordered array of 11 players
    const [bench, setBench] = useState<Player[]>([]);
    const [formation, setFormation] = useState("4-3-3");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activePlayer, setActivePlayer] = useState<Player | null>(null);
    const [showFormationPicker, setShowFormationPicker] = useState(false);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    useEffect(() => {
        if (isOpen && team) fetchSquad();
    }, [isOpen, team]);

    const fetchSquad = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await axios.get(`${apiUrl()}/squad`, { params: { team } });
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
        const totalSlots = config.GK + config.DEF + config.MID + config.ATT; // Always 11

        let xi: Player[] = [];

        // If we have real lineup IDs, use them
        if (lineupIds.length >= 11) {
            xi = lineupIds.slice(0, 11).map(id => squadData.find(p => p.id === id)).filter(Boolean) as Player[];
        }

        // Fill remaining slots by position if needed
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

    const handleFormationChange = (newFormation: string) => {
        setFormation(newFormation);
        setShowFormationPicker(false);
        
        const config = FORMATIONS[newFormation];
        const allPlayers = [...startingXI, ...bench];
        
        // Separate players by position
        const gks = allPlayers.filter(p => p.position === "GK");
        const defs = allPlayers.filter(p => p.position === "DEF");
        const mids = allPlayers.filter(p => p.position === "MID");
        const atts = allPlayers.filter(p => p.position === "ATT");
        
        // Build new XI based on formation requirements
        const newXI: Player[] = [];
        
        // Add goalkeepers
        for (let i = 0; i < config.GK && i < gks.length; i++) {
            newXI.push(gks[i]);
        }
        
        // Add defenders
        for (let i = 0; i < config.DEF && i < defs.length; i++) {
            newXI.push(defs[i]);
        }
        
        // Add midfielders
        for (let i = 0; i < config.MID && i < mids.length; i++) {
            newXI.push(mids[i]);
        }
        
        // Add attackers
        for (let i = 0; i < config.ATT && i < atts.length; i++) {
            newXI.push(atts[i]);
        }
        
        // If we don't have enough players, fill with any available players
        if (newXI.length < 11) {
            const usedIds = new Set(newXI.map(p => p.id));
            const remaining = allPlayers.filter(p => !usedIds.has(p.id));
            for (let i = 0; i < remaining.length && newXI.length < 11; i++) {
                newXI.push(remaining[i]);
            }
        }
        
        // Update bench with players not in new XI
        const newBench = allPlayers.filter(p => !newXI.includes(p));
        
        setStartingXI(newXI);
        setBench(newBench);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const allPlayers = [...startingXI, ...bench];
        const player = allPlayers.find(p => p.id.toString() === event.active.id);
        setActivePlayer(player || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActivePlayer(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        // Find players in both lists
        const allPlayers = [...startingXI, ...bench];
        const draggedPlayer = allPlayers.find(p => p.id.toString() === activeId);
        const targetPlayer = allPlayers.find(p => p.id.toString() === overId);

        if (!draggedPlayer || !targetPlayer) return;

        const draggedInXI = startingXI.findIndex(p => p.id.toString() === activeId);
        const targetInXI = startingXI.findIndex(p => p.id.toString() === overId);
        const draggedInBench = bench.findIndex(p => p.id.toString() === activeId);
        const targetInBench = bench.findIndex(p => p.id.toString() === overId);

        // SWAP - regardless of position!
        const newXI = [...startingXI];
        const newBench = [...bench];

        if (draggedInXI !== -1 && targetInXI !== -1) {
            // Both in XI - swap positions
            [newXI[draggedInXI], newXI[targetInXI]] = [newXI[targetInXI], newXI[draggedInXI]];
        } else if (draggedInBench !== -1 && targetInXI !== -1) {
            // Dragged from bench to XI - swap
            newXI[targetInXI] = draggedPlayer;
            newBench[draggedInBench] = targetPlayer;
        } else if (draggedInXI !== -1 && targetInBench !== -1) {
            // Dragged from XI to bench - swap
            newBench[targetInBench] = draggedPlayer;
            newXI[draggedInXI] = targetPlayer;
        } else if (draggedInBench !== -1 && targetInBench !== -1) {
            // Both in bench - swap
            [newBench[draggedInBench], newBench[targetInBench]] = [newBench[targetInBench], newBench[draggedInBench]];
        }

        setStartingXI(newXI);
        setBench(newBench);
    };

    const resetLineup = () => {
        fetchSquad(); // Re-fetch to get original lineup
    };

    // Display XI grouped by ACTUAL PLAYER POSITION (GK at bottom, ATT at top)
    const displayXI = startingXI.slice(0, 11);
    const rowATT = displayXI.filter(p => p.position === "ATT");
    const rowMID = displayXI.filter(p => p.position === "MID");
    const rowDEF = displayXI.filter(p => p.position === "DEF");
    const rowGK = displayXI.filter(p => p.position === "GK");

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-5xl max-h-[95vh] overflow-hidden rounded-3xl shadow-2xl bg-[#0a1628]">
                        {/* Header - HIGHER Z-INDEX */}
                        <div className="relative z-50 flex justify-between items-center p-4 border-b border-white/10 bg-[#0a1628]">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-black text-white flex items-center gap-2">
                                    <Users className="text-cyan-400" /> {team} Lineup
                                </h2>
                                {/* Formation Picker */}
                                <div className="relative">
                                    <button onClick={() => setShowFormationPicker(!showFormationPicker)} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm font-bold text-white hover:bg-white/20 transition">
                                        {formation} <ChevronDown size={14} className={`transition-transform ${showFormationPicker ? "rotate-180" : ""}`} />
                                    </button>
                                    {showFormationPicker && (
                                        <div className="absolute top-full mt-1 left-0 bg-[#1a2744] rounded-lg shadow-2xl z-[200] overflow-hidden min-w-[100px]">
                                            {Object.keys(FORMATIONS).map(f => (
                                                <button key={f} onClick={() => handleFormationChange(f)} className={`block w-full px-4 py-2.5 text-sm text-left hover:bg-white/10 transition ${f === formation ? "text-cyan-400 font-bold bg-white/5" : "text-white"}`}>
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button onClick={resetLineup} className="p-2 text-gray-400 hover:text-white transition" title="Reset Lineup">
                                    <RotateCcw size={16} />
                                </button>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="flex h-[70vh]">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                                </div>
                            ) : error ? (
                                <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                                    {/* Pitch */}
                                    <div className="flex-1 relative" style={{ background: "linear-gradient(180deg, #1a472a 0%, #2d5a3f 50%, #1a472a 100%)" }}>
                                        {/* Field Lines */}
                                        <div className="absolute inset-4 border-2 border-white/20 rounded-lg pointer-events-none">
                                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/20" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/20 rounded-full" />
                                        </div>

                                        {/* Players on Pitch - grouped by ACTUAL position */}
                                        <div className="relative z-10 h-full flex flex-col justify-between py-8 px-4">
                                            <div className="flex justify-center gap-6">{rowATT.map((p: Player) => <DraggablePlayer key={p.id} player={p} isOnPitch />)}</div>
                                            <div className="flex justify-center gap-6">{rowMID.map((p: Player) => <DraggablePlayer key={p.id} player={p} isOnPitch />)}</div>
                                            <div className="flex justify-center gap-4">{rowDEF.map((p: Player) => <DraggablePlayer key={p.id} player={p} isOnPitch />)}</div>
                                            <div className="flex justify-center">{rowGK.map((p: Player) => <DraggablePlayer key={p.id} player={p} isOnPitch />)}</div>
                                        </div>
                                    </div>

                                    {/* Bench Panel */}
                                    <div className="w-48 bg-[#0d1a2d] border-l border-white/10 p-3 overflow-y-auto">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Bench / Reserves</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {bench.map(p => <DraggablePlayer key={p.id} player={p} />)}
                                        </div>
                                    </div>

                                    <DragOverlay>
                                        {activePlayer && (
                                            <div className="flex flex-col items-center opacity-95 scale-110">
                                                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]">
                                                    <Image src={activePlayer.photo} alt={activePlayer.name} width={56} height={56} className="object-cover" />
                                                </div>
                                                <p className="mt-1 text-[10px] font-bold text-white">{activePlayer.name.split(" ").pop()}</p>
                                            </div>
                                        )}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
