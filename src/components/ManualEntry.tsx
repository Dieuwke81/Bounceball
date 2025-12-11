/**  MANUAL ENTRY - MET LOCALSTORAGE + R1 SCORE WEERGAVE  */
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

// even = blauw, oneven = geel (voor R1-scoreweergave)
const getBaseColor = (index: number) => (index % 2 === 0 ? 'blue' : 'yellow');

// =====================================
// SCORE INPUT
// =====================================

const ScoreInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleFocus = () => {
    // Als waarde 0 is → leegmaken zodat je meteen kunt typen
    if (localValue === "0") {
      setLocalValue("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setLocalValue(val);
    }
  };

  const handleBlur = () => {
    if (localValue === "") {
      setLocalValue("0");
      if (value !== 0) onChange(0);
      return;
    }

    let num = parseInt(localValue, 10);
    if (isNaN(num)) num = 0;

    if (num !== value) onChange(num);

    setLocalValue(num.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder="0"
    />
  );
};

// =====================================
// HELPERS
// =====================================

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

// =====================================
// MATCH INPUT (RONDE UITSLAGEN)
// =====================================

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
  const team1 = teams[match.team1Index] || [];
  const team2 = teams[match.team2Index] || [];

  const getGoals = (side: 'team1' | 'team2') =>
    goalScorers[`${matchIndex}-${side}`] || [];

  const score = (side: 'team1' | 'team2') =>
    getGoals(side).reduce((s, g) => s + g.count, 0);

  return (
    <div className="bg-gray-700 rounded-lg p-4 text-white">
      <div className="grid grid-cols-2 gap-4">
        {/* TEAM 1 */}
        <div>
          <h4 className="text-cyan-300 font-bold text-lg text-center">
            Team {match.team1Index + 1}
          </h4>
          <p className="text-3xl font-bold text-center">{score('team1')}</p>

          <div className="space-y-2 mt-3 max-h-60 overflow-y-auto">
            {team1.map((p) => (
              <div
                key={p.id}
                className="flex justify-between bg-gray-600 p-2 rounded"
              >
                <span>{p.name}</span>
                <ScoreInput
                  value={
                    getGoals('team1').find((g) => g.playerId === p.id)?.count ||
                    0
                  }
                  onChange={(v) => onGoalChange(matchIndex, 'team1', p.id, v)}
                  className="w-12 bg-gray-800 text-white text-center rounded border border-gray-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* TEAM 2 */}
        <div>
          <h4 className="text-amber-300 font-bold text-lg text-center">
            Team {match.team2Index + 1}
          </h4>
          <p className="text-3xl font-bold text-center">{score('team2')}</p>

          <div className="space-y-2 mt-3 max-h-60 overflow-y-auto">
            {team2.map((p) => (
              <div
                key={p.id}
                className="flex justify-between bg-gray-600 p-2 rounded"
              >
                <span>{p.name}</span>
                <ScoreInput
                  value={
                    getGoals('team2').find((g) => g.playerId === p.id)?.count ||
                    0
                  }
                  onChange={(v) => onGoalChange(matchIndex, 'team2', p.id, v)}
                  className="w-12 bg-gray-800 text-white text-center rounded border border-gray-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================
// MAIN COMPONENT
// =====================================

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

  // ===== PLAYER MAP =====
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

  // ===== PARSEN VAN TEAMS =====
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

  // ===== VALIDATIE R1 / R2 =====
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

  // ===== START RONDE 1 =====
  const startTournament = () => {
    const err = validateRound1();
    if (err) return setError(err);

    setRound1Teams(parsedR1.teams);
    setRound(1);
  };

  // ===== GOALS =====
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

  // ===== RONDE 1 → 2 =====
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

  // ===== START R2 (MANUAL) =====
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

  // ===== OPSLAAN & FORM RESET =====
  const resetFormToInitial = () => {
    setRound(0);
    setTeamTextR1(Array(6).fill(''));
    setTeamTextR2(Array(6).fill(''));
    setRound1Teams(null);
    setGoalScorers({});
    setRound1Results([]);
    setRound2Pairings([]);
    setNumMatches(1);
    setManualRound2(false);
    setDate(new Date().toISOString().split('T')[0]);
  };

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

    if (typeof window !== 'undefined') {
      localStorage.removeItem(UNSAVED_MANUAL_KEY);
    }

    resetFormToInitial();
  };

  // =====================================
  // LOCALSTORAGE: CONCEPT OPSLAAN / LADEN
  // =====================================

  // Bij laden: vraag of we concept willen herstellen
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(UNSAVED_MANUAL_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      const confirmRestore = window.confirm(
        'Er is een opgeslagen handmatige invoer gevonden.\n\nWil je hiermee verder gaan?\n\nKlik op "Annuleren" om de opgeslagen invoer te verwijderen.'
      );

      if (!confirmRestore) {
        localStorage.removeItem(UNSAVED_MANUAL_KEY);
        return;
      }

      setDate(parsed.date || new Date().toISOString().split('T')[0]);
      setRound(parsed.round ?? 0);
      setNumMatches(parsed.numMatches ?? 1);
      setManualRound2(!!parsed.manualRound2);
      setTeamTextR1(parsed.teamTextR1 || Array(6).fill(''));
      setTeamTextR2(parsed.teamTextR2 || Array(6).fill(''));
      setRound1Teams(parsed.round1Teams || null);
      setGoalScorers(parsed.goalScorers || {});
      setRound1Results(parsed.round1Results || []);
      setRound2Pairings(parsed.round2Pairings || []);
    } catch (err) {
      console.error('Fout bij laden van concept handmatige invoer', err);
      localStorage.removeItem(UNSAVED_MANUAL_KEY);
    }
  }, []);

  // Bij elke wijziging: concept wegschrijven
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft = {
      date,
      round,
      numMatches,
      manualRound2,
      teamTextR1,
      teamTextR2,
      round1Teams,
      goalScorers,
      round1Results,
      round2Pairings,
    };
    try {
      localStorage.setItem(UNSAVED_MANUAL_KEY, JSON.stringify(draft));
    } catch (err) {
      console.error('Fout bij opslaan concept handmatige invoer', err);
    }
  }, [
    date,
    round,
    numMatches,
    manualRound2,
    teamTextR1,
    teamTextR2,
    round1Teams,
    goalScorers,
    round1Results,
    round2Pairings,
  ]);

  // =====================================
  // UI HELPERS
  // =====================================

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
              {round1Results.map((res, i) => {
                const score1 = res.team1Goals.reduce(
                  (s, g) => s + g.count,
                  0
                );
                const score2 = res.team2Goals.reduce(
                  (s, g) => s + g.count,
                  0
                );

                const color1 = getBaseColor(res.team1Index);
                const color2 = getBaseColor(res.team2Index);

                let leftIdx = res.team1Index;
                let rightIdx = res.team2Index;
                let leftScore = score1;
                let rightScore = score2;

                if (color1 === 'yellow' && color2 === 'blue') {
                  leftIdx = res.team2Index;
                  rightIdx = res.team1Index;
                  leftScore = score2;
                  rightScore = score1;
                }

                return (
                  <div
                    key={i}
                    className="bg-gray-700 rounded-lg px-4 py-3 flex items-center justify-between"
                  >
                    <span className="text-cyan-300 font-semibold">
                      Team {leftIdx + 1}
                    </span>
                    <span className="text-2xl font-bold text-white">
                      {leftScore} - {rightScore}
                    </span>
                    <span className="text-amber-300 font-semibold">
                      Team {rightIdx + 1}
                    </span>
                  </div>
                );
              })}
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
            Sla Ronde 1 op &amp; Ga Naar Ronde 2
          </button>
        )}

        {final && (
          <button
            onClick={saveTournament}
            className="w-full bg-green-600 text-white py-3 rounded mt-6"
          >
            Toernooi Afronden &amp; Opslaan
          </button>
        )}
      </>
    );
  };

  // =====================================
  // MAIN RENDER
  // =====================================

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
