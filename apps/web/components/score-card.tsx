"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatchSummary } from "@openscore/domain";
import { getMatchStatusLabel } from "@openscore/domain";

const FAVORITES_KEY = "openscore.favoriteMatches";

export function ScoreCard({ match }: { match: MatchSummary }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const isFavorite = favoriteIds.includes(match.id);

  useEffect(() => {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    setFavoriteIds(raw ? JSON.parse(raw) : []);
  }, []);

  function toggleFavorite() {
    const next = isFavorite
      ? favoriteIds.filter((id) => id !== match.id)
      : [...favoriteIds, match.id];

    setFavoriteIds(next);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }

  return (
    <article className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <button
        aria-label={isFavorite ? "取消收藏比赛" : "收藏比赛"}
        className={`grid h-10 w-10 place-items-center rounded-full border text-lg transition ${
          isFavorite
            ? "border-amber-300 bg-amber-50 text-amber-500"
            : "border-slate-200 bg-white text-slate-300 hover:text-amber-500"
        }`}
        type="button"
        onClick={toggleFavorite}
      >
        ★
      </button>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{match.competitionName}</span>
          <span>·</span>
          <span>{new Date(match.startsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              match.status === "live"
                ? "bg-emerald-100 text-emerald-700"
                : match.status === "finished"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-sky-100 text-sky-700"
            }`}
          >
            {getMatchStatusLabel(match.status)}
          </span>
        </div>
        <div className="grid gap-1">
          <TeamLine
            href={`/teams/${match.homeTeamId}`}
            name={match.homeTeamName}
            score={match.homeScore}
            highlight={match.homeScore > match.awayScore}
          />
          <TeamLine
            href={`/teams/${match.awayTeamId}`}
            name={match.awayTeamName}
            score={match.awayScore}
            highlight={match.awayScore > match.homeScore}
          />
        </div>
      </div>

      <div className="text-right text-sm text-slate-500">
        {match.status === "live" ? `${match.minute ?? 0}'` : "详情"}
      </div>
    </article>
  );
}

function TeamLine({
  href,
  highlight,
  name,
  score
}: {
  href: string;
  highlight: boolean;
  name: string;
  score: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <Link className={`truncate hover:text-grass ${highlight ? "font-bold text-ink" : "text-slate-700"}`} href={href}>
        {name}
      </Link>
      <span className={`w-8 text-right tabular-nums ${highlight ? "font-black text-ink" : "text-slate-600"}`}>
        {score}
      </span>
    </div>
  );
}
