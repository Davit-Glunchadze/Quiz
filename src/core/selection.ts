import { STORAGE_KEYS } from "./config";
import type { RNG } from "./utils";
import { shuffle, shuffleRng } from "./utils";
import type { ListItem, Question, WrittenList } from "./types";

function loadBag(key: string): number[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) return ids as number[];
  } catch {}
  return null;
}
export function saveBag(key: string, ids: number[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function buildBags(bank: Question[]): { mcq: number[]; written: number[] } {
  const mcqIds = bank.filter(q => q.type === "mcq").map(q => q.id);
  const wrIds = bank.filter(q => q.type === "written").map(q => q.id);
  const mcqBag = loadBag(STORAGE_KEYS.BAG_MCQ) ?? shuffle(mcqIds);
  const wrBag = loadBag(STORAGE_KEYS.BAG_WRITTEN) ?? shuffle(wrIds);
  return { mcq: mcqBag, written: wrBag };
}

export function refillIfNeeded(bag: number[], needed: number, sourceIds: number[]): number[] {
  if (bag.length >= needed) return bag;
  const remaining = needed - bag.length;
  const refill = shuffle(sourceIds);
  return bag.concat(refill).slice(0, bag.length + remaining);
}

export function takeFromBag(bag: number[], count: number): { taken: number[]; rest: number[] } {
  const taken = bag.slice(0, count);
  const rest = bag.slice(count);
  return { taken, rest };
}

/** Seed-aware partition for list questions. */
export function partitionList(q: WrittenList, rng: RNG): { shown: ListItem[]; hidden: ListItem[] } {
  const full = q.list.full.slice();
  const showCount = Math.max(1, Math.ceil(full.length * (q.list.show_ratio ?? 0.25)));
  const shuffled = shuffleRng(full, rng);
  const shown = shuffled.slice(0, showCount);
  const hidden = shuffled.slice(showCount);

  if (q.list.order_sensitive) {
    const orderMap = new Map(q.list.full.map((it, idx) => [it.value, idx] as const));
    hidden.sort((a, b) => (orderMap.get(a.value)! - orderMap.get(b.value)!));
  } else {
    hidden.sort((a, b) => a.value.localeCompare(b.value));
  }
  return { shown, hidden };
}
