export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
      <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
