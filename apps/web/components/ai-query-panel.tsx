"use client";

import { FormEvent, useState } from "react";
import { querySportsData, type AiQueryApiResponse } from "../lib/api";

const SUGGESTED_QUERIES = ["今晚英超有哪些比赛？", "现在有进行中的比赛吗？", "阿森纳最近状态怎么样？"];

export function AiQueryPanel() {
  const [query, setQuery] = useState(SUGGESTED_QUERIES[0] ?? "");
  const [response, setResponse] = useState<AiQueryApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = response?.data ?? null;

  async function submit(nextQuery = query) {
    const trimmed = nextQuery.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setQuery(trimmed);
    setIsLoading(true);
    setError(null);

    try {
      const nextResponse = await querySportsData(trimmed);
      setResponse(nextResponse);
    } catch {
      setResponse(null);
      setError("查询暂时不可用，请确认 API 已启动。");
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">AI 查询</h2>
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            result?.grounded ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {result?.grounded ? "已溯源" : "待查询"}
        </span>
      </div>

      <form className="grid gap-3" onSubmit={onSubmit}>
        <textarea
          className="min-h-24 resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-ink outline-none transition placeholder:text-slate-400 focus:border-grass focus:bg-white focus:ring-2 focus:ring-emerald-100"
          value={query}
          maxLength={160}
          placeholder="今晚英超有哪些比赛？"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {SUGGESTED_QUERIES.map((item) => (
            <button
              key={item}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              type="button"
              onClick={() => void submit(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="submit"
          disabled={isLoading || query.trim().length === 0}
        >
          {isLoading ? "查询中" : "查询"}
        </button>
      </form>

      {error ? (
        <div className="mt-3 rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <p>{result.answer}</p>
            {response ? (
              <p className="mt-2 text-xs text-slate-500">
                {response.meta.source} ·{" "}
                {new Date(response.meta.updatedAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            ) : null}
          </div>
          {result.cards.length > 0 ? (
            <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {result.cards.map((match) => (
                <div key={match.id} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">
                      {match.homeTeamName} vs {match.awayTeamName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {match.competitionName} ·{" "}
                      {new Date(match.startsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-right font-black tabular-nums text-ink">
                    {match.homeScore} - {match.awayScore}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
