import { useState } from "react";
import { Trophy, Globe, Crown, Medal, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LeagueSelectorProps {
    currentLeague: string;
    setLeague: (league: string) => void;
}

export default function LeagueSelector({ currentLeague, setLeague }: LeagueSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const leagues = [
        { code: "PL", name: "Premier League", icon: <Crown size={16} />, color: "text-purple-400" },
        { code: "LL", name: "La Liga", icon: <Medal size={16} />, color: "text-orange-400" },
        { code: "SA", name: "Serie A", icon: <Trophy size={16} />, color: "text-blue-400" },
        { code: "L1", name: "Ligue 1", icon: <Trophy size={16} />, color: "text-yellow-400" },
        { code: "WC", name: "World Cup 2026", icon: <Globe size={16} />, color: "text-yellow-500" },
    ];

    const activeLeague = leagues.find(l => l.code === currentLeague) || leagues[0];

    return (
        <div className="relative z-50 mb-8 flex justify-center">
            <div className="relative">
                {/* Main Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 bg-[#111829]/80 backdrop-blur-md border border-purple-500/30 px-6 py-3 rounded-xl text-white font-bold tracking-wide hover:bg-[#1A233A] hover:border-purple-400 transition shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                >
                    <span className={activeLeague.color}>{activeLeague.icon}</span>
                    {activeLeague.name}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-[#0D1324]/95 backdrop-blur-xl border border-[#1F2A44] rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-1">
                                {leagues.map((lg) => (
                                    <button
                                        key={lg.code}
                                        onClick={() => {
                                            setLeague(lg.code);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentLeague === lg.code
                                                ? "bg-purple-600/20 text-white"
                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                            }`}
                                    >
                                        <span className={lg.color}>{lg.icon}</span>
                                        <span className="flex-1 text-left">{lg.name}</span>
                                        {currentLeague === lg.code && <Check size={14} className="text-purple-400" />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
