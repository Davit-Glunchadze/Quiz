import React from "react";
export default function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 rounded-full text-xs bg-neutral-100 border border-neutral-200">
      {children}
    </span>
  );
}
