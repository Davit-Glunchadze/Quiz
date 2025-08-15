import type { WrittenSingle } from "../core/types";

export default function WrittenSingleView({
  q,
  value,
  onChange,
  disabled = false,
}: {
  q: WrittenSingle;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-3 ${disabled ? "opacity-70" : ""}`}>
      <div className="text-lg font-medium">{q.text}</div>
      <input
        className="w-full border rounded-xl p-3"
        placeholder="ჩაწერე პასუხი"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
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
