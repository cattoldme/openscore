import type { StandingRow } from "@openscore/domain";

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <th className="w-12 py-3">#</th>
            <th className="py-3">球队</th>
            <th className="py-3 text-right">场</th>
            <th className="py-3 text-right">胜</th>
            <th className="py-3 text-right">平</th>
            <th className="py-3 text-right">负</th>
            <th className="py-3 text-right">净胜</th>
            <th className="py-3 text-right">积分</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId} className="border-b border-slate-100 last:border-0">
              <td className="py-3 font-semibold text-slate-500">{row.position}</td>
              <td className="py-3 font-semibold text-ink">{row.teamName}</td>
              <td className="py-3 text-right tabular-nums">{row.played}</td>
              <td className="py-3 text-right tabular-nums">{row.won}</td>
              <td className="py-3 text-right tabular-nums">{row.drawn}</td>
              <td className="py-3 text-right tabular-nums">{row.lost}</td>
              <td className="py-3 text-right tabular-nums">{row.goalDifference}</td>
              <td className="py-3 text-right font-black tabular-nums text-ink">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

