
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
 *
 * BELANGRIJK:
 * - R1 gebruikt session.teams
 * - R2 gebruikt session.round2Teams (fallback: session.teams)
 * - filter op allowedIds (huidige spelers) zodat ranks niet opschuiven door verwijderde spelers
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

    // goals per speler (topscorer)
    addPlayerGoals(match.team1Goals || []);
    addPlayerGoals(match.team2Goals || []);

    // GF/GD (alleen voor tie-break / info)
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

    // punten
    if (s1 > s2) {
      t1.forEach((p) => (ensureStanding(p.id).pts += 3));
    } else if (s2 > s1) {
      t2.forEach((p) => (ensureStanding(p.id).pts += 3));
    } else {
      t1.forEach((p) => (ensureStanding(p.id).pts += 1));
      t2.forEach((p) => (ensureStanding(p.id).pts += 1));
    }

    // verdediger: tegengoals per match (lager = beter)
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

/**
 * ✅ Competitie rank:
 * - hoofdregel: punten / wedstrijden (avg)  -> desc
 * - tie-break: doelsaldo (gd) -> desc (alleen als avg gelijk)
 * - tie-break: goals voor (gf) -> desc
 */
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

  rows.sort((a, b) => b.avg - a.avg || b.gd - a.gd || b.gf - a.gf || a.id - b.id);

  const idx = rows.findIndex((r) => r.id === playerId);
  return idx >= 0 ? idx + 1 : 0;
};

/**
 * ✅ Topscorer rank:
 * - goals / wedstrijden (avg) -> desc
 * - tie-break: total goals -> desc
 */
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

/**
 * ✅ Verdediger rank:
 * - tegengoals / wedstrijden -> asc (lager beter)
 */
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

const PrintChart: React.FC<{ data: { date: string; rating: number }[]; title: string }> = ({
  data,
  title,
}) => {
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
  const getY = (rating: number) =>
    height - padding - ((rating - minY) / (maxY - minY)) * (height - padding * 2);

  const points = data.map((d, i) => `${getX(i)},${getY(d.rating)}`).join(' ');

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Nu') return 'Nu';
    return new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="border border-gray-300 rounded p-4 bg-white mb-4 break-inside-avoid">
      <h5 className="text-sm font-bold uppercase text-black mb-2 text-center">{title}</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#eee" strokeWidth="1" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#eee" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#eee" strokeWidth="1" />

        <polyline fill="none" stroke="#000" strokeWidth="2.5" points={points} strokeLinejoin="round" />

        <text
          x={padding - 5}
          y={getY(maxRating)}
          className="text-[12px] fill-gray-600 font-bold"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {maxRating.toFixed(1)}
        </text>
        <text
          x={padding - 5}
          y={getY(minRating)}
          className="text-[12px] fill-gray-600 font-bold"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {minRating.toFixed(1)}
        </text>

        <text x={getX(0)} y={height - 15} className="text-[12px] fill-gray-600" textAnchor="start">
          {formatDate(data[0].date)}
        </text>
        <text
          x={getX(Math.floor(data.length / 2))}
          y={height - 15}
          className="text-[12px] fill-gray-600"
          textAnchor="middle"
        >
          {formatDate(data[Math.floor(data.length / 2)].date)}
        </text>
        <text
          x={getX(data.length - 1)}
          y={height - 15}
          className="text-[12px] fill-gray-600"
          textAnchor="end"
        >
          {formatDate(data[data.length - 1].date)}
        </text>

        <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1].rating)} r="4" fill="black" />
        <text
          x={getX(data.length - 1)}
          y={getY(data[data.length - 1].rating) - 10}
          className="text-[12px] fill-black font-bold"
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
    if (type === 'Verdediger') return <ShieldIcon className="w-8 h-8 text-black" />;
    return <TrophyIcon className="w-8 h-8 text-black" />;
  };

  const RelationshipSection: React.FC<{ title: string; data: [number, number][] }> = ({
    title,
    data,
  }) => (
    <div className="break-inside-avoid mb-4">
      <h4 className="font-bold uppercase text-xs mb-2 text-gray-600 border-b border-gray-300 pb-1">
        {title}
      </h4>
      <ul className="text-xs">
        {data.length > 0 ? (
          data.slice(0, 5).map(([id, count]) => {
            const p = playerMap.get(id);
            return (
              <li
                key={id}
                className="flex justify-between py-1 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium">{p ? p.name : `Speler ${id}`}</span>
                <span className="font-bold text-gray-500">{count}x</span>
              </li>
            );
          })
        ) : (
          <li className="text-gray-400 italic py-1">- Geen data -</li>
        )}
      </ul>
    </div>
  );

  const avgPoints = stats.gamesPlayed > 0 ? (Number(stats.points) || 0) / stats.gamesPlayed : 0;

  // ✅ seizoen start op eerste punt van seasonHistory
  const seasonStartMs = useMemo(() => toMs(seasonHistory?.[0]?.date || ''), [seasonHistory]);

  // ✅ allowedIds = alleen huidige spelers
  const allowedIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);

  // ✅ season meta (avonden + drempel)
  const seasonMeta = useMemo(
    () =>
      computeSeasonMeta({
        history: history || [],
        seasonStartMs,
        allowedIds,
      }),
    [history, seasonStartMs, allowedIds]
  );

  // ✅ Aanwezigheid van deze speler (seizoen)
  const seasonAttendance = useMemo(() => {
    const attendedNights = seasonMeta.nightsByPlayer.get(player.id) || 0;
    return { attendedNights, totalNights: seasonMeta.totalNights };
  }, [seasonMeta, player.id]);

  // jouw regel: alleen tonen als deze speler >=50% avonden
  const eligible50 =
    seasonAttendance.totalNights > 0 &&
    seasonAttendance.attendedNights / seasonAttendance.totalNights >= 0.5;

  // ✅ positie + topscorer + verdediger (seizoen, consistent met Statistics)
  const seasonRanks = useMemo(() => {
    const { standings, goalsForPlayer, defense } = computeSeasonAggregates({
      history: history || [],
      seasonStartMs,
      allowedIds,
    });

    const position = rankStanding(standings, player.id, seasonMeta.eligibleIds);

    // topscorer avg = goals / matches (matches uit standings.matches)
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

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            body::before { display: none !important; }
            html, body { background: white !important; height: 100%; margin: 0; padding: 0; }
            body > *:not(.print-portal) { display: none !important; }

            @page { size: A4; margin: 10mm; }

            .print-portal {
              display: block !important;
              position: absolute;
              top: 0; left: 0;
              width: 100%;
              height: 100%;
              background: white;
              color: black;
              font-family: sans-serif;
              z-index: 9999;
            }

            /* ✅ verberg url’s linksonder */
            a[href]:after { content: "" !important; }
            a:after { content: "" !important; }

            .stat-box { border: 2px solid #e5e7eb; padding: 10px; border-radius: 8px; text-align: center; }
            .print-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .relationships-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }

            .stat-title { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 800; }
            .stat-value { font-size: 22px; font-weight: 900; }
            .stat-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
          }
        `}
      </style>

      <div className="p-6 max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-4">
          <div className="flex items-center">
            {player.photoBase64 ? (
              <img
                src={player.photoBase64}
                alt={player.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-black mr-6"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 border-2 border-black mr-6 flex items-center justify-center text-3xl font-bold">
                {player.name.charAt(0)}
              </div>
            )}

            <div>
              <h1 className="text-4xl font-black uppercase tracking-wide">{player.name}</h1>
              <div className="flex gap-2 mt-2 text-sm font-bold uppercase text-gray-600">
                {player.isKeeper && (
                  <span className="border border-black px-2 py-1 rounded">Keeper</span>
                )}
                {player.isFixedMember && (
                  <span className="border border-black px-2 py-1 rounded">Lid</span>
                )}
                <span className="border border-black px-2 py-1 rounded">
                  Rating: {player.rating.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <img
            src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png"
            alt="Logo"
            className="h-20 w-auto"
          />
        </div>

        {/* PRIJZENKAST BOVEN */}
        {trophies.length > 0 && (
          <div className="mb-6 break-inside-avoid">
            <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase">
              Prijzenkast
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {trophies.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center border border-gray-200 p-2 rounded bg-gray-50"
                >
                  <div className="mr-3 text-gray-800">{getTrophyContent(t.type)}</div>
                  <div>
                    <div className="font-bold text-sm">{t.type}</div>
                    <div className="text-xs text-gray-500">{t.year}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RIJ 1 */}
        <div className="print-grid">
          <div className="stat-box">
            <div className="stat-title">Speelavonden aanwezig</div>
            <div className="stat-value">
              {seasonAttendance.attendedNights}/{seasonAttendance.totalNights}
            </div>
            <div className="stat-sub">Minimaal: {seasonRanks.minNights} avonden</div>
          </div>

          <div className="stat-box">
            <div className="stat-title">Competitie</div>
            <div className="stat-value">{eligible50 ? ordinalNl(seasonRanks.position) : '—'}</div>
            {!eligible50 && <div className="stat-sub">min 50% aanwezig</div>}
          </div>

          <div className="stat-box">
            <div className="stat-title">Topscoorder</div>
            <div className="stat-value">
              {eligible50 ? `${ordinalNl(seasonRanks.topscorerRank)}` : '—'}
            </div>
            <div className="stat-sub">
              {eligible50
                ? `${seasonRanks.topscorerGoals} goals (${seasonRanks.topscorerAvg.toFixed(2)}/w)`
                : 'min 50% aanwezig'}
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-title">Verdediger</div>
            <div className="stat-value">
              {eligible50 ? `${ordinalNl(seasonRanks.defenderRank)}` : '—'}
            </div>
            <div className="stat-sub">
              {eligible50 && Number.isFinite(seasonRanks.defenderAvgAgainst)
                ? `${seasonRanks.defenderAvgAgainst.toFixed(2)} tegen / w`
                : 'min 50% aanwezig'}
            </div>
          </div>
        </div>

        {/* RIJ 2 */}
        <div className="print-grid">
          <div className="stat-box">
            <div className="stat-title">Gespeelde wedstrijden</div>
            <div className="stat-value">{stats.gamesPlayed}</div>
          </div>

         <div className="stat-box">
  <div className="stat-title">Resultaten</div>

  <div style={{ marginTop: 6 }}>
    <div className="stat-sub" style={{ fontSize: 12, color: '#111', fontWeight: 800 }}>
      {stats.wins} gewonnen
    </div>
    <div className="stat-sub" style={{ fontSize: 12, color: '#111', fontWeight: 800 }}>
      {stats.draws} gelijk
    </div>
    <div className="stat-sub" style={{ fontSize: 12, color: '#111', fontWeight: 800 }}>
      {stats.losses} verloren
    </div>
  </div>
</div>

          <div className="stat-box">
            <div className="stat-title">Goals</div>
            <div className="stat-value">{stats.goalsScored}</div>
          </div>

          <div className="stat-box">
            <div className="stat-title">Gem. Punten</div>
            <div className="stat-value">{avgPoints.toFixed(2)}</div>
          </div>
        </div>

        {/* GRAFIEKEN: seizoen + all-time */}
        <div className="mb-8">
          <PrintChart data={seasonHistory} title="Verloop Huidig Seizoen" />
          <PrintChart data={allTimeHistory} title="All-Time Verloop" />
        </div>

        {/* RELATIES */}
        <div className="mb-8">
          <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase">
            Statistieken vs Spelers (Top 5)
          </h3>
          <div className="relationships-grid">
            <RelationshipSection title="Vaak samen" data={stats.mostFrequentTeammates} />
            <RelationshipSection title="Beste Medespeler" data={stats.bestTeammates} />
            <RelationshipSection title="Slechtste Medespeler" data={stats.worstTeammates} />
            <RelationshipSection title="Makkelijkste Tegenstander" data={stats.bestOpponents} />
            <RelationshipSection title="Lastigste Tegenstander" data={stats.worstOpponents} />
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center text-[10px] text-gray-400 mt-auto pt-4 border-t border-gray-200">
          Gegenereerd door de Bounceball App  {new Date().toLocaleDateString('nl-NL')}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
