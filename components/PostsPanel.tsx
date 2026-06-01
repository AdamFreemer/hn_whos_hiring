"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPostsForTech } from "@/lib/queries";
import type { Post } from "@/lib/types";
import { esc, fmtMonth } from "@/lib/format";

const PREVIEW = 10;

type Selected = { slug: string; name: string };

function lines(body: string): string[] {
  return body.split("\n").map((s) => s.trim()).filter(Boolean);
}

function PostCard({ p }: { p: Post }) {
  const ls = lines(p.body);
  let title = p.title || ls[0] || p.body.slice(0, 100);
  if (title.length > 140) title = title.slice(0, 140) + "…";
  let snip = ls.slice(1).join(" ");
  if (snip.length > 240) snip = snip.slice(0, 240) + "…";
  return (
    <div className="post">
      <div className="t">{title}</div>
      {snip && <div className="s">{snip}</div>}
      <div className="m">
        <span>by {p.author || "anon"}</span>
        <a
          href={`https://news.ycombinator.com/item?id=${p.id}`}
          target="_blank"
          rel="noopener"
        >
          read on HN ↗
        </a>
      </div>
    </div>
  );
}

// A standalone HTML document listing every matching post — the "open all in a
// new tab" view. Mirrors the prototype's standalone() styling.
function standalone(name: string, posts: Post[], monthLabel: string): string {
  const items = posts
    .map((p, i) => {
      const ls = lines(p.body);
      const title = esc(ls[0] || p.body.slice(0, 120));
      const body = esc(ls.slice(1).join("\n")).replace(/\n/g, "<br>");
      return `<article><h2>${i + 1}. ${title}</h2>${
        body ? `<p>${body}</p>` : ""
      }<div class="meta">by ${esc(p.author || "anon")} · <a href="https://news.ycombinator.com/item?id=${p.id}" target="_blank">read on HN ↗</a></div></article>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(name)} · ${esc(monthLabel)} · Who is hiring</title>
  <style>
    body{margin:0;background:#0e0c0a;color:#ece4d6;font:15px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;padding:40px 20px 80px}
    .wrap{max-width:840px;margin:0 auto}
    h1{font:600 30px/1.1 Fraunces,Georgia,serif;margin:0 0 6px}
    h1 b{color:#ff8a3d}
    .sub{color:#8f8473;font-size:13px;margin-bottom:30px;border-bottom:1px solid #2c241b;padding-bottom:18px}
    article{border:1px solid #2c241b;background:#16120d;padding:16px 18px;margin-bottom:12px}
    h2{font:600 15px/1.4 "IBM Plex Mono",monospace;margin:0 0 8px;color:#ece4d6}
    p{margin:0;color:#b8ad9b;font-size:13.5px;white-space:normal}
    .meta{margin-top:12px;font-size:12px;color:#5f574a}
    .meta a{color:#ff8a3d;text-decoration:none}
    @media print{body{background:#fff;color:#000}article{border-color:#ccc;background:#fff}}
  </style></head><body><div class="wrap">
  <h1>Posts mentioning <b>${esc(name)}</b></h1>
  <div class="sub">${posts.length} job posts · Ask HN: Who is hiring? (${esc(
    monthLabel
  )})</div>
  ${items}
  </div></body></html>`;
}

export default function PostsPanel({
  threadId,
  threadMonth,
  totalPosts,
  selected,
  onClose,
}: {
  threadId: number;
  threadMonth: string;
  totalPosts: number;
  selected: Selected;
  onClose: () => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allLoaded, setAllLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load the preview whenever the selected tech (or thread) changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAllLoaded(false);
    getPostsForTech(threadId, selected.slug, PREVIEW, 0).then((res) => {
      if (cancelled) return;
      setPosts(res.posts as Post[]);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, selected.slug]);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected.slug, threadId]);

  const loadAll = useCallback(async (): Promise<Post[]> => {
    if (allLoaded) return posts;
    const res = await getPostsForTech(threadId, selected.slug, total || PREVIEW, 0);
    const all = res.posts as Post[];
    setPosts(all);
    setAllLoaded(true);
    return all;
  }, [allLoaded, posts, threadId, selected.slug, total]);

  const openAll = useCallback(async () => {
    const all = await loadAll();
    const html = standalone(selected.name, all, fmtMonth(threadMonth));
    let win: Window | null = null;
    try {
      win = window.open("", "_blank");
    } catch {
      win = null;
    }
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }, [loadAll, selected.name, threadMonth]);

  const monthLabel = fmtMonth(threadMonth);
  const hasMore = total > PREVIEW && !allLoaded;

  return (
    <div className="posts-panel" ref={ref}>
      <div className="posts-box">
        <h3>
          Posts mentioning <b>{selected.name}</b>
        </h3>
        <div className="ph">
          <span>
            {loading
              ? "loading…"
              : `${total} of ${totalPosts} posts in ${monthLabel}`}
          </span>
          {hasMore && (
            <>
              <a onClick={openAll}>Open all {total} in a new tab ↗</a>
              <a onClick={loadAll}>show all here ↓</a>
            </>
          )}
          <button className="closex" onClick={onClose}>
            close ✕
          </button>
        </div>
        <div>
          {loading ? (
            <div className="loading">
              <span className="dot" /> Loading posts…
            </div>
          ) : posts.length ? (
            posts.map((p) => <PostCard key={p.id} p={p} />)
          ) : (
            <div className="post">
              <div className="s">No posts matched in this thread.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
