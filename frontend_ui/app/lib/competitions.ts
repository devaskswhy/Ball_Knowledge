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

// One visual identity per competition — the gradient and heading colors are
// pulled from each competition's real branding, not a shared template.
export const COMPETITIONS: Record<string, CompetitionMeta> = {
  PL: {
    code: "PL",
    name: "Premier League",
    shortName: "PL",
    country: "England",
    kind: "league",
    vibe: "Purple and pitch-green, the Prem's own palette",
    gradient: "linear-gradient(135deg, #2b0030 0%, #080f26 100%)",
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
    vibe: "Sun-baked orange and Spanish red",
    gradient: "linear-gradient(135deg, #7a0909 0%, #290000 100%)",
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
    vibe: "Azzurri blue on midnight",
    gradient: "linear-gradient(135deg, #0b1a30 0%, #000000 100%)",
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
    vibe: "Tricolore navy and teal",
    gradient: "linear-gradient(135deg, #0a1f44 0%, #004d4d 100%)",
    heading: "from-[#001738] via-[#da291c] to-[#ffffff]",
    accentText: "text-gray-200",
    accentBg: "bg-[#001738]",
  },
  BL: {
    code: "BL",
    name: "Bundesliga",
    shortName: "Bundesliga",
    country: "Germany",
    kind: "league",
    vibe: "Charcoal and Bundesliga red",
    gradient: "linear-gradient(135deg, #2c2c2c 0%, #111111 100%)",
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
    vibe: "Continental navy and anthem gold",
    gradient: "linear-gradient(135deg, #050a30 0%, #000000 100%)",
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
