"use client";

/**
 * "Back to CallPilot" for the privacy page.
 *
 * The policy opens in its own tab, so navigating to "/" here would leave the
 * user with two CallPilot tabs. Closing this one returns them to the tab they
 * came from, where their session and in-progress job are already loaded.
 *
 * Browsers refuse window.close() for tabs a script didn't open, so if the close
 * is blocked we fall back to navigating — the link always does something.
 */
export function BackToApp() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.close();
    // If the tab is still here a moment later, the browser blocked the close.
    window.setTimeout(() => {
      if (!window.closed) window.location.href = "/";
    }, 120);
  }

  return (
    // Intentionally a plain <a>, not next/link: this tab was opened by the app,
    // and the handler tries window.close() first. A client-side <Link> would
    // navigate this tab instead of closing it and returning to the original.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/"
      onClick={handleClick}
      className="cursor-pointer text-[11px] text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
    >
      ← Back to CallPilot
    </a>
  );
}
