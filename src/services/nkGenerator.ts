import { Player, NKSession, NKRound, NKMatch } from '../types';

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
  const available = candidates.filter(p => !excludedRatings.has(p.rating));
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
      throw new Error();
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
    t1: Player[],
    t2: Player[]
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
      if (
        ratingPlayers.length % 2 !== 0 ||
        ratingPlayers.length > 4
      ) {
        return null;
      }

      const half =
        ratingPlayers.length / 2;

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
 * Kies voor Intro meteen een geldige groep van 8 spelers.
 */
function selectIntroMatchPlayers(
  candidates: Player[],
  pairCounts: Map<string, number>,
  ppt: number
): Player[] | null {
  const byRating =
    new Map<number, Player[]>();

  candidates.forEach(p => {
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

  const compositions: number[][] = [];

  function buildComposition(
    index: number,
    remaining: number,
    row: number[]
  ) {
    if (
      index ===
      ratings.length
    ) {
      if (remaining === 0) {
        compositions.push(
          [...row]
        );
      }

      return;
    }

    for (
      let n = 0;
      n <=
      Math.min(
        2,
        remaining
      );
      n++
    ) {
      row.push(n);

      buildComposition(
        index + 1,
        remaining - n,
        row
      );

      row.pop();
    }
  }

  buildComposition(
    0,
    ppt,
    []
  );

  compositions.sort(
    (a, b) => {
      const score = (
        composition: number[]
      ) =>
        composition.reduce(
          (
            sum,
            pairCount,
            i
          ) => {
            const availablePairs =
              Math.floor(
                byRating
                  .get(
                    ratings[i]
                  )!
                  .length / 2
              );

            return (
              sum +
              Math.abs(
                pairCount -
                availablePairs / 4
              )
            );
          },
          0
        );

      return (
        score(a) -
        score(b) ||
        Math.random() - 0.5
      );
    }
  );

  for (
    const composition
    of compositions
  ) {
    const selected: Player[] =
      [];

    let valid = true;

    for (
      let i = 0;
      i < ratings.length;
      i++
    ) {
      const pairCount =
        composition[i];

      if (
        pairCount === 0
      ) {
        continue;
      }

      const pool =
        byRating.get(
          ratings[i]
        )!;

      if (
        pool.length <
        pairCount * 2
      ) {
        valid = false;
        break;
      }

      const available =
        [...pool].sort(
          (a, b) => {
            const aPlayed =
              (a as any)
                .__introPlayedCount ||
              0;

            const bPlayed =
              (b as any)
                .__introPlayedCount ||
              0;

            return (
              aPlayed -
              bPlayed ||
              Math.random() -
              0.5
            );
          }
        );

      const chosenPlayers =
        available.slice(
          0,
          pairCount * 2
        );

      const remaining =
        [...chosenPlayers];

      const pairs: Player[] =
        [];

      while (
        remaining.length >
        0
      ) {
        const first =
          remaining.shift()!;

        let bestIndex = -1;
        let bestScore =
          Infinity;

        for (
          let j = 0;
          j < remaining.length;
          j++
        ) {
          const second =
            remaining[j];

          const key = [
            first.id,
            second.id
          ]
            .sort()
            .join('-');

          const score =
            pairCounts.get(
              key
            ) || 0;

          if (
            score <
              bestScore ||
            (
              score ===
                bestScore &&
              Math.random() <
                0.5
            )
          ) {
            bestScore =
              score;

            bestIndex =
              j;
          }
        }

        if (
          bestIndex < 0
        ) {
          valid = false;
          break;
        }

        pairs.push(
          first,
          remaining.splice(
            bestIndex,
            1
          )[0]
        );
      }

      if (!valid) {
        break;
      }

      selected.push(
        ...pairs
      );
    }

    if (
      valid &&
      selected.length ===
        ppt * 2
    ) {
      return selected;
    }
  }

  return null;
}

async function generateSingleVersion(
  allPlayers: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  manualTimes: {
    start: string,
    end: string
  }[],
  minRating: number,
  isIntro: boolean,
  introPoolCount: number,
  onProgress?: (
    msg: string
  ) => void
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
    new Map<
      string,
      number
    >();

  const reservePoolCounts =
    new Map<
      number,
      number
    >();

  const reservePlayerCounts =
    new Map<
      number,
      number
    >();

  const rounds:
    NKRound[] = [];

  const playedCountsHistory:
    Map<number, number>[] =
    [
      new Map(
        playedCount
      )
    ];

  const roundAttempts =
    new Array(
      totalRounds + 1
    ).fill(0);

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
              p.rating ===
              rating
          ).length;

        if (
          (poolCount * mpp) %
            2 !==
          0
        ) {
          throw new Error(
            `Niet haalbaar met ${introPoolCount} ratingpoules: rating ${rating} kan niet gelijk over beide teams worden verdeeld bij ${mpp} wedstrijden per persoon.`
          );
        }
      }
    );
  }

  let rIdx = 1;

  const maxGlobalTime =
    Date.now() + 5000;

  onProgress?.(
    `Generator start: ${allPlayers.length} spelers, ${mpp} wedstrijden p.p., ${hallNames.length} zalen, ${introPoolCount} ratingpoules.`
  );

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

    for (
      let attempt = 0;
      attempt < 100;
      attempt++
    ) {
      if (
        attempt % 5 ===
        0
      ) {
        await delay(0);
      }

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
            pool.length /
            ppm
          )
        );

      try {
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
                              .join(
                                '-'
                              )
                          ) ||
                          0
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
                              .join(
                                '-'
                              )
                          ) ||
                          0
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
            throw new Error();
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
            throw new Error();
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
            !isIntro &&
            diff > 0.301
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

            subLow:
              null as any,

            subHigh:
              null as any,

            referee:
              null as any
          });
        }

        // --- VERBETERDE VERDELING RESERVES EN SCHEIDS ---

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
              resting.length >
              0
            ) {
              m.subLow =
                resting.shift()!;
            }
          }

          for (
            let m of matches
          ) {
            if (
              resting.length >
              0
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
              resting.length >
              0
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
              resting.length >
              0
            ) {
              m.referee =
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

      } catch (e) {
        if (
          isIntro &&
          (
            attempt === 0 ||
            attempt === 9 ||
            attempt === 24 ||
            attempt === 49 ||
            attempt === 99
          )
        ) {
          const reason =
            e instanceof Error
              ? e.message
              : String(e);

          onProgress?.(
            `Intro ronde ${rIdx}, poging ${attempt + 1}/100 mislukt: ${reason || 'onbekende reden'}`
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
            p =>
              nextCounts.set(
                p.id,
                nextCounts.get(
                  p.id
                )! + 1
              )
          );

          for (
            let i = 0;
            i <
            allInMatch.length;
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

      onProgress?.(
        `Intro ronde ${rIdx}/${totalRounds} gelukt.`
      );

      rIdx++;

    } else {
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
        onProgress?.(
          `Intro: terugstap bij ronde ${rIdx}. Na 15 pogingen geen geldige vervolgstap.`
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
    return null;
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
    start: string,
    end: string
  }[],
  minTeamRating: number,
  isIntro: boolean,
  introPoolCount: number
): Promise<NKSession> {

  const validVersions:
    NKSession[] = [];

  let totalAttempts = 0;

  if (isIntro) {
    onProgress(
      `Intro-diagnose gestart. Ik test nu één complete versie; de app blijft tussendoor reageren.`
    );
  }

  const maxVersions =
    isIntro
      ? 1
      : 300;

  const maxAttempts =
    isIntro
      ? 1
      : 3500;

  while (
    validVersions.length <
      maxVersions &&
    totalAttempts <
      maxAttempts
  ) {
    totalAttempts++;

    if (
      totalAttempts % 10 ===
      0
    ) {
      onProgress(
        `Optimaliseren: versie ${validVersions.length}/${maxVersions} gevonden...`
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
    validVersions.length ===
    0
  ) {
    throw new Error(
      "Geen schema gevonden. De laatste diagnose staat in beeld bij de generator."
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

  const getSocialScore = (
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
          v > maxRepeats
        ) {
          maxRepeats =
            v;
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

  let candidates:
    NKSession[];

  if (isIntro) {
    // Intro krijgt hier GEEN 0.305-filter.
    candidates =
      [
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

  return candidates.reduce(
    (
      best,
      cur
    ) =>
      getSocialScore(
        cur
      ) <
      getSocialScore(
        best
      )
        ? cur
        : best
  );
}
