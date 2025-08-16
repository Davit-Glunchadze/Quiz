import React from "react";
import type { Question } from "../core/types";

interface Props {
  question: Question;
  children: React.ReactNode;
}

const QuestionCard: React.FC<Props> = ({ question, children }) => {
  // images.question — ეს არის სურათების მასივი კითხვის საჩვენებლად
  const qImages: string[] = question.images?.question ?? [];

  return (
    <div className="p-4 mb-4 rounded-lg shadow bg-blue-50">
      <div className="mb-2 font-semibold text-gray-800">
        {question.text}
      </div>

      {/* Question images (თუ არის) */}
      {qImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {qImages.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`question-${question.id}-img-${idx}`}
              className="max-h-64 rounded object-contain"
            />
          ))}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
};

export default QuestionCard;
