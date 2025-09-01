import type { Question, WrittenList } from "./types";
import type { RNG } from "./utils"; // ⬅ მხოლოდ type-ად გვჭირდება

const BAG_KEY_MCQ = "quiz.bag.mcq";
const BAG_KEY_WR = "quiz.bag.written";

/** Read saved bags or build fresh from bank */
export function buildBags(bank: Question[]) {
  const mcqSaved = readBag(BAG_KEY_MCQ);
  const wrSaved = readBag(BAG_KEY_WR);

  const mcqAll = bank.filter(q => q.type === "mcq").map(q => q.id);
  const wrAll = bank.filter(q => q.type === "written").map(q => q.id);

  const mcq = mcqSaved.length ? mcqSaved : mcqAll.slice();
  const written = wrSaved.length ? wrSaved : wrAll.slice();

  return { mcq, written };
}

export function saveBag(key: string, arr: number[]) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
}

function readBag(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw) as number[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** If bag doesn't have enough items to serve `needed`, append a fresh round of all ids (deduped). */
export function refillIfNeeded(bag: number[], needed: number, allIds: number[]) {
  if (bag.length >= needed) return bag.slice();
  // append a full new round (avoid duplicates)
  const set = new Set(bag);
  for (const id of allIds) {
    if (!set.has(id)) bag.push(id);
  }
  return bag.slice();
}

/** Take first `count` items from bag, return {taken, rest} and persist must be done by caller */
export function takeFromBag(bag: number[], count: number) {
  const taken = bag.slice(0, count);
  const rest = bag.slice(count);
  return { taken, rest };
}

/**
 * For list-type written questions:
 * Previously we showed 25% of the list.
 * NOW: always show EXACTLY ONE item (random/seeded), and hide the rest.
 */
export function partitionList(wl: WrittenList, rng: RNG) {
  const full = wl.list.full.slice();
  if (full.length === 0) return { shown: [], hidden: [] };

  // pick exactly one index to show (seeded)
  const idx = Math.floor(rng() * full.length);
  const shown = [full[idx]];
  const hidden = full.filter((_, i) => i !== idx);
  return { shown, hidden };
}
