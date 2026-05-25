import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zachraňme krajinu jižního Plzeňska — připomínky k AOV",
  description:
    "Podejte připomínku proti vymezení akceleračních oblastí pro větrné elektrárny AOV 51, 62 a 63 v Územním rozvojovém plánu. Termín: 1. 6. 2026.",
  openGraph: {
    title: "Zachraňme krajinu jižního Plzeňska",
    description:
      "Podejte připomínku proti vymezení akceleračních oblastí pro větrné elektrárny.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="bg-white text-gray-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
