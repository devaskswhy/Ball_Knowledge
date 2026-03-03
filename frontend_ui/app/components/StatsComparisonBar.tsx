"use client";

import React from "react";
import { motion } from "framer-motion";
import type { MatchStats } from "../lib/mockData";

interface StatsComparisonBarProps {
    stats: MatchStats;
    homeName?: string;
    awayName?: string;
}

const STAT_LABELS: { key: keyof MatchStats; label: string }[] = [
    { key: "possession", label: "Possession" },
    { key: "shots", label: "Shots" },
    { key: "shotsOnTarget", label: "On Target" },
    { key: "passes", label: "Passes" },
    { key: "corners", label: "Corners" },
    { key: "fouls", label: "Fouls" },
];

/**
 * Face-to-face horizontal stat comparison bars.
 * Home grows left, Away grows right from center.
 */
export default function StatsComparisonBar({
    stats,
    homeName = "Home",
    awayName = "Away",
}: StatsComparisonBarProps) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex justify-between text-xs font-bold text-muted-foreground px-1">
                <span className="text-emerald-400">{homeName}</span>
                <span className="text-[#CCFF00]">{awayName}</span>
            </div>

            {STAT_LABELS.map(({ key, label }, idx) => {
                const [homeVal, awayVal] = stats[key];
                const total = homeVal + awayVal || 1;
                const homePct = (homeVal / total) * 100;
                const awayPct = (awayVal / total) * 100;

                return (
                    <div key={key} className="space-y-1">
                        <div className="flex justify-between items-center text-[11px] px-1">
                            <span className="font-semibold text-foreground w-8 text-left">
                                {homeVal}
                            </span>
                            <span className="text-muted-foreground font-medium flex-1 text-center">
                                {label}
                            </span>
                            <span className="font-semibold text-foreground w-8 text-right">
                                {awayVal}
                            </span>
                        </div>
                        <div className="flex gap-1 h-2">
                            {/* Home bar (right-aligned, grows left) */}
                            <div className="flex-1 flex justify-end rounded-l-full overflow-hidden bg-secondary">
                                <motion.div
                                    className="h-full rounded-l-full"
                                    style={{ backgroundColor: "#10B981" }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${homePct}%` }}
                                    transition={{ duration: 0.5, delay: idx * 0.06 }}
                                />
                            </div>
                            {/* Away bar (left-aligned, grows right) */}
                            <div className="flex-1 rounded-r-full overflow-hidden bg-secondary">
                                <motion.div
                                    className="h-full rounded-r-full"
                                    style={{ backgroundColor: "#CCFF00" }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${awayPct}%` }}
                                    transition={{ duration: 0.5, delay: idx * 0.06 }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
