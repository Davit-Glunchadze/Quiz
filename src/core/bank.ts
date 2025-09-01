import { STORAGE_KEYS } from "./config";
import type { Question, MCQ, WrittenList, WrittenSingle, MCQOption } from "./types";
import { SAMPLE_QUESTIONS } from "../samples/sampleQuestions";
import { useEffect, useState } from "react";

/** prepend Vite base to a path if it's relative or starts with "/" */
function withBase(p?: string | null): string | undefined {
  if (!p) return undefined;
  // აბსოლუტური URL-ები გაუშვი უცვლელად
  if (/^https?:\/\//i.test(p)) return p;

  const base = (import.meta as any).env?.BASE_URL || "/";
  // თუ იწყება "/"-ით → მოვაჭრათ და მივაწებოთ base
  if (p.startsWith("/")) return `${base}${p.slice(1)}`;
  // წინააღმდეგ შემთხვევაში ჩავთვალოთ public-ის შიგნით არსებული ბილიკი
  return `${base}${p}`;
}

// type guard: დატოვე მხოლოდ სტრინგები
function isStr(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

/** images ჯგუფის ნორმალიზაცია: ფილტრავს undefined-ებს და აბრუნებს მხოლოდ მაშინ, როცა რამე დარჩა */
function normGroup(
  imgs?: { question?: string[]; answer_key?: string[] }
): { question?: string[]; answer_key?: string[] } | undefined {
  if (!imgs) return undefined;
  const question = (imgs.question ?? []).map(withBase).filter(isStr);
  const answer_key = (imgs.answer_key ?? []).map(withBase).filter(isStr);
  const out: { question?: string[]; answer_key?: string[] } = {};
  if (question.length) out.question = question;
  if (answer_key.length) out.answer_key = answer_key;
  return Object.keys(out).length ? out : undefined;
}

/** გაირბენს მთელ ბანკს და გადააკრავს base-ს სურათების ბილიკებს (დალაგებული ტიპებით) */
function normalizeAssets(data: Question[]): Question[] {
  return data.map((q) => {
    if (q.type === "mcq") {
      const mcq = q as MCQ;
      const options: MCQOption[] = mcq.options.map((o) => ({
        ...o,
        image: withBase(o.image), // image?: string — OK თუ undefined იქნება
      }));
      return {
        ...mcq,
        options,
        images: normGroup(mcq.images),
      };
    } else if ((q as WrittenList).mode === "list") {
      const wl = q as WrittenList;
      return {
        ...wl,
        images: normGroup(wl.images),
      };
    } else {
      const ws = q as WrittenSingle;
      return {
        ...ws,
        images: normGroup(ws.images),
      };
    }
  });
}

export function useQuestionBank() {
  const [bank, setBank] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // IMPORTANT: BASE_URL რომ იმუშაოს GitHub Pages-ზე (/Quiz/)
        const base = (import.meta as any).env?.BASE_URL || "/";
        const url = `${base}questions.json`;

        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const raw = (await res.json()) as Question[];
          const data = normalizeAssets(raw);
          if (!cancelled) setBank(data);
          try {
            localStorage.setItem(STORAGE_KEYS.BANK_CACHE, JSON.stringify(data));
          } catch {}
          return;
        }

        // fallback: cache ან sample
        const cached = localStorage.getItem(STORAGE_KEYS.BANK_CACHE);
        if (cached) {
          const data = JSON.parse(cached) as Question[];
          if (!cancelled) setBank(data);
        } else {
          const data = normalizeAssets(SAMPLE_QUESTIONS as Question[]);
          if (!cancelled) setBank(data);
        }
      } catch (e: any) {
        const cached = localStorage.getItem(STORAGE_KEYS.BANK_CACHE);
        if (cached) {
          const data = JSON.parse(cached) as Question[];
          if (!cancelled) setBank(data);
        } else {
          const data = normalizeAssets(SAMPLE_QUESTIONS as Question[]);
          if (!cancelled) setBank(data);
        }
        setError("ვერ წავიკითხე questions.json — გამოიყენება sample/cached");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { bank, error };
}
