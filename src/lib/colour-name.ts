/**
 * A colour shown by its name, not by its code. The app still stores the colour the admin picked (a HEX value), but the
 * screens and the print show the nearest everyday colour name, like "Maroon" or "Sky blue".
 */
const NAMED: [string, string][] = [
  ["Black", "#000000"], ["Charcoal", "#36454F"], ["Dark grey", "#555555"], ["Grey", "#808080"], ["Light grey", "#C0C0C0"],
  ["White", "#FFFFFF"], ["Off white", "#F5F5F0"], ["Ivory", "#FFFFF0"], ["Cream", "#FFFDD0"], ["Beige", "#F5F5DC"], ["Champagne", "#F7E7CE"],
  ["Sand", "#C2B280"], ["Tan", "#D2B48C"], ["Khaki", "#BDB76B"], ["Camel", "#C19A6B"], ["Brown", "#7B4A2A"], ["Chocolate", "#4B2E1E"],
  ["Coffee", "#6F4E37"], ["Copper", "#B87333"], ["Rust", "#B7410E"], ["Terracotta", "#CB6D51"],
  ["Maroon", "#800000"], ["Burgundy", "#6D0F20"], ["Wine", "#722F37"], ["Red", "#E00000"], ["Crimson", "#DC143C"], ["Scarlet", "#FF2400"],
  ["Coral", "#FF6F61"], ["Salmon", "#FA8072"], ["Peach", "#FFCBA4"], ["Orange", "#FF8C00"], ["Mustard", "#E1AD01"], ["Gold", "#D4AF37"],
  ["Yellow", "#FFE000"], ["Lemon", "#FFF44F"], ["Lime", "#9ACD32"], ["Olive", "#808000"], ["Sage", "#9CAF88"], ["Mint", "#A8E6CF"],
  ["Green", "#2E9E3E"], ["Emerald", "#50C878"], ["Bottle green", "#006A4E"], ["Forest green", "#228B22"], ["Teal", "#008080"],
  ["Turquoise", "#30D5C8"], ["Aqua", "#00FFFF"], ["Sky blue", "#87CEEB"], ["Baby blue", "#A7C7E7"], ["Blue", "#1F5FD1"], ["Royal blue", "#4169E1"],
  ["Navy", "#1F2A5C"], ["Midnight blue", "#191970"], ["Lavender", "#B57EDC"], ["Lilac", "#C8A2C8"], ["Violet", "#8F00FF"], ["Purple", "#6A2C91"],
  ["Plum", "#8E4585"], ["Magenta", "#FF00FF"], ["Fuchsia", "#FF1493"], ["Pink", "#FF8FAB"], ["Baby pink", "#F4C2C2"], ["Rose", "#E0457B"],
  ["Hot pink", "#FF69B4"], ["Blush", "#DE98AB"], ["Brick red", "#9C3030"], ["Dusty rose", "#B88588"], ["Mauve", "#915F6D"],
];

function lab(hex: string): [number, number, number] {
  const n = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [lin(n(0)), lin(n(1)), lin(n(2))];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const TABLE = NAMED.map(([name, hex]) => ({ name, lab: lab(hex) }));

/** The nearest everyday colour name for a HEX colour ("#923535" -> "Maroon"). Anything that is not a HEX colour comes back as it is. */
export function colourName(hex: string | null | undefined): string {
  const v = (hex ?? "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(v)) return v;
  const c = lab(v);
  let best = TABLE[0];
  let bestD = Infinity;
  for (const t of TABLE) {
    const d = (t.lab[0] - c[0]) ** 2 + (t.lab[1] - c[1]) ** 2 + (t.lab[2] - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best.name;
}
