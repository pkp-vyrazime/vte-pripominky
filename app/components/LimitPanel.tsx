"use client";

export function LimitPanel() {
  function handleCopy() {
    navigator.clipboard.writeText(window.location.href);
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center space-y-3">
      <p className="font-bold text-blue-800 text-base">
        Z tohoto prohlížeče je již staženo 5 dokumentů
      </p>
      <p className="text-gray-600 text-sm">
        Sdílejte prosím stránku s dalšími lidmi — čím víc různých občanů pošle
        připomínku, tím větší dopad.
      </p>
      <button
        onClick={handleCopy}
        className="px-5 py-2.5 bg-blue-700 text-white rounded-xl font-semibold hover:bg-blue-800 transition-colors text-sm"
      >
        Zkopírovat odkaz
      </button>
    </div>
  );
}
