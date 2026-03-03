"use client";

import React from "react";

interface FootballPitchProps {
    half?: "left" | "right" | "full";
    children?: React.ReactNode;
    className?: string;
    width?: number;
    height?: number;
}

/**
 * Reusable SVG football pitch with full markings.
 * viewBox is always 680×440 internally; rendering scales via CSS.
 * `half` controls which half is displayed (for shot maps, etc.).
 */
export default function FootballPitch({
    half = "full",
    children,
    className = "",
    width,
    height,
}: FootballPitchProps) {
    // Internal dimensions
    const W = 680;
    const H = 440;
    const lineColor = "rgba(255,255,255,0.7)";
    const lineWidth = 1.5;

    // For "right" half (attacking half), we shift viewBox
    const viewBox =
        half === "right"
            ? `${W / 2} 0 ${W / 2} ${H}`
            : half === "left"
                ? `0 0 ${W / 2} ${H}`
                : `0 0 ${W} ${H}`;

    return (
        <div className={`relative w-full ${className}`}>
            <svg
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-auto"
                style={{
                    width: width || "100%",
                    height: height || "auto",
                    maxHeight: "520px",
                }}
            >
                {/* Pitch background */}
                <rect x={0} y={0} width={W} height={H} fill="#1B5E20" rx={4} />

                {/* Subtle grass stripes */}
                {Array.from({ length: 12 }).map((_, i) => (
                    <rect
                        key={i}
                        x={(W / 12) * i}
                        y={0}
                        width={W / 12}
                        height={H}
                        fill={i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}
                    />
                ))}

                {/* ── Outer boundary ── */}
                <rect
                    x={20}
                    y={20}
                    width={W - 40}
                    height={H - 40}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />

                {/* ── Center line ── */}
                <line
                    x1={W / 2}
                    y1={20}
                    x2={W / 2}
                    y2={H - 20}
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />

                {/* ── Center circle ── */}
                <circle
                    cx={W / 2}
                    cy={H / 2}
                    r={55}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />
                <circle cx={W / 2} cy={H / 2} r={3} fill={lineColor} />

                {/* ── LEFT penalty box ── */}
                <rect
                    x={20}
                    y={H / 2 - 100}
                    width={100}
                    height={200}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />
                {/* Left goal box */}
                <rect
                    x={20}
                    y={H / 2 - 45}
                    width={40}
                    height={90}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />
                {/* Left penalty spot */}
                <circle cx={80} cy={H / 2} r={2.5} fill={lineColor} />
                {/* Left penalty arc */}
                <path
                    d={`M 120 ${H / 2 - 50} A 55 55 0 0 1 120 ${H / 2 + 50}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />

                {/* ── RIGHT penalty box ── */}
                <rect
                    x={W - 120}
                    y={H / 2 - 100}
                    width={100}
                    height={200}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />
                {/* Right goal box */}
                <rect
                    x={W - 60}
                    y={H / 2 - 45}
                    width={40}
                    height={90}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />
                {/* Right penalty spot */}
                <circle cx={W - 80} cy={H / 2} r={2.5} fill={lineColor} />
                {/* Right penalty arc */}
                <path
                    d={`M ${W - 120} ${H / 2 - 50} A 55 55 0 0 0 ${W - 120} ${H / 2 + 50}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                />

                {/* ── Corner arcs ── */}
                <path d="M 20 28 A 8 8 0 0 1 28 20" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
                <path d={`M ${W - 28} 20 A 8 8 0 0 1 ${W - 20} 28`} fill="none" stroke={lineColor} strokeWidth={lineWidth} />
                <path d={`M 28 ${H - 20} A 8 8 0 0 1 20 ${H - 28}`} fill="none" stroke={lineColor} strokeWidth={lineWidth} />
                <path d={`M ${W - 20} ${H - 28} A 8 8 0 0 1 ${W - 28} ${H - 20}`} fill="none" stroke={lineColor} strokeWidth={lineWidth} />

                {/* ── Goal nets (subtle) ── */}
                <rect x={8} y={H / 2 - 30} width={12} height={60} fill="rgba(255,255,255,0.1)" stroke={lineColor} strokeWidth={0.8} />
                <rect x={W - 20} y={H / 2 - 30} width={12} height={60} fill="rgba(255,255,255,0.1)" stroke={lineColor} strokeWidth={0.8} />

                {/* ── Overlays (heatmap, shots, passing network) ── */}
                {children}
            </svg>
        </div>
    );
}
