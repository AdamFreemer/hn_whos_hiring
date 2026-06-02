import type { HNJob } from "@/lib/hnJobs";

// Presentational list of the latest YC job posts (server-fetched). Separate from
// the "Who is hiring?" thread analysis — this is HN's standalone /jobs feed.
export default function LatestJobs({ jobs }: { jobs: HNJob[] }) {
  if (!jobs.length) return null;
  return (
    <section id="latest-jobs">
      <div className="sec-head">
        <h2>Latest YC jobs</h2>
        <div className="meta">
          Freshest posts from{" "}
          <a
            href="https://news.ycombinator.com/jobs"
            target="_blank"
            rel="noopener"
          >
            news.ycombinator.com/jobs
          </a>
        </div>
      </div>
      <ol className="joblist">
        {jobs.map((j) => (
          <li key={j.id} className="jobrow">
            <a
              className="jobtitle"
              href={j.url || `https://news.ycombinator.com/item?id=${j.id}`}
              target="_blank"
              rel="noopener"
            >
              {j.title}
            </a>
            <a
              className="jobhn"
              href={`https://news.ycombinator.com/item?id=${j.id}`}
              target="_blank"
              rel="noopener"
            >
              HN ↗
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
