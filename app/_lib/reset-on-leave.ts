import { useLayoutEffect, useRef } from "react";

/**
 * A reset one page put off because the player only stepped over to another
 * page and may come straight back. Leaving that other page for anywhere but
 * back runs it after all.
 */
let postponed: { page: string; reset: () => void } | null = null;

/**
 * Runs `reset` when the player navigates away from this page. Next.js keeps
 * visited pages mounted but hidden (React's Activity), so without this a page
 * comes back exactly as it was left, half-finished taps and all.
 *
 * `keepFor` names a page the player may visit and come back from without this
 * page resetting, or null when every page should reset it.
 */
export function useResetOnLeave(reset: () => void, keepFor?: () => string | null) {
  const latestRef = useRef({ reset, keepFor });
  const shownRef = useRef(false);

  useLayoutEffect(() => {
    latestRef.current = { reset, keepFor };
  });

  useLayoutEffect(() => {
    shownRef.current = true;
    // The router has already put the new address in the bar by now.
    const page = window.location.pathname;
    if (postponed?.page === page) postponed = null;

    return () => {
      shownRef.current = false;
      // In development, Strict Mode hides and re-shows every page straight
      // away when it mounts. Only act if the page really stayed hidden.
      queueMicrotask(() => {
        if (shownRef.current) return;
        const destination = window.location.pathname;

        // Leaving the page the player stepped over to, for somewhere other
        // than straight back, ends the other page's wait.
        if (postponed && postponed.page !== page && postponed.page !== destination) {
          const { reset: postponedReset } = postponed;
          postponed = null;
          postponedReset();
        }

        if (latestRef.current.keepFor?.() === destination) {
          postponed = { page, reset: () => latestRef.current.reset() };
        } else {
          latestRef.current.reset();
        }
      });
    };
  }, []);
}
