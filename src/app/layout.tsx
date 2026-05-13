import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "KodaiRateIQ — Hotel Rate Intelligence Platform",
  description: "AI-powered hotel rate intelligence and competitive pricing platform for Kodaikanal luxury hotels. Real-time competitor monitoring, dynamic pricing recommendations, and market analytics.",
  keywords: ["hotel pricing", "Kodaikanal", "rate intelligence", "revenue management", "competitive analysis"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        {/* Google Fonts — Geist + Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
        {/* Material Symbols Outlined — MUST be in <head> for icon ligatures to work */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
