
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
  minNights: number;
  nightsByPlayer: Map<number, number>;
  eligibleIds: Set<number>;
};

/* ===================== computeSeasonMeta ===================== */

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

    (s.teams || []).flat().forEach((p) => {
      if (allowedIds.has(p.id)) attending.add(p.id);
    });

    ((s as any).round2Teams ?? s.teams ?? []).flat().forEach((p: Player) => {
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

/* ===================== computeSeasonAggregates ===================== */

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

    if (s1 > s2) t1.forEach((p) => (ensureStanding(p.id).pts += 3));
    else if (s2 > s1) t2.forEach((p) => (ensureStanding(p.id).pts += 3));
    else {
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

/* ===================== PlayerPrintView ===================== */

const PlayerPrintView: React.FC<any> = ({
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
  const avgPoints = stats.gamesPlayed > 0 ? (Number(stats.points) || 0) / stats.gamesPlayed : 0;

  return createPortal(
    <div className="print-portal hidden">
      <div className="p-6 max-w-4xl mx-auto">

        {/* RIJ 2 */}
        <div className="print-grid">

          <div className="stat-box tile-orange">
            <div className="stat-title">Gespeelde wedstrijden</div>
            <div className="stat-value">{stats.gamesPlayed}</div>
          </div>

          <div className="stat-box tile-purple">
            <div className="stat-title">Resultaten</div>

            <div className="result-grid">
              <div className="result-item">
                <span className="result-text">
                  <span className="result-count">{stats.wins}</span>
                  <span className="result-label">Gewonnen</span>
                </span>
              </div>

              <div className="result-item">
                <span className="result-text">
                  <span className="result-count">{stats.draws}</span>
                  <span className="result-label">Gelijk</span>
                </span>
              </div>

              <div className="result-item">
                <span className="result-text">
                  <span className="result-count">{stats.losses}</span>
                  <span className="result-label">Verloren</span>
                </span>
              </div>
            </div>
          </div> {/* ✅ FIX: deze closing div ontbrak */}

          <div className="stat-box tile-teal">
            <div className="stat-title">Goals</div>
            <div className="stat-value">{stats.goalsScored}</div>
          </div>

          <div className="stat-box tile-red">
            <div className="stat-title">Gem. Punten</div>
            <div className="stat-value">{avgPoints.toFixed(2)}</div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
