import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const GENERATOR_DIAGNOSTICS = true;

function diagnosticError(message: string): Error {
  return new Error(`[GENERATOR] ${message}`);
}

function describePlayers(players: Player[]): string {
  const counts = new Map<number, number>();

  players.forEach(p => {
    counts.set(p.rating, (counts.get(p.rating) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => `${rating}:${count}`)
    .join(', ');
}

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
    p => !excludedRatings.has(p.rating)
  );

  if (available.length === 0) return null;

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
  let available = [...resting];

  for (const match of matches) {
    if (available.length < 2) {
      throw diagnosticError(
        `Intro reserves: er zijn nog maar ${available.length} spelers beschikbaar, maar er zijn 2 reserves nodig.`
      );
    }

    const first = chooseWeightedIntroReserve(
      available,
      reservePoolCounts,
      reservePlayerCounts,
      new Set()
    );

    if (!first) {
      throw diagnosticError(
        `Intro reserves: eerste reserve kon niet worden gekozen. Beschikbaar: ${describePlayers(available)}`
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
      throw diagnosticError(
        `Intro reserves: tweede reserve kon niet worden gekozen. Eerste reserve had rating ${first.rating}. Beschikbaar voor tweede reserve: ${describePlayers(available)}`
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
      if (ratingPlayers.length % 2 !== 0) {
        return null;
      }

      if (ratingPlayers.length > 4) {
        return null;
      }

      const half = ratingPlayers.length / 2;

      if (half > 2) {
        return null;
      }

      team1.push(
        ...ratingPlayers.slice(0, half)
      );

      team2.push(
        ...ratingPlayers.slice(half)
      );
    }

    if (
      team1.length !== ppt ||
      team2.length !== ppt
    ) {
      return null;
    }

    const avg1 =
      team1.reduce(
        (s, p) => s + p.rating,
        0
      ) / ppt;

    const avg2 =
      team2.reduce(
        (s, p) => s + p.rating,
        0
      ) / ppt;

    bestDiff = Math.abs(avg1 - avg2);

    bestSplit = {
      t1: team1,
      t2: team2
    };

    return bestSplit;
  }

  function combine(
    start: number,
    team1: Player[]
  ) {
    if (team1.length === ppt) {
      const team2 = players.filter(
        p =>
          !team1.find(
            t1p => t1p.id === p.id
          )
      );

      const avg1 =
        team1.reduce(
          (s, p) => s + p.rating,
          0
        ) / ppt;

      const avg2 =
        team2.reduce(
          (s, p) => s + p.rating,
          0
        ) / ppt;

      const k1 = team1.filter(
        p => p.isKeeper
      ).length;

      const k2 = team2.filter(
        p => p.isKeeper
      ).length;

      const keepersOk =
        k1 <= 1 && k2 <= 1;

      if (
        avg1 >= minRating &&
        avg2 >= minRating &&
        keepersOk
      ) {
        const diff = Math.abs(
          avg1 - avg2
        );

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

/**
 * Kies voor Intro meteen een geldige groep van 8 spelers.
 *
 * Een geldige wedstrijd bestaat uit vier rating-paren:
 *
 * - iedere rating komt dus 2 of 4 keer voor;
 * - maximaal twee spelers van dezelfde rating per team;
 * - de teams kunnen daardoor exact gespiegeld worden.
 */
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

  candidates.forEach(p => {
    if (!byRating.has(p.rating)) {
      byRating.set(p.rating, []);
    }

    byRating.get(p.rating)!.push(p);
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
          const a = ratingPlayers[i];
          const b = ratingPlayers[j];

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
    if (GENERATOR_DIAGNOSTICS) {
      throw diagnosticError(
        `Intro wedstrijd: slechts ${pairOptions.length} geldige ratingparen beschikbaar, maar ${neededPairs} nodig. Beschikbare spelers per rating: ${describePlayers(candidates)}`
      );
    }

    return null;
  }

  pairOptions.sort(
    (a, b) =>
      a.score - b.score ||
      Math.random() - 0.5
  );

  const chosen: typeof pairOptions = [];

  const used =
    new Set<number>();

  const pairsPerRating =
    new Map<number, number>();

  function search(start: number): boolean {
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

      if (
        search(i + 1)
      ) {
        return true;
      }

      chosen.pop();

      used.delete(option.a.id);
      used.delete(option.b.id);

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
    if (GENERATOR_DIAGNOSTICS) {
      throw diagnosticError(
        `Intro wedstrijd: er kunnen geen ${neededPairs} onderling niet-overlappende ratingparen worden samengesteld uit de beschikbare spelers: ${describePlayers(candidates)}`
      );
    }

    return null;
  }

  return chosen.flatMap(
    pair => [
      pair.a,
      pair.b
    ]
  );
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
  const ppm = ppt * 2;

  const totalRounds =
    Math.ceil(
      (
        allPlayers.length *
        mpp /
        ppm
      ) /
      hallNames.length
    );

  const playedCount =
    new Map(
      allPlayers.map(
        p => [p.id, 0]
      )
    );

  const pairCounts =
    new Map<string, number>();

  const reservePoolCounts =
    new Map<number, number>();

  const reservePlayerCounts =
    new Map<number, number>();

  const rounds: NKRound[] = [];

  const playedCountsHistory:
    Map<number, number>[] = [
      new Map(playedCount)
    ];

  const roundAttempts =
    new Array(
      totalRounds + 1
    ).fill(0);

  let lastFailureReason = "";

  if (isIntro) {
    const requiredIntroRatings =
      getRequiredIntroRatings(
        introPoolCount
      );

    requiredIntroRatings.forEach(
      rating => {
        const poolCount =
          allPlayers.filter(
            p =>
              p.rating === rating
          ).length;

        if (
          (poolCount * mpp) % 2 !==
          0
        ) {
          throw new Error(
            `Niet haalbaar voor Intro: rating ${rating} heeft ${poolCount} spelers. Met ${mpp} wedstrijden per persoon ontstaat ${poolCount * mpp} keer een spelerbeurt. Dat aantal moet even zijn.`
          );
        }
      }
    );
  }

  let rIdx = 1;

  while (
    rIdx <= totalRounds
  ) {
    const currentPlayedCount =
      new Map(
        playedCountsHistory[
          rIdx - 1
        ]
      );

    let success = false;

    let roundMatches:
      NKMatch[] = [];

    const maxAttempts = 100;

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      try {
        const usedThisRound =
          new Set<number>();

        const matches:
          NKMatch[] = [];

        const target =
          isIntro
            ? 0
            : 0.30;

        let pool =
          [...allPlayers]
            .filter(
              p =>
                currentPlayedCount.get(
                  p.id
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
                Math.random() -
                  0.5
            )
            .reverse();

        const mInRound =
          Math.min(
            hallNames.length,
            Math.floor(
              pool.length / ppm
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

          if (
            candidates.length <
            ppm
          ) {
            break;
          }

          let mPlayers:
            Player[] | null;

          if (isIntro) {
            mPlayers =
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
                  c =>
                    !selectedForMatch.includes(
                      c
                    )
                );

              remaining.sort(
                (a, b) => {
                  const scoreA =
                    selectedForMatch.reduce(
                      (
                        sum,
                        p
                      ) =>
                        sum +
                        (
                          pairCounts.get(
                            [
                              p.id,
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
                        p
                      ) =>
                        sum +
                        (
                          pairCounts.get(
                            [
                              p.id,
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

              selectedForMatch.push(
                remaining[0]
              );
            }

            mPlayers =
              selectedForMatch;
          }

          if (!mPlayers) {
            throw diagnosticError(
              `Ronde ${rIdx}, zaal ${h + 1}: er kon geen geldige groep van ${ppm} spelers worden samengesteld.`
            );
          }

          const split =
            getBestTeamSplit(
              mPlayers,
              ppt,
              target,
              minRating,
              isIntro,
              introPoolCount
            );

          if (!split) {
            if (isIntro) {
              throw diagnosticError(
                `Ronde ${rIdx}, zaal ${h + 1}: de gekozen ${ppm} Intro-spelers konden niet in twee geldige teams van ${ppt} worden verdeeld. Spelers per rating: ${describePlayers(mPlayers)}`
              );
            }

            throw diagnosticError(
              `Ronde ${rIdx}, zaal ${h + 1}: teams konden niet geldig worden verdeeld.`
            );
          }

          const diff =
            Math.abs(
              (
                split.t1.reduce(
                  (s, p) =>
                    s + p.rating,
                  0
                ) / ppt
              ) -
              (
                split.t2.reduce(
                  (s, p) =>
                    s + p.rating,
                  0
                ) / ppt
              )
            );

          if (
            !isIntro &&
            diff > 0.301
          ) {
            throw diagnosticError(
              `Ronde ${rIdx}, zaal ${h + 1}: teamverschil ${diff.toFixed(3)} is te groot.`
            );
          }

          mPlayers.forEach(
            p =>
              usedThisRound.add(
                p.id
              )
          );

          matches.push({
            id: `r${rIdx}h${h}`,
            hallName:
              hallNames[h],
            team1: split.t1,
            team2: split.t2,
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

        if (isIntro) {
          resting =
            assignIntroReserves(
              resting,
              matches,
              reservePoolCounts,
              reservePlayerCounts
            );
        } else {
          resting.sort(
            (a, b) =>
              a.rating -
              b.rating
          );

          for (
            let m of matches
          ) {
            if (
              resting.length > 0
            ) {
              m.subLow =
                resting.shift()!;
            }
          }

          for (
            let m of matches
          ) {
            if (
              resting.length > 0
            ) {
              m.subHigh =
                resting.pop()!;
            }
          }
        }

        if (isIntro) {
          for (
            let m of matches
          ) {
            if (
              resting.length > 0
            ) {
              m.referee =
                resting.splice(
                  Math.floor(
                    Math.random() *
                      resting.length
                  ),
                  1
                )[0];
            }
          }
        } else {
          for (
            let m of matches
          ) {
            if (
              resting.length > 0
            ) {
              m.referee =
                resting.splice(
                  Math.floor(
                    resting.length / 2
                  ),
                  1
                )[0];
            }
          }
        }

        if (
          matches.length <
          mInRound
        ) {
          throw diagnosticError(
            `Ronde ${rIdx}: er werden ${matches.length} van de ${mInRound} benodigde wedstrijden gemaakt.`
          );
        }

        roundMatches =
          matches;

        success = true;

        break;
      } catch (e) {
        if (
          GENERATOR_DIAGNOSTICS
        ) {
          const reason =
            e instanceof Error
              ? e.message
              : String(e);

          lastFailureReason =
            reason ||
            "onbekende fout";

          if (
            attempt === 0 ||
            attempt === 9 ||
            attempt === 24 ||
            attempt === 49 ||
            attempt === 74 ||
            attempt === 99
          ) {
            onProgress(
              `Diagnose ronde ${rIdx}/${totalRounds} — poging ${attempt + 1}/100: ${lastFailureReason}`
            );
          }

          console.warn(
            `[NK GENERATOR] Ronde ${rIdx}, poging ${attempt + 1}/100 mislukt: ${lastFailureReason}`
          );
        }
      }
    }

    if (success) {
      const time =
        manualTimes[
          rIdx - 1
        ] || {
          start: '',
          end: ''
        };

      rounds.push({
        roundNumber: rIdx,
        matches:
          roundMatches,
        restingPlayers: [],
        startTime:
          time.start,
        endTime:
          time.end
      } as any);

      const nextCounts =
        new Map(
          currentPlayedCount
        );

      roundMatches.forEach(
        m => {
          const allInMatch = [
            ...m.team1,
            ...m.team2
          ];

          allInMatch.forEach(
            p => {
              nextCounts.set(
                p.id,
                nextCounts.get(
                  p.id
                )! + 1
              );
            }
          );

          for (
            let i = 0;
            i < allInMatch.length;
            i++
          ) {
            for (
              let j = i + 1;
              j <
              allInMatch.length;
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
      if (rIdx === 1) {
        onProgress(
          `Diagnose: eerste ronde kan niet worden gemaakt. ${
            lastFailureReason
              ? `Laatste oorzaak: ${lastFailureReason}`
              : ''
          }`
        );

        return null;
      }

      onProgress(
        `Diagnose: ronde ${rIdx} lukt niet na 100 pogingen. Ik ga terug naar ronde ${
          rIdx - 1
        }. ${
          lastFailureReason
            ? `Laatste oorzaak: ${lastFailureReason}`
            : ''
        }`
      );

      rounds.pop();

      rIdx--;

      roundAttempts[
        rIdx
      ]++;

      if (
        roundAttempts[rIdx] >
        15
      ) {
        onProgress(
          `Diagnose: te veel terugpogingen rond ronde ${rIdx}. ${
            lastFailureReason
              ? `Laatste oorzaak: ${lastFailureReason}`
              : ''
          }`
        );

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
      p =>
        lastCounts.get(
          p.id
        ) === mpp
    )
  ) {
    const wrongCounts =
      allPlayers
        .filter(
          p =>
            lastCounts.get(
              p.id
            ) !== mpp
        )
        .map(
          p =>
            `${p.name || p.id}:${
              lastCounts.get(
                p.id
              ) || 0
            }`
        )
        .slice(0, 12)
        .join(', ');

    onProgress(
      `Diagnose: schema compleet, maar niet iedereen heeft exact ${mpp} wedstrijden. Voorbeelden: ${wrongCounts}`
    );

    return null;
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
  };
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
  const validVersions:
    NKSession[] = [];

  let totalAttempts = 0;

  onProgress(
    `Start diagnose: ${players.length} spelers, ${mpp} wedstrijden p.p., ${hallNames.length} zalen, ${introPoolCount} ratingpoules.`
  );

  while (
    validVersions.length < 300 &&
    totalAttempts < 3500
  ) {
    totalAttempts++;

    if (
      totalAttempts % 10 === 0
    ) {
      onProgress(
        `Optimaliseren: ${validVersions.length}/300 geldige schema's gevonden (poging ${totalAttempts}/3500)...`
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
        introPoolCount,
        onProgress
      );

    if (session) {
      validVersions.push(
        session
      );
    }
  }

  if (
    validVersions.length === 0
  ) {
    if (isIntro) {
      throw new Error(
        `Geen geldig Intro-schema gevonden na ${totalAttempts} pogingen. De app heeft de oorzaak tijdens het genereren getoond. Spelers: ${players.length}, wedstrijden p.p.: ${mpp}, spelers per team: ${ppt}, zalen: ${hallNames.length}.`
      );
    }

    throw new Error(
      `Geen geldig NK-schema gevonden na ${totalAttempts} pogingen. De app heeft de oorzaak tijdens het genereren getoond.`
    );
  }

  const getMaxDiff = (
    s: NKSession
  ): number => {
    let max = 0;

    s.rounds.forEach(
      r =>
        r.matches.forEach(
          m => {
            const avg1 =
              m.team1.reduce(
                (acc, p) =>
                  acc + p.rating,
                0
              ) /
              m.team1.length;

            const avg2 =
              m.team2.reduce(
                (acc, p) =>
                  acc + p.rating,
                0
              ) /
              m.team2.length;

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
        )
    );

    return max;
  };

  const getSocialScore = (
    s: NKSession
  ): number => {
    const pairs =
      new Map<string, number>();

    s.rounds.forEach(
      r =>
        r.matches.forEach(
          m => {
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
                  (
                    pairs.get(
                      key
                    ) || 0
                  ) + 1
                );
              }
            }
          }
        )
    );

    let score = 0;

    let maxRepeats = 0;

    pairs.forEach(
      v => {
        score +=
          Math.pow(v, 6);

        if (
          v > maxRepeats
        ) {
          maxRepeats = v;
        }
      }
    );

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
      missing * 500 +
      maxRepeats * 10000
    );
  };

  const balanceThreshold =
    0.305;

  let candidates =
    validVersions.filter(
      v =>
        getMaxDiff(v) <=
        balanceThreshold
    );

  if (
    candidates.length === 0
  ) {
    const bestDiff =
      Math.min(
        ...validVersions.map(
          getMaxDiff
        )
      );

    if (
      GENERATOR_DIAGNOSTICS
    ) {
      console.warn(
        `[NK GENERATOR] ${validVersions.length} geldige schema's gevonden, maar geen enkel schema voldoet aan max diff ${balanceThreshold}. Beste gevonden diff: ${bestDiff.toFixed(3)}`
      );
    }

    candidates =
      [...validVersions]
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
