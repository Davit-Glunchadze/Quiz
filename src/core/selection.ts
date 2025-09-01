// src/core/selection.ts
import type { Question, WrittenList } from "./types";
import type { RNG } from "./utils";

const BAG_KEY_MCQ = "quiz.bag.mcq";
const BAG_KEY_WR = "quiz.bag.written";

/** Read saved bags or build fresh from bank */
export function buildBags(bank: Question[]) {
  const mcqSaved = readBag(BAG_KEY_MCQ);
  const wrSaved = readBag(BAG_KEY_WR);

  const mcqAll = bank.filter((q) => q.type === "mcq").map((q) => q.id);
  const wrAll = bank.filter((q) => q.type === "written").map((q) => q.id);

  const mcq = mcqSaved.length ? mcqSaved : mcqAll.slice();
  const written = wrSaved.length ? wrSaved : wrAll.slice();

  return { mcq, written };
}

export function saveBag(key: string, arr: number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

function readBag(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw) as number[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** If bag doesn't have enough items to serve `needed`, append a fresh round of all ids (deduped). */
export function refillIfNeeded(
  bag: number[],
  needed: number,
  allIds: number[]
) {
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
 * ჩამონათვლიანი საწერისთვის — revealMode მხარდაჭერა ორივე ფორმატით:
 *  - რიცხვითი: 0 → არაფერი (none), 1 → მხოლოდ ერთი (one), 0.25 → მეოთხედი (quarter).
 *    თუ სხვა რიცხვია 0..1 დიაპაზონში, აღიქმება როგორც პროცენტული წილი (მინ. 1 ნაჩვენები).
 *  - სტრინგები: 'none' | 'one' | 'quarter'
 */
export function partitionList(
  wl: WrittenList,
  rng: RNG,
  revealMode: number | "quarter" | "one" | "none" = 0.25
) {
  const full = wl.list.full.slice();
  if (full.length === 0) return { shown: [], hidden: [] };

  // Helper: დასელექციო k უნიკალური ინდექსი deterministic rng-ით
  const pickK = (k: number) => {
    const idxs = Array.from({ length: full.length }, (_, i) => i);
    // Fisher-Yates shuffle rng-ის გამოყენებით
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    const chosen = new Set<number>(idxs.slice(0, Math.max(0, Math.min(full.length, k))));
    return chosen;
  };

  // normalize reveal mode
  let mode: "none" | "one" | "quarter" | "ratio" = "quarter";
  let ratio = 0.25;

  if (typeof revealMode === "string") {
    if (revealMode === "none") mode = "none";
    else if (revealMode === "one") mode = "one";
    else mode = "quarter"; // 'quarter'
  } else {
    // numeric
    if (revealMode <= 0) {
      mode = "none";
    } else if (revealMode === 1) {
      mode = "one";
    } else if (revealMode === 0.25) {
      mode = "quarter";
    } else if (revealMode > 0 && revealMode < 1) {
      mode = "ratio";
      ratio = revealMode;
    } else {
      // fall back to quarter
      mode = "quarter";
    }
  }

  if (mode === "none") {
    return { shown: [], hidden: full };
  }

  if (mode === "one") {
    const idx = Math.floor(rng() * full.length);
    const shown = [full[idx]];
    const hidden = full.filter((_, i) => i !== idx);
    return { shown, hidden };
  }

  // 'quarter' or 'ratio'
  const effRatio =
    mode === "quarter"
      ? typeof wl.list.show_ratio === "number"
        ? wl.list.show_ratio || 0.25
        : 0.25
      : ratio;

  const count = Math.max(1, Math.round(full.length * effRatio));
  const chosen = pickK(count);
  const shown = full.filter((_, i) => chosen.has(i));
  const hidden = full.filter((_, i) => !chosen.has(i));
  return { shown, hidden };
}
