/**
 * Contentium design tokens.
 *
 * The single source of truth for the look that ties all five studios together.
 * Each sub-app gets its own accent, but they all share the same spacing, radii,
 * surface ramp, and typography so the suite reads as ONE product.
 */

export const surface = {
  /** app background, near-black with a hint of indigo */
  base: "#0a0a0f",
  /** raised panels */
  panel: "#12121a",
  /** cards / inputs */
  card: "#1a1a25",
  /** hover / active */
  raised: "#22222f",
  /** hairline borders */
  border: "#2a2a3a",
  borderStrong: "#3a3a4f",
} as const;

export const text = {
  primary: "#f4f4f6",
  secondary: "#a1a1b5",
  muted: "#6b6b80",
} as const;

/** The umbrella brand — used on the hub and global chrome. */
export const brand = {
  accent: "#818cf8",
  accentStrong: "#6366f1",
  gradientFrom: "#6366f1",
  gradientTo: "#d946ef",
} as const;

export const radius = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  pill: "9999px",
} as const;

export type Accent = {
  /** primary accent hex */
  base: string;
  /** low-alpha wash for backgrounds */
  soft: string;
  /** two-stop gradient */
  gradient: [string, string];
};
