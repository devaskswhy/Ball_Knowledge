"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { PlayerNode, PassEdge } from "../lib/mockData";

interface PassingNetworkProps {
    nodes: PlayerNode[];
    edges: PassEdge[];
}

/**
 * Interactive passing network overlay rendered inside FootballPitch SVG.
 * Nodes = player positions, edges = pass connections with thickness.
 */
export default function PassingNetwork({ nodes, edges }: PassingNetworkProps) {
    const [hoveredNode, setHoveredNode] = useState<number | null>(null);

    const maxPassCount = useMemo(
        () => Math.max(...edges.map((e) => e.count), 1),
        [edges]
    );

    const getNode = (id: number) => nodes.find((n) => n.id === id);

    // Edge connected to hovered node
    const isEdgeConnected = (edge: PassEdge) =>
        hoveredNode !== null &&
        (edge.from === hoveredNode || edge.to === hoveredNode);

    return (
        <g>
            {/* ── Edges ── */}
            {edges.map((edge, idx) => {
                const fromNode = getNode(edge.from);
                const toNode = getNode(edge.to);
                if (!fromNode || !toNode) return null;

                const strokeW = (edge.count / maxPassCount) * 5 + 1;
                const connected = isEdgeConnected(edge);
                const opacity =
                    hoveredNode === null ? 0.55 : connected ? 0.9 : 0.1;

                return (
                    <motion.line
                        key={`edge-${idx}`}
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke="rgba(204,255,0,0.6)"
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity }}
                        transition={{ delay: idx * 0.015, duration: 0.5 }}
                    />
                );
            })}

            {/* ── Nodes ── */}
            {nodes.map((node, idx) => {
                const isHovered = hoveredNode === node.id;
                const connectedEdges = edges.filter(
                    (e) => e.from === node.id || e.to === node.id
                );
                const totalPasses = connectedEdges.reduce((s, e) => s + e.count, 0);

                return (
                    <g
                        key={`node-${node.id}`}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: "pointer" }}
                    >
                        {/* Glow behind node on hover */}
                        {isHovered && (
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={26}
                                fill="rgba(204,255,0,0.15)"
                            />
                        )}

                        {/* Node circle */}
                        <motion.circle
                            cx={node.x}
                            cy={node.y}
                            r={16}
                            fill="#FFFFFF"
                            stroke={isHovered ? "#CCFF00" : "rgba(204,255,0,0.5)"}
                            strokeWidth={isHovered ? 3 : 2}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                delay: idx * 0.04,
                                type: "spring",
                                stiffness: 400,
                            }}
                            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                        />

                        {/* Jersey number */}
                        <text
                            x={node.x}
                            y={node.y + 1}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#1A1A1A"
                            fontSize={11}
                            fontWeight={700}
                            style={{ pointerEvents: "none" }}
                        >
                            {node.number}
                        </text>

                        {/* Player name below */}
                        <text
                            x={node.x}
                            y={node.y + 28}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.85)"
                            fontSize={9}
                            fontWeight={600}
                            style={{ pointerEvents: "none" }}
                        >
                            {node.name.split(" ").pop()}
                        </text>

                        {/* Hover tooltip — total passes */}
                        {isHovered && (
                            <g>
                                <rect
                                    x={node.x - 40}
                                    y={node.y - 46}
                                    width={80}
                                    height={22}
                                    rx={5}
                                    fill="rgba(0,0,0,0.85)"
                                    stroke="rgba(204,255,0,0.4)"
                                    strokeWidth={1}
                                />
                                <text
                                    x={node.x}
                                    y={node.y - 32}
                                    textAnchor="middle"
                                    fill="#CCFF00"
                                    fontSize={10}
                                    fontWeight={600}
                                    style={{ pointerEvents: "none" }}
                                >
                                    {totalPasses} passes
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}
        </g>
    );
}

/**
 * Passing network stats rendered below the pitch (outside SVG).
 */
export function PassingNetworkStats({
    nodes,
    edges,
}: {
    nodes: PlayerNode[];
    edges: PassEdge[];
}) {
    const totalPasses = edges.reduce((s, e) => s + e.count, 0);
    const avgPerPlayer = nodes.length > 0 ? (totalPasses / nodes.length).toFixed(1) : "0";

    // Most connected pair
    const topEdge = edges.reduce(
        (best, e) => (e.count > best.count ? e : best),
        edges[0] || { from: 0, to: 0, count: 0 }
    );
    const fromName = nodes.find((n) => n.id === topEdge.from)?.name || "?";
    const toName = nodes.find((n) => n.id === topEdge.to)?.name || "?";

    return (
        <div className="flex flex-wrap items-center gap-4 mt-3 justify-center text-[11px] text-muted-foreground font-medium">
            <span>
                Total Passes: <strong className="text-foreground">{totalPasses}</strong>
            </span>
            <span className="border-l border-border pl-3">
                Avg/Player: <strong className="text-foreground">{avgPerPlayer}</strong>
            </span>
            <span className="border-l border-border pl-3">
                Top Pair:{" "}
                <strong className="text-[#CCFF00]">
                    {fromName.split(" ").pop()} ↔ {toName.split(" ").pop()} ({topEdge.count})
                </strong>
            </span>
        </div>
    );
}
