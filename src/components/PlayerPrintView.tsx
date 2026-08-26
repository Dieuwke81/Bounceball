import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Player, Trophy, TrophyType, GameSession, MatchResult } from '../types';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';

/* ============================================================================
 * Helpers
 * ========================================================================== */

const toMs = (d: string) => {
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const hasAnyResults = (s: GameSession) =>
  (Array.isArray(s.round1Results) && s.round1Results.length > 0) ||
  (Array.isArray(s.round2Results) && s.round2Results.length > 0);

const sumGoals = (goals: any[]) =>
  (goals || []).reduce((sum, g) => sum + (Number(g?.count) || 0), 0);

const ordinalNl = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n}e`;
};

type StandingRow = {
  pts: number;
  gf: number;
  gd: number;
  matches: number;
};

type DefenseRow = {
  conceded: number;
  matches: number;
};

type SeasonMeta = {
  totalNights: number;
  minNights: number;
  nightsByPlayer: Map<number, number>;
  eligibleIds: Set<number>;
};

/**
 * Seizoen-avonden tellen (met resultaten) + aanwezigheid per speler.
 */
const computeSeasonMeta = (params: {
  history: GameSession[];
  allowedIds: Set<number>;
}): SeasonMeta => {
  const { history, allowedIds } = params;

  const nightsByPlayer = new Map<number, number>();

  const seasonSessions = (history || []).filter((s) => hasAnyResults(s));

  seasonSessions.forEach((s) => {
    const attending = new Set<number>();

    const r1 = s.teams || [];
    r1.flat().forEach((p) => {
      if (allowedIds.has(p.id)) attending.add(p.id);
    });

    const r2 = ((s as any).round2Teams ?? s.teams ?? []) as Player[][];
    r2.flat().forEach((p) => {
      if (allowedIds.has(p.id)) attending.add(p.id);
    });

    attending.forEach((id) => {
      nightsByPlayer.set(id, (nightsByPlayer.get(id) || 0) + 1);
    });
  });

  const totalNights = seasonSessions.length;
  const minNights = Math.max(1, Math.round(totalNights / 2));

  const eligibleIds = new Set<number>();
  nightsByPlayer.forEach((count, id) => {
    if (count >= minNights) eligibleIds.add(id);
  });

  return {
    totalNights,
    minNights,
    nightsByPlayer,
    eligibleIds,
  };
};

/**
 * Seizoen aggregaties.
 */
const computeSeasonAggregates = (params: {
  history: GameSession[];
  allowedIds: Set<number>;
}) => {
  const { history, allowedIds } = params;

  const standings = new Map<number, StandingRow>();
  const goalsForPlayer = new Map<number, number>();
  const defense = new Map<number, DefenseRow>();

  const ensureStanding = (id: number) => {
    if (!standings.has(id)) {
      standings.set(id, {
        pts: 0,
        gf: 0,
        gd: 0,
        matches: 0,
      });
    }

    return standings.get(id)!;
  };

  const ensureDefense = (id: number) => {
    if (!defense.has(id)) {
      defense.set(id, {
        conceded: 0,
        matches: 0,
      });
    }

    return defense.get(id)!;
  };

  const addPlayerGoals = (goalsArr: any[]) => {
    (goalsArr || []).forEach((g) => {
      const pid = Number(g?.playerId);
      const c = Number(g?.count) || 0;

      if (!Number.isFinite(pid) || pid <= 0 || c <= 0) return;
      if (!allowedIds.has(pid)) return;

      goalsForPlayer.set(
        pid,
        (goalsForPlayer.get(pid) || 0) + c
      );
    });
  };

  const applyMatch = (
    teamsForRound: Player[][] | undefined,
    match: MatchResult
  ) => {
    const rawT1 = teamsForRound?.[match.team1Index] || [];
    const rawT2 = teamsForRound?.[match.team2Index] || [];

    if (!rawT1.length || !rawT2.length) return;

    const s1 = sumGoals(match.team1Goals || []);
    const s2 = sumGoals(match.team2Goals || []);

    addPlayerGoals(match.team1Goals || []);
    addPlayerGoals(match.team2Goals || []);

    const t1 = rawT1.filter((p) => allowedIds.has(p.id));
    const t2 = rawT2.filter((p) => allowedIds.has(p.id));

    t1.forEach((p) => {
      const row = ensureStanding(p.id);

      row.gf += s1;
      row.gd += s1 - s2;
      row.matches += 1;

      if (s1 > s2) row.pts += 3;
      else if (s1 === s2) row.pts += 1;
    });

    t2.forEach((p) => {
      const row = ensureStanding(p.id);

      row.gf += s2;
      row.gd += s2 - s1;
      row.matches += 1;

      if (s2 > s1) row.pts += 3;
      else if (s2 === s1) row.pts += 1;
    });

    t1.forEach((p) => {
      const d = ensureDefense(p.id);
      d.conceded += s2;
      d.matches += 1;
    });

    t2.forEach((p) => {
      const d = ensureDefense(p.id);
      d.conceded += s1;
      d.matches += 1;
    });
  };

  (history || []).forEach((session) => {
    if (!hasAnyResults(session)) return;

    const teamsR1 = session.teams || [];
    const teamsR2 = ((session as any).round2Teams ??
      session.teams ??
      []) as Player[][];

    (session.round1Results || []).forEach((m) =>
      applyMatch(teamsR1, m)
    );

    (session.round2Results || []).forEach((m) =>
      applyMatch(teamsR2, m)
    );
  });

  return {
    standings,
    goalsForPlayer,
    defense,
  };
};

const rankStanding = (
  standings: Map<number, StandingRow>,
  playerId: number,
  eligibleIds: Set<number>
) => {
  const rows = [...standings.entries()]
    .filter(([id]) => eligibleIds.has(id))
    .map(([id, r]) => ({
      id,
      pts: r.pts,
      gf: r.gf,
      gd: r.gd,
      matches: r.matches,
      avg: r.matches > 0 ? r.pts / r.matches : 0,
    }));

  rows.sort(
    (a, b) =>
      b.avg - a.avg ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.id - b.id
  );

  const idx = rows.findIndex((r) => r.id === playerId);
  return idx >= 0 ? idx + 1 : 0;
};

const rankTopScorer = (
  goalsForPlayer: Map<number, number>,
  standings: Map<number, StandingRow>,
  playerId: number,
  eligibleIds: Set<number>
) => {
  const rows = [...eligibleIds].map((id) => {
    const goals = goalsForPlayer.get(id) || 0;
    const matches = standings.get(id)?.matches || 0;
    const avg = matches > 0 ? goals / matches : 0;

    return {
      id,
      goals,
      matches,
      avg,
    };
  });

  rows.sort(
    (a, b) =>
      b.avg - a.avg ||
      b.goals - a.goals ||
      a.id - b.id
  );

  const idx = rows.findIndex((r) => r.id === playerId);
  const mine = rows.find((r) => r.id === playerId);

  return {
    rank: idx >= 0 ? idx + 1 : 0,
    myGoals: goalsForPlayer.get(playerId) || 0,
    myAvg: mine ? mine.avg : 0,
  };
};

const rankDefender = (
  defense: Map<number, DefenseRow>,
  playerId: number,
  eligibleIds: Set<number>
) => {
  const rows = [...defense.entries()]
    .filter(([id]) => eligibleIds.has(id))
    .map(([id, d]) => ({
      id,
      concededPerMatch:
        d.matches > 0
          ? d.conceded / d.matches
          : Infinity,
      matches: d.matches,
    }))
    .filter((r) => r.matches > 0);

  rows.sort(
    (a, b) =>
      a.concededPerMatch - b.concededPerMatch ||
      b.matches - a.matches ||
      a.id - b.id
  );

  const idx = rows.findIndex((r) => r.id === playerId);
  const mine = defense.get(playerId);

  const myAvg =
    mine && mine.matches > 0
      ? mine.conceded / mine.matches
      : Infinity;

  return {
    rank: idx >= 0 ? idx + 1 : 0,
    concededPerMatch: myAvg,
  };
};

/* ============================================================================
 * PrintChart
 * ========================================================================== */

const PrintChart: React.FC<{
  data: { date: string; rating: number }[];
  title: string;
}> = ({ data, title }) => {
  if (!data || data.length < 2) return null;

  const width = 900;
  const height = 170;
  const padding = 42;

  const minRating = Math.min(...data.map((d) => d.rating));
  const maxRating = Math.max(...data.map((d) => d.rating));
  const range = maxRating - minRating || 1;

  const minY = minRating - range * 0.1;
  const maxY = maxRating + range * 0.1;

  const getX = (index: number) =>
    (index / (data.length - 1)) *
      (width - padding * 2) +
    padding;

  const getY = (rating: number) =>
    height -
    padding -
    ((rating - minY) / (maxY - minY)) *
      (height - padding * 2);

  const points = data
    .map(
      (d, i) =>
        `${getX(i)},${getY(d.rating)}`
    )
    .join(' ');

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Nu') return 'Nu';

    return new Date(dateStr).toLocaleDateString(
      'nl-NL',
      {
        month: 'short',
        year: '2-digit',
      }
    );
  };

  return (
    <div className="chart-card break-inside-avoid">
      <h5 className="chart-title">{title}</h5>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        <defs>
          <linearGradient
            id={`ratingLine-${title.replace(/\s+/g, '-')}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="35%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        <polyline
          fill="none"
          stroke={`url(#ratingLine-${title.replace(/\s+/g, '-')})`}
          strokeWidth="4"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <text
          x={padding - 8}
          y={getY(maxRating)}
          className="chart-axis-label"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {maxRating.toFixed(1)}
        </text>

        <text
          x={padding - 8}
          y={getY(minRating)}
          className="chart-axis-label"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {minRating.toFixed(1)}
        </text>

        <text
          x={getX(0)}
          y={height - 18}
          className="chart-axis-label"
          textAnchor="start"
        >
          {formatDate(data[0].date)}
        </text>

        <text
          x={getX(Math.floor(data.length / 2))}
          y={height - 18}
          className="chart-axis-label"
          textAnchor="middle"
        >
          {formatDate(
            data[Math.floor(data.length / 2)].date
          )}
        </text>

        <text
          x={getX(data.length - 1)}
          y={height - 18}
          className="chart-axis-label"
          textAnchor="end"
        >
          {formatDate(data[data.length - 1].date)}
        </text>

        <circle
          cx={getX(data.length - 1)}
          cy={getY(data[data.length - 1].rating)}
          r="7"
          fill="#ec4899"
        />

        <circle
          cx={getX(data.length - 1)}
          cy={getY(data[data.length - 1].rating)}
          r="3.5"
          fill="#0f172a"
        />

        <text
          x={getX(data.length - 1)}
          y={
            getY(
              data[data.length - 1].rating
            ) - 14
          }
          className="chart-current-value"
          textAnchor="end"
        >
          {data[data.length - 1].rating.toFixed(2)}
        </text>
      </svg>
    </div>
  );
};

/* ============================================================================
 * Component
 * ========================================================================== */

interface PlayerPrintViewProps {
  player: Player;
  stats: any;
  trophies: Trophy[];
  players: Player[];
  history: GameSession[];
  seasonHistory: { date: string; rating: number }[];
  allTimeHistory: { date: string; rating: number }[];
  competitionName?: string | null;
  onClose: () => void;
}

const PlayerPrintView: React.FC<
  PlayerPrintViewProps
> = ({
  player,
  stats,
  trophies,
  players,
  history,
  seasonHistory,
  allTimeHistory,
  competitionName,
  onClose,
}) => {
  const playerMap = useMemo(
    () =>
      new Map(
        players.map((p) => [p.id, p])
      ),
    [players]
  );

  useEffect(() => {
    let closed = false;

    const printTimer = window.setTimeout(() => {
      if (!closed) {
        window.print();
      }
    }, 350);

    const closeFallbackTimer = window.setTimeout(() => {
      if (!closed) {
        closed = true;
        onClose();
      }
    }, 30000);

    const handleAfterPrint = () => {
      if (closed) return;

      closed = true;
      window.clearTimeout(closeFallbackTimer);
      onClose();
    };

    window.addEventListener(
      'afterprint',
      handleAfterPrint
    );

    return () => {
      closed = true;
      window.clearTimeout(printTimer);
      window.clearTimeout(
        closeFallbackTimer
      );
      window.removeEventListener(
        'afterprint',
        handleAfterPrint
      );
    };
  }, [onClose]);

  const getTrophyContent = (
    type: TrophyType
  ) => {
    /*
     * Belangrijk:
     * Dit zijn gewone URL's en GEEN Markdown-links.
     * Daardoor kan de printweergave de afbeeldingen
     * correct laden.
     */
    const images: Record<string, string> = {
      Verdediger:
        'https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png',

      Topscoorder:
        'https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png',

      Clubkampioen:
        'https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png',

      '2de':
        'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',

      '3de':
        'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',

      'Speler van het jaar':
        'https://i.postimg.cc/76pPxbqT/Zonder-titel-(200-x-200-px)-20251203-124822-0000.png',

      '1ste Introductietoernooi':
        'https://i.postimg.cc/YqWQ7mfx/Zonder-titel-(200-x-200-px)-20251203-123448-0000.png',

      '2de Introductietoernooi':
        'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',

      '3de Introductietoernooi':
        'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',

      '1ste NK':
        'https://i.postimg.cc/GhXMP4q5/20251203-184928-0000.png',

      '2de NK':
        'https://i.postimg.cc/wM0kkrcm/20251203-185040-0000.png',

      '3de NK':
        'https://i.postimg.cc/MpcYydnC/20251203-185158-0000.png',

      '1ste Wintertoernooi':
        'https://i.postimg.cc/YqWQ7mfx/Zonder-titel-(200-x-200-px)-20251203-123448-0000.png',

      '2de Wintertoernooi':
        'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',

      '3de Wintertoernooi':
        'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
    };

    const url = images[type];

    if (url) {
      return (
        <img
          src={url}
          alt={type}
          className="w-10 h-10 object-contain"
        />
      );
    }

    if (type === 'Verdediger') {
      return (
        <ShieldIcon className="w-8 h-8 text-slate-900" />
      );
    }

    return (
      <TrophyIcon className="w-8 h-8 text-slate-900" />
    );
  };

  /*
   * Percentage:
   * - samen: aantal keer samen / gespeelde wedstrijden
   * - overige categorieën: als de aangeleverde stats een object
   *   met wins/losses bevatten, wordt het winpercentage berekend.
   * - bij alleen een getal blijft de bestaande waarde staan en
   *   wordt een percentage alleen getoond wanneer dat betrouwbaar
   *   uit de beschikbare gegevens kan worden berekend.
   */
  const getRelationValues = (
    item: any
  ): {
    count: number;
    wins?: number;
    losses?: number;
    percentage?: number;
  } => {
    if (Array.isArray(item)) {
      const raw = item[1];

      if (
        raw &&
        typeof raw === 'object'
      ) {
        const wins = Number(
          raw.wins ??
            raw.w ??
            raw.win ??
            0
        );

        const losses = Number(
          raw.losses ??
            raw.l ??
            raw.loss ??
            0
        );

        const total = wins + losses;

        return {
          count:
            Number(
              raw.count ??
                raw.total ??
                total
            ) || 0,
          wins,
          losses,
          percentage:
            total > 0
              ? (wins / total) * 100
              : undefined,
        };
      }

      return {
        count: Number(raw) || 0,
      };
    }

    return {
      count:
        Number(
          item?.count ??
            item?.total ??
            0
        ) || 0,
      wins:
        item?.wins != null
          ? Number(item.wins)
          : undefined,
      losses:
        item?.losses != null
          ? Number(item.losses)
          : undefined,
      percentage:
        item?.percentage != null
          ? Number(item.percentage)
          : undefined,
    };
  };

  const RelationshipSection: React.FC<{
    title: string;
    data: any[];
    variant?: string;
    mode?: 'frequent' | 'winrate';
  }> = ({
    title,
    data,
    variant,
    mode = 'winrate',
  }) => {
    const safeData = Array.isArray(data)
      ? data
      : [];

    return (
      <div
        className={`break-inside-avoid rel-card ${
          variant || ''
        }`}
      >
        <h4 className="rel-title">
          {title}
        </h4>

        <ul className="text-xs">
          {safeData.length > 0 ? (
            safeData
              .slice(0, 5)
              .map(
                (
                  item: any,
                  idx: number
                ) => {
                  const id =
                    Array.isArray(item)
                      ? Number(item[0])
                      : Number(
                          item?.id
                        );

                  const p =
                    playerMap.get(id);

                  const rel =
                    getRelationValues(
                      item
                    );

                  const frequentPercentage =
                    stats.gamesPlayed > 0
                      ? (rel.count /
                          stats.gamesPlayed) *
                        100
                      : undefined;

                  const percentage =
                    mode === 'frequent'
                      ? frequentPercentage
                      : rel.percentage;

                  return (
                    <li
                      key={`${id}-${idx}`}
                      className="rel-row"
                    >
                      <span className="rel-name">
                        <span className="rel-rank">
                          {idx + 1}
                        </span>

                        {p
                          ? p.name
                          : `Speler ${id}`}
                      </span>

                      <span className="rel-right">
                        <span className="rel-count">
                          {mode ===
                          'frequent'
                            ? `${rel.count}x samen`
                            : rel.wins !=
                                  null &&
                              rel.losses !=
                                null
                            ? `${rel.wins}W - ${rel.losses}V`
                            : `${rel.count}x`}
                        </span>

                        {percentage !=
                          null &&
                          Number.isFinite(
                            percentage
                          ) && (
                            <span className="rel-percentage">
                              {Math.round(
                                percentage
                              )}
                              %
                            </span>
                          )}
                      </span>
                    </li>
                  );
                }
              )
          ) : (
            <li className="text-slate-400 italic py-1">
              - Geen data -
            </li>
          )}
        </ul>
      </div>
    );
  };

  const avgPoints =
    stats.gamesPlayed > 0
      ? (Number(stats.points) || 0) /
        stats.gamesPlayed
      : 0;

  const allowedIds = useMemo(
    () =>
      new Set(
        players.map((p) => p.id)
      ),
    [players]
  );

  const seasonMeta = useMemo(
    () =>
      computeSeasonMeta({
        history: history || [],
        allowedIds,
      }),
    [history, allowedIds]
  );

  const seasonAttendance = useMemo(() => {
    const attendedNights =
      seasonMeta.nightsByPlayer.get(
        player.id
      ) || 0;

    return {
      attendedNights,
      totalNights:
        seasonMeta.totalNights,
    };
  }, [seasonMeta, player.id]);

  const eligible50 =
    seasonAttendance.totalNights > 0 &&
    seasonAttendance.attendedNights /
      seasonAttendance.totalNights >=
      0.5;

  const seasonRanks = useMemo(() => {
    const {
      standings,
      goalsForPlayer,
      defense,
    } =
      computeSeasonAggregates({
        history: history || [],
        allowedIds,
      });

    const position =
      rankStanding(
        standings,
        player.id,
        seasonMeta.eligibleIds
      );

    const ts =
      rankTopScorer(
        goalsForPlayer,
        standings,
        player.id,
        seasonMeta.eligibleIds
      );

    const def =
      rankDefender(
        defense,
        player.id,
        seasonMeta.eligibleIds
      );

    return {
      position,
      topscorerRank: ts.rank,
      topscorerGoals: ts.myGoals,
      topscorerAvg: ts.myAvg,
      defenderRank: def.rank,
      defenderAvgAgainst:
        def.concededPerMatch,
      minNights:
        seasonMeta.minNights,
    };
  }, [
    history,
    player.id,
    allowedIds,
    seasonMeta.eligibleIds,
    seasonMeta.minNights,
  ]);

  const seasonTitle =
    (competitionName || '').trim() ||
    'Competitie';

  return createPortal(
    <div className="print-portal">
      <style>
        {`
          /* ============================================================
           * PRINT RESET
           * ========================================================== */

          @media print {
            html,
            body {
              background: #fff !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              min-height: 100% !important;
            }

            body::before,
            body::after {
              display: none !important;
              content: none !important;
            }

            body > *:not(.print-portal) {
              display: none !important;
            }

            @page {
              size: A4 landscape;
              margin: 8mm;
            }

            .print-portal {
              display: block !important;
              visibility: visible !important;
              position: relative !important;
              width: 100% !important;
              min-height: 100% !important;
              background: #fff !important;
              color: #0f172a !important;
              font-family:
                ui-sans-serif,
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;
              z-index: 999999 !important;
            }

            .print-page {
              width: 100%;
              min-height: 180mm;
              box-sizing: border-box;
              break-after: page;
              page-break-after: always;
              position: relative;
            }

            .print-page:last-child {
              break-after: auto;
              page-break-after: auto;
            }

            a[href]::after,
            a::after {
              content: "" !important;
            }

            img {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }

          /* ============================================================
           * COLORS
           * ========================================================== */

          :root {
            --tile-blue: #3b82f6;
            --tile-orange: #f59e0b;
            --tile-purple: #8b5cf6;
            --tile-yellow: #fbbf24;
            --tile-pink: #ec4899;
            --tile-green: #22c55e;
            --tile-red: #ef4444;
            --tile-teal: #14b8a6;

            --ink: #0f172a;
            --muted: #475569;
            --border: #cbd5e1;
            --paper: #ffffff;
            --shadow: rgba(15, 23, 42, 0.10);
          }

          .print-portal {
            background: #fff;
            color: var(--ink);
          }

          /* ============================================================
           * GENERAL
           * ========================================================== */

          .print-page {
            padding: 8mm 9mm;
            box-sizing: border-box;
          }

          .page-footer {
            position: absolute;
            bottom: 1mm;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
          }

          .header-wrap {
            border-bottom: 2px solid var(--ink);
            padding-bottom: 12px;
            margin-bottom: 16px;
            position: relative;
          }

          .header-wrap::after {
            content: "";
            position: absolute;
            left: 0;
            bottom: -2px;
            width: 100%;
            height: 6px;
            background: linear-gradient(
              90deg,
              var(--tile-red),
              var(--tile-orange),
              var(--tile-yellow),
              var(--tile-green),
              var(--tile-teal),
              var(--tile-blue),
              var(--tile-purple),
              var(--tile-pink)
            );
            opacity: 0.45;
          }

          .stat-box {
            border: 1.5px solid var(--border);
            padding: 10px 9px;
            border-radius: 14px;
            text-align: center;
            background: #fff;
            position: relative;
            overflow: hidden;
            box-shadow: 0 7px 18px var(--shadow);
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 84px;
          }

          .stat-box::before {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            width: 74px;
            height: 74px;
            border-radius: 999px;
            background: radial-gradient(
              circle at 30% 30%,
              rgba(255, 255, 255, 0.85),
              rgba(15, 23, 42, 0.05)
            );
            transform: translate(24px, -24px);
          }

          .tile-green {
            border-left: 9px solid var(--tile-green);
            background: linear-gradient(
              180deg,
              rgba(34, 197, 94, 0.14),
              rgba(34, 197, 94, 0.06)
            );
          }

          .tile-yellow {
            border-left: 9px solid var(--tile-yellow);
            background: linear-gradient(
              180deg,
              rgba(251, 191, 36, 0.16),
              rgba(251, 191, 36, 0.06)
            );
          }

          .tile-pink {
            border-left: 9px solid var(--tile-pink);
            background: linear-gradient(
              180deg,
              rgba(236, 72, 153, 0.14),
              rgba(236, 72, 153, 0.06)
            );
          }

          .tile-blue {
            border-left: 9px solid var(--tile-blue);
            background: linear-gradient(
              180deg,
              rgba(59, 130, 246, 0.14),
              rgba(59, 130, 246, 0.06)
            );
          }

          .tile-orange {
            border-left: 9px solid var(--tile-orange);
            background: linear-gradient(
              180deg,
              rgba(245, 158, 11, 0.16),
              rgba(245, 158, 11, 0.06)
            );
          }

          .tile-purple {
            border-left: 9px solid var(--tile-purple);
            background: linear-gradient(
              180deg,
              rgba(139, 92, 246, 0.14),
              rgba(139, 92, 246, 0.06)
            );
          }

          .tile-teal {
            border-left: 9px solid var(--tile-teal);
            background: linear-gradient(
              180deg,
              rgba(20, 184, 166, 0.14),
              rgba(20, 184, 166, 0.06)
            );
          }

          .tile-red {
            border-left: 9px solid var(--tile-red);
            background: linear-gradient(
              180deg,
              rgba(239, 68, 68, 0.14),
              rgba(239, 68, 68, 0.06)
            );
          }

          .print-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 9px;
            margin-bottom: 14px;
          }

          .stat-title {
            font-size: 9px;
            text-transform: uppercase;
            color: var(--muted);
            font-weight: 950;
            letter-spacing: 0.06em;
            line-height: 1.15;
            padding: 0 5px;
            margin-bottom: 4px;
            z-index: 1;
          }

          .stat-value {
            font-size: 21px;
            font-weight: 950;
            color: var(--ink);
            line-height: 1.05;
            z-index: 1;
          }

          .stat-sub {
            font-size: 9px;
            color: var(--muted);
            margin-top: 4px;
            font-weight: 800;
            line-height: 1.15;
            z-index: 1;
          }

          .result-grid {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
            justify-content: center;
            z-index: 1;
          }

          .result-text {
            display: flex;
            flex-direction: row;
            align-items: baseline;
            gap: 5px;
            line-height: 1.05;
          }

          .result-count {
            font-size: 14px;
            font-weight: 950;
            color: var(--ink);
            font-variant-numeric: tabular-nums;
          }

          .result-label {
            font-size: 8px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted);
          }

          /* ============================================================
           * TROPHIES
           * ========================================================== */

          .trophy-section {
            border: 1.5px solid var(--border);
            border-radius: 14px;
            padding: 12px;
            background: #fff;
            box-shadow: 0 7px 18px var(--shadow);
            margin-bottom: 14px;
          }

          .trophy-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
          }

          .trophy-card {
            border: 1px solid #e2e8f0;
            border-radius: 11px;
            padding: 8px;
            background: #f8fafc;
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 52px;
          }

          /* ============================================================
           * CHARTS
           * ========================================================== */

          .charts-page {
            display: flex;
            flex-direction: column;
            gap: 8px;
            overflow: hidden;
          }

          .chart-card {
            border: 1.5px solid var(--border);
            border-radius: 16px;
            background: #fff;
            padding: 8px 14px 6px;
            box-shadow: 0 7px 18px var(--shadow);
            break-inside: avoid;
            page-break-inside: avoid;
            flex: 0 0 auto;
          }

          .chart-title {
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            text-align: center;
            color: var(--ink);
            margin: 0 0 3px;
          }

          .chart-title::after {
            content: "";
            display: block;
            margin: 4px auto 0;
            width: 72px;
            height: 2px;
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              var(--tile-green),
              var(--tile-blue),
              var(--tile-purple),
              var(--tile-pink)
            );
            opacity: 0.70;
          }

          .chart-axis-label {
            font-size: 9px;
            fill: #64748b;
            font-weight: 700;
          }

          .chart-current-value {
            font-size: 11px;
            fill: #0f172a;
            font-weight: 950;
          }

          /* ============================================================
           * RELATIONSHIPS
           * ========================================================== */

          .relationships-page {
            padding-top: 7mm;
          }

          .relationships-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          .rel-card {
            border: 1.5px solid var(--border);
            border-radius: 14px;
            padding: 10px;
            background: #fff;
            box-shadow: 0 7px 18px var(--shadow);
            position: relative;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .rel-card::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 6px;
            background: linear-gradient(
              90deg,
              var(--tile-blue),
              var(--tile-purple),
              var(--tile-pink)
            );
            opacity: 0.55;
          }

          .rel-title {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--muted);
            font-weight: 950;
            letter-spacing: 0.08em;
            border-bottom: 1px solid rgba(226, 232, 240, 0.9);
            padding-bottom: 6px;
            margin: 8px 0 4px;
            position: relative;
            z-index: 1;
          }

          .rel-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid rgba(226, 232, 240, 0.85);
            position: relative;
            z-index: 1;
            break-inside: avoid;
          }

          .rel-row:last-child {
            border-bottom: 0;
          }

          .rel-name {
            min-width: 0;
            font-weight: 800;
            color: var(--ink);
            display: flex;
            align-items: center;
            gap: 7px;
          }

          .rel-rank {
            width: 18px;
            height: 18px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 18px;
            font-size: 10px;
            font-weight: 950;
            color: white;
            background: var(--tile-blue);
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
          }

          .rel-right {
            display: flex;
            align-items: center;
            gap: 5px;
            flex: 0 0 auto;
          }

          .rel-count {
            font-weight: 950;
            font-variant-numeric: tabular-nums;
            padding: 3px 7px;
            border-radius: 999px;
            border: 1px solid rgba(203, 213, 225, 0.9);
            color: var(--muted);
            background: rgba(15, 23, 42, 0.06);
            white-space: nowrap;
          }

          .rel-percentage {
            font-weight: 950;
            font-variant-numeric: tabular-nums;
            padding: 3px 7px;
            border-radius: 999px;
            border: 1px solid rgba(203, 213, 225, 0.9);
            color: var(--muted);
            background: #fff;
            white-space: nowrap;
          }

          /* Plaatfactor = turquoise */
          .rel-frequent {
            background: linear-gradient(
              180deg,
              rgba(20, 184, 166, 0.10),
              rgba(255, 255, 255, 0.92)
            );
          }

          .rel-frequent::before {
            background: linear-gradient(
              90deg,
              var(--tile-teal),
              var(--tile-blue)
            );
          }

          .rel-frequent .rel-rank {
            background: var(--tile-teal);
          }

          .rel-frequent .rel-count,
          .rel-frequent .rel-percentage {
            background: rgba(20, 184, 166, 0.12);
            border-color: rgba(20, 184, 166, 0.35);
          }

          /* Gouden duo = goud */
          .rel-best {
            background: linear-gradient(
              180deg,
              rgba(251, 191, 36, 0.16),
              rgba(255, 255, 255, 0.92)
            );
          }

          .rel-best::before {
            background: linear-gradient(
              90deg,
              #f59e0b,
              #fbbf24
            );
          }

          .rel-best .rel-rank {
            background: #f59e0b;
            color: #fff;
          }

          .rel-best .rel-count,
          .rel-best .rel-percentage {
            background: rgba(251, 191, 36, 0.18);
            border-color: rgba(245, 158, 11, 0.45);
            color: #92400e;
          }

          /* Favoriete slachtoffer = roze */
          .rel-easy {
            background: linear-gradient(
              180deg,
              rgba(236, 72, 153, 0.11),
              rgba(255, 255, 255, 0.92)
            );
          }

          .rel-easy::before {
            background: linear-gradient(
              90deg,
              #ec4899,
              #f472b6
            );
          }

          .rel-easy .rel-rank {
            background: #ec4899;
          }

          .rel-easy .rel-count,
          .rel-easy .rel-percentage {
            background: rgba(236, 72, 153, 0.10);
            border-color: rgba(236, 72, 153, 0.35);
            color: #be185d;
          }

          /* Slechtste medespeler = rood */
          .rel-worst {
            background: linear-gradient(
              180deg,
              rgba(239, 68, 68, 0.10),
              rgba(255, 255, 255, 0.92)
            );
          }

          .rel-worst::before {
            background: linear-gradient(
              90deg,
              var(--tile-red),
              var(--tile-orange)
            );
          }

          .rel-worst .rel-rank {
            background: var(--tile-red);
          }

          .rel-worst .rel-count,
          .rel-worst .rel-percentage {
            background: rgba(239, 68, 68, 0.10);
            border-color: rgba(239, 68, 68, 0.35);
          }

          /* Persoonlijke nachtmerrie = paars */
          .rel-hard {
            background: linear-gradient(
              180deg,
              rgba(139, 92, 246, 0.10),
              rgba(255, 255, 255, 0.92)
            );
          }

          .rel-hard::before {
            background: linear-gradient(
              90deg,
              var(--tile-purple),
              var(--tile-pink)
            );
          }

          .rel-hard .rel-rank {
            background: var(--tile-purple);
          }

          .rel-hard .rel-count,
          .rel-hard .rel-percentage {
            background: rgba(139, 92, 246, 0.12);
            border-color: rgba(139, 92, 246, 0.35);
          }

          /* ============================================================
           * SMALL SCREEN / NORMAL VIEW
           * ========================================================== */

          @media screen {
            .print-portal {
              position: fixed;
              inset: 0;
              overflow: auto;
              background: #fff;
              z-index: 999999;
            }

            .print-page {
              max-width: 1400px;
              margin: 0 auto;
            }
          }
        `}
      </style>

      {/* ================================================================
       * PAGE 1 — OVERVIEW
       * ============================================================= */}

      <div className="print-page">
        <div className="flex items-center justify-between header-wrap">
          <div className="flex items-center">
            {player.photoBase64 ? (
              <img
                src={player.photoBase64}
                alt={player.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-900 mr-5"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-900 mr-5 flex items-center justify-center text-3xl font-black">
                {player.name.charAt(0)}
              </div>
            )}

            <div>
              <h1 className="text-4xl font-black uppercase tracking-wide">
                {player.name}
              </h1>

              <div className="flex gap-2 mt-2 text-sm font-bold uppercase text-slate-600">
                {player.isKeeper && (
                  <span className="border border-slate-900 px-2 py-1 rounded">
                    Keeper
                  </span>
                )}

                {player.isFixedMember && (
                  <span className="border border-slate-900 px-2 py-1 rounded">
                    Lid
                  </span>
                )}

                <span className="border border-slate-900 px-2 py-1 rounded">
                  Rating: {player.rating.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Geen groot achtergrondlogo meer. */}
        </div>

        <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-4 uppercase">
          {seasonTitle}
        </h3>

        <div className="print-grid">
          <div className="stat-box tile-green">
            <div className="stat-title">
              Speelavonden aanwezig
            </div>

            <div className="stat-value">
              {seasonAttendance.attendedNights}/
              {seasonAttendance.totalNights}
            </div>

            <div className="stat-sub">
              Minimaal: {seasonRanks.minNights}{' '}
              avonden
            </div>
          </div>

          <div className="stat-box tile-yellow">
            <div className="stat-title">
              Competitie
            </div>

            <div className="stat-value">
              {eligible50
                ? ordinalNl(
                    seasonRanks.position
                  )
                : '—'}
            </div>

            {!eligible50 && (
              <div className="stat-sub">
                min 50% aanwezig
              </div>
            )}
          </div>

          <div className="stat-box tile-pink">
            <div className="stat-title">
              Topscoorder
            </div>

            <div className="stat-value">
              {eligible50
                ? ordinalNl(
                    seasonRanks.topscorerRank
                  )
                : '—'}
            </div>

            <div className="stat-sub">
              {eligible50
                ? `${seasonRanks.topscorerGoals} goals (${seasonRanks.topscorerAvg.toFixed(
                    2
                  )}/w)`
                : 'min 50% aanwezig'}
            </div>
          </div>

          <div className="stat-box tile-blue">
            <div className="stat-title">
              Verdediger
            </div>

            <div className="stat-value">
              {eligible50
                ? ordinalNl(
                    seasonRanks.defenderRank
                  )
                : '—'}
            </div>

            <div className="stat-sub">
              {eligible50 &&
              Number.isFinite(
                seasonRanks.defenderAvgAgainst
              )
                ? `${seasonRanks.defenderAvgAgainst.toFixed(
                    2
                  )} tegen / w`
                : 'min 50% aanwezig'}
            </div>
          </div>
        </div>

        <div className="print-grid">
          <div className="stat-box tile-orange">
            <div className="stat-title">
              Gespeelde wedstrijden
            </div>

            <div className="stat-value">
              {stats.gamesPlayed}
            </div>
          </div>

          <div className="stat-box tile-purple">
            <div className="stat-title">
              Resultaten
            </div>

            <div className="result-grid">
              <div className="result-text">
                <span className="result-count">
                  {stats.wins}
                </span>
                <span className="result-label">
                  Gewonnen
                </span>
              </div>

              <div className="result-text">
                <span className="result-count">
                  {stats.draws}
                </span>
                <span className="result-label">
                  Gelijk
                </span>
              </div>

              <div className="result-text">
                <span className="result-count">
                  {stats.losses}
                </span>
                <span className="result-label">
                  Verloren
                </span>
              </div>
            </div>
          </div>

          <div className="stat-box tile-teal">
            <div className="stat-title">
              Goals
            </div>

            <div className="stat-value">
              {stats.goalsScored}
            </div>
          </div>

          <div className="stat-box tile-red">
            <div className="stat-title">
              Gem. Punten
            </div>

            <div className="stat-value">
              {avgPoints.toFixed(2)}
            </div>
          </div>
        </div>

        {trophies.length > 0 && (
          <div className="trophy-section break-inside-avoid">
            <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-3 uppercase">
              Prijzenkast
            </h3>

            <div className="trophy-grid">
              {trophies.map((t) => (
                <div
                  key={t.id}
                  className="trophy-card"
                >
                  <div className="mr-1">
                    {getTrophyContent(t.type)}
                  </div>

                  <div>
                    <div className="font-black text-sm">
                      {t.type}
                    </div>

                    <div className="text-xs text-slate-500 font-bold">
                      {t.year}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="page-footer">
          Pagina 1 van 3
        </div>
      </div>

      {/* ================================================================
       * PAGE 2 — RATING GRAPHS
       * ============================================================= */}

      <div className="print-page charts-page">
        <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-4 uppercase">
          Rating verloop
        </h3>

        <PrintChart
          data={seasonHistory}
          title="Verloop huidig seizoen"
        />

        <PrintChart
          data={allTimeHistory}
          title="All-time verloop"
        />

        <div className="page-footer">
          Pagina 2 van 3
        </div>
      </div>

      {/* ================================================================
       * PAGE 3 — RELATIONSHIPS
       * ============================================================= */}

      <div className="print-page relationships-page">
        <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-3 uppercase">
          Statistieken vs spelers (Top 5)
        </h3>

        <div className="relationships-grid">
          <RelationshipSection
            title="Plakfactor: onlosmakelijk"
            data={
              stats.mostFrequentTeammates
            }
            variant="rel-frequent"
            mode="frequent"
          />

          <RelationshipSection
            title="Gouden duo (winstgarantie)"
            data={stats.bestTeammates}
            variant="rel-best"
            mode="winrate"
          />

          <RelationshipSection
            title="Samen de afgrond in..."
            data={stats.worstTeammates}
            variant="rel-worst"
            mode="winrate"
          />

          <RelationshipSection
            title="Mijn favoriete slachtoffer"
            data={stats.bestOpponents}
            variant="rel-easy"
            mode="winrate"
          />

          <RelationshipSection
            title="Mijn persoonlijke nachtmerrie"
            data={stats.worstOpponents}
            variant="rel-hard"
            mode="winrate"
          />
        </div>

        <div className="page-footer">
          Pagina 3 van 3
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
