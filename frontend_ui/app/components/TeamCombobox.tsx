"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Team {
    name: string;
    id: number | null;
}

interface TeamComboboxProps {
    label: string;
    teams: Team[];
    selectedTeam: string;
    setSelectedTeam: (team: string) => void;
    disabled?: boolean;
}

export default function TeamCombobox({
    label,
    teams,
    selectedTeam,
    setSelectedTeam,
    disabled,
}: TeamComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter teams
    const filteredTeams =
        query === ""
            ? teams
            : teams.filter((team) =>
                team.name.toLowerCase().includes(query.toLowerCase())
            );

    const selectedTeamObj = teams.find((t) => t.name === selectedTeam);

    const getLogoUrl = (id: number | null) => {
        if (!id) return null;
        return `https://media.api-sports.io/football/teams/${id}.png`;
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                {label}
            </label>

            {/* TRIGGER BUTTON */}
            <button
                suppressHydrationWarning
                onClick={() => !disabled && setOpen(!open)}
                className={`w-full flex items-center justify-between bg-[#111829] border ${open ? "border-blue-500 ring-1 ring-blue-500" : "border-[#1F2A44]"
                    } rounded-xl px-4 py-3 text-left transition-all hover:bg-[#1A233A] ${disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
            >
                <span className="flex items-center gap-3 truncate">
                    {selectedTeamObj && selectedTeamObj.id ? (
                        <img
                            src={getLogoUrl(selectedTeamObj.id)!}
                            alt={selectedTeamObj.name}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement?.insertAdjacentHTML("beforeend", '<span class="text-xs">⚽</span>');
                            }}
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 font-bold">
                            ?
                        </div>
                    )}
                    <span className={`font-semibold ${selectedTeam ? "text-white" : "text-gray-500"}`}>
                        {selectedTeam || "Select Team..."}
                    </span>
                </span>
                <ChevronsUpDown size={16} className="text-gray-500" />
            </button>

            {/* DROPDOWN */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-[#0D1324] border border-[#1F2A44] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden"
                    >
                        {/* SEARCH INPUT */}
                        <div className="flex items-center px-3 py-2 border-b border-[#1F2A44]">
                            <Search size={16} className="text-gray-500 mr-2" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Type to search..."
                                className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                            />
                        </div>

                        {/* LIST */}
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {filteredTeams.length === 0 ? (
                                <div className="p-3 text-sm text-gray-500 text-center">
                                    No team found.
                                </div>
                            ) : (
                                filteredTeams.map((team) => (
                                    <button
                                        key={team.name}
                                        onClick={() => {
                                            setSelectedTeam(team.name);
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${selectedTeam === team.name
                                            ? "bg-blue-600/20 text-blue-400"
                                            : "text-gray-300 hover:bg-[#1A233A]"
                                            }`}
                                    >
                                        {/* Badge */}
                                        {team.id ? (
                                            <img
                                                src={getLogoUrl(team.id)!}
                                                loading="lazy"
                                                className="w-5 h-5 object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-gray-700" />
                                        )}

                                        <span className="flex-1 text-left truncate">{team.name}</span>
                                        {selectedTeam === team.name && <Check size={14} />}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
