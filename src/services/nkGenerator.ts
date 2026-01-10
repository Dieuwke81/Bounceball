const handleStartTournament = async () => {
  const chosen = possibilities.find(p => p.playerCount === targetPlayerCount);
  if (!chosen) return;
  if (selectedPlayerIds.size !== targetPlayerCount) {
    alert(`Selecteer exact ${targetPlayerCount} spelers.`);
    return;
  }
  
  setIsGenerating(true);
  await sleep(100); // Geef UI tijd om laadscherm te tonen

  try {
    const participants = players.filter(p => selectedPlayerIds.has(p.id));
    // Wacht op de generator
    const newSession = await generateNKSchedule(
      participants, 
      hallNames.slice(0, chosen.hallsToUse), 
      matchesPerPlayer, 
      playersPerTeam, 
      "NK Schema"
    );
    setSession(newSession);
  } catch (error: any) {
    alert("Fout bij berekenen: " + error.message);
  } finally {
    setIsGenerating(false);
  }
};
