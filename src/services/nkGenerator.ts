import {
  Player,
  NKSession,
  NKRound,
  NKMatch,
  NKInfillAssignment
} from '../types';

const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

/* =========================================================
   INTRODUCTIE TOERNOOI
   ========================================================= */

function getRequiredIntroRatings(poolCount: number): number[] {
  if (poolCount === 2) return [5, 10];
  if (poolCount === 3) return [5, 7.5, 10];
  if (poolCount === 4) return [2.5, 5, 7.5, 10];

  throw new Error(
    'Aantal ratingpoules moet 2, 3 of 4 zijn.'
  );
}

/* =========================================================
   INTRODUCTIE FOUTANALYSE
   ========================================================= */

function analyseIntroPools(
  allPlayers: Player[],
  mpp: number,
  ppt: number,
  introPoolCount: number
): string[] {
  const errors: string[] = [];

  const requiredRatings =
    getRequiredIntroRatings(introPoolCount);

  const actualRatings = Array.from(
    new Set(allPlayers.map(player => player.rating))
  ).sort((a, b) => a - b);

  const requiredSet = new Set(requiredRatings);

  /*
   * -------------------------------------------------------
   * 1. Controleer of er verkeerde ratingpoules aanwezig zijn
   * -------------------------------------------------------
   */

  const unexpectedRatings = actualRatings.filter(
    rating => !requiredSet.has(rating)
  );

  if (unexpectedRatings.length > 0) {
    errors.push(
      `Verkeerde ratingpoule(s): ${unexpectedRatings
        .map(r => `${r}`)
        .join(', ')}. Bij ${introPoolCount} ratingpoules zijn alleen ${requiredRatings
        .map(r => `${r}`)
        .join(', ')} toegestaan.`
    );
  }

  /*
   * -------------------------------------------------------
   * 2. Controleer ontbrekende ratingpoules
   * -------------------------------------------------------
   */

  const missingRatings = requiredRatings.filter(
    rating => !actualRatings.includes(rating)
  );

  if (missingRatings.length > 0) {
    errors.push(
      `Ontbrekende ratingpoule(s): ${missingRatings
        .map(r => `${r}`)
        .join(', ')}.`
    );
  }

  /*
   * -------------------------------------------------------
   * 3. Toon exacte aantallen per ratingpoule
   * -------------------------------------------------------
   */

  const poolCounts = new Map<number, number>();

  requiredRatings.forEach(rating => {
    poolCounts.set(
      rating,
      allPlayers.filter(
        player => player.rating === rating
      ).length
    );
  });

  /*
   * -------------------------------------------------------
   * 4. Bereken theoretische maximale capaciteit
   *
   * Iedere wedstrijd bestaat uit ppt koppels.
   * Per rating mogen maximaal 2 koppels in één wedstrijd
   * zitten (= maximaal 4 spelers van dezelfde rating).
   * -------------------------------------------------------
   */

  const ppm = ppt * 2;

  if ((allPlayers.length * mpp) % ppm !== 0) {
    errors.push(
      `Het totaal aantal spelers (${allPlayers.length}) × ${mpp} wedstrijden kan niet gelijkmatig over wedstrijden van ${ppt} tegen ${ppt} worden verdeeld.`
    );

    return errors;
  }

  const totalMatches =
    (allPlayers.length * mpp) / ppm;

  const maxPlayersPerPool = Math.floor(
    (totalMatches * 4) / mpp
  );

  /*
   * -------------------------------------------------------
   * 5. Controleer per rating op te weinig / te veel
   *
   * "Te veel" kunnen we exact bepalen:
   * er zijn simpelweg niet genoeg plaatsen voor zoveel
   * spelers uit één ratingpoule.
   *
   * "Te weinig" kan soms pas tijdens het schema bouwen
   * blijken, daarom bewaren we hieronder ook een
   * verdelingsoverzicht.
   * -------------------------------------------------------
   */

  requiredRatings.forEach(rating => {
    const count =
      poolCounts.get(rating) || 0;

    if (count === 0) {
      return;
    }

    if (count > maxPlayersPerPool) {
      errors.push(
        `Te veel spelers in ratingpoule ${rating}: ${count} spelers. Maximum is ongeveer ${maxPlayersPerPool} spelers voor deze toernooivorm.`
      );
    }
  });

  /*
   * -------------------------------------------------------
   * 6. Toon een compact overzicht wanneer er een
   * structureel probleem is.
   * -------------------------------------------------------
   */

  if (
    errors.length > 0 &&
    requiredRatings.length > 0
  ) {
    const overview = requiredRatings
      .map(rating => {
        const count =
          poolCounts.get(rating) || 0;

        return `${rating}: ${count} spelers`;
      })
      .join(' | ');

    errors.push(
      `Huidige verdeling: ${overview}.`
    );
  }

  /*
   * -------------------------------------------------------
   * 7. Controleer tournament-reserves
   * -------------------------------------------------------
   */

  const tournamentReserves =
    allPlayers.filter(
      player => player.isTournamentReserve
    );

  tournamentReserves.forEach(reserve => {
    const sameRatingNonReserves =
      allPlayers.filter(
        player =>
          player.rating === reserve.rating &&
          !player.isTournamentReserve
      );

    if (
      sameRatingNonReserves.length === 0
    ) {
      errors.push(
        `Reserve-deelnemer "${reserve.name}" heeft rating ${reserve.rating}, maar er is geen enkele niet-reserve speler met exact dezelfde rating die kan invallen.`
      );
    }
  });

  /*
   * -------------------------------------------------------
   * 8. Controleer of er überhaupt genoeg spelers zijn
   * -------------------------------------------------------
   */

  if (allPlayers.length < ppm) {
    errors.push(
      `Te weinig spelers: ${allPlayers.length} geselecteerd, maar minimaal ${ppm} spelers zijn nodig voor ${ppt} tegen ${ppt}.`
    );
  }

  return errors;
}

/* =========================================================
   INTRO RESERVES / SUBS
   ========================================================= */

function chooseWeightedIntroReserve(
  candidates: Player[],
  reservePoolCounts: Map<number, number>,
  reservePlayerCounts: Map<number, number>,
  excludedRatings: Set<number>
): Player | null {
  const available = candidates.filter(
    p =>
      !excludedRatings.has(p.rating) &&
      !p.isTournamentReserve
  );

  if (available.length === 0) {
    return null;
  }

  const maxPoolCount = Math.max(
    ...available.map(
      p => reservePoolCounts.get(p.rating) || 0
    )
  );

  const weights = available.map(p => {
    const poolCount =
      reservePoolCounts.get(p.rating) || 0;

    const playerCount =
      reservePlayerCounts.get(p.id) || 0;

    return Math.max(
      1,
      (maxPoolCount - poolCount + 1) * 4 +
        Math.max(0, 3 - playerCount)
    );
  });

  const totalWeight = weights.reduce(
    (sum, weight) => sum + weight,
    0
  );

  let roll = Math.random() * totalWeight;

  for (let i = 0; i < available.length; i++) {
    roll -= weights[i];

    if (roll <= 0) {
      return available[i];
    }
  }

  return available[available.length - 1];
}

function assignIntroReserves(
  resting: Player[],
  matches: NKMatch[],
  reservePoolCounts: Map<number, number>,
  reservePlayerCounts: Map<number, number>
): Player[] {
  /*
   * Tournament reserves mogen nooit als gewone fysieke
   * reserves/subs worden gebruikt.
   */

  let available = resting.filter(
    p => !p.isTournamentReserve
  );

  for (const match of matches) {
    if (available.length < 2) {
      throw new Error(
        'Niet genoeg spelers beschikbaar voor de gewone reserves.'
      );
    }

    const first = chooseWeightedIntroReserve(
      available,
      reservePoolCounts,
      reservePlayerCounts,
      new Set()
    );

    if (!first) {
      throw new Error(
        'Geen geldige eerste gewone reserve gevonden.'
      );
    }

    available = available.filter(
      p => p.id !== first.id
    );

    match.subHigh = first;

    reservePoolCounts.set(
      first.rating,
      (reservePoolCounts.get(first.rating) || 0) + 1
    );

    reservePlayerCounts.set(
      first.id,
      (reservePlayerCounts.get(first.id) || 0) + 1
    );

    const second = chooseWeightedIntroReserve(
      available,
      reservePoolCounts,
      reservePlayerCounts,
      new Set([first.rating])
    );

    if (!second) {
      throw new Error(
        'Geen geldige tweede gewone reserve gevonden.'
      );
    }

    available = available.filter(
      p => p.id !== second.id
    );

    match.subLow = second;

    reservePoolCounts.set(
      second.rating,
      (reservePoolCounts.get(second.rating) || 0) + 1
    );

    reservePlayerCounts.set(
      second.id,
      (reservePlayerCounts.get(second.id) || 0) + 1
    );
  }

  return available;
}

/* =========================================================
   TOERNOOI RESERVE -> FYSIEKE INVALLER
   ========================================================= */

function assignTournamentReserveInfill(
  allPlayers: Player[],
  matches: NKMatch[],
  roundNumber: number,
  infillPlayerCounts: Map<number, number>
): NKInfillAssignment[] {
  /*
   * Bepaal eerst welke spelers deze ronde officieel spelen.
   *
   * Tournament reserves staan hier dus gewoon tussen.
   */

  const officialPlayersThisRound = new Set<number>();

  matches.forEach(match => {
    match.team1.forEach(player => {
      officialPlayersThisRound.add(player.id);
    });

    match.team2.forEach(player => {
      officialPlayersThisRound.add(player.id);
    });
  });

  /*
   * Alleen echte niet-reserve spelers die deze ronde
   * niet officieel spelen kunnen invallen.
   */

  const availablePlayers = allPlayers.filter(
    player =>
      !player.isTournamentReserve &&
      !officialPlayersThisRound.has(player.id)
  );

  const assignments: NKInfillAssignment[] = [];

  /*
   * Elke tournament reserve die deze ronde speelt
   * moet een fysieke invaller krijgen.
   */

  for (const match of matches) {
    const reservePlayers = [
      ...match.team1.map(player => ({
        player,
        team: 'BLAUW' as const
      })),

      ...match.team2.map(player => ({
        player,
        team: 'GEEL' as const
      }))
    ].filter(
      item => item.player.isTournamentReserve
    );

    for (const reserve of reservePlayers) {
      /*
       * Exact dezelfde rating is verplicht.
       */

      const candidates = availablePlayers
        .filter(player => {
          const alreadyAssigned =
            assignments.some(
              assignment =>
                assignment.substitutePlayerId ===
                player.id
            );

          return (
            !alreadyAssigned &&
            player.rating === reserve.player.rating
          );
        })
        .sort((a, b) => {
          const countA =
            infillPlayerCounts.get(a.id) || 0;

          const countB =
            infillPlayerCounts.get(b.id) || 0;

          /*
           * Eerst degene met de minste eerdere
           * invalbeurten.
           */

          if (countA !== countB) {
            return countA - countB;
          }

          /*
           * Bij gelijkstand willekeurig.
           */

          return Math.random() - 0.5;
        });

      if (candidates.length === 0) {
        throw new Error(
          `Geen invaller met exact dezelfde rating (${reserve.player.rating}) beschikbaar voor reserve-deelnemer "${reserve.player.name}" in ronde ${roundNumber}.`
        );
      }

      const substitute = candidates[0];

      assignments.push({
        roundNumber,
        matchId: match.id,
        reservePlayerId: reserve.player.id,
        substitutePlayerId: substitute.id,
        hallName: match.hallName,
        team: reserve.team
      });
    }
  }

  return assignments;
}

/* =========================================================
   TEAMS MAKEN
   ========================================================= */

function getBestTeamSplit(
  players: Player[],
  ppt: number,
  targetDiff: number,
  minRating: number,
  isIntro: boolean,
  introPoolCount: number
): {
  t1: Player[];
  t2: Player[];
} | null {
  let bestDiff = Infinity;

  let bestSplit: {
    t1: Player[];
    t2: Player[];
  } | null = null;

  /*
   * INTRO
   *
   * Hier is GEEN rating-difference-eis.
   *
   * De spelers worden per rating gespiegeld.
   */

  if (isIntro) {
    const byRating =
      new Map<number, Player[]>();

    players.forEach(player => {
      if (!byRating.has(player.rating)) {
        byRating.set(player.rating, []);
      }

      byRating.get(player.rating)!.push(player);
    });

    const team1: Player[] = [];
    const team2: Player[] = [];

    for (const [, ratingPlayers] of byRating.entries()) {
      /*
       * Een rating moet binnen deze wedstrijd
       * even vaak voorkomen.
       */

      if (
        ratingPlayers.length % 2 !== 0 ||
        ratingPlayers.length > 4
      ) {
        return null;
      }

      const half =
        ratingPlayers.length / 2;

      /*
       * Maximaal twee spelers van dezelfde rating
       * per team.
       */

      if (half > 2) {
        return null;
      }

      const shuffled =
        [...ratingPlayers].sort(
          () => Math.random() - 0.5
        );

      team1.push(
        ...shuffled.slice(0, half)
      );

      team2.push(
        ...shuffled.slice(half)
      );
    }

    if (
      team1.length !== ppt ||
      team2.length !== ppt
    ) {
      return null;
    }

    bestDiff = Math.abs(
      team1.reduce(
        (sum, player) =>
          sum + player.rating,
        0
      ) / ppt -
        team2.reduce(
          (sum, player) =>
            sum + player.rating,
          0
        ) / ppt
    );

    bestSplit = {
      t1: team1,
      t2: team2
    };

    return bestSplit;
  }

  /* =======================================================
     NORMAAL NK
     ======================================================= */

  function combine(
    start: number,
    team1: Player[]
  ) {
    if (team1.length === ppt) {
      const team2 =
        players.filter(
          player =>
            !team1.some(
              selected =>
                selected.id === player.id
            )
        );

      if (team2.length !== ppt) {
        return;
      }

      const avg1 =
        team1.reduce(
          (sum, player) =>
            sum + player.rating,
          0
        ) / ppt;

      const avg2 =
        team2.reduce(
          (sum, player) =>
            sum + player.rating,
          0
        ) / ppt;

      const keepers1 =
        team1.filter(
          player => player.isKeeper
        ).length;

      const keepers2 =
        team2.filter(
          player => player.isKeeper
        ).length;

      const keepersOk =
        keepers1 <= 1 &&
        keepers2 <= 1;

      if (
        avg1 >= minRating &&
        avg2 >= minRating &&
        keepersOk
      ) {
        const diff =
          Math.abs(avg1 - avg2);

        if (diff < bestDiff) {
          bestDiff = diff;

          bestSplit = {
            t1: [...team1],
            t2: [...team2]
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
      team1.push(players[i]);

      combine(i + 1, team1);

      team1.pop();

      if (bestDiff <= targetDiff) {
        return;
      }
    }
  }

  combine(0, []);

  return bestSplit;
}

/* =========================================================
   INTRO WEDSTRIJD SPELERS SELECTEREN
   ========================================================= */

function selectIntroMatchPlayers(
  candidates: Player[],
  pairCounts: Map<string, number>,
  ppt: number
): Player[] | null {
  const neededPairs = ppt;

  const pairOptions: {
    a: Player;
    b: Player;
    rating: number;
    score: number;
  }[] = [];

  const byRating =
    new Map<number, Player[]>();

  candidates.forEach(player => {
    if (!byRating.has(player.rating)) {
      byRating.set(player.rating, []);
    }

    byRating
      .get(player.rating)!
      .push(player);
  });

  byRating.forEach(
    (ratingPlayers, rating) => {
      for (
        let i = 0;
        i < ratingPlayers.length;
        i++
      ) {
        for (
          let j = i + 1;
          j < ratingPlayers.length;
          j++
        ) {
          const a =
            ratingPlayers[i];

          const b =
            ratingPlayers[j];

          const key = [
            a.id,
            b.id
          ]
            .sort()
            .join('-');

          pairOptions.push({
            a,
            b,
            rating,
            score:
              pairCounts.get(key) || 0
          });
        }
      }
    }
  );

  if (
    pairOptions.length <
    neededPairs
  ) {
    return null;
  }

  pairOptions.sort(
    (a, b) =>
      a.score - b.score ||
      Math.random() - 0.5
  );

  const chosen:
    typeof pairOptions = [];

  const used =
    new Set<number>();

  const pairsPerRating =
    new Map<number, number>();

  function search(
    start: number
  ): boolean {
    if (
      chosen.length ===
      neededPairs
    ) {
      return true;
    }

    for (
      let i = start;
      i < pairOptions.length;
      i++
    ) {
      const option =
        pairOptions[i];

      if (
        used.has(option.a.id) ||
        used.has(option.b.id)
      ) {
        continue;
      }

      const countForRating =
        pairsPerRating.get(
          option.rating
        ) || 0;

      if (
        countForRating >= 2
      ) {
        continue;
      }

      chosen.push(option);

      used.add(option.a.id);
      used.add(option.b.id);

      pairsPerRating.set(
        option.rating,
        countForRating + 1
      );

      if (
        search(i + 1)
      ) {
        return true;
      }

      chosen.pop();

      used.delete(
        option.a.id
      );

      used.delete(
        option.b.id
      );

      if (
        countForRating === 0
      ) {
        pairsPerRating.delete(
          option.rating
        );
      } else {
        pairsPerRating.set(
          option.rating,
          countForRating
        );
      }
    }

    return false;
  }

  if (!search(0)) {
    return null;
  }

  return chosen.flatMap(
    pair => [
      pair.a,
      pair.b
    ]
  );
}

/* =========================================================
   ÉÉN VOLLEDIGE VERSIE GENEREREN
   ========================================================= */

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
  introPoolCount: number
): Promise<NKSession | null> {
  const ppm = ppt * 2;

  const totalMatches =
    (allPlayers.length * mpp) /
    ppm;

  const totalRounds =
    Math.ceil(
      totalMatches /
        hallNames.length
    );

  const playedCount =
    new Map<number, number>(
      allPlayers.map(player => [
        player.id,
        0
      ])
    );

  const pairCounts =
    new Map<string, number>();

  const reservePoolCounts =
    new Map<number, number>();

  const reservePlayerCounts =
    new Map<number, number>();

  const infillPlayerCounts =
    new Map<number, number>();

  const rounds: NKRound[] = [];

  const infillAssignmentsHistory:
    NKInfillAssignment[][] = [];

  const playedCountsHistory:
    Map<number, number>[] = [
      new Map(playedCount)
    ];

  const roundAttempts =
    new Array(
      totalRounds + 1
    ).fill(0);

  /* =======================================================
     CONTROLE INTRO RATINGPOULES
     ======================================================= */

  if (isIntro) {
    const requiredIntroRatings =
      getRequiredIntroRatings(
        introPoolCount
      );

    requiredIntroRatings.forEach(
      rating => {
        const poolCount =
          allPlayers.filter(
            player =>
              player.rating === rating
          ).length;

        if (
          (poolCount * mpp) % 2 !==
          0
        ) {
          throw new Error(
            `Ratingpoule ${rating} heeft ${poolCount} spelers. Dat is te weinig/ongunstig verdeeld voor ${mpp} wedstrijden per persoon, omdat de spelers per wedstrijd in paren van dezelfde rating moeten worden ingedeeld.`
          );
        }
      }
    );
  }

  let rIdx = 1;

  /*
   * Eén versie mag maximaal 5 seconden rekenen.
   */

  const maxGlobalTime =
    Date.now() + 5000;

  while (
    rIdx <= totalRounds
  ) {
    if (
      Date.now() >
      maxGlobalTime
    ) {
      return null;
    }

    const currentPlayedCount =
      playedCountsHistory[
        rIdx - 1
      ];

    let success = false;

    let roundMatches:
      NKMatch[] = [];

    let roundInfillAssignments:
      NKInfillAssignment[] = [];

    /* =====================================================
       PROBEER DEZE RONDE
       ===================================================== */

    for (
      let attempt = 0;
      attempt < 100;
      attempt++
    ) {
      const usedThisRound =
        new Set<number>();

      const matches:
        NKMatch[] = [];

      /*
       * Introductie heeft GEEN maximale
       * rating-difference.
       *
       * Normaal NK houdt de bestaande 0.30-eis.
       */

      const target =
        isIntro
          ? Infinity
          : 0.30;

      let pool =
        [...allPlayers]
          .filter(
            player =>
              currentPlayedCount.get(
                player.id
              )! < mpp
          )
          .sort(
            (a, b) =>
              (
                mpp -
                currentPlayedCount.get(
                  a.id
                )!
              ) -
                (
                  mpp -
                  currentPlayedCount.get(
                    b.id
                  )!
                ) ||
              Math.random() - 0.5
          )
          .reverse();

      const matchesInRound =
        Math.min(
          hallNames.length,
          Math.floor(
            pool.length / ppm
          )
        );

      try {
        /* =================================================
           WEDSTRIJDEN MAKEN
           ================================================= */

        for (
          let h = 0;
          h < matchesInRound;
          h++
        ) {
          const candidates =
            pool.filter(
              player =>
                !usedThisRound.has(
                  player.id
                )
            );

          if (
            candidates.length <
            ppm
          ) {
            break;
          }

          let matchPlayers:
            Player[] | null;

          if (isIntro) {
            matchPlayers =
              selectIntroMatchPlayers(
                candidates,
                pairCounts,
                ppt
              );
          } else {
            const selectedForMatch:
              Player[] = [];

            selectedForMatch.push(
              candidates[0]
            );

            while (
              selectedForMatch.length <
              ppm
            ) {
              const remaining =
                candidates.filter(
                  candidate =>
                    !selectedForMatch.includes(
                      candidate
                    )
                );

              remaining.sort(
                (a, b) => {
                  const scoreA =
                    selectedForMatch.reduce(
                      (
                        sum,
                        player
                      ) =>
                        sum +
                        (
                          pairCounts.get(
                            [
                              player.id,
                              a.id
                            ]
                              .sort()
                              .join('-')
                          ) || 0
                        ),
                      0
                    );

                  const scoreB =
                    selectedForMatch.reduce(
                      (
                        sum,
                        player
                      ) =>
                        sum +
                        (
                          pairCounts.get(
                            [
                              player.id,
                              b.id
                            ]
                              .sort()
                              .join('-')
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

              if (
                remaining.length ===
                0
              ) {
                throw new Error();
              }

              selectedForMatch.push(
                remaining[0]
              );
            }

            matchPlayers =
              selectedForMatch;
          }

          if (!matchPlayers) {
            throw new Error();
          }

          const split =
            getBestTeamSplit(
              matchPlayers,
              ppt,
              target,
              minRating,
              isIntro,
              introPoolCount
            );

          if (!split) {
            throw new Error();
          }

          /*
           * ALLEEN NORMAAL NK:
           * maximale rating-difference.
           *
           * INTRO:
           * deze controle bestaat NIET.
           */

          if (!isIntro) {
            const avg1 =
              split.t1.reduce(
                (sum, player) =>
                  sum +
                  player.rating,
                0
              ) / ppt;

            const avg2 =
              split.t2.reduce(
                (sum, player) =>
                  sum +
                  player.rating,
                0
              ) / ppt;

            const diff =
              Math.abs(
                avg1 - avg2
              );

            if (
              diff > 0.301
            ) {
              throw new Error();
            }
          }

          matchPlayers.forEach(
            player =>
              usedThisRound.add(
                player.id
              )
          );

          matches.push({
            id: `r${rIdx}h${h}`,
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

        /* =================================================
           TOERNOOI RESERVE INVALLERS
           ================================================= */

        roundInfillAssignments =
          assignTournamentReserveInfill(
            allPlayers,
            matches,
            rIdx,
            infillPlayerCounts
          );

        /*
         * Spelers die fysiek invallen mogen deze ronde
         * niet nog een andere taak krijgen.
         */

        const infillThisRound =
          new Set(
            roundInfillAssignments.map(
              assignment =>
                assignment.substitutePlayerId
            )
          );

        /* =================================================
           RESTERENDE SPELERS
           ================================================= */

        let resting =
          allPlayers.filter(
            player =>
              !usedThisRound.has(
                player.id
              ) &&
              !player.isTournamentReserve &&
              !infillThisRound.has(
                player.id
              )
          );

        /* =================================================
           INTRO SUBS
           ================================================= */

        if (isIntro) {
          resting =
            assignIntroReserves(
              resting,
              matches,
              reservePoolCounts,
              reservePlayerCounts
            );
        } else {
          /* ===============================================
             NORMAAL NK SUBS
             =============================================== */

          resting.sort(
            (a, b) =>
              a.rating -
              b.rating
          );

          /*
           * Lage reserve.
           */

          for (
            const match of matches
          ) {
            if (
              resting.length >
              0
            ) {
              match.subLow =
                resting.shift()!;
            }
          }

          /*
           * Hoge reserve.
           */

          for (
            const match of matches
          ) {
            if (
              resting.length >
              0
            ) {
              match.subHigh =
                resting.pop()!;
            }
          }
        }

        /* =================================================
           SCHEIDSRECHTERS
           ================================================= */

        if (isIntro) {
          for (
            const match of matches
          ) {
            if (
              resting.length >
              0
            ) {
              const index =
                Math.floor(
                  Math.random() *
                    resting.length
                );

              match.referee =
                resting.splice(
                  index,
                  1
                )[0];
            }
          }
        } else {
          for (
            const match of matches
          ) {
            if (
              resting.length >
              0
            ) {
              match.referee =
                resting.splice(
                  Math.floor(
                    resting.length /
                      2
                  ),
                  1
                )[0];
            }
          }
        }

        roundMatches =
          matches;

        success = true;
        break;
      } catch (error) {
        /*
         * Deze poging is ongeldig.
         *
         * Bij tournament reserves betekent dit
         * bijvoorbeeld dat er in deze ronde geen
         * exacte rating-invaller beschikbaar was.
         */
      }
    }

    /* =====================================================
       RONDE GELUKT
       ===================================================== */

    if (success) {
      const time =
        manualTimes[
          rIdx - 1
        ] || {
          start: '',
          end: ''
        };

      rounds.push({
        roundNumber:
          rIdx,
        matches:
          roundMatches,
        restingPlayers: [],
        startTime:
          time.start,
        endTime:
          time.end
      } as any);

      infillAssignmentsHistory.push(
        roundInfillAssignments
      );

      /*
       * Invalbeurten bijhouden voor eerlijke verdeling.
       */

      roundInfillAssignments.forEach(
        assignment => {
          const id =
            assignment.substitutePlayerId;

          infillPlayerCounts.set(
            id,
            (
              infillPlayerCounts.get(
                id
              ) || 0
            ) + 1
          );
        }
      );

      /*
       * Officiële wedstrijden tellen.
       *
       * De fysieke invaller telt hier NIET mee.
       */

      const nextCounts =
        new Map(
          currentPlayedCount
        );

      roundMatches.forEach(
        match => {
          const playersInMatch =
            [
              ...match.team1,
              ...match.team2
            ];

          playersInMatch.forEach(
            player => {
              nextCounts.set(
                player.id,
                (
                  nextCounts.get(
                    player.id
                  ) || 0
                ) + 1
              );
            }
          );

          /*
           * Sociale koppelingen.
           */

          for (
            let i = 0;
            i <
            playersInMatch.length;
            i++
          ) {
            for (
              let j = i + 1;
              j <
              playersInMatch.length;
              j++
            ) {
              const key =
                [
                  playersInMatch[i]
                    .id,
                  playersInMatch[j]
                    .id
                ]
                  .sort()
                  .join('-');

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

      playedCountsHistory[
        rIdx
      ] = nextCounts;

      rIdx++;
    } else {
      /* ===================================================
         TERUGROLLEN
         =================================================== */

      if (rIdx === 1) {
        return null;
      }

      rounds.pop();

      const previousAssignments =
        infillAssignmentsHistory.pop() ||
        [];

      /*
       * Invalbeurten terugdraaien.
       */

      previousAssignments.forEach(
        assignment => {
          const id =
            assignment.substitutePlayerId;

          const current =
            infillPlayerCounts.get(
              id
            ) || 0;

          if (
            current <= 1
          ) {
            infillPlayerCounts.delete(
              id
            );
          } else {
            infillPlayerCounts.set(
              id,
              current - 1
            );
          }
        }
      );

      /*
       * Sociale pairCounts opnieuw opbouwen.
       */

      pairCounts.clear();

      rounds.forEach(
        round => {
          round.matches.forEach(
            match => {
              const playersInMatch =
                [
                  ...match.team1,
                  ...match.team2
                ];

              for (
                let i = 0;
                i <
                playersInMatch.length;
                i++
              ) {
                for (
                  let j = i + 1;
                  j <
                  playersInMatch.length;
                  j++
                ) {
                  const key =
                    [
                      playersInMatch[i]
                        .id,
                      playersInMatch[j]
                        .id
                    ]
                      .sort()
                      .join('-');

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
      );

      rIdx--;

      roundAttempts[
        rIdx
      ]++;

      if (
        roundAttempts[rIdx] >
        15
      ) {
        return null;
      }
    }
  }

  /* =======================================================
     EINDCONTROLE MPP
     ======================================================= */

  const lastCounts =
    playedCountsHistory[
      playedCountsHistory.length -
        1
    ];

  const allHaveCorrectMatchCount =
    allPlayers.every(
      player =>
        lastCounts.get(
          player.id
        ) === mpp
    );

  if (
    !allHaveCorrectMatchCount
  ) {
    return null;
  }

  /* =======================================================
     ALLE INVALLERS SAMENVOEGEN
     ======================================================= */

  const infillAssignments =
    infillAssignmentsHistory.flat();

  return {
    competitionName,
    hallNames,
    playersPerTeam: ppt,
    totalRounds:
      rounds.length,
    rounds,
    standings: [],
    infillAssignments,
    isCompleted: false
  };
}

/* =========================================================
   HOOFD GENERATOR
   ========================================================= */

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

  /* =======================================================
     EERST EEN DUIDELIJKE INTRO-CONTROLE
     ======================================================= */

  if (isIntro) {
    const introErrors =
      analyseIntroPools(
        players,
        mpp,
        ppt,
        introPoolCount
      );

    if (introErrors.length > 0) {
      throw new Error(
        `INTRODUCTIE TOERNOOI KAN NIET WORDEN GEMAAKT:\n\n${introErrors
          .map(error => `• ${error}`)
          .join('\n')}\n\nPas de deelnemers/ratingpoules aan en probeer opnieuw.`
      );
    }
  }

  const validVersions:
    NKSession[] = [];

  let totalAttempts = 0;

  /*
   * Bewaar de redenen waarom een versie mislukt.
   *
   * Hierdoor kunnen we aan het einde een veel nuttigere
   * foutmelding geven dan alleen "geen schema gevonden".
   */

  const failureReasons =
    new Map<string, number>();

  /*
   * We blijven meerdere geldige versies maken,
   * zodat de sociale verdeling zo goed mogelijk wordt.
   */

  while (
    validVersions.length < 300 &&
    totalAttempts < 3500
  ) {
    totalAttempts++;

    if (
      totalAttempts % 10 ===
      0
    ) {
      onProgress(
        `Optimaliseren: Versie ${validVersions.length}/300 gevonden...`
      );

      await delay(1);
    }

    try {
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
          introPoolCount
        );

      if (session) {
        validVersions.push(
          session
        );
      }
    } catch (error) {
      /*
       * Alleen bij Intro slaan we de daadwerkelijke
       * foutreden op.
       *
       * Bij normaal NK blijft het oude gedrag behouden.
       */

      if (isIntro) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (message) {
          failureReasons.set(
            message,
            (
              failureReasons.get(
                message
              ) || 0
            ) + 1
          );
        }
      }
    }
  }

  /* =======================================================
     GEEN GELDIGE VERSIE
     ======================================================= */

  if (
    validVersions.length ===
    0
  ) {
    if (isIntro) {

      /*
       * Zoek de meest voorkomende concrete fout.
       */

      const sortedFailures =
        Array.from(
          failureReasons.entries()
        ).sort(
          (a, b) =>
            b[1] - a[1]
        );

      const mostCommonFailure =
        sortedFailures[0]?.[0];

      /*
       * Als er een concrete reden is gevonden,
       * tonen we die.
       */

      if (mostCommonFailure) {
        throw new Error(
          `Geen geldig introductieschema gevonden.\n\nMeest waarschijnlijke oorzaak:\n• ${mostCommonFailure}\n\nControleer ook de verdeling van de ratingpoules en de tournament-reserves.`
        );
      }

      /*
       * Fallback.
       */

      throw new Error(
        'Geen geldig introductieschema gevonden.\n\nControleer of er voldoende spelers per ratingpoule zijn en of iedere tournament-reserve een beschikbare invaller met exact dezelfde rating heeft.'
      );
    }

    /*
     * NORMAAL NK
     *
     * Volledig bestaand gedrag.
     */

    throw new Error(
      'Geen schema gevonden die voldoet aan de eisen (max 0.30 diff).'
    );
  }

  /* =======================================================
     MAXIMAAL RATINGVERSCHIL
     ======================================================= */

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
                (sum, player) =>
                  sum +
                  player.rating,
                0
              ) /
              match.team1.length;

            const avg2 =
              match.team2.reduce(
                (sum, player) =>
                  sum +
                  player.rating,
                0
              ) /
              match.team2.length;

            const diff =
              Math.abs(
                avg1 - avg2
              );

            if (
              diff > max
            ) {
              max = diff;
            }
          }
        );
      }
    );

    return max;
  };

  /* =======================================================
     SOCIALE SCORE
     ======================================================= */

  const getSocialScore = (
    session: NKSession
  ): number => {
    const pairs =
      new Map<string, number>();

    session.rounds.forEach(
      round => {
        round.matches.forEach(
          match => {
            const playersInMatch =
              [
                ...match.team1,
                ...match.team2
              ];

            for (
              let i = 0;
              i <
              playersInMatch.length;
              i++
            ) {
              for (
                let j = i + 1;
                j <
                playersInMatch.length;
                j++
              ) {
                const key =
                  [
                    playersInMatch[i]
                      .id,
                    playersInMatch[j]
                      .id
                  ]
                    .sort()
                    .join('-');

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
    let maxRepeats = 0;

    pairs.forEach(
      count => {
        score +=
          Math.pow(
            count,
            6
          );

        if (
          count >
          maxRepeats
        ) {
          maxRepeats =
            count;
        }
      }
    );

    /*
     * Alleen spelers die officieel aan wedstrijden
     * deelnemen worden meegenomen.
     */

    let missing = 0;

    for (
      let i = 0;
      i < players.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < players.length;
        j++
      ) {
        const key =
          [
            players[i].id,
            players[j].id
          ]
            .sort()
            .join('-');

        if (
          !pairs.has(key)
        ) {
          missing++;
        }
      }
    }

    return (
      score +
      missing * 500 +
      maxRepeats * 10000
    );
  };

  /* =======================================================
     SELECTIE VAN DE BESTE VERSIE
     ======================================================= */

  /*
   * ALLEEN NORMAAL NK:
   * daar geldt de 0.305 eindcontrole.
   *
   * INTRO:
   * iedere geldige versie is toegestaan.
   */

  let candidates:
    NKSession[];

  if (isIntro) {
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

    /*
     * Fallback voor normaal NK:
     * als geen enkele versie exact binnen
     * de grens valt, pakken we de beste versies.
     */

    if (
      candidates.length ===
      0
    ) {
      candidates = [
        ...validVersions
      ]
        .sort(
          (a, b) =>
            getMaxDiff(a) -
            getMaxDiff(b)
        )
        .slice(0, 10);
    }
  }

  /* =======================================================
     BESTE SOCIALE VERDELING
     ======================================================= */

  return candidates.reduce(
    (best, current) =>
      getSocialScore(
        current
      ) <
      getSocialScore(
        best
      )
        ? current
        : best
  );
}
