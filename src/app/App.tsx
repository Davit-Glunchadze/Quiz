import React, { useEffect, useMemo, useState } from "react";
import ProgressBar from "../components/ProgressBar";
import Pill from "../components/Pill";
import MCQView from "../components/MCQView";
import WrittenSingleView from "../components/WrittenSingleView";
import WrittenListView from "../components/WrittenListView";
import QuestionBank from "../components/QuestionBank";
import CountdownTimer from "../components/CountdownTimer";

import { TEST_CONFIG } from "../core/config";
import { scoreWrittenList, scoreWrittenSingle } from "../core/scoring";
import {
  buildBags,
  refillIfNeeded,
  saveBag,
  takeFromBag,
  partitionList,
} from "../core/selection";
import { useQuestionBank } from "../core/bank";
import type {
  MCQ,
  MCQOption,
  Question,
  TestItem,
  WrittenList,
  WrittenSingle,
} from "../core/types";
import { makeRNG, shuffleRng } from "../core/utils";
import type { RNG } from "../core/utils";

/** Arrange MCQ options with a fixed slot for the correct answer using seeded RNG. */
function prepareMCQOptions(q: MCQ, rng: RNG, desiredSlot: number): MCQOption[] {
  const opts = q.options.slice();
  const slot = Math.min(Math.max(desiredSlot || 1, 1), opts.length);
  const correctIndex = opts.findIndex((o) => o.id === q.correct);
  const correct = opts[correctIndex];
  const others = opts.filter((o) => o.id !== q.correct);
  const shuffledOthers = shuffleRng(others, rng);
  const arranged: MCQOption[] = Array.from(
    { length: opts.length },
    () => ({ id: "__placeholder__" } as MCQOption)
  );
  arranged[slot - 1] = correct;
  let k = 0;
  for (let i = 0; i < arranged.length; i++)
    if (arranged[i].id === "__placeholder__") arranged[i] = shuffledOthers[k++];
  return arranged;
}

type StartOptions =
  | { mode: "normal"; bank: Question[]; rng: RNG }
  | {
      mode: "practiceWrong";
      bank: Question[];
      lastItems: TestItem[];
      rng: RNG;
    };

function startTest(opts: StartOptions): TestItem[] {
  const { bank, rng } = opts;
  const { mcq: mcqBag0, written: wrBag0 } = buildBags(bank);
  const mcqIdsAll = bank.filter((q) => q.type === "mcq").map((q) => q.id);
  const wrIdsAll = bank.filter((q) => q.type === "written").map((q) => q.id);

  let mcqIds: number[] = [];
  let wrIds: number[] = [];

  if (opts.mode === "practiceWrong") {
    const wrongMCQ = opts.lastItems
      .filter(
        (it) => it.q.type === "mcq" && it.mcqSelected !== (it.q as MCQ).correct
      )
      .map((it) => it.q.id);

    const wrongSingle = opts.lastItems
      .filter(
        (it) =>
          it.q.type === "written" && (it.q as WrittenSingle).mode === "single"
      )
      .filter((it) => {
        const ws = it.q as WrittenSingle;
        const { score } = scoreWrittenSingle(ws, it.singleText ?? "");
        return score < ws.points - 1e-6;
      })
      .map((it) => it.q.id);

    const wrongList = opts.lastItems
      .filter(
        (it) => it.q.type === "written" && (it.q as WrittenList).mode === "list"
      )
      .filter((it) => {
        const wl = it.q as WrittenList;
        const { score } = scoreWrittenList(
          wl,
          it.listAnswers ?? [],
          it.listHidden ?? []
        );
        return score < wl.points - 1e-6;
      })
      .map((it) => it.q.id);

    const wrWrong = Array.from(new Set([...wrongSingle, ...wrongList]));

    mcqIds = shuffleRng(wrongMCQ, rng).slice(0, TEST_CONFIG.MCQ_PER_TEST);
    if (mcqIds.length < TEST_CONFIG.MCQ_PER_TEST) {
      const mcqBag = refillIfNeeded(
        mcqBag0,
        TEST_CONFIG.MCQ_PER_TEST - mcqIds.length,
        mcqIdsAll
      );
      const { taken } = takeFromBag(
        mcqBag,
        TEST_CONFIG.MCQ_PER_TEST - mcqIds.length
      );
      mcqIds = mcqIds.concat(taken);
    }

    wrIds = shuffleRng(wrWrong, rng).slice(0, TEST_CONFIG.WRITTEN_PER_TEST);
    if (wrIds.length < TEST_CONFIG.WRITTEN_PER_TEST) {
      const wrBag = refillIfNeeded(
        wrBag0,
        TEST_CONFIG.WRITTEN_PER_TEST - wrIds.length,
        wrIdsAll
      );
      const { taken } = takeFromBag(
        wrBag,
        TEST_CONFIG.WRITTEN_PER_TEST - wrIds.length
      );
      wrIds = wrIds.concat(taken);
    }
  } else {
    const mcqBag = refillIfNeeded(mcqBag0, TEST_CONFIG.MCQ_PER_TEST, mcqIdsAll);
    const wrBag = refillIfNeeded(
      wrBag0,
      TEST_CONFIG.WRITTEN_PER_TEST,
      wrIdsAll
    );
    const takenMcq = takeFromBag(mcqBag, TEST_CONFIG.MCQ_PER_TEST);
    const takenWr = takeFromBag(wrBag, TEST_CONFIG.WRITTEN_PER_TEST);
    mcqIds = takenMcq.taken;
    wrIds = takenWr.taken;
    saveBag("quiz.bag.mcq", takenMcq.rest);
    saveBag("quiz.bag.written", takenWr.rest);
  }

  const findById = (id: number) => bank.find((q) => q.id === id)!;

  const mcqItems: TestItem[] = mcqIds.map((id) => {
    const qq = findById(id) as MCQ;
    const slot = 1 + Math.floor(rng() * Math.max(1, qq.options.length));
    const prepared =
      qq.shuffleOptions === false
        ? qq.options.slice()
        : prepareMCQOptions(qq, rng, slot);
    return { q: qq, mcqDesiredSlot: slot, mcqOptionsPrepared: prepared };
  });

  const wrItems: TestItem[] = wrIds.map((id) => {
    const q = findById(id) as WrittenSingle | WrittenList;
    if ((q as WrittenList).mode === "list") {
      const wl = q as WrittenList;
      const { shown, hidden } = partitionList(wl, rng);
      return {
        q,
        listShown: shown,
        listHidden: hidden,
        listAnswers: new Array(hidden.length).fill(""),
      };
    }
    return { q, singleText: "" };
  });

  const items = [...mcqItems, ...wrItems];

  // --- Coverage bookkeeping (store served question IDs) ---
  try {
    const servedIds = items.map((it) => it.q.id);
    addCoverage(servedIds);
  } catch {
    /* noop */
  }

  return shuffleRng(items, rng);
}

const TWO_HOURS = 2 * 60 * 60;

// helper: seconds => HH:MM:SS
function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

// similarity thresholds
function statusFromRatio(r: number) {
  if (r >= 0.85) return { label: "სწორია", kind: "correct" as const };
  if (r >= 0.6) return { label: "ნახევრად სწორი", kind: "partial" as const };
  return { label: "არასწორია", kind: "wrong" as const };
}

// seed utils
function genSeed() {
  return `seed-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// --- Coverage storage (localStorage) ---
const COV_KEY = "quiz.coverage.v1";
function readCoverage(): Set<number> {
  try {
    const raw = localStorage.getItem(COV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}
function writeCoverage(s: Set<number>) {
  try {
    localStorage.setItem(COV_KEY, JSON.stringify(Array.from(s)));
  } catch {}
}
function addCoverage(ids: number[]) {
  const s = readCoverage();
  ids.forEach((id) => s.add(id));
  writeCoverage(s);
}
function clearCoverage() {
  try {
    localStorage.removeItem(COV_KEY);
  } catch {}
}

export default function App() {
  const { bank, error } = useQuestionBank();
  const [items, setItems] = useState<TestItem[] | null>(null);
  const [finished, setFinished] = useState(false);

  // seed state: empty string == OFF
  const [seed, setSeed] = useState<string>("");
  const seedEnabled = !!seed;

  const [remainingSec, setRemainingSec] = useState<number>(TWO_HOURS);
  const [ticking, setTicking] = useState<boolean>(false);
  const [timeUp, setTimeUp] = useState<boolean>(false);

  // Coverage computed state (for header display)
  const coverageSet = useMemo(() => readCoverage(), [items, finished]);
  const coverageCount = coverageSet.size;

  // timer
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setFinished(true);
          setTicking(false);
          setTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    if (finished) setTicking(false);
  }, [finished]);

  const progress = useMemo(() => {
    if (!items) return { answered: 0, total: 0 };
    let answered = 0;
    for (const it of items) {
      if (it.q.type === "mcq" && it.mcqSelected) answered++;
      else if (
        it.q.type === "written" &&
        (it.q as WrittenSingle).mode === "single" &&
        (it.singleText ?? "").trim()
      )
        answered++;
      else if (
        it.q.type === "written" &&
        (it.q as WrittenList).mode === "list" &&
        (it.listAnswers ?? []).some((v) => (v ?? "").trim())
      )
        answered++;
    }
    return { answered, total: items.length };
  }, [items]);

  // summary stats
  const stats = useMemo(() => {
    if (!items || !finished) return null;

    let totalMax = 0;
    let totalEarned = 0;

    let mcqMax = 0,
      mcqEarned = 0,
      mcqTotal = 0,
      mcqCorrect = 0,
      mcqWrong = 0;
    let wrMax = 0,
      wrEarned = 0,
      wrTotal = 0,
      wrCorrect = 0,
      wrPartial = 0,
      wrWrong = 0;

    const details: { id: number; got: number; max: number }[] = [];

    for (const it of items) {
      const q = it.q;

      if (q.type === "mcq") {
        mcqTotal++;
        mcqMax += q.points;
        const got = it.mcqSelected === q.correct ? q.points : 0;
        mcqEarned += got;
        details.push({ id: q.id, got, max: q.points });
        if (got === q.points) mcqCorrect++;
        else mcqWrong++;
      } else if ((q as WrittenSingle).mode === "single") {
        wrTotal++;
        const ws = q as WrittenSingle;
        wrMax += ws.points;
        const { score, ratio } = scoreWrittenSingle(ws, it.singleText ?? "");
        wrEarned += score;
        details.push({ id: ws.id, got: score, max: ws.points });

        const st = statusFromRatio(ratio ?? 0);
        if (st.kind === "correct") wrCorrect++;
        else if (st.kind === "partial") wrPartial++;
        else wrWrong++;
      } else {
        wrTotal++;
        const wl = q as WrittenList;
        wrMax += wl.points;
        const scored = scoreWrittenList(
          wl,
          it.listAnswers ?? [],
          it.listHidden ?? []
        );
        wrEarned += scored.score;
        details.push({ id: wl.id, got: scored.score, max: wl.points });

        const avgRatio = scored.rows.length
          ? scored.rows.reduce((a, r) => a + r.ratio, 0) / scored.rows.length
          : 0;
        const st = statusFromRatio(avgRatio);
        if (st.kind === "correct") wrCorrect++;
        else if (st.kind === "partial") wrPartial++;
        else wrWrong++;
      }
    }

    totalMax = mcqMax + wrMax;
    totalEarned = Math.round((mcqEarned + wrEarned) * 100) / 100;

    // round for display
    mcqEarned = Math.round(mcqEarned * 100) / 100;
    wrEarned = Math.round(wrEarned * 100) / 100;

    return {
      overall: { max: totalMax, earned: totalEarned },
      mcq: {
        max: mcqMax,
        earned: mcqEarned,
        total: mcqTotal,
        correct: mcqCorrect,
        wrong: mcqWrong,
      },
      written: {
        max: wrMax,
        earned: wrEarned,
        total: wrTotal,
        correct: wrCorrect,
        partial: wrPartial,
        wrong: wrWrong,
      },
      details,
    };
  }, [items, finished]);

  if (!bank) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-2xl font-semibold mb-2">
          ტესტის აპი (იტვირთება…)
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    );
  }

  const rng = makeRNG(seedEnabled ? seed : null);

  const canPracticeWrong = !!(
    items &&
    finished &&
    items.some((it) => {
      if (it.q.type === "mcq") return it.mcqSelected !== (it.q as MCQ).correct;
      if ((it.q as WrittenSingle).mode === "single") {
        const ws = it.q as WrittenSingle;
        const { score } = scoreWrittenSingle(ws, it.singleText ?? "");
        return score < ws.points - 1e-6;
      }
      const wl = it.q as WrittenList;
      const { score } = scoreWrittenList(
        wl,
        it.listAnswers ?? [],
        it.listHidden ?? []
      );
      return score < wl.points - 1e-6;
    })
  );

  const inputsDisabled = finished || remainingSec <= 0;
  const elapsedSec = TWO_HOURS - remainingSec;

  return (
    <div className="p-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b">
        {/* Top ribbon */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                QZ
              </div>
              <div>
                <div className="text-lg font-semibold leading-tight">
                  სავარჯიშო ქვიზი
                </div>
                <div className="text-xs text-blue-100">
                  25 ტესტური + 10 საწერი = 100 ქულა
                </div>
              </div>
            </div>
            <div className="hidden xl:flex items-center gap-3 text-sm text-blue-100">
              <span className="opacity-90">კითხვა-ბანკი: {bank.length}</span>
              {/* Coverage in header */}
              <span className="px-2 py-0.5 rounded bg-white/15">
                Coverage: {coverageCount} / {bank.length}
              </span>
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          {/* TIMER */}
          {items && !finished ? (
            <CountdownTimer remainingSec={remainingSec} totalSec={TWO_HOURS} />
          ) : (
            <div className="px-3 py-1 rounded-xl text-sm border bg-neutral-50 text-neutral-700">
              დრო: 02:00:00
            </div>
          )}

          {/* Seed toggle + actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-2 rounded-xl border cursor-pointer transition
                ${
                  seedEnabled
                    ? "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700"
                    : "hover:bg-neutral-50"
                }`}
                onClick={() => {
                  if (items && !finished) return;
                  setSeed((prev) => (prev ? "" : genSeed()));
                }}
                disabled={!!items && !finished}
                title={
                  seedEnabled
                    ? "Seed გათიშვა"
                    : "Seed ჩართვა (დეტერმინისტული ვერსია)"
                }
              >
                Seed: {seedEnabled ? "ON" : "OFF"}
              </button>

              {seedEnabled && (
                <>
                  <span className="text-xs text-neutral-500 select-all">
                    {seed}
                  </span>
                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-neutral-50 cursor-pointer"
                    onClick={() => {
                      if (items && !finished) return;
                      setSeed(genSeed());
                    }}
                    disabled={!!items && !finished}
                    title="ახალი seed"
                  >
                    Regenerate
                  </button>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm"
                onClick={() => {
                  setItems(startTest({ mode: "normal", bank, rng }));
                  setFinished(false);
                  setRemainingSec(TWO_HOURS);
                  setTimeUp(false);
                  setTicking(true);
                  window.scrollTo({ top: 0 });
                }}
                disabled={!!items && !finished}
                title="ახალი ტესტის დაწყება"
              >
                ტესტის დაწყება
              </button>

              {/* Reset rotation with tooltip + confirm */}
              <button
                className="relative px-4 py-2 rounded-xl border hover:bg-red-50 cursor-pointer group"
                onClick={() => {
                  if (items && !finished) return;
                  const ok = window.confirm(
                    "დარწმუნებული ხარ? როტაციის ისტორია და დაფიქსირებული coverage გასუფთავდება."
                  );
                  if (!ok) return;
                  localStorage.removeItem("quiz.bag.mcq");
                  localStorage.removeItem("quiz.bag.written");
                  clearCoverage();
                }}
                disabled={!!items && !finished}
                title="როტაციის ისტორიის განულება (coverage-თან ერთად)"
              >
                Reset rotation
                <span className="absolute -bottom-8 left-0 scale-0 group-hover:scale-100 transition origin-top-left text-xs bg-black/80 text-white px-2 py-1 rounded">
                  განულდება როტაცია და coverage
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Time up banner */}
        {timeUp && (
          <div className="bg-red-600">
            <div className="max-w-6xl mx-auto px-6 py-2 text-white text-sm font-medium">
              დრო ამოიწურა — ტესტის გაგრძელება შეუძლებელია. შეგიძლიათ მხოლოდ
              შედეგების ნახვა/რევიუ.
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {items ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ProgressBar value={progress.answered} max={items.length} />
              <div className="text-sm w-24 text-right">
                {progress.answered}/{items.length}
              </div>
            </div>

            <ol className="space-y-6">
              {items.map((it, idx) => (
                <li key={idx} className="border rounded-2xl p-4 shadow-sm">
                  <div className="mb-2 text-neutral-500 flex items-center justify-between">
                    <span>
                      #{idx + 1} •{" "}
                      <Pill>
                        {it.q.type === "mcq" ? "ტესტური (2 ქ)" : "საწერი (5 ქ)"}
                      </Pill>
                    </span>
                    {inputsDisabled && <Pill>დაბლოკილია</Pill>}
                  </div>

                  {it.q.type === "mcq" ? (
                    <MCQView
                      q={it.q as MCQ}
                      selected={it.mcqSelected}
                      preparedOptions={it.mcqOptionsPrepared}
                      onAnswer={(optionId) => {
                        if (inputsDisabled) return;
                        setItems((prev) =>
                          prev!.map((x, i) =>
                            i === idx ? { ...x, mcqSelected: optionId } : x
                          )
                        );
                      }}
                      disabled={inputsDisabled}
                    />
                  ) : (it.q as WrittenSingle).mode === "single" ? (
                    <WrittenSingleView
                      q={it.q as WrittenSingle}
                      value={it.singleText ?? ""}
                      onChange={(v) => {
                        if (inputsDisabled) return;
                        setItems((prev) =>
                          prev!.map((x, i) =>
                            i === idx ? { ...x, singleText: v } : x
                          )
                        );
                      }}
                      disabled={inputsDisabled}
                    />
                  ) : (
                    <WrittenListView
                      q={it.q as WrittenList}
                      shownItems={it.listShown ?? []}
                      hiddenItems={it.listHidden ?? []}
                      answers={it.listAnswers ?? []}
                      setAnswer={(i, v) => {
                        if (inputsDisabled) return;
                        setItems((prev) =>
                          prev!.map((x, ii) =>
                            ii === idx
                              ? {
                                  ...x,
                                  listAnswers: (x.listAnswers ?? []).map(
                                    (a, ai) => (ai === i ? v : a)
                                  ),
                                }
                              : x
                          )
                        );
                      }}
                      disabled={inputsDisabled}
                    />
                  )}
                </li>
              ))}
            </ol>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-neutral-600">
                შენიშვნა: საწერი პასუხები ფასდება „მომსგავსებლობით“ — ზუსტად არ
                დაემთხვეს, მაგრამ აზრობრივად ახლოა → ჩაითვლება
                ნაწილობრივ/სრულად.
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                  onClick={() => setFinished(true)}
                  disabled={finished}
                >
                  დასრულება
                </button>

                {finished && canPracticeWrong && (
                  <button
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                    onClick={() => {
                      if (!items) return;
                      setItems(
                        startTest({
                          mode: "practiceWrong",
                          bank,
                          lastItems: items,
                          rng,
                        })
                      );
                      setFinished(false);
                      setRemainingSec(TWO_HOURS);
                      setTimeUp(false);
                      setTicking(true);
                      window.scrollTo({ top: 0 });
                    }}
                    title="ახალი ტესტი შედგება მაქსიმალურად იმ კითხვებით, რომლებზეც შეცდი"
                  >
                    ხელახლა ვივარჯიშო (არასწორებით)
                  </button>
                )}
              </div>
            </div>

            {/* RESULTS */}
            {finished && stats && (
              <div className="space-y-4">
                {/* Overall summary line */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold">
                    ქულა:{" "}
                    <span className="text-neutral-500">
                      {stats.overall.max}
                    </span>{" "}
                    /{" "}
                    <span className="text-green-700">
                      {stats.overall.earned}
                    </span>
                  </div>
                  <Pill>გავლილი დრო: {formatDuration(elapsedSec)}</Pill>
                  {/* Coverage quick glance */}
                  <Pill>
                    Coverage: {coverageCount} / {bank.length}
                  </Pill>
                </div>

                {/* Two cards side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* MCQ Card */}
                  <div className="rounded-2xl border shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-blue-600 text-white font-semibold">
                      MCQ
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="text-lg">
                        MCQ:{" "}
                        <span className="text-neutral-500">
                          {stats.mcq.max}
                        </span>{" "}
                        /{" "}
                        <span className="text-blue-700 font-semibold">
                          {stats.mcq.earned}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-center">
                          <div className="text-xs text-green-700">სწორი</div>
                          <div className="text-lg font-semibold text-green-800">
                            {stats.mcq.correct}
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-center">
                          <div className="text-xs text-red-700">არასწორი</div>
                          <div className="text-lg font-semibold text-red-800">
                            {stats.mcq.wrong}
                          </div>
                        </div>
                        <div className="rounded-lg bg-neutral-50 border p-2 text-center">
                          <div className="text-xs text-neutral-600">სულ</div>
                          <div className="text-lg font-semibold text-neutral-800">
                            {stats.mcq.total}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Written Card */}
                  <div className="rounded-2xl border shadow-სმ overflow-hidden">
                    <div className="px-4 py-3 bg-emerald-600 text-white font-semibold">
                      Written
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="text-lg">
                        Written:{" "}
                        <span className="text-neutral-500">
                          {stats.written.max}
                        </span>{" "}
                        /{" "}
                        <span className="text-emerald-700 font-semibold">
                          {stats.written.earned}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-center">
                          <div className="text-xs text-green-700">სწორი</div>
                          <div className="text-lg font-semibold text-green-800">
                            {stats.written.correct}
                          </div>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
                          <div className="text-xs text-amber-700">
                            ნახევრად სწორი
                          </div>
                          <div className="text-lg font-semibold text-amber-800">
                            {stats.written.partial}
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-center">
                          <div className="text-xs text-red-700">არასწორი</div>
                          <div className="text-lg font-semibold text-red-800">
                            {stats.written.wrong}
                          </div>
                        </div>
                        <div className="rounded-lg bg-neutral-50 border p-2 text-center">
                          <div className="text-xs text-neutral-600">სულ</div>
                          <div className="text-lg font-semibold text-neutral-800">
                            {stats.written.total}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed scores — now COLLAPSED by default */}
                <div className="border rounded-2xl p-4 space-y-3 shadow-sm">
                  <details>
                    <summary className="cursor-pointer text-sm text-neutral-700">
                      დეტალური ქულები
                    </summary>
                    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {stats.details.map((d) => (
                        <li
                          key={d.id}
                          className="border rounded-xl p-2 flex items-center justify-between"
                        >
                          <span>#{d.id}</span>
                          <span>
                            {d.got} / {d.max}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>

                {/* Coverage details (collapsed) */}
                <div className="border rounded-2xl p-4 space-y-3 shadow-sm">
                  <details>
                    <summary className="cursor-pointer text-sm text-neutral-700">
                      Coverage details (რომელი არ გამოჩენილა ჯერ)
                    </summary>
                    <div className="mt-2 text-sm">
                      {(() => {
                        const allIds = new Set<number>(bank.map((q) => q.id));
                        const missing = Array.from(allIds)
                          .filter((id) => !coverageSet.has(id))
                          .sort((a, b) => a - b);
                        if (missing.length === 0) {
                          return (
                            <div className="text-green-700">
                              ყოველი კითხვა გამოყენებულია ✔
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            <div className="text-neutral-700">
                              დარჩენილი: {missing.length}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {missing.map((id) => (
                                <span
                                  key={id}
                                  className="px-2 py-1 text-xs rounded bg-neutral-100 border"
                                >
                                  {id}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </details>
                </div>

                {/* Review block (სხვა ნაწილი უცვლელია) */}
                <div className="border rounded-2xl p-4 shadow-sm">
                  <details open>
                    <summary className="cursor-pointer text-sm text-neutral-700">
                      რევიუ: ჩემი პასუხები vs სწორი
                    </summary>
                    <ol className="mt-3 space-y-4">
                      {items!.map((it) => {
                        const q = it.q;
                        let headerStatus: {
                          label: string;
                          kind: "correct" | "partial" | "wrong";
                        } = { label: "არასწორი", kind: "wrong" };
                        let reviewBlock: React.ReactNode = null;

                        if (q.type === "mcq") {
                          const mcq = q as MCQ;
                          const isCorrect = it.mcqSelected === mcq.correct;
                          headerStatus = {
                            label: isCorrect ? "სწორი" : "არასწორი",
                            kind: isCorrect ? "correct" : "wrong",
                          };
                          reviewBlock = (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {mcq.options.map((o) => {
                                  const isSel = it.mcqSelected === o.id;
                                  const isCor = mcq.correct === o.id;
                                  const base = "border rounded-lg p-2 relative";
                                  const cls = isCor
                                    ? `${base} border-green-600 ring-1 ring-green-400`
                                    : isSel
                                    ? `${base} border-red-500 ring-1 ring-red-300`
                                    : `${base}`;
                                  return (
                                    <div key={o.id} className={cls}>
                                      {o.image ? (
                                        <img
                                          src={o.image}
                                          alt={o.alt ?? "opt"}
                                          className="h-24 w-full object-contain"
                                        />
                                      ) : (
                                        <div className="text-center font-medium">
                                          {o.text}
                                        </div>
                                      )}
                                      {isCor && (
                                        <span className="absolute top-1 left-1 text-xs bg-green-600 text-white px-1 rounded">
                                          სწორი
                                        </span>
                                      )}
                                      {isSel && !isCor && (
                                        <span className="absolute top-1 left-1 text-xs bg-red-600 text-white px-1 rounded">
                                          ჩემი არჩევანი
                                        </span>
                                      )}
                                      {isSel && isCor && (
                                        <span className="absolute top-1 left-1 text-xs bg-green-600 text-white px-1 rounded">
                                          ჩემი არჩევანი ✓
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else if ((q as WrittenSingle).mode === "single") {
                          const ws = q as WrittenSingle;
                          const { score, ratio } = scoreWrittenSingle(
                            ws,
                            it.singleText ?? ""
                          );
                          const st = statusFromRatio(ratio ?? 0);
                          headerStatus = st;

                          reviewBlock = (
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-2 flex-wrap">
                                <Pill>
                                  მსგავსება ~ {Math.round((ratio ?? 0) * 100)}%
                                </Pill>
                                <Pill>
                                  ქულა: {score} / {ws.points}
                                </Pill>
                              </div>
                              <div>
                                <span className="font-medium">
                                  თქვენი პასუხი:
                                </span>{" "}
                                <span
                                  className={`px-2 py-0.5 rounded ${
                                    st.kind === "correct"
                                      ? "bg-green-50"
                                      : st.kind === "partial"
                                      ? "bg-yellow-50"
                                      : "bg-red-50"
                                  }`}
                                >
                                  {(it.singleText ?? "").trim() || "—"}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">
                                  სწორი ვარიანტები:
                                </span>{" "}
                                {ws.answer_variants.join(", ")}
                              </div>
                            </div>
                          );
                        } else {
                          const wl = q as WrittenList;
                          const hidden = it.listHidden ?? [];
                          const answers = it.listAnswers ?? [];
                          const scored = scoreWrittenList(wl, answers, hidden);
                          const avgRatio = scored.rows.length
                            ? scored.rows.reduce((a, r) => a + r.ratio, 0) /
                              scored.rows.length
                            : 0;
                          const st = statusFromRatio(avgRatio);
                          headerStatus = st;

                          reviewBlock = (
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-2 flex-wrap">
                                <Pill>
                                  საშ. მსგავსება ~ {Math.round(avgRatio * 100)}%
                                </Pill>
                                <Pill>
                                  ქულა: {scored.score} / {wl.points}
                                </Pill>
                              </div>
                              {it.listShown && it.listShown.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  <span className="font-medium">
                                    ნაჩვენები 25%:
                                  </span>{" "}
                                  {it.listShown.map((s, i) => (
                                    <Pill key={i}>{s.value}</Pill>
                                  ))}
                                </div>
                              )}
                              <div className="overflow-auto">
                                <table className="w-full text-sm border">
                                  <thead>
                                    <tr className="bg-neutral-50">
                                      <th className="p-2 text-left">#</th>
                                      <th className="p-2 text-left">
                                        თქვენი პასუხი
                                      </th>
                                      <th className="p-2 text-left">
                                        სწორი პასუხი
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {scored.rows.map((row, i) => (
                                      <tr
                                        key={i}
                                        className={
                                          row.okFull
                                            ? "bg-green-50"
                                            : row.ratio >= 0.6
                                            ? "bg-yellow-50"
                                            : "bg-red-50"
                                        }
                                      >
                                        <td className="p-2">{i + 1}</td>
                                        <td className="p-2">
                                          {row.user || "—"}
                                        </td>
                                        <td className="p-2">{row.expected}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <li key={q.id} className="border rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium">
                                #{q.id} · {q.text}
                              </div>
                              <Pill>{headerStatus.label}</Pill>
                            </div>
                            {reviewBlock}
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                </div>

                {/* --- RED DIVIDER --- */}
                <div className="relative my-8">
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-400 to-transparent" />
                  <div className="absolute inset-x-0 -top-3 flex justify-center">
                    <span className="px-3 py-1 text-xs rounded-full border border-red-300 bg-red-50 text-red-700 shadow-sm">
                      სასწავლო ბლოკი
                    </span>
                  </div>
                </div>

                <QuestionBank bank={bank} />
              </div>
            )}
          </div>
        ) : (
          <QuestionBank bank={bank} />
        )}
      </div>
    </div>
  );
}
