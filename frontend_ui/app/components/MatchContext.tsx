"use client";

import { Clock, Battery, BatteryCharging, BatteryWarning } from "lucide-react";

interface MatchContextProps {
    home: string;
    away: string;
    homeRest: number;
    awayRest: number;
    setHomeRest: (val: number) => void;
    setAwayRest: (val: number) => void;
}

export default function MatchContext({
    home,
    away,
    homeRest,
    awayRest,
    setHomeRest,
    setAwayRest,
}: MatchContextProps) {

    const getFatigueLevel = (days: number) => {
        if (days < 3)
            return { label: "High Fatigue", color: "text-red-400", icon: <BatteryWarning size={16} /> };
        if (days === 3)
            return { label: "Medium Fatigue", color: "text-yellow-400", icon: <Battery size={16} /> };
        if (days > 7)
            return { label: "Fresh", color: "text-[#39FF14]", icon: <BatteryCharging size={16} /> };
        return { label: "Normal", color: "text-gray-400", icon: <Battery size={16} /> };
    };

    const renderTeamContext = (
        team: string,
        rest: number,
        setRest: (v: number) => void
    ) => {
        const fatigue = getFatigueLevel(rest);
        return (
            <div className="bg-[#0D1324] p-3 rounded-lg border border-[#1F2A44] mb-3">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-200 text-sm">{team}</span>
                    <span className={`text-xs flex items-center gap-1 ${fatigue.color}`}>
                        {fatigue.icon} {fatigue.label}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Clock size={16} className="text-gray-400" />
                    <input
                        type="range"
                        min="1"
                        max="14"
                        value={rest}
                        onChange={(e) => setRest(Number(e.target.value))}
                        className="w-full accent-blue-400"
                    />
                    <span className="text-xs font-bold w-12 text-right text-blue-300">
                        {rest} Days
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#111829] p-4 rounded-xl border border-[#1F2A44] mb-4">
            <h3 className="text-lg font-bold text-gray-200 mb-3 flex items-center gap-2">
                <Clock size={18} className="text-blue-400" /> Match Context
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Adjust days since last match to simulate fatigue.
            </p>

            {renderTeamContext(home, homeRest, setHomeRest)}
            {renderTeamContext(away, awayRest, setAwayRest)}
        </div>
    );
}
