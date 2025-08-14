import Pill from "./Pill";
import type { MCQ, Question, WrittenList, WrittenSingle } from "../core/types";

export default function QuestionBank({ bank }: { bank: Question[] }) {
  return (
    <div className="border rounded-2xl p-4">
      <div className="text-xl font-semibold mb-3">კითხვა-ბანკი (სასწავლო ხედი)</div>
      <ul className="space-y-4">
        {bank.map((q) => (
          <li key={q.id} className="border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">#{q.id} · {q.text}</div>
              <Pill>{q.type === 'mcq' ? 'ტესტური (2 ქ)' : 'საწერი (5 ქ)'}</Pill>
            </div>
            {q.type === "mcq" ? (
              <div className="space-y-2">
                <div className="text-sm text-neutral-600">სწორი პასუხი: {(q as MCQ).correct}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(q as MCQ).options.map(o => (
                    <div key={o.id} className={`border rounded-lg p-2 ${(o.id === (q as MCQ).correct) ? 'border-green-500' : ''}`}>
                      {o.image ? (
                        <img src={o.image} alt={o.alt ?? 'opt'} className="h-24 w-full object-contain" />
                      ) : (
                        <div className="text-center">{o.text}</div>
                      )}
                    </div>
                  ))}
                </div>
                {(q.images?.answer_key ?? []).length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {q.images!.answer_key!.map((src, i) => (
                      <img key={i} src={src} alt={`key-${q.id}-${i}`} className="h-24 object-contain" />
                    ))}
                  </div>
                )}
              </div>
            ) : (q as WrittenSingle).mode === "single" ? (
              <div className="text-sm text-neutral-700">
                <span className="font-medium">სწორი ვარიანტები:</span> {(q as WrittenSingle).answer_variants.join(", ")}
              </div>
            ) : (
              <div className="text-sm text-neutral-700">
                <span className="font-medium">სრული სია:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(q as WrittenList).list.full.map((it, i) => (
                    <Pill key={i}>{it.value}</Pill>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
