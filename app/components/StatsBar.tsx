"use client";

import { useState, useEffect } from "react";

function pluralize(n: number): string {
  if (n === 1) return "občan si už stáhl";
  if (n >= 2 && n <= 4) return "občané si už stáhli";
  return "občanů si už stáhlo";
}

export function StatsBar() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        setTotal(data.total);
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

  return (
    <div className="text-center">
      <p className="text-sm text-gray-600">
        <strong className="text-gray-900">{total}</strong>{" "}
        {pluralize(total)} připomínku
      </p>
    </div>
  );
}
