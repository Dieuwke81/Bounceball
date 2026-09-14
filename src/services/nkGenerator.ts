import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getRequiredIntroRatings(poolCount: number): number[] {
  if (poolCount === 2) return [5, 10];
  if (poolCount === 3) return [5, 7.5, 10];
  if (poolCount === 4) return [2.5, 5, 7.5, 10];
  throw new Error("Aantal ratingpoules moet 2, 3 of 4 zijn.");
}

/**
 * Normale NK-teamverdeler.
 *
 * Intro wordt hieronder apart afgehandeld, omdat daar de ratingverdeling
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
      // Een rating moet altijd gelijk over beide teams verdeeld kunnen worden.
      if (ratingPlayers.length % 2 !== 0) return null;

      // Maximaal 2 spelers van dezelfde rating per team.
      if (ratingPlayers.length > 4) return null;

      const half = ratingPlayers.length / 2;

      if (half > 2) return null;

      // Willekeurig verdelen binnen dezelfde rating.
      const shuffled = [...ratingPlayers].sort(() => Math.random() - 0.5);

      team1.push(...shuffled.slice(0, half));
      team2.push(...shuffled.slice(half));
    }

    if (team1.length !== ppt || team2.length !== ppt) {
      return null;
    }

    // Bij Intro zijn de teams per definitie exact gespiegeld.
    return {
      t1: team1,
      t2: team2
    };
  }

  // -----------------------------
  // NORMAAL NK
  // -----------------------------

  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

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
 * Een rating-compositie voor één Intro-wedstrijd.
 *
 * De wedstrijd bestaat uit `ppt` rating-paren.
 *
 * Voor 4 tegen 4 zijn er dus 4 paren:
 *
 *   [5, 5, 7.5, 10]
 *
 * betekent:
 *
 *   2 spelers rating 5
 *   2 spelers rating 7.5
 *   2 spelers rating 10
 *
 * Iedere rating komt daardoor even vaak voor en wordt 50/50 over
 * de twee teams verdeeld.
 *
 * Een rating mag maximaal twee paren hebben, want anders zouden
 * er meer dan twee spelers van dezelfde rating in één team komen.
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
    if (current.length === ppt) {
      result.push([...current]);
      return;
    }

    for (let i = startRating; i < ratings.length; i++) {
      const rating = ratings[i];
      const count = counts.get(rating) || 0;

      // Maximaal twee paren van dezelfde rating.
      if (count >= 2) continue;

      counts.set(rating, count + 1);
      current.push(rating);

      build(i, current, counts);

      current.pop();

      if (count === 0) {
        counts.delete(rating);
      } else {
        counts.set(rating, count);
      }
    }
  }

  build(0, [], new Map());

  return result;
}

/**
 * Bepaalt hoeveel spelers van iedere rating nog nodig zijn.
 */
function getRemainingRatingAppearances(
  allPlayers: Player[],
  playedCount: Map<number, number>,
  ratings: number[],
  mpp: number
): Map<number, number> {
  const result = new Map<number, number>();

  for (const rating of ratings) {
    let remaining = 0;

    for (const player of allPlayers) {
      if (player.rating !== rating) continue;

      const played = playedCount.get(player.id) || 0;
      remaining += Math.max(0, mpp - played);
    }

    result.set(rating, remaining);
  }

  return result;
}

/**
 * Controleert of een compositie haalbaar is met de nog beschikbare
 * spelers uit iedere ratingpool.
 */
function compositionIsPossible(
  composition: number[],
  remainingAppearances: Map<number, number>
): boolean {
  const needed = new Map<number, number>();

  for (const rating of composition) {
    needed.set(
      rating,
      (needed.get(rating) || 0) + 2
    );
  }

  for (const [rating, amount] of needed.entries()) {
    const available = remainingAppearances.get(rating) || 0;

    if (available < amount) {
      return false;
    }
  }

  return true;
}

/**
 * Score voor een compositie.
 *
 * We proberen de resterende speelbeurten zo eerlijk mogelijk over de
 * ratingpoules te verdelen. Daarnaast geven we wat willekeur mee zodat
 * meerdere gegenereerde versies niet steeds hetzelfde zijn.
 */
function getIntroCompositionScore(
  composition: number[],
  remainingAppearances: Map<number, number>,
  totalMatchesRemaining: number,
  ratings: number[]
): number {
  const needed = new Map<number, number>();

  for (const rating of composition) {
    needed.set(
      rating,
      (needed.get(rating) || 0) + 2
    );
  }

  let score = 0;

  for (const rating of ratings) {
    const remaining = remainingAppearances.get(rating) || 0;
    const use = needed.get(rating) || 0;

    if (remaining <= 0) {
      if (use > 0) {
        return Infinity;
      }

      continue;
    }

    /*
     * Verwachte verdeling:
     *
     * Als bijvoorbeeld 40% van alle resterende speelbeurten uit
     * een rating komt, willen we ongeveer 40% van de huidige
     * wedstrijdplaatsen uit die rating gebruiken.
     */
    const totalRemaining = ratings.reduce(
      (sum, r) => sum + (remainingAppearances.get(r) || 0),
      0
    );

    if (totalRemaining > 0) {
      const expected =
        (remaining / totalRemaining) * (totalMatchesRemaining * 2);

      score += Math.abs(use - expected);
    }
  }

  // Kleine willekeur voorkomt dat iedere versie exact hetzelfde wordt.
  score += Math.random() * 3;

  return score;
}

/**
 * Kies voor een hele ronde een ratingverdeling.
 *
 * Dit is de belangrijkste wijziging:
 *
 * We kiezen NIET eerst acht spelers.
 *
 * Eerst bepalen we voor iedere wedstrijd welke ratingparen nodig zijn.
 * Daarna worden de daadwerkelijke spelers gekozen.
 */
function selectIntroRoundCompositions(
  ratings: number[],
  matchesNeeded: number,
  ppt: number,
  remainingAppearances: Map<number, number>
): number[][] | null {
  const possible = getPossibleIntroCompositions(
    ratings,
    ppt
  );

  if (possible.length === 0) {
    return null;
  }

  /*
   * Eerst alle mogelijke composities sorteren op hoe goed ze passen
   * bij de huidige resterende ratingverdeling.
   */
  const scored = possible
    .filter(composition =>
      compositionIsPossible(
        composition,
        remainingAppearances
      )
    )
    .map(composition => ({
      composition,
      score: getIntroCompositionScore(
        composition,
        remainingAppearances,
        matchesNeeded,
        ratings
      )
    }))
    .sort((a, b) => a.score - b.score);

  if (scored.length === 0) {
    return null;
  }

  /*
   * We zoeken een combinatie van composities die samen de huidige
   * ronde kunnen vullen.
   *
   * Omdat er bij 4 tegen 4 maar vier ratingparen per wedstrijd zijn,
   * blijft deze zoekruimte klein.
   */
  const selected: number[][] = [];

  function search(
    matchIndex: number,
    remaining: Map<number, number>
  ): boolean {
    if (matchIndex === matchesNeeded) {
      return true;
    }

    /*
     * Probeer eerst de beste composities, maar shuffle composities
     * met vrijwel dezelfde score zodat versies kunnen verschillen.
     */
    const candidates = [...scored];

    candidates.sort((a, b) => {
      const diff = a.score - b.score;

      if (Math.abs(diff) < 2) {
        return Math.random() - 0.5;
      }

      return diff;
    });

    for (const candidate of candidates) {
      const composition = candidate.composition;

      const nextRemaining = new Map(remaining);

      let valid = true;

      for (const rating of composition) {
        const current =
          nextRemaining.get(rating) || 0;

        if (current < 2) {
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

      /*
       * Kijk vooruit of de resterende wedstrijden überhaupt nog
       * gevuld kunnen worden.
       */
      const remainingMatches =
        matchesNeeded - matchIndex - 1;

      let totalRemaining =
        0;

      nextRemaining.forEach(value => {
        totalRemaining += value;
      });

      if (totalRemaining < remainingMatches * ppt * 2) {
        continue;
      }

      selected.push(composition);

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
    new Map(remainingAppearances);

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
 * Kies daadwerkelijke spelers voor een bepaalde rating.
 *
 * Spelers met minder gespeelde wedstrijden krijgen voorrang.
 * Bij gelijke stand wordt willekeurig gekozen.
 *
 * Pair-counts worden meegenomen om herhaling van dezelfde spelers
 * zoveel mogelijk te beperken.
 */
function chooseIntroPlayersForRating(
  candidates: Player[],
  rating: number,
  amount: number,
  playedCount: Map<number, number>,
  pairCounts: Map<string, number>,
  alreadySelected: Player[]
): Player[] | null {
  const available = candidates.filter(
    p =>
      p.rating === rating &&
      !alreadySelected.some(
        selected => selected.id === p.id
      )
  );

  if (available.length < amount) {
    return null;
  }

  const shuffled = [...available].sort(
    () => Math.random() - 0.5
  );

  shuffled.sort((a, b) => {
    const playedA =
      playedCount.get(a.id) || 0;

    const playedB =
      playedCount.get(b.id) || 0;

    if (playedA !== playedB) {
      return playedA - playedB;
    }

    /*
     * Geef spelers die minder vaak met de al gekozen spelers
     * hebben gespeeld een kleine voorkeur.
     */
    const pairScoreA =
      alreadySelected.reduce(
        (sum, p) =>
          sum +
          (pairCounts.get(
            [p.id, a.id].sort().join('-')
          ) || 0),
        0
      );

    const pairScoreB =
      alreadySelected.reduce(
        (sum, p) =>
          sum +
          (pairCounts.get(
            [p.id, b.id].sort().join('-')
          ) || 0),
        0
      );

    return pairScoreA - pairScoreB;
  });

  return shuffled.slice(0, amount);
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

  const counts = new Map<number, number>();

  for (const rating of composition) {
    counts.set(
      rating,
      (counts.get(rating) || 0) + 2
    );
  }

  /*
   * Eerst ratings met de kleinste beschikbare pool verwerken.
   * Daarmee verkleinen we de kans dat een kleine pool later
   * niet meer genoeg spelers heeft.
   */
  const orderedRatings = [...counts.keys()].sort(
    (a, b) => {
      const aCount = candidates.filter(
        p =>
          p.rating === a &&
          !selected.some(
            s => s.id === p.id
          )
      ).length;

      const bCount = candidates.filter(
        p =>
          p.rating === b &&
          !selected.some(
            s => s.id === p.id
          )
      ).length;

      return aCount - bCount;
    }
  );

  for (const rating of orderedRatings) {
    const amount = counts.get(rating)!;

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

    selected.push(...players);
  }

  if (selected.length !== ppt * 2) {
    return null;
  }

  return selected;
}

/**
 * Willekeurige verdeling van rustende spelers over:
 *
 * - subLow
 * - subHigh
 * - referee
 *
 * Er wordt hier bewust GEEN ratingvoorwaarde gebruikt.
 */
function assignRandomReservesAndReferees(
  resting: Player[],
  matches: NKMatch[]
): Player[] {
  const available = [...resting].sort(
    () => Math.random() - 0.5
  );

  let index = 0;

  for (const match of matches) {
    if (index < available.length) {
      match.subLow = available[index++];
    }
  }

  for (const match of matches) {
    if (index < available.length) {
      match.subHigh = available[index++];
    }
  }

  for (const match of matches) {
    if (index < available.length) {
      match.referee = available[index++];
    }
  }

  return available.slice(index);
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

  const rounds: NKRound[] = [];

  const playedCountsHistory: Map<number, number>[] = [
    new Map(playedCount)
  ];

  const roundAttempts =
    new Array(totalRounds + 1).fill(0);

  /*
   * Intro krijgt meer tijd.
   *
   * Het oude algoritme moest binnen 5 seconden geluk hebben.
   * Bij deze compositie-aanpak is dat veel minder problematisch,
   * maar we geven hem nog steeds een duidelijke bovengrens.
   */
  const maxGlobalTime =
    Date.now() +
    (isIntro ? 30000 : 5000);

  /*
   * Intro-basiscontrole.
   */
  if (isIntro) {
    const requiredIntroRatings =
      getRequiredIntroRatings(
        introPoolCount
      );

    if (ppm % 2 !== 0) {
      throw new Error(
        "Intro vereist een even aantal spelers per wedstrijd."
      );
    }

    for (const rating of requiredIntroRatings) {
      const poolCount =
        allPlayers.filter(
          p => p.rating === rating
        ).length;

      /*
       * Iedere speler moet mpp wedstrijden spelen.
       * De totale hoeveelheid speelbeurten van een rating
       * moet even zijn, omdat iedere wedstrijd deze rating
       * alleen in paren kan gebruiken.
       */
      if ((poolCount * mpp) % 2 !== 0) {
        throw new Error(
          `Niet haalbaar met ${introPoolCount} ratingpoules: ` +
          `rating ${rating} kan niet gelijk over beide teams ` +
          `worden verdeeld bij ${mpp} wedstrijden per persoon.`
        );
      }
    }
  }

  let rIdx = 1;

  while (rIdx <= totalRounds) {
    if (Date.now() > maxGlobalTime) {
      return null;
    }

    const currentPlayedCount =
      playedCountsHistory[rIdx - 1];

    let success = false;

    let roundMatches: NKMatch[] = [];

    /*
     * We proberen een ronde meerdere keren.
     */
    for (
      let attempt = 0;
      attempt < 100;
      attempt++
    ) {
      if (Date.now() > maxGlobalTime) {
        return null;
      }

      const usedThisRound =
        new Set<number>();

      const matches: NKMatch[] = [];

      const target =
        isIntro ? 0 : 0.30;

      try {
        /*
         * ---------------------------------------------------------
         * INTRO
         * ---------------------------------------------------------
         */
        if (isIntro) {
          const ratings =
            getRequiredIntroRatings(
              introPoolCount
            );

          const candidates =
            allPlayers.filter(
              p =>
                (currentPlayedCount.get(p.id) || 0) <
                mpp
            );

          /*
           * Hoeveel wedstrijden kunnen we deze ronde maken?
           */
          const mInRound =
            Math.min(
              hallNames.length,
              Math.floor(
                candidates.length / ppm
              )
            );

          if (mInRound <= 0) {
            throw new Error();
          }

          /*
           * Bepaal eerst hoeveel speelbeurten iedere ratingpool
           * nog nodig heeft.
           */
          const remainingAppearances =
            getRemainingRatingAppearances(
              allPlayers,
              currentPlayedCount,
              ratings,
              mpp
            );

          /*
           * Bepaal vervolgens de ratingcompositie van ALLE
           * wedstrijden in deze ronde.
           */
          const compositions =
            selectIntroRoundCompositions(
              ratings,
              mInRound,
              ppt,
              remainingAppearances
            );

          if (!compositions) {
            throw new Error();
          }

          /*
           * Nu pas kiezen we de daadwerkelijke spelers.
           */
          for (
            let h = 0;
            h < mInRound;
            h++
          ) {
            const available =
              allPlayers.filter(
                p =>
                  (currentPlayedCount.get(p.id) || 0) <
                    mpp &&
                  !usedThisRound.has(p.id)
              );

            if (available.length < ppm) {
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

            if (!mPlayers) {
              throw new Error();
            }

            /*
             * Dit is nu alleen nog een controle.
             * De compositie garandeert al dat dit klopt.
             */
            const split =
              getBestTeamSplit(
                mPlayers,
                ppt,
                target,
                minRating,
                true
              );

            if (!split) {
              throw new Error();
            }

            const avg1 =
              split.t1.reduce(
                (s, p) => s + p.rating,
                0
              ) / ppt;

            const avg2 =
              split.t2.reduce(
                (s, p) => s + p.rating,
                0
              ) / ppt;

            const diff =
              Math.abs(avg1 - avg2);

            /*
             * Bij Intro moet dit exact 0 zijn.
             */
            if (diff > 0.00001) {
              throw new Error();
            }

            mPlayers.forEach(
              p => usedThisRound.add(p.id)
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
        }

        /*
         * ---------------------------------------------------------
         * NORMAAL NK
         * ---------------------------------------------------------
         *
         * Deze logica blijft grotendeels zoals voorheen.
         */
        else {
          let pool =
            [...allPlayers]
              .filter(
                p =>
                  (currentPlayedCount.get(p.id) || 0) <
                  mpp
              )
              .sort(
                (a, b) =>
                  (
                    mpp -
                    (currentPlayedCount.get(a.id) || 0)
                  ) -
                  (
                    mpp -
                    (currentPlayedCount.get(b.id) || 0)
                  ) ||
                  Math.random() - 0.5
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
                p => !usedThisRound.has(p.id)
              );

            if (candidates.length < ppm) {
              break;
            }

            const selectedForMatch: Player[] = [];

            selectedForMatch.push(
              candidates[0]
            );

            while (
              selectedForMatch.length < ppm
            ) {
              const remaining =
                candidates.filter(
                  c =>
                    !selectedForMatch.includes(c)
                );

              remaining.sort(
                (a, b) => {
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
                    scoreA -
                    scoreB
                  ) ||
                  Math.random() - 0.5;
                }
              );

              if (remaining.length === 0) {
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

            if (diff > 0.301) {
              throw new Error();
            }

            selectedForMatch.forEach(
              p =>
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
        }

        /*
         * ---------------------------------------------------------
         * WISSELS + SCHEIDSRECHTERS
         * ---------------------------------------------------------
         *
         * Bewust volledig losgekoppeld van ratingpoules.
         */
        const resting =
          allPlayers.filter(
            p => !usedThisRound.has(p.id)
          );

        assignRandomReservesAndReferees(
          resting,
          matches
        );

        /*
         * Er moet minimaal één wedstrijd zijn gemaakt.
         */
        if (matches.length === 0) {
          throw new Error();
        }

        roundMatches = matches;

        success = true;

        break;
      } catch (e) {
        /*
         * Deze poging is mislukt.
         * We proberen dezelfde ronde opnieuw.
         */
      }

      /*
       * Laat de browser tussendoor ademen.
       */
      await delay(0);
    }

    /*
     * -----------------------------------------------------------
     * RONDE GELUKT
     * -----------------------------------------------------------
     */
    if (success) {
      const time =
        manualTimes[rIdx - 1] ||
        {
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
           * Wedstrijdteller.
           */
          allInMatch.forEach(
            p => {
              nextCounts.set(
                p.id,
                (
                  nextCounts.get(p.id) || 0
                ) + 1
              );
            }
          );

          /*
           * Bijhouden hoe vaak spelers al samen in
           * een wedstrijd hebben gezeten.
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
                  pairCounts.get(key) || 0
                ) + 1
              );
            }
          }
        }
      );

      playedCountsHistory[rIdx] =
        nextCounts;

      rIdx++;

      /*
       * UI een kans geven om te updaten.
       */
      await delay(0);
    }

    /*
     * -----------------------------------------------------------
     * RONDE MISLUKT → TERUG NAAR VORIGE RONDE
     * -----------------------------------------------------------
     */
    else {
      if (rIdx === 1) {
        return null;
      }

      rounds.pop();

      rIdx--;

      roundAttempts[rIdx]++;

      if (roundAttempts[rIdx] > 15) {
        return null;
      }
    }
  }

  /*
   * -------------------------------------------------------------
   * EINDE CONTROLE
   * -------------------------------------------------------------
   */

  const lastCounts =
    playedCountsHistory[
      playedCountsHistory.length - 1
    ];

  /*
   * Iedere speler moet exact mpp wedstrijden hebben gespeeld.
   */
  if (
    !allPlayers.every(
      p =>
        lastCounts.get(p.id) === mpp
    )
  ) {
    return null;
  }

  /*
   * Extra Intro-controle:
   *
   * Iedere wedstrijd moet exact gespiegeld zijn.
   */
  if (isIntro) {
    for (const round of rounds) {
      for (const match of round.matches) {
        const team1Ratings =
          new Map<number, number>();

        const team2Ratings =
          new Map<number, number>();

        match.team1.forEach(
          p =>
            team1Ratings.set(
              p.rating,
              (
                team1Ratings.get(p.rating) ||
                0
              ) + 1
            )
        );

        match.team2.forEach(
          p =>
            team2Ratings.set(
              p.rating,
              (
                team2Ratings.get(p.rating) ||
                0
              ) + 1
            )
        );

        const ratings =
          new Set([
            ...team1Ratings.keys(),
            ...team2Ratings.keys()
          ]);

        for (const rating of ratings) {
          if (
            (
              team1Ratings.get(rating) ||
              0
            ) !==
            (
              team2Ratings.get(rating) ||
              0
            )
          ) {
            return null;
          }

          if (
            (
              team1Ratings.get(rating) ||
              0
            ) > 2
          ) {
            return null;
          }

          if (
            (
              team2Ratings.get(rating) ||
              0
            ) > 2
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
    playersPerTeam: ppt,
    totalRounds: rounds.length,
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
  manualTimes: { start: string, end: string }[],
  minTeamRating: number,
  isIntro: boolean,
  introPoolCount: number
): Promise<NKSession> {
  const validVersions: NKSession[] = [];

  let totalAttempts = 0;

  /*
   * Voor Intro hoeven we niet 300 versies te maken.
   *
   * Eén goede compositie-gebaseerde versie is al veel betrouwbaarder
   * dan honderden oude willekeurige versies.
   *
   * Voor normaal NK behouden we de oude 300-versies aanpak.
   */
  const targetVersions =
    isIntro ? 30 : 300;

  const maxAttempts =
    isIntro ? 500 : 3500;

  while (
    validVersions.length < targetVersions &&
    totalAttempts < maxAttempts
  ) {
    totalAttempts++;

    if (
      totalAttempts % 5 === 0
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
      validVersions.push(session);
    }
  }

  if (validVersions.length === 0) {
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
   * Maximaal ratingverschil per sessie.
   */
  const getMaxDiff =
    (s: NKSession): number => {
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

              if (diff > max) {
                max = diff;
              }
            }
          )
      );

      return max;
    };

  /*
   * Sociale score:
   *
   * - zo weinig mogelijk herhaling;
   * - zo veel mogelijk verschillende tegenstanders/teamgenoten;
   * - zware straf voor extreem veel herhaling.
   */
  const getSocialScore =
    (s: NKSession): number => {
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
                      pairs.get(key) ||
                      0
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

      /*
       * Straf voor spelers die helemaal nooit samen in een
       * wedstrijd hebben gezeten.
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

          if (!pairs.has(key)) {
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

  /*
   * -------------------------------------------------------------
   * KANDIDATEN
   * -------------------------------------------------------------
   *
   * Intro:
   *   Alle geldige Intro-versies zijn kandidaten.
   *
   * Normaal NK:
   *   Bestaande maximale ratingbalans van 0.305 behouden.
   */
  let candidates: NKSession[];

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

  /*
   * Beste sociale verdeling kiezen.
   */
  return candidates.reduce(
    (best, cur) =>
      getSocialScore(cur) <
      getSocialScore(best)
        ? cur
        : best
  );
}
