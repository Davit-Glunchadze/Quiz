import { useMemo } from "react";
import Pill from "./Pill";
import { scoreWrittenList, scoreWrittenSingle } from "../core/scoring";
import type { TestItem, MCQ, WrittenSingle, WrittenList } from "../core/types";

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function classifyByRatio(r: number) {
  if (r >= 0.85) return "correct" as const;
  if (r >= 0.60) return "partial" as const;
  return "wrong" as const;
}

export default function Results({
  items,
  elapsedSec,
}: {
  items: TestItem[];
  elapsedSec: number;
}) {
  // ვიანგარიშოთ მაქს ქულები დინამიურად (მთლიანი/ტიპების მიხედვით),
  // მიღებული ქულები და რაოდენობრივი სტატუსები.
  const summary = useMemo(() => {
    let totalMax = 0;
    let totalEarned = 0;

    let mcqMax = 0;
    let mcqEarned = 0;
    let mcqTotal = 0;
    let mcqCorrect = 0;

    let wrMax = 0;
    let wrEarned = 0;
    let wrTotal = 0;
    let wrCorrect = 0;
    let wrPartial = 0;
    let wrWrong = 0;

    for (const it of items) {
      const q = it.q;
      totalMax += q.points;

      if (q.type === "mcq") {
        mcqTotal += 1;
        mcqMax += q.points;
        const ok = it.mcqSelected === (q as MCQ).correct;
        const got = ok ? q.points : 0;
        totalEarned += got;
        mcqEarned += got;
        if (ok) mcqCorrect += 1;
      } else if ((q as WrittenSingle).mode === "single") {
        wrTotal += 1;
        wrMax += q.points;
        const { score, ratio } = scoreWrittenSingle(q as WrittenSingle, it.singleText ?? "");
        totalEarned += score;
        wrEarned += score;
        const cls = classifyByRatio(ratio ?? 0);
        if (cls === "correct") wrCorrect += 1;
        else if (cls === "partial") wrPartial += 1;
        else wrWrong += 1;
      } else {
        wrTotal += 1;
        wrMax += q.points;
        const wl = q as WrittenList;
        const { score, rows } = scoreWrittenList(wl, it.listAnswers ?? [], it.listHidden ?? []);
        totalEarned += score;
        wrEarned += score;
        const avgRatio = rows.length ? rows.reduce((a, r) => a + r.ratio, 0) / rows.length : 0;
        const cls = classifyByRatio(avgRatio);
        if (cls === "correct") wrCorrect += 1;
        else if (cls === "partial") wrPartial += 1;
        else wrWrong += 1;
      }
    }

    const mcqWrong = mcqTotal - mcqCorrect;

    // მრგვალებები ვიზუალისთვის
    const r2 = (x: number) => Math.round(x * 100) / 100;

    return {
      totalMax: r2(totalMax),
      totalEarned: r2(totalEarned),
      mcq: {
        max: r2(mcqMax),
        earned: r2(mcqEarned),
        total: mcqTotal,
        correct: mcqCorrect,
        wrong: mcqWrong,
      },
      written: {
        max: r2(wrMax),
        earned: r2(wrEarned),
        total: wrTotal,
        correct: wrCorrect,
        partial: wrPartial,
        wrong: wrWrong,
      },
    };
  }, [items]);

  return (
    <div className="border rounded-2xl p-4 space-y-4 shadow-sm">
      <div className="text-xl font-semibold">შედეგები</div>

      {/* ქულა */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill>ქულა: {summary.totalMax} / {summary.totalEarned}</Pill>
        <Pill>გავლილი დრო: {formatDuration(elapsedSec)}</Pill>
      </div>

      {/* MCQ + Written */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MCQ ბლოკი */}
        <div className="border rounded-xl p-3">
          <div className="font-medium mb-1">MCQ: {summary.mcq.max} / {summary.mcq.earned}</div>
          <ul className="text-sm leading-7">
            <li>— სულ: <span className="font-medium">{summary.mcq.total}</span></li>
            <li className="text-green-700">— სწორი: <span className="font-medium">{summary.mcq.correct}</span></li>
            <li className="text-red-700">— არასწორი: <span className="font-medium">{summary.mcq.wrong}</span></li>
          </ul>
        </div>

        {/* Written ბლოკი */}
        <div className="border rounded-xl p-3">
          <div className="font-medium mb-1">Written: {summary.written.max} / {summary.written.earned}</div>
          <ul className="text-sm leading-7">
            <li>— სულ: <span className="font-medium">{summary.written.total}</span></li>
            <li className="text-green-700">— სწორი: <span className="font-medium">{summary.written.correct}</span></li>
            <li className="text-amber-700">— ნახევრად სწორი: <span className="font-medium">{summary.written.partial}</span></li>
            <li className="text-red-700">— არასწორი: <span className="font-medium">{summary.written.wrong}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
