import Pill from "./Pill";
import type { ListItem, WrittenList } from "../core/types";

export default function WrittenListView({
  q,
  shownItems,
  hiddenItems,
  answers,
  setAnswer,
}: {
  q: WrittenList;
  shownItems: ListItem[];
  hiddenItems: ListItem[];
  answers: string[];
  setAnswer: (i: number, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-lg font-medium">{q.text}</div>
      <div className="flex flex-wrap gap-2 items-center">
        {shownItems.map((it, idx) => (
          <Pill key={`shown-${idx}`}>{it.value}</Pill>
        ))}
        {hiddenItems.map((_, idx) => (
          <input
            key={`blank-${idx}`}
            className="border rounded-xl px-2 py-1"
            placeholder={`შეავსე #${idx + 1}`}
            value={answers[idx] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const parts = raw
                .split(/[,;\n]+/)
                .map(p => p.trim())
                .filter(Boolean);
              if (parts.length > 1) {
                parts.forEach((p, off) => {
                  const at = idx + off;
                  if (answers[at] === undefined || (answers[at] ?? "").trim() === "") {
                    setAnswer(at, p);
                  }
                });
                setAnswer(idx, parts[0]);
              } else {
                setAnswer(idx, raw);
              }
            }}
          />
        ))}
      </div>
      {q.images?.question?.length ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {q.images.question.map((src, i) => (
            <img key={i} src={src} alt={`q-${q.id}-fig-${i}`} className="h-20 object-contain" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
