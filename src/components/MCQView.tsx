import React from "react";
import type { MCQ, MCQOption } from "../core/types";
import QuestionCard from "./QuestionCard";

type Props = {
  q: MCQ;
  selected?: string;
  preparedOptions?: MCQOption[];
  onAnswer: (optionId: string) => void;
  disabled?: boolean;
};

const MCQView: React.FC<Props> = ({
  q,
  selected,
  preparedOptions,
  onAnswer,
  disabled = false,
}) => {
  const options =
    preparedOptions && preparedOptions.length ? preparedOptions : q.options;

  return (
    <QuestionCard question={q}>
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
          disabled ? "opacity-70 pointer-events-none" : ""
        }`}
      >
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          const base =
            "w-full text-left px-3 py-2 border rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
          const cls = isSelected
            ? "bg-blue-200 border-blue-400"
            : "bg-white border-gray-300 hover:bg-gray-100";

          return (
            <button
              key={opt.id}
              className={`${base} ${cls}`}
              onClick={() => onAnswer(opt.id)}
              disabled={disabled}
            >
              {opt.image ? (
                <div className="flex items-center gap-2">
                  <img
                    src={opt.image}
                    alt={opt.alt ?? "option"}
                    className="h-20 object-contain"
                  />
                  {opt.text && <span className="font-medium">{opt.text}</span>}
                </div>
              ) : (
                <span className="font-medium">{opt.text}</span>
              )}
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
};

export default MCQView;
