import { Hero } from "./components/Hero";
import { GenerateButton } from "./components/GenerateButton";
import { StatsBar } from "./components/StatsBar";

export default function Home() {
  return (
    <main className="flex flex-col min-h-dvh max-w-2xl mx-auto px-4 py-6 md:px-8 md:py-10 justify-between">
      <Hero />
      <div className="flex-shrink-0">
        <GenerateButton />
      </div>
      <div className="space-y-4">
        <StatsBar />
        <footer className="text-center text-xs text-gray-400">
          <p>Tento web používá pouze technicky nezbytné cookies.</p>
        </footer>
      </div>
    </main>
  );
}
