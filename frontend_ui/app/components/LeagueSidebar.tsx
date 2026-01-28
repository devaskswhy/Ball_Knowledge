"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface LeagueSidebarProps {
    currentLeague: string;
    setLeague: (league: string) => void;
}

export default function LeagueSidebar({ currentLeague, setLeague }: LeagueSidebarProps) {
    const leagues = [
        { code: "PL", name: "Premier League", logo: "/leagues/pl.png" },
        { code: "LL", name: "La Liga", logo: "/leagues/laliga.png" },
        { code: "SA", name: "Serie A", logo: "/leagues/seriea.jpg" },
        { code: "L1", name: "Ligue 1", logo: "/leagues/ligue1.png" },
        { code: "WC", name: "World Cup", logo: "/leagues/worldcup.jpg" },
    ];

    return (
        <div className="fixed left-0 top-0 h-screen w-20 bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-8 gap-2 z-50">
            {/* Logo */}
            <div className="mb-8">
                <Image
                    src="/logo.jpg"
                    alt="Ball Knowledge"
                    width={64}
                    height={64}
                    className="rounded-full object-cover border-2 border-purple-500/50 shadow-lg"
                />
            </div>

            {/* League Icons */}
            {leagues.map((lg) => {
                const isActive = currentLeague === lg.code;
                return (
                    <motion.button
                        key={lg.code}
                        onClick={() => setLeague(lg.code)}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                        className={`
              relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group
              ${isActive
                                ? "bg-purple-600/30 ring-2 ring-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                                : "bg-white/5 hover:bg-white/10"
                            }
            `}
                        title={lg.name}
                    >
                        <Image
                            src={lg.logo}
                            alt={lg.name}
                            width={36}
                            height={36}
                            className={`object-contain rounded transition-all ${isActive ? "brightness-110" : "brightness-75 group-hover:brightness-100"}`}
                        />

                        {/* Active Indicator */}
                        {isActive && (
                            <motion.div
                                layoutId="activeIndicator"
                                className="absolute -right-[2px] w-1 h-8 bg-purple-400 rounded-l-full"
                            />
                        )}

                        {/* Tooltip */}
                        <div className="absolute left-full ml-3 px-3 py-1 bg-black/90 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                            {lg.name}
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );
}
