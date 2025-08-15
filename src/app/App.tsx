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
import { buildBags, refillIfNeeded, saveBag, takeFromBag, partitionList } from "../core/selection";
import { useQuestionBank } from "../core/bank";
import type { MCQ, MCQOption, Question, TestItem, WrittenList, WrittenSingle } from "../core/types";
import type { RNG } from "../core/utils";
import { makeRNG, shuffleRng } from "../core/utils";

/** Arrange MCQ options with a fixed slot for the correct answer using seeded RNG. */
function prepareMCQOptions(q: MCQ, rng: RNG, desiredSlot: number): MCQOption[] {
  const opts = q.options.slice();
  const slot = Math.min(Math.max(desiredSlot || 1, 1), opts.length);
  const correctIndex = opts.findIndex(o => o.id === q.correct);
  const correct = opts[correctIndex];
  const others = opts.filter(o => o.id !== q.correct);
  const shuffledOthers = shuffleRng(others, rng);
  const arranged: MCQOption[] = Array.from({ length: opts.length }, () => ({ id: "__placeholder__" } as MCQOption));
  arranged[slot - 1] = correct;
  let k = 0;
  for (let i = 0; i < arranged.length; i++) if (arranged[i].id === "__placeholder__") arranged[i] = shuffledOthers[k++];
  return arranged;
}

type StartOptions =
  | { mode: "normal"; bank: Question[]; rng: RNG }
  | { mode: "practiceWrong"; bank: Question[]; lastItems: TestItem[]; rng: RNG };

function startTest(opts: StartOptions): TestItem[] {
  const { bank, rng } = opts;
  const { mcq: mcqBag0, written: wrBag0 } = buildBags(bank);
  const mcqIdsAll = bank.filter(q => q.type === "mcq").map(q => q.id);
  const wrIdsAll = bank.filter(q => q.type === "written").map(q => q.id);

  let mcqIds: number[] = [];
  let wrIds: number[] = [];

  if (opts.mode === "practiceWrong") {
    const wrongMCQ = opts.lastItems
      .filter(it => it.q.type === "mcq" && it.mcqSelected !== (it.q as MCQ).correct)
      .map(it => it.q.id);

    const wrongSingle = opts.lastItems
      .filter(it => it.q.type === "written" && (it.q as WrittenSingle).mode === "single")
      .filter(it => {
        const ws = it.q as WrittenSingle;
        const { score } = scoreWrittenSingle(ws, it.singleText ?? "");
        return score < ws.points - 1e-6;
      })
      .map(it => it.q.id);

    const wrongList = opts.lastItems
      .filter(it => it.q.type === "written" && (it.q as WrittenList).mode === "list")
      .filter(it => {
        const wl = it.q as WrittenList;
        const { score } = scoreWrittenList(wl, it.listAnswers ?? [], it.listHidden ?? []);
        return score < wl.points - 1e-6;
      })
      .map(it => it.q.id);

    const wrWrong = Array.from(new Set([...wrongSingle, ...wrongList]));

    // Limit to quotas and fill from rotation if not enough
    mcqIds = shuffleRng(wrongMCQ, rng).slice(0, TEST_CONFIG.MCQ_PER_TEST);
    if (mcqIds.length < TEST_CONFIG.MCQ_PER_TEST) {
      const mcqBag = refillIfNeeded(mcqBag0, TEST_CONFIG.MCQ_PER_TEST - mcqIds.length, mcqIdsAll);
      const { taken } = takeFromBag(mcqBag, TEST_CONFIG.MCQ_PER_TEST - mcqIds.length);
      mcqIds = mcqIds.concat(taken);
    }

    wrIds = shuffleRng(wrWrong, rng).slice(0, TEST_CONFIG.WRITTEN_PER_TEST);
    if (wrIds.length < TEST_CONFIG.WRITTEN_PER_TEST) {
      const wrBag = refillIfNeeded(wrBag0, TEST_CONFIG.WRITTEN_PER_TEST - wrIds.length, wrIdsAll);
      const { taken } = takeFromBag(wrBag, TEST_CONFIG.WRITTEN_PER_TEST - wrIds.length);
      wrIds = wrIds.concat(taken);
    }
  } else {
    // Normal mode: take from rotation
    const mcqBag = refillIfNeeded(mcqBag0, TEST_CONFIG.MCQ_PER_TEST, mcqIdsAll);
    const wrBag = refillIfNeeded(wrBag0, TEST_CONFIG.WRITTEN_PER_TEST, wrIdsAll);
    const takenMcq = takeFromBag(mcqBag, TEST_CONFIG.MCQ_PER_TEST);
    const takenWr = takeFromBag(wrBag, TEST_CONFIG.WRITTEN_PER_TEST);
    mcqIds = takenMcq.taken;
    wrIds = takenWr.taken;
    saveBag("quiz.bag.mcq", takenMcq.rest);
    saveBag("quiz.bag.written", takenWr.rest);
  }

  const findById = (id: number) => bank.find(q => q.id === id)!;

  const mcqItems: TestItem[] = mcqIds.map(id => {
    const qq = findById(id) as MCQ;
    const slot = 1 + Math.floor(rng() * Math.max(1, qq.options.length));
    const prepared = (qq.shuffleOptions === false)
      ? qq.options.slice()
      : prepareMCQOptions(qq, rng, slot);
    return { q: qq, mcqDesiredSlot: slot, mcqOptionsPrepared: prepared };
  });

  const wrItems: TestItem[] = wrIds.map(id => {
    const q = findById(id) as WrittenSingle | WrittenList;
    if ((q as WrittenList).mode === "list") {
      const wl = q as WrittenList;
      const { shown, hidden } = partitionList(wl, rng);
      return { q, listShown: shown, listHidden: hidden, listAnswers: new Array(hidden.length).fill("") };
    }
    return { q, singleText: "" };
  });

  // Seeded order of final items
  const items = [...mcqItems, ...wrItems];
  return shuffleRng(items, rng);
}

const TWO_HOURS = 2 * 60 * 60; // წამებში

// --- helper to format seconds as HH:MM:SS ---
function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export default function App() {
  const { bank, error } = useQuestionBank();
  const [items, setItems] = useState<TestItem[] | null>(null);
  const [finished, setFinished] = useState(false);

  const [seed, setSeed] = useState<string>(""); // empty => random Math.random()

  // TIMER state
  const [remainingSec, setRemainingSec] = useState<number>(TWO_HOURS);
  const [ticking, setTicking] = useState<boolean>(false);
  const [timeUp, setTimeUp] = useState<boolean>(false); // დრო ამოიწურა banner

  // Tick effect
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      setRemainingSec(prev => {
        if (prev <= 1) {
          clearInterval(id);
          // time up -> auto-finish and freeze UI + alert banner
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

  // ხელით დასრულებისას — ტაიმერი გაჩერდეს
  useEffect(() => {
    if (finished) setTicking(false);
  }, [finished]);

  const progress = useMemo(() => {
    if (!items) return { answered: 0, total: 0 };
    let answered = 0;
    for (const it of items) {
      if (it.q.type === "mcq" && it.mcqSelected) answered++;
      else if (it.q.type === "written" && (it.q as WrittenSingle).mode === "single" && (it.singleText ?? "").trim()) answered++;
      else if (it.q.type === "written" && (it.q as WrittenList).mode === "list" && (it.listAnswers ?? []).some(v => (v ?? "").trim())) answered++;
    }
    return { answered, total: items.length };
  }, [items]);

  const stats = useMemo(() => {
    if (!items || !finished) return null;
    let earned = 0, correctCount = 0, wrongCount = 0;
    let mcqEarned = 0, writtenEarned = 0;
    const details: { id: number; got: number; max: number }[] = [];

    for (const it of items) {
      const q = it.q;
      if (q.type === "mcq") {
        const got = it.mcqSelected === q.correct ? q.points : 0;
        earned += got; mcqEarned += got;
        if (got === q.points) correctCount++; else wrongCount++;
        details.push({ id: q.id, got, max: q.points });
      } else if ((q as WrittenSingle).mode === "single") {
        const ws = q as WrittenSingle;
        const { score } = scoreWrittenSingle(ws, it.singleText ?? "");
        earned += score; writtenEarned += score;
        if (score >= ws.points - 1e-6) correctCount++; else wrongCount++;
        details.push({ id: q.id, got: score, max: q.points });
      } else {
        const wl = q as WrittenList;
        const { score } = scoreWrittenList(wl, it.listAnswers ?? [], it.listHidden ?? []);
        earned += score; writtenEarned += score;
        if (score >= wl.points - 1e-6) correctCount++; else wrongCount++;
        details.push({ id: q.id, got: score, max: q.points });
      }
    }

    return {
      total: TEST_CONFIG.TOTAL_POINTS,
      earned: Math.round(earned * 100) / 100,
      correctCount,
      wrongCount,
      byType: { mcq: mcqEarned, written: writtenEarned },
      details,
    };
  }, [items, finished]);

  if (!bank) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-2xl font-semibold mb-2">ტესტის აპი (იტვირთება…)</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    );
  }

  const rng = makeRNG(seed.trim() || null);

  const canPracticeWrong = !!(items && finished && items.some(it => {
    if (it.q.type === "mcq") return it.mcqSelected !== (it.q as MCQ).correct;
    if ((it.q as WrittenSingle).mode === "single") {
      const ws = it.q as WrittenSingle;
      const { score } = scoreWrittenSingle(ws, it.singleText ?? "");
      return score < ws.points - 1e-6;
    }
    const wl = it.q as WrittenList;
    const { score } = scoreWrittenList(wl, it.listAnswers ?? [], it.listHidden ?? []);
    return score < wl.points - 1e-6;
  }));

  const inputsDisabled = finished || remainingSec <= 0;

  // --- elapsed time in seconds (for results) ---
  const elapsedSec = TWO_HOURS - remainingSec;

  return (
    <div className="p-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b">
        {/* Top ribbon */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">QZ</div>
              <div>
                <div className="text-lg font-semibold leading-tight">სავარჯიშო ქვიზი</div>
                <div className="text-xs text-blue-100">25 ტესტური + 10 საწერი = 100 ქულა</div>
              </div>
            </div>
            <div className="hidden sm:block text-sm text-blue-100">
              კითხვა-ბანკი: {bank.length}
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          {/* TIMER */}
          {items && !finished ? (
            <CountdownTimer remainingSec={remainingSec} totalSec={TWO_HOURS} />
          ) : (
            <div className="px-3 py-1 rounded-xl text-sm border bg-neutral-50 text-neutral-700">დრო: 02:00:00</div>
          )}

          {/* Seed controls + actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2">
              <input
                className="border rounded-xl px-3 py-2 w-48"
                placeholder="Seed (არჩევითი)"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                disabled={!!items && !finished}
              />
              <button
                className="px-3 py-2 rounded-xl border hover:bg-neutral-50 cursor-pointer"
                onClick={() => setSeed("")}
                disabled={!!items && !finished}
                title="Seed გაუქმდება და შერჩევა გახდება შემთხვევითი"
              >
                Clear seed
              </button>
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
                title={items && !finished ? "მიმდინარე ტესტი ჯერ არ დასრულებულა" : "ახალი ტესტის დაწყება"}
              >
                ტესტის დაწყება
              </button>
              <button
                className="px-4 py-2 rounded-xl border hover:bg-neutral-50 cursor-pointer"
                onClick={() => { localStorage.removeItem("quiz.bag.mcq"); localStorage.removeItem("quiz.bag.written"); }}
                title="როტაციის ისტორიის განულება"
                disabled={!!items && !finished}
              >
                Reset rotation
              </button>
            </div>
          </div>
        </div>

        {/* Time up banner */}
        {timeUp && (
          <div className="bg-red-600">
            <div className="max-w-6xl mx-auto px-6 py-2 text-white text-sm font-medium">
              დრო ამოიწურა — ტესტის გაგრძელება შეუძლებელია. შეგიძლიათ მხოლოდ შედეგების ნახვა/რევიუ.
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
              <div className="text-sm w-24 text-right">{progress.answered}/{items.length}</div>
            </div>

            <ol className="space-y-6">
              {items.map((it, idx) => (
                <li key={idx} className="border rounded-2xl p-4 shadow-sm">
                  <div className="mb-2 text-neutral-500 flex items-center justify-between">
                    <span>#{idx + 1} • <Pill>{it.q.type === 'mcq' ? 'ტესტური (2 ქ)' : 'საწერი (5 ქ)'}</Pill></span>
                    {inputsDisabled && <Pill>დაბლოკილია</Pill>}
                  </div>
                  {it.q.type === "mcq" ? (
                    <MCQView
                      q={it.q as MCQ}
                      selected={it.mcqSelected}
                      preparedOptions={it.mcqOptionsPrepared}
                      onAnswer={(optionId) => {
                        if (inputsDisabled) return;
                        setItems(prev => prev!.map((x, i) => i === idx ? { ...x, mcqSelected: optionId } : x));
                      }}
                      disabled={inputsDisabled}
                    />
                  ) : (it.q as WrittenSingle).mode === "single" ? (
                    <WrittenSingleView
                      q={it.q as WrittenSingle}
                      value={it.singleText ?? ""}
                      onChange={(v) => {
                        if (inputsDisabled) return;
                        setItems(prev => prev!.map((x, i) => i === idx ? { ...x, singleText: v } : x));
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
                        setItems(prev => prev!.map((x, ii) => ii === idx ? { ...x, listAnswers: (x.listAnswers ?? []).map((a, ai) => ai === i ? v : a) } : x));
                      }}
                      disabled={inputsDisabled}
                    />
                  )}
                </li>
              ))}
            </ol>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-neutral-600">შენიშვნა: საწერი პასუხები ფასდება „მომსგავსებლობით“ — ზუსტად არ დაემთხვეს, მაგრამ აზრობრივად ახლოა → ჩაითვლება ნაწილობრივ/სრულად.</div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                  onClick={() => setFinished(true)}
                  disabled={finished}
                >დასრულება</button>

                {finished && canPracticeWrong && (
                  <button
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                    onClick={() => {
                      if (!items) return;
                      setItems(startTest({ mode: "practiceWrong", bank, lastItems: items, rng }));
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

            {finished && stats && (
              <div className="border rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="text-xl font-semibold">შედეგები</div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Pill>ქულა: {stats.earned} / {TEST_CONFIG.TOTAL_POINTS}</Pill>
                  <Pill>სწორი: {stats.correctCount}</Pill>
                  <Pill>არასწორი: {stats.wrongCount}</Pill>
                  <Pill>MCQ: {stats.byType.mcq}</Pill>
                  <Pill>Written: {stats.byType.written}</Pill>
                  {/* NEW: elapsed time */}
                  <Pill>გავლილი დრო: {formatDuration(elapsedSec)}</Pill>
                </div>

                <div className="mt-3">
                  <details>
                    <summary className="cursor-pointer text-sm text-neutral-700">დეტალური ქულები</summary>
                    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {stats.details.map(d => (
                        <li key={d.id} className="border rounded-xl p-2 flex items-center justify-between">
                          <span>#{d.id}</span>
                          <span>{d.got} / {d.max}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>

                <div className="mt-3">
                  <details open>
                    <summary className="cursor-pointer text-sm text-neutral-700">რევიუ: ჩემი პასუხები vs სწორი</summary>
                    <ol className="mt-3 space-y-4">
                      {items!.map((it) => {
                        const q = it.q;
                        let correct = false;
                        let reviewBlock: React.ReactNode = null;

                        if (q.type === 'mcq') {
                          const mcq = q as MCQ;
                          correct = it.mcqSelected === mcq.correct;
                          reviewBlock = (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {mcq.options.map(o => {
                                  const isSel = it.mcqSelected === o.id;
                                  const isCor = mcq.correct === o.id;
                                  const base = 'border rounded-lg p-2 relative';
                                  const cls = isCor
                                    ? `${base} border-green-600 ring-1 ring-green-400`
                                    : isSel
                                    ? `${base} border-red-500 ring-1 ring-red-300`
                                    : `${base}`;
                                  return (
                                    <div key={o.id} className={cls}>
                                      {o.image ? (
                                        <img src={o.image} alt={o.alt ?? 'opt'} className="h-24 w-full object-contain" />
                                      ) : (
                                        <div className="text-center font-medium">{o.text}</div>
                                      )}
                                      {isCor && <span className="absolute top-1 left-1 text-xs bg-green-600 text-white px-1 rounded">სწორი</span>}
                                      {isSel && !isCor && <span className="absolute top-1 left-1 text-xs bg-red-600 text-white px-1 rounded">ჩემი არჩევანი</span>}
                                      {isSel && isCor && <span className="absolute top-1 left-1 text-xs bg-green-600 text-white px-1 rounded">ჩემი არჩევანი ✓</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else if ((q as WrittenSingle).mode === 'single') {
                          const ws = q as WrittenSingle;
                          const { score, ratio } = scoreWrittenSingle(ws, it.singleText ?? '');
                          correct = score >= ws.points - 1e-6;
                          reviewBlock = (
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-2 flex-wrap">
                                <Pill>მსგავსება ~ {Math.round((ratio ?? 0) * 100)}%</Pill>
                                <Pill>ქულა: {score} / {ws.points}</Pill>
                              </div>
                              <div><span className="font-medium">თქვენი პასუხი:</span> <span className={`px-2 py-0.5 rounded ${correct ? 'bg-green-50' : 'bg-red-50'}`}>{(it.singleText ?? '').trim() || '—'}</span></div>
                              <div><span className="font-medium">სწორი ვარიანტები:</span> {ws.answer_variants.join(', ')}</div>
                            </div>
                          );
                        } else {
                          const wl = q as WrittenList;
                          const hidden = it.listHidden ?? [];
                          const answers = it.listAnswers ?? [];
                          const scored = scoreWrittenList(wl, answers, hidden);
                          const avgRatio = scored.rows.length ? (scored.rows.reduce((a, r) => a + r.ratio, 0) / scored.rows.length) : 0;
                          reviewBlock = (
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-2 flex-wrap">
                                <Pill>საშ. მსგავსება ~ {Math.round(avgRatio * 100)}%</Pill>
                                <Pill>ქულა: {scored.score} / {wl.points}</Pill>
                              </div>
                              {it.listShown && it.listShown.length > 0 && (
                                <div className="flex flex-wrap gap-2"><span className="font-medium">ნაჩვენები 25%:</span> {it.listShown.map((s, i) => <Pill key={i}>{s.value}</Pill>)}</div>
                              )}
                              <div className="overflow-auto">
                                <table className="ვ-full text-sm border">
                                  <thead>
                                    <tr className="bg-neutral-50">
                                      <th className="p-2 text-left">#</th>
                                      <th className="p-2 text-left">თქვენი პასუხი</th>
                                      <th className="p-2 text-left">სწორი პასუხი</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {scored.rows.map((row, i) => (
                                      <tr key={i} className={row.okFull ? 'bg-green-50' : (row.ratio >= 0.6 ? 'bg-yellow-50' : 'bg-red-50')}>
                                        <td className="p-2">{i + 1}</td>
                                        <td className="p-2">{row.user || '—'}</td>
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
                              <div className="font-medium">#{q.id} · {q.text}</div>
                              <Pill>{correct ? 'სწორია' : 'არასწორია'}</Pill>
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
          <>
            <QuestionBank bank={bank} />
          </>
        )}
      </div>
    </div>
  );
}
