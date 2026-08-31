export type CompetitionMeta = {
  code: string;
  name: string;
  shortName: string;
  country: string;
  kind: "league" | "cup";
  vibe: string;
  gradient: string;
  heading: string;
  accentText: string;
  accentBg: string;
};

// One visual identity per competition — a real motif from that league's own
// footballing culture (rendered as a layered CSS gradient, no image assets),
// a display face used only for its heading, and colors pulled from its
// actual branding. Everything else in the app (nav, tables, body copy) stays
// on the shared chrome so the territory reads as an accent, not a reskin.
export const COMPETITIONS: Record<string, CompetitionMeta> = {
  PL: {
    code: "PL",
    name: "Premier League",
    shortName: "PL",
    country: "England",
    kind: "league",
    vibe: "Broad diagonal stripes, purple and pitch-green — the Prem's own crest chevron",
    gradient:
      "repeating-linear-gradient(135deg, rgba(233,0,82,0.12) 0px, rgba(233,0,82,0.12) 3px, transparent 3px, transparent 44px), " +
      "repeating-linear-gradient(135deg, rgba(0,255,133,0.07) 0px, rgba(0,255,133,0.07) 2px, transparent 2px, transparent 88px), " +
      "linear-gradient(135deg, #2b0030 0%, #080f26 100%)",
    heading: "from-[#38003c] via-[#e90052] to-[#00ff85]",
    accentText: "text-purple-200",
    accentBg: "bg-[#38003c]",
  },
  LL: {
    code: "LL",
    name: "La Liga",
    shortName: "La Liga",
    country: "Spain",
    kind: "league",
    vibe: "A sunburst off the corner — the Spanish sun, all warmth and rays",
    gradient:
      "repeating-conic-gradient(from 0deg at 100% 0%, rgba(255,150,20,0.16) 0deg 4deg, transparent 4deg 18deg), " +
      "linear-gradient(135deg, #7a0909 0%, #290000 100%)",
    heading: "from-[#ee8707] via-[#ff4b4b] to-[#121212]",
    accentText: "text-orange-200",
    accentBg: "bg-[#ee8707]",
  },
  SA: {
    code: "SA",
    name: "Serie A",
    shortName: "Serie A",
    country: "Italy",
    kind: "league",
    vibe: "A fine tailored pinstripe in Azzurri blue — calcio as fashion house",
    gradient:
      "repeating-linear-gradient(90deg, rgba(0,161,224,0.10) 0px, rgba(0,161,224,0.10) 1px, transparent 1px, transparent 20px), " +
      "linear-gradient(135deg, #0b1a30 0%, #000000 100%)",
    heading: "from-[#004d98] via-[#00a1e0] to-[#ffffff]",
    accentText: "text-blue-200",
    accentBg: "bg-[#004d98]",
  },
  L1: {
    code: "L1",
    name: "Ligue 1",
    shortName: "Ligue 1",
    country: "France",
    kind: "league",
    vibe: "Crossed lattice in tricolore red and white — Parisian ironwork",
    gradient:
      "repeating-linear-gradient(45deg, rgba(218,41,28,0.08) 0px, rgba(218,41,28,0.08) 1px, transparent 1px, transparent 26px), " +
      "repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 26px), " +
      "linear-gradient(135deg, #0a1f44 0%, #004d4d 100%)",
    heading: "from-[#4d6dd4] via-[#e8453a] to-[#ffffff]",
    accentText: "text-gray-200",
    accentBg: "bg-[#001738]",
  },
  BL: {
    code: "BL",
    name: "Bundesliga",
    shortName: "Bundesliga",
    country: "Germany",
    kind: "league",
    vibe: "A precise engineering grid — German efficiency, drawn to scale",
    gradient:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 26px), " +
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 26px), " +
      "linear-gradient(135deg, #2c2c2c 0%, #111111 100%)",
    heading: "from-[#d1101a] via-[#fc1d25] to-[#ffffff]",
    accentText: "text-red-100",
    accentBg: "bg-[#d1101a]",
  },
  UCL: {
    code: "UCL",
    name: "UEFA Champions League",
    shortName: "Champions League",
    country: "Europe",
    kind: "cup",
    vibe: "A scatter of anthem-gold stars on continental navy",
    gradient:
      "radial-gradient(circle at 12% 22%, rgba(232,199,102,0.55) 0px, rgba(232,199,102,0.55) 1.5px, transparent 1.5px), " +
      "radial-gradient(circle at 82% 14%, rgba(232,199,102,0.45) 0px, rgba(232,199,102,0.45) 1.5px, transparent 1.5px), " +
      "radial-gradient(circle at 46% 58%, rgba(232,199,102,0.35) 0px, rgba(232,199,102,0.35) 1px, transparent 1px), " +
      "radial-gradient(circle at 72% 78%, rgba(232,199,102,0.5) 0px, rgba(232,199,102,0.5) 1.5px, transparent 1.5px), " +
      "radial-gradient(circle at 22% 85%, rgba(232,199,102,0.3) 0px, rgba(232,199,102,0.3) 1px, transparent 1px), " +
      "radial-gradient(circle at 92% 52%, rgba(232,199,102,0.4) 0px, rgba(232,199,102,0.4) 1.2px, transparent 1.2px), " +
      "radial-gradient(circle at 58% 10%, rgba(232,199,102,0.3) 0px, rgba(232,199,102,0.3) 1px, transparent 1px), " +
      "linear-gradient(135deg, #050a30 0%, #000000 100%)",
    heading: "from-[#3b5bdb] via-[#6a8ef5] to-[#e8c766]",
    accentText: "text-indigo-200",
    accentBg: "bg-[#0d3b8c]",
  },
};

export const COMPETITION_ORDER = ["PL", "LL", "SA", "L1", "BL", "UCL"];

export function getCompetition(code?: string): CompetitionMeta | undefined {
  if (!code) return undefined;
  return COMPETITIONS[code.toUpperCase()];
}
