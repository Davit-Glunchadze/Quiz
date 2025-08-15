import type { MCQ, MCQOption } from "../core/types";

export default function MCQView({
  q,
  selected,
  preparedOptions,
  onAnswer,
  disabled = false,
}: {
  q: MCQ;
  selected?: string;
  preparedOptions?: MCQOption[]; // seed-prepared order
  onAnswer: (optionId: string) => void;
  disabled?: boolean;
}) {
  const displayOptions = preparedOptions ?? q.options;

  return (
    <div className="space-y-3 opacity-100">
      <div className="text-lg font-medium">{q.text}</div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${disabled ? "pointer-events-none opacity-70" : ""}`}>
        {displayOptions.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              className={`border rounded-xl p-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-300' : 'hover:bg-neutral-50'}`}
              onClick={() => onAnswer(opt.id)}
              aria-pressed={isSelected}
              disabled={disabled}
            >
              {opt.image ? (
                <img src={opt.image} alt={opt.alt ?? "option"} className="w-28 h-20 object-contain bg-white rounded-md border" />
              ) : (
                <span className="text-base font-semibold">{opt.text}</span>
              )}
            </button>
          );
        })}
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
