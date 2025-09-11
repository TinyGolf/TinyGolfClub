//gamemanager.js
const mainMenu = document.getElementById('mainMenu');
let selectedHoles = null;
let selectedMode = null;
// All’inizio del file
let playerClubs = [];
let playerSpecials = [];
let playerScore = 0;
let playerCoins = 0;
let currentHolePoints = []; // punti della buca corrente


// Mostra regole
document.getElementById('rulesBtn').addEventListener('click', () => {
    alert("Regole del gioco: ... qui puoi mettere le istruzioni");
});

// Selezione numero di buche
mainMenu.querySelectorAll('[data-holes]').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedHoles = parseInt(btn.dataset.holes, 10);
        mainMenu.dataset.holes = selectedHoles; // ← qui
        btn.style.background = '#28a745';
        checkStart();
    });
});

// Selezione modalità
mainMenu.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedMode = btn.dataset.mode;
        btn.style.background = '#28a745';
        checkStart();
    });
});

// Avvia gioco quando entrambe le scelte sono fatte
function checkStart() {
    if (selectedHoles && selectedMode) {
        mainMenu.style.display = 'none';
        if (selectedMode === 'adventure') {
            startAdventure(); // la tua funzione avventura
        } else {
            startTournament(selectedHoles, selectedMode); // classica
        }
    }
}

// Funzione stub per partire con il gioco
function startGame(holes, mode) {
    console.log("Inizio partita:", holes, "buche,", "modalità", mode);
    // Qui puoi inizializzare mappe, palla, ecc.
}
// Impostazioni torneo
let totalHoles = 9; // o 18
let currentHoleIndex = 0;
// Array di oggetti buca: { par: 3|4|5, difficulty: 1|2|3, strokes: 0 }
let holes = [];
let strokes = 0; // colpi della buca corrente

// Score globale
let scores = [];

function startTournament(numHoles, mode) {
    console.log("Avvio torneo:", numHoles, "buche, modalità:", mode);

    // Mazze: tutte
    playerClubs = [...Clubs];
    playerSpecials = [...Specials];
    populateDecks();

    totalHoles = numHoles;
    currentHoleIndex = 0;
    holes = [];
    scores = [];

    for (let i = 0; i < totalHoles; i++) {
        const rand = Math.random();
        const par = rand < 0.3 ? 3 : (rand < 0.7 ? 4 : 5);
        let difficulty = totalHoles === 9 ? (i < 3 ? 1 : (i < 6 ? 2 : 3)) : (i < 6 ? 1 : (i < 12 ? 2 : 3));
        holes.push({ par, difficulty, strokes: 0 });
    }

    startHole(currentHoleIndex);
}

function startHole(index) {
    playerClubs = [...Clubs];
    const hole = holes[index];
    if (!hole) {
        console.warn("startHole chiamata ma hole undefined!", index, holes);
        return; // evita crash
    }

    document.getElementById('holeNumber').innerText = index + 1;

    strokes = 0;
    hole.strokes = 0;
    if (strokesEl) strokesEl.innerText = strokes;

    generateMap(hole.par, hole.difficulty);
    generateWind(hole.difficulty);
    updateWindDisplay();
    render();
}

function finishHole() {
    showScoreboard();
}

function showScoreboard() {
    console.log("Mostra scoreboard");
    const old = document.querySelector('.scoreboard');
    if (old) old.remove();

    const container = document.createElement('div');
    container.classList.add('scoreboard');

    // --- Riga informativa buca appena finita ---
    const currentHole = holes[currentHoleIndex];
    const diff = currentHole.strokes - currentHole.par;
    let resultText = '';
    if (currentHole.strokes === 1) resultText = 'Hole in One';
    else if (diff <= -3) resultText = 'Albatross';
    else if (diff === -2) resultText = 'Eagle';
    else if (diff === -1) resultText = 'Birdie';
    else if (diff === 0) resultText = 'Par';
    else if (diff === 1) resultText = 'Bogey';
    else if (diff === 2) resultText = 'Doppio Bogey';
    else if (diff >= 3) resultText = 'Triplo Bogey';

    const infoRow = document.createElement('div');
    infoRow.classList.add('score-info');
    infoRow.innerText = `Buca ${currentHoleIndex + 1}: ${resultText}`;
    container.appendChild(infoRow);

    // Front 9 e Back 9
    const frontHoles = holes.slice(0, 9);
    const backHoles = holes.length > 9 ? holes.slice(9, 18) : [];

    // Funzione per creare righe di score
    function createScoreRows(holesSubset) {
        const headerRow = document.createElement('div');
        headerRow.classList.add('score-row');
        holesSubset.forEach((h, idx) => {
            const cell = document.createElement('div');
            cell.innerText = `B${idx + 1}`;
            headerRow.appendChild(cell);
        });
        const totalHeader = document.createElement('div');
        totalHeader.innerText = 'Totale';
        headerRow.appendChild(totalHeader);

        const parRow = document.createElement('div');
        parRow.classList.add('score-row');
        let totalPar = 0;
        holesSubset.forEach(h => {
            const cell = document.createElement('div');
            cell.innerText = h.par;
            parRow.appendChild(cell);
            totalPar += h.par;
        });
        const totalParCell = document.createElement('div');
        totalParCell.innerText = totalPar;
        parRow.appendChild(totalParCell);

        const scoreRow = document.createElement('div');
        scoreRow.classList.add('score-row');
        let totalStrokes = 0;
        holesSubset.forEach(h => {
            const cell = document.createElement('div');
            cell.innerText = h.strokes > 0 ? h.strokes : '-';
            scoreRow.appendChild(cell);
            if (h.strokes > 0) totalStrokes += h.strokes;
        });
        const totalStrokesCell = document.createElement('div');
        totalStrokesCell.innerText = totalStrokes;
        scoreRow.appendChild(totalStrokesCell);

        return [headerRow, parRow, scoreRow];
    }

    // --- Mostra Front 9 sempre ---
    createScoreRows(frontHoles).forEach(el => container.appendChild(el));

    // --- Mostra Back 9 solo se esistono buche aggiuntive ---
    if (backHoles.length > 0) {
        createScoreRows(backHoles).forEach(el => container.appendChild(el));
    }
    // --- Pulsante "Prossima buca" ---
    const nextBtn = document.createElement('button');
    nextBtn.innerText = currentHoleIndex + 1 < totalHoles ? 'Prossima buca' : 'Fine partita';
    nextBtn.classList.add('btn', 'next-hole-btn');
    nextBtn.addEventListener('click', () => {
        container.remove();
        currentHoleIndex++;
        if (currentHoleIndex < totalHoles) {
            startHole(currentHoleIndex);
        } else {
            showFinalScores();
        }
    });
    container.appendChild(nextBtn);

    document.body.appendChild(container);
}

function showFinalScores() {
    // Rimuove eventuali scoreboard precedenti
    const old = document.querySelector('.scoreboard');
    if (old) old.remove();

    const container = document.createElement('div');
    container.classList.add('scoreboard');
    container.style.textAlign = 'center';
    container.style.padding = '20px';
    container.style.fontSize = '20px';
    container.style.background = '#f5f5f5';
    container.style.border = '2px solid #333';
    container.style.borderRadius = '10px';
    container.style.width = '300px';
    container.style.margin = '40px auto';

    // Calcola punteggi totali
    let totalStrokes = 0;
    let totalPar = 0;
    holes.forEach(h => {
        totalStrokes += h.strokes;
        totalPar += h.par;
    });

    const diff = totalStrokes - totalPar;
    const diffText = diff < 0 ? `${Math.abs(diff)} sotto al par` :
        diff > 0 ? `${diff} sopra al par` : 'par';

    // Titolo
    const title = document.createElement('h2');
    title.innerText = 'Complimenti!';
    container.appendChild(title);

    // Punteggio totale
    const scoreP = document.createElement('p');
    scoreP.innerText = `Hai finito la partita con ${totalStrokes} colpi.`;
    container.appendChild(scoreP);

    // Par totale e differenza
    const parP = document.createElement('p');
    parP.innerText = `Par totale: ${totalPar} (${diffText})`;
    container.appendChild(parP);

    // Pulsante restart (opzionale)
    const restartBtn = document.createElement('button');
    restartBtn.innerText = 'Ricomincia partita';
    restartBtn.classList.add('btn');
    restartBtn.style.marginTop = '20px';
    restartBtn.addEventListener('click', () => {
        container.remove();
        askHoles();
    });
    container.appendChild(restartBtn);

    document.body.appendChild(container);
}
// Al caricamento mostra subito menu
window.addEventListener('load', () => {
    mainMenu.style.display = 'flex';
    strokesEl = document.querySelector('#strokes');
});

function startAdventure() {
    // Mazze iniziali
    const getRandomClub = (minNum, maxNum) => {
        const options = Clubs.filter(c => c.num >= minNum && c.num <= maxNum);
        return options[Math.floor(Math.random() * options.length)];
    };

    const initialClubs = [
        getRandomClub(2, 4),    // legno casuale
        getRandomClub(5, 12),   // ferro casuale
        getRandomClub(13, 15),  // bastone casuale tra sand, pitch, wedge
        Clubs.find(c => c.num === 16) // putter fisso
    ];

    playerClubs = initialClubs;

    // Carte speciali iniziali: due numeri casuali tra 2 e 13
    const specialNums = new Set([1]);
    while (specialNums.size < 3) {
        specialNums.add(Math.floor(Math.random() * 12) + 2); // 2..13
    }
    playerSpecials = Specials.filter(s => specialNums.has(s.num));

    // Punteggio e monete iniziali
    playerScore = 0;
    playerCoins = 0;

    populateDecks();

    // Numero di buche
    const holes = parseInt(mainMenu.dataset.holes, 10);
    if (!holes || holes < 1) {
        console.error("Numero di buche non valido:", mainMenu.dataset.holes);
        return;
    }

    startTournamentAdventure(holes);
}

function startTournamentAdventure(totalHoles) {
    totalHolesAdventure = totalHoles;
    currentHoleIndexAdventure = 0;
    adventureHoles = [];

    for (let i = 0; i < totalHoles; i++) {
        // Genera par casuale e difficoltà
        const rand = Math.random();
        let par;
        if (rand < 0.3) par = 3;
        else if (rand < 0.7) par = 4;
        else par = 5;

        let difficulty = 1 + Math.floor(i / (totalHoles / 3));
        adventureHoles.push({ par, difficulty, strokes: 0 });
    }

    startAdventureHole(0);
}

function startAdventureHole(index) {
    holes = adventureHoles;           // sovrascrivi l’array globale
    currentHoleIndex = index;         // sincronizza indice globale

    const hole = holes[index];        // ora holes[index] esiste
    if (!hole) {
        console.error("Hole undefined!", index, holes);
        return;
    }

    document.getElementById('holeNumber').innerText = index + 1;

    strokes = 0;
    hole.strokes = 0;
    if (strokesEl) strokesEl.innerText = strokes;

    generateMap(hole.par, hole.difficulty);
    generateWind(hole.difficulty);
    updateWindDisplay();
    render();
}
// Funzione finishAdventureHole aggiornata
function finishAdventureHole() {
    const hole = adventureHoles[currentHoleIndexAdventure];

    // --- Calcolo punti per questa buca (esempio semplice) ---
    const points = 50; // qui puoi aggiungere logica più dettagliata come prima
    playerScore += points;

    // --- Calcolo monete ---
    const coinsEarned = calculateCoins(strokes, hole.par, hole.difficulty);
    playerCoins += coinsEarned;

    // --- Log in console ---
    console.log(`Buca ${currentHoleIndexAdventure + 1}: colpi=${strokes}, par=${hole.par}, difficoltà=${hole.difficulty}`);
    console.log(`Punti guadagnati: ${points}, Monete guadagnate: ${coinsEarned}`);
    console.log(`Totale punti: ${playerScore}, Totale monete: ${playerCoins}`);

    // --- Mostra shop / schermata buca ---
    showAdventureShop();
}

// Array globale per salvare i punteggi buca per buca
let holePointsLog = [];

function finishAdventureHole() {
    const hole = window.adventureHoles?.[currentHoleIndexAdventure];
    if (!hole) return; // se non siamo in avventura, esci subito

    // --- Recupera i punti accumulati durante i tiri (landing vari) ---
    const holePoints = {
        holeNumber: currentHoleIndexAdventure + 1,
        strokes: strokes,
        par: hole.par,
        details: [],
        total: 0
    };

    if (hole.tempPoints) {
        hole.tempPoints.details.forEach(d => holePoints.details.push(d));
        holePoints.total += hole.tempPoints.total;
    }

    // --- Bonus tiri anticipati al green ---
    if (hole.tirosToGreenBeforePar) {
        const bonus = hole.tirosToGreenBeforePar * 100;
        holePoints.details.push({ reason: `Arrivato al green ${hole.tirosToGreenBeforePar} tiri prima del par`, points: bonus });
        holePoints.total += bonus;
    }

    // --- Bonus se non si sono usati speciali ---
    if (!hole.usedSpecial) {
        holePoints.details.push({ reason: "Nessuno speciale usato", points: 10 });
        holePoints.total += 10;
    }

    // --- Bonus par/birdie/eagle ---
    const diff = hole.par - strokes;
    if (strokes === 1) {
        holePoints.details.push({ reason: "Hole in one", points: 1000 });
        holePoints.total += 1000;
    }
    else if (diff === 0) {
        holePoints.details.push({ reason: "Par", points: 50 });
        holePoints.total += 50;
    } else if (diff === 1) {
        holePoints.details.push({ reason: "Birdie", points: 100 });
        holePoints.total += 100;
    } else if (diff === 2) {
        holePoints.details.push({ reason: "Eagle", points: 250 });
        holePoints.total += 250;
    } else if (diff >= 3) {
        holePoints.details.push({ reason: "Albatross", points: 500 });
        holePoints.total += 500;
    } else if (strokes === 1) {
        holePoints.details.push({ reason: "Hole in one", points: 1000 });
        holePoints.total += 1000;
    }

    // --- Calcolo monete ---
    // --- Calcolo difficoltà in base alla buca ---
const totalHoles = adventureHoles.length; 
let difficulty = 1;

if (totalHoles === 9) {
    if (currentHoleIndexAdventure < 3) difficulty = 1;
    else if (currentHoleIndexAdventure < 6) difficulty = 2;
    else difficulty = 3;
} else if (totalHoles === 18) {
    if (currentHoleIndexAdventure < 6) difficulty = 1;
    else if (currentHoleIndexAdventure < 12) difficulty = 2;
    else difficulty = 3;
}

// --- Calcolo monete ---
const coinsEarned = calculateCoins(strokes, hole.par, difficulty);
playerCoins += coinsEarned;
holePoints.details.push({ reason: `Monete guadagnate`, points: coinsEarned });

    // --- Salva log ---
    holePointsLog.push(holePoints);

    // Console log dettagliato
    console.group(`Buca ${holePoints.holeNumber} finita in ${strokes} colpi (par ${hole.par})`);
    holePoints.details.forEach(d => console.log(`${d.reason}: +${d.points}`));
    console.log("Totale punti buca:", holePoints.total);
    console.log("Monete guadagnate:", coinsEarned, "Totali:", playerCoins);
    console.groupEnd();

    // Aggiorna punteggio globale
    playerScore += holePoints.total;

    // Pulisce temp
    delete hole.tempPoints;

    // Vai allo shop o alla prossima buca
    showAdventureShop();
}
    // Funzione per calcolare quante monete si guadagnano in base al risultato e alla difficoltà
    function calculateCoins(strokes, par, difficulty) {
        const diff = par - strokes; // differenza tra par e colpi
        let coins = 0;

        // Mappa difficoltà → premi base
        const rewards = {
            1: { par: 3, birdie: 5, eagle: 8, albatross: 15, holeInOne: 30 },
            2: { par: 6, birdie: 10, eagle: 15, albatross: 23, holeInOne: 40 },
            3: { par: 10, birdie: 15, eagle: 25, albatross: 30, holeInOne: 55 }
        };

        const r = rewards[difficulty] || rewards[1]; // default se difficoltà sconosciuta

        if (strokes === 1) coins = r.holeInOne; // Hole in one
        else if (diff === 3) coins = r.albatross; // Albatross
        else if (diff === 2) coins = r.eagle;   // Eagle
        else if (diff === 1) coins = r.birdie;  // Birdie
        else if (diff === 0) coins = r.par;     // Par
        else if (diff < 0) coins = Math.max(0, r.par + diff); // sopra par, riduci premi ma minimo 0

        return coins;
    }

function registerLanding(tileType) {
    const hole = adventureHoles[currentHoleIndexAdventure];
    if (!hole) return;

    // Assicura che esista già il log della buca
    if (!hole.tempPoints) hole.tempPoints = { details: [], total: 0 };

    let points = 0;
    if (tileType === 'fairway') points = 20;
    else if (tileType === 'rough') points = 10;
    else if(tileType === 'sand') points = 5;


    if (points > 0) {
        hole.tempPoints.details.push({ reason: tileType.charAt(0).toUpperCase() + tileType.slice(1), points });
        hole.tempPoints.total += points;
    }
}
function showAdventureShop() {
    // Rimuove eventuali vecchie modali e overlay
    const oldModal = document.querySelector('.shop-popup');
    if (oldModal) oldModal.remove();

    const oldOverlay = document.querySelector('.modal-overlay');
    if (oldOverlay) oldOverlay.remove();

    // --- Crea overlay ---
    const overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = 999;
    document.body.appendChild(overlay);

    // --- Crea container modale ---
    const container = document.createElement('div');
    container.classList.add('shop-popup');
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.zIndex = 1000;
    container.style.background = '#f5f5f5';
    container.style.padding = '20px';
    container.style.border = '2px solid #333';
    container.style.borderRadius = '10px';
    container.style.width = '600px';
    document.body.appendChild(container);

    // --- Scoreboard buche completate ---
    const frontHoles = adventureHoles.slice(0, Math.min(9, adventureHoles.length));
    const backHoles = adventureHoles.length > 9 ? adventureHoles.slice(9) : [];

    function createScoreRows(holesSubset) {
        const headerRow = document.createElement('div');
        headerRow.classList.add('score-row');
        holesSubset.forEach((h, idx) => {
            const cell = document.createElement('div');
            cell.innerText = `B${idx + 1}`;
            headerRow.appendChild(cell);
        });
        const totalHeader = document.createElement('div');
        totalHeader.innerText = 'Totale';
        headerRow.appendChild(totalHeader);

        const parRow = document.createElement('div');
        parRow.classList.add('score-row');
        let totalPar = 0;
        holesSubset.forEach(h => { parRow.appendChild(createCell(h.par)); totalPar += h.par; });
        parRow.appendChild(createCell(totalPar));

        const scoreRow = document.createElement('div');
        scoreRow.classList.add('score-row');
        let totalStrokes = 0;
        holesSubset.forEach(h => {
            const val = h.strokes > 0 ? h.strokes : '-';
            scoreRow.appendChild(createCell(val));
            if (h.strokes > 0) totalStrokes += h.strokes;
        });
        scoreRow.appendChild(createCell(totalStrokes));

        return [headerRow, parRow, scoreRow];

        function createCell(text) { const div = document.createElement('div'); div.innerText = text; return div; }
    }

    createScoreRows(frontHoles).forEach(el => container.appendChild(el));
    if (backHoles.length > 0) createScoreRows(backHoles).forEach(el => container.appendChild(el));

    // --- Titolo e punteggio buca ---
    const title = document.createElement('h2');
    title.innerText = `Buca ${currentHoleIndexAdventure + 1} completata`;
    container.appendChild(title);

    const holePoints = holePointsLog[currentHoleIndexAdventure];
    if (holePoints) {
        const holeScoreContainer = document.createElement('div');
        holeScoreContainer.style.marginBottom = '10px';
        holeScoreContainer.style.fontWeight = 'bold';
        holePoints.details.forEach(d => {
            const p = document.createElement('div');
            p.innerText = `${d.reason}: +${d.points} punti`;
            holeScoreContainer.appendChild(p);
        });
        const totalDiv = document.createElement('div');
        totalDiv.innerText = `Totale buca: ${holePoints.total}`;
        totalDiv.style.marginTop = '5px';
        totalDiv.style.fontSize = '16px';
        totalDiv.style.fontWeight = 'bold';
        holeScoreContainer.appendChild(totalDiv);
        container.appendChild(holeScoreContainer);
    }

    // --- Totale punti e monete ---
    const statsContainer = document.createElement('div');
    statsContainer.style.display = 'flex';
    statsContainer.style.justifyContent = 'space-between';
    statsContainer.style.margin = '10px 0';
    statsContainer.innerHTML = `
        <div>Punti totali: ${playerScore}</div>
        <div>Monete: ${playerCoins}</div>
    `;
    container.appendChild(statsContainer);

    // --- Shop: due box scrollabili ---
    const shopContainer = document.createElement('div');
    shopContainer.style.display = 'flex';
    shopContainer.style.flexDirection = 'column';
    shopContainer.style.gap = '15px';
    shopContainer.style.marginTop = '20px';

    // calcola difficoltà corrente
    let difficulty = 1;
    const totalHoles = totalHolesAdventure;
    const step = totalHoles === 9 ? 3 : 6;
    if (currentHoleIndexAdventure < step) difficulty = 1;
    else if (currentHoleIndexAdventure < step * 2) difficulty = 2;
    else difficulty = 3;

    const [clubsBox, specialsBox] = populateShopDecks(statsContainer, difficulty);
    shopContainer.appendChild(clubsBox);
    shopContainer.appendChild(specialsBox);
    container.appendChild(shopContainer);

    // --- Pulsante prossima buca / fine partita ---
    const nextBtn = document.createElement('button');
    nextBtn.innerText = currentHoleIndexAdventure + 1 < totalHolesAdventure ? 'Prossima buca' : 'Fine partita';
    nextBtn.classList.add('btn');
    nextBtn.style.marginTop = '20px';
    nextBtn.addEventListener('click', () => {
        container.remove();
        overlay.remove(); // rimuove sempre l'overlay
        currentHoleIndexAdventure++;
        if (currentHoleIndexAdventure < totalHolesAdventure) startAdventureHole(currentHoleIndexAdventure);
        else showAdventureFinalScore();
    });
    container.appendChild(nextBtn);

    document.body.appendChild(container);
}


// --- Funzioni di shop ---
const probabilityTable = { 1: [0.7, 0.25, 0.05], 2: [0.3, 0.5, 0.2], 3: [0.1, 0.3, 0.6] };

function populateShopDecks(statsContainer, difficulty) {
    // Filtra items già posseduti basandosi sul name
    const clubsAvailable = Clubs.filter(c => c.cost > 0 && !playerClubs.some(pc => pc.name === c.name));
    const specialsAvailable = Specials.filter(s => s.cost > 0 && !playerSpecials.some(ps => ps.name === s.name));

    // Console log: cosa può uscire
    console.log("Mazze disponibili nello shop:", clubsAvailable.map(c => c.name));
    console.log("Specials disponibili nello shop:", specialsAvailable.map(s => s.name));

    // Dividi per categorie di prezzo
    const categorize = arr => [
        arr.filter(i => i.cost <= 7),      // categoria 1: prezzo basso
        arr.filter(i => i.cost > 7 && i.cost <= 14), // categoria 2: medio
        arr.filter(i => i.cost > 14)       // categoria 3: alto
    ];

    const clubCategories = categorize(clubsAvailable);
    const specialCategories = categorize(specialsAvailable);

    // Probabilità per difficoltà
    const probabilityTable = {
        1: [0.7, 0.25, 0.05],
        2: [0.3, 0.5, 0.2],
        3: [0.1, 0.3, 0.6]
    };
    const weights = probabilityTable[difficulty];

    // Funzione per selezionare n items casuali ponderati per categoria
    const pickWeighted = (categories, count = 3) => {
        const selected = [];
        const catCopy = categories.map(cat => [...cat]); // copia locale
        while (selected.length < count && catCopy.some(cat => cat.length > 0)) {
            const catIndex = weightedRandomIndex(weights);
            if (catCopy[catIndex].length > 0) {
                const itemIndex = Math.floor(Math.random() * catCopy[catIndex].length);
                selected.push(catCopy[catIndex][itemIndex]);
                catCopy[catIndex].splice(itemIndex, 1);
            }
        }
        return selected;
    };

    const clubsSelected = pickWeighted(clubCategories, 3);
    const specialsSelected = pickWeighted(specialCategories, 3);

    return createShopBoxes(clubsSelected, specialsSelected, statsContainer);
}

// Funzione helper per pesi
function weightedRandomIndex(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        if (r < weights[i]) return i;
        r -= weights[i];
    }
    return weights.length - 1;
}

// Funzione di creazione box identica a prima
function createShopBoxes(clubs, specials, statsContainer) {
    const createBox = (items, type) => {
        const box = document.createElement('div');
        box.style.display = 'flex';
        box.style.overflowX = 'auto';
        box.style.gap = '10px';
        box.style.padding = '5px 0';

        items.forEach(i => {
            const el = document.createElement('div');
            el.classList.add('card');
            el.style.flex = '0 0 auto';
            el.tabIndex = 0;

            if (type === 'club') {
                if (i.id === 'driver') el.classList.add('driver');
                else if (i.id.startsWith('wood')) el.classList.add('wood');
                else if (i.id.startsWith('iron')) el.classList.add('iron');
                else if (['wedge', 'sand', 'pitch', 'putt'].includes(i.id)) el.classList.add(i.id);

                el.innerHTML = `
                    <div class="title">${i.name}</div>
                    <div class="sub">⛳ ${i.distance || i.power} | ↘ ${i.roll || '-'} | 🎯 ${(i.accuracy ? i.accuracy * 100 : 0).toFixed(0)}%</div>
                    <div class="desc">📝 ${i.desc || ''}</div>
                    <div class="price">💰 ${i.cost} monete</div>
                `;
            } else {
                el.innerHTML = `
                    <div class="title">${i.name}</div>
                    <div class="sub">✨ ${i.desc}</div>
                    <div class="price">💰 ${i.cost} monete</div>
                `;
            }

            el.addEventListener('click', () => {
                if (playerCoins >= i.cost) {
                    playerCoins -= i.cost;
                    if (type === 'club') playerClubs.push(i);
                    else playerSpecials.push(i);
                    statsContainer.innerHTML = `
                        <div>Punti totali: ${playerScore}</div>
                        <div>Monete: ${playerCoins}</div>
                    `;
                    el.style.opacity = 0.5;
                    el.style.pointerEvents = 'none';
                    populateDecks();
                } else alert("Monete insufficienti!");
            });

            box.appendChild(el);
        });

        return box;
    };

    return [createBox(clubs, 'club'), createBox(specials, 'special')];
}