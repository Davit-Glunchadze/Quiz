import React from "react";
import type { WrittenSingle } from "../core/types";
import QuestionCard from "./QuestionCard";

type Props = {
  q: WrittenSingle;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

const WrittenSingleView: React.FC<Props> = ({ q, value, onChange, disabled = false }) => {
  return (
    <QuestionCard question={q}>
      <input
        className="w-full border rounded-xl px-3 py-2"
        placeholder="ჩაწერეთ პასუხი…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </QuestionCard>
  );
};

export default WrittenSingleView;
