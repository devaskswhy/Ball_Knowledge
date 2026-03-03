// ─── Types ──────────────────────────────────────────────────────────────────

export interface Shot {
    x: number;
    y: number;
    xG: number;
    result: "goal" | "saved" | "missed" | "blocked";
    player: string;
    minute: number;
}

export interface PlayerNode {
    id: number;
    name: string;
    number: number;
    x: number;
    y: number;
    position: string;
}

export interface PassEdge {
    from: number;
    to: number;
    count: number;
}

export interface MatchStats {
    possession: [number, number];
    shots: [number, number];
    shotsOnTarget: [number, number];
    passes: [number, number];
    corners: [number, number];
    fouls: [number, number];
}

// ─── Seeded random helper ───────────────────────────────────────────────────

function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// ─── Heatmap ────────────────────────────────────────────────────────────────

/**
 * Returns a 96-value (12×8) array of floats [0-1].
 * Position-aware: forwards get higher attacking-third values, defenders get
 * higher defensive-third values, midfielders are distributed centrally.
 */
export function generatePlayerHeatmap(
    playerName: string,
    position: string = "MID"
): number[] {
    const rand = seededRandom(
        playerName.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    const grid: number[] = [];
    const cols = 12;
    const rows = 8;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const colNorm = c / (cols - 1); // 0 = left (defensive), 1 = right (attacking)
            const rowNorm = Math.abs(r / (rows - 1) - 0.5) * 2; // 0 = center, 1 = wing

            let base = 0;
            if (position === "GK") {
                base = colNorm < 0.15 ? 0.6 + rand() * 0.4 : rand() * 0.05;
            } else if (position === "DEF") {
                base = Math.max(0, 0.7 - colNorm * 1.2) * (1 - rowNorm * 0.3);
            } else if (position === "MID") {
                const distFromCenter = Math.abs(colNorm - 0.45);
                base = Math.max(0, 0.8 - distFromCenter * 2) * (1 - rowNorm * 0.4);
            } else {
                // ATT / FWD
                base = Math.max(0, colNorm * 1.1 - 0.2) * (1 - rowNorm * 0.35);
            }

            // Add noise
            const value = Math.min(1, Math.max(0, base + (rand() - 0.5) * 0.25));
            grid.push(value);
        }
    }
    return grid;
}

/**
 * Returns a 96-value aggregated team heatmap (sum of mock player heatmaps).
 */
export function generateTeamHeatmap(teamName: string): number[] {
    const rand = seededRandom(
        teamName.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    const cols = 12;
    const rows = 8;
    const grid: number[] = new Array(cols * rows).fill(0);

    // Simulate ~11 player heatmaps combined
    const positions = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "ATT", "ATT", "ATT"];
    positions.forEach((pos, idx) => {
        const playerGrid = generatePlayerHeatmap(`${teamName}_P${idx}`, pos);
        for (let i = 0; i < grid.length; i++) {
            grid[i] += playerGrid[i];
        }
    });

    // Normalize to 0-1
    const maxVal = Math.max(...grid);
    for (let i = 0; i < grid.length; i++) {
        grid[i] = grid[i] / maxVal;
        // Add team-specific bias
        grid[i] = Math.min(1, grid[i] + (rand() - 0.5) * 0.08);
    }

    return grid;
}

// ─── Shot Map (xG) ─────────────────────────────────────────────────────────

const SHOT_PLAYERS = [
    "Haaland", "Salah", "Saka", "Son", "Palmer",
    "Rashford", "Watkins", "Isak", "Mbeumo", "Cunha",
    "Solanke", "Jackson", "Nkunku", "Havertz", "Darwin"
];

export function generateShotMap(teamName: string, playerFilter?: string): Shot[] {
    const rand = seededRandom(
        teamName.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 42
    );
    const count = 12 + Math.floor(rand() * 10);
    const shots: Shot[] = [];

    for (let i = 0; i < count; i++) {
        const player = playerFilter || SHOT_PLAYERS[Math.floor(rand() * SHOT_PLAYERS.length)];

        // Shots mostly from inside the box or edge
        const x = 500 + rand() * 170; // attacking third (in 680-wide pitch)
        const y = 80 + rand() * 280;  // between the posts roughly

        // xG distribution: most are low (0.02–0.15), some medium, few high
        let xG: number;
        const roll = rand();
        if (roll < 0.55) xG = 0.02 + rand() * 0.1;
        else if (roll < 0.82) xG = 0.1 + rand() * 0.2;
        else if (roll < 0.94) xG = 0.3 + rand() * 0.3;
        else xG = 0.6 + rand() * 0.35;

        // Result distribution: ~25% goal, ~30% saved, ~25% missed, ~20% blocked
        const rr = rand();
        let result: Shot["result"];
        if (rr < 0.25) result = "goal";
        else if (rr < 0.55) result = "saved";
        else if (rr < 0.8) result = "missed";
        else result = "blocked";

        shots.push({
            x,
            y,
            xG: parseFloat(xG.toFixed(2)),
            result,
            player,
            minute: 1 + Math.floor(rand() * 90),
        });
    }

    return shots.sort((a, b) => a.minute - b.minute);
}

// ─── Passing Network ────────────────────────────────────────────────────────

const FORMATION_433: { pos: string; x: number; y: number }[] = [
    { pos: "GK", x: 60, y: 220 },
    { pos: "RB", x: 170, y: 60 },
    { pos: "CB", x: 160, y: 170 },
    { pos: "CB", x: 160, y: 270 },
    { pos: "LB", x: 170, y: 380 },
    { pos: "CM", x: 310, y: 130 },
    { pos: "CDM", x: 280, y: 220 },
    { pos: "CM", x: 310, y: 310 },
    { pos: "RW", x: 480, y: 80 },
    { pos: "ST", x: 520, y: 220 },
    { pos: "LW", x: 480, y: 360 },
];

const PLAYER_NAMES = [
    "Ederson", "Walker", "Dias", "Stones", "Gvardiol",
    "De Bruyne", "Rodri", "Silva", "Foden", "Haaland", "Grealish"
];

export function generatePassingNetwork(teamName: string): {
    nodes: PlayerNode[];
    edges: PassEdge[];
} {
    const rand = seededRandom(
        teamName.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 99
    );

    // Nodes — player positions with some jitter
    const nodes: PlayerNode[] = FORMATION_433.map((f, i) => ({
        id: i + 1,
        name: PLAYER_NAMES[i] || `Player ${i + 1}`,
        number: i === 0 ? 1 : i + 1,
        x: f.x + (rand() - 0.5) * 30,
        y: f.y + (rand() - 0.5) * 20,
        position: f.pos,
    }));

    // Edges — typically 35–50 connections
    const edgeSet = new Set<string>();
    const edges: PassEdge[] = [];
    const edgeCount = 35 + Math.floor(rand() * 15);

    for (let e = 0; e < edgeCount; e++) {
        const from = 1 + Math.floor(rand() * 11);
        let to = 1 + Math.floor(rand() * 11);
        if (to === from) to = (to % 11) + 1;

        const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
        if (edgeSet.has(key)) {
            // Add to existing count
            const existing = edges.find(
                (ed) =>
                    (ed.from === Math.min(from, to) && ed.to === Math.max(from, to))
            );
            if (existing) existing.count += 1 + Math.floor(rand() * 3);
            continue;
        }
        edgeSet.add(key);
        edges.push({
            from: Math.min(from, to),
            to: Math.max(from, to),
            count: 2 + Math.floor(rand() * 12),
        });
    }

    return { nodes, edges };
}

// ─── Match Stats ────────────────────────────────────────────────────────────

export function generateMatchStats(homeTeam: string, awayTeam: string): MatchStats {
    const rand = seededRandom(
        (homeTeam + awayTeam).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );

    const homePoss = 40 + Math.floor(rand() * 25);
    return {
        possession: [homePoss, 100 - homePoss],
        shots: [8 + Math.floor(rand() * 12), 6 + Math.floor(rand() * 10)],
        shotsOnTarget: [3 + Math.floor(rand() * 6), 2 + Math.floor(rand() * 5)],
        passes: [350 + Math.floor(rand() * 250), 300 + Math.floor(rand() * 200)],
        corners: [3 + Math.floor(rand() * 7), 2 + Math.floor(rand() * 6)],
        fouls: [6 + Math.floor(rand() * 8), 5 + Math.floor(rand() * 9)],
    };
}
