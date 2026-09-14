import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) =>
  new Promise(res => setTimeout(res, ms));

const GENERATOR_DIAGNOSTICS = true;

/**
 * ============================================================
 * INTRO / NK GENERATOR
 * ============================================================
 *
 * Belangrijk:
 * - GEEN tournament-reserve / invaller-logica in dit bestand.
 * - subHigh/subLow en referee blijven de bestaande NK-reserves.
 * - Voor Intro wordt de wedstrijdopbouw anders gedaan:
 *   we bouwen een complete ronde op basis van ratingparen.
 *
 * Daardoor kan een vroege "greedy" keuze niet meer een latere
 * wedstrijd onmogelijk maken.
 */

function diagnosticError(message: string): Error {
  return new Error(`[GENERATOR] ${message}`);
}

function describePlayers(players: Player[]): string {
  const counts = new Map<number, number>();

  players.forEach(p => {
    counts.set(
      p.rating,
      (counts.get(p.rating) || 0) + 1
    );
  });

  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => `${rating}:${count}`)
    .join(', ');
}

function getRequiredIntroRatings(
  poolCount: number
): number[] {
  if (poolCount === 2) return [5, 10];
  if (poolCount === 3) return [5, 7.5, 10];
  if (poolCount === 4) {
    return [2.5, 5, 7.5, 10];
  }

  throw new Error(
    'Aantal ratingpoules moet 2, 3 of 4 zijn.'
  );
}

function pairKey(
  a: Player,
  b: Player
): string {
  return [a.id, b.id]
    .sort((x, y) => x - y)
    .join('-');
}

function getManualTime(
  manualTimes: { start: string; end: string }[],
  roundNumber: number
) {
  return (
    manualTimes[roundNumber - 1] || {
      start: '',
      end: ''
    }
  );
}

/**
 * Kies een complete verdeling van ratingparen over de
 * wedstrijden van één Intro-ronde.
 *
 * Iedere wedstrijd heeft exact 4 paren (= 8 spelers).
 * Van één rating mogen maximaal 2 paren in één wedstrijd.
 *
 * remainingPairs = hoeveel paren van iedere rating in totaal
 * nog gespeeld moeten worden.
 */
function chooseIntroRoundComposition(
  remainingPairs: number[],
  roundsLeft: number,
  matchCount: number
): number[][] | null {
  const poolCount = remainingPairs.length;

  if (matchCount <= 0) {
    return [];
  }

  const totalRemaining =
    remainingPairs.reduce(
      (sum, n) => sum + n,
      0
    );

  if (totalRemaining !== matchCount * 4) {
    return null;
  }

  const rowOptions: number[][] = [];

  function buildRows(
    index: number,
    row: number[],
    sum: number
  ) {
    if (index === poolCount) {
      if (sum === 4) {
        rowOptions.push([...row]);
      }
      return;
    }

    for (let n = 0; n <= 2; n++) {
      if (sum + n > 4) break;

      row.push(n);

      buildRows(
        index + 1,
        row,
        sum + n
      );

      row.pop();
    }
  }

  buildRows(0, [], 0);

  const target = remainingPairs.map(
    n => n / roundsLeft
  );

  const rowScore = (row: number[]) =>
    row.reduce(
      (sum, n, i) =>
        sum +
        Math.abs(
          n - target[i]
        ),
      0
    );

  const result: number[][] = [];
  const totals = new Array(poolCount).fill(0);

  function search(
    matchIndex: number
  ): boolean {
    if (matchIndex === matchCount) {
      for (let i = 0; i < poolCount; i++) {
        if (
          totals[i] !==
          remainingPairs[i]
        ) {
          return false;
        }
      }

      return true;
    }

    const rows = [...rowOptions]
      .filter(row =>
        row.every(
          (n, i) =>
            totals[i] + n <=
            remainingPairs[i]
        )
      )
      .sort(
        (a, b) =>
          rowScore(a) -
          rowScore(b) ||
          Math.random() - 0.5
      );

    for (const row of rows) {
      let possible = true;

      for (
        let i = 0;
        i < poolCount;
        i++
      ) {
        const newTotal =
          totals[i] + row[i];

        const left =
          remainingPairs[i] -
          newTotal;

        const matchesAfter =
          matchCount -
          matchIndex -
          1;

        if (
          left < 0 ||
          left >
            matchesAfter * 2
        ) {
          possible = false;
          break;
        }
      }

      if (!possible) continue;

      row.forEach(
        (n, i) => {
          totals[i] += n;
        }
      );

      result.push(row);

      if (search(matchIndex + 1)) {
        return true;
      }

      result.pop();

      row.forEach(
        (n, i) => {
          totals[i] -= n;
        }
      );
    }

    return false;
  }

  if (!search(0)) {
    return null;
  }

  return result;
}

/**
 * Kies de spelers van één rating die deze ronde moeten spelen.
 *
 * Spelers met het minste aantal wedstrijden krijgen voorrang.
 * Bij gelijkstand wordt willekeurig geloot.
 */
function selectIntroRatingPlayers(
  players: Player[],
  playCounts: Map<number, number>,
  amount: number
): Player[] | null {
  if (amount === 0) return [];

  if (amount > players.length) {
    return null;
  }

  const sorted = [...players].sort(
    (a, b) =>
      (
        playCounts.get(a.id) || 0
      ) -
      (
        playCounts.get(b.id) || 0
      ) ||
      Math.random() - 0.5
  );

  return sorted.slice(0, amount);
}

/**
 * Maak paren binnen één rating.
 *
 * We vermijden waar mogelijk koppels die al vaak samen
 * hebben gespeeld.
 */
function makeIntroPairs(
  players: Player[],
  pairCounts: Map<string, number>
): [Player, Player][] | null {
  if (players.length % 2 !== 0) {
    return null;
  }

  const remaining = [...players];
  const pairs: [Player, Player][] = [];

  while (remaining.length > 0) {
    const first = remaining.shift()!;

    let bestIndex = -1;
    let bestScore = Infinity;

    for (
      let i = 0;
      i < remaining.length;
      i++
    ) {
      const candidate = remaining[i];

      const score =
        pairCounts.get(
          pairKey(first, candidate)
        ) || 0;

      if (
        score < bestScore ||
        (
          score === bestScore &&
          Math.random() < 0.5
        )
      ) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return null;
    }

    const second =
      remaining.splice(
        bestIndex,
        1
      )[0];

    pairs.push([
      first,
      second
    ]);
  }

  return pairs;
}

/**
 * Bouw één complete Intro-ronde.
 *
 * De vier wedstrijden worden als één geheel opgebouwd.
 */
function buildIntroRound(
  allPlayers: Player[],
  hallNames: string[],
  playCounts: Map<number, number>,
  pairCounts: Map<string, number>,
  mpp: number,
  ppt: number,
  roundNumber: number,
  roundsLeft: number,
  reservePoolCounts: Map<number, number>,
  reservePlayerCounts: Map<number, number>
): {
  matches: NKMatch[];
  resting: Player[];
} | null {
  const matchCount =
    Math.min(
      hallNames.length,
      Math.floor(
        allPlayers.length /
        (ppt * 2)
      )
    );

  if (matchCount <= 0) {
    return null;
  }

  const byRating =
    new Map<number, Player[]>();

  allPlayers.forEach(p => {
    if (!byRating.has(p.rating)) {
      byRating.set(
        p.rating,
        []
      );
    }

    byRating
      .get(p.rating)!
      .push(p);
  });

  const ratings =
    Array.from(
      byRating.keys()
    ).sort(
      (a, b) => a - b
    );

  const currentPairCounts =
    ratings.map(rating => {
      const pool =
        byRating.get(rating)!;

      const remaining =
        pool.filter(
          p =>
            (
              playCounts.get(
                p.id
              ) || 0
            ) < mpp
        ).length;

      return Math.floor(
        remaining / 2
      );
    });

  const totalNeeded =
    matchCount * 4;

  if (
    currentPairCounts.reduce(
      (s, n) => s + n,
      0
    ) < totalNeeded
  ) {
    return null;
  }

  const targetPairs =
    ratings.map(rating => {
      const pool =
        byRating.get(rating)!;

      const remaining =
        pool.filter(
          p =>
            (
              playCounts.get(
                p.id
              ) || 0
            ) < mpp
        ).length;

      const totalFuturePairs =
        Math.floor(
          remaining / 2
        );

      return Math.max(
        0,
        Math.round(
          totalFuturePairs /
          roundsLeft
        )
      );
    });

  let desiredTotal =
    targetPairs.reduce(
      (s, n) => s + n,
      0
    );

  while (
    desiredTotal <
    totalNeeded
  ) {
    let best = -1;
    let bestNeed = -Infinity;

    for (
      let i = 0;
      i < ratings.length;
      i++
    ) {
      const need =
        currentPairCounts[i] -
        targetPairs[i];

      if (
        currentPairCounts[i] >
          targetPairs[i] &&
        need > bestNeed
      ) {
        best = i;
        bestNeed = need;
      }
    }

    if (best < 0) break;

    targetPairs[best]++;
    desiredTotal++;
  }

  while (
    desiredTotal >
    totalNeeded
  ) {
    let best = -1;
    let bestExcess = -Infinity;

    for (
      let i = 0;
      i < ratings.length;
      i++
    ) {
      const excess =
        targetPairs[i] -
        (
          currentPairCounts[i] /
          Math.max(
            1,
            roundsLeft
          )
        );

      if (
        targetPairs[i] > 0 &&
        excess > bestExcess
      ) {
        best = i;
        bestExcess = excess;
      }
    }

    if (best < 0) break;

    targetPairs[best]--;
    desiredTotal--;
  }

  if (
    targetPairs.reduce(
      (s, n) => s + n,
      0
    ) !== totalNeeded
  ) {
    return null;
  }

  const composition =
    chooseIntroRoundComposition(
      targetPairs,
      1,
      matchCount
    );

  if (!composition) {
    return null;
  }

  const used =
    new Set<number>();

  const matches: NKMatch[] =
    [];

  for (
    let h = 0;
    h < matchCount;
    h++
  ) {
    const row =
      composition[h];

    const pairsByRating =
      new Map<
        number,
        [Player, Player][]
      >();

    for (
      let r = 0;
      r < ratings.length;
      r++
    ) {
      const rating =
        ratings[r];

      const amount =
        row[r] * 2;

      if (amount === 0) {
        pairsByRating.set(
          rating,
          []
        );
        continue;
      }

      const available =
        byRating
          .get(rating)!
          .filter(
            p =>
              !used.has(
                p.id
              ) &&
              (
                playCounts.get(
                  p.id
                ) || 0
              ) < mpp
          );

      const selected =
        selectIntroRatingPlayers(
          available,
          playCounts,
          amount
        );

      if (!selected) {
        return null;
      }

      const pairs =
        makeIntroPairs(
          selected,
          pairCounts
        );

      if (!pairs) {
        return null;
      }

      pairsByRating.set(
        rating,
        pairs
      );

      selected.forEach(
        p =>
          used.add(
            p.id
          )
      );
    }

    const team1: Player[] = [];
    const team2: Player[] = [];

    ratings.forEach(
      rating => {
        const pairs =
          pairsByRating.get(
            rating
          ) || [];

        pairs.forEach(
          ([a, b]) => {
            if (
              Math.random() <
              0.5
            ) {
              team1.push(a);
              team2.push(b);
            } else {
              team1.push(b);
              team2.push(a);
            }
          }
        );
      }
    );

    if (
      team1.length !== ppt ||
      team2.length !== ppt
    ) {
      return null;
    }

    matches.push({
      id: `r${roundNumber}h${h}`,
      hallName:
        hallNames[h],
      team1,
      team2,
      team1Score: 0,
      team2Score: 0,
      isPlayed: false,
      subLow:
        null as any,
      subHigh:
        null as any,
      referee:
        null as any
    });
  }

  const resting =
    allPlayers.filter(
      p =>
        !used.has(
          p.id
        )
    );

  const remaining =
    assignIntroReservesSafely(
      resting,
      matches,
      reservePoolCounts,
      reservePlayerCounts
    );

  if (!remaining) {
    return null;
  }

  const refereePool =
    [...remaining];

  for (
    const match of matches
  ) {
    if (
      refereePool.length ===
      0
    ) {
      return null;
    }

    const index =
      Math.floor(
        Math.random() *
          refereePool.length
      );

    match.referee =
      refereePool.splice(
        index,
        1
      )[0];
  }

  return {
    matches,
    resting: refereePool
  };
}

/**
 * Bestaande Intro-reserves.
 *
 * Dit is NIET de nieuwe tournament-reserve/invallerlogica.
 */
function assignIntroReservesSafely(
  resting: Player[],
  matches: NKMatch[],
  reservePoolCounts: Map<number, number>,
  reservePlayerCounts: Map<number, number>
): Player[] | null {
  const working =
    [...resting];

  const assignments: {
    match: NKMatch;
    first: Player;
    second: Player;
  }[] = [];

  function score(p: Player) {
    return (
      (reservePoolCounts.get(
        p.rating
      ) || 0) * 10 +
      (
        reservePlayerCounts.get(
          p.id
        ) || 0
      ) * 2
    );
  }

  function search(
    index: number
  ): boolean {
    if (
      index ===
      matches.length
    ) {
      return true;
    }

    const match =
      matches[index];

    const candidates =
      [...working].sort(
        (a, b) =>
          score(a) -
          score(b) ||
          Math.random() -
            0.5
      );

    for (
      const first of candidates
    ) {
      const secondCandidates =
        candidates
          .filter(
            p =>
              p.id !==
                first.id &&
              p.rating !==
                first.rating
          )
          .sort(
            (a, b) =>
              score(a) -
              score(b) ||
              Math.random() -
                0.5
          );

      for (
        const second of
        secondCandidates
      ) {
        const i1 =
          working.findIndex(
            p =>
              p.id ===
              first.id
          );

        const i2 =
          working.findIndex(
            p =>
              p.id ===
              second.id
          );

        if (
          i1 < 0 ||
          i2 < 0
        ) {
          continue;
        }

        const removed =
          i1 > i2
            ? [
                working[i1],
                working[i2]
              ]
            : [
                working[i2],
                working[i1]
              ];

        working.splice(
          Math.max(i1, i2),
          1
        );

        working.splice(
          Math.min(i1, i2),
          1
        );

        assignments.push({
          match,
          first,
          second
        });

        if (
          search(index + 1)
        ) {
          return true;
        }

        assignments.pop();

        working.push(
          removed[0]
        );

        working.push(
          removed[1]
        );
      }
    }

    return false;
  }

  if (!search(0)) {
    return null;
  }

  assignments.forEach(
    a => {
      a.match.subHigh =
        a.first;

      a.match.subLow =
        a.second;

      reservePoolCounts.set(
        a.first.rating,
        (
          reservePoolCounts.get(
            a.first.rating
          ) || 0
        ) + 1
      );

      reservePoolCounts.set(
        a.second.rating,
        (
          reservePoolCounts.get(
            a.second.rating
          ) || 0
        ) + 1
      );

      reservePlayerCounts.set(
        a.first.id,
        (
          reservePlayerCounts.get(
            a.first.id
          ) || 0
        ) + 1
      );

      reservePlayerCounts.set(
        a.second.id,
        (
          reservePlayerCounts.get(
            a.second.id
          ) || 0
        ) + 1
      );
    }
  );

  return working;
}

/**
 * Teamverdeling voor normaal NK.
 */
function getBestTeamSplit(
  players: Player[],
  ppt: number,
  targetDiff: number,
  minRating: number,
  isIntro: boolean,
  introPoolCount: number
) {
  let bestDiff = Infinity;

  let bestSplit: {
    t1: Player[];
    t2: Player[];
  } | null = null;

  if (isIntro) {
    const byRating =
      new Map<number, Player[]>();

    players.forEach(p => {
      if (!byRating.has(p.rating)) {
        byRating.set(
          p.rating,
          []
        );
      }

      byRating
        .get(p.rating)!
        .push(p);
    });

    const team1: Player[] = [];
    const team2: Player[] = [];

    for (
      const [, ratingPlayers]
      of byRating.entries()
    ) {
      if (
        ratingPlayers.length % 2 !==
        0
      ) {
        return null;
      }

      if (
        ratingPlayers.length > 4
      ) {
        return null;
      }

      const half =
        ratingPlayers.length /
        2;

      if (half > 2) {
        return null;
      }

      team1.push(
        ...ratingPlayers.slice(
          0,
          half
        )
      );

      team2.push(
        ...ratingPlayers.slice(
          half
        )
      );
    }

    if (
      team1.length !== ppt ||
      team2.length !== ppt
    ) {
      return null;
    }

    return {
      t1: team1,
      t2: team2
    };
  }

  function combine(
    start: number,
    team1: Player[]
  ) {
    if (
      team1.length === ppt
    ) {
      const team2 =
        players.filter(
          p =>
            !team1.some(
              t1p =>
                t1p.id ===
                p.id
            )
        );

      const avg1 =
        team1.reduce(
          (s, p) =>
            s + p.rating,
          0
        ) / ppt;

      const avg2 =
        team2.reduce(
          (s, p) =>
            s + p.rating,
          0
        ) / ppt;

      const k1 =
        team1.filter(
          p =>
            p.isKeeper
        ).length;

      const k2 =
        team2.filter(
          p =>
            p.isKeeper
        ).length;

      if (
        avg1 >= minRating &&
        avg2 >= minRating &&
        k1 <= 1 &&
        k2 <= 1
      ) {
        const diff =
          Math.abs(
            avg1 - avg2
          );

        if (
          diff < bestDiff
        ) {
          bestDiff = diff;

          bestSplit = {
            t1: [
              ...team1
            ],
            t2: [
              ...team2
            ]
          };
        }
      }

      return;
    }

    for (
      let i = start;
      i < players.length;
      i++
    ) {
      team1.push(
        players[i]
      );

      combine(
        i + 1,
        team1
      );

      team1.pop();

      if (
        bestDiff <=
        targetDiff
      ) {
        return;
      }
    }
  }

  combine(0, []);

  return bestSplit;
}

/**
 * Normale NK-selectie.
 */
function selectNormalMatchPlayers(
  candidates: Player[],
  pairCounts: Map<string, number>,
  ppm: number
): Player[] | null {
  if (
    candidates.length <
    ppm
  ) {
    return null;
  }

  const selected:
    Player[] = [];

  selected.push(
    candidates[0]
  );

  while (
    selected.length <
    ppm
  ) {
    const remaining =
      candidates.filter(
        c =>
          !selected.some(
            p =>
              p.id ===
              c.id
          )
      );

    if (
      remaining.length ===
      0
    ) {
      return null;
    }

    remaining.sort(
      (a, b) => {
        const scoreA =
          selected.reduce(
            (sum, p) =>
              sum +
              (
                pairCounts.get(
                  pairKey(
                    p,
                    a
                  )
                ) || 0
              ),
            0
          );

        const scoreB =
          selected.reduce(
            (sum, p) =>
              sum +
              (
                pairCounts.get(
                  pairKey(
                    p,
                    b
                  )
                ) || 0
              ),
            0
          );

        return (
          scoreA -
          scoreB ||
          Math.random() -
            0.5
        );
      }
    );

    selected.push(
      remaining[0]
    );
  }

  return selected;
}

async function generateSingleVersion(
  allPlayers: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  manualTimes: {
    start: string;
    end: string;
  }[],
  minRating: number,
  isIntro: boolean,
  introPoolCount: number,
  onProgress: (msg: string) => void
): Promise<NKSession | null> {
  const ppm =
    ppt * 2;

  const totalRounds =
    Math.ceil(
      (
        allPlayers.length *
        mpp /
        ppm
      ) /
      hallNames.length
    );

  const playCounts =
    new Map<number, number>();

  allPlayers.forEach(
    p =>
      playCounts.set(
        p.id,
        0
      )
  );

  const pairCounts =
    new Map<string, number>();

  const reservePoolCounts =
    new Map<number, number>();

  const reservePlayerCounts =
    new Map<number, number>();

  const rounds: NKRound[] =
    [];

  if (isIntro) {
    const requiredRatings =
      getRequiredIntroRatings(
        introPoolCount
      );

    const missing =
      requiredRatings.filter(
        rating =>
          !allPlayers.some(
            p =>
              p.rating ===
              rating
          )
      );

    if (
      missing.length > 0
    ) {
      throw diagnosticError(
        `Intro: de volgende ratingpoule(s) ontbreken: ${missing.join(', ')}. Aanwezige ratings: ${describePlayers(allPlayers)}`
      );
    }

    for (
      const rating of
      requiredRatings
    ) {
      const count =
        allPlayers.filter(
          p =>
            p.rating ===
            rating
        ).length;

      if (
        (count * mpp) % 2 !==
        0
      ) {
        throw diagnosticError(
          `Intro is wiskundig niet haalbaar voor rating ${rating}: ${count} spelers × ${mpp} wedstrijden = ${count * mpp} spelerbeurten.`
        );
      }
    }

    onProgress(
      `Intro gestart: ${allPlayers.length} spelers — ${mpp} wedstrijden p.p. — ${hallNames.length} zalen — ratings ${describePlayers(allPlayers)}.`
    );
  }

  let roundNumber = 1;

  while (
    roundNumber <= totalRounds
  ) {
    let success = false;

    const maxAttempts = 100;

    let lastReason =
      '';

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      try {
        if (isIntro) {
          const result =
            buildIntroRound(
              allPlayers,
              hallNames,
              playCounts,
              pairCounts,
              mpp,
              ppt,
              roundNumber,
              totalRounds -
                roundNumber +
                1,
              reservePoolCounts,
              reservePlayerCounts
            );

          if (!result) {
            throw diagnosticError(
              `Ronde ${roundNumber}: complete Intro-ronde kon niet worden samengesteld.`
            );
          }

          const time =
            getManualTime(
              manualTimes,
              roundNumber
            );

          rounds.push({
            roundNumber,
            matches:
              result.matches,
            restingPlayers:
              result.resting,
            startTime:
              time.start,
            endTime:
              time.end
          } as any);

          result.matches.forEach(
            match => {
              const playersInMatch =
                [
                  ...match.team1,
                  ...match.team2
                ];

              playersInMatch.forEach(
                p => {
                  playCounts.set(
                    p.id,
                    (
                      playCounts.get(
                        p.id
                      ) || 0
                    ) + 1
                  );
                }
              );

              for (
                let i = 0;
                i <
                playersInMatch.length;
                i++
              ) {
                for (
                  let j =
                    i + 1;
                  j <
                  playersInMatch.length;
                  j++
                ) {
                  const key =
                    pairKey(
                      playersInMatch[i],
                      playersInMatch[j]
                    );

                  pairCounts.set(
                    key,
                    (
                      pairCounts.get(
                        key
                      ) || 0
                    ) + 1
                  );
                }
              }
            }
          );

          success = true;
          break;
        }

        /**
         * NORMAAL NK
         */
        const usedThisRound =
          new Set<number>();

        const matches:
          NKMatch[] = [];

        const pool =
          [...allPlayers]
            .filter(
              p =>
                (
                  playCounts.get(
                    p.id
                  ) || 0
                ) < mpp
            )
            .sort(
              (a, b) =>
                (
                  mpp -
                  (
                    playCounts.get(
                      a.id
                    ) || 0
                  )
                ) -
                (
                  mpp -
                  (
                    playCounts.get(
                      b.id
                    ) || 0
                  )
                ) ||
                Math.random() -
                  0.5
            )
            .reverse();

        const mInRound =
          Math.min(
            hallNames.length,
            Math.floor(
              pool.length /
              ppm
            )
          );

        for (
          let h = 0;
          h < mInRound;
          h++
        ) {
          const candidates =
            pool.filter(
              p =>
                !usedThisRound.has(
                  p.id
                )
            );

          const mPlayers =
            selectNormalMatchPlayers(
              candidates,
              pairCounts,
              ppm
            );

          if (!mPlayers) {
            throw diagnosticError(
              `NK ronde ${roundNumber}, zaal ${h + 1}: geen ${ppm} spelers beschikbaar.`
            );
          }

          const split =
            getBestTeamSplit(
              mPlayers,
              ppt,
              0.30,
              minRating,
              false,
              introPoolCount
            );

          if (!split) {
            throw diagnosticError(
              `NK ronde ${roundNumber}, zaal ${h + 1}: teams konden niet geldig worden verdeeld.`
            );
          }

          const diff =
            Math.abs(
              (
                split.t1.reduce(
                  (s, p) =>
                    s + p.rating,
                  0
                ) /
                ppt
              ) -
              (
                split.t2.reduce(
                  (s, p) =>
                    s + p.rating,
                  0
                ) /
                ppt
              )
            );

          if (
            diff > 0.301
          ) {
            throw diagnosticError(
              `NK ronde ${roundNumber}, zaal ${h + 1}: teamverschil ${diff.toFixed(3)} is te groot.`
            );
          }

          mPlayers.forEach(
            p =>
              usedThisRound.add(
                p.id
              )
          );

          matches.push({
            id: `r${roundNumber}h${h}`,
            hallName:
              hallNames[h],
            team1:
              split.t1,
            team2:
              split.t2,
            team1Score: 0,
            team2Score: 0,
            isPlayed: false,
            subLow:
              null as any,
            subHigh:
              null as any,
            referee:
              null as any
          });
        }

        let resting =
          allPlayers.filter(
            p =>
              !usedThisRound.has(
                p.id
              )
          );

        resting.sort(
          (a, b) =>
            a.rating -
            b.rating
        );

        for (
          const match of matches
        ) {
          if (
            resting.length > 0
          ) {
            match.subLow =
              resting.shift()!;
          }
        }

        for (
          const match of matches
        ) {
          if (
            resting.length > 0
          ) {
            match.subHigh =
              resting.pop()!;
          }
        }

        for (
          const match of matches
        ) {
          if (
            resting.length > 0
          ) {
            match.referee =
              resting.splice(
                Math.floor(
                  Math.random() *
                    resting.length
                ),
                1
              )[0];
          }
        }

        const time =
          getManualTime(
            manualTimes,
            roundNumber
          );

        rounds.push({
          roundNumber,
          matches,
          restingPlayers:
            resting,
          startTime:
            time.start,
          endTime:
            time.end
        } as any);

        matches.forEach(
          match => {
            const ps = [
              ...match.team1,
              ...match.team2
            ];

            ps.forEach(
              p => {
                playCounts.set(
                  p.id,
                  (
                    playCounts.get(
                      p.id
                    ) || 0
                  ) + 1
                );
              }
            );

            for (
              let i = 0;
              i < ps.length;
              i++
            ) {
              for (
                let j = i + 1;
                j < ps.length;
                j++
              ) {
                const key =
                  pairKey(
                    ps[i],
                    ps[j]
                  );

                pairCounts.set(
                  key,
                  (
                    pairCounts.get(
                      key
                    ) || 0
                  ) + 1
                );
              }
            }
          }
        );

        success = true;
        break;
      } catch (e) {
        lastReason =
          e instanceof Error
            ? e.message
            : String(e);

        if (
          GENERATOR_DIAGNOSTICS &&
          (
            attempt === 1 ||
            attempt === 10 ||
            attempt === 25 ||
            attempt === 50 ||
            attempt === 75 ||
            attempt === 100
          )
        ) {
          onProgress(
            `Intro/NK ronde ${roundNumber}/${totalRounds}, poging ${attempt}: ${lastReason}`
          );
        }
      }
    }

    if (!success) {
      if (isIntro) {
        if (
          rounds.length >
          0
        ) {
          rounds.pop();

          playCounts.forEach(
            (_, id) =>
              playCounts.set(
                id,
                0
              )
          );

          pairCounts.clear();
          reservePoolCounts.clear();
          reservePlayerCounts.clear();

          for (
            const completedRound
            of rounds
          ) {
            completedRound.matches.forEach(
              match => {
                const ps = [
                  ...match.team1,
                  ...match.team2
                ];

                ps.forEach(
                  p => {
                    playCounts.set(
                      p.id,
                      (
                        playCounts.get(
                          p.id
                        ) || 0
                      ) + 1
                    );
                  }
                );

                for (
                  let i = 0;
                  i < ps.length;
                  i++
                ) {
                  for (
                    let j =
                      i + 1;
                    j < ps.length;
                    j++
                  ) {
                    const key =
                      pairKey(
                        ps[i],
                        ps[j]
                      );

                    pairCounts.set(
                      key,
                      (
                        pairCounts.get(
                          key
                        ) || 0
                      ) + 1
                    );
                  }
                }
              }
            );
          }

          roundNumber =
            Math.max(
              1,
              roundNumber - 1
            );

          onProgress(
            `Intro: ronde kon na ${maxAttempts} pogingen niet worden opgebouwd. Terug naar ronde ${roundNumber} en opnieuw proberen. Laatste oorzaak: ${lastReason}`
          );
        } else {
          onProgress(
            `Intro: eerste ronde kon na ${maxAttempts} pogingen niet worden opgebouwd. Laatste oorzaak: ${lastReason}`
          );

          return null;
        }
      } else {
        onProgress(
          `NK: ronde ${roundNumber} mislukt na ${maxAttempts} pogingen. Laatste oorzaak: ${lastReason}`
        );

        return null;
      }
    } else {
      if (
        isIntro &&
        (
          roundNumber === 1 ||
          roundNumber ===
            totalRounds
        )
      ) {
        onProgress(
          `Intro: ronde ${roundNumber}/${totalRounds} gelukt.`
        );
      }

      roundNumber++;
    }
  }

  const wrong =
    allPlayers.filter(
      p =>
        (
          playCounts.get(
            p.id
          ) || 0
        ) !== mpp
    );

  if (
    wrong.length > 0
  ) {
    onProgress(
      `Schema afgekeurd: ${wrong.length} spelers hebben niet exact ${mpp} wedstrijden. Voorbeelden: ${wrong
        .slice(0, 10)
        .map(
          p =>
            `${p.name || p.id}:${playCounts.get(p.id) || 0}`
        )
        .join(', ')}`
    );

    return null;
  }

  if (isIntro) {
    onProgress(
      `Intro-schema compleet: ${allPlayers.length} spelers hebben exact ${mpp} wedstrijden.`
    );
  }

  return {
    competitionName,
    hallNames,
    playersPerTeam: ppt,
    totalRounds:
      rounds.length,
    rounds,
    standings: [],
    isCompleted: false
  } as NKSession;
}

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  onProgress: (msg: string) => void,
  manualTimes: {
    start: string;
    end: string;
  }[],
  minTeamRating: number,
  isIntro: boolean,
  introPoolCount: number
): Promise<NKSession> {
  if (
    !players ||
    players.length === 0
  ) {
    throw new Error(
      'Geen spelers geselecteerd.'
    );
  }

  if (
    !hallNames ||
    hallNames.length === 0
  ) {
    throw new Error(
      'Geen zalen geselecteerd.'
    );
  }

  if (
    ppt <= 0
  ) {
    throw new Error(
      'Ongeldig aantal spelers per team.'
    );
  }

  const ppm =
    ppt * 2;

  if (
    players.length <
    ppm
  ) {
    throw new Error(
      `Er zijn ${players.length} spelers, maar minimaal ${ppm} spelers zijn nodig voor één wedstrijd.`
    );
  }

  if (
    isIntro
  ) {
    const ratings =
      getRequiredIntroRatings(
        introPoolCount
      );

    const missing =
      ratings.filter(
        rating =>
          !players.some(
            p =>
              p.rating ===
              rating
          )
      );

    if (
      missing.length > 0
    ) {
      throw new Error(
        `Intro kan niet starten: ratingpoule(s) ontbreken: ${missing.join(', ')}. Aanwezige ratings: ${describePlayers(players)}`
      );
    }

    onProgress(
      `Intro-generator: ${players.length} spelers, ${mpp} wedstrijden p.p., ${ppt} tegen ${ppt}, ${hallNames.length} zalen.`
    );
  }

  const validVersions:
    NKSession[] = [];

  let totalAttempts = 0;

  const maxVersions =
    isIntro ? 20 : 300;

  const maxAttempts =
    isIntro ? 100 : 3500;

  while (
    validVersions.length <
      maxVersions &&
    totalAttempts <
      maxAttempts
  ) {
    totalAttempts++;

    const session =
      await generateSingleVersion(
        players,
        hallNames,
        mpp,
        ppt,
        competitionName,
        manualTimes,
        minTeamRating,
        isIntro,
        introPoolCount,
        onProgress
      );

    if (session) {
      validVersions.push(
        session
      );

      if (
        isIntro &&
        validVersions.length >=
          maxVersions
      ) {
        break;
      }
    }

    if (
      totalAttempts % 10 ===
      0
    ) {
      onProgress(
        `Generator: ${validVersions.length} geldig(e) schema('s), poging ${totalAttempts}.`
      );

      await delay(1);
    }
  }

  if (
    validVersions.length ===
    0
  ) {
    throw new Error(
      isIntro
        ? `Geen geldig Intro-schema gevonden. Getest: ${players.length} spelers, ${mpp} wedstrijden p.p., ${ppt} tegen ${ppt}, ${hallNames.length} zalen. De oorzaak is hierboven in de diagnose zichtbaar.`
        : `Geen geldig NK-schema gevonden na ${totalAttempts} pogingen.`
    );
  }

  /**
   * Teamverschil wordt alleen voor het normale NK gebruikt.
   *
   * Intro wordt hier NIET door de 0.305-filter gehaald.
   */
  const getMaxDiff = (
    session: NKSession
  ): number => {
    let max = 0;

    session.rounds.forEach(
      round => {
        round.matches.forEach(
          match => {
            const avg1 =
              match.team1.reduce(
                (sum, p) =>
                  sum + p.rating,
                0
              ) /
              match.team1.length;

            const avg2 =
              match.team2.reduce(
                (sum, p) =>
                  sum + p.rating,
                0
              ) /
              match.team2.length;

            max = Math.max(
              max,
              Math.abs(
                avg1 - avg2
              )
            );
          }
        );
      }
    );

    return max;
  };

  const getSocialScore = (
    session: NKSession
  ): number => {
    const pairs =
      new Map<string, number>();

    session.rounds.forEach(
      round => {
        round.matches.forEach(
          match => {
            const ps = [
              ...match.team1,
              ...match.team2
            ];

            for (
              let i = 0;
              i < ps.length;
              i++
            ) {
              for (
                let j = i + 1;
                j < ps.length;
                j++
              ) {
                const key =
                  pairKey(
                    ps[i],
                    ps[j]
                  );

                pairs.set(
                  key,
                  (
                    pairs.get(
                      key
                    ) || 0
                  ) + 1
                );
              }
            }
          }
        );
      }
    );

    let score = 0;
    let maxRepeat = 0;

    pairs.forEach(
      count => {
        score +=
          Math.pow(
            count,
            6
          );

        maxRepeat =
          Math.max(
            maxRepeat,
            count
          );
      }
    );

    return (
      score +
      maxRepeat * 10000
    );
  };

  let candidates:
    NKSession[];

  if (isIntro) {
    // Intro krijgt GEEN max-diff filter.
    candidates = [
      ...validVersions
    ];
  } else {
    const balanceThreshold =
      0.305;

    candidates =
      validVersions.filter(
        session =>
          getMaxDiff(
            session
          ) <=
          balanceThreshold
      );

    if (
      candidates.length === 0
    ) {
      candidates =
        [...validVersions]
          .sort(
            (a, b) =>
              getMaxDiff(a) -
              getMaxDiff(b)
          )
          .slice(0, 10);
    }
  }

  const best =
    candidates.reduce(
      (currentBest, current) =>
        getSocialScore(
          current
        ) <
        getSocialScore(
          currentBest
        )
          ? current
          : currentBest
    );

  if (
    isIntro
  ) {
    onProgress(
      `Intro-schema gevonden en gecontroleerd: ${best.rounds.length} rondes, ${players.length} spelers, exact ${mpp} wedstrijden p.p.`
    );
  }

  return best;
}
