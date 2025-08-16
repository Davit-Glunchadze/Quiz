import React from "react";
import type { ListItem, WrittenList } from "../core/types";
import QuestionCard from "./QuestionCard";

type Props = {
  q: WrittenList;
  shownItems: ListItem[];
  hiddenItems: ListItem[];
  answers: string[];
  setAnswer: (i: number, v: string) => void;
  disabled?: boolean;
};

const WrittenListView: React.FC<Props> = ({
  q,
  shownItems,
  hiddenItems,
  answers,
  setAnswer,
  disabled = false,
}) => {
  return (
    <QuestionCard question={q}>
      {/* ნაჩვენები 25% — პილებად */}
      {shownItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {shownItems.map((it, idx) => (
            <span
              key={`shown-${idx}`}
              className="px-2 py-1 text-xs rounded bg-neutral-100 border"
            >
              {it.value}
            </span>
          ))}
        </div>
      )}

      {/* დამალული — ცალ-ცალკე სრულსიგრძიანი ველები */}
      <div className={`space-y-2 ${disabled ? "opacity-70 pointer-events-none" : ""}`}>
        {hiddenItems.map((_, idx) => (
          <input
            key={`blank-${idx}`}
            className="w-full border rounded-xl px-3 py-2"
            placeholder={`შეავსე #${idx + 1}`}
            value={answers[idx] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;

              // მხარდაჭერა: კომით/წერტილმძიმით/ახალი ხაზით რამდენიმე პასუხის ჩაწერა
              const parts = raw
                .split(/[,;\n]+/)
                .map((p) => p.trim())
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
            disabled={disabled}
          />
        ))}
      </div>
    </QuestionCard>
  );
};

export default WrittenListView;
