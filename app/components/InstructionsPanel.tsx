"use client";

interface Props {
  docNumber: number;
  url: string;
}

export function InstructionsPanel({ docNumber, url }: Props) {
  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: "Zachraňme krajinu jižního Plzeňska",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  function handleRedownload() {
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() || "pripominka.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 text-left space-y-3 text-sm">
      <p className="font-bold text-teal-800 text-base">
        ✓ Stáhli jste si připomínku č.&nbsp;{docNumber}
      </p>

      <div className="space-y-2 text-gray-700">
        <p className="font-semibold">Co teď udělat:</p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            Otevřete PDF a doplňte: jméno a příjmení, datum narození, adresu
            trvalého pobytu, datum a podpis.
          </li>
          <li>
            Odešlete na Ministerstvo pro místní rozvoj:
            <ul className="ml-5 mt-1 space-y-0.5 list-disc">
              <li>
                datovou schránkou: <strong>26iaava</strong>
              </li>
              <li>
                doporučeně poštou: Ministerstvo pro místní rozvoj, Odbor
                územního plánování, Staroměstské náměstí 6, 110&nbsp;00
                Praha&nbsp;1
              </li>
              <li>
                e-mailem s el. podpisem na{" "}
                <strong>podatelna@mmr.gov.cz</strong>
              </li>
            </ul>
          </li>
        </ol>
        <p className="font-semibold text-teal-800">
          Termín: do 1.&nbsp;6.&nbsp;2026
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={handleShare}
          className="flex-1 px-4 py-2.5 bg-teal-700 text-white rounded-xl font-semibold hover:bg-teal-800 transition-colors text-sm"
        >
          Sdílet stránku
        </button>
        <button
          onClick={handleRedownload}
          className="flex-1 px-4 py-2.5 border border-teal-700 text-teal-700 rounded-xl font-semibold hover:bg-teal-50 transition-colors text-sm"
        >
          Stáhnout znovu
        </button>
      </div>
    </div>
  );
}
