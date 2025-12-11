/**  MANUAL ENTRY - COMPLETE REWRITE WITH MATCH LAYOUT LIKE MAIN SCREEN  */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Player, Goal, Match, MatchResult } from '../types';
import EditIcon from './icons/EditIcon';

interface ManualEntryProps {
  allPlayers: Player[];
  onSave: (data: {
    date: string;
    teams: Player[][];
    round1Results: MatchResult[];
    round2Results: MatchResult[];
  }) => void;
  isLoading: boolean;
}

const normalize = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const UNSAVED_MANUAL_KEY = 'bounceball_unsaved_manual_entry';

// zelfde helper als in TeamDisplay: even = blauw, oneven = geel
const getBaseColor = (index: number) => (index % 2 === 0 ? 'blue' : 'yellow');

// ============================================================================
// SCORE INPUT
// ============================================================================

const ScoreInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => setLocalValue(value.toString()), [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) setLocalValue(val);
  };

  const handleBlur = () => {
    let num = parseInt(localValue, 10);
    if (isNaN(num)) num = 0;
    if (num !== value) onChange(num);
    setLocalValue(num.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder="0"
    />
  );
};

// ============================================================================
// HELPERS
// ============================================================================

const generatePairingsWithoutRematches = (
  sortedTeams: { teamIndex: number }[],
  r1Matches: Match[]
) => {
  const pairings: Match[] = [];
  const available = [...sortedTeams];
  const r1Opponents = new Map<number, number>();

  r1Matches.forEach((m) => {
    r1Opponents.set(m.team1Index, m.team2Index);
    r1Opponents.set(m.team2Index, m.team1Index);
  });

  while (available.length) {
    const team1 = available.shift();
    if (!team1) break;

    let foundOpponent = available.find(
      (t) => r1Opponents.get(team1.teamIndex) !== t.teamIndex
    );

    if (!foundOpponent) foundOpponent = available.shift();
    else available.splice(available.indexOf(foundOpponent), 1);

    if (foundOpponent) {
      pairings.push({
        team1Index: team1.teamIndex,
        team2Index: foundOpponent.teamIndex,
      });
    }
  }
  return pairings;
};

const PlayerChip = ({ player }: { player: Player }) => (
  <div className="bg-green-800/50 text-green-200 px-2 py-1 rounded">
    {player.name}
  </div>
);

const UnmatchedChip = ({ name }: { name: string }) => (
  <div className="bg-red-800/50 text-red-200 px-2 py-1 rounded">{name}</div>
);

// ============================================================================
// MATCH INPUT – ZELFDE LAYOUT ALS UITSLAGEN RONDE 1
// ============================================================================

const MatchInput = ({
  match,
  matchIndex,
  teams,
  onGoalChange,
  goalScorers,
}: {
  match: Match;
  matchIndex: number;
  teams: Player[][];
  onGoalChange: (
    matchIndex: number,
    team: 'team1' | 'team2',
    playerId: number,
    count: number
  ) => void;
  goalScorers: { [key: string]: Goal[] };
}) => {
  // 1. Teams ophalen
  const team1Data = teams[match.team1Index] || [];
  const team2Data = teams[match.team2Index] || [];

  // 2. Basis kleuren
  const color1 = getBaseColor(match.team1Index);
  const color2 = getBaseColor(match.team2Index);

  // 3. Wie staat links/rechts? (links = blauw, rechts = geel)
  let blueTeam: Player[] = team1Data;
  let yellowTeam: Player[] = team2Data;
  let blueIdentifier: 'team1' | 'team2' = 'team1';
  let yellowIdentifier: 'team1' | 'team2' = 'team2';
  let blueTeamIndex = match.team1Index;
  let yellowTeamIndex = match.team2Index;

  if (color1 === 'yellow' && color2 === 'blue') {
    blueTeam = team2Data;
    blueIdentifier = 'team2';
    blueTeamIndex = match.team2Index;

    yellowTeam = team1Data;
    yellowIdentifier = 'team1';
    yellowTeamIndex = match.team1Index;
  }

  const leftColorClass = 'text-cyan-300';
  const rightColorClass = 'text-amber-300';
  const leftBorderClass = 'border-cyan-500/30';
  const rightBorderClass = 'border-amber-500/30';

  // 4. Scores per team (incl. eigen goals van tegenstander)
  const getTeamScore = (identifier: 'team1' | 'team2') => {
    const goals = goalScorers[`${matchIndex}-${identifier}`] || [];
    return goals.reduce((sum, g) => sum + g.count, 0);
  };

  const getPlayerGoalsForTeam = (
    identifier: 'team1' | 'team2',
    playerId: number
  ) => {
    const goals = goalScorers[`${matchIndex}-${identifier}`] || [];
    return goals.find((g) => g.playerId === playerId)?.count || 0;
  };

  const PlayerGoalInput: React.FC<{
    player: Player;
    teamIdentifier: 'team1' | 'team2';
    opponentIdentifier: 'team1' | 'team2';
  }> = ({ player, teamIdentifier, opponentIdentifier }) => {
    const goalCount = getPlayerGoalsForTeam(teamIdentifier, player.id);
    const ownGoalCount = getPlayerGoalsForTeam(opponentIdentifier, player.id);

    const handleGoalsChange = (newVal: number) => {
      onGoalChange(matchIndex, teamIdentifier, player.id, newVal);
    };

    const handleOwnGoalsChange = (newVal: number) => {
      // eigen goal telt in de score van de tegenstander
      onGoalChange(matchIndex, opponentIdentifier, player.id, newVal);
    };

    return (
      <div className="flex items-center bg-gray-600/50 p-2 rounded hover:bg-gray-600 transition-colors">
        {/* Naam */}
        <span className="text-gray-200 flex-1 pr-1 text-xs sm:text-base break-words leading-tight">
          {player.name}
        </span>

        {/* Vakjes G / EG */}
        <div className="flex justify-between items-center w-[4.5rem]">
          <ScoreInput
            value={goalCount}
            onChange={handleGoalsChange}
            className="w-9 bg-gray-700 border border-gray-500 rounded-md py-1 px-1 text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
          <ScoreInput
            value={ownGoalCount}
            onChange={handleOwnGoalsChange}
            className="w-5 h-5 bg-gray-700 border border-red-500/70 rounded-md p-0.5 text-white text-center focus:outline-none focus:ring-1 focus:ring-red-500 text-[9px]"
          />
        </div>
      </div>
    );
  };

  const blueOpponentIdentifier: 'team1' | 'team2' =
    blueIdentifier === 'team1' ? 'team2' : 'team1';
  const yellowOpponentIdentifier: 'team1' | 'team2' =
    yellowIdentifier === 'team1' ? 'team2' : 'team1';

  return (
    <div className="bg-gray-700 rounded-lg p-4 shadow-md">
      <div className="grid grid-cols-2 gap-4">
        {/* LINKS: ALTIJD BLAUW */}
        <div className={`space-y-3 border-t-4 ${leftBorderClass} pt-2`}>
          <div className="text-center">
            <h4 className={`font-bold text-lg ${leftColorClass} flex flex-col`}>
              <span>Team {blueTeamIndex + 1}</span>
              <span className="text-xs opacity-70">BLAUW</span>
            </h4>
            <p className="text-3xl font-bold text-white mt-1">
              {getTeamScore(blueIdentifier)}
            </p>
          </div>

          {/* Kolomkopjes G / EG */}
          <div className="flex items-center text-xs font-bold text-gray-200 uppercase tracking-wider pr-1">
            <span className="flex-1" />
            <span className="w-13 text-center">Goals</span>
            <span className="w-9 text-center">EG</span>
          </div>

          <div className="space-y-2 pr-1">
            {blueTeam.map((p) => (
              <PlayerGoalInput
                key={p.id}
                player={p}
                teamIdentifier={blueIdentifier}
                opponentIdentifier={blueOpponentIdentifier}
              />
            ))}
          </div>
        </div>

        {/* RECHTS: ALTIJD GEEL */}
        <div className={`space-y-3 border-t-4 ${rightBorderClass} pt-2`}>
          <div className="text-center">
            <h4
              className={`font-bold text-lg ${rightColorClass} flex flex-col`}
            >
              <span>Team {yellowTeamIndex + 1}</span>
              <span className="text-xs opacity-70">GEEL</span>
            </h4>
            <p className="text-3xl font-bold text-white mt-1">
              {getTeamScore(yellowIdentifier)}
            </p>
          </div>

          {/* Kolomkopjes G / EG */}
          <div className="flex items-center text-xs font-bold text-gray-200 uppercase tracking-wider pr-1">
            <span className="flex-1" />
            <span className="w-13 text-center">Goals</span>
            <span className="w-9 text-center">EG</span>
          </div>

          <div className="space-y-2 pr-1">
            {yellowTeam.map((p) => (
              <PlayerGoalInput
                key={p.id}
                player={p}
                teamIdentifier={yellowIdentifier}
                opponentIdentifier={yellowOpponentIdentifier}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// RESULTAATKAART RONDE 1 – ZELFDE LAYOUT ALS MAINPAGE
// ============================================================================

const RoundResultCard: React.FC<{ result: MatchResult }> = ({ result }) => {
  const score1 = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
  const score2 = result.team2Goals.reduce((sum, g) => sum + g.count, 0);

  const color1 = getBaseColor(result.team1Index);
  const color2 = getBaseColor(result.team2Index);

  let leftIndex = result.team1Index;
  let rightIndex = result.team2Index;
  let leftScore = score1;
  let rightScore = score2;

  // als team1 geel en team2 blauw is → omdraaien (blauw links, geel rechts)
  if (color1 === 'yellow' && color2 === 'blue') {
    leftIndex = result.team2Index;
    rightIndex = result.team1Index;
    leftScore = score2;
    rightScore = score1;
  }

  const leftColor = 'text-cyan-400/80';
  const rightColor = 'text-amber-400/80';

  return (
    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/30">
      <div className="flex justify-between items-center text-center">
        <div className="w-2/5">
          <h4 className={`font-semibold text-base truncate ${leftColor}`}>
            Team {leftIndex + 1}
          </h4>
        </div>
        <div className="w-1/5">
          <p className="text-2xl font-bold text-white/90">
            {leftScore} - {rightScore}
          </p>
        </div>
        <div className="w-2/5">
          <h4 className={`font-semibold text-base truncate ${rightColor}`}>
            Team {rightIndex + 1}
          </h4>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ManualEntry: React.FC<ManualEntryProps> = ({
  allPlayers,
  onSave,
  isLoading,
}) => {
  const [round, setRound] = useState(0);
  const [teamTextR1, setTeamTextR1] = useState<string[]>(Array(6).fill(''));
  const [teamTextR2, setTeamTextR2] = useState<string[]>(Array(6).fill(''));
  const [round1Teams, setRound1Teams] = useState<Player[][] | null>(null);

  const [numMatches, setNumMatches] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualRound2, setManualRound2] = useState(false);

  const [goalScorers, setGoalScorers] = useState<{ [k: string]: Goal[] }>({});
  const [round1Results, setRound1Results] = useState<MatchResult[]>([]);
  const [round2Pairings, setRound2Pairings] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ========================================================================
  // PLAYER NORMALIZING MAP
  // ========================================================================
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    allPlayers.forEach((p) => {
      const full = normalize(p.name);
      const first = full.split(' ')[0];
      map.set(full, p);
      if (!map.has(first)) map.set(first, p);
    });
    return map;
  }, [allPlayers]);

  // ========================================================================
  // PARSE TEAM INPUT TEXT
  // ========================================================================
  const parseTeamText = useCallback(
    (texts: string[]) => {
      const teams: Player[][] = [];
      const unmatched: string[][] = [];

      for (let i = 0; i < numMatches * 2; i++) {
        const raw = texts[i] || '';
        const names = raw
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean);

        const team: Player[] = [];
        const notFound: string[] = [];

        names.forEach((name) => {
          const p = playerMap.get(normalize(name));
          if (p) team.push(p);
          else notFound.push(name);
        });

        teams.push(team);
        unmatched.push(notFound);
      }

      return { teams, unmatched };
    },
    [numMatches, playerMap]
  );

  const parsedR1 = useMemo(
    () => parseTeamText(teamTextR1),
    [teamTextR1, parseTeamText]
  );
  const parsedR2 = useMemo(
    () => parseTeamText(teamTextR2),
    [teamTextR2, parseTeamText]
  );

  // ========================================================================
  // ROUND 1 VALIDATION
  // ========================================================================
  const validateRound1 = () => {
    const used = new Set<number>();

    for (let i = 0; i < numMatches * 2; i++) {
      const team = parsedR1.teams[i];

      if (team.length === 0)
        return 'Alle teams moeten minimaal één speler hebben.';

      for (const p of team) {
        if (used.has(p.id)) return `Speler ${p.name} staat in meerdere teams.`;
        used.add(p.id);
      }
    }

    if (parsedR1.unmatched.some((list) => list.length))
      return 'Niet alle spelernamen zijn herkend. Corrigeer de rode namen.';

    return null;
  };

  const validateRound2 = () => {
    const used = new Set<number>();

    for (let i = 0; i < numMatches * 2; i++) {
      const team = parsedR2.teams[i];

      if (team.length === 0)
        return 'Alle teams in ronde 2 moeten minimaal één speler hebben.';

      for (const p of team) {
        if (used.has(p.id)) return `Speler ${p.name} staat dubbel in ronde 2.`;
        used.add(p.id);
      }
    }

    if (parsedR2.unmatched.some((list) => list.length))
      return 'Niet alle spelernamen voor ronde 2 zijn herkend.';

    return null;
  };

  // ========================================================================
  // START ROUND 1
  // ========================================================================
  const startTournament = () => {
    const err = validateRound1();
    if (err) return setError(err);

    setRound1Teams(parsedR1.teams);
    setRound(1);
  };

  // ========================================================================
  // GOAL CHANGE
  // ========================================================================
  const handleGoalChange = useCallback(
    (m: number, side: 'team1' | 'team2', id: number, count: number) => {
      setGoalScorers((prev) => {
        const key = `${m}-${side}`;
        const arr = [...(prev[key] || [])];
        const idx = arr.findIndex((g) => g.playerId === id);

        if (count === 0) {
          if (idx > -1) arr.splice(idx, 1);
        } else {
          if (idx > -1) arr[idx].count = count;
          else arr.push({ playerId: id, count });
        }
        return { ...prev, [key]: arr };
      });
    },
    []
  );

  // ========================================================================
  // ROUND 1 → ROUND 2
  // ========================================================================
  const nextRound = () => {
    const r1Matches = Array.from({ length: numMatches }, (_, i) => ({
      team1Index: i * 2,
      team2Index: i * 2 + 1,
    }));

    const results = r1Matches.map((m, i) => ({
      ...m,
      team1Goals: goalScorers[`${i}-team1`] || [],
      team2Goals: goalScorers[`${i}-team2`] || [],
    }));

    setRound1Results(results);

    if (manualRound2) {
      setGoalScorers({});
      setRound(1.8 as any);
      return;
    }

    const stats = Array.from({ length: numMatches * 2 }, (_, t) => ({
      teamIndex: t,
      points: 0,
      goalDifference: 0,
      goalsFor: 0,
    }));

    results.forEach((r) => {
      const s1 = r.team1Goals.reduce((s, g) => s + g.count, 0);
      const s2 = r.team2Goals.reduce((s, g) => s + g.count, 0);

      const T1 = stats.find((x) => x.teamIndex === r.team1Index)!;
      const T2 = stats.find((x) => x.teamIndex === r.team2Index)!;

      T1.goalDifference += s1 - s2;
      T1.goalsFor += s1;
      T2.goalDifference += s2 - s1;
      T2.goalsFor += s2;

      if (s1 > s2) T1.points += 3;
      else if (s2 > s1) T2.points += 3;
      else {
        T1.points++;
        T2.points++;
      }
    });

    stats.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.teamIndex - b.teamIndex
    );

    const pairings = generatePairingsWithoutRematches(stats, r1Matches);

    setRound2Pairings(pairings);
    setGoalScorers({});
    setRound(2);
  };

  // ========================================================================
  // START ROUND 2 (MANUAL)
  // ========================================================================
  const startRound2 = () => {
    const err = validateRound2();
    if (err) return setError(err);

    const pairings = Array.from({ length: numMatches }, (_, i) => ({
      team1Index: i * 2,
      team2Index: i * 2 + 1,
    }));

    setRound2Pairings(pairings);
    setRound(2);
  };

  // ========================================================================
// SAVE MATCH
// ========================================================================
const saveTournament = () => {
  if (isLoading) return;

  const resultsR2 = round2Pairings.map((m, i) => ({
    ...m,
    team1Goals: goalScorers[`${i}-team1`] || [],
    team2Goals: goalScorers[`${i}-team2`] || [],
  }));

  onSave({
    date: new Date(date).toISOString(),
    teams: round1Teams || parsedR1.teams,
    round1Results,
    round2Results: resultsR2,
  });

  localStorage.removeItem(UNSAVED_MANUAL_KEY);

  // 👇 Alles terug naar beginstand, zodat je niet op ronde 2 blijft hangen
  setRound(0);
  setTeamTextR1(Array(6).fill(''));
  setTeamTextR2(Array(6).fill(''));
  setRound1Teams(null);
  setGoalScorers({});
  setRound1Results([]);
  setRound2Pairings([]);
  setError(null);
  setNumMatches(1);
  setManualRound2(false);
};

  // ========================================================================
  // UI RENDER HELPERS
  // ========================================================================

  const renderSetup = (roundNr: 1 | 2) => {
    const isR1 = roundNr === 1;
    const texts = isR1 ? teamTextR1 : teamTextR2;
    const parsed = isR1 ? parsedR1 : parsedR2;

    return (
      <>
        <h3 className="text-white text-2xl font-bold mb-6">
          {isR1
            ? 'Stel Teams voor Ronde 1 Samen'
            : 'Stel Teams voor Ronde 2 Samen'}
        </h3>

        {isR1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-gray-300">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
              />
            </div>

            <div className="flex items-center md:justify-end space-x-2">
              <button
                onClick={() => setNumMatches((n) => Math.max(1, n - 1))}
                className="bg-gray-600 px-3 py-2 rounded text-white"
              >
                - Wedstrijd
              </button>

              <button
                onClick={() => setNumMatches((n) => Math.min(3, n + 1))}
                className="bg-gray-600 px-3 py-2 rounded text-white"
              >
                + Wedstrijd
              </button>
            </div>

            <div className="md:col-span-2 flex items-center">
              <input
                type="checkbox"
                checked={manualRound2}
                onChange={(e) => setManualRound2(e.target.checked)}
              />
              <span className="text-gray-300 ml-2">
                Volledig nieuwe teams voor ronde 2
              </span>
            </div>
          </div>
        )}

        {/* TEAM INPUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: numMatches }).map((_, m) => (
            <div
              key={m}
              className="grid grid-cols-2 gap-4 bg-gray-900 p-4 rounded"
            >
              {[0, 1].map((side) => {
                const idx = m * 2 + side;

                return (
                  <div key={idx}>
                    <h3
                      className={`font-bold mb-2 ${
                        side === 0 ? 'text-cyan-400' : 'text-amber-400'
                      }`}
                    >
                      Team {idx + 1}
                    </h3>

                    <textarea
                      value={texts[idx]}
                      onChange={(e) => {
                        const setter = isR1 ? setTeamTextR1 : setTeamTextR2;
                        setter((prev) => {
                          const arr = [...prev];
                          arr[idx] = e.target.value;
                          return arr;
                        });
                      }}
                      className="w-full h-40 bg-gray-700 text-white border border-gray-600 p-2 rounded"
                    />

                    <div className="mt-2 space-y-1">
                      {parsed.teams[idx].map((p) => (
                        <PlayerChip key={p.id} player={p} />
                      ))}
                      {parsed.unmatched[idx].map((n) => (
                        <UnmatchedChip key={n} name={n} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <button
          onClick={isR1 ? startTournament : startRound2}
          className="mt-8 w-full bg-green-600 text-white font-bold py-3 rounded"
        >
          {isR1 ? 'Start Toernooi' : 'Start Ronde 2'}
        </button>
      </>
    );
  };

  const renderRound = (r: 1 | 2) => {
    const final = r === 2;
    const teams = final && manualRound2 ? parsedR2.teams : round1Teams || [];

    const matches = final
      ? round2Pairings
      : Array.from({ length: numMatches }, (_, i) => ({
          team1Index: i * 2,
          team2Index: i * 2 + 1,
        }));

    return (
      <>
        {final && (
          <div>
            <h3 className="text-gray-400 text-xl font-bold mb-4">
              Resultaten Ronde 1
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {round1Results.map((res, i) => (
                <RoundResultCard key={i} result={res} />
              ))}
            </div>
          </div>
        )}

        <h3 className="text-white text-xl font-bold mt-8 mb-4">
          Uitslagen Ronde {r}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((m, i) => (
            <MatchInput
              key={i}
              match={m}
              matchIndex={i}
              teams={teams}
              goalScorers={goalScorers}
              onGoalChange={handleGoalChange}
            />
          ))}
        </div>

        {!final && (
          <button
            onClick={nextRound}
            className="w-full bg-blue-600 text-white py-3 rounded mt-6"
          >
            Sla Ronde 1 op & Ga Naar Ronde 2
          </button>
        )}

        {final && (
          <button
            onClick={saveTournament}
            className="w-full bg-green-600 text-white py-3 rounded mt-6"
          >
            Toernooi Afronden & Opslaan
          </button>
        )}
      </>
    );
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 text-white">
      <div className="flex items-center mb-6">
        <EditIcon className="w-8 h-8 text-green-500" />
        <h2 className="ml-3 text-3xl font-bold text-white">
          Handmatige Invoer
        </h2>
      </div>

      {error && (
        <div className="bg-red-800/50 text-red-200 p-3 rounded mb-6">
          <strong>Fout: </strong>
          {error}
          <button className="float-right" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      {round === 0 && renderSetup(1)}
      {round === 1 && renderRound(1)}
      {round === 1.8 && renderSetup(2)}
      {round === 2 && renderRound(2)}
    </div>
  );
};

export default ManualEntry;
