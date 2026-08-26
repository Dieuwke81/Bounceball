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

const toMs = (d: string) => {
  if (!d) return 0;

  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const hasAnyResults = (s: GameSession) =>
  (Array.isArray(s.round1Results) && s.round1Results.length > 0) ||
  (Array.isArray(s.round2Results) && s.round2Results.length > 0);

const sumGoals = (goals: any[]) =>
  (goals || []).reduce(
    (sum, g) => sum + (Number(g?.count) || 0),
    0
  );

const ordinalNl = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n}e`;
};

/* ============================================================================
 * Season statistics
 * ========================================================================== */

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
 * Seizoen-avonden tellen met resultaten + aanwezigheid per speler.
 */
const computeSeasonMeta = (params: {
  history: GameSession[];
  allowedIds: Set<number>;
}): SeasonMeta => {
  const { history, allowedIds } = params;

  const nightsByPlayer = new Map<number, number>();

  const seasonSessions = (history || []).filter((s) => {
    return hasAnyResults(s);
  });

  seasonSessions.forEach((s) => {
    const attending = new Set<number>();

    const r1 = s.teams || [];

    r1.flat().forEach((p) => {
      if (allowedIds.has(p.id)) {
        attending.add(p.id);
      }
    });

    const r2 = ((s as any).round2Teams ?? s.teams ?? []) as Player[][];

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

      if (!Number.isFinite(pid) || pid <= 0 || c <= 0) {
        return;
      }

      if (!allowedIds.has(pid)) {
        return;
      }

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

    const teamsR2 = (
      (session as any).round2Teams ??
      session.teams ??
      []
    ) as Player[][];

    (session.round1Results || []).forEach((m) => {
      applyMatch(teamsR1, m);
    });

    (session.round2Results || []).forEach((m) => {
      applyMatch(teamsR2, m);
    });
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
 * Rating chart
 * ========================================================================== */

const PrintChart: React.FC<{
  data: {
    date: string;
    rating: number;
  }[];
  title: string;
}> = ({ data, title }) => {
  if (!data || data.length < 2) {
    return null;
  }

  const width = 1000;
  const height = 190;

  const paddingLeft = 55;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 35;

  const minRating = Math.min(
    ...data.map((d) => d.rating)
  );

  const maxRating = Math.max(
    ...data.map((d) => d.rating)
  );

  const range =
    maxRating - minRating || 1;

  const minY =
    minRating - range * 0.12;

  const maxY =
    maxRating + range * 0.12;

  const getX = (index: number) =>
    (index / Math.max(1, data.length - 1)) *
      (width -
        paddingLeft -
        paddingRight) +
    paddingLeft;

  const getY = (rating: number) =>
    height -
    paddingBottom -
    ((rating - minY) /
      (maxY - minY)) *
      (height -
        paddingTop -
        paddingBottom);

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
      return '';
    }

    return date.toLocaleDateString(
      'nl-NL',
      {
        month: 'short',
        year: '2-digit',
      }
    );
  };

  const middleIndex = Math.floor(
    data.length / 2
  );

  return (
    <div className="chart-card">
      <h4 className="chart-title">
        {title}
      </h4>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        preserveAspectRatio="none"
      >
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={width - paddingRight}
          y2={paddingTop}
          className="chart-grid-line"
        />

        <line
          x1={paddingLeft}
          y1={height / 2}
          x2={width - paddingRight}
          y2={height / 2}
          className="chart-grid-line"
        />

        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          className="chart-grid-line"
        />

        <defs>
          <linearGradient
            id={`ratingLine-${title.replace(
              /\s+/g,
              '-'
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
            /\s+/g,
            '-'
          )})`}
          strokeWidth="4"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <text
          x={getX(0)}
          y={height - 10}
          className="chart-label"
          textAnchor="start"
        >
          {formatDate(data[0].date)}
        </text>

        <text
          x={getX(middleIndex)}
          y={height - 10}
          className="chart-label"
          textAnchor="middle"
        >
          {formatDate(
            data[middleIndex].date
          )}
        </text>

        <text
          x={getX(data.length - 1)}
          y={height - 10}
          className="chart-label"
          textAnchor="end"
        >
          {formatDate(
            data[data.length - 1].date
          )}
        </text>

        <circle
          cx={getX(data.length - 1)}
          cy={getY(
            data[data.length - 1].rating
          )}
          r="6"
          fill="#3b82f6"
        />

        <circle
          cx={getX(data.length - 1)}
          cy={getY(
            data[data.length - 1].rating
          )}
          r="3"
          fill="#0f172a"
        />

      </svg>
    </div>
  );
};

/* ============================================================================
 * Relationship types
 * ========================================================================== */

type RelationshipItem = {
  id: number;
  label: string;
  percentage: number;
  score?: number;
};

type RelationshipMode =
  | 'frequent'
  | 'winrate';

/* ============================================================================
 * Relationship card
 * ========================================================================== */

const RelationshipSection: React.FC<{
  title: string;
  data: RelationshipItem[];
  playerMap: Map<number, Player>;
  variant:
    | 'rel-frequent'
    | 'rel-best'
    | 'rel-worst'
    | 'rel-easy'
    | 'rel-hard';
  mode: RelationshipMode;
}> = ({
  title,
  data,
  playerMap,
  variant,
  mode,
}) => {
  const items = Array.isArray(data)
    ? data.slice(0, 5)
    : [];

  return (
    <div
      className={`relationship-card ${variant}`}
    >
      <div className="relationship-title">
        {title}
      </div>

      {items.length > 0 ? (
        <div className="relationship-list">
          {items.map(
            (item, index) => {
              const p =
                playerMap.get(item.id);

              return (
                <div
                  key={item.id}
                  className="relationship-row"
                >
                  <div className="relationship-person">
                    <span className="relationship-rank">
                      {index + 1}
                    </span>

                    <span className="relationship-name">
                      {p
                        ? p.name
                        : `Speler ${item.id}`}
                    </span>
                  </div>

                  <div className="relationship-result">
                    <span className="relationship-label">
                      {item.label}
                    </span>

                    <span className="relationship-percent">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="relationship-empty">
          - Geen data -
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * Props
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

/* ============================================================================
 * Component
 * ========================================================================== */

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
        players.map((p) => [
          p.id,
          p,
        ])
      ),
    [players]
  );

  /* --------------------------------------------------------------------------
   * Print trigger
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 700);

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
   * Trophy images
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
   * Season calculations
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
      topscorerRank:
        ts.rank,
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

  const avgPoints =
    stats.gamesPlayed > 0
      ? (Number(stats.points) || 0) /
        stats.gamesPlayed
      : 0;

  const seasonTitle =
    (competitionName || '').trim() ||
    'Competitie';

  /* --------------------------------------------------------------------------
   * Portal
   * ------------------------------------------------------------------------ */

  return createPortal(
    <div className="print-portal">
      <style>
        {`
          /* ================================================================
             SCREEN
             ================================================================ */

          .print-portal {
            display: none;
          }

          /* ================================================================
             PRINT PAGE
             ================================================================ */

          @media print {

            @page {
              size: A4 landscape;
              margin: 9mm;
            }

            html,
            body {
              width: 100%;
              height: auto;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }

            body::before {
              display: none !important;
            }

            body > *:not(.print-portal) {
              display: none !important;
            }

            .print-portal {
              display: block !important;
              position: static !important;
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
              z-index: 99999;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* ============================================================
               GENERAL
               ============================================================ */

            .print-page {
              width: 100%;
              min-height: 185mm;
              box-sizing: border-box;
              position: relative;
            }

            .page-break {
              break-before: page;
              page-break-before: always;
            }

            .avoid-break {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            /* ============================================================
               PAGE 1
               ============================================================ */

            .header-wrap {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 9px;
              margin-bottom: 10px;
              border-bottom: 2px solid #0f172a;
              position: relative;
            }

            .header-wrap::after {
              content: "";
              position: absolute;
              left: 0;
              bottom: -2px;
              width: 100%;
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
              opacity: 0.45;
            }

            .player-header {
              display: flex;
              align-items: center;
            }

            .player-photo {
              width: 70px;
              height: 70px;
              border-radius: 999px;
              object-fit: cover;
              border: 2px solid #0f172a;
              margin-right: 14px;
            }

            .player-initial {
              width: 70px;
              height: 70px;
              border-radius: 999px;
              background: #f1f5f9;
              border: 2px solid #0f172a;
              margin-right: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              font-weight: 900;
            }

            .player-name {
              font-size: 28px;
              line-height: 1;
              font-weight: 950;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }

            .player-tags {
              display: flex;
              gap: 6px;
              margin-top: 7px;
            }

            .player-tag {
              border: 1px solid #0f172a;
              padding: 3px 8px;
              border-radius: 999px;
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
            }

            .print-logo {
              height: 42px;
              width: auto;
              object-fit: contain;
            }

            /* ============================================================
               TROPHIES
               ============================================================ */

            .section-title {
              font-size: 14px;
              font-weight: 950;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 4px;
              margin: 0 0 7px;
            }

            .trophies {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 7px;
              margin-bottom: 10px;
            }

            .trophy-card {
              display: flex;
              align-items: center;
              min-height: 44px;
              padding: 5px 7px;
              border: 1px solid #cbd5e1;
              border-radius: 9px;
              background: #f8fafc;
            }

            .trophy-image {
              width: 32px;
              height: 32px;
              object-fit: contain;
              margin-right: 8px;
            }

            .trophy-icon {
              width: 27px;
              height: 27px;
              margin-right: 8px;
            }

            .trophy-name {
              font-size: 9px;
              font-weight: 950;
              line-height: 1.15;
            }

            .trophy-year {
              font-size: 8px;
              color: #64748b;
              font-weight: 700;
              margin-top: 2px;
            }

            /* ============================================================
               STAT BOXES
               ============================================================ */

            .print-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 9px;
            }

            .stat-box {
              min-height: 65px;
              border: 1px solid #cbd5e1;
              border-radius: 11px;
              padding: 7px;
              text-align: center;
              background: white;
              position: relative;
              overflow: hidden;
              box-shadow:
                0 4px 12px rgba(15,23,42,0.08);
              display: flex;
              flex-direction: column;
              justify-content: center;
            }

            .stat-box::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 4px;
              background: var(--accent);
            }

            .tile-green {
              --accent: #22c55e;
              background:
                linear-gradient(
                  180deg,
                  rgba(34,197,94,0.10),
                  white
                );
            }

            .tile-yellow {
              --accent: #fbbf24;
              background:
                linear-gradient(
                  180deg,
                  rgba(251,191,36,0.12),
                  white
                );
            }

            .tile-pink {
              --accent: #ec4899;
              background:
                linear-gradient(
                  180deg,
                  rgba(236,72,153,0.10),
                  white
                );
            }

            .tile-blue {
              --accent: #3b82f6;
              background:
                linear-gradient(
                  180deg,
                  rgba(59,130,246,0.10),
                  white
                );
            }

            .tile-orange {
              --accent: #f59e0b;
              background:
                linear-gradient(
                  180deg,
                  rgba(245,158,11,0.10),
                  white
                );
            }

            .tile-purple {
              --accent: #8b5cf6;
              background:
                linear-gradient(
                  180deg,
                  rgba(139,92,246,0.10),
                  white
                );
            }

            .tile-teal {
              --accent: #14b8a6;
              background:
                linear-gradient(
                  180deg,
                  rgba(20,184,166,0.10),
                  white
                );
            }

            .tile-red {
              --accent: #ef4444;
              background:
                linear-gradient(
                  180deg,
                  rgba(239,68,68,0.10),
                  white
                );
            }

            .stat-title {
              font-size: 7px;
              text-transform: uppercase;
              color: #475569;
              font-weight: 950;
              letter-spacing: 0.05em;
              line-height: 1.1;
            }

            .stat-value {
              font-size: 18px;
              font-weight: 950;
              color: #0f172a;
              line-height: 1.1;
              margin-top: 3px;
            }

            .stat-sub {
              font-size: 7px;
              color: #64748b;
              margin-top: 3px;
              font-weight: 800;
            }

            .result-grid {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 10px;
              margin-top: 4px;
            }

            .result-text {
              display: flex;
              flex-direction: column;
              align-items: center;
            }

            .result-count {
              font-size: 13px;
              font-weight: 950;
            }

            .result-label {
              font-size: 6px;
              color: #64748b;
              text-transform: uppercase;
              font-weight: 900;
            }

            /* ============================================================
               PAGE 2 - CHARTS
               ============================================================ */

            .charts-page {
              min-height: 185mm;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
            }

            .charts-heading {
              font-size: 16px;
              font-weight: 950;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 5px;
              margin-bottom: 8px;
            }

            .chart-card {
              width: 100%;
              height: 78mm;
              box-sizing: border-box;
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              background: white;
              padding: 8px 12px 6px;
              margin-bottom: 8mm;
              box-shadow:
                0 5px 14px rgba(15,23,42,0.08);
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .chart-card:last-child {
              margin-bottom: 0;
            }

            .chart-title {
              text-align: center;
              text-transform: uppercase;
              font-size: 10px;
              font-weight: 950;
              letter-spacing: 0.08em;
              margin: 0 0 3px;
              color: #0f172a;
            }

            .chart-title::after {
              content: "";
              display: block;
              width: 65px;
              height: 2px;
              margin: 4px auto 0;
              border-radius: 999px;
              background:
                linear-gradient(
                  90deg,
                  #22c55e,
                  #3b82f6,
                  #8b5cf6,
                  #ec4899
                );
            }

            .chart-svg {
              width: 100%;
              height: calc(100% - 25px);
              display: block;
            }

            .chart-grid-line {
              stroke: #e2e8f0;
              stroke-width: 1;
            }

            .chart-label {
              fill: #64748b;
              font-size: 11px;
            }

            .chart-label-bold {
              font-weight: 800;
            }

            .chart-value {
              fill: #0f172a;
              font-size: 13px;
              font-weight: 950;
            }

            /* ============================================================
               PAGE 3 - RELATIONSHIPS
               ============================================================ */

            .relationships-page {
              min-height: 185mm;
            }

            .relationships-grid {
              display: grid;
              grid-template-columns:
                repeat(3, 1fr);
              gap: 9px;
              align-items: start;
            }

            .relationship-card {
              border: 1px solid #cbd5e1;
              border-radius: 11px;
              background: white;
              overflow: hidden;
              box-shadow:
                0 5px 14px rgba(15,23,42,0.08);
              break-inside: avoid;
              page-break-inside: avoid;
              min-height: 68mm;
            }

            .relationship-title {
              padding: 8px 10px 7px;
              border-bottom: 1px solid #dbe4ee;
              font-size: 9px;
              line-height: 1.1;
              font-weight: 950;
              text-transform: uppercase;
              letter-spacing: 0.055em;
              position: relative;
            }

            .relationship-title::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: var(--relationship-color);
            }

            .relationship-list {
              padding: 2px 10px 6px;
            }

            .relationship-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              padding: 7px 0;
              border-bottom: 1px solid #e2e8f0;
            }

            .relationship-row:last-child {
              border-bottom: 0;
            }

            .relationship-person {
              display: flex;
              align-items: center;
              gap: 7px;
              min-width: 0;
            }

            .relationship-rank {
              width: 20px;
              height: 20px;
              min-width: 20px;
              border-radius: 999px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--relationship-color);
              color: white;
              font-size: 9px;
              font-weight: 950;
              box-shadow:
                0 2px 5px rgba(15,23,42,0.15);
            }

            .rel-easy .relationship-rank {
              color: #0f172a;
            }

            .relationship-name {
              font-size: 10px;
              font-weight: 900;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .relationship-result {
              display: flex;
              align-items: center;
              gap: 5px;
              flex-shrink: 0;
            }

            .relationship-label {
              font-size: 8px;
              font-weight: 850;
              color: #475569;
              white-space: nowrap;
            }

            .relationship-percent {
              font-size: 8px;
              font-weight: 950;
              padding: 3px 7px;
              border-radius: 999px;
              border: 1px solid var(--relationship-border);
              background: var(--relationship-bg);
              color: #334155;
              white-space: nowrap;
            }

            .relationship-empty {
              padding: 12px;
              color: #94a3b8;
              font-size: 9px;
              font-style: italic;
            }

            /* COLORS */

            .rel-frequent {
              --relationship-color: #14b8a6;
              --relationship-bg: rgba(20,184,166,0.10);
              --relationship-border: rgba(20,184,166,0.35);
              background:
                linear-gradient(
                  180deg,
                  rgba(20,184,166,0.08),
                  white 55%
                );
            }

            .rel-best {
              --relationship-color: #eab308;
              --relationship-bg: rgba(234,179,8,0.13);
              --relationship-border: rgba(202,138,4,0.40);
              background:
                linear-gradient(
                  180deg,
                  rgba(234,179,8,0.11),
                  white 55%
                );
            }

            .rel-worst {
              --relationship-color: #f97316;
              --relationship-bg: rgba(249,115,22,0.11);
              --relationship-border: rgba(249,115,22,0.35);
              background:
                linear-gradient(
                  180deg,
                  rgba(249,115,22,0.09),
                  white 55%
                );
            }

            .rel-easy {
              --relationship-color: #ec4899;
              --relationship-bg: rgba(236,72,153,0.11);
              --relationship-border: rgba(236,72,153,0.35);
              background:
                linear-gradient(
                  180deg,
                  rgba(236,72,153,0.09),
                  white 55%
                );
            }

            .rel-hard {
              --relationship-color: #8b5cf6;
              --relationship-bg: rgba(139,92,246,0.11);
              --relationship-border: rgba(139,92,246,0.35);
              background:
                linear-gradient(
                  180deg,
                  rgba(139,92,246,0.09),
                  white 55%
                );
            }

            /* ============================================================
               FOOTER
               ============================================================ */

            .print-footer {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              text-align: center;
              border-top: 1px solid #e2e8f0;
              padding-top: 5px;
              font-size: 7px;
              color: #94a3b8;
            }

            /* Geen URL's achter afbeeldingen/links */
            a::after,
            a[href]::after {
              content: "" !important;
            }
          }
        `}
      </style>

      {/* ====================================================================
          PAGE 1
          ================================================================== */}

      <div className="print-page">
        <div className="header-wrap">
          <div className="player-header">
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


              </div>
            </div>
          </div>

          <img
            src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png"
            alt="Logo"
            className="print-logo"
          />
        </div>

        {/* PRIJZENKAST */}

        {trophies.length > 0 && (
          <div className="avoid-break">
            <h3 className="section-title">
              Prijzenkast
            </h3>

            <div className="trophies">
              {trophies.map((t) => (
                <div
                  key={t.id}
                  className="trophy-card"
                >
                  <div>
                    {getTrophyContent(
                      t.type
                    )}
                  </div>

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

        {/* SEIZOEN */}

        <h3 className="section-title">
          {seasonTitle}
        </h3>

        <div className="print-grid">
          <div className="stat-box tile-green">
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

        {/* ALGEMENE STATISTIEKEN */}

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

            <div className="stat-sub">
              {(
                stats.goalsScored /
                Math.max(
                  1,
                  stats.gamesPlayed
                )
              ).toFixed(2)}{' '}
              gemiddeld
            </div>
          </div>

          <div className="stat-box tile-red">
            <div className="stat-title">
              Gem. Punten
            </div>

            <div className="stat-value">
              {avgPoints.toFixed(2)}
            </div>

            <div className="stat-sub">
              Totaal: {stats.points}
            </div>
          </div>
        </div>

        <div className="print-footer">
          Gegenereerd door de Bounceball App{' '}
          {new Date().toLocaleDateString(
            'nl-NL'
          )}
        </div>
      </div>

      {/* ====================================================================
          PAGE 2 - GRAFIEKEN
          ================================================================== */}

      <div className="print-page page-break charts-page">
        <h3 className="charts-heading">
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

        <div className="print-footer">
          Gegenereerd door de Bounceball App{' '}
          {new Date().toLocaleDateString(
            'nl-NL'
          )}
        </div>
      </div>

      {/* ====================================================================
          PAGE 3 - RELATIONSHIPS
          ================================================================== */}

      <div className="print-page page-break relationships-page">
        <h3 className="charts-heading">
          Statistieken vs spelers (Top 5)
        </h3>

        <div className="relationships-grid">

          {/* ================================================================
              PLAKFACTOR
              ================================================================ */}

          <RelationshipSection
            title="Plakfactor: Onlosmakelijk"
            data={stats.freq || []}
            playerMap={playerMap}
            variant="rel-frequent"
            mode="frequent"
          />

          {/* ================================================================
              GOUDEN DUO
              ================================================================ */}

          <RelationshipSection
            title="Gouden Duo (Winstgarantie)"
            data={stats.bestT || []}
            playerMap={playerMap}
            variant="rel-best"
            mode="winrate"
          />

          {/* ================================================================
              AFGROND
              ================================================================ */}

          <RelationshipSection
            title="Samen de Afgrond in..."
            data={stats.worstT || []}
            playerMap={playerMap}
            variant="rel-worst"
            mode="winrate"
          />

          {/* ================================================================
              FAVORIETE SLACHTOFFER
              ================================================================ */}

          <RelationshipSection
            title="Mijn Favoriete Slachtoffer"
            data={stats.bestO || []}
            playerMap={playerMap}
            variant="rel-easy"
            mode="winrate"
          />

          {/* ================================================================
              NACHTMERRIE
              ================================================================ */}

          <RelationshipSection
            title="Mijn Persoonlijke Nachtmerrie"
            data={stats.worstO || []}
            playerMap={playerMap}
            variant="rel-hard"
            mode="winrate"
          />

        </div>

        <div className="print-footer">
          Gegenereerd door de Bounceball App{' '}
          {new Date().toLocaleDateString(
            'nl-NL'
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
