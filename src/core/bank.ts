import { STORAGE_KEYS } from "./config";
import type { Question } from "./types";
import { SAMPLE_QUESTIONS } from "../samples/sampleQuestions";
import { useEffect, useState } from "react";

export function useQuestionBank() {
  const [bank, setBank] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/questions.json", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Question[];
          if (!cancelled) setBank(data);
          localStorage.setItem(STORAGE_KEYS.BANK_CACHE, JSON.stringify(data));
          return;
        }
        const cached = localStorage.getItem(STORAGE_KEYS.BANK_CACHE);
        if (cached) setBank(JSON.parse(cached));
        else setBank(SAMPLE_QUESTIONS as Question[]);
      } catch (e: any) {
        const cached = localStorage.getItem(STORAGE_KEYS.BANK_CACHE);
        if (cached) setBank(JSON.parse(cached));
        else setBank(SAMPLE_QUESTIONS as Question[]);
        setError("ვერ წავიკითხე /questions.json — გამოიყენება sample");
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { bank, error };
}
