"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart3, Flame } from "lucide-react";
import Image from "next/image";
import axios from "axios";
import FootballPitch from "./FootballPitch";
import HeatmapOverlay, { HeatmapLegend } from "./HeatmapOverlay";
import PredictionBar from "./PredictionBar";
import StatsComparisonBar from "./StatsComparisonBar";
import { generateTeamHeatmap, generateMatchStats } from "../lib/mockData";

interface Fixture {
    id: number;
    date: string;
    status: string;
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
    league: { name: string; logo: string };
    score: { home: number | null; away: number | null };
}

interface MatchAnalyticsPanelProps {
    fixture: Fixture | null;
    onClose: () => void;
}

/**
 * Full-screen slide-over panel showing match prediction, dual team heatmaps,
 * and key stats comparison when a Today's Match card is clicked.
 */
export default function MatchAnalyticsPanel({
    fixture,
    onClose,
}: MatchAnalyticsPanelProps) {
    const [prediction, setPrediction] = useState<{
        home_win: number;
        draw: number;
        away_win: number;
    } | null>(null);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [predictionError, setPredictionError] = useState<string | null>(null);

    // Fetch prediction when fixture changes
    useEffect(() => {
        if (!fixture) return;
        setPredictionLoading(true);
        setPredictionError(null);

        axios
            .post("http://localhost:8000/predict", {
                home: fixture.home.name,
                away: fixture.away.name,
                league: "PL",
            })
            .then((res) => {
                setPrediction({
                    home_win: res.data.home_win,
                    draw: res.data.draw,
                    away_win: res.data.away_win,
                });
            })
            .catch(() => {
                // Use mock prediction if API fails
                setPrediction({ home_win: 42.5, draw: 27.0, away_win: 30.5 });
                setPredictionError("Using estimated prediction (API unavailable)");
            })
            .finally(() => setPredictionLoading(false));
    }, [fixture]);

    // Generate mock data
    const homeHeatmap = fixture ? generateTeamHeatmap(fixture.home.name) : [];
    const awayHeatmap = fixture ? generateTeamHeatmap(fixture.away.name) : [];
    const matchStats = fixture
        ? generateMatchStats(fixture.home.name, fixture.away.name)
        : null;

    const matchTime = fixture
        ? new Date(fixture.date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })
        : "";

    return (
        <AnimatePresence>
            {fixture && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        className="fixed top-0 right-0 h-full w-[80vw] max-w-[900px] z-50 bg-card border-l border-border overflow-y-auto"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        style={{
                            scrollbarWidth: "thin",
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6 md:p-8 space-y-8">
                            {/* ── Header ── */}
                            <div className="text-center pt-2">
                                {/* League */}
                                <div className="flex items-center justify-center gap-2 mb-4">
                                    {fixture.league.logo && (
                                        <Image
                                            src={fixture.league.logo}
                                            alt=""
                                            width={20}
                                            height={20}
                                            className="object-contain"
                                        />
                                    )}
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {fixture.league.name} · {matchTime}
                                    </span>
                                </div>

                                {/* Teams */}
                                <div className="flex items-center justify-center gap-6 md:gap-10">
                                    {/* Home */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 md:w-20 md:h-20 relative">
                                            {fixture.home.logo && (
                                                <Image
                                                    src={fixture.home.logo}
                                                    alt={fixture.home.name}
                                                    fill
                                                    className="object-contain drop-shadow-lg"
                                                />
                                            )}
                                        </div>
                                        <span className="text-sm md:text-base font-bold">
                                            {fixture.home.name}
                                        </span>
                                    </div>

                                    <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#CCFF00]">
                                        VS
                                    </span>

                                    {/* Away */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 md:w-20 md:h-20 relative">
                                            {fixture.away.logo && (
                                                <Image
                                                    src={fixture.away.logo}
                                                    alt={fixture.away.name}
                                                    fill
                                                    className="object-contain drop-shadow-lg"
                                                />
                                            )}
                                        </div>
                                        <span className="text-sm md:text-base font-bold">
                                            {fixture.away.name}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Prediction Bar ── */}
                            <div className="bg-secondary/50 rounded-xl p-5 border border-border">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-4 h-4 text-primary" />
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                        Match Prediction
                                    </h3>
                                </div>
                                {predictionLoading ? (
                                    <div className="flex justify-center py-4">
                                        <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : prediction ? (
                                    <>
                                        <PredictionBar
                                            homeWin={prediction.home_win}
                                            draw={prediction.draw}
                                            awayWin={prediction.away_win}
                                            homeName={fixture.home.name}
                                            awayName={fixture.away.name}
                                        />
                                        {predictionError && (
                                            <p className="text-[10px] text-muted-foreground mt-2 text-center italic">
                                                {predictionError}
                                            </p>
                                        )}
                                    </>
                                ) : null}
                            </div>

                            {/* ── Team Heatmaps ── */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Flame className="w-4 h-4 text-orange-500" />
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                        Team Heatmaps
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Home heatmap */}
                                    <div className="bg-secondary/30 rounded-xl p-3 border border-border">
                                        <p className="text-xs font-bold text-center mb-2 text-emerald-400">
                                            {fixture.home.name}
                                        </p>
                                        <FootballPitch>
                                            <HeatmapOverlay data={homeHeatmap} />
                                        </FootballPitch>
                                        <HeatmapLegend />
                                    </div>
                                    {/* Away heatmap */}
                                    <div className="bg-secondary/30 rounded-xl p-3 border border-border">
                                        <p className="text-xs font-bold text-center mb-2 text-[#CCFF00]">
                                            {fixture.away.name}
                                        </p>
                                        <FootballPitch>
                                            <HeatmapOverlay data={awayHeatmap} />
                                        </FootballPitch>
                                        <HeatmapLegend />
                                    </div>
                                </div>
                            </div>

                            {/* ── Stats Comparison ── */}
                            {matchStats && (
                                <div className="bg-secondary/50 rounded-xl p-5 border border-border">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BarChart3 className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Key Stats
                                        </h3>
                                    </div>
                                    <StatsComparisonBar
                                        stats={matchStats}
                                        homeName={fixture.home.name}
                                        awayName={fixture.away.name}
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
