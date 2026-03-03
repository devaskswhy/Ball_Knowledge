"use client";

import React from "react";
import { motion } from "framer-motion";

interface PredictionBarProps {
    homeWin: number;
    draw: number;
    awayWin: number;
    homeName?: string;
    awayName?: string;
}

/**
 * Three-segment horizontal stacked bar showing match prediction percentages.
 */
export default function PredictionBar({
    homeWin,
    draw,
    awayWin,
    homeName = "Home",
    awayName = "Away",
}: PredictionBarProps) {
    return (
        <div className="w-full">
            {/* Labels above */}
            <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400">{homeName}</span>
                <span className="text-xs font-semibold text-muted-foreground">Draw</span>
                <span className="text-xs font-bold text-[#CCFF00]">{awayName}</span>
            </div>

            {/* Bar */}
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden flex">
                <motion.div
                    className="h-full rounded-l-full"
                    style={{ backgroundColor: "#10B981" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${homeWin}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />
                <motion.div
                    className="h-full"
                    style={{ backgroundColor: "#6B7280" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${draw}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                />
                <motion.div
                    className="h-full rounded-r-full"
                    style={{ backgroundColor: "#CCFF00" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${awayWin}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                />
            </div>

            {/* Percentage labels below */}
            <div className="flex justify-between mt-1.5">
                <span className="text-sm font-bold text-emerald-400">{homeWin}%</span>
                <span className="text-sm font-semibold text-muted-foreground">{draw}%</span>
                <span className="text-sm font-bold text-[#CCFF00]">{awayWin}%</span>
            </div>
        </div>
    );
}
