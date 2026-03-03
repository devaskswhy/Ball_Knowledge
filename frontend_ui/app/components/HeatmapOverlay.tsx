"use client";

import React from "react";
import { motion } from "framer-motion";

interface HeatmapOverlayProps {
    /** 96-value array (12 cols × 8 rows), each 0–1 */
    data: number[];
    cols?: number;
    rows?: number;
    /** SVG pitch internal dimensions — must match FootballPitch viewBox */
    pitchWidth?: number;
    pitchHeight?: number;
}

/**
 * Renders a colored grid overlay inside a <FootballPitch> SVG.
 * Pass this as a child of FootballPitch.
 */
export default function HeatmapOverlay({
    data,
    cols = 12,
    rows = 8,
    pitchWidth = 680,
    pitchHeight = 440,
}: HeatmapOverlayProps) {
    const padX = 20;
    const padY = 20;
    const innerW = pitchWidth - padX * 2;
    const innerH = pitchHeight - padY * 2;
    const cellW = innerW / cols;
    const cellH = innerH / rows;

    /** Map a 0–1 value to a color on the cold→warm→hot gradient */
    function heatColor(val: number): string {
        const v = Math.max(0, Math.min(1, val));
        if (v < 0.5) {
            // cold (#1A237E) → warm (#FF6F00)
            const t = v / 0.5;
            const r = Math.round(26 + (255 - 26) * t);
            const g = Math.round(35 + (111 - 35) * t);
            const b = Math.round(126 + (0 - 126) * t);
            return `rgb(${r},${g},${b})`;
        } else {
            // warm (#FF6F00) → hot (#D50000)
            const t = (v - 0.5) / 0.5;
            const r = Math.round(255 + (213 - 255) * t);
            const g = Math.round(111 + (0 - 111) * t);
            const b = 0;
            return `rgb(${r},${g},${b})`;
        }
    }

    return (
        <g>
            {/* Gradient definition for legend outside SVG */}
            <defs>
                <linearGradient id="heatmapGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1A237E" />
                    <stop offset="50%" stopColor="#FF6F00" />
                    <stop offset="100%" stopColor="#D50000" />
                </linearGradient>
            </defs>

            {data.map((val, idx) => {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const x = padX + col * cellW;
                const y = padY + row * cellH;

                return (
                    <motion.rect
                        key={idx}
                        x={x}
                        y={y}
                        width={cellW}
                        height={cellH}
                        rx={2}
                        fill={heatColor(val)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: val * 0.75 + 0.05 }}
                        transition={{ delay: idx * 0.008, duration: 0.4 }}
                    />
                );
            })}
        </g>
    );
}

/**
 * Standalone legend component rendered BELOW the pitch (outside the SVG).
 */
export function HeatmapLegend() {
    return (
        <div className="flex items-center gap-3 mt-3 justify-center">
            <span className="text-[11px] font-medium text-muted-foreground">Low</span>
            <div
                className="h-3 w-40 rounded-full"
                style={{
                    background: "linear-gradient(to right, #1A237E, #FF6F00, #D50000)",
                }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">High</span>
        </div>
    );
}
