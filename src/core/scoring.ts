import { FUZZY } from "./config";
import { bestVariantSimilarity, normalizeText } from "./utils";
import type { ListItem, ListRowReview, WrittenList, WrittenSingle } from "./types";

function equalsWithSynonyms(user: string, item: ListItem): boolean {
  const u = normalizeText(user);
  if (u === normalizeText(item.value)) return true;
  if (item.synonyms && item.synonyms.some(s => normalizeText(s) === u)) return true;
  return false;
}

export function scoreWrittenSingle(q: WrittenSingle, user: string): { score: number; ratio: number } {
  const allowFuzzy = q.allow_fuzzy ?? FUZZY.enableByDefaultSingle;
  const variants = q.answer_variants?.length ? q.answer_variants : [""];
  if (!allowFuzzy) {
    const ok = variants.some(v => normalizeText(v) === normalizeText(user));
    return { score: ok ? q.points : 0, ratio: ok ? 1 : 0 };
  }
  const sim = bestVariantSimilarity(user, variants);
  if (sim >= FUZZY.acceptFullAt) return { score: q.points, ratio: sim };
  if (sim >= FUZZY.acceptPartialAt) {
    const t = (sim - FUZZY.acceptPartialAt) / (FUZZY.acceptFullAt - FUZZY.acceptPartialAt);
    return { score: Math.round(q.points * t * 100) / 100, ratio: sim };
  }
  return { score: 0, ratio: sim };
}

export function scoreWrittenList(
  q: WrittenList,
  userBlanks: string[],
  requiredItems: ListItem[]
): { score: number; correct: number; total: number; rows: ListRowReview[] } {
  const total = requiredItems.length;
  const fullAt = FUZZY.acceptFullAt;
  const partAt = FUZZY.acceptPartialAt;

  const users: string[] = new Array(total).fill("").map((_, i) => (userBlanks[i] ?? "").trim());
  const reqs: ListItem[] = requiredItems.slice();

  function sim(u: string, item: ListItem): number {
    if (!u) return 0;
    if (equalsWithSynonyms(u, item)) return 1;
    const variants = [item.value, ...(item.synonyms ?? [])];
    return Math.max(0, Math.min(1, bestVariantSimilarity(u, variants)));
  }

  if (q.list.order_sensitive) {
    const rows: ListRowReview[] = users.map((u, i) => {
      const expected = reqs[i]?.value ?? "";
      const s = reqs[i] ? sim(u, reqs[i]) : 0;
      const okFull = s >= fullAt;
      return { user: u, expected, ratio: s, okFull };
    });
    const unitScores = rows.map(r => (r.okFull ? 1 : (r.ratio >= partAt ? (r.ratio - partAt) / (fullAt - partAt) : 0)));
    const sum = unitScores.reduce((a, b) => a + b, 0);
    const score = Math.round((q.points * (sum / Math.max(1, total))) * 100) / 100;
    const correct = rows.filter(r => r.okFull).length;
    return { score, correct, total, rows };
  }

  // Order-insensitive greedy matching
  const sims: number[][] = users.map(u => reqs.map(r => sim(u, r)));
  const usedU = new Set<number>();
  const usedR = new Set<number>();
  const pairs: { ui: number; ri: number; s: number }[] = [];

  while (pairs.length < total) {
    let best = { ui: -1, ri: -1, s: -1 };
    for (let i = 0; i < users.length; i++) if (!usedU.has(i)) {
      for (let j = 0; j < reqs.length; j++) if (!usedR.has(j)) {
        const s = sims[i][j] ?? 0;
        if (s > best.s) best = { ui: i, ri: j, s };
      }
    }
    if (best.ui === -1 || best.ri === -1) break;
    usedU.add(best.ui); usedR.add(best.ri);
    pairs.push(best);
  }

  const rows: ListRowReview[] = pairs.map(p => ({
    user: users[p.ui],
    expected: reqs[p.ri]?.value ?? "",
    ratio: p.s,
    okFull: p.s >= fullAt,
  }));
  while (rows.length < total) {
    const idx = rows.length;
    rows.push({ user: users[idx] ?? "", expected: reqs[idx]?.value ?? "", ratio: 0, okFull: false });
  }

  const unitScores = rows.map(r => (r.okFull ? 1 : (r.ratio >= partAt ? (r.ratio - partAt) / (fullAt - partAt) : 0)));
  const sum = unitScores.reduce((a, b) => a + b, 0);
  const score = Math.round((q.points * (sum / Math.max(1, total))) * 100) / 100;
  const correct = rows.filter(r => r.okFull).length;
  return { score, correct, total, rows };
}
