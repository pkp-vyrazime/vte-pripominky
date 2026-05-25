export function ExhaustedPanel() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
      <p className="font-bold text-amber-800 text-lg">
        Všechny připomínky jsou rozebrány
      </p>
      <p className="text-gray-600 text-sm">
        Děkujeme za zájem. V krátké době doplníme další připomínky. Vraťte se
        prosím za pár hodin.
      </p>
    </div>
  );
}
