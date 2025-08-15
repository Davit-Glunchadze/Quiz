 
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function CountdownTimer({
  remainingSec,
  totalSec,
}: {
  remainingSec: number;
  totalSec: number;
}) {
  const hrs = Math.floor(remainingSec / 3600);
  const mins = Math.floor((remainingSec % 3600) / 60);
  const secs = remainingSec % 60;

  const pct = Math.max(0, Math.min(100, Math.round(((totalSec - remainingSec) / Math.max(1, totalSec)) * 100)));

  return (
    <div className="flex items-center gap-3">
      <div
        className={`px-3 py-1 rounded-xl text-sm font-semibold border
        ${remainingSec <= 300 ? "bg-red-50 text-red-700 border-red-200"
          : remainingSec <= 900 ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
        title="დარჩენილი დრო"
      >
        {pad(hrs)}:{pad(mins)}:{pad(secs)}
      </div>
      <div className="w-40 h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
