"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Shot } from "../lib/mockData";

interface ShotMapOverlayProps {
    shots: Shot[];
}

const RESULT_COLORS: Record<Shot["result"], string> = {
    goal: "#00E676",
    saved: "#FFC107",
    missed: "#9E9E9E",
    blocked: "#FF5252",
};

const RESULT_LABELS: Record<Shot["result"], string> = {
    goal: "Goal",
    saved: "Saved",
    missed: "Missed",
    blocked: "Blocked",
};

/**
 * Plots xG-style shot circles inside a FootballPitch SVG.
 * Meant to be used inside FootballPitch with half="right"
 * but coordinates are in full-pitch space (shots have x ~ 500-670).
 */
export default function ShotMapOverlay({ shots }: ShotMapOverlayProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    return (
        <g>
            {shots.map((shot, idx) => {
                const radius = Math.max(6, Math.min(24, shot.xG * 40 + 4));
                const isHovered = hoveredIdx === idx;

                return (
                    <g key={idx}>
                        <motion.circle
                            cx={shot.x}
                            cy={shot.y}
                            r={radius}
                            fill={RESULT_COLORS[shot.result]}
                            fillOpacity={0.85}
                            stroke={isHovered ? "#fff" : "rgba(255,255,255,0.3)"}
                            strokeWidth={isHovered ? 2.5 : 1}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                                scale: isHovered ? 1.3 : 1,
                                opacity: 1,
                            }}
                            transition={{
                                delay: idx * 0.03,
                                duration: 0.35,
                                type: "spring",
                                stiffness: 300,
                            }}
                            style={{ cursor: "pointer", transformOrigin: `${shot.x}px ${shot.y}px` }}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        />

                        {/* xG value label inside circle */}
                        {radius > 10 && (
                            <text
                                x={shot.x}
                                y={shot.y + 1}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#000"
                                fontSize={9}
                                fontWeight={600}
                                style={{ pointerEvents: "none" }}
                            >
                                {shot.xG.toFixed(2)}
                            </text>
                        )}

                        {/* Tooltip */}
                        <AnimatePresence>
                            {isHovered && (
                                <motion.g
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <rect
                                        x={shot.x - 60}
                                        y={shot.y - radius - 42}
                                        width={120}
                                        height={36}
                                        rx={6}
                                        fill="rgba(0,0,0,0.88)"
                                        stroke="rgba(255,255,255,0.2)"
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={shot.x}
                                        y={shot.y - radius - 29}
                                        textAnchor="middle"
                                        fill="#fff"
                                        fontSize={10}
                                        fontWeight={600}
                                    >
                                        {shot.player} ({shot.minute}&apos;)
                                    </text>
                                    <text
                                        x={shot.x}
                                        y={shot.y - radius - 15}
                                        textAnchor="middle"
                                        fill={RESULT_COLORS[shot.result]}
                                        fontSize={10}
                                        fontWeight={500}
                                    >
                                        xG: {shot.xG.toFixed(2)} · {RESULT_LABELS[shot.result]}
                                    </text>
                                </motion.g>
                            )}
                        </AnimatePresence>
                    </g>
                );
            })}
        </g>
    );
}

/**
 * Shot map legend rendered outside the SVG.
 */
export function ShotMapLegend({ shots }: { shots: Shot[] }) {
    const totalXg = shots.reduce((s, shot) => s + shot.xG, 0);
    const goals = shots.filter((s) => s.result === "goal").length;

    return (
        <div className="flex flex-wrap items-center gap-4 mt-3 justify-center">
            {(Object.entries(RESULT_COLORS) as [Shot["result"], string][]).map(
                ([result, color]) => (
                    <div key={result} className="flex items-center gap-1.5">
                        <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                        <span className="text-[11px] text-muted-foreground font-medium">
                            {RESULT_LABELS[result]} ({shots.filter((s) => s.result === result).length})
                        </span>
                    </div>
                )
            )}
            <div className="text-[11px] text-muted-foreground font-semibold ml-2 border-l border-border pl-3">
                Total xG: {totalXg.toFixed(2)} · Goals: {goals} · Conv: {shots.length > 0 ? ((goals / shots.length) * 100).toFixed(0) : 0}%
            </div>
        </div>
    );
}
