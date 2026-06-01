import { getOverview, getThreads, getThreadCounts, getTechs } from "@/lib/queries";
import type { Overview, Thread, Tech, CountRow } from "@/lib/types";
import Dashboard from "@/components/Dashboard";
import Methodology from "@/components/Methodology";

// ISR: the underlying data changes a few times a day at most, so serve a cached
// render and revalidate periodically. A HN front-page spike is then cheap.
export const revalidate = 1800;

type InitialData = {
  overview: Overview;
  threads: Thread[];
  techs: Tech[];
  latestId: number;
  latestCounts: CountRow[];
};

async function load(): Promise<InitialData | null> {
  try {
    const [overview, threads, techs] = await Promise.all([
      getOverview(),
      getThreads(),
      getTechs(),
    ]);
    if (!threads.length) return null;
    const latestId = threads[0].id;
    const latestCounts = (await getThreadCounts(latestId)) as CountRow[];
    return {
      overview: overview as Overview,
      threads: threads as Thread[],
      techs: techs as Tech[],
      latestId,
      latestCounts,
    };
  } catch {
    return null;
  }
}

export default async function Page() {
  const data = await load();

  return (
    <div className="wrap">
      <header>
        <p className="kicker">Hacker News · Ask HN: Who is hiring?</p>
        <h1>
          The Hiring <em>Thread</em>, Counted
        </h1>
        <p className="dek">
          A live read of the{" "}
          <a
            href="https://news.ycombinator.com/user?id=whoishiring"
            target="_blank"
            rel="noopener"
          >
            whoishiring
          </a>{" "}
          account: every monthly thread it has ever posted, and what languages
          and frameworks show up in any given one. Counts are post-level, pulled
          from the public Hacker News data on a schedule — the page itself just
          reads pre-aggregated numbers, so it stays fast.
        </p>
      </header>

      {data ? (
        <Dashboard
          overview={data.overview}
          threads={data.threads}
          techs={data.techs}
          latestId={data.latestId}
          latestCounts={data.latestCounts}
        />
      ) : (
        <div className="err" style={{ marginTop: 18 }}>
          <b>The data layer is unreachable right now.</b> This page reads
          pre-aggregated counts from Supabase. If you just deployed, set{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and run the backfill so the
          tables fill up, then reload.
        </div>
      )}

      <Methodology />

      <footer className="colophon">
        Built lovingly by{" "}
        <a href="https://adamfreemer.com" target="_blank" rel="noopener">
          Adam Freemer
        </a>
      </footer>
    </div>
  );
}
