
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

const sumGoals = (goals: any[]) => (goals || []).reduce((sum, g) => sum + (Number(g?.count) || 0), 0);

const ordinalNl = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n}e`;
};

type StandingRow = { pts: number; gf: number; gd: number; matches: number };
type DefenseRow = { conceded: number; matches: number };

type SeasonMeta = {
  totalNights: number;
  minNights: number; // round(total/2)
  nightsByPlayer: Map<number, number>;
  eligibleIds: Set<number>;
};

/**
 * ✅ Seizoen-avonden tellen (met resultaten) + aanwezigheid per speler.
 * - telt per sessie (avond) max 1x, ook als iemand in R1 én R2 voorkomt.
 * - telt ook spelers uit round2Teams mee.
 * - filtert op huidige spelers (allowedIds)
 */
const computeSeasonMeta = (params: {
  history: GameSession[];
  seasonStartMs: number;
  allowedIds: Set<number>;
}): SeasonMeta => {
  const { history, seasonStartMs, allowedIds } = params;

  const nightsByPlayer = new Map<number, number>();

  const seasonSessions = (history || []).filter((s) => {
    const ms = toMs(String(s.date || ''));
    if (!ms) return false;
    if (seasonStartMs && ms < seasonStartMs) return false;
    return hasAnyResults(s);
  });

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

  return { totalNights, minNights, nightsByPlayer, eligibleIds };
};

/**
 * ✅ Seizoen aggregaties:
 * - competitie: punten / wedstrijden (avg)
 * - topscorer: goals / wedstrijden (avg)
 * - verdediger: tegengoals / wedstrijden (avg, lager is beter)
 */
const computeSeasonAggregates = (params: {
  history: GameSession[];
  seasonStartMs: number;
  allowedIds: Set<number>;
}) => {
  const { history, seasonStartMs, allowedIds } = params;

  const standings = new Map<number, StandingRow>();
  const goalsForPlayer = new Map<number, number>();
  const defense = new Map<number, DefenseRow>();

  const ensureStanding = (id: number) => {
    if (!standings.has(id)) standings.set(id, { pts: 0, gf: 0, gd: 0, matches: 0 });
    return standings.get(id)!;
  };

  const ensureDefense = (id: number) => {
    if (!defense.has(id)) defense.set(id, { conceded: 0, matches: 0 });
    return defense.get(id)!;
  };

  const addPlayerGoals = (goalsArr: any[]) => {
    (goalsArr || []).forEach((g) => {
      const pid = Number(g?.playerId);
      const c = Number(g?.count) || 0;
      if (!Number.isFinite(pid) || pid <= 0 || c <= 0) return;
      if (!allowedIds.has(pid)) return;
      goalsForPlayer.set(pid, (goalsForPlayer.get(pid) || 0) + c);
    });
  };

  const applyMatch = (teamsForRound: Player[][] | undefined, match: MatchResult) => {
    const t1 = (teamsForRound?.[match.team1Index] || []).filter((p) => allowedIds.has(p.id));
    const t2 = (teamsForRound?.[match.team2Index] || []).filter((p) => allowedIds.has(p.id));
    if (!t1.length || !t2.length) return;

    const s1 = sumGoals(match.team1Goals || []);
    const s2 = sumGoals(match.team2Goals || []);

    addPlayerGoals(match.team1Goals || []);
    addPlayerGoals(match.team2Goals || []);

    t1.forEach((p) => {
      const row = ensureStanding(p.id);
      row.gf += s1;
      row.gd += s1 - s2;
      row.matches += 1;
    });
    t2.forEach((p) => {
      const row = ensureStanding(p.id);
      row.gf += s2;
      row.gd += s2 - s1;
      row.matches += 1;
    });

    if (s1 > s2) {
      t1.forEach((p) => (ensureStanding(p.id).pts += 3));
    } else if (s2 > s1) {
      t2.forEach((p) => (ensureStanding(p.id).pts += 3));
    } else {
      t1.forEach((p) => (ensureStanding(p.id).pts += 1));
      t2.forEach((p) => (ensureStanding(p.id).pts += 1));
    }

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
    const ms = toMs(String(session.date || ''));
    if (!ms) return;
    if (seasonStartMs && ms < seasonStartMs) return;
    if (!hasAnyResults(session)) return;

    const teamsR1 = session.teams || [];
    const teamsR2 = ((session as any).round2Teams ?? session.teams ?? []) as Player[][];

    (session.round1Results || []).forEach((m) => applyMatch(teamsR1, m));
    (session.round2Results || []).forEach((m) => applyMatch(teamsR2, m));
  });

  return { standings, goalsForPlayer, defense };
};

const rankStanding = (standings: Map<number, StandingRow>, playerId: number, eligibleIds: Set<number>) => {
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

  rows.sort((a, b) => b.avg - a.avg || b.gd - a.gd || b.gf - a.gf || a.id - b.id);

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
    return { id, goals, matches, avg };
  });

  rows.sort((a, b) => b.avg - a.avg || b.goals - a.goals || a.id - b.id);

  const idx = rows.findIndex((r) => r.id === playerId);
  const mine = rows.find((r) => r.id === playerId);
  return {
    rank: idx >= 0 ? idx + 1 : 0,
    myGoals: goalsForPlayer.get(playerId) || 0,
    myAvg: mine ? mine.avg : 0,
  };
};

const rankDefender = (defense: Map<number, DefenseRow>, playerId: number, eligibleIds: Set<number>) => {
  const rows = [...defense.entries()]
    .filter(([id]) => eligibleIds.has(id))
    .map(([id, d]) => ({
      id,
      concededPerMatch: d.matches > 0 ? d.conceded / d.matches : Infinity,
      matches: d.matches,
    }))
    .filter((r) => r.matches > 0);

  rows.sort((a, b) => a.concededPerMatch - b.concededPerMatch || b.matches - a.matches || a.id - b.id);

  const idx = rows.findIndex((r) => r.id === playerId);
  const mine = defense.get(playerId);
  const myAvg = mine && mine.matches > 0 ? mine.conceded / mine.matches : Infinity;

  return { rank: idx >= 0 ? idx + 1 : 0, concededPerMatch: myAvg };
};

/* ============================================================================
 * PrintChart
 * ========================================================================== */

const PrintChart: React.FC<{ data: { date: string; rating: number }[]; title: string }> = ({ data, title }) => {
  if (!data || data.length < 2) return null;

  const width = 800;
  const height = 200;
  const padding = 40;

  const minRating = Math.min(...data.map((d) => d.rating));
  const maxRating = Math.max(...data.map((d) => d.rating));
  const range = maxRating - minRating || 1;
  const minY = minRating - range * 0.1;
  const maxY = maxRating + range * 0.1;

  const getX = (index: number) => (index / (data.length - 1)) * (width - padding * 2) + padding;
  const getY = (rating: number) => height - padding - ((rating - minY) / (maxY - minY)) * (height - padding * 2);

  const points = data.map((d, i) => `${getX(i)},${getY(d.rating)}`).join(' ');

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Nu') return 'Nu';
    return new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="chart-card break-inside-avoid">
      <h5 className="chart-title">{title}</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />

        {/* lijn + subtle gradient */}
        <defs>
          <linearGradient id="ratingLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="35%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        <polyline fill="none" stroke="url(#ratingLine)" strokeWidth="3.2" points={points} strokeLinejoin="round" />

        <text
          x={padding - 5}
          y={getY(maxRating)}
          className="text-[12px] fill-slate-600 font-bold"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {maxRating.toFixed(1)}
        </text>
        <text
          x={padding - 5}
          y={getY(minRating)}
          className="text-[12px] fill-slate-600 font-bold"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {minRating.toFixed(1)}
        </text>

        <text x={getX(0)} y={height - 15} className="text-[12px] fill-slate-600" textAnchor="start">
          {formatDate(data[0].date)}
        </text>
        <text
          x={getX(Math.floor(data.length / 2))}
          y={height - 15}
          className="text-[12px] fill-slate-600"
          textAnchor="middle"
        >
          {formatDate(data[Math.floor(data.length / 2)].date)}
        </text>
        <text x={getX(data.length - 1)} y={height - 15} className="text-[12px] fill-slate-600" textAnchor="end">
          {formatDate(data[data.length - 1].date)}
        </text>

        {/* highlight laatste punt */}
        <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1].rating)} r="5" fill="#3b82f6" />
        <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1].rating)} r="2.7" fill="#0f172a" />
        <text
          x={getX(data.length - 1)}
          y={getY(data[data.length - 1].rating) - 10}
          className="text-[12px] fill-slate-900 font-bold"
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
  competitionName?: string | null; // ✅ uit instellingen (sheet)
  onClose: () => void;
}

const PlayerPrintView: React.FC<PlayerPrintViewProps> = ({
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
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    const printTimer = setTimeout(() => window.print(), 500);
    const closeTimer = setTimeout(() => onClose(), 1500);

    window.onafterprint = () => {
      clearTimeout(closeTimer);
      onClose();
    };

    return () => {
      clearTimeout(printTimer);
      clearTimeout(closeTimer);
    };
  }, [onClose]);

  const getTrophyContent = (type: TrophyType) => {
    const images: { [key: string]: string } = {
      Verdediger: 'https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png',
      Topscoorder: 'https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png',
      Clubkampioen: 'https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png',
      '2de': 'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',
      '3de': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
      'Speler van het jaar': 'https://i.postimg.cc/76pPxbqT/Zonder-titel-(200-x-200-px)-20251203-124822-0000.png',
      '1ste Introductietoernooi': 'https://i.postimg.cc/YqWQ7mfx/Zonder-titel-(200-x-200-px)-20251203-123448-0000.png',
      '2de Introductietoernooi': 'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',
      '3de Introductietoernooi': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
      '1ste NK': 'https://i.postimg.cc/GhXMP4q5/20251203-184928-0000.png',
      '2de NK': 'https://i.postimg.cc/wM0kkrcm/20251203-185040-0000.png',
      '3de NK': 'https://i.postimg.cc/MpcYydnC/20251203-185158-0000.png',
      '1ste Wintertoernooi': 'https://i.postimg.cc/YqWQ7mfx/Zonder-titel-(200-x-200-px)-20251203-123448-0000.png',
      '2de Wintertoernooi': 'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',
      '3de Wintertoernooi': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
    };
    const url = images[type];
    if (url) return <img src={url} alt={type} className="w-10 h-10 object-contain" />;
    if (type === 'Verdediger') return <ShieldIcon className="w-8 h-8 text-slate-900" />;
    return <TrophyIcon className="w-8 h-8 text-slate-900" />;
  };

  const RelationshipSection: React.FC<{ title: string; data: [number, number][]; variant?: string }> = ({
    title,
    data,
    variant,
  }) => (
    <div className={`break-inside-avoid mb-4 rel-card ${variant || ''}`}>
      <h4 className="rel-title">{title}</h4>
      <ul className="text-xs">
        {data.length > 0 ? (
          data.slice(0, 5).map(([id, count], idx) => {
            const p = playerMap.get(id);
            return (
              <li key={id} className="rel-row">
                <span className="rel-name">
                  <span className="rel-rank">{idx + 1}</span>
                  {p ? p.name : `Speler ${id}`}
                </span>
                <span className="rel-count">{count}x</span>
              </li>
            );
          })
        ) : (
          <li className="text-slate-400 italic py-1">- Geen data -</li>
        )}
      </ul>
    </div>
  );

  const avgPoints = stats.gamesPlayed > 0 ? (Number(stats.points) || 0) / stats.gamesPlayed : 0;

  const seasonStartMs = useMemo(() => toMs(seasonHistory?.[0]?.date || ''), [seasonHistory]);
  const allowedIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);

  const seasonMeta = useMemo(
    () =>
      computeSeasonMeta({
        history: history || [],
        seasonStartMs,
        allowedIds,
      }),
    [history, seasonStartMs, allowedIds]
  );

  const seasonAttendance = useMemo(() => {
    const attendedNights = seasonMeta.nightsByPlayer.get(player.id) || 0;
    return { attendedNights, totalNights: seasonMeta.totalNights };
  }, [seasonMeta, player.id]);

  const eligible50 =
    seasonAttendance.totalNights > 0 && seasonAttendance.attendedNights / seasonAttendance.totalNights >= 0.5;

  const seasonRanks = useMemo(() => {
    const { standings, goalsForPlayer, defense } = computeSeasonAggregates({
      history: history || [],
      seasonStartMs,
      allowedIds,
    });

    const position = rankStanding(standings, player.id, seasonMeta.eligibleIds);
    const ts = rankTopScorer(goalsForPlayer, standings, player.id, seasonMeta.eligibleIds);
    const def = rankDefender(defense, player.id, seasonMeta.eligibleIds);

    return {
      position,
      topscorerRank: ts.rank,
      topscorerGoals: ts.myGoals,
      topscorerAvg: ts.myAvg,
      defenderRank: def.rank,
      defenderAvgAgainst: def.concededPerMatch,
      minNights: seasonMeta.minNights,
    };
  }, [history, player.id, seasonStartMs, allowedIds, seasonMeta.eligibleIds, seasonMeta.minNights]);

  const seasonTitle = (competitionName || '').trim() || 'Competitie';

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            body::before { display: none !important; }
            html, body { background: white !important; height: 100%; margin: 0; padding: 0; }
            body > *:not(.print-portal) { display: none !important; }

            @page { size: A4; margin: 10mm; }

            /* =========================================================
               Theme (menu kleuren) + kaartjes
               ========================================================= */
            :root {
              --tile-blue:   #3b82f6;
              --tile-orange: #f59e0b;
              --tile-purple: #8b5cf6;
              --tile-yellow: #fbbf24;
              --tile-pink:   #ec4899;
              --tile-green:  #22c55e;
              --tile-red:    #ef4444;
              --tile-teal:   #14b8a6;

              --ink: #0f172a;
              --muted: #475569;
              --border: #cbd5e1;
              --paper: #ffffff;

              --shadow: rgba(15,23,42,0.10);
              --soft: rgba(15,23,42,0.05);
            }

            .print-portal {
              display: block !important;
              position: absolute;
              top: 0; left: 0;
              width: 100%;
              height: 100%;
              background: var(--paper);
              color: var(--ink);
              font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Helvetica Neue", sans-serif;
              z-index: 9999;
            }

            /* ✅ verberg url’s linksonder */
            a[href]:after { content: "" !important; }
            a:after { content: "" !important; }

            /* HEADER polish */
            .header-wrap {
              border-bottom: 2px solid var(--ink);
              padding-bottom: 14px;
              margin-bottom: 18px;
              position: relative;
            }
            .header-wrap:after {
              content: "";
              position: absolute;
              left: 0;
              bottom: -2px;
              width: 100%;
              height: 7px;
              background: linear-gradient(90deg,
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

            /* Stat tiles */
            .stat-box {
              border: 1.5px solid var(--border);
              padding: 10px;
              border-radius: 14px;
              text-align: center;
              background: #fff;
              position: relative;
              overflow: hidden;
              box-shadow: 0 7px 18px var(--shadow);
            }

            .stat-box:before {
              content: "";
              position: absolute;
              top: 0;
              right: 0;
              width: 74px;
              height: 74px;
              border-radius: 999px;
              background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), var(--soft));
              transform: translate(24px,-24px);
            }

            /* kleur-variant (zelfde gevoel als menu tegels) */
            .tile-green  { border-left: 9px solid var(--tile-green);  background: linear-gradient(180deg, rgba(34,197,94,0.14), rgba(34,197,94,0.06)); }
            .tile-yellow { border-left: 9px solid var(--tile-yellow); background: linear-gradient(180deg, rgba(251,191,36,0.16), rgba(251,191,36,0.06)); }
            .tile-pink   { border-left: 9px solid var(--tile-pink);   background: linear-gradient(180deg, rgba(236,72,153,0.14), rgba(236,72,153,0.06)); }
            .tile-blue   { border-left: 9px solid var(--tile-blue);   background: linear-gradient(180deg, rgba(59,130,246,0.14), rgba(59,130,246,0.06)); }
            .tile-orange { border-left: 9px solid var(--tile-orange); background: linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06)); }
            .tile-purple { border-left: 9px solid var(--tile-purple); background: linear-gradient(180deg, rgba(139,92,246,0.14), rgba(139,92,246,0.06)); }
            .tile-teal   { border-left: 9px solid var(--tile-teal);   background: linear-gradient(180deg, rgba(20,184,166,0.14), rgba(20,184,166,0.06)); }
            .tile-red    { border-left: 9px solid var(--tile-red);    background: linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06)); }

            .print-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 18px;
            }

            .relationships-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 14px;
              margin-bottom: 18px;
            }

            .stat-title {
              font-size: 10px;
              text-transform: uppercase;
              color: var(--muted);
              font-weight: 950;
              letter-spacing: 0.09em;
            }

            .stat-value {
              font-size: 22px;
              font-weight: 950;
              color: var(--ink);
            }

            .stat-sub {
              font-size: 10px;
              color: var(--muted);
              margin-top: 2px;
              font-weight: 800;
            }

            /* Resultaten: onder elkaar + dots met menu kleuren */
            .result-grid {
              margin-top: 6px;
              display: flex;
              flex-direction: column;
              gap: 6px;
              font-size: 12px;
              font-weight: 900;
              color: var(--ink);
            }
            .result-row {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              line-height: 1.1;
            }
            .result-dot {
              width: 9px;
              height: 9px;
              border-radius: 999px;
              display: inline-block;
              box-shadow: 0 1px 0 rgba(0,0,0,0.15);
            }
            .dot-win  { background: var(--tile-green); }
            .dot-draw { background: var(--tile-yellow); }
            .dot-loss { background: var(--tile-red); }

            /* Charts */
            .chart-card {
              border: 1.5px solid var(--border);
              border-radius: 14px;
              background: #ffffff;
              padding: 12px;
              margin-bottom: 14px;
              box-shadow: 0 7px 18px var(--shadow);
            }
            .chart-title {
              font-size: 11px;
              font-weight: 950;
              letter-spacing: 0.10em;
              text-transform: uppercase;
              text-align: center;
              color: var(--ink);
              margin-bottom: 8px;
              position: relative;
            }
            .chart-title:after {
              content: "";
              display: block;
              margin: 8px auto 0;
              width: 86px;
              height: 3px;
              border-radius: 999px;
              background: linear-gradient(90deg, var(--tile-green), var(--tile-blue), var(--tile-purple), var(--tile-pink));
              opacity: 0.70;
            }

            /* Relationships cards */
            .rel-card {
              border: 1.5px solid var(--border);
              border-radius: 14px;
              padding: 10px;
              background: #fff;
              box-shadow: 0 7px 18px var(--shadow);
              position: relative;
              overflow: hidden;
            }

            /* ✅ KLEUR in de REL-CARDS (subtiel) */
            .rel-card:before {
              content: "";
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 6px;
              background: linear-gradient(90deg, var(--tile-blue), var(--tile-purple), var(--tile-pink));
              opacity: 0.55;
            }
            .rel-card:after {
              content: "";
              position: absolute;
              right: 0;
              top: 0;
              width: 70px;
              height: 70px;
              border-radius: 999px;
              background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(15,23,42,0.05));
              transform: translate(24px,-28px);
            }

            /* per variant: top-gradient + zachte achtergrond */
            .rel-frequent { background: linear-gradient(180deg, rgba(20,184,166,0.10), rgba(255,255,255,0.92)); }
            .rel-best     { background: linear-gradient(180deg, rgba(34,197,94,0.10), rgba(255,255,255,0.92)); }
            .rel-worst    { background: linear-gradient(180deg, rgba(239,68,68,0.10), rgba(255,255,255,0.92)); }
            .rel-easy     { background: linear-gradient(180deg, rgba(251,191,36,0.12), rgba(255,255,255,0.92)); }
            .rel-hard     { background: linear-gradient(180deg, rgba(139,92,246,0.10), rgba(255,255,255,0.92)); }

            .rel-frequent:before { background: linear-gradient(90deg, var(--tile-teal), var(--tile-blue)); }
            .rel-best:before     { background: linear-gradient(90deg, var(--tile-green), var(--tile-teal)); }
            .rel-worst:before    { background: linear-gradient(90deg, var(--tile-red), var(--tile-orange)); }
            .rel-easy:before     { background: linear-gradient(90deg, var(--tile-yellow), var(--tile-orange)); }
            .rel-hard:before     { background: linear-gradient(90deg, var(--tile-purple), var(--tile-pink)); }

            .rel-title {
              font-size: 10px;
              text-transform: uppercase;
              color: var(--muted);
              font-weight: 950;
              letter-spacing: 0.08em;
              border-bottom: 1px solid rgba(226,232,240,0.9);
              padding-bottom: 6px;
              margin: 8px 0 6px; /* ruimte voor de kleur-strip */
              position: relative;
              z-index: 1;
            }

            .rel-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 0;
              border-bottom: 1px solid rgba(226,232,240,0.85);
              position: relative;
              z-index: 1;
            }
            .rel-row:last-child { border-bottom: 0; }

            .rel-name { font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 8px; }
            .rel-rank {
              width: 18px; height: 18px;
              border-radius: 999px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 950;
              color: white;
              background: var(--tile-blue);
              box-shadow: 0 2px 6px rgba(15,23,42,0.18);
            }

            /* ✅ KLEURIGE badges voor de "x" telling per variant */
            .rel-count {
              font-weight: 950;
              font-variant-numeric: tabular-nums;
              padding: 2px 8px;
              border-radius: 999px;
              border: 1px solid rgba(203,213,225,0.9);
              color: var(--muted);
              background: rgba(15,23,42,0.06);
            }

            .rel-frequent .rel-rank { background: var(--tile-teal); }
            .rel-best     .rel-rank { background: var(--tile-green); }
            .rel-worst    .rel-rank { background: var(--tile-red); }
            .rel-easy     .rel-rank { background: var(--tile-yellow); color: var(--ink); }
            .rel-hard     .rel-rank { background: var(--tile-purple); }

            .rel-frequent .rel-count { background: rgba(20,184,166,0.12); border-color: rgba(20,184,166,0.35); }
            .rel-best     .rel-count { background: rgba(34,197,94,0.12);  border-color: rgba(34,197,94,0.35); }
            .rel-worst    .rel-count { background: rgba(239,68,68,0.12);  border-color: rgba(239,68,68,0.35); }
            .rel-easy     .rel-count { background: rgba(251,191,36,0.16); border-color: rgba(245,158,11,0.35); color: var(--ink); }
            .rel-hard     .rel-count { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.35); }

            /* kleine hover is niet relevant in print, maar zorgt vaak voor betere anti-aliasing in export */
            .rel-row { break-inside: avoid; }

            /* =========================================================
               ✅ GRAFIEKEN op nieuwe pagina
               ========================================================= */
            .charts-page {
              break-before: page;
              page-break-before: always;
            }

            /* =========================================================
               ✅ RELATIES ALTIJD OP NIEUWE PAGINA
               ========================================================= */
            .relationships-page {
              break-before: page;
              page-break-before: always;
            }
            .relationships-page,
            .relationships-grid {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            /* Footer */
            .print-footer {
              font-size: 10px;
              color: #94a3b8;
              text-align: center;
              padding-top: 12px;
              border-top: 1px solid #e2e8f0;
            }
          }
        `}
      </style>

      <div className="p-6 max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between header-wrap">
          <div className="flex items-center">
            {player.photoBase64 ? (
              <img
                src={player.photoBase64}
                alt={player.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-slate-900 mr-6"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-900 mr-6 flex items-center justify-center text-3xl font-black">
                {player.name.charAt(0)}
              </div>
            )}

            <div>
              <h1 className="text-4xl font-black uppercase tracking-wide">{player.name}</h1>
              <div className="flex gap-2 mt-2 text-sm font-bold uppercase text-slate-600">
                {player.isKeeper && <span className="border border-slate-900 px-2 py-1 rounded">Keeper</span>}
                {player.isFixedMember && <span className="border border-slate-900 px-2 py-1 rounded">Lid</span>}
                <span className="border border-slate-900 px-2 py-1 rounded">Rating: {player.rating.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <img src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png" alt="Logo" className="h-20 w-auto" />
        </div>

        {/* PRIJZENKAST */}
        {trophies.length > 0 && (
          <div className="mb-6 break-inside-avoid">
            <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-3 uppercase">Prijzenkast</h3>
            <div className="grid grid-cols-2 gap-3">
              {trophies.map((t) => (
                <div key={t.id} className="flex items-center border border-slate-200 p-2 rounded-xl bg-slate-50">
                  <div className="mr-3">{getTrophyContent(t.type)}</div>
                  <div>
                    <div className="font-black text-sm">{t.type}</div>
                    <div className="text-xs text-slate-500 font-bold">{t.year}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ TITEL van het huidige seizoen/competitie (uit instellingen) */}
        <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-4 uppercase">{seasonTitle}</h3>

        {/* RIJ 1 */}
        <div className="print-grid">
          <div className="stat-box tile-green">
            <div className="stat-title">Speelavonden aanwezig</div>
            <div className="stat-value">
              {seasonAttendance.attendedNights}/{seasonAttendance.totalNights}
            </div>
            <div className="stat-sub">Minimaal: {seasonRanks.minNights} avonden</div>
          </div>

          <div className="stat-box tile-yellow">
            <div className="stat-title">Competitie</div>
            <div className="stat-value">{eligible50 ? ordinalNl(seasonRanks.position) : '—'}</div>
            {!eligible50 && <div className="stat-sub">min 50% aanwezig</div>}
          </div>

          <div className="stat-box tile-pink">
            <div className="stat-title">Topscoorder</div>
            <div className="stat-value">{eligible50 ? `${ordinalNl(seasonRanks.topscorerRank)}` : '—'}</div>
            <div className="stat-sub">
              {eligible50
                ? `${seasonRanks.topscorerGoals} goals (${seasonRanks.topscorerAvg.toFixed(2)}/w)`
                : 'min 50% aanwezig'}
            </div>
          </div>

          <div className="stat-box tile-blue">
            <div className="stat-title">Verdediger</div>
            <div className="stat-value">{eligible50 ? `${ordinalNl(seasonRanks.defenderRank)}` : '—'}</div>
            <div className="stat-sub">
              {eligible50 && Number.isFinite(seasonRanks.defenderAvgAgainst)
                ? `${seasonRanks.defenderAvgAgainst.toFixed(2)} tegen / w`
                : 'min 50% aanwezig'}
            </div>
          </div>
        </div>

        {/* RIJ 2 */}
        <div className="print-grid">
          <div className="stat-box tile-orange">
            <div className="stat-title">Gespeelde wedstrijden</div>
            <div className="stat-value">{stats.gamesPlayed}</div>
          </div>

          <div className="stat-box tile-purple">
            <div className="stat-title">Resultaten</div>
            <div className="result-grid">
              <div className="result-row">
                <span className="result-dot dot-win" />
                <span>{stats.wins} gewonnen</span>
              </div>
              <div className="result-row">
                <span className="result-dot dot-draw" />
                <span>{stats.draws} gelijk</span>
              </div>
              <div className="result-row">
                <span className="result-dot dot-loss" />
                <span>{stats.losses} verloren</span>
              </div>
            </div>
          </div>

          <div className="stat-box tile-teal">
            <div className="stat-title">Goals</div>
            <div className="stat-value">{stats.goalsScored}</div>
          </div>

          <div className="stat-box tile-red">
            <div className="stat-title">Gem. Punten</div>
            <div className="stat-value">{avgPoints.toFixed(2)}</div>
          </div>
        </div>

        {/* ✅ GRAFIEKEN -> nieuwe pagina */}
        <div className="charts-page mb-8">
          <PrintChart data={seasonHistory} title="Verloop Huidig Seizoen" />
          <PrintChart data={allTimeHistory} title="All-Time Verloop" />
        </div>

        {/* RELATIES — altijd nieuwe pagina */}
        <div className="relationships-page mb-8">
          <h3 className="text-lg font-black border-b border-slate-200 pb-1 mb-3 uppercase">
            Statistieken vs Spelers (Top 5)
          </h3>
          <div className="relationships-grid">
            <RelationshipSection title="Vaak samen" data={stats.mostFrequentTeammates} variant="rel-frequent" />
            <RelationshipSection title="Beste Medespeler" data={stats.bestTeammates} variant="rel-best" />
            <RelationshipSection title="Slechtste Medespeler" data={stats.worstTeammates} variant="rel-worst" />
            <RelationshipSection title="Makkelijkste Tegenstander" data={stats.bestOpponents} variant="rel-easy" />
            <RelationshipSection title="Lastigste Tegenstander" data={stats.worstOpponents} variant="rel-hard" />
          </div>
        </div>

        {/* FOOTER */}
        <div className="print-footer">Gegenereerd door de Bounceball App {new Date().toLocaleDateString('nl-NL')}</div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
