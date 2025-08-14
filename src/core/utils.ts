export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** SEEDED RNG  -------------------------------------------------------------- */
export type RNG = () => number;

/** Simple deterministic PRNG (mulberry32) */
function mulberry32(seed: number): RNG {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  // xfnv1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Create RNG: if seed omitted -> uses Math.random adapter (non-deterministic) */
export function makeRNG(seed?: string | null): RNG {
  if (!seed) return () => Math.random();
  return mulberry32(hashString(String(seed)));
}

/** Seeded shuffle */
export function shuffleRng<T>(arr: T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** TEXT UTILS --------------------------------------------------------------- */
export function normalizeText(s: string): string {
  if (!s) return "";
  let out = s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[.,;:!?()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

export function tokens(s: string): string[] {
  return normalizeText(s).split(" ").filter(Boolean);
}

// Domain-specific stopwords ignored during token similarity
export const STOPWORDS = new Set<string>(["ძალა", "ძალები"]);
export function tokensNoStopwords(s: string): string[] {
  return tokens(s).filter(t => !STOPWORDS.has(t));
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = new Set([...A].filter(x => B.has(x)));
  const union = new Set([...A, ...B]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function charSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return 1;
  const maxLen = Math.max(na.length, nb.length) || 1;
  const lev = levenshtein(na, nb);
  return 1 - lev / maxLen; // 1.0 is identical
}

export function bestVariantSimilarity(user: string, variants: string[]): number {
  const tUser = tokensNoStopwords(user);
  let best = 0;
  for (const v of variants) {
    const tV = tokensNoStopwords(v);
    const j = jaccard(tUser, tV);
    const c = charSimilarity(user, v);
    const sim = Math.max(j, c);
    if (sim > best) best = sim;
  }
  return best;
}
