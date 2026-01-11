import { Player, NKSession, NKRound, NKMatch } from '../types';

type PairKey = string;
const pairKey = (a: number, b: number): PairKey => [a, b].sort().join('-');

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession> {

  /* =======================
     0. VALIDATIE
  ======================= */

  const playersPerMatch = playersPerTeam * 2;
  const totalMatches = (players.length * matchesPerPlayer) / playersPerMatch;

  if (!Number.isInteger(totalMatches)) {
    throw new Error("Wedstrijden per speler niet haalbaar met dit aantal spelers.");
  }

  const rounds = Math.ceil(totalMatches / hallNames.length);

  const minKeepers = players.filter(p => p.isKeeper).length;
  if (minKeepers < rounds) {
    throw new Error("Te weinig keepers om eerlijk te verdelen.");
  }

  /* =======================
     1. STATE
  ======================= */

  const played = new Map<number, number>();
  const together = new Map<PairKey, number>();
  const against = new Map<PairKey, number>();

  players.forEach(p => played.set(p.id, 0));

  const allRounds: NKRound[] = [];

  /* =======================
     2. HOOFD LOOP PER RONDE
  ======================= */

  for (let r = 1; r <= rounds; r++) {
    onProgress(`Ronde ${r}/${rounds} genereren...`);

    const available = players
      .filter(p => played.get(p.id)! < matchesPerPlayer)
      .sort((a, b) => (played.get(a.id)! - played.get(b.id)!));

    const matchesInRound = Math.min(
      hallNames.length,
      Math.floor(available.length / playersPerMatch)
    );

    if (matchesInRound === 0) break;

    const used: Set<number> = new Set();
    const matches: NKMatch[] = [];
    const matchStrengths: number[] = [];

    for (let h = 0; h < matchesInRound; h++) {

      /* =======================
         3. MATCH SELECTIE
      ======================= */

      const pool = available
        .filter(p => !used.has(p.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, playersPerMatch);

      if (pool.length < playersPerMatch) {
        throw new Error("Onvoldoende spelers beschikbaar.");
      }

      pool.forEach(p => used.add(p.id));

      /* =======================
         4. TEAM SPLITSING
      ======================= */

      const sorted = [...pool].sort((a, b) => b.rating - a.rating);
      const team1: Player[] = [];
      const team2: Player[] = [];

      sorted.forEach((p, i) => {
        (i % 2 === 0 ? team1 : team2).push(p);
      });

      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / team1.length;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / team2.length;

      if (Math.abs(avg1 - avg2) > 0.3) {
        throw new Error("Balans > 0.3, schema onhaalbaar.");
      }

      /* =======================
         5. KEEPERS
      ======================= */

      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) {
        throw new Error("Keeperverdeling mislukt.");
      }

      /* =======================
         6. HISTORIE BIJHOUDEN
      ======================= */

      team1.forEach(a =>
        team1.forEach(b => {
          if (a.id !== b.id) {
            const k = pairKey(a.id, b.id);
            together.set(k, (together.get(k) || 0) + 1);
          }
        })
      );

      team2.forEach(a =>
        team2.forEach(b => {
          if (a.id !== b.id) {
            const k = pairKey(a.id, b.id);
            together.set(k, (together.get(k) || 0) + 1);
          }
        })
      );

      team1.forEach(a =>
        team2.forEach(b => {
          const k = pairKey(a.id, b.id);
          against.set(k, (against.get(k) || 0) + 1);
        })
      );

      /* =======================
         7. RESERVES
      ======================= */

      const reserves = players
        .filter(p => !used.has(p.id))
        .sort((a, b) => a.rating - b.rating);

      const low = reserves.find(p => p.rating < 5)!;
      const high = [...reserves].reverse().find(p => p.rating >= 5)!;

      const referee = reserves.find(p => p.id !== low.id && p.id !== high.id) || low;

      matches.push({
        id: `r${r}h${h}`,
        hallName: hallNames[h],
        team1,
        team2,
        team1Score: 0,
        team2Score: 0,
        isPlayed: false,
        subLow: low,
        subHigh: high,
        referee
      });

      matchStrengths.push((avg1 + avg2) / 2);

      team1.concat(team2).forEach(p =>
        played.set(p.id, played.get(p.id)! + 1)
      );
    }

    /* =======================
       8. GLOBALE MATCH BALANS
    ======================= */

    const max = Math.max(...matchStrengths);
    const min = Math.min(...matchStrengths);
    if (max - min > 2) {
      throw new Error("Te groot verschil tussen sterkste en zwakste wedstrijd.");
    }

    allRounds.push({
      roundNumber: r,
      matches,
      restingPlayers: players.filter(p => !matches.flatMap(m => [...m.team1, ...m.team2]).some(x => x.id === p.id))
    });
  }

  /* =======================
     9. EINDCHECK
  ======================= */

  players.forEach(p => {
    if (played.get(p.id)! !== matchesPerPlayer) {
      throw new Error(`${p.name} speelt niet exact ${matchesPerPlayer} wedstrijden.`);
    }
  });

  return {
    competitionName,
    hallNames,
    playersPerTeam,
    totalRounds: allRounds.length,
    rounds: allRounds,
    standings: players.map(p => ({
      playerId: p.id,
      playerName: p.name,
      points: 0,
      goalsFor: 0,
      goalDifference: 0,
      matchesPlayed: 0
    })),
    isCompleted: false
  };
}
