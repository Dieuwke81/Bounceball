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

  const ppm = ppt * 2;

  const actualRatings = Array.from(
    new Set(allPlayers.map(player => player.rating))
  ).sort((a, b) => a - b);

  const requiredSet = new Set(requiredRatings);

  /*
   * -------------------------------------------------------
   * 1. VERKEERDE RATINGPOULES
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
   * 2. ONTBREKENDE RATINGPOULES
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
   * 3. AANTALLEN PER RATINGPOULE
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
   * 4. RESERVES EN BESCHIKBARE INVALLERS
   * -------------------------------------------------------
   */

  const poolReserveCounts = new Map<number, number>();
  const poolNonReserveCounts = new Map<number, number>();

  requiredRatings.forEach(rating => {
    const playersInPool = allPlayers.filter(
      player => player.rating === rating
    );

    const reserves = playersInPool.filter(
      player => player.isTournamentReserve
    );

    const nonReserves = playersInPool.filter(
      player => !player.isTournamentReserve
    );

    poolReserveCounts.set(
      rating,
      reserves.length
    );

    poolNonReserveCounts.set(
      rating,
      nonReserves.length
    );
  });

  /*
   * -------------------------------------------------------
   * 5. TOTAAL AANTAL WEDSTRIJDEN
   * -------------------------------------------------------
   */

  if ((allPlayers.length * mpp) % ppm !== 0) {
    errors.push(
      `Het totaal aantal spelers (${allPlayers.length}) × ${mpp} wedstrijden kan niet gelijkmatig over wedstrijden van ${ppt} tegen ${ppt} worden verdeeld.`
    );
  }

  const totalMatches =
    (allPlayers.length * mpp) % ppm === 0
      ? (allPlayers.length * mpp) / ppm
      : 0;

  /*
   * -------------------------------------------------------
   * 6. MINIMALE TOTALE SPELERS
   * -------------------------------------------------------
   */

  if (allPlayers.length < ppm) {
    errors.push(
      `Te weinig spelers: ${allPlayers.length} geselecteerd, maar minimaal ${ppm} spelers zijn nodig voor ${ppt} tegen ${ppt}.`
    );
  }

  /*
   * -------------------------------------------------------
   * 7. MAXIMALE CAPACITEIT PER RATINGPOULE
   * -------------------------------------------------------
   */

  if (totalMatches > 0) {
    const maxPlayersPerPool =
      Math.floor(
        (totalMatches * 4) / mpp
      );

    requiredRatings.forEach(rating => {
      const count =
        poolCounts.get(rating) || 0;

      if (count > maxPlayersPerPool) {
        errors.push(
          `Te veel spelers in ratingpoule ${rating}: ${count} spelers. Voor ${totalMatches} wedstrijden en ${mpp} wedstrijden p.p. kunnen maximaal ongeveer ${maxPlayersPerPool} spelers uit één ratingpoule worden verwerkt.`
        );
      }
    });
  }

  /*
   * -------------------------------------------------------
   * 8. SPECIALE CONTROLE BIJ 2 RATINGPOULES
   * -------------------------------------------------------
   */

  if (introPoolCount === 2) {
    const countA =
      poolCounts.get(requiredRatings[0]) || 0;

    const countB =
      poolCounts.get(requiredRatings[1]) || 0;

    if (
      countA > 0 &&
      countB > 0 &&
      countA !== countB
    ) {
      errors.push(
        `Bij 2 ratingpoules moeten de poules gelijk verdeeld zijn. Nu: rating ${requiredRatings[0]} = ${countA} spelers en rating ${requiredRatings[1]} = ${countB} spelers.`
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 9. ONEVEN AANTAL PER RATINGPOULE
   * -------------------------------------------------------
   */

  requiredRatings.forEach(rating => {
    const count =
      poolCounts.get(rating) || 0;

    if (count === 0) {
      return;
    }

    if ((count * mpp) % 2 !== 0) {
      errors.push(
        `Ratingpoule ${rating} heeft ${count} spelers. Bij ${mpp} wedstrijden p.p. levert dat ${count * mpp} officiële wedstrijdplaatsen op. Dat aantal is oneven, terwijl spelers binnen het introductieschema per 2 dezelfde rating worden gekoppeld.`
      );
    }
  });

  /*
   * -------------------------------------------------------
   * 10. TOURNAMENT-RESERVES
   * -------------------------------------------------------
   */

  const tournamentReserves =
    allPlayers.filter(
      player => player.isTournamentReserve
    );

  if (tournamentReserves.length > 4) {
    errors.push(
      `Er zijn ${tournamentReserves.length} tournament-reserves geselecteerd. Het maximum is 4.`
    );
  }

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
        `Tournament-reserve "${reserve.name}" heeft rating ${reserve.rating}, maar er is geen enkele niet-reserve speler met exact dezelfde rating die kan invallen.`
      );
    }
  });

  /*
   * -------------------------------------------------------
   * 11. RESERVEPOULES
   * -------------------------------------------------------
   */

  requiredRatings.forEach(rating => {
    const reserveCount =
      poolReserveCounts.get(rating) || 0;

    const nonReserveCount =
      poolNonReserveCounts.get(rating) || 0;

    if (
      reserveCount > 0 &&
      nonReserveCount < reserveCount
    ) {
      errors.push(
        `Ratingpoule ${rating} is krap voor de tournament-reserves: ${reserveCount} reserve-deelnemer(s) tegenover slechts ${nonReserveCount} niet-reserve speler(s) met exact dezelfde rating. Meerdere reserves van deze rating kunnen daardoor niet tegelijk fysiek worden vervangen.`
      );
    }
  });

  /*
   * -------------------------------------------------------
   * 12. OVERZICHT
   * -------------------------------------------------------
   */

  if (errors.length > 0) {
    const overview = requiredRatings
      .map(rating => {
        const count =
          poolCounts.get(rating) || 0;

        const reserveCount =
          poolReserveCounts.get(rating) || 0;

        const nonReserveCount =
          poolNonReserveCounts.get(rating) || 0;

        if (reserveCount > 0) {
          return `${rating}: ${count} spelers (${reserveCount} reserve, ${nonReserveCount} beschikbaar)`;
        }

        return `${rating}: ${count} spelers`;
      })
      .join(' | ');

    errors.push(
      `Huidige verdeling: ${overview}.`
    );
  }

  return errors;
}

/* =========================================================
   HULPFUNCTIE: WILLEKEURIG MAAR EERLIJK SORTEREN
   ========================================================= */

function shufflePlayers(players: Player[]): Player[] {
  return [...players].sort(
    () => Math.random() - 0.5
  );
}

/* =========================================================
   INTRO RESERVES
   ========================================================= */

/*
 * Belangrijk:
 *
 * De oude versie koos reserve 1 en daarna direct reserve 2.
 *
 * Daardoor kon dit gebeuren:
 *
 * speler A -> gekozen als reserve 1
 * speler B -> enige bruikbare reserve van andere rating
 *
 * maar speler B was eigenlijk nodig als invaller of
 * een andere keuze voor reserve 1 had het probleem opgelost.
 *
 * Daarom worden de gewone reserves nu gezamenlijk
 * gezocht met backtracking.
 */

function assignIntroReserves(
  resting: Player[],
  matches: NKMatch[],
  reservePoolCounts: Map<number, number>,
  reservePlayerCounts: Map<number, number>
): Player[] {

  const players =
    resting.filter(
      player => !player.isTournamentReserve
    );

  /*
   * We maken eerst alle mogelijke reserve-combinaties.
   *
   * Per wedstrijd moeten:
   *
   * - 2 spelers worden gekozen
   * - ratings moeten verschillend zijn
   * - dezelfde speler mag niet twee keer worden gebruikt
   *
   * De volgorde van de opties wordt beïnvloed door
   * eerdere inzet, zodat veel gebruikte spelers minder
   * snel opnieuw gekozen worden.
   */

  type ReserveOption = {
    first: Player;
    second: Player;
    score: number;
  };

  const optionsPerMatch:
    ReserveOption[][] = [];

  for (
    let matchIndex = 0;
    matchIndex < matches.length;
    matchIndex++
  ) {
    const options: ReserveOption[] = [];

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
        const first =
          players[i];

        const second =
          players[j];

        /*
         * De twee gewone reserves moeten uit
         * verschillende ratingpoules komen.
         */

        if (
          first.rating ===
          second.rating
        ) {
          continue;
        }

        const firstCount =
          reservePlayerCounts.get(
            first.id
          ) || 0;

        const secondCount =
          reservePlayerCounts.get(
            second.id
          ) || 0;

        const firstPoolCount =
          reservePoolCounts.get(
            first.rating
          ) || 0;

        const secondPoolCount =
          reservePoolCounts.get(
            second.rating
          ) || 0;

        /*
         * Lager = aantrekkelijker.
         *
         * Hiermee houden we de verdeling eerlijk.
         */

        const score =
          firstCount * 100 +
          secondCount * 100 +
          firstPoolCount * 10 +
          secondPoolCount * 10 +
          Math.random();

        options.push({
          first,
          second,
          score
        });
      }
    }

    options.sort(
      (a, b) =>
        a.score - b.score
    );

    optionsPerMatch.push(
      options
    );
  }

  /*
   * Wedstrijden met de minste opties eerst.
   *
   * Dit is een belangrijke verbetering:
   * een krappe wedstrijd wordt eerst opgelost.
   */

  const matchOrder =
    matches
      .map((_, index) => index)
      .sort(
        (a, b) =>
          optionsPerMatch[a].length -
          optionsPerMatch[b].length
      );

  const chosen =
    new Map<
      number,
      ReserveOption
    >();

  const usedPlayers =
    new Set<number>();

  /*
   * Maximaal aantal zoekpogingen.
   *
   * In de praktijk zijn er maar een paar wedstrijden
   * en wordt de oplossing meestal zeer snel gevonden.
   */

  let searchNodes = 0;

  const maxSearchNodes = 100000;

  function search(
    position: number
  ): boolean {

    searchNodes++;

    if (
      searchNodes >
      maxSearchNodes
    ) {
      return false;
    }

    if (
      position >=
      matchOrder.length
    ) {
      return true;
    }

    const matchIndex =
      matchOrder[position];

    const options =
      optionsPerMatch[
        matchIndex
      ];

    /*
     * Kleine random variatie zodat meerdere
     * geldige schema's mogelijk blijven.
     */

    const shuffledOptions =
      [...options];

    if (
      shuffledOptions.length >
      1
    ) {
      const firstPart =
        shuffledOptions.slice(
          0,
          Math.min(
            10,
            shuffledOptions.length
          )
        );

      firstPart.sort(
        () =>
          Math.random() - 0.5
      );

      shuffledOptions.splice(
        0,
        firstPart.length,
        ...firstPart
      );
    }

    for (
      const option of shuffledOptions
    ) {

      if (
        usedPlayers.has(
          option.first.id
        ) ||
        usedPlayers.has(
          option.second.id
        )
      ) {
        continue;
      }

      chosen.set(
        matchIndex,
        option
      );

      usedPlayers.add(
        option.first.id
      );

      usedPlayers.add(
        option.second.id
      );

      if (
        search(position + 1)
      ) {
        return true;
      }

      chosen.delete(
        matchIndex
      );

      usedPlayers.delete(
        option.first.id
      );

      usedPlayers.delete(
        option.second.id
      );
    }

    return false;
  }

  if (
    !search(0)
  ) {
    throw new Error(
      'Geen geldige combinatie van gewone reserves gevonden. Er zijn niet genoeg rustende spelers uit verschillende ratingpoules beschikbaar voor alle wedstrijden.'
    );
  }

  /*
   * De gekozen reserves daadwerkelijk koppelen.
   */

  const selectedReserveIds =
    new Set<number>();

  matches.forEach(
    (match, index) => {
      const option =
        chosen.get(index);

      if (!option) {
        throw new Error(
          'Interne fout bij het toewijzen van gewone reserves.'
        );
      }

      match.subHigh =
        option.first;

      match.subLow =
        option.second;

      selectedReserveIds.add(
        option.first.id
      );

      selectedReserveIds.add(
        option.second.id
      );

      reservePoolCounts.set(
        option.first.rating,
        (
          reservePoolCounts.get(
            option.first.rating
          ) || 0
        ) + 1
      );

      reservePoolCounts.set(
        option.second.rating,
        (
          reservePoolCounts.get(
            option.second.rating
          ) || 0
        ) + 1
      );

      reservePlayerCounts.set(
        option.first.id,
        (
          reservePlayerCounts.get(
            option.first.id
          ) || 0
        ) + 1
      );

      reservePlayerCounts.set(
        option.second.id,
        (
          reservePlayerCounts.get(
            option.second.id
          ) || 0
        ) + 1
      );
    }
  );

  /*
   * Alles wat geen gewone reserve is blijft beschikbaar
   * voor de scheidsrechter.
   */

  return players.filter(
    player =>
      !selectedReserveIds.has(
        player.id
      )
  );
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
   * Officiële spelers van deze ronde.
   */

  const officialPlayersThisRound =
    new Set<number>();

  matches.forEach(match => {
    match.team1.forEach(player => {
      officialPlayersThisRound.add(
        player.id
      );
    });

    match.team2.forEach(player => {
      officialPlayersThisRound.add(
        player.id
      );
    });
  });

  /*
   * Alleen niet-reserves die deze ronde
   * niet officieel spelen kunnen invallen.
   */

  const availablePlayers =
    allPlayers.filter(
      player =>
        !player.isTournamentReserve &&
        !officialPlayersThisRound.has(
          player.id
        )
    );

  /*
   * Alle tournament-reserves die deze ronde
   * daadwerkelijk spelen verzamelen.
   */

  const reserveRequests:
    {
      reservePlayer: Player;
      match: NKMatch;
      team: 'BLAUW' | 'GEEL';
    }[] = [];

  matches.forEach(match => {

    match.team1.forEach(player => {
      if (
        player.isTournamentReserve
      ) {
        reserveRequests.push({
          reservePlayer: player,
          match,
          team: 'BLAUW'
        });
      }
    });

    match.team2.forEach(player => {
      if (
        player.isTournamentReserve
      ) {
        reserveRequests.push({
          reservePlayer: player,
          match,
          team: 'GEEL'
        });
      }
    });
  });

  /*
   * Krapste reserves eerst.
   *
   * Wanneer bijvoorbeeld twee reserves rating 5 hebben
   * en er maar twee geschikte spelers zijn, worden die
   * eerst behandeld.
   */

  reserveRequests.sort(
    (a, b) => {
      const countA =
        availablePlayers.filter(
          player =>
            player.rating ===
            a.reservePlayer.rating
        ).length;

      const countB =
        availablePlayers.filter(
          player =>
            player.rating ===
            b.reservePlayer.rating
        ).length;

      return (
        countA -
        countB
      );
    }
  );

  const assignments:
    NKInfillAssignment[] = [];

  const usedThisRound =
    new Set<number>();

  for (
    const request of reserveRequests
  ) {

    /*
     * Alleen exact dezelfde rating.
     */

    const candidates =
      availablePlayers
        .filter(
          player =>
            !usedThisRound.has(
              player.id
            ) &&
            player.rating ===
              request.reservePlayer.rating
        )
        .sort(
          (a, b) => {
            const countA =
              infillPlayerCounts.get(
                a.id
              ) || 0;

            const countB =
              infillPlayerCounts.get(
                b.id
              ) || 0;

            if (
              countA !== countB
            ) {
              return (
                countA -
                countB
              );
            }

            return (
              Math.random() -
              0.5
            );
          }
        );

    if (
      candidates.length ===
      0
    ) {
      throw new Error(
        `Geen invaller met exact dezelfde rating (${request.reservePlayer.rating}) beschikbaar voor tournament-reserve "${request.reservePlayer.name}" in ronde ${roundNumber}.`
      );
    }

    const substitute =
      candidates[0];

    usedThisRound.add(
      substitute.id
    );

    assignments.push({
      roundNumber,
      matchId:
        request.match.id,
      reservePlayerId:
        request.reservePlayer.id,
      substitutePlayerId:
        substitute.id,
      hallName:
        request.match.hallName,
      team:
        request.team
    });
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
   * =======================================================
   * INTRODUCTIE
   * =======================================================
   */

  if (isIntro) {

    const byRating =
      new Map<number, Player[]>();

    players.forEach(player => {
      if (
        !byRating.has(
          player.rating
        )
      ) {
        byRating.set(
          player.rating,
          []
        );
      }

      byRating
        .get(player.rating)!
        .push(player);
    });

    const team1: Player[] = [];
    const team2: Player[] = [];

    for (
      const [, ratingPlayers]
      of byRating.entries()
    ) {

      if (
        ratingPlayers.length %
          2 !==
          0 ||
        ratingPlayers.length >
          4
      ) {
        return null;
      }

      const half =
        ratingPlayers.length /
        2;

      if (
        half >
        2
      ) {
        return null;
      }

      const shuffled =
        [...ratingPlayers].sort(
          () =>
            Math.random() -
            0.5
        );

      team1.push(
        ...shuffled.slice(
          0,
          half
        )
      );

      team2.push(
        ...shuffled.slice(
          half
        )
      );
    }

    if (
      team1.length !==
        ppt ||
      team2.length !==
        ppt
    ) {
      return null;
    }

    bestDiff =
      Math.abs(
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

  /*
   * =======================================================
   * NORMAAL NK
   * =======================================================
   */

  function combine(
    start: number,
    team1: Player[]
  ) {

    if (
      team1.length ===
      ppt
    ) {

      const team2 =
        players.filter(
          player =>
            !team1.some(
              selected =>
                selected.id ===
                player.id
            )
        );

      if (
        team2.length !==
        ppt
      ) {
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
          player =>
            player.isKeeper
        ).length;

      const keepers2 =
        team2.filter(
          player =>
            player.isKeeper
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
          Math.abs(
            avg1 - avg2
          );

        if (
          diff <
          bestDiff
        ) {
          bestDiff =
            diff;

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

  combine(
    0,
    []
  );

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

  const neededPairs =
    ppt;

  const pairOptions: {
    a: Player;
    b: Player;
    rating: number;
    score: number;
  }[] = [];

  const byRating =
    new Map<number, Player[]>();

  candidates.forEach(player => {

    if (
      !byRating.has(
        player.rating
      )
    ) {
      byRating.set(
        player.rating,
        []
      );
    }

    byRating
      .get(player.rating)!
      .push(player);
  });

  byRating.forEach(
    (
      ratingPlayers,
      rating
    ) => {

      for (
        let i = 0;
        i <
        ratingPlayers.length;
        i++
      ) {

        for (
          let j = i + 1;
          j <
          ratingPlayers.length;
          j++
        ) {

          const a =
            ratingPlayers[i];

          const b =
            ratingPlayers[j];

          const key =
            [
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
              pairCounts.get(
                key
              ) || 0
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
      a.score -
        b.score ||
      Math.random() -
        0.5
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
      i <
      pairOptions.length;
      i++
    ) {

      const option =
        pairOptions[i];

      if (
        used.has(
          option.a.id
        ) ||
        used.has(
          option.b.id
        )
      ) {
        continue;
      }

      const countForRating =
        pairsPerRating.get(
          option.rating
        ) || 0;

      if (
        countForRating >=
        2
      ) {
        continue;
      }

      chosen.push(
        option
      );

      used.add(
        option.a.id
      );

      used.add(
        option.b.id
      );

      pairsPerRating.set(
        option.rating,
        countForRating + 1
      );

      if (
        search(
          i + 1
        )
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
        countForRating ===
        0
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

  if (
    !search(0)
  ) {
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
  introPoolCount: number,
  failureReasons?: Map<string, number>
): Promise<NKSession | null> {

  const ppm =
    ppt * 2;

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
      allPlayers.map(
        player => [
          player.id,
          0
        ]
      )
    );

  const pairCounts =
    new Map<string, number>();

  const reservePoolCounts =
    new Map<number, number>();

  const reservePlayerCounts =
    new Map<number, number>();

  const infillPlayerCounts =
    new Map<number, number>();

  const rounds:
    NKRound[] = [];

  const infillAssignmentsHistory:
    NKInfillAssignment[][] = [];

  const playedCountsHistory:
    Map<number, number>[] = [
      new Map(
        playedCount
      )
    ];

  const roundAttempts =
    new Array(
      totalRounds + 1
    ).fill(0);

  /*
   * -------------------------------------------------------
   * FOUT REGISTREREN
   * -------------------------------------------------------
   */

  const recordFailure =
    (
      message: string
    ) => {

      if (
        !isIntro ||
        !failureReasons
      ) {
        return;
      }

      if (!message) {
        return;
      }

      failureReasons.set(
        message,
        (
          failureReasons.get(
            message
          ) || 0
        ) + 1
      );
    };

  /*
   * -------------------------------------------------------
   * CONTROLE INTRO RATINGPOULES
   * -------------------------------------------------------
   */

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
              player.rating ===
              rating
          ).length;

        if (
          (poolCount * mpp) %
            2 !==
          0
        ) {
          throw new Error(
            `Ratingpoule ${rating} heeft ${poolCount} spelers. Dat is te weinig/ongunstig verdeeld voor ${mpp} wedstrijden per persoon, omdat de spelers per wedstrijd in paren van dezelfde rating moeten worden ingedeeld.`
          );
        }
      }
    );
  }

  let rIdx =
    1;

  const maxGlobalTime =
    Date.now() +
    5000;

  while (
    rIdx <=
    totalRounds
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

    let success =
      false;

    let roundMatches:
      NKMatch[] = [];

    let roundInfillAssignments:
      NKInfillAssignment[] = [];

    /*
     * =====================================================
     * PROBEER DEZE RONDE
     * =====================================================
     */

    for (
      let attempt = 0;
      attempt < 100;
      attempt++
    ) {

      const usedThisRound =
        new Set<number>();

      const matches:
        NKMatch[] = [];

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
              )! <
              mpp
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
              Math.random() -
                0.5
          )
          .reverse();

      const matchesInRound =
        Math.min(
          hallNames.length,
          Math.floor(
            pool.length /
              ppm
          )
        );

      try {

        /*
         * =================================================
         * WEDSTRIJDEN MAKEN
         * =================================================
         */

        for (
          let h = 0;
          h <
          matchesInRound;
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

            if (
              isIntro
            ) {
              throw new Error(
                `Te weinig beschikbare spelers om ronde ${rIdx} volledig te vullen: er zijn ${candidates.length} spelers beschikbaar, maar ${ppm} zijn nodig voor ${ppt} tegen ${ppt}.`
              );
            }

            break;
          }

          let matchPlayers:
            Player[] | null;

          if (
            isIntro
          ) {

            matchPlayers =
              selectIntroMatchPlayers(
                candidates,
                pairCounts,
                ppt
              );

            if (
              !matchPlayers
            ) {
              throw new Error(
                `Geen geldige combinatie van ratingparen gevonden voor wedstrijd ${h + 1} van ronde ${rIdx}. Eén of meer ratingpoules hebben op dit moment onvoldoende bruikbare spelers om de benodigde paren van dezelfde rating te vormen.`
              );
            }

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

          if (
            !matchPlayers
          ) {
            throw new Error(
              isIntro
                ? `Geen geldige spelerscombinatie gevonden voor wedstrijd ${h + 1} van ronde ${rIdx}.`
                : ''
            );
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

          if (
            !split
          ) {

            if (
              isIntro
            ) {

              const ratingOverview =
                Array.from(
                  new Set(
                    matchPlayers.map(
                      player =>
                        player.rating
                    )
                  )
                )
                  .sort(
                    (a, b) =>
                      a - b
                  )
                  .map(
                    rating =>
                      `${rating}: ${
                        matchPlayers.filter(
                          player =>
                            player.rating ===
                            rating
                        ).length
                      }`
                  )
                  .join(
                    ', '
                  );

              throw new Error(
                `Geen geldige teamsamenstelling gevonden in ronde ${rIdx}, wedstrijd ${h + 1}. De geselecteerde spelers kunnen niet correct per rating worden verdeeld. Huidige verdeling in deze wedstrijd: ${ratingOverview}.`
              );
            }

            throw new Error();
          }

          if (
            !isIntro
          ) {

            const avg1 =
              split.t1.reduce(
                (
                  sum,
                  player
                ) =>
                  sum +
                  player.rating,
                0
              ) / ppt;

            const avg2 =
              split.t2.reduce(
                (
                  sum,
                  player
                ) =>
                  sum +
                  player.rating,
                0
              ) / ppt;

            const diff =
              Math.abs(
                avg1 -
                  avg2
              );

            if (
              diff >
              0.301
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
            id:
              `r${rIdx}h${h}`,
            hallName:
              hallNames[h],
            team1:
              split.t1,
            team2:
              split.t2,
            team1Score:
              0,
            team2Score:
              0,
            isPlayed:
              false,
            subLow:
              null as any,
            subHigh:
              null as any,
            referee:
              null as any
          });
        }

        /*
         * =================================================
         * TOURNAMENT-RESERVE INVALLERS
         * =================================================
         *
         * Dit gebeurt VOOR gewone reserves en scheidsrechters.
         *
         * Daardoor kunnen we een speler die nodig is als
         * fysieke invaller nooit per ongeluk eerst als
         * gewone reserve of scheidsrechter inzetten.
         */

        roundInfillAssignments =
          assignTournamentReserveInfill(
            allPlayers,
            matches,
            rIdx,
            infillPlayerCounts
          );

        const infillThisRound =
          new Set(
            roundInfillAssignments.map(
              assignment =>
                assignment.substitutePlayerId
            )
          );

        /*
         * =================================================
         * RESTERENDE SPELERS
         * =================================================
         */

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

        /*
         * =================================================
         * INTRO:
         * GEWONE RESERVES GEZAMENLIJK KIEZEN
         * =================================================
         */

        if (
          isIntro
        ) {

          resting =
            assignIntroReserves(
              resting,
              matches,
              reservePoolCounts,
              reservePlayerCounts
            );

        } else {

          /*
           * =================================================
           * NORMAAL NK SUBS
           * =================================================
           */

          resting.sort(
            (a, b) =>
              a.rating -
              b.rating
          );

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

        /*
         * =================================================
         * SCHEIDSRECHTERS
         * =================================================
         *
         * Belangrijk:
         * na bovenstaande stappen zijn alle spelers die
         * fysiek nodig zijn voor tournament-reserves en
         * gewone reserves al uit "resting" gehaald.
         *
         * De scheidsrechter wordt dus pas daarna gekozen.
         */

        if (
          isIntro
        ) {

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

        success =
          true;

        break;

      } catch (error) {

        if (
          isIntro
        ) {

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          recordFailure(
            message ||
              `Ronde ${rIdx} kon niet worden opgebouwd.`
          );
        }
      }
    }

    /*
     * =====================================================
     * RONDE GELUKT
     * =====================================================
     */

    if (
      success
    ) {

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
        restingPlayers:
          [],
        startTime:
          time.start,
        endTime:
          time.end
      } as any);

      infillAssignmentsHistory.push(
        roundInfillAssignments
      );

      /*
       * Invalbeurten eerlijk bijhouden.
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
       * Tournament-invallers tellen NIET mee.
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
      ] =
        nextCounts;

      rIdx++;

    } else {

      /*
       * ===================================================
       * TERUGROLLEN
       * ===================================================
       */

      if (
        rIdx ===
        1
      ) {
        return null;
      }

      rounds.pop();

      const previousAssignments =
        infillAssignmentsHistory.pop() ||
        [];

      previousAssignments.forEach(
        assignment => {

          const id =
            assignment.substitutePlayerId;

          const current =
            infillPlayerCounts.get(
              id
            ) || 0;

          if (
            current <=
            1
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
       * PairCounts opnieuw opbouwen.
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
        roundAttempts[
          rIdx
        ] >
        15
      ) {
        return null;
      }
    }
  }

  /*
   * =======================================================
   * EINDCONTROLE MPP
   * =======================================================
   */

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
        ) ===
        mpp
    );

  if (
    !allHaveCorrectMatchCount
  ) {

    if (
      isIntro
    ) {
      recordFailure(
        `Niet iedere speler komt uit op exact ${mpp} officiële wedstrijden.`
      );
    }

    return null;
  }

  /*
   * =======================================================
   * ALLE INVALLERS SAMENVOEGEN
   * =======================================================
   */

  const infillAssignments =
    infillAssignmentsHistory.flat();

  return {
    competitionName,
    hallNames,
    playersPerTeam:
      ppt,
    totalRounds:
      rounds.length,
    rounds,
    standings: [],
    infillAssignments,
    isCompleted:
      false
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

  /*
   * =======================================================
   * EERST EEN DUIDELIJKE INTRO-CONTROLE
   * =======================================================
   */

  if (
    isIntro
  ) {

    const introErrors =
      analyseIntroPools(
        players,
        mpp,
        ppt,
        introPoolCount
      );

    if (
      introErrors.length >
      0
    ) {

      throw new Error(
        `INTRODUCTIE TOERNOOI KAN NIET WORDEN GEMAAKT:\n\n${introErrors
          .map(
            error =>
              `• ${error}`
          )
          .join(
            '\n'
          )}\n\nPas de deelnemers/ratingpoules aan en probeer opnieuw.`
      );
    }
  }

  const validVersions:
    NKSession[] = [];

  let totalAttempts =
    0;

  const failureReasons =
    new Map<string, number>();

  /*
   * Meerdere geldige versies genereren.
   */

  while (
    validVersions.length <
      300 &&
    totalAttempts <
      3500
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
          introPoolCount,
          failureReasons
        );

      if (
        session
      ) {
        validVersions.push(
          session
        );
      }

    } catch (error) {

      if (
        isIntro
      ) {

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (
          message
        ) {

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

  /*
   * =======================================================
   * GEEN GELDIGE VERSIE
   * =======================================================
   */

  if (
    validVersions.length ===
    0
  ) {

    if (
      isIntro
    ) {

      const sortedFailures =
        Array.from(
          failureReasons.entries()
        )
          .sort(
            (a, b) =>
              b[1] -
              a[1]
          )
          .slice(
            0,
            5
          );

      if (
        sortedFailures.length >
        0
      ) {

        const failureText =
          sortedFailures
            .map(
              (
                [message, count]
              ) =>
                `• ${message} (${count}x)`
            )
            .join(
              '\n'
            );

        throw new Error(
          `Geen geldig introductieschema gevonden.\n\nMeest voorkomende knelpunten tijdens het genereren:\n${failureText}\n\nControleer vooral de ratingpoule die in deze meldingen wordt genoemd en de beschikbare niet-reserve spelers met dezelfde rating als de tournament-reserves.`
        );
      }

      throw new Error(
        'Geen geldig introductieschema gevonden.\n\nControleer of er voldoende spelers per ratingpoule zijn en of iedere tournament-reserve een beschikbare invaller met exact dezelfde rating heeft.'
      );
    }

    throw new Error(
      'Geen schema gevonden die voldoet aan de eisen (max 0.30 diff).'
    );
  }

  /*
   * =======================================================
   * MAXIMAAL RATINGVERSCHIL
   * =======================================================
   */

  const getMaxDiff =
    (
      session: NKSession
    ): number => {

      let max =
        0;

      session.rounds.forEach(
        round => {

          round.matches.forEach(
            match => {

              const avg1 =
                match.team1.reduce(
                  (
                    sum,
                    player
                  ) =>
                    sum +
                    player.rating,
                  0
                ) /
                match.team1.length;

              const avg2 =
                match.team2.reduce(
                  (
                    sum,
                    player
                  ) =>
                    sum +
                    player.rating,
                  0
                ) /
                match.team2.length;

              const diff =
                Math.abs(
                  avg1 -
                    avg2
                );

              if (
                diff >
                max
              ) {
                max =
                  diff;
              }
            }
          );
        }
      );

      return max;
    };

  /*
   * =======================================================
   * SOCIALE SCORE
   * =======================================================
   */

  const getSocialScore =
    (
      session: NKSession
    ): number => {

      const pairs =
        new Map<
          string,
          number
        >();

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

      let score =
        0;

      let maxRepeats =
        0;

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

      let missing =
        0;

      for (
        let i = 0;
        i <
        players.length;
        i++
      ) {

        for (
          let j = i + 1;
          j <
          players.length;
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
            !pairs.has(
              key
            )
          ) {
            missing++;
          }
        }
      }

      return (
        score +
        missing * 500 +
        maxRepeats *
          10000
      );
    };

  /*
   * =======================================================
   * SELECTIE BESTE VERSIE
   * =======================================================
   */

  let candidates:
    NKSession[];

  if (
    isIntro
  ) {

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
      candidates.length ===
      0
    ) {

      candidates =
        [
          ...validVersions
        ]
          .sort(
            (a, b) =>
              getMaxDiff(a) -
              getMaxDiff(b)
          )
          .slice(
            0,
            10
          );
    }
  }

  /*
   * =======================================================
   * BESTE SOCIALE VERDELING
   * =======================================================
   */

  return candidates.reduce(
    (
      best,
      current
    ) =>
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
