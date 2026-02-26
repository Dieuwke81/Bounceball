// ... (vorige code) ...

        // Wie hebben er rust?
        let resting = allPlayers.filter(p => !usedThisRound.has(p.id));

        // ----------------------------------------------------------------------
        // HARDE LOGICA: RESERVES VULLEN MET RATING EISEN (NOGMAALS AANGEPAST)
        // ----------------------------------------------------------------------
        
        // Shuffle de matches om een eerlijke verdeling van reserves te bevorderen
        const shuffledMatches = [...matches].sort(() => Math.random() - 0.5);

        // 1. Splits de rustende spelers in de twee bakken
        let lowPool = resting.filter(p => p.rating < 6.0).sort((a, b) => a.rating - b.rating);
        let highPool = resting.filter(p => p.rating >= 6.0).sort((a, b) => a.rating - b.rating);

        // Maak diepe kopieën van de pools voor deze ronde poging
        let currentLowPool = [...lowPool];
        let currentHighPool = [...highPool];

        let failedToFillPerfectly = false; // Vlag om aan te geven of de perfecte vulling is gelukt

        // Eerst proberen we perfect te vullen: 1 low, 1 high per match
        for (let m of shuffledMatches) {
            // Probeer een lage reserve te pakken
            if (currentLowPool.length > 0) {
                m.subLow = currentLowPool.shift()!;
            } else {
                failedToFillPerfectly = true;
                break; // Niet genoeg lage reserves voor perfecte vulling
            }
            // Probeer een hoge reserve te pakken
            if (currentHighPool.length > 0) {
                m.subHigh = currentHighPool.pop()!; // Pak de 'beste' hoge speler
            } else {
                failedToFillPerfectly = true;
                break; // Niet genoeg hoge reserves voor perfecte vulling
            }
        }

        // Als de perfecte vulling is mislukt, moeten we de pools resetten en flexibeler vullen
        if (failedToFillPerfectly) {
            // Reset de subLow en subHigh voor alle matches van deze ronde
            for (let m of shuffledMatches) {
                m.subLow = null as any;
                m.subHigh = null as any;
            }
            // Gooi de oorspronkelijke rustende spelers (zonder scheidsrechters) weer in een algemene pool
            let generalReservePool = [...lowPool, ...highPool].sort((a,b) => a.rating - b.rating);

            // Vul nu eerst alle subLow plekken, beginnend met de laagste spelers
            for (let m of shuffledMatches) {
                if (generalReservePool.length > 0) {
                    m.subLow = generalReservePool.shift()!;
                } else {
                    // Als zelfs de algemene pool leeg is, kunnen we niet verder.
                    // Dit betekent dat er niet genoeg spelers zijn voor alle reserves.
                    // We moeten deze ronde als mislukt markeren.
                    throw new Error("Niet genoeg algemene spelers voor subLow reserves.");
                }
            }

            // Vul daarna alle subHigh plekken, beginnend met de hoogste resterende spelers
            for (let m of shuffledMatches) {
                if (generalReservePool.length > 0) {
                    m.subHigh = generalReservePool.pop()!;
                } else {
                    // Als zelfs de algemene pool leeg is, kunnen we niet verder.
                    throw new Error("Niet genoeg algemene spelers voor subHigh reserves.");
                }
            }
        }
        // Als we hier komen, zijn subLow en subHigh gevuld (perfect of flexibel)

        // STAP 3: Vul SCHEIDSRECHTERS met wat er over is (Prioriteit 3 - Mag leeg blijven)
        // De resterende spelers in currentLowPool en currentHighPool (als perfect gevuld)
        // of de resterende spelers in generalReservePool (als flexibel gevuld)
        let leftoversForReferees = [];
        if (!failedToFillPerfectly) {
            leftoversForReferees = [...currentLowPool, ...currentHighPool].sort((a,b) => a.rating - b.rating);
        } else {
            leftoversForReferees = generalReservePool; // dit is al wat er over is
        }
        
        for (let m of shuffledMatches) {
            if (leftoversForReferees.length > 0) {
                // Pak de middelste speler voor scheids (meest eerlijk)
                m.referee = leftoversForReferees.splice(Math.floor(leftoversForReferees.length / 2), 1)[0]; 
            } else {
                m.referee = null as any; // Geen probleem, scheids mag leeg
            }
        }
        // ----------------------------------------------------------------------
