import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type {
  Player,
  Trophy,
  TrophyType,
  GameSession,
  MatchResult,
} from '../types';

import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';

/* ============================================================================
 * Helpers
 * ========================================================================== */

const sumGoals = (goals: any[]) =>
  (goals || []).reduce(
    (sum, g) => sum + (Number(g?.count) || 0),
    0
  );

const ordinalNl = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n}e`;
};

const hasAnyResults = (s: GameSession) =>
  (Array.isArray(s.round1Results) && s.round1Results.length > 0) ||
  (Array.isArray(s.round2Results) && s.round2Results.length > 0);

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

/* ============================================================================
 * Seizoen-meta
 * ========================================================================== */

const computeSeasonMeta = (params: {
  history: GameSession[];
  allowedIds: Set<number>;
}): SeasonMeta => {
  const { history, allowedIds } = params;

  const nightsByPlayer = new Map<number, number>();

  const seasonSessions = (history || []).filter((s) =>
    hasAnyResults(s)
  );

  seasonSessions.forEach((s) => {
    const attending = new Set<number>();

    const r1 = s.teams || [];

    r1.flat().forEach((p) => {
      if (allowedIds.has(p.id)) {
        attending.add(p.id);
      }
    });

    const r2 = ((s as any).round2Teams ??
      s.teams ??
      []) as Player[][];

    r2.flat().forEach((p) => {
      if (allowedIds.has(p.id)) {
        attending.add(p.id);
      }
    });

    attending.forEach((id) => {
      nightsByPlayer.set(
        id,
        (nightsByPlayer.get(id) || 0) + 1
      );
    });
  });

  const totalNights = seasonSessions.length;
  const minNights = Math.max(
    1,
    Math.round(totalNights / 2)
  );

  const eligibleIds = new Set<number>();

  nightsByPlayer.forEach((count, id) => {
    if (count >= minNights) {
      eligibleIds.add(id);
    }
  });

  return {
    totalNights,
    minNights,
    nightsByPlayer,
    eligibleIds,
  };
};

/* ============================================================================
 * Seizoen-statistieken
 * ========================================================================== */

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
      const count = Number(g?.count) || 0;

      if (!Number.isFinite(pid) || pid <= 0 || count <= 0) {
        return;
      }

      if (!allowedIds.has(pid)) {
        return;
      }

      goalsForPlayer.set(
        pid,
        (goalsForPlayer.get(pid) || 0) + count
      );
    });
  };

  const applyMatch = (
    teamsForRound: Player[][] | undefined,
    match: MatchResult
  ) => {
    const rawT1 =
      teamsForRound?.[match.team1Index] || [];

    const rawT2 =
      teamsForRound?.[match.team2Index] || [];

    if (!rawT1.length || !rawT2.length) {
      return;
    }

    const s1 = sumGoals(match.team1Goals || []);
    const s2 = sumGoals(match.team2Goals || []);

    addPlayerGoals(match.team1Goals || []);
    addPlayerGoals(match.team2Goals || []);

    const t1 = rawT1.filter((p) =>
      allowedIds.has(p.id)
    );

    const t2 = rawT2.filter((p) =>
      allowedIds.has(p.id)
    );

    t1.forEach((p) => {
      const row = ensureStanding(p.id);

      row.gf += s1;
      row.gd += s1 - s2;
      row.matches += 1;

      if (s1 > s2) {
        row.pts += 3;
      } else if (s1 === s2) {
        row.pts += 1;
      }
    });

    t2.forEach((p) => {
      const row = ensureStanding(p.id);

      row.gf += s2;
      row.gd += s2 - s1;
      row.matches += 1;

      if (s2 > s1) {
        row.pts += 3;
      } else if (s1 === s2) {
        row.pts += 1;
      }
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
    if (!hasAnyResults(session)) {
      return;
    }

    const teamsR1 = session.teams || [];

    const teamsR2 = ((session as any).round2Teams ??
      session.teams ??
      []) as Player[][];

    (session.round1Results || []).forEach((match) =>
      applyMatch(teamsR1, match)
    );

    (session.round2Results || []).forEach((match) =>
      applyMatch(teamsR2, match)
    );
  });

  return {
    standings,
    goalsForPlayer,
    defense,
  };
};

/* ============================================================================
 * Rankings
 * ========================================================================== */

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
      avg:
        r.matches > 0
          ? r.pts / r.matches
          : 0,
    }));

  rows.sort(
    (a, b) =>
      b.avg - a.avg ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.id - b.id
  );

  const idx = rows.findIndex(
    (r) => r.id === playerId
  );

  return idx >= 0 ? idx + 1 : 0;
};

const rankTopScorer = (
  goalsForPlayer: Map<number, number>,
  standings: Map<number, StandingRow>,
  playerId: number,
  eligibleIds: Set<number>
) => {
  const rows = [...eligibleIds].map((id) => {
    const goals =
      goalsForPlayer.get(id) || 0;

    const matches =
      standings.get(id)?.matches || 0;

    const avg =
      matches > 0
        ? goals / matches
        : 0;

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

  const idx = rows.findIndex(
    (r) => r.id === playerId
  );

  const mine = rows.find(
    (r) => r.id === playerId
  );

  return {
    rank: idx >= 0 ? idx + 1 : 0,
    myGoals:
      goalsForPlayer.get(playerId) || 0,
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
      a.concededPerMatch -
        b.concededPerMatch ||
      b.matches - a.matches ||
      a.id - b.id
  );

  const idx = rows.findIndex(
    (r) => r.id === playerId
  );

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
 * Print Chart
 * ========================================================================== */

const PrintChart: React.FC<{
  data: { date: string; rating: number }[];
  title: string;
}> = ({ data, title }) => {
  if (!data || data.length < 2) {
    return null;
  }

  const width = 900;
  const height = 300;
  const padding = 50;

  const minRating = Math.min(
    ...data.map((d) => d.rating)
  );

  const maxRating = Math.max(
    ...data.map((d) => d.rating)
  );

  const range =
    maxRating - minRating || 1;

  const minY =
    minRating - range * 0.1;

  const maxY =
    maxRating + range * 0.1;

  const getX = (index: number) =>
    (index / (data.length - 1)) *
      (width - padding * 2) +
    padding;

  const getY = (rating: number) =>
    height -
    padding -
    ((rating - minY) /
      (maxY - minY)) *
      (height - padding * 2);

  const points = data
    .map(
      (d, i) =>
        `${getX(i)},${getY(d.rating)}`
    )
    .join(' ');

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Nu') {
      return 'Nu';
    }

    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
      return dateStr;
    }

    return date.toLocaleDateString(
      'nl-NL',
      {
        month: 'short',
        year: '2-digit',
      }
    );
  };

  const last = data[data.length - 1];

  return (
    <div className="chart-card">
      <h4 className="chart-title">
        {title}
      </h4>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="print-chart-svg"
      >
        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="5 5"
        />

        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="5 5"
        />

        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="5 5"
        />

        <defs>
          <linearGradient
            id={`ratingLine-${title.replace(
              /\s/g,
              ''
            )}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stopColor="#22c55e"
            />
            <stop
              offset="35%"
              stopColor="#3b82f6"
            />
            <stop
              offset="70%"
              stopColor="#8b5cf6"
            />
            <stop
              offset="100%"
              stopColor="#ec4899"
            />
          </linearGradient>
        </defs>

        <polyline
          fill="none"
          stroke={`url(#ratingLine-${title.replace(
            /\s/g,
            ''
          )})`}
          strokeWidth="5"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <text
          x={padding - 10}
          y={getY(maxRating)}
          className="chart-axis"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {maxRating.toFixed(1)}
        </text>

        <text
          x={padding - 10}
          y={getY(minRating)}
          className="chart-axis"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {minRating.toFixed(1)}
        </text>

        <text
          x={getX(0)}
          y={height - 15}
          className="chart-axis"
          textAnchor="start"
        >
          {formatDate(data[0].date)}
        </text>

        <text
          x={getX(
            Math.floor(data.length / 2)
          )}
          y={height - 15}
          className="chart-axis"
          textAnchor="middle"
        >
          {formatDate(
            data[
              Math.floor(data.length / 2)
            ].date
          )}
        </text>

        <text
          x={getX(data.length - 1)}
          y={height - 15}
          className="chart-axis"
          textAnchor="end"
        >
          {formatDate(last.date)}
        </text>

        <circle
          cx={getX(data.length - 1)}
          cy={getY(last.rating)}
          r="8"
          fill="#3b82f6"
        />

        <circle
          cx={getX(data.length - 1)}
          cy={getY(last.rating)}
          r="4"
          fill="#ffffff"
        />

        <text
          x={getX(data.length - 1) - 5}
          y={
            getY(last.rating) - 18
          }
          className="chart-value"
          textAnchor="end"
        >
          {last.rating.toFixed(2)}
        </text>
      </svg>
    </div>
  );
};

/* ============================================================================
 * Relationship types
 * ========================================================================== */

type RelationshipItem = {
  id: number;
  percentage?: number;
  label?: string;
  count?: number;
};

/* ============================================================================
 * PlayerPrintView
 * ========================================================================== */

interface PlayerPrintViewProps {
  player: Player;
  stats: any;
  trophies: Trophy[];
  players: Player[];
  history: GameSession[];
  seasonHistory: {
    date: string;
    rating: number;
  }[];
  allTimeHistory: {
    date: string;
    rating: number;
  }[];
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

  /* --------------------------------------------------------------------------
   * Print openen en daarna sluiten
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 400);

    const handleAfterPrint = () => {
      onClose();
    };

    window.addEventListener(
      'afterprint',
      handleAfterPrint
    );

    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener(
        'afterprint',
        handleAfterPrint
      );
    };
  }, [onClose]);

  /* --------------------------------------------------------------------------
   * Prijzen
   * ------------------------------------------------------------------------ */

  const getTrophyContent = (
    type: TrophyType
  ) => {
    const images: {
      [key: string]: string;
    } = {
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
          className="trophy-image"
        />
      );
    }

    if (type === 'Verdediger') {
      return (
        <ShieldIcon className="trophy-icon" />
      );
    }

    return (
      <TrophyIcon className="trophy-icon" />
    );
  };

  /* --------------------------------------------------------------------------
   * Relatiegegevens
   *
   * PlayerDetail geeft:
   * freq, bestT, worstT, bestO, worstO
   *
   * We zetten die hier om naar één printformaat.
   * ------------------------------------------------------------------------ */

  const normalizeRelationshipData = (
    data: any[]
  ): RelationshipItem[] => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: any) => {
        if (Array.isArray(item)) {
          return {
            id: Number(item[0]),
            count: Number(item[1]) || 0,
          };
        }

        return {
          id: Number(item.id),
          percentage:
            Number.isFinite(
              Number(item.percentage)
            )
              ? Number(item.percentage)
              : undefined,
          label:
            typeof item.label === 'string'
              ? item.label
              : undefined,
          count:
            Number.isFinite(
              Number(item.count)
            )
              ? Number(item.count)
              : undefined,
        };
      })
      .filter(
        (item) =>
          Number.isFinite(item.id)
      );
  };

  const formatRelationshipValue = (
    item: RelationshipItem
  ) => {
    if (
      item.label &&
      item.label.trim().length > 0
    ) {
      return item.label;
    }

    if (
      typeof item.count === 'number'
    ) {
      return `${item.count}x`;
    }

    if (
      typeof item.percentage === 'number'
    ) {
      return `${item.percentage}%`;
    }

    return '';
  };

  const RelationshipCard: React.FC<{
    title: string;
    data: any[];
    variant:
      | 'frequent'
      | 'best'
      | 'worst'
      | 'easy'
      | 'hard';
    icon: React.ReactNode;
  }> = ({
    title,
    data,
    variant,
    icon,
  }) => {
    const normalized =
      normalizeRelationshipData(
        data
      ).slice(0, 5);

    return (
      <div
        className={`relationship-card rel-${variant}`}
      >
        <div className="relationship-header">
          <div className="relationship-icon">
            {icon}
          </div>

          <h4>{title}</h4>
        </div>

        <div className="relationship-list">
          {normalized.length > 0 ? (
            normalized.map(
              (item, index) => {
                const related =
                  playerMap.get(
                    item.id
                  );

                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="relationship-row"
                  >
                    <div className="relationship-player">
                      <span className="rank-badge">
                        {index + 1}
                      </span>

                      <span>
                        {related
                          ? related.name
                          : `Speler ${item.id}`}
                      </span>
                    </div>

                    <span className="relationship-value">
                      {formatRelationshipValue(
                        item
                      )}
                    </span>
                  </div>
                );
              }
            )
          ) : (
            <div className="empty-relationship">
              Geen data
            </div>
          )}
        </div>
      </div>
    );
  };

  /* --------------------------------------------------------------------------
   * Seizoen-ranking
   * ------------------------------------------------------------------------ */

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

  const seasonAttendance =
    useMemo(() => {
      const attendedNights =
        seasonMeta.nightsByPlayer.get(
          player.id
        ) || 0;

      return {
        attendedNights,
        totalNights:
          seasonMeta.totalNights,
      };
    }, [
      seasonMeta,
      player.id,
    ]);

  const eligible50 =
    seasonAttendance.totalNights >
      0 &&
    seasonAttendance.attendedNights /
      seasonAttendance.totalNights >=
      0.5;

  const seasonRanks = useMemo(() => {
    const {
      standings,
      goalsForPlayer,
      defense,
    } = computeSeasonAggregates({
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
      topscorerGoals:
        ts.myGoals,
      topscorerAvg:
        ts.myAvg,
      defenderRank:
        def.rank,
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

  const avgPoints =
    stats.gamesPlayed > 0
      ? (Number(stats.points) || 0) /
        stats.gamesPlayed
      : 0;

  /* ==========================================================================
   * RENDER
   * ======================================================================== */

  return createPortal(
    <div className="print-portal">
      <style>{`
        /* ================================================================
         * NORMAAL SCHERM
         * ================================================================ */

        @media screen {
          .print-portal {
            display: none !important;
          }
        }

        /* ================================================================
         * PRINT
         * ================================================================ */

        @media print {

          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body > *:not(.print-portal) {
            display: none !important;
          }

          .print-portal {
            display: block !important;
            width: 100%;
            min-height: 100%;
            background: white;
            color: #0f172a;
            font-family:
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              Roboto,
              Arial,
              sans-serif;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }

          .print-page {
            width: 100%;
            min-height: 194mm;
            position: relative;
            page-break-after: always;
            break-after: page;
            padding: 3mm;
          }

          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          /* ============================================================
           * ALGEMEEN
           * ========================================================== */

          .page-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            color: #94a3b8;
            font-size: 8px;
            font-weight: 700;
          }

          .section-title {
            font-size: 18px;
            font-weight: 950;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin: 0 0 10px;
            padding-bottom: 6px;
            border-bottom: 2px solid #cbd5e1;
          }

          /* ============================================================
           * HEADER
           * ========================================================== */

          .player-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            margin-bottom: 12px;
            border-bottom: 2px solid #0f172a;
            position: relative;
          }

          .player-header::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: -2px;
            height: 5px;
            background:
              linear-gradient(
                90deg,
                #ef4444,
                #f59e0b,
                #fbbf24,
                #22c55e,
                #14b8a6,
                #3b82f6,
                #8b5cf6,
                #ec4899
              );
            opacity: 0.55;
          }

          .player-info {
            display: flex;
            align-items: center;
          }

          .player-photo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #0f172a;
            margin-right: 14px;
          }

          .player-initial {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 2px solid #0f172a;
            margin-right: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 25px;
            font-weight: 950;
          }

          .player-name {
            font-size: 29px;
            font-weight: 950;
            text-transform: uppercase;
            line-height: 1;
          }

          .player-tags {
            display: flex;
            gap: 6px;
            margin-top: 7px;
          }

          .player-tag {
            border: 1px solid #0f172a;
            border-radius: 6px;
            padding: 3px 7px;
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .club-logo {
            height: 48px;
            width: auto;
            object-fit: contain;
          }

          /* ============================================================
           * STAT CARDS
           * ========================================================== */

          .stats-grid {
            display: grid;
            grid-template-columns:
              repeat(4, 1fr);
            gap: 9px;
            margin-bottom: 12px;
          }

          .stat-card {
            min-height: 74px;
            border: 1px solid #cbd5e1;
            border-left-width: 7px;
            border-radius: 12px;
            padding: 8px 10px;
            background: white;
            box-shadow:
              0 4px 12px
              rgba(15,23,42,0.08);
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .stat-title {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-weight: 950;
            color: #475569;
            line-height: 1.1;
          }

          .stat-value {
            font-size: 19px;
            font-weight: 950;
            color: #0f172a;
            line-height: 1.05;
            margin-top: 3px;
          }

          .stat-sub {
            font-size: 8px;
            font-weight: 750;
            color: #64748b;
            margin-top: 3px;
          }

          .tile-green {
            border-left-color: #22c55e;
            background:
              linear-gradient(
                180deg,
                rgba(34,197,94,.13),
                white
              );
          }

          .tile-yellow {
            border-left-color: #fbbf24;
            background:
              linear-gradient(
                180deg,
                rgba(251,191,36,.14),
                white
              );
          }

          .tile-pink {
            border-left-color: #ec4899;
            background:
              linear-gradient(
                180deg,
                rgba(236,72,153,.13),
                white
              );
          }

          .tile-blue {
            border-left-color: #3b82f6;
            background:
              linear-gradient(
                180deg,
                rgba(59,130,246,.13),
                white
              );
          }

          .tile-orange {
            border-left-color: #f59e0b;
            background:
              linear-gradient(
                180deg,
                rgba(245,158,11,.13),
                white
              );
          }

          .tile-purple {
            border-left-color: #8b5cf6;
            background:
              linear-gradient(
                180deg,
                rgba(139,92,246,.13),
                white
              );
          }

          .tile-teal {
            border-left-color: #14b8a6;
            background:
              linear-gradient(
                180deg,
                rgba(20,184,166,.13),
                white
              );
          }

          .tile-red {
            border-left-color: #ef4444;
            background:
              linear-gradient(
                180deg,
                rgba(239,68,68,.13),
                white
              );
          }

          /* ============================================================
           * RESULTATEN
           * ========================================================== */

          .result-row {
            display: flex;
            justify-content: center;
            gap: 13px;
            margin-top: 4px;
          }

          .result-number {
            font-size: 13px;
            font-weight: 950;
          }

          .result-label {
            font-size: 7px;
            font-weight: 850;
            text-transform: uppercase;
            color: #64748b;
          }

          /* ============================================================
           * PRIJZENKAST
           * ========================================================== */

          .trophy-card {
            border: 1px solid #cbd5e1;
            border-radius: 11px;
            padding: 6px 8px;
            display: flex;
            align-items: center;
            background: #fff;
            min-height: 44px;
          }

          .trophy-image {
            width: 32px;
            height: 32px;
            object-fit: contain;
            margin-right: 8px;
          }

          .trophy-icon {
            width: 28px;
            height: 28px;
            margin-right: 8px;
            color: #334155;
          }

          .trophy-name {
            font-size: 8px;
            font-weight: 950;
            line-height: 1.1;
          }

          .trophy-year {
            font-size: 7px;
            color: #64748b;
            font-weight: 750;
            margin-top: 2px;
          }

          .trophies-grid {
            display: grid;
            grid-template-columns:
              repeat(5, 1fr);
            gap: 7px;
          }

          .trophies-box {
            border: 1px solid #cbd5e1;
            border-radius: 13px;
            padding: 9px;
            box-shadow:
              0 4px 12px
              rgba(15,23,42,.06);
          }

          .trophies-title {
            text-align: center;
            font-size: 11px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .08em;
            margin-bottom: 7px;
          }

          /* ============================================================
           * PAGINA 2 - GRAFIEKEN
           * ========================================================== */

          .charts-page {
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .charts-header {
            font-size: 20px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .05em;
            margin-bottom: 14px;
          }

          .charts-grid {
            display: grid;
            grid-template-columns:
              1fr 1fr;
            gap: 14px;
          }

          .chart-card {
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            padding: 12px;
            background: white;
            box-shadow:
              0 5px 15px
              rgba(15,23,42,.08);
          }

          .chart-title {
            text-align: center;
            font-size: 11px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .08em;
            margin: 0 0 5px;
            color: #0f172a;
          }

          .print-chart-svg {
            width: 100%;
            height: auto;
            display: block;
          }

          .chart-axis {
            fill: #64748b;
            font-size: 12px;
            font-weight: 700;
          }

          .chart-value {
            fill: #0f172a;
            font-size: 16px;
            font-weight: 950;
          }

          /* ============================================================
           * PAGINA 3 - RELATIES
           * ========================================================== */

          .relationships-page {
            display: flex;
            flex-direction: column;
          }

          .relationships-grid {
            display: grid;
            grid-template-columns:
              repeat(6, 1fr);
            gap: 11px;
          }

          .relationship-card {
            border: 1px solid #cbd5e1;
            border-radius: 13px;
            background: white;
            padding: 9px;
            box-shadow:
              0 5px 14px
              rgba(15,23,42,.08);
            overflow: hidden;
          }

          /*
           * Bovenste drie cards
           */
          .relationship-card:nth-child(1),
          .relationship-card:nth-child(2),
          .relationship-card:nth-child(3) {
            grid-column: span 2;
          }

          /*
           * Onderste twee cards:
           * iets breder zodat de pagina mooi gevuld wordt.
           */
          .relationship-card:nth-child(4),
          .relationship-card:nth-child(5) {
            grid-column: span 3;
          }

          .relationship-header {
            display: flex;
            align-items: center;
            gap: 7px;
            padding-bottom: 7px;
            margin-bottom: 2px;
            border-bottom: 1px solid #e2e8f0;
          }

          .relationship-icon {
            width: 22px;
            height: 22px;
            flex: 0 0 auto;
          }

          .relationship-icon svg {
            width: 100%;
            height: 100%;
          }

          .relationship-header h4 {
            margin: 0;
            font-size: 9px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .06em;
            color: #334155;
          }

          .relationship-list {
            width: 100%;
          }

          .relationship-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-height: 29px;
            border-bottom: 1px solid #e2e8f0;
          }

          .relationship-row:last-child {
            border-bottom: none;
          }

          .relationship-player {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
            font-size: 9px;
            font-weight: 900;
            color: #0f172a;
          }

          .relationship-player > span:last-child {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .rank-badge {
            width: 18px;
            height: 18px;
            min-width: 18px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: 950;
            color: white;
            background: #3b82f6;
          }

          .relationship-value {
            font-size: 8px;
            font-weight: 950;
            white-space: nowrap;
            padding: 3px 7px;
            border-radius: 999px;
            border: 1px solid #cbd5e1;
            color: #334155;
            background: #f8fafc;
          }

          .empty-relationship {
            font-size: 8px;
            color: #94a3b8;
            font-style: italic;
            padding: 8px 0;
          }

          .rel-frequent {
            background:
              linear-gradient(
                180deg,
                rgba(20,184,166,.09),
                white 35%
              );
          }

          .rel-best {
            background:
              linear-gradient(
                180deg,
                rgba(34,197,94,.09),
                white 35%
              );
          }

          .rel-worst {
            background:
              linear-gradient(
                180deg,
                rgba(239,68,68,.09),
                white 35%
              );
          }

          .rel-easy {
            background:
              linear-gradient(
                180deg,
                rgba(251,191,36,.11),
                white 35%
              );
          }

          .rel-hard {
            background:
              linear-gradient(
                180deg,
                rgba(139,92,246,.09),
                white 35%
              );
          }

          .rel-frequent .rank-badge {
            background: #14b8a6;
          }

          .rel-best .rank-badge {
            background: #22c55e;
          }

          .rel-worst .rank-badge {
            background: #ef4444;
          }

          .rel-easy .rank-badge {
            background: #f59e0b;
          }

          .rel-hard .rank-badge {
            background: #8b5cf6;
          }

          .rel-frequent .relationship-value {
            color: #0f766e;
            border-color: #99f6e4;
            background: #f0fdfa;
          }

          .rel-best .relationship-value {
            color: #15803d;
            border-color: #86efac;
            background: #f0fdf4;
          }

          .rel-worst .relationship-value {
            color: #dc2626;
            border-color: #fca5a5;
            background: #fef2f2;
          }

          .rel-easy .relationship-value {
            color: #b45309;
            border-color: #fcd34d;
            background: #fffbeb;
          }

          .rel-hard .relationship-value {
            color: #7c3aed;
            border-color: #c4b5fd;
            background: #f5f3ff;
          }
        }
      `}</style>

      {/* ====================================================================
       * PAGINA 1
       * ================================================================== */}

      <div className="print-page">
        <div className="player-header">
          <div className="player-info">
            {player.photoBase64 ? (
              <img
                src={player.photoBase64}
                alt={player.name}
                className="player-photo"
              />
            ) : (
              <div className="player-initial">
                {player.name.charAt(0)}
              </div>
            )}

            <div>
              <div className="player-name">
                {player.name}
              </div>

              <div className="player-tags">
                {player.isKeeper && (
                  <span className="player-tag">
                    Keeper
                  </span>
                )}

                {player.isFixedMember && (
                  <span className="player-tag">
                    Lid
                  </span>
                )}

                <span className="player-tag">
                  Rating:{' '}
                  {player.rating.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <img
            src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png"
            alt="Logo"
            className="club-logo"
          />
        </div>

        <h2 className="section-title">
          {seasonTitle}
        </h2>

        {/* Eerste rij */}
        <div className="stats-grid">
          <div className="stat-card tile-green">
            <div className="stat-title">
              Speelavonden aanwezig
            </div>

            <div className="stat-value">
              {
                seasonAttendance.attendedNights
              }
              /
              {
                seasonAttendance.totalNights
              }
            </div>

            <div className="stat-sub">
              Minimaal:{' '}
              {seasonRanks.minNights}{' '}
              avonden
            </div>
          </div>

          <div className="stat-card tile-yellow">
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

          <div className="stat-card tile-pink">
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

          <div className="stat-card tile-blue">
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

        {/* Tweede rij */}
        <div className="stats-grid">
          <div className="stat-card tile-orange">
            <div className="stat-title">
              Gespeelde wedstrijden
            </div>

            <div className="stat-value">
              {stats.gamesPlayed}
            </div>
          </div>

          <div className="stat-card tile-purple">
            <div className="stat-title">
              Resultaten
            </div>

            <div className="result-row">
              <div>
                <div className="result-number">
                  {stats.wins}
                </div>
                <div className="result-label">
                  Gewonnen
                </div>
              </div>

              <div>
                <div className="result-number">
                  {stats.draws}
                </div>
                <div className="result-label">
                  Gelijk
                </div>
              </div>

              <div>
                <div className="result-number">
                  {stats.losses}
                </div>
                <div className="result-label">
                  Verloren
                </div>
              </div>
            </div>
          </div>

          <div className="stat-card tile-teal">
            <div className="stat-title">
              Goals
            </div>

            <div className="stat-value">
              {stats.goalsScored}
            </div>
          </div>

          <div className="stat-card tile-red">
            <div className="stat-title">
              Gem. Punten
            </div>

            <div className="stat-value">
              {avgPoints.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Prijzenkast */}
        {trophies.length > 0 && (
          <div className="trophies-box">
            <div className="trophies-title">
              Prijzenkast
            </div>

            <div className="trophies-grid">
              {trophies.map((t) => (
                <div
                  key={t.id}
                  className="trophy-card"
                >
                  {getTrophyContent(
                    t.type
                  )}

                  <div>
                    <div className="trophy-name">
                      {t.type}
                    </div>

                    <div className="trophy-year">
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

      {/* ====================================================================
       * PAGINA 2 - 2 GRAFIEKEN
       * ================================================================== */}

      <div className="print-page charts-page">
        <div className="charts-header">
          Rating verloop
        </div>

        <div className="charts-grid">
          <PrintChart
            data={seasonHistory}
            title="Verloop huidig seizoen"
          />

          <PrintChart
            data={allTimeHistory}
            title="All-time verloop"
          />
        </div>

        <div className="page-footer">
          Pagina 2 van 3
        </div>
      </div>

      {/* ====================================================================
       * PAGINA 3 - RELATIES
       * ================================================================== */}

      <div className="print-page relationships-page">
        <h2 className="section-title">
          Statistieken vs spelers (Top 5)
        </h2>

        <div className="relationships-grid">
          <RelationshipCard
            title="Plakfactor: Onlosmakelijk"
            data={stats.freq || []}
            variant="frequent"
            icon={
              <span style={{ color: '#14b8a6' }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                  />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
            }
          />

          <RelationshipCard
            title="Gouden Duo"
            data={stats.bestT || []}
            variant="best"
            icon={
              <TrophyIcon />
            }
          />

          <RelationshipCard
            title="Samen de Afgrond in..."
            data={stats.worstT || []}
            variant="worst"
            icon={
              <ShieldIcon />
            }
          />

          <RelationshipCard
            title="Mijn Favoriete Slachtoffer"
            data={stats.bestO || []}
            variant="easy"
            icon={
              <TrophyIcon />
            }
          />

          <RelationshipCard
            title="Mijn Persoonlijke Nachtmerrie"
            data={stats.worstO || []}
            variant="hard"
            icon={
              <ShieldIcon />
            }
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
