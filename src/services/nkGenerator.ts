import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) =>
  new Promise(res => setTimeout(res, ms));

function getRequiredIntroRatings(poolCount: number): number[] {
  if (poolCount === 2) return [5, 10];
  if (poolCount === 3) return [5, 7.5, 10];
  if (poolCount === 4) return [2.5, 5, 7.5, 10];

  throw new Error(
    "Aantal ratingpoules moet 2, 3 of 4 zijn."
  );
}


/**
 * Normale NK-teamverdeler.
 *
 * Intro wordt apart afgehandeld, omdat daar de ratingverdeling
 * vooraf bepaald wordt.
 */
function getBestTeamSplit(
  players: Player[],
  ppt: number,
  targetDiff: number,
  minRating: number,
  isIntro: boolean
) {
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
      // Een rating moet even over beide teams verdeeld kunnen worden.
      if (ratingPlayers.length % 2 !== 0) {
        return null;
      }

      // Maximaal 2 spelers van dezelfde rating per team.
      if (ratingPlayers.length > 4) {
        return null;
      }

      const half = ratingPlayers.length / 2;

      if (half > 2) {
        return null;
      }

      // Willekeurig verdelen binnen dezelfde rating.
      const shuffled = [...ratingPlayers].sort(
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

    // Bij Intro zijn de teams exact gespiegeld.
    return {
      t1: team1,
      t2: team2
    };
  }

  // ============================================================
  // NORMAAL NK
  // ============================================================

  let bestDiff = Infinity;

  let bestSplit: {
    t1: Player[];
    t2: Player[];
  } | null = null;

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

      const k1 =
        team1.filter(
          p => p.isKeeper
        ).length;

      const k2 =
        team2.filter(
          p => p.isKeeper
        ).length;

      const keepersOk =
        k1 <= 1 &&
        k2 <= 1;

      if (
        avg1 >= minRating &&
        avg2 >= minRating &&
        keepersOk
      ) {
        const diff =
          Math.abs(
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

      combine(
        i + 1,
        team1
      );

      team1.pop();

      if (
        bestDiff <= targetDiff
      ) {
        return;
      }
    }
  }

  combine(0, []);

  return bestSplit;
}


/**
 * Mogelijke ratingcompositie voor één Intro-wedstrijd.
 *
 * Een compositie bevat ratingparen.
 *
 * Voor 4 tegen 4 zijn er 4 paren.
 *
 * Bijvoorbeeld:
 *
 * [5, 5, 7.5, 10]
 *
 * betekent:
 *
 * - 2 spelers rating 5
 * - 2 spelers rating 7.5
 * - 2 spelers rating 10
 *
 * Iedere rating wordt daardoor gelijk over beide teams verdeeld.
 */
function getPossibleIntroCompositions(
  ratings: number[],
  ppt: number
): number[][] {
  const result: number[][] = [];

  function build(
    startRating: number,
    current: number[],
    counts: Map<number, number>
  ) {
    if (
      current.length === ppt
    ) {
      result.push([
        ...current
      ]);

      return;
    }

    for (
      let i = startRating;
      i < ratings.length;
      i++
    ) {
      const rating =
        ratings[i];

      const count =
        counts.get(rating) || 0;

      // Maximaal twee paren van dezelfde rating.
      if (count >= 2) {
        continue;
      }

      counts.set(
        rating,
        count + 1
      );

      current.push(
        rating
      );

      build(
        i,
        current,
        counts
      );

      current.pop();

      if (count === 0) {
        counts.delete(rating);
      } else {
        counts.set(
          rating,
          count
        );
      }
    }
  }

  build(
    0,
    [],
    new Map()
  );

  return result;
}


/**
 * Bepaalt hoeveel speelbeurten iedere ratingpool nog nodig heeft.
 */
function getRemainingRatingAppearances(
  allPlayers: Player[],
  playedCount: Map<number, number>,
  ratings: number[],
  mpp: number
): Map<number, number> {
  const result =
    new Map<number, number>();

  for (
    const rating of ratings
  ) {
    let remaining = 0;

    for (
      const player of allPlayers
    ) {
      if (
        player.rating !== rating
      ) {
        continue;
      }

      const played =
        playedCount.get(
          player.id
        ) || 0;

      remaining += Math.max(
        0,
        mpp - played
      );
    }

    result.set(
      rating,
      remaining
    );
  }

  return result;
}


/**
 * Controleert of een compositie haalbaar is
 * met de nog beschikbare spelers.
 */
function compositionIsPossible(
  composition: number[],
  remainingAppearances: Map<number, number>
): boolean {
  const needed =
    new Map<number, number>();

  for (
    const rating of composition
  ) {
    needed.set(
      rating,
      (
        needed.get(rating) ||
        0
      ) + 2
    );
  }

  for (
    const [
      rating,
      amount
    ] of needed.entries()
  ) {
    const available =
      remainingAppearances.get(
        rating
      ) || 0;

    if (
      available < amount
    ) {
      return false;
    }
  }

  return true;
}


/**
 * Score voor een compositie.
 *
 * We proberen de resterende speelbeurten zo eerlijk mogelijk
 * over de ratingpoules te verdelen.
 */
function getIntroCompositionScore(
  composition: number[],
  remainingAppearances: Map<number, number>,
  totalMatchesRemaining: number,
  ratings: number[]
): number {
  const needed =
    new Map<number, number>();

  for (
    const rating of composition
  ) {
    needed.set(
      rating,
      (
        needed.get(rating) ||
        0
      ) + 2
    );
  }

  let score = 0;

  const totalRemaining =
    ratings.reduce(
      (sum, rating) =>
        sum +
        (
          remainingAppearances.get(
            rating
          ) || 0
        ),
      0
    );

  for (
    const rating of ratings
  ) {
    const remaining =
      remainingAppearances.get(
        rating
      ) || 0;

    const use =
      needed.get(
        rating
      ) || 0;

    if (
      remaining <= 0
    ) {
      if (use > 0) {
        return Infinity;
      }

      continue;
    }

    if (
      totalRemaining > 0
    ) {
      const expected =
        (
          remaining /
          totalRemaining
        ) *
        (
          totalMatchesRemaining *
          2
        );

      score += Math.abs(
        use - expected
      );
    }
  }

  // Kleine willekeur zodat versies niet identiek worden.
  score +=
    Math.random() * 3;

  return score;
}


/**
 * Kies voor een hele ronde een ratingverdeling.
 *
 * Eerst bepalen we welke ratings iedere wedstrijd nodig heeft.
 * Pas daarna kiezen we de daadwerkelijke spelers.
 */
function selectIntroRoundCompositions(
  ratings: number[],
  matchesNeeded: number,
  ppt: number,
  remainingAppearances: Map<number, number>
): number[][] | null {
  const possible =
    getPossibleIntroCompositions(
      ratings,
      ppt
    );

  if (
    possible.length === 0
  ) {
    return null;
  }

  const scored =
    possible
      .filter(
        composition =>
          compositionIsPossible(
            composition,
            remainingAppearances
          )
      )
      .map(
        composition => ({
          composition,
          score:
            getIntroCompositionScore(
              composition,
              remainingAppearances,
              matchesNeeded,
              ratings
            )
        })
      )
      .sort(
        (a, b) =>
          a.score -
          b.score
      );

  if (
    scored.length === 0
  ) {
    return null;
  }

  const selected: number[][] = [];

  function search(
    matchIndex: number,
    remaining: Map<number, number>
  ): boolean {
    if (
      matchIndex ===
      matchesNeeded
    ) {
      return true;
    }

    const candidates =
      [...scored];

    candidates.sort(
      (a, b) => {
        const diff =
          a.score -
          b.score;

        if (
          Math.abs(diff) < 2
        ) {
          return (
            Math.random() -
            0.5
          );
        }

        return diff;
      }
    );

    for (
      const candidate of candidates
    ) {
      const composition =
        candidate.composition;

      const nextRemaining =
        new Map(
          remaining
        );

      let valid = true;

      for (
        const rating of composition
      ) {
        const current =
          nextRemaining.get(
            rating
          ) || 0;

        if (
          current < 2
        ) {
          valid = false;
          break;
        }

        nextRemaining.set(
          rating,
          current - 2
        );
      }

      if (!valid) {
        continue;
      }

      const remainingMatches =
        matchesNeeded -
        matchIndex -
        1;

      let totalRemaining = 0;

      nextRemaining.forEach(
        value => {
          totalRemaining +=
            value;
        }
      );

      if (
        totalRemaining <
        remainingMatches *
          ppt *
          2
      ) {
        continue;
      }

      selected.push(
        composition
      );

      if (
        search(
          matchIndex + 1,
          nextRemaining
        )
      ) {
        return true;
      }

      selected.pop();
    }

    return false;
  }

  const startingRemaining =
    new Map(
      remainingAppearances
    );

  if (
    !search(
      0,
      startingRemaining
    )
  ) {
    return null;
  }

  return selected;
}


/**
 * Kies daadwerkelijke spelers voor één rating.
 *
 * Spelers met minder gespeelde wedstrijden krijgen voorrang.
 * Bij gelijke stand wordt gekeken naar eerdere combinaties.
 */
function chooseIntroPlayersForRating(
  candidates: Player[],
  rating: number,
  amount: number,
  playedCount: Map<number, number>,
  pairCounts: Map<string, number>,
  alreadySelected: Player[]
): Player[] | null {
  const available =
    candidates.filter(
      p =>
        p.rating === rating &&
        !alreadySelected.some(
          selected =>
            selected.id === p.id
        )
    );

  if (
    available.length <
    amount
  ) {
    return null;
  }

  const shuffled =
    [...available].sort(
      () =>
        Math.random() -
        0.5
    );

  shuffled.sort(
    (a, b) => {
      const playedA =
        playedCount.get(
          a.id
        ) || 0;

      const playedB =
        playedCount.get(
          b.id
        ) || 0;

      if (
        playedA !== playedB
      ) {
        return (
          playedA -
          playedB
        );
      }

      const pairScoreA =
        alreadySelected.reduce(
          (sum, p) =>
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

      const pairScoreB =
        alreadySelected.reduce(
          (sum, p) =>
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
        pairScoreA -
        pairScoreB
      );
    }
  );

  return shuffled.slice(
    0,
    amount
  );
}


/**
 * Selecteer de daadwerkelijke spelers voor één Intro-wedstrijd
 * op basis van een vooraf bepaalde ratingcompositie.
 */
function selectIntroMatchPlayersFromComposition(
  candidates: Player[],
  composition: number[],
  playedCount: Map<number, number>,
  pairCounts: Map<string, number>,
  ppt: number
): Player[] | null {
  const selected: Player[] = [];

  const counts =
    new Map<number, number>();

  for (
    const rating of composition
  ) {
    counts.set(
      rating,
      (
        counts.get(rating) ||
        0
      ) + 2
    );
  }

  const orderedRatings =
    [...counts.keys()].sort(
      (a, b) => {
        const aCount =
          candidates.filter(
            p =>
              p.rating === a &&
              !selected.some(
                s =>
                  s.id === p.id
              )
          ).length;

        const bCount =
          candidates.filter(
            p =>
              p.rating === b &&
              !selected.some(
                s =>
                  s.id === p.id
              )
          ).length;

        return (
          aCount -
          bCount
        );
      }
    );

  for (
    const rating of orderedRatings
  ) {
    const amount =
      counts.get(
        rating
      )!;

    const players =
      chooseIntroPlayersForRating(
        candidates,
        rating,
        amount,
        playedCount,
        pairCounts,
        selected
      );

    if (!players) {
      return null;
    }

    selected.push(
      ...players
    );
  }

  if (
    selected.length !==
    ppt * 2
  ) {
    return null;
  }

  return selected;
}


/**
 * Verdeel wissels en scheidsrechters willekeurig.
 *
 * Hier wordt bewust GEEN ratingvoorwaarde gebruikt.
 *
 * De functie geeft de spelers terug die na het uitdelen
 * van alle rollen daadwerkelijk niets hoeven te doen.
 */
function assignRandomReservesAndReferees(
  resting: Player[],
  matches: NKMatch[]
): Player[] {
  const available =
    [...resting].sort(
      () =>
        Math.random() -
        0.5
    );

  let index = 0;

  // Eerst subLow
  for (
    const match of matches
  ) {
    if (
      index <
      available.length
    ) {
      match.subLow =
        available[index++];
    }
  }

  // Daarna subHigh
  for (
    const match of matches
  ) {
    if (
      index <
      available.length
    ) {
      match.subHigh =
        available[index++];
    }
  }

  // Daarna scheidsrechter
  for (
    const match of matches
  ) {
    if (
      index <
      available.length
    ) {
      match.referee =
        available[index++];
    }
  }

  /*
   * Dit zijn de spelers die:
   *
   * - niet spelen;
   * - geen subLow zijn;
   * - geen subHigh zijn;
   * - geen scheidsrechter zijn.
   *
   * Zij komen onderaan de ronde te staan.
   */
  return available.slice(index);
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
  introPoolCount: number
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

  const playedCount =
    new Map(
      allPlayers.map(
        p => [p.id, 0]
      )
    );

  const pairCounts =
    new Map<string, number>();

  const rounds: NKRound[] = [];

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
   * Intro krijgt meer tijd dan normaal NK.
   */
  const maxGlobalTime =
    Date.now() +
    (
      isIntro
        ? 30000
        : 5000
    );

  /*
   * Intro-basiscontrole.
   */
  if (isIntro) {
    const requiredIntroRatings =
      getRequiredIntroRatings(
        introPoolCount
      );

    if (
      ppm % 2 !== 0
    ) {
      throw new Error(
        "Intro vereist een even aantal spelers per wedstrijd."
      );
    }

    for (
      const rating of
      requiredIntroRatings
    ) {
      const poolCount =
        allPlayers.filter(
          p =>
            p.rating === rating
        ).length;

      if (
        (
          poolCount *
          mpp
        ) % 2 !== 0
      ) {
        throw new Error(
          `Niet haalbaar met ${introPoolCount} ratingpoules: ` +
          `rating ${rating} kan niet gelijk over beide teams ` +
          `worden verdeeld bij ${mpp} wedstrijden per persoon.`
        );
      }
    }
  }

  let rIdx = 1;

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

    /*
     * Probeer deze ronde.
     */
    for (
      let attempt = 0;
      attempt < 100;
      attempt++
    ) {
      if (
        Date.now() >
        maxGlobalTime
      ) {
        return null;
      }

      const usedThisRound =
        new Set<number>();

      const matches:
        NKMatch[] = [];

      const target =
        isIntro
          ? 0
          : 0.30;

      try {
        /*
         * ========================================================
         * INTRO
         * ========================================================
         */
        if (isIntro) {
          const ratings =
            getRequiredIntroRatings(
              introPoolCount
            );

          const candidates =
            allPlayers.filter(
              p =>
                (
                  currentPlayedCount.get(
                    p.id
                  ) || 0
                ) < mpp
            );

          const mInRound =
            Math.min(
              hallNames.length,
              Math.floor(
                candidates.length /
                ppm
              )
            );

          if (
            mInRound <= 0
          ) {
            throw new Error();
          }

          const remainingAppearances =
            getRemainingRatingAppearances(
              allPlayers,
              currentPlayedCount,
              ratings,
              mpp
            );

          /*
           * Eerst de ratingverdeling bepalen.
           */
          const compositions =
            selectIntroRoundCompositions(
              ratings,
              mInRound,
              ppt,
              remainingAppearances
            );

          if (
            !compositions
          ) {
            throw new Error();
          }

          /*
           * Daarna pas de spelers kiezen.
           */
          for (
            let h = 0;
            h < mInRound;
            h++
          ) {
            const available =
              allPlayers.filter(
                p =>
                  (
                    currentPlayedCount.get(
                      p.id
                    ) || 0
                  ) < mpp &&
                  !usedThisRound.has(
                    p.id
                  )
              );

            if (
              available.length <
              ppm
            ) {
              throw new Error();
            }

            const mPlayers =
              selectIntroMatchPlayersFromComposition(
                available,
                compositions[h],
                currentPlayedCount,
                pairCounts,
                ppt
              );

            if (
              !mPlayers
            ) {
              throw new Error();
            }

            /*
             * Controleer de gespiegeldheid.
             */
            const split =
              getBestTeamSplit(
                mPlayers,
                ppt,
                target,
                minRating,
                true
              );

            if (
              !split
            ) {
              throw new Error();
            }

            const avg1 =
              split.t1.reduce(
                (s, p) =>
                  s + p.rating,
                0
              ) / ppt;

            const avg2 =
              split.t2.reduce(
                (s, p) =>
                  s + p.rating,
                0
              ) / ppt;

            const diff =
              Math.abs(
                avg1 -
                avg2
              );

            if (
              diff >
              0.00001
            ) {
              throw new Error();
            }

            mPlayers.forEach(
              p =>
                usedThisRound.add(
                  p.id
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
              team1Score: 0,
              team2Score: 0,
              isPlayed: false,
              subLow: null,
              subHigh: null,
              referee: null
            });
          }
        }

        /*
         * ========================================================
         * NORMAAL NK
         * ========================================================
         */
        else {
          let pool =
            [...allPlayers]
              .filter(
                p =>
                  (
                    currentPlayedCount.get(
                      p.id
                    ) || 0
                  ) < mpp
              )
              .sort(
                (a, b) =>
                  (
                    mpp -
                    (
                      currentPlayedCount.get(
                        a.id
                      ) || 0
                    )
                  ) -
                  (
                    mpp -
                    (
                      currentPlayedCount.get(
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

            if (
              candidates.length <
              ppm
            ) {
              break;
            }

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
                    scoreB
                  ) ||
                  (
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

            const split =
              getBestTeamSplit(
                selectedForMatch,
                ppt,
                0.30,
                minRating,
                false
              );

            if (
              !split
            ) {
              throw new Error();
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
              diff >
              0.301
            ) {
              throw new Error();
            }

            selectedForMatch.forEach(
              p =>
                usedThisRound.add(
                  p.id
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
              team1Score: 0,
              team2Score: 0,
              isPlayed: false,
              subLow: null,
              subHigh: null,
              referee: null
            });
          }
        }

        /*
         * ========================================================
         * WISSELS + SCHEIDSRECHTERS
         * ========================================================
         *
         * Rating maakt hier bewust niet uit.
         */
        const resting =
          allPlayers.filter(
            p =>
              !usedThisRound.has(
                p.id
              )
          );

        /*
         * Deze functie geeft de spelers terug die na het uitdelen
         * van wissels en scheidsrechters écht niets hoeven te doen.
         */
        const completelyResting =
          assignRandomReservesAndReferees(
            resting,
            matches
          );

        if (
          matches.length === 0
        ) {
          throw new Error();
        }

        roundMatches =
          matches;

        /*
         * Sla de spelers die echt niets doen tijdelijk op.
         *
         * We gebruiken hier een tijdelijke property op de lokale
         * rondeverwerking. Die wordt hieronder netjes in
         * restingPlayers gezet.
         */
        (roundMatches as any).__restingPlayers =
          completelyResting;

        success = true;

        break;
      } catch (e) {
        /*
         * Deze poging is mislukt.
         */
      }

      await delay(0);
    }

    /*
     * ============================================================
     * RONDE GELUKT
     * ============================================================
     */
    if (success) {
      const time =
        manualTimes[
          rIdx - 1
        ] || {
          start: '',
          end: ''
        };

      /*
       * Haal de spelers op die daadwerkelijk niets doen.
       */
      const restingPlayers =
        (
          roundMatches as any
        ).__restingPlayers ||
        [];

      /*
       * Verwijder de tijdelijke property weer.
       */
      delete (
        roundMatches as any
      ).__restingPlayers;

      rounds.push({
        roundNumber:
          rIdx,

        matches:
          roundMatches,

        /*
         * Deze spelers worden alleen voor het overzicht
         * opgeslagen.
         *
         * Ze tellen nergens anders voor mee.
         */
        restingPlayers,

        startTime:
          time.start,

        endTime:
          time.end
      } as NKRound);

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

          /*
           * Alleen daadwerkelijk spelende spelers krijgen
           * een wedstrijd erbij.
           */
          allInMatch.forEach(
            p => {
              nextCounts.set(
                p.id,
                (
                  nextCounts.get(
                    p.id
                  ) || 0
                ) + 1
              );
            }
          );

          /*
           * Pair counts bijwerken.
           */
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
              const key =
                [
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

      await delay(0);
    }

    /*
     * ============================================================
     * RONDE MISLUKT → TERUG
     * ============================================================
     */
    else {
      if (
        rIdx === 1
      ) {
        return null;
      }

      rounds.pop();

      rIdx--;

      roundAttempts[
        rIdx
      ]++;

      if (
        roundAttempts[
          rIdx
        ] > 15
      ) {
        return null;
      }
    }
  }

  /*
   * ============================================================
   * EINDCONTROLE
   * ============================================================
   */

  const lastCounts =
    playedCountsHistory[
      playedCountsHistory.length - 1
    ];

  /*
   * Iedere speler exact mpp wedstrijden.
   */
  if (
    !allPlayers.every(
      p =>
        lastCounts.get(
          p.id
        ) === mpp
    )
  ) {
    return null;
  }

  /*
   * Extra Intro-controle.
   */
  if (isIntro) {
    for (
      const round of rounds
    ) {
      for (
        const match of
        round.matches
      ) {
        const team1Ratings =
          new Map<
            number,
            number
          >();

        const team2Ratings =
          new Map<
            number,
            number
          >();

        match.team1.forEach(
          p =>
            team1Ratings.set(
              p.rating,
              (
                team1Ratings.get(
                  p.rating
                ) || 0
              ) + 1
            )
        );

        match.team2.forEach(
          p =>
            team2Ratings.set(
              p.rating,
              (
                team2Ratings.get(
                  p.rating
                ) || 0
              ) + 1
            )
        );

        const ratings =
          new Set([
            ...team1Ratings.keys(),
            ...team2Ratings.keys()
          ]);

        for (
          const rating of
          ratings
        ) {
          const team1Count =
            team1Ratings.get(
              rating
            ) || 0;

          const team2Count =
            team2Ratings.get(
              rating
            ) || 0;

          if (
            team1Count !==
            team2Count
          ) {
            return null;
          }

          if (
            team1Count > 2 ||
            team2Count > 2
          ) {
            return null;
          }
        }
      }
    }
  }

  return {
    competitionName,
    hallNames,
    playersPerTeam:
      ppt,
    totalRounds:
      rounds.length,
    rounds,
    standings: [],
    isCompleted:
      false
  };
}


export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  onProgress: (
    msg: string
  ) => void,
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

  const targetVersions =
    isIntro
      ? 30
      : 300;

  const maxAttempts =
    isIntro
      ? 500
      : 3500;

  while (
    validVersions.length <
      targetVersions &&
    totalAttempts <
      maxAttempts
  ) {
    totalAttempts++;

    if (
      totalAttempts % 5 ===
      0
    ) {
      onProgress(
        isIntro
          ? `Intro optimaliseren: versie ${validVersions.length}/${targetVersions}...`
          : `Optimaliseren: versie ${validVersions.length}/${targetVersions} gevonden...`
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
      validVersions.push(
        session
      );
    }
  }

  if (
    validVersions.length ===
    0
  ) {
    if (isIntro) {
      throw new Error(
        "Geen Intro-schema gevonden. " +
        "Controleer of de gekozen ratingpoules voldoende spelers bevatten " +
        "om iedere speler exact het ingestelde aantal wedstrijden te laten spelen."
      );
    }

    throw new Error(
      "Geen schema gevonden die voldoet aan de eisen (max 0.30 diff)."
    );
  }

  /*
   * Bepaal maximaal ratingverschil.
   */
  const getMaxDiff =
    (
      s: NKSession
    ): number => {
      let max = 0;

      s.rounds.forEach(
        r =>
          r.matches.forEach(
            m => {
              const avg1 =
                m.team1.reduce(
                  (
                    acc,
                    p
                  ) =>
                    acc +
                    p.rating,
                  0
                ) /
                m.team1.length;

              const avg2 =
                m.team2.reduce(
                  (
                    acc,
                    p
                  ) =>
                    acc +
                    p.rating,
                  0
                ) /
                m.team2.length;

              const diff =
                Math.abs(
                  avg1 -
                  avg2
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


  /*
   * Sociale score.
   */
  const getSocialScore =
    (
      s: NKSession
    ): number => {
      const pairs =
        new Map<
          string,
          number
        >();

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
                  const key =
                    [
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

      let maxRepeats =
        0;

      pairs.forEach(
        v => {
          score +=
            Math.pow(
              v,
              6
            );

          if (
            v >
            maxRepeats
          ) {
            maxRepeats =
              v;
          }
        }
      );

      let missing =
        0;

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
        (
          missing *
          500
        ) +
        (
          maxRepeats *
          10000
        )
      );
    };


  /*
   * Intro:
   * alle geldige versies zijn kandidaten.
   *
   * Normaal NK:
   * bestaande 0.305-balance behouden.
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
        v =>
          getMaxDiff(v) <=
          balanceThreshold
      );

    if (
      candidates.length ===
      0
    ) {
      candidates =
        [...validVersions]
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
   * Beste sociale verdeling kiezen.
   */
  return candidates.reduce(
    (
      best,
      cur
    ) =>
      getSocialScore(cur) <
      getSocialScore(best)
        ? cur
        : best
  );
}
