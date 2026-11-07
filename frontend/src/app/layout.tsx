import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mira 3D RPG Engine",
  description: "3D Generative RPG Engine powered by NVIDIA NIM, SpacetimeDB, and Gemini Vision",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0a0a0f] text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
