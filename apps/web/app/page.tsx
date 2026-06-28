import Link from "next/link";
import { AiQueryPanel } from "../components/ai-query-panel";
import { ScoreCard } from "../components/score-card";
import { StandingsTable } from "../components/standings-table";
import { getHomeData } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const home = await getHomeData();
  const liveCount = home.matches.filter((match) => match.status === "live").length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6 rounded-none py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-grass">
            OpenScore
          </p>
          <h1 className="text-4xl font-black leading-tight text-ink sm:text-5xl">
            干净、开源、无广告的比分工具
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            当前是 mock 数据原型，已经跑通今日比赛、积分榜、球队状态和本地收藏的第一条产品链路。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white/80 p-2 shadow-soft">
          <Metric label="今日比赛" value={home.matches.length.toString()} />
          <Metric label="进行中" value={liveCount.toString()} />
          <Metric label="数据源" value={home.apiAvailable ? "API" : "本地"} />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">今日比赛</h2>
            <span className="text-sm text-slate-500">更新时间 {home.updatedAtLabel}</span>
          </div>
          <div className="grid gap-3">
            {home.matches.map((match) => (
              <ScoreCard key={match.id} match={match} />
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <AiQueryPanel />

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-xl font-bold text-ink">球队状态</h2>
            <div className="grid gap-3">
              {home.teamForms.map((team) => (
                <Link
                  key={team.id}
                  className="flex items-center justify-between rounded-md bg-slate-50 p-3 transition hover:bg-emerald-50"
                  href={`/teams/${team.id}`}
                >
                  <div>
                    <p className="font-semibold text-ink">{team.name}</p>
                    <p className="text-xs text-slate-500">{team.competition}</p>
                  </div>
                  <div className="flex gap-1">
                    {team.form.map((result, index) => (
                      <span
                        key={`${team.id}-${index}`}
                        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                          result === "W"
                            ? "bg-emerald-100 text-emerald-700"
                            : result === "D"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">积分榜</h2>
          <span className="text-sm text-slate-500">{home.standings.competition.name}</span>
        </div>
        <StandingsTable rows={home.standings.rows} />
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
