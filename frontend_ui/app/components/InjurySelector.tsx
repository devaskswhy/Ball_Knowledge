"use client";

import { useState } from "react";
import { Plus, Trash2, UserMinus } from "lucide-react";

export type Injury = {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  impact: number;
};

interface InjurySelectorProps {
  teamName: string;
  injuries: Injury[];
  setInjuries: (injuries: Injury[]) => void;
}

export default function InjurySelector({
  teamName,
  injuries,
  setInjuries,
}: InjurySelectorProps) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<"GK" | "DEF" | "MID" | "ATT">("MID");
  const [impact, setImpact] = useState(5);

  const addInjury = () => {
    if (!name.trim()) return;
    const newInjury: Injury = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      position,
      impact,
    };
    setInjuries([...injuries, newInjury]);
    setName("");
    setImpact(5);
  };

  const removeInjury = (id: string) => {
    setInjuries(injuries.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-[#111829] p-4 rounded-xl border border-[#1F2A44] mb-4">
      <h3 className="text-lg font-bold text-gray-200 mb-3 flex items-center gap-2">
        <UserMinus size={18} className="text-red-400" /> {teamName} Injuries
      </h3>

      {/* INJURY LIST */}
      <div className="space-y-2 mb-4">
        {injuries.length === 0 && (
          <p className="text-sm text-gray-500 italic">No injuries selected.</p>
        )}
        {injuries.map((inj, index) => (
          <div
            key={inj.id || index}
            className="flex items-center justify-between bg-[#0D1324] p-2 rounded-lg border border-[#27345A]"
          >
            <div>
              <p className="font-bold text-sm text-gray-200">{inj.name}</p>
              <p className="text-xs text-gray-400">
                {inj.position} • Impact: {inj.impact}/10
              </p>
            </div>
            <button
              onClick={() => removeInjury(inj.id)}
              className="text-red-400 hover:bg-red-900/20 p-1.5 rounded-md transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* ADD FORM */}
      <div className="bg-[#0D1324] p-3 rounded-lg border border-[#1F2A44] space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player Name"
          className="w-full bg-[#1A233A] text-sm text-white p-2 rounded border border-gray-700 focus:outline-none focus:border-[#39FF14]"
        />

        <div className="flex gap-2">
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as any)}
            className="bg-[#1A233A] text-sm text-white p-2 rounded border border-gray-700 flex-1"
          >
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="ATT">ATT</option>
          </select>
          <div className="flex items-center gap-2 flex-1 px-2">
            <span className="text-xs text-gray-400">Imp:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={impact}
              onChange={(e) => setImpact(Number(e.target.value))}
              className="w-full accent-[#39FF14]"
            />
            <span className="text-xs font-bold w-4">{impact}</span>
          </div>
        </div>

        <button
          onClick={addInjury}
          className="w-full bg-[#1F2A44] hover:bg-[#2A3A66] text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition"
        >
          <Plus size={16} /> Add Injury
        </button>
      </div>
    </div>
  );
}
