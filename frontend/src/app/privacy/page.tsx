import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BackToApp } from "@/components/back-to-app";

export const metadata: Metadata = {
  title: "Privacy Policy — CallPilot",
  description: "How CallPilot collects, uses, and protects your information.",
};

/**
 * Renders the policy as a real page rather than linking to a raw .md file.
 * Read on the server from the same single source the consent gate fetches, so
 * the two can never drift apart.
 */
export default async function PrivacyPage() {
  const file = path.join(process.cwd(), "public", "privacy-policy.md");
  let markdown = "";
  try {
    markdown = await fs.readFile(file, "utf8");
  } catch {
    markdown = "# Privacy Policy\n\nThis document is temporarily unavailable. Please contact support.";
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-12 sm:px-8">
      <BackToApp />

      <div className="liquid-glass backdrop-blur-xl mt-5 rounded-2xl px-6 py-8 sm:px-9 sm:py-10">
        <article className="cp-prose text-sm leading-relaxed text-ink-muted">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </div>

      <p className="mt-5 text-center text-[11px] text-ink-muted">
        Questions? Email{" "}
        <a className="text-action underline-offset-4 hover:underline" href="mailto:spoodermansee@gmail.com">
          spoodermansee@gmail.com
        </a>
      </p>
    </main>
  );
}
