"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Thread } from "@/lib/types";
import { relativeTime, nextRelease } from "@/lib/format";

// An adaptive freshness note for the selected thread. The current month's
// thread is scraped every ~2h while it fills (HN takes new posts for ~2 weeks),
// so its counts are preliminary on release day. Older threads are frozen.
// All "now"-relative text is computed client-side (after mount) to avoid
// hydration drift.
export default function Freshness({
  thread,
  isLatest,
}: {
  thread: Thread;
  isLatest: boolean;
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Pre-mount / SSR: a neutral line, identical on server and first client paint.
  if (nowMs == null) {
    return (
      <div className="freshness">
        <span className="fclock">◷</span>
        <span>Counts update automatically as the thread is re-scraped.</span>
      </div>
    );
  }

  const updated = thread.last_scraped_at
    ? relativeTime(thread.last_scraped_at, nowMs)
    : "—";
  const ageDays = thread.posted_at
    ? (nowMs - new Date(thread.posted_at).getTime()) / 86400000
    : null;

  const nr = isLatest ? nextRelease(thread.month, nowMs) : null;
  const live = isLatest && ageDays != null && ageDays < 3;

  let status: ReactNode;
  if (isLatest) {
    status = (
      <>
        On the first couple days of the month data may lag a bit as the
        recurring background job catches up with job listings.
        {nr && nr.days > 0 && (
          <> Next posting is ~{nr.days} days away.</>
        )}
      </>
    );
  } else if (thread.is_archived) {
    status =
      "Final snapshot — this thread is frozen (HN has closed it to new comments).";
  } else {
    status = "Counts for this thread are essentially final.";
  }

  return (
    <div className={`freshness${live ? " live" : ""}`}>
      <span className="fclock">◷</span>
      <span>
        Data updated <b>{updated}</b>. {status}
      </span>
    </div>
  );
}
