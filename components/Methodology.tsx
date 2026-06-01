// Static methodology footer. Copy mirrors reference/prototype.html and
// reference/data-notes.md (post-level counts, approx labels, the data source).
export default function Methodology() {
  return (
    <p className="note" id="methodology">
      <b>Method.</b> Threads are every story by the <b>whoishiring</b> account
      whose title contains “who is hiring” (excluding the sibling “Who wants to
      be hired?” and “Freelancer?” threads). Counts are <b>post-level</b>: a
      technology scores once per top-level job post that mentions it, not once
      per raw occurrence, mirroring hntrends.com and keeping one verbose listing
      from skewing totals. Matching is case-insensitive on word boundaries.
      Labels marked <span className="skel">≈</span> (Go, C, Spring, Express,
      Phoenix) collide with ordinary English words and are best read as upper
      bounds. JavaScript counts the literal word “javascript,” not “JS,” to
      avoid double-counting Node.js / Next.js. Source: the public Hacker News
      Search API (Algolia), scraped on a decaying schedule and stored — the
      browser reads only the pre-aggregated counts.
    </p>
  );
}
