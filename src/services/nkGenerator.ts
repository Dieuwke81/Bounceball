import { Player, NKSession, NKRound, NKMatch, NKInfillAssignment } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getRequiredIntroRatings(poolCount: number): number[] {
  if (poolCount === 2) return [5, 10];
  if (poolCount === 3) return [5, 7.5, 10];
  if (poolCount === 4) return [2.5, 5, 7.5, 10];
  throw new Error("Aantal ratingpoules moet 2, 3 of 4 zijn.");
}

function getRatingProfile(team: Player[]): string {
  const counts = new Map<number, number>();

  team.forEach(p => {
    counts.set(p.rating, (counts.get(p.rating) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => `${rating}:${count}`)
    .join('|');
}

function chooseWeightedIntroReserve(
  candidates: Player[],
  reservePoolCounts: Map<number, number>,
  reservePlayerCounts: Map<number, number>,
  excludedRatings: Set<number>
): Player | null {
  const available = candidates.filter(
    p => !excludedRatings.has(p.rating) && !p.isTournamentReserve
  );

  if (available.length === 0) return null;

  const maxPoolCount = Math.max(
    ...available.map(p => reservePoolCounts.get(p.rating) || 0)
  );

  const weights = available.map(p => {
    const poolCount = reservePoolCounts.get(p.rating) || 0;
    const playerCount = reservePlayerCounts.get(p.id) || 0;

    return Math.max(
      1,
      (maxPoolCount - poolCount + 1) * 4 +
      Math.max(0, 3 - playerCount)
    );
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

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
  // Tournament reserves mogen NOOIT als fysieke sub worden gebruikt.
  let available = resting.filter(p => !p.isTournamentReserve);

  for (const match of matches) {
    if (available.length < 2) {
      throw new Error();
    }

    const first = chooseWeightedIntroReserve(
      available,
      reservePoolCounts,
      reservePlayerCounts,
      new Set()
    );

    if (!first) {
      throw new Error();
    }

    available = available.filter(p => p.id !== first.id);

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
      throw new Error();
    }

    available = available.filter(p => p.id !== second.id);

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

/**
 * Bepaalt de fysieke invallers voor tournament reserves.
 *
 * De officiële reserve-deelnemer blijft gewoon in het team staan.
 * De substitutePlayer speelt fysiek in zijn/haar plaats.
 *
 * Belangrijk:
 * - exacte rating verplicht;
 * - tournament reserves kunnen zelf nooit invallen;
 * - één fysieke speler kan maar één keer per ronde invallen;
 * - iemand die al speelt kan uiteraard niet invallen;
 * - bij meerdere kandidaten wordt eerst gekeken naar het aantal
 *   eerdere invalbeurten.
 */
function assignTournamentReserveInfill(
  allPlayers: Player[],
  matches: NKMatch[],
  roundNumber: number,
  infillPlayerCounts: Map<number, number>
): NKInfillAssignment[] {
  const usedThisRound = new Set<number>();

  matches.forEach(match => {
    match.team1.forEach(p => usedThisRound.add(p.id));
    match.team2.forEach(p => usedThisRound.add(p.id));
  });

  // Alleen echte spelers die deze ronde niet spelen kunnen invallen.
  // Tournament reserves worden bewust uitgesloten.
  const availablePlayers = allPlayers.filter(
    p =>
      !p.isTournamentReserve &&
      !usedThisRound.has(p.id)
  );

  const assignments: NKInfillAssignment[] = [];

  for (const match of matches) {
    const reservePlayers = [
      ...match.team1.map(p => ({ player: p, team: 'BLAUW' as const })),
      ...match.team2.map(p => ({ player: p, team: 'GEEL' as const }))
    ].filter(x => x.player.isTournamentReserve);

    for (const reserve of reservePlayers) {
      const candidates = availablePlayers
        .filter(
          p =>
            !assignments.some(
              a => a.substitutePlayerId === p.id
            ) &&
            p.rating === reserve.player.rating
        )
        .sort((a, b) => {
          const countA = infillPlayerCounts.get(a.id) || 0;
          const countB = infillPlayerCounts.get(b.id) || 0;

          if (countA !== countB) {
            return countA - countB;
          }

          return Math.random() - 0.5;
        });

      if (candidates.length === 0) {
        // Geen exacte rating beschikbaar.
        // Deze complete gegenereerde versie moet dus worden afgekeurd.
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

function getBestTeamSplit(
  players: Player[],
  ppt: number,
  targetDiff: number,
  minRating: number,
  isIntro: boolean,
  introPoolCount: number
) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

  if (isIntro) {
    // De selectie van spelers voor een Intro-wedstrijd wordt elders al
    // zo gemaakt dat iedere rating in even aantallen voorkomt. Daardoor
    // kunnen we hier heel eenvoudig spiegelen: per rating de spelers
    // gelijk over beide teams verdelen.
    const byRating = new Map<number, Player[]>();

    players.forEach(p => {
      if (!byRating.has(p.rating)) {
        byRating.set(p.rating, []);
      }

      byRating.get(p.rating)!.push(p);
    });

    const team1: Player[] = [];
    const team2: Player[] = [];

    for (const [, ratingPlayers] of byRating.entries()) {
      if (ratingPlayers.length % 2 !== 0 || ratingPlayers.length > 4) {
        return null;
      }

      const half = ratingPlayers.length / 2;

      // Maximaal 2 uit dezelfde ratingpool per team.
      if (half > 2) {
        return null;
      }

      team1.push(...ratingPlayers.slice(0, half));
      team2.push(...ratingPlayers.slice(half));
    }

    if (team1.length !== ppt || team2.length !== ppt) {
      return null;
    }

    const avg1 =
      team1.reduce((s, p) => s + p.rating, 0) / ppt;

    const avg2 =
      team2.reduce((s, p) => s + p.rating, 0) / ppt;

    bestDiff = Math.abs(avg1 - avg2);
    bestSplit = {
      t1: team1,
      t2: team2
    };

    return bestSplit;
  }

  function combine(start: number, team1: Player[]) {
    if (team1.length === ppt) {
      const team2 = players.filter(
        p => !team1.find(t1p => t1p.id === p.id)
      );

      const avg1 =
        team1.reduce((s, p) => s + p.rating, 0) / ppt;

      const avg2 =
        team2.reduce((s, p) => s + p.rating, 0) / ppt;

      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      const keepersOk = k1 <= 1 && k2 <= 1;

      if (
        avg1 >= minRating &&
        avg2 >= minRating &&
        keepersOk
      ) {
        const diff = Math.abs(avg1 - avg2);

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

    for (let i = start; i < players.length; i++) {
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

/**
 * Kies voor Intro meteen een geldige groep van 8 spelers.
 *
 * Een geldige wedstrijd bestaat uit vier rating-paren:
 * - iedere rating komt dus 2 of 4 keer voor in de wedstrijd;
 * - maximaal twee spelers van dezelfde rating per team;
 * - de teams kunnen daardoor exact gespiegeld worden.
 *
 * Dit voorkomt dat we eerst willekeurig 8 spelers kiezen en pas daarna
 * ontdekken dat die 8 onmogelijk in twee geldige teams te verdelen zijn.
 */
function selectIntroMatchPlayers(
  candidates: Player[],
  pairCounts: Map<string, number>,
  ppt: number
): Player[] | null {
  const neededPairs = ppt;

  const pairOptions: {
    a: Player,
    b: Player,
    rating: number,
    score: number
  }[] = [];

  const byRating = new Map<number, Player[]>();

  candidates.forEach(p => {
    if (!byRating.has(p.rating)) {
      byRating.set(p.rating, []);
    }

    byRating.get(p.rating)!.push(p);
  });

  byRating.forEach((ratingPlayers, rating) => {
    for (let i = 0; i < ratingPlayers.length; i++) {
      for (let j = i + 1; j < ratingPlayers.length; j++) {
        const a = ratingPlayers[i];
        const b = ratingPlayers[j];

        const key = [a.id, b.id]
          .sort()
          .join('-');

        pairOptions.push({
          a,
          b,
          rating,
          score: pairCounts.get(key) || 0
        });
      }
    }
  });

  if (pairOptions.length < neededPairs) {
    return null;
  }

  pairOptions.sort(
    (a, b) =>
      a.score - b.score ||
      Math.random() - 0.5
  );

  const chosen: typeof pairOptions = [];
  const used = new Set<number>();
  const pairsPerRating = new Map<number, number>();

  function search(start: number): boolean {
    if (chosen.length === neededPairs) {
      return true;
    }

    for (let i = start; i < pairOptions.length; i++) {
      const option = pairOptions[i];

      if (
        used.has(option.a.id) ||
        used.has(option.b.id)
      ) {
        continue;
      }

      const countForRating =
        pairsPerRating.get(option.rating) || 0;

      if (countForRating >= 2) {
        continue;
      }

      chosen.push(option);

      used.add(option.a.id);
      used.add(option.b.id);

      pairsPerRating.set(
        option.rating,
        countForRating + 1
      );

      if (search(i + 1)) {
        return true;
      }

      chosen.pop();

      used.delete(option.a.id);
      used.delete(option.b.id);

      if (countForRating === 0) {
        pairsPerRating.delete(option.rating);
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

  return chosen.flatMap(pair => [
    pair.a,
    pair.b
  ]);
}

async function generateSingleVersion(
  allPlayers: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  manualTimes: { start: string, end: string }[],
  minRating: number,
  isIntro: boolean,
  introPoolCount: number
): Promise<NKSession | null> {
  const ppm = ppt * 2;

  const totalRounds = Math.ceil(
    (allPlayers.length * mpp / ppm) /
    hallNames.length
  );

  const playedCount = new Map(
    allPlayers.map(p => [p.id, 0])
  );

  const pairCounts = new Map<string, number>();

  const reservePoolCounts = new Map<number, number>();
  const reservePlayerCounts = new Map<number, number>();

  // Aantal fysieke invalbeurten per speler.
  const infillPlayerCounts = new Map<number, number>();

  const rounds: NKRound[] = [];

  // Invalbeurten per reeds opgebouwde ronde.
  // Dit hebben we nodig wanneer de generator terug moet gaan
  // naar een eerdere ronde.
  const infillAssignmentsHistory: NKInfillAssignment[][] = [];

  const playedCountsHistory: Map<number, number>[] = [
    new Map(playedCount)
  ];

  const roundAttempts = new Array(
    totalRounds + 1
  ).fill(0);

  if (isIntro) {
    const requiredIntroRatings =
      getRequiredIntroRatings(introPoolCount);

    // In een Intro-toernooi hoeft het aantal spelers geen veelvoud
    // van het aantal spelers per team te zijn. Overige spelers doen
    // gewoon die ronde niets. De bestaande exacte mpp-eis blijft leidend.
    requiredIntroRatings.forEach(rating => {
      const poolCount = allPlayers.filter(
        p => p.rating === rating
      ).length;

      if ((poolCount * mpp) % 2 !== 0) {
        throw new Error(
          `Niet haalbaar met ${introPoolCount} ratingpoules: rating ${rating} kan niet gelijk over beide teams worden verdeeld bij ${mpp} wedstrijden per persoon.`
        );
      }
    });
  }

  let rIdx = 1;

  const maxGlobalTime = Date.now() + 5000;

  while (rIdx <= totalRounds) {
    if (Date.now() > maxGlobalTime) {
      return null;
    }

    const currentPlayedCount =
      playedCountsHistory[rIdx - 1];

    let success = false;
    let roundMatches: NKMatch[] = [];
    let roundInfillAssignments: NKInfillAssignment[] = [];

    for (let attempt = 0; attempt < 100; attempt++) {
      const usedThisRound = new Set<number>();
      const matches: NKMatch[] = [];

      const target = isIntro ? 0 : 0.30;

      let pool = [...allPlayers]
        .filter(
          p =>
            currentPlayedCount.get(p.id)! < mpp
        )
        .sort(
          (a, b) =>
            (mpp - currentPlayedCount.get(a.id)!) -
            (mpp - currentPlayedCount.get(b.id)!) ||
            Math.random() - 0.5
        )
        .reverse();

      const mInRound = Math.min(
        hallNames.length,
        Math.floor(pool.length / ppm)
      );

      try {
        for (let h = 0; h < mInRound; h++) {
          const candidates = pool.filter(
            p => !usedThisRound.has(p.id)
          );

          if (candidates.length < ppm) {
            break;
          }

          let mPlayers: Player[] | null;

          if (isIntro) {
            // BELANGRIJK: kies in Intro niet eerst willekeurig 8 spelers.
            // Dat kan heel vaak een groep opleveren die onmogelijk gespiegeld
            // kan worden. Kies daarom direct vier geldige rating-paren.
            mPlayers = selectIntroMatchPlayers(
              candidates,
              pairCounts,
              ppt
            );
          } else {
            const selectedForMatch: Player[] = [];

            selectedForMatch.push(candidates[0]);

            while (
              selectedForMatch.length < ppm
            ) {
              const remaining = candidates.filter(
                c => !selectedForMatch.includes(c)
              );

              remaining.sort((a, b) => {
                const scoreA =
                  selectedForMatch.reduce(
                    (sum, p) =>
                      sum +
                      (
                        pairCounts.get(
                          [p.id, a.id]
                            .sort()
                            .join('-')
                        ) || 0
                      ),
                    0
                  );

                const scoreB =
                  selectedForMatch.reduce(
                    (sum, p) =>
                      sum +
                      (
                        pairCounts.get(
                          [p.id, b.id]
                            .sort()
                            .join('-')
                        ) || 0
                      ),
                    0
                  );

                return (
                  scoreA - scoreB ||
                  Math.random() - 0.5
                );
              });

              selectedForMatch.push(
                remaining[0]
              );
            }

            mPlayers = selectedForMatch;
          }

          if (!mPlayers) {
            throw new Error();
          }

          const split = getBestTeamSplit(
            mPlayers,
            ppt,
            target,
            minRating,
            isIntro,
            introPoolCount
          );

          if (!split) {
            throw new Error();
          }

          const diff = Math.abs(
            (
              split.t1.reduce(
                (s, p) => s + p.rating,
                0
              ) / ppt
            ) -
            (
              split.t2.reduce(
                (s, p) => s + p.rating,
                0
              ) / ppt
            )
          );

          if (!isIntro && diff > 0.301) {
            throw new Error();
          }

          mPlayers.forEach(p =>
            usedThisRound.add(p.id)
          );

          matches.push({
            id: `r${rIdx}h${h}`,
            hallName: hallNames[h],
            team1: split.t1,
            team2: split.t2,
            team1Score: 0,
            team2Score: 0,
            isPlayed: false,
            subLow: null as any,
            subHigh: null as any,
            referee: null as any
          });
        }

        // ------------------------------------------------------------------
        // NIEUW: FYSIEKE INVALLERS VOOR TOURNAMENT RESERVES
        // ------------------------------------------------------------------
        //
        // Dit gebeurt vóór subHigh/subLow/referee.
        //
        // Daardoor kan iemand die fysiek moet invallen niet daarna
        // per ongeluk ook als scheidsrechter of gewone reserve worden
        // toegewezen.
        //
        // De tournament reserve blijft ondertussen gewoon in team1/team2.
        // ------------------------------------------------------------------
        roundInfillAssignments =
          assignTournamentReserveInfill(
            allPlayers,
            matches,
            rIdx,
            infillPlayerCounts
          );

        // Houd bij welke echte spelers deze ronde al invallen.
        const infillThisRound = new Set(
          roundInfillAssignments.map(
            a => a.substitutePlayerId
          )
        );

        // --- VERBETERDE VERDELING RESERVES EN SCHEIDS ---
        //
        // Tournament reserves mogen hier niet als sub/ref gebruikt worden.
        // Ook spelers die al fysiek invallen worden uitgesloten.
        let resting = allPlayers.filter(
          p =>
            !usedThisRound.has(p.id) &&
            !p.isTournamentReserve &&
            !infillThisRound.has(p.id)
        );

        if (isIntro) {
          // In Intro komen de twee reserves altijd uit verschillende
          // ratingpoules.
          //
          // Tournament reserves zijn hierboven al uitgesloten.
          //
          // De keuze wordt gewogen op basis van eerdere reservebeurten,
          // zodat de verdeling over het hele gegenereerde toernooi zo
          // eerlijk mogelijk blijft.
          resting = assignIntroReserves(
            resting,
            matches,
            reservePoolCounts,
            reservePlayerCounts
          );
        } else {
          resting.sort(
            (a, b) => a.rating - b.rating
          );

          // Stap 1: Geef elke wedstrijd eerst
          // de laagste beschikbare reserve.
          for (let m of matches) {
            if (resting.length > 0) {
              m.subLow = resting.shift()!;
            }
          }

          // Stap 2: Geef elke wedstrijd daarna
          // de hoogste beschikbare reserve.
          for (let m of matches) {
            if (resting.length > 0) {
              m.subHigh = resting.pop()!;
            }
          }
        }

        if (isIntro) {
          // In Intro maakt het voor de scheidsrechter niet uit
          // uit welke ratingpool hij komt.
          //
          // Kies daarom willekeurig uit de resterende spelers.
          for (let m of matches) {
            if (resting.length > 0) {
              m.referee = resting.splice(
                Math.floor(
                  Math.random() * resting.length
                ),
                1
              )[0];
            }
          }
        } else {
          // Stap 3: Geef elke wedstrijd tot slot
          // een scheidsrechter uit de middenmoot.
          for (let m of matches) {
            if (resting.length > 0) {
              m.referee = resting.splice(
                Math.floor(resting.length / 2),
                1
              )[0];
            }
          }
        }

        roundMatches = matches;

        // Alles is gelukt voor deze ronde.
        success = true;
        break;

      } catch (e) {
        // Deze poging is ongeldig.
        //
        // Vooral belangrijk bij tournament reserves:
        // als niet voor iedere reserve-deelnemer een speler
        // met exact dezelfde rating beschikbaar is, proberen
        // we een andere wedstrijdindeling.
      }
    }

    if (success) {
      const time =
        manualTimes[rIdx - 1] || {
          start: '',
          end: ''
        };

      rounds.push({
        roundNumber: rIdx,
        matches: roundMatches,
        restingPlayers: [],
        startTime: time.start,
        endTime: time.end
      } as any);

      infillAssignmentsHistory.push(
        roundInfillAssignments
      );

      // Werk het aantal invalbeurten per speler bij.
      roundInfillAssignments.forEach(
        assignment => {
          const id =
            assignment.substitutePlayerId;

          infillPlayerCounts.set(
            id,
            (infillPlayerCounts.get(id) || 0) + 1
          );
        }
      );

      const nextCounts =
        new Map(currentPlayedCount);

      roundMatches.forEach(m => {
        const allInMatch = [
          ...m.team1,
          ...m.team2
        ];

        // Officiële wedstrijdtelling blijft volledig gebaseerd
        // op de spelers in de teams.
        //
        // De fysieke invaller staat hier bewust NIET tussen.
        allInMatch.forEach(p => {
          nextCounts.set(
            p.id,
            nextCounts.get(p.id)! + 1
          );
        });

        for (
          let i = 0;
          i < allInMatch.length;
          i++
        ) {
          for (
            let j = i + 1;
            j < allInMatch.length;
            j++
          ) {
            const key = [
              allInMatch[i].id,
              allInMatch[j].id
            ]
              .sort()
              .join('-');

            pairCounts.set(
              key,
              (pairCounts.get(key) || 0) + 1
            );
          }
        }
      });

      playedCountsHistory[rIdx] =
        nextCounts;

      rIdx++;
    } else {
      if (rIdx === 1) {
        return null;
      }

      // We gaan één ronde terug.
      // Alle gegevens die specifiek bij die ronde horen
      // moeten daarom ook teruggedraaid worden.

      rounds.pop();

      const previousAssignments =
        infillAssignmentsHistory.pop() || [];

      previousAssignments.forEach(
        assignment => {
          const id =
            assignment.substitutePlayerId;

          const current =
            infillPlayerCounts.get(id) || 0;

          if (current <= 1) {
            infillPlayerCounts.delete(id);
          } else {
            infillPlayerCounts.set(
              id,
              current - 1
            );
          }
        }
      );

      // De pairCounts van de teruggedraaide ronde verwijderen.
      const removedRound =
        rounds.length > 0
          ? null
          : null;

      // Omdat pairCounts alleen gebruikt wordt als
      // voorkeursscore voor toekomstige rondes, reconstrueren
      // we deze veilig vanuit de nog bestaande rondes.
      pairCounts.clear();

      rounds.forEach(round => {
        round.matches.forEach(match => {
          const playersInMatch = [
            ...match.team1,
            ...match.team2
          ];

          for (
            let i = 0;
            i < playersInMatch.length;
            i++
          ) {
            for (
              let j = i + 1;
              j < playersInMatch.length;
              j++
            ) {
              const key = [
                playersInMatch[i].id,
                playersInMatch[j].id
              ]
                .sort()
                .join('-');

              pairCounts.set(
                key,
                (pairCounts.get(key) || 0) + 1
              );
            }
          }
        });
      });

      rIdx--;

      roundAttempts[rIdx]++;

      if (roundAttempts[rIdx] > 15) {
        return null;
      }
    }
  }

  const lastCounts =
    playedCountsHistory[
      playedCountsHistory.length - 1
    ];

  if (
    !allPlayers.every(
      p => lastCounts.get(p.id) === mpp
    )
  ) {
    return null;
  }

  // Alle invalbeurten uit alle rondes samenvoegen.
  const infillAssignments =
    infillAssignmentsHistory.flat();

  return {
    competitionName,
    hallNames,
    playersPerTeam: ppt,
    totalRounds: rounds.length,
    rounds,
    standings: [],
    infillAssignments,
    isCompleted: false
  };
}

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  onProgress: (msg: string) => void,
  manualTimes: { start: string, end: string }[],
  minTeamRating: number,
  isIntro: boolean,
  introPoolCount: number
): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let totalAttempts = 0;

  while (
    validVersions.length < 300 &&
    totalAttempts < 3500
  ) {
    totalAttempts++;

    if (totalAttempts % 10 === 0) {
      onProgress(
        `Optimaliseren: Versie ${validVersions.length}/300 gevonden...`
      );

      await delay(1);
    }

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
      validVersions.push(session);
    }
  }

  if (validVersions.length === 0) {
    throw new Error(
      "Geen schema gevonden die voldoet aan de eisen (max 0.30 diff)."
    );
  }

  const getMaxDiff = (
    s: NKSession
  ): number => {
    let max = 0;

    s.rounds.forEach(r =>
      r.matches.forEach(m => {
        const avg1 =
          m.team1.reduce(
            (acc, p) => acc + p.rating,
            0
          ) / m.team1.length;

        const avg2 =
          m.team2.reduce(
            (acc, p) => acc + p.rating,
            0
          ) / m.team2.length;

        const diff = Math.abs(
          avg1 - avg2
        );

        if (diff > max) {
          max = diff;
        }
      })
    );

    return max;
  };

  const getSocialScore = (
    s: NKSession
  ): number => {
    const pairs =
      new Map<string, number>();

    s.rounds.forEach(r =>
      r.matches.forEach(m => {
        const p = [
          ...m.team1,
          ...m.team2
        ];

        for (
          let i = 0;
          i < p.length;
          i++
        ) {
          for (
            let j = i + 1;
            j < p.length;
            j++
          ) {
            const key = [
              p[i].id,
              p[j].id
            ]
              .sort()
              .join('-');

            pairs.set(
              key,
              (pairs.get(key) || 0) + 1
            );
          }
        }
      })
    );

    let score = 0;
    let maxRepeats = 0;

    pairs.forEach(v => {
      score += Math.pow(v, 6);

      if (v > maxRepeats) {
        maxRepeats = v;
      }
    });

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
        if (
          !pairs.has(
            [
              players[i].id,
              players[j].id
            ]
              .sort()
              .join('-')
          )
        ) {
          missing++;
        }
      }
    }

    return (
      score +
      (missing * 500) +
      (maxRepeats * 10000)
    );
  };

  const balanceThreshold = 0.305;

  let candidates =
    validVersions.filter(
      v =>
        getMaxDiff(v) <=
        balanceThreshold
    );

  if (candidates.length === 0) {
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

  return candidates.reduce(
    (best, cur) =>
      getSocialScore(cur) <
      getSocialScore(best)
        ? cur
        : best
  );
}
