import {
  Archivo_Black,
  Baloo_2,
  Playfair_Display,
  Bodoni_Moda,
  Space_Grotesk,
  Cinzel,
} from "next/font/google";

// One display face per competition, used only for its own heading — every
// other typographic element (nav, tables, body copy) stays on Outfit so the
// app's "chrome" reads as one product. The territory is the accent, not a
// wholesale reskin.
const pl = Archivo_Black({ subsets: ["latin"], weight: "400" });
const ll = Baloo_2({ subsets: ["latin"], weight: ["600", "800"] });
const sa = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], style: ["normal", "italic"] });
const l1 = Bodoni_Moda({ subsets: ["latin"], weight: ["700", "900"] });
const bl = Space_Grotesk({ subsets: ["latin"], weight: ["600", "700"] });
const ucl = Cinzel({ subsets: ["latin"], weight: ["600", "700", "900"] });

// Each font only has certain weights loaded above; pair every territory with
// a Tailwind weight class that matches one of them, rather than a blanket
// font-black that would force the browser to synthesize a weight that was
// never fetched.
const TERRITORY_FONTS: Record<string, { className: string; weightClass: string }> = {
  PL: { className: pl.className, weightClass: "" }, // Archivo Black is already a 400-weight black face
  LL: { className: ll.className, weightClass: "font-extrabold" }, // 800
  SA: { className: sa.className, weightClass: "font-black" }, // 900
  L1: { className: l1.className, weightClass: "font-black" }, // 900
  BL: { className: bl.className, weightClass: "font-bold" }, // 700
  UCL: { className: ucl.className, weightClass: "font-black" }, // 900
};

export function territoryFont(code?: string): string {
  if (!code) return "";
  const entry = TERRITORY_FONTS[code.toUpperCase()];
  if (!entry) return "";
  return `${entry.className} ${entry.weightClass}`.trim();
}
