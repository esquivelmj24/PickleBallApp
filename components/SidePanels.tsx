import { ALL_LEVELS } from "@/lib/levels";
import type { Match, Player, TierCount } from "@/lib/types";
import { Avatar } from "./Avatar";
import { ArrowUpRightIcon, MedalIcon, SparklesIcon, TrophyIcon } from "./icons";
import { timeAgo } from "@/lib/format";

export function TopFive({ players }: { players: Player[] }) {
  const hasResults = players.some((player) => player.gamesPlayed > 0);

  return (
    <section className="panel leaderboard-panel" aria-labelledby="top-five-title">
      <div className="leaderboard-glow" aria-hidden />
      <div className="panel-head leaderboard-head">
        <div className="section-mark">
          <TrophyIcon size={18} />
        </div>
        <div>
          <span className="eyebrow eyebrow-light">Leaderboard</span>
          <h2 id="top-five-title">Top 5 players</h2>
        </div>
        <span className="live-chip">
          <span />
          Live
        </span>
      </div>

      {players.length === 0 ? (
        <div className="leaderboard-empty">
          <div className="empty-ball">
            <span />
            <span />
            <span />
          </div>
          <p>Ranks appear as soon as your roster takes the court.</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          {players.map((player, index) => (
            <div className={`leaderboard-row ${index === 0 ? "is-first" : ""}`} key={player.id}>
              <MedalIcon rank={index + 1} />
              <Avatar name={player.name} size="sm" />
              <div className="leaderboard-player">
                <strong>{player.name}</strong>
                <span>
                  {player.isNR ? "NR" : player.rating.toFixed(1)} · {player.levelLabel}
                </span>
              </div>
              <div className="leaderboard-record">
                <strong>{player.wins}</strong>
                <span>{player.gamesPlayed} played</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="leaderboard-foot">
        <SparklesIcon size={15} />
        <span>
          {hasResults
            ? "Ranked by wins, then point differential and rating."
            : "Sorted by committee rating until the first result is recorded."}
        </span>
      </div>
    </section>
  );
}

export function LevelGuide({ tiers, total }: { tiers: TierCount[]; total: number }) {
  return (
    <section className="panel level-panel" aria-labelledby="level-guide-title">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Rating bands</span>
          <h2 id="level-guide-title">Level key</h2>
        </div>
        <span className="panel-count">{total} players</span>
      </div>

      <div className="tier-list">
        {ALL_LEVELS.map((level) => {
          const count = tiers.find((tier) => tier.key === level.key)?.count ?? 0;
          const percent = total ? Math.round((count / total) * 100) : 0;
          return (
            <div className="tier-row" key={level.key}>
              <div className="tier-row-head">
                <span className="level-dot" style={{ background: level.color }} />
                <strong>{level.label}</strong>
                <span className="tier-range">
                  {level.key === "not-rated"
                    ? "Unknown rate"
                    : `${level.min.toFixed(1)} – ${level.max.toFixed(1)}`}
                </span>
                <span className="tier-count">{count}</span>
              </div>
              <div className="tier-bar">
                <span
                  style={{
                    width: count ? `${Math.max(percent, 5)}%` : "0%",
                    background: level.color,
                  }}
                />
              </div>
              <span className="tier-description">{level.description}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RecentResults({ matches }: { matches: Match[] }) {
  return (
    <section className="panel results-panel" aria-labelledby="recent-results-title">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Scorebook</span>
          <h2 id="recent-results-title">Recent results</h2>
        </div>
        <ArrowUpRightIcon size={18} className="muted-icon" />
      </div>

      {matches.length === 0 ? (
        <p className="empty-copy">Completed courts will land here.</p>
      ) : (
        <div className="result-list">
          {matches.slice(0, 4).map((match) => {
            const team1Won = match.winner === 1;
            return (
              <div className="result-row" key={match.id}>
                <div className="result-meta">
                  <span>Court {match.court}</span>
                  <span>{timeAgo(match.completedAt)}</span>
                </div>
                <div className={`result-team ${team1Won ? "is-winner" : ""}`}>
                  <span className="result-names">
                    {match.team1.map((player) => player.name).join(" & ")}
                  </span>
                  <strong>{match.team1Score}</strong>
                </div>
                <div className={`result-team ${!team1Won ? "is-winner" : ""}`}>
                  <span className="result-names">
                    {match.team2.map((player) => player.name).join(" & ")}
                  </span>
                  <strong>{match.team2Score}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function TopWinRate({ players }: { players: Player[] }) {
  return (
    <section className="panel win-rate-panel" aria-labelledby="win-rate-title">
      <div className="panel-head">
        <div className="section-mark">
          <SparklesIcon size={18} />
        </div>
        <div>
          <span className="eyebrow">Performance</span>
          <h2 id="win-rate-title">Top 20 win rates</h2>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="win-rate-empty">
          <p className="empty-copy">Ranks appear as soon as players complete games.</p>
        </div>
      ) : (
        <div className="win-rate-list">
          {players.map((player, index) => (
            <div className="win-rate-row" key={player.id}>
              <span className="win-rate-rank">{index + 1}</span>
              <Avatar name={player.name} size="sm" />
              <div className="win-rate-player">
                <strong>{player.name}</strong>
                <span>{player.levelLabel}</span>
              </div>
              <div className="win-rate-value">
                <strong>{player.winRate}%</strong>
                <span>{player.wins}W / {player.gamesPlayed}G</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
