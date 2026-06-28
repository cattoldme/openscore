import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreCard } from "../../../components/score-card";
import { getTeamPageData } from "../../../lib/api";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getTeamPageData(id);

  if (data.apiAvailable && !data.team) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-grass hover:text-ink" href="/">
        ← 返回今日比赛
      </Link>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-grass">
              Team
            </p>
            <h1 className="text-4xl font-black leading-tight text-ink">
              {data.team?.name ?? "等待 API 启动"}
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {data.team?.countryCode ?? "--"} · {data.team?.shortName ?? "--"} · 更新时间 {data.updatedAtLabel}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="排名" value={data.standingsRow ? data.standingsRow.position.toString() : "--"} />
            <Metric label="积分" value={data.standingsRow ? data.standingsRow.points.toString() : "--"} />
            <Metric label="比赛" value={data.matches.length.toString()} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-xl font-bold text-ink">近期状态</h2>
          <div className="flex gap-2">
            {data.form.length > 0 ? (
              data.form.map((result, index) => <FormBadge key={`${result}-${index}`} result={result} />)
            ) : (
              <span className="text-sm text-slate-500">暂无状态数据</span>
            )}
          </div>

          {data.standingsRow ? (
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Stat label="场次" value={data.standingsRow.played} />
              <Stat label="胜/平/负" value={`${data.standingsRow.won}/${data.standingsRow.drawn}/${data.standingsRow.lost}`} />
              <Stat label="进球" value={data.standingsRow.goalsFor} />
              <Stat label="失球" value={data.standingsRow.goalsAgainst} />
              <Stat label="净胜球" value={data.standingsRow.goalDifference} />
              <Stat label="积分" value={data.standingsRow.points} />
            </dl>
          ) : null}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">相关比赛</h2>
            <span className="text-sm text-slate-500">{data.matches.length} 场</span>
          </div>
          <div className="grid gap-3">
            {data.matches.length > 0 ? (
              data.matches.map((match) => <ScoreCard key={match.id} match={match} />)
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-soft">
                暂无相关比赛。请确认 API 是否已启动。
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20 rounded-md bg-slate-50 px-3 py-2 text-center">
      <div className="text-lg font-black text-ink">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function FormBadge({ result }: { result: "W" | "D" | "L" }) {
  return (
    <span
      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
        result === "W"
          ? "bg-emerald-100 text-emerald-700"
          : result === "D"
            ? "bg-amber-100 text-amber-700"
            : "bg-rose-100 text-rose-700"
      }`}
    >
      {result}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-black text-ink">{value}</dd>
    </div>
  );
}

