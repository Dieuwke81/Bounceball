import React, { useMemo, useState, useEffect } from 'react';
import type { Player, Match, Goal, MatchResult } from '../types';
import TrophyIcon from './icons/TrophyIcon';
import MatchForm from './MatchForm';

// --- STAP 1: Vertel TypeScript dat 'confetti' op het window object bestaat ---
declare global {
  interface Window {
    confetti: any;
  }
}

type GameMode = 'simple' | 'tournament' | 'doubleHeader' | null;

interface TeamDisplayProps {
  teams: Player[][];
  teams2: Player[][] | null;
  gameMode: GameMode;
  currentRound: number;
  round1Results: MatchResult[];
  round2Pairings: Match[];
  goalScorers: { [key: string]: Goal[] };
  onGoalChange: (
    matchIndex: number,
    teamIdentifier: 'team1' | 'team2',
    playerId: number,
    count: number
  ) => void;
  onSaveRound1: (matches: Match[]) => void;
  onSaveFinalResults: (matches: Match[]) => void;
  onSaveSimpleMatch: (match: Match) => void;
  onStartSecondDoubleHeaderMatch: (match1Result: MatchResult) => void;
  onSaveDoubleHeader: (match2Result: MatchResult) => void;
  onRegenerateTeams: () => void;
  actionInProgress: string | null;
}

// ============================================================================
// ICONS & SPINNERS
// ============================================================================

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const PrinterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
    />
  </svg>
);

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`animate-spin ${className || 'h-5 w-5'}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

const LoadingDots: React.FC = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length < 3 ? d + '.' : ''));
    }, 300);
    return () => clearInterval(timer);
  }, []);
  return <span className="w-4 inline-block text-left">{dots}</span>;
};

// ============================================================================
// COMPONENT: ScoreInput
// ============================================================================
const ScoreInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setLocalValue(val);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localValue === '0') {
      setLocalValue('');
    } else {
      e.target.select();
    }
  };

  const handleBlur = () => {
    let num = parseInt(localValue, 10);
    if (isNaN(num)) num = 0;

    if (num !== value) {
      onChange(num);
    }
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
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder="0"
    />
  );
};

// Hulpfunctie om basiskleur te bepalen op basis van index
const getBaseColor = (index: number) => (index % 2 === 0 ? 'blue' : 'yellow');

// ============================================================================
// WEDSTRIJD CARD (AANGEPAST: ALTIJD BLAUW LINKS, GEEL RECHTS + EG)
// ============================================================================
const MatchInputCard: React.FC<{
  match: Match;
  matchIndex: number;
  teams: Player[][];
  goalScorers: TeamDisplayProps['goalScorers'];
  onGoalChange: TeamDisplayProps['onGoalChange'];
}> = ({ match, matchIndex, teams, goalScorers, onGoalChange }) => {
  // 1. Haal de teams op
  const team1Data = teams[match.team1Index];
  const team2Data = teams[match.team2Index];

  // 2. Bepaal de 'natuurlijke' kleur
  const color1 = getBaseColor(match.team1Index);
  const color2 = getBaseColor(match.team2Index);

  // 3. Logica: Wie moet er LINKS (Blauw) en wie RECHTS (Geel)?
  let blueTeam, yellowTeam;
  let blueIdentifier: 'team1' | 'team2';
  let yellowIdentifier: 'team1' | 'team2';
  let blueTeamIndex, yellowTeamIndex;

  if (color1 === 'yellow' && color2 === 'blue') {
    blueTeam = team2Data;
    blueIdentifier = 'team2';
    blueTeamIndex = match.team2Index;

    yellowTeam = team1Data;
    yellowIdentifier = 'team1';
    yellowTeamIndex = match.team1Index;
  } else {
    blueTeam = team1Data;
    blueIdentifier = 'team1';
    blueTeamIndex = match.team1Index;

    yellowTeam = team2Data;
    yellowIdentifier = 'team2';
    yellowTeamIndex = match.team2Index;
  }

  const leftColorClass = 'text-cyan-300';
  const rightColorClass = 'text-amber-300';
  const leftBorderClass = 'border-cyan-500/30';
  const rightBorderClass = 'border-amber-500/30';

  // Score per team (alles wat bij dat team opgeslagen is, incl. EG van tegenstander)
  const getTeamScore = (identifier: 'team1' | 'team2') => {
    const goals = goalScorers[`${matchIndex}-${identifier}`] || [];
    return goals.reduce((sum, g) => sum + g.count, 0);
  };

  const getPlayerGoalsForTeam = (
    teamIdentifier: 'team1' | 'team2',
    playerId: number
  ) => {
    const goals = goalScorers[`${matchIndex}-${teamIdentifier}`] || [];
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
            <span className="w-9 text-center text-xs">Goals</span>
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
            <span className="w-9 text-center">G</span>
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
// UITSLAG CARD (AANGEPAST: OOK ALTIJD BLAUW LINKS)
// ============================================================================
const MatchResultDisplayCard: React.FC<{
  matchResult: MatchResult;
}> = ({ matchResult }) => {
  const score1 = matchResult.team1Goals.reduce((sum, g) => sum + g.count, 0);
  const score2 = matchResult.team2Goals.reduce((sum, g) => sum + g.count, 0);

  const color1 = getBaseColor(matchResult.team1Index);
  const color2 = getBaseColor(matchResult.team2Index);

  let leftText, rightText, leftScore, rightScore;

  if (color1 === 'yellow' && color2 === 'blue') {
    leftText = `Team ${matchResult.team2Index + 1}`;
    rightText = `Team ${matchResult.team1Index + 1}`;
    leftScore = score2;
    rightScore = score1;
  } else {
    leftText = `Team ${matchResult.team1Index + 1}`;
    rightText = `Team ${matchResult.team2Index + 1}`;
    leftScore = score1;
    rightScore = score2;
  }

  const leftColor = 'text-cyan-400/80';
  const rightColor = 'text-amber-400/80';

  return (
    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/30">
      <div className="flex justify-between items-center text-center">
        <div className="w-2/5">
          <h4 className={`font-semibold text-base truncate ${leftColor}`}>
            {leftText}
          </h4>
        </div>
        <div className="w-1/5">
          <p className="text-2xl font-bold text-white/90">
            {leftScore} - {rightScore}
          </p>
        </div>
        <div className="w-2/5">
          <h4 className={`font-semibold text-base truncate ${rightColor}`}>
            {rightText}
          </h4>
        </div>
      </div>
    </div>
  );
};

const TeamCard: React.FC<{
  team: Player[];
  index: number;
  title: string;
}> = ({ team, index, title }) => {
  const calculateTeamStats = (team: Player[]) => {
    const totalRating = team.reduce((sum, player) => sum + player.rating, 0);
    const averageRating =
      team.length > 0 ? (totalRating / team.length).toFixed(2) : '0.00';
    return { totalRating, averageRating };
  };
  const { totalRating, averageRating } = calculateTeamStats(team);

  const isBlueTeam = index % 2 === 0;
  const headerColor = isBlueTeam ? 'text-cyan-400' : 'text-amber-400';
  const borderColor = isBlueTeam ? 'border-cyan-500' : 'border-amber-500';

  return (
    <div
      className={`bg-gray-700 rounded-lg flex flex-col border-t-4 ${borderColor}`}
    >
      <h3 className={`text-xl font-bold ${headerColor} mb-2 px-4 pt-3`}>
        {title} {index + 1}
      </h3>
      <div className="flex-grow space-y-2 mb-4 px-4">
        {team.map((player) => (
          <div
            key={player.id}
            className="flex justify-between items-center bg-gray-600 p-2 rounded"
          >
            <div className="flex items-center">
              <span className="font-medium text-gray-200">
                {player.name}
              </span>
              {player.isKeeper && (
                <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">
                  K
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-gray-600 pt-3 text-sm px-4 pb-4">
        <div className="flex justify-between text-gray-300">
          <span>Totaal spelers:</span>
          <span className="font-semibold text-white">
            {team.length}
          </span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Totaal rating:</span>
          <span className="font-semibold text-white">
            {totalRating.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Gem. rating:</span>
          <span className="font-semibold text-white">
            {averageRating}
          </span>
        </div>
      </div>
    </div>
  );
};

const TeamDisplay: React.FC<TeamDisplayProps> = ({
  teams,
  teams2,
  gameMode,
  currentRound,
  round1Results,
  round2Pairings,
  goalScorers,
  onGoalChange,
  onSaveRound1,
  onSaveFinalResults,
  onSaveSimpleMatch,
  onStartSecondDoubleHeaderMatch,
  onSaveDoubleHeader,
  onRegenerateTeams,
  actionInProgress,
}) => {
  // CONFETTI LOAD
  useEffect(() => {
    if (!document.getElementById('confetti-script')) {
      const script = document.createElement('script');
      script.id = 'confetti-script';
      script.src =
        'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const triggerFirework = () => {
    if (window.confetti) {
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 0,
      };
      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;
      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        window.confetti(
          Object.assign({}, defaults, {
            particleCount,
            origin: {
              x: randomInRange(0.1, 0.3),
              y: Math.random() - 0.2,
            },
          })
        );
        window.confetti(
          Object.assign({}, defaults, {
            particleCount,
            origin: {
              x: randomInRange(0.7, 0.9),
              y: Math.random() - 0.2,
            },
          })
        );
      }, 250);
    }
  };

  if (teams.length === 0) return null;

  const isSimpleMatch = gameMode === 'simple';

  const round1Matches: Match[] = useMemo(() => {
    if (gameMode === 'simple' || gameMode === 'doubleHeader') {
      return [{ team1Index: 0, team2Index: 1 }];
    }
    if (gameMode === 'tournament') {
      const matches: Match[] = [];
      for (let i = 0; i < teams.length; i += 2) {
        if (teams[i + 1]) {
          matches.push({ team1Index: i, team2Index: i + 1 });
        }
      }
      return matches;
    }
    return [];
  }, [teams, gameMode]);

  const handleShareToWhatsApp = () => {
    const today = new Date().toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateStr = today.charAt(0).toUpperCase() + today.slice(1);
    let text = `📅 *Bounceball - ${dateStr}*\n\n`;

    const getAvg = (team: Player[]) => {
      if (!team || team.length === 0) return '0.00';
      const total = team.reduce((sum, p) => sum + p.rating, 0);
      return (total / team.length).toFixed(2);
    };

    round1Matches.forEach((match, index) => {
      const team1 = teams[match.team1Index];
      const team2 = teams[match.team2Index];
      if (!team1 || !team2) return;

      const color1 = getBaseColor(match.team1Index);
      const color2 = getBaseColor(match.team2Index);

      let blueTeam = team1;
      let yellowTeam = team2;
      let blueIdx = match.team1Index;
      let yellowIdx = match.team2Index;

      if (color1 === 'yellow' && color2 === 'blue') {
        blueTeam = team2;
        blueIdx = match.team2Index;
        yellowTeam = team1;
        yellowIdx = match.team1Index;
      }

      const avgBlue = getAvg(blueTeam);
      const avgYellow = getAvg(yellowTeam);

      text += `🔥 *Wedstrijd ${index + 1}*\n`;
      text += `🔵 *Team ${blueIdx + 1}* (⭐ ${avgBlue})\n`;
      blueTeam.forEach((p) => (text += `- ${p.name}\n`));
      text += `\n   ⚡️  - VS -  ⚡️   \n\n`;
      text += `🟡 *Team ${yellowIdx + 1}* (⭐ ${avgYellow})\n`;
      yellowTeam.forEach((p) => (text += `- ${p.name}\n`));
      text += `\n------------------\n\n`;
    });

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const currentMatches =
    currentRound === 1 ? round1Matches : round2Pairings;

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 mt-8 relative">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <TrophyIcon className="w-6 h-6 text-fuchsia-400" />
          <h2 className="ml-3 text-2xl font-bold text-white">
            Wedstrijdoverzicht
          </h2>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleShareToWhatsApp}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg transition-colors text-sm font-bold shadow-md hover:shadow-lg transform active:scale-95"
            title="Deel via WhatsApp"
          >
            <WhatsAppIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg transition-colors text-sm font-bold shadow-md hover:shadow-lg transform active:scale-95"
            title="Print Wedstrijdformulier"
          >
            <PrinterIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Formulier</span>
          </button>
        </div>
      </div>

      {/* DOUBLE HEADER */}
      {gameMode === 'doubleHeader' && (
        <>
          {currentRound === 1 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                Teams Wedstrijd 1
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team, index) => (
                  <TeamCard
                    key={index}
                    team={team}
                    index={index}
                    title="Team"
                  />
                ))}
              </div>
              <div className="mt-8 border-t border-gray-600 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Uitslag Wedstrijd 1
                </h3>
                <MatchInputCard
                  match={{ team1Index: 0, team2Index: 1 }}
                  matchIndex={0}
                  teams={teams}
                  goalScorers={goalScorers}
                  onGoalChange={onGoalChange}
                />
                <button
                  onClick={() => {
                    const matchResult: MatchResult = {
                      team1Index: 0,
                      team2Index: 1,
                      team1Goals: goalScorers['0-team1'] || [],
                      team2Goals: goalScorers['0-team2'] || [],
                    };
                    onStartSecondDoubleHeaderMatch(matchResult);
                  }}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-blue-800 disabled:cursor-wait"
                  disabled={!!actionInProgress}
                >
                  {actionInProgress === 'generating' ? (
                    <>
                      <Spinner className="mr-3" />
                      <span>Teams Maken...</span>
                    </>
                  ) : (
                    'Sla Wedstrijd 1 op & Start Wedstrijd 2'
                  )}
                </button>
              </div>
            </div>
          )}

          {currentRound === 2 && teams2 && round1Results.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4 opacity-80">
                Teams Wedstrijd 1
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {teams.map((team, index) => (
                  <TeamCard
                    key={index}
                    team={team}
                    index={index}
                    title="Team"
                  />
                ))}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">
                Teams Wedstrijd 2
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams2.map((team, index) => (
                  <TeamCard
                    key={`dh-${index}`}
                    team={team}
                    index={index}
                    title="Team"
                  />
                ))}
              </div>
              <div className="mt-8 border-t border-gray-600 pt-6">
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-400 mb-4">
                    Resultaat Wedstrijd 1
                  </h3>
                  <MatchResultDisplayCard matchResult={round1Results[0]} />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">
                  Uitslag Wedstrijd 2
                </h3>
                <MatchInputCard
                  match={{ team1Index: 0, team2Index: 1 }}
                  matchIndex={0}
                  teams={teams2}
                  goalScorers={goalScorers}
                  onGoalChange={onGoalChange}
                />
                <button
                  onClick={() => {
                    const match2Result: MatchResult = {
                      team1Index: 0,
                      team2Index: 1,
                      team1Goals: goalScorers['0-team1'] || [],
                      team2Goals: goalScorers['0-team2'] || [],
                    };
                    onSaveDoubleHeader(match2Result);
                    triggerFirework();
                  }}
                  className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-green-800 disabled:cursor-wait"
                  disabled={!!actionInProgress}
                >
                  {actionInProgress === 'savingDouble' ? (
                    <>
                      <Spinner className="mr-3" />
                      <span>Opslaan...</span>
                    </>
                  ) : (
                    'Sla Beide Wedstrijden Op'
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* SIMPLE MATCH / TOERNOOI */}
      {(isSimpleMatch || gameMode === 'tournament') && (
        <>
          {currentRound === 1 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Gebalanceerde Teams
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team, index) => (
                  <TeamCard
                    key={index}
                    team={team}
                    index={index}
                    title="Team"
                  />
                ))}
              </div>
            </div>
          )}

          {currentRound > 0 && (
            <div className="mt-8 border-t border-gray-600 pt-6">
              {currentRound === 2 && round1Results.length > 0 && (
                <>
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-400 mb-4">
                      Resultaten Ronde 1
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {round1Results.map((result, index) => (
                        <MatchResultDisplayCard
                          key={`r1-result-${index}`}
                          matchResult={result}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-4">
                      Teams voor Ronde 2
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {teams.map((team, index) => (
                        <TeamCard
                          key={`r2-${index}`}
                          team={team}
                          index={index}
                          title="Team"
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <h3 className="text-xl font-bold text-white mb-4">
                {isSimpleMatch
                  ? 'Wedstrijduitslag'
                  : `Uitslagen Ronde ${currentRound}`}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentMatches.map((match, index) => (
                  <MatchInputCard
                    key={`${currentRound}-${index}`}
                    match={match}
                    matchIndex={index}
                    teams={teams}
                    goalScorers={goalScorers}
                    onGoalChange={onGoalChange}
                  />
                ))}
              </div>

              {isSimpleMatch && currentRound === 1 && (
                <button
                  onClick={() => {
                    onSaveSimpleMatch(round1Matches[0]);
                    triggerFirework();
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 flex items-center justify-center disabled:bg-green-800 disabled:cursor-wait"
                  disabled={!!actionInProgress}
                >
                  {actionInProgress === 'savingSimple' ? (
                    <>
                      <Spinner className="mr-3" />
                      <span>Opslaan...</span>
                    </>
                  ) : (
                    'Wedstrijd Opslaan'
                  )}
                </button>
              )}

              {!isSimpleMatch && currentRound === 1 && (
                <button
                  onClick={() => onSaveRound1(round1Matches)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 disabled:bg-blue-800 disabled:cursor-not-allowed"
                  disabled={!!actionInProgress}
                >
                  Sla Ronde 1 op & Start Ronde 2
                </button>
              )}

              {!isSimpleMatch && currentRound === 2 && (
                <>
                  <button
                    onClick={() => {
                      onSaveFinalResults(round2Pairings);
                      triggerFirework();
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 flex items-center justify-center disabled:bg-green-800 disabled:cursor-wait"
                    disabled={!!actionInProgress}
                  >
                    {actionInProgress === 'savingFinal' ? (
                      <>
                        <Spinner className="mr-3" />
                        <span>Afronden...</span>
                      </>
                    ) : (
                      'Toernooi Afronden & Sessie Opslaan'
                    )}
                  </button>
                  <button
                    onClick={onRegenerateTeams}
                    className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center disabled:bg-amber-800 disabled:cursor-wait"
                    disabled={!!actionInProgress}
                  >
                    {actionInProgress === 'regeneratingTeams' ? (
                      <>
                        <Spinner className="-ml-1 mr-3 h-5 w-5 text-white" />
                        <span>
                          Nieuwe teams maken
                          <LoadingDots />
                        </span>
                      </>
                    ) : (
                      'Speler geblesseerd? Maak nieuwe teams voor R2'
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <MatchForm teams={teams} />
    </div>
  );
};

export default TeamDisplay;
