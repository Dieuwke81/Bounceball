import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Maakt de teams voor één wedstrijd.
 *
 * INTRO:
 * - Team 1 en Team 2 moeten exact dezelfde ratingverdeling hebben.
 * - Maximaal 2 spelers van dezelfde ratingpoule per team.
 * - Ratingverschil is daardoor altijd 0.
 *
 * NORMAAL NK:
 * - Bestaande werking behouden.
 * - Teams moeten minimaal minRating hebben.
 * - Maximaal 1 keeper per team.
 * - targetDiff wordt gebruikt voor de normale balans.
 */
function getBestTeamSplit(
  players: Player[],
  ppt: number,
  targetDiff: number,
  minRating: number,
  isIntro: boolean
) {
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

      const k1 =
        team1.filter(p => p.isKeeper).length;

      const k2 =
        team2.filter(p => p.isKeeper).length;

      const keepersOk = isIntro
        ? true
        : (k1 <= 1 && k2 <= 1);

      if (!keepersOk) return;

      // =================================================
      // INTRO
      // =================================================
      //
      // Team 1 en Team 2 moeten exact dezelfde
      // ratingverdeling hebben.
      //
      // Voorbeeld:
      //
      // Team 1: 5 - 7.5 - 10 - 10
      // Team 2: 5 - 7.5 - 10 - 10
      //
      // Maximaal 2 van dezelfde rating per team.
      // =================================================

      if (isIntro) {

        const ratingCounts1 =
          new Map<number, number>();

        const ratingCounts2 =
          new Map<number, number>();

        for (const p of team1) {
          ratingCounts1.set(
            p.rating,
            (ratingCounts1.get(p.rating) || 0) + 1
          );
        }

        for (const p of team2) {
          ratingCounts2.set(
            p.rating,
            (ratingCounts2.get(p.rating) || 0) + 1
          );
        }

        const ratings = new Set<number>([
          ...ratingCounts1.keys(),
          ...ratingCounts2.keys()
        ]);

        for (const rating of ratings) {

          const count1 =
            ratingCounts1.get(rating) || 0;

          const count2 =
            ratingCounts2.get(rating) || 0;

          // Exact dezelfde ratingverdeling.
          if (count1 !== count2) {
            return;
          }

          // Maximaal 2 spelers van dezelfde
          // ratingpoule in één team.
          if (count1 > 2 || count2 > 2) {
            return;
          }
        }

        // Exact gespiegeld = verschil 0.
        bestDiff = 0;

        bestSplit = {
          t1: [...team1],
          t2: [...team2]
        };

        return;
      }

      // =================================================
      // NORMAAL NK
      // =================================================

      if (
        avg1 >= minRating &&
        avg2 >= minRating
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

      // Intro:
      // zodra we een perfecte spiegeling hebben,
      // hoeven we niet verder te zoeken.
      if (
        isIntro &&
        bestDiff === 0
      ) {
        return;
      }

      // Normaal NK:
      // stoppen als targetDiff al gehaald is.
      if (
        !isIntro &&
        bestDiff <= targetDiff
      ) {
        return;
      }
    }
  }

  combine(0, []);

  if (isIntro) {
    return bestDiff === 0
      ? bestSplit
      : null;
  }

  return bestSplit;
}


/**
 * Genereert één volledige versie van het schema.
 */
async function generateSingleVersion(
  allPlayers: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  manualTimes: { start: string, end: string }[],
  minRating: number,
  isIntro: boolean
): Promise<NKSession | null> {

  const ppm = ppt * 2;

  const totalRounds = Math.ceil(
    (allPlayers.length * mpp / ppm) /
    hallNames.length
  );

  const playedCount =
    new Map(
      allPlayers.map(p => [p.id, 0])
    );

  const pairCounts =
    new Map<string, number>();

  const rounds: NKRound[] = [];

  const playedCountsHistory:
    Map<number, number>[] = [
      new Map(playedCount)
    ];

  const roundAttempts =
    new Array(totalRounds + 1).fill(0);

  let rIdx = 1;

  const maxGlobalTime =
    Date.now() + 5000;


  while (rIdx <= totalRounds) {

    if (Date.now() > maxGlobalTime) {
      return null;
    }

    const currentPlayedCount =
      playedCountsHistory[rIdx - 1];

    let success = false;

    let roundMatches: NKMatch[] = [];


    // =================================================
    // PROBEER DEZE RONDE MAXIMAAL 100 KEER
    // =================================================

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


      // Spelers die nog wedstrijden nodig hebben.
      let pool = [...allPlayers]
        .filter(
          p =>
            currentPlayedCount.get(p.id)! < mpp
        )
        .sort(
          (a, b) =>
            (
              mpp -
              currentPlayedCount.get(a.id)!
            ) -
            (
              mpp -
              currentPlayedCount.get(b.id)!
            ) ||
            Math.random() - 0.5
        )
        .reverse();


      const mInRound =
        Math.min(
          hallNames.length,
          Math.floor(pool.length / ppm)
        );


      try {

        // =================================================
        // WEDSTRIJDEN MAKEN
        // =================================================

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


          const selectedForMatch:
            Player[] = [];


          // Eerste speler willekeurig uit
          // de beste kandidaten.
          selectedForMatch.push(
            candidates[0]
          );


          // Rest van de spelers zoeken.
          while (
            selectedForMatch.length < ppm
          ) {

            const remaining =
              candidates.filter(
                c =>
                  !selectedForMatch.includes(c)
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
                scoreA -
                scoreB ||
                Math.random() - 0.5
              );
            });


            selectedForMatch.push(
              remaining[0]
            );
          }


          const mPlayers =
            selectedForMatch;


          // =================================================
          // TEAMS VERDELEN
          // =================================================

          const split =
            getBestTeamSplit(
              mPlayers,
              ppt,
              target,
              minRating,
              isIntro
            );


          if (!split) {
            throw new Error();
          }


          const diff =
            Math.abs(
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


          // Normaal NK:
          // harde grens 0.30.
          if (
            !isIntro &&
            diff > 0.301
          ) {
            throw new Error();
          }


          // Deze spelers zijn deze ronde gebruikt.
          mPlayers.forEach(p =>
            usedThisRound.add(p.id)
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

            subLow: null as any,
            subHigh: null as any,
            referee: null as any
          });
        }


        // =================================================
        // WISSELS EN SCHEIDSRECHTERS
        // =================================================
        //
        // HIER DOEN WE VOORLOPIG GEEN RATINGCONTROLE.
        //
        // Iedereen die niet speelt is gewoon beschikbaar.
        // We schudden ze willekeurig door elkaar.
        // =================================================

        const resting = allPlayers
          .filter(
            p => !usedThisRound.has(p.id)
          )
          .sort(
            () => Math.random() - 0.5
          );


        let restingIndex = 0;


        // Eerst alle subLow.
        for (
          const m of matches
        ) {

          if (
            restingIndex <
            resting.length
          ) {

            m.subLow =
              resting[restingIndex];

            restingIndex++;
          }
        }


        // Daarna alle subHigh.
        for (
          const m of matches
        ) {

          if (
            restingIndex <
            resting.length
          ) {

            m.subHigh =
              resting[restingIndex];

            restingIndex++;
          }
        }


        // Daarna scheidsrechters.
        for (
          const m of matches
        ) {

          if (
            restingIndex <
            resting.length
          ) {

            m.referee =
              resting[restingIndex];

            restingIndex++;
          }
        }


        roundMatches =
          matches;

        success = true;

        break;


      } catch (e) {

        // Deze poging is mislukt.
        // Probeer de ronde opnieuw.
      }


      // UI de kans geven om te reageren.
      if (attempt % 5 === 0) {
        await delay(0);
      }
    }


    // =================================================
    // RONDE GELUKT
    // =================================================

    if (success) {

      const time =
        manualTimes[rIdx - 1] || {
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


      // Wedstrijden verwerken.
      roundMatches.forEach(m => {

        const allInMatch = [
          ...m.team1,
          ...m.team2
        ];


        // Aantal wedstrijden per speler.
        allInMatch.forEach(p => {

          nextCounts.set(
            p.id,
            nextCounts.get(p.id)! + 1
          );
        });


        // Combinaties bijhouden.
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
              (
                pairCounts.get(key) || 0
              ) + 1
            );
          }
        }
      });


      playedCountsHistory[rIdx] =
        nextCounts;

      rIdx++;


    } else {

      // =================================================
      // RONDE MISLUKT
      // =================================================

      if (rIdx === 1) {
        return null;
      }


      rounds.pop();

      rIdx--;

      roundAttempts[rIdx]++;


      if (
        roundAttempts[rIdx] > 15
      ) {
        return null;
      }
    }
  }


  // =================================================
  // EINDCONTROLE
  // =================================================

  const lastCounts =
    playedCountsHistory[
      playedCountsHistory.length - 1
    ];


  // Iedereen moet exact mpp wedstrijden hebben.
  if (
    !allPlayers.every(
      p =>
        lastCounts.get(p.id) === mpp
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

    isCompleted: false
  };
}


/**
 * Hoofdfunctie voor het genereren van het schema.
 */
export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  mpp: number,
  ppt: number,
  competitionName: string,
  onProgress: (msg: string) => void,
  manualTimes: {
    start: string,
    end: string
  }[],
  minTeamRating: number,
  isIntro: boolean
): Promise<NKSession> {

  const validVersions:
    NKSession[] = [];

  let totalAttempts = 0;


  // =================================================
  // VERSIES GENEREREN
  // =================================================

  while (
    validVersions.length < 300 &&
    totalAttempts < 3500
  ) {

    totalAttempts++;


    if (
      totalAttempts % 10 === 0
    ) {

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
        isIntro
      );


    if (session) {
      validVersions.push(session);
    }
  }


  if (
    validVersions.length === 0
  ) {

    throw new Error(
      isIntro
        ? "Geen schema gevonden. De teams konden niet overal exact gespiegeld worden."
        : "Geen schema gevonden die voldoet aan de eisen (max 0.30 diff)."
    );
  }


  // =================================================
  // MAXIMAAL RATINGVERSCHIL BEREKENEN
  // =================================================

  const getMaxDiff = (
    s: NKSession
  ): number => {

    let max = 0;


    s.rounds.forEach(r =>
      r.matches.forEach(m => {

        const avg1 =
          m.team1.reduce(
            (acc, p) =>
              acc + p.rating,
            0
          ) / m.team1.length;


        const avg2 =
          m.team2.reduce(
            (acc, p) =>
              acc + p.rating,
            0
          ) / m.team2.length;


        const diff =
          Math.abs(
            avg1 - avg2
          );


        if (diff > max) {
          max = diff;
        }
      })
    );


    return max;
  };


  // =================================================
  // SOCIALE VERDELING
  // =================================================

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
              (
                pairs.get(key) || 0
              ) + 1
            );
          }
        }
      })
    );


    let score = 0;

    let maxRepeats = 0;


    pairs.forEach(v => {

      score +=
        Math.pow(v, 6);


      if (
        v > maxRepeats
      ) {
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

        const key = [
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
      (missing * 500) +
      (maxRepeats * 10000)
    );
  };


  // =================================================
  // KANDIDATEN SELECTEREN
  // =================================================

  const balanceThreshold =
    0.305;

  let candidates:
    NKSession[];


  if (isIntro) {

    // Intro:
    // iedere geldige versie heeft al exact
    // gespiegeld opgebouwde teams.
    candidates =
      [...validVersions];

  } else {

    // Normaal NK:
    // maximaal 0.30 verschil.

    candidates =
      validVersions.filter(
        v =>
          getMaxDiff(v) <=
          balanceThreshold
      );


    // Bestaande fallback voor normaal NK.
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


  // =================================================
  // BESTE SOCIALE VERDELING KIEZEN
  // =================================================

  return candidates.reduce(
    (best, cur) =>
      getSocialScore(cur) <
      getSocialScore(best)
        ? cur
        : best
  );
}
