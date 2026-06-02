// Latest YC job posts from Hacker News' /jobs feed (the "job" tag in Algolia).
// Fetched server-side (never from the browser) and cached with the page's ISR
// window, so the list refreshes periodically without scraping on every load.

export type HNJob = {
  id: number;
  title: string;
  url: string | null;
  author: string | null;
  createdAt: string;
};

export async function getLatestJobs(limit = 10): Promise<HNJob[]> {
  try {
    const r = await fetch(
      `https://hn.algolia.com/api/v1/search_by_date?tags=job&hitsPerPage=${limit}`,
      { next: { revalidate: 1800 } }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.hits || [])
      .map((h: { objectID: string; title?: string; url?: string | null; author?: string; created_at: string }) => ({
        id: Number(h.objectID),
        title: h.title || "",
        url: h.url || null,
        author: h.author || null,
        createdAt: h.created_at,
      }))
      .filter((j: HNJob) => j.title);
  } catch {
    return [];
  }
}
