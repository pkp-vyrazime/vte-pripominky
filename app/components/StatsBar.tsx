"use client";

import { useState, useEffect } from "react";

function pluralize(n: number): string {
  if (n === 1) return "občan si už stáhl";
  if (n >= 2 && n <= 4) return "občané si už stáhli";
  return "občanů si už stáhlo";
}

export function StatsBar() {
  const [total, setTotal] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(51);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        setTotal(data.total);
        setCapacity(data.capacity);
      } catch {
        /* ignore */
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 15000);

    function handleDownload() {
      setTotal((t) => (t !== null ? t + 1 : 1));
    }
    window.addEventListener("pripominka-downloaded", handleDownload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pripominka-downloaded", handleDownload);
    };
  }, []);

  if (total === null) return null;

  const pct = Math.min(100, Math.round((total / capacity) * 100));

  return (
    <div className="text-center space-y-2">
      <p className="text-sm text-gray-600">
        <strong className="text-gray-900">{total}</strong>{" "}
        {pluralize(total)} připomínku
      </p>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-teal-600 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        {total} / {capacity}
      </p>
    </div>
  );
}
