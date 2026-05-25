"use client";

import { useState } from "react";
import { InstructionsPanel } from "./InstructionsPanel";
import { ExhaustedPanel } from "./ExhaustedPanel";
import { LimitPanel } from "./LimitPanel";

type State = "idle" | "loading" | "success" | "exhausted" | "limit" | "error";

export function GenerateButton() {
  const [state, setState] = useState<State>("idle");
  const [docUrl, setDocUrl] = useState("");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        setDocUrl(data.url);
        setState("success");

        const a = document.createElement("a");
        a.href = data.url;
        a.download = `pripominka_${String(data.docNumber).padStart(3, "0")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.dispatchEvent(new CustomEvent("pripominka-downloaded"));
      } else if (res.status === 429) {
        setState("limit");
      } else if (res.status === 410) {
        setState("exhausted");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return <InstructionsPanel url={docUrl} />;
  }
  if (state === "exhausted") return <ExhaustedPanel />;
  if (state === "limit") return <LimitPanel />;

  if (state === "error") {
    return (
      <div className="text-center space-y-3">
        <p className="text-red-600">
          Něco se pokazilo. Zkuste to za chvíli znovu.
        </p>
        <button
          onClick={() => setState("idle")}
          className="px-6 py-3 bg-teal-700 text-white rounded-xl font-semibold hover:bg-teal-800 transition-colors"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-3">
      <p className="text-sm text-gray-600">
        Vygeneruje Vám dokument s připomínkami. Vy jen doplníte jméno,
        podepíšete a odešlete na ministerstvo.
      </p>
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="w-full md:w-auto px-12 py-5 text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60 disabled:cursor-wait"
      >
        {state === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Generuji…
          </span>
        ) : (
          "Vygenerovat dokument s připomínkami"
        )}
      </button>
      <p className="text-sm text-gray-500">
        Připomínky se týkají akceleračních zón AOV&nbsp;51 Řenče,
        AOV&nbsp;62 Střížovice a AOV&nbsp;63 Únětice. Určeno pro občany
        s&nbsp;trvalým pobytem v&nbsp;zasaženém okolí.
      </p>
    </div>
  );
}
