import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wobble — Prompt regression testing for LLMs",
  description: "Run your prompts against real models, catch quality regressions before production, and compare providers side-by-side.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Berkeley+Mono:ital,wght@0,100..700;1,100..700&family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
