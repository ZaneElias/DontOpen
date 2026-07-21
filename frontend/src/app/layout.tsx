import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { RainbowShader } from "@/components/ui/rainbow-shader";
import "./globals.css";

// next/font self-hosts these at build time — no requests to fonts.googleapis /
// fonts.gstatic, which our CSP (style-src 'self', font-src 'self') would block.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial accent — used italic for one word in a headline.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CallPilot — Voice agents that call, compare, and haggle",
  description: "CallPilot gathers real prices by phone, compares them, and negotiates the best deal on your behalf.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Defaults to dark (the cinematic look); ThemeToggle restores a persisted
  // preference on mount and lets the user switch.
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <RainbowShader />
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
