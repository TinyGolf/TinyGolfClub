// --- Riferimenti principali ---
const mainMenu = document.getElementById('mainMenu');
const rulesMenu = document.getElementById('rulesMenu');
const backToMenuBtn = document.getElementById('backToMenuBtn');

let selectedHoles = null;
let selectedMode = null;

// Stato torneo globale
let playerClubs = [];
let playerSpecials = [];
let currentHoleIndex = 0;
let totalHoles = 9;
let holes = [];
let strokes = 0;
let holePointsLog = [];

window.addEventListener('load', () => {
    mainMenu.style.display = 'flex';
    strokesEl = document.querySelector('#strokes');
});
// --- Pulsante "Regole" ---
document.getElementById('rulesBtn').addEventListener('click', () => {
    mainMenu.style.display = 'none';
    rulesMenu.style.display = 'flex';
});

// --- Torna al menu principale ---
backToMenuBtn.addEventListener('click', () => {
    rulesMenu.style.display = 'none';
    mainMenu.style.display = 'flex';

    // Resetta solo lo stato dei pulsanti, non il torneo
    mainMenu.querySelectorAll('[data-holes]').forEach(btn => btn.style.background = '');
    mainMenu.querySelectorAll('[data-mode]').forEach(btn => btn.style.background = '');
    selectedHoles = null;
    selectedMode = null;
});

// --- Selezione numero di buche ---
mainMenu.querySelectorAll('[data-holes]').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedHoles = parseInt(btn.dataset.holes, 10);
        mainMenu.dataset.holes = selectedHoles;
        mainMenu.querySelectorAll('[data-holes]').forEach(b => b.style.background = '');
        btn.style.background = '#28a745';
        checkStart();
    });
});

// --- Selezione modalità ---
mainMenu.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedMode = btn.dataset.mode;
        mainMenu.querySelectorAll('[data-mode]').forEach(b => b.style.background = '');
        btn.style.background = '#28a745';
        checkStart();
    });
});

function showMessage(message, callback) {
    // Rimuovi eventuale finestra precedente
    const old = document.querySelector('.custom-alert');
    if (old) old.remove();

    // Contenitore overlay
    const overlay = document.createElement('div');
    overlay.classList.add('menu-overlay', 'custom-alert'); // riusa lo stile overlay
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';

    // Finestra
    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '1.5rem';
    box.style.borderRadius = '12px';
    box.style.textAlign = 'center';
    box.style.maxWidth = '300px';
    box.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';

    // Messaggio
    const text = document.createElement('p');
    text.innerText = message;
    text.style.marginBottom = '1rem';
    box.appendChild(text);

    // Pulsante OK
    const okBtn = document.createElement('button');
    okBtn.innerText = 'OK';
    okBtn.classList.add('menu-btn');
    okBtn.addEventListener('click', () => {
        overlay.remove();
        if (callback) callback();
    });
    box.appendChild(okBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function resetGameState() {
    console.log("🔄 Hard reset stato di gioco...");

    // --- Rimuovi eventuali elementi dinamici dal DOM (scoreboard, shop, overlay ecc.)
    document.querySelectorAll('.scoreboard, .shop, .overlay').forEach(el => el.remove());

    // --- Reset variabili globali torneo classico ---
    holes = [];
    currentHoleIndex = 0;
    totalHoles = 0;
    strokes = 0;

    // --- Reset variabili globali avventura ---
    adventureHoles = [];
    currentHoleIndexAdventure = 0;
    totalHolesAdventure = 0;
    holePointsLog = [];

    // --- Reset giocatore ---
    playerClubs = [];
    playerSpecials = [];
    playerScore = 0;
    playerCoins = 0;

    // --- Stato di gioco generale ---
    puttMode = false;
    currentGrid = null;
    slopeGrid = null;
    viewRowStart = 0;
    ball = { row: 0, col: 0 };

    // --- UI: ripristina menu ---
    if (mainMenu) {
        mainMenu.style.display = 'flex';
        mainMenu.querySelectorAll('[data-holes]').forEach(btn => btn.style.background = '');
        mainMenu.querySelectorAll('[data-mode]').forEach(btn => btn.style.background = '');
    }
    if (rulesMenu) rulesMenu.style.display = 'none';

    const holeNumberEl = document.getElementById('holeNumber');
    if (holeNumberEl) holeNumberEl.innerText = '-';

    const strokesEl = document.getElementById('strokes');
    if (strokesEl) strokesEl.innerText = '0';

    // --- Rimuovi eventuali animazioni in corso (requestAnimationFrame) ---
    let rafId = window.requestAnimationFrame(() => { });
    while (rafId--) {
        window.cancelAnimationFrame(rafId);
    }

    // --- Rimuovi tutti i setTimeout / setInterval ancora attivi ---
    let highestTimeoutId = setTimeout(";");
    for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i);
        clearInterval(i);
    }

    // --- Resetta scelte menu ---
    selectedHoles = null;
    selectedMode = null;

    console.log("✅ Stato riportato a zero");
}

function resetHoleState() {
    puttMode = false;
    currentGrid = null;
    slopeGrid = null;

    // Se ball ha proprietà zoom, resetta
    if (ball) {
        ball.rowZoom = null;
        ball.colZoom = null;
    }

    // Eventuali timeout o animationFrame pendenti
    let highestTimeoutId = setTimeout(";");
    for (let i = 0; i <= highestTimeoutId; i++) {
        clearTimeout(i);
        clearInterval(i);
        cancelAnimationFrame(i);
    }
}

function clearPreviousHoleUI() {
    // Rimuove vecchi overlay, shop, modali
    document.querySelectorAll('.shop-popup, .modal-overlay, .scoreboard').forEach(el => el.remove());

    // Se usi canvas per la mappa, puliscilo
    const canvas = document.getElementById('mapCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// --- Avvia gioco solo se entrambe le scelte sono fatte ---
// --- Avvia gioco quando entrambe le scelte sono fatte ---
function checkStart() {
    console.log("🟢 checkStart chiamata");
    console.log("Selected Holes:", selectedHoles, "Selected Mode:", selectedMode);

    if (selectedHoles && selectedMode) {
        console.log("Nascondo menu principale");
        mainMenu.style.display = 'none';

        if (selectedMode === 'adventure') {
            console.log("Parto modalità Adventure");
            startTournamentAdventure(selectedHoles);
        } else {
            console.log("Parto modalità Tournament classica");
            startTournament(selectedHoles, selectedMode);
        }
    } else {
        console.warn("⚠️ checkStart: selezioni incomplete");
    }
}
function generatePars(totalHoles) {
    const pars = [];

    if (totalHoles === 9) {
        pars.push(...Array(2).fill(3)); // 2 par 3
        pars.push(...Array(5).fill(4)); // 5 par 4
        pars.push(...Array(2).fill(5)); // 2 par 5
    } else if (totalHoles === 18) {
        pars.push(...Array(4).fill(3)); // 4 par 3
        pars.push(...Array(10).fill(4)); // 10 par 4
        pars.push(...Array(4).fill(5)); // 4 par 5
    } else {
        // fallback: tutte par 4
        pars.push(...Array(totalHoles).fill(4));
    }

    // Mescola i par
    for (let i = pars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pars[i], pars[j]] = [pars[j], pars[i]];
    }

    return pars;
}

// --- Inizializza torneo classico ---
function startTournament(numHoles, mode) {
    console.log("🏌️ Avvio torneo classico:", numHoles, "buche, modalità:", mode);

    playerClubs = [...Clubs];
    playerSpecials = [...Specials];
    populateDecks();

    totalHoles = numHoles;
    currentHoleIndex = 0;
    holes = [];

    console.log("Generazione buche...");
    const pars = generatePars(totalHoles);
    for (let i = 0; i < totalHoles; i++) {
        let difficulty = totalHoles === 9 ? (i < 3 ? 1 : (i < 6 ? 2 : 3)) : (i < 6 ? 1 : (i < 12 ? 2 : 3));
        holes.push({ par: pars[i], difficulty, strokes: 0 });
    }
    console.log("Pronta a partire prima buca");
    startHole(currentHoleIndex);
}

// --- Avvia singola buca ---
function startHole(index) {
    const hole = holes[index];
    if (!hole) {
        console.warn("startHole chiamata ma hole undefined!", index, holes);
        return;
    }

    console.log("Inizio buca", index + 1, "Par:", hole.par, "Difficoltà:", hole.difficulty);

    currentHoleIndex = index;
    strokes = 0;
    hole.strokes = 0;

    updateHUD(index, strokes);
    generateMap(hole.par, hole.difficulty);
    generateWind(hole.difficulty);
    updateWindDisplay();
    render();
}
function updateHUD(index, strokes) {
    const holeNumberEl = document.getElementById('holeNumber');
    if (holeNumberEl) holeNumberEl.innerText = index + 1;

    const strokesEl = document.getElementById('strokes');
    if (strokesEl) strokesEl.innerText = strokes;
}

// --- Termina buca e mostra scoreboard ---
function finishHole() {
    showScoreboard();
}

// --- Mostra scoreboard (incluso pulsante Prossima buca) ---
function showScoreboard() {
    // --- Rimuovi eventuali UI precedenti ---
    document.querySelectorAll('.scoreboard, .shop-popup, .modal-overlay').forEach(el => el.remove());

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

    // --- Container scoreboard ---
    const container = document.createElement('div');
    container.classList.add('scoreboard');
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.background = '#f5f5f5';
    container.style.padding = '20px';
    container.style.border = '2px solid #333';
    container.style.borderRadius = '10px';
    container.style.width = '400px';
    container.style.zIndex = 1000;
    document.body.appendChild(container);

    // --- Calcola stato buca ---
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

    const resultStyle = {
        'Hole in One': { color: '#ffd700', fontSize: '1.5rem', fontWeight: 'bold' },
        'Albatross': { color: '#8a2be2', fontSize: '1.4rem', fontWeight: 'bold' },
        'Eagle': { color: '#1e90ff', fontSize: '1.3rem', fontWeight: 'bold' },
        'Birdie': { color: '#00bfff', fontSize: '1.2rem', fontWeight: 'bold' },
        'Par': { color: '#7cfc00', fontSize: '1rem', fontWeight: 'bold' },
        'Bogey': { color: '#ffff00', fontSize: '1rem', fontWeight: 'bold' },
        'Doppio Bogey': { color: '#ff8c00', fontSize: '1rem', fontWeight: 'bold' },
        'Triplo Bogey': { color: '#ff0000', fontSize: '1rem', fontWeight: 'bold' }
    };
    const style = resultStyle[resultText] || { color: '#000', fontSize: '1rem', fontWeight: 'bold' };

    // --- Info buca ---
    const infoRow = document.createElement('div');
    infoRow.classList.add('score-info');
    infoRow.innerText = `Buca ${currentHoleIndex + 1}: ${resultText}`;
    infoRow.style.color = style.color;
    infoRow.style.fontSize = style.fontSize;
    infoRow.style.fontWeight = style.fontWeight;
    infoRow.style.marginBottom = '1rem';
    container.appendChild(infoRow);

    // --- Funzione creazione righe punteggi ---
    function createScoreRows(holesSubset) {
        const headerRow = document.createElement('div');
        headerRow.classList.add('score-row');
        holesSubset.forEach((h, idx) => {
            const cell = document.createElement('div');
            cell.innerText = `B${idx + 1}`;
            cell.style.fontSize = '1rem';
            headerRow.appendChild(cell);
        });
        const totalHeader = document.createElement('div');
        totalHeader.innerText = 'Totale';
        totalHeader.style.fontSize = '1rem';
        headerRow.appendChild(totalHeader);

        const parRow = document.createElement('div');
        parRow.classList.add('score-row');
        let totalPar = 0;
        holesSubset.forEach(h => {
            const cell = document.createElement('div');
            cell.innerText = h.par;
            cell.style.fontSize = '1rem';
            parRow.appendChild(cell);
            totalPar += h.par;
        });
        const totalParCell = document.createElement('div');
        totalParCell.innerText = totalPar;
        totalParCell.style.fontSize = '1rem';
        parRow.appendChild(totalParCell);

        const scoreRow = document.createElement('div');
        scoreRow.classList.add('score-row');
        let totalStrokes = 0;
        holesSubset.forEach(h => {
            const cell = document.createElement('div');
            cell.innerText = h.strokes > 0 ? h.strokes : '-';
            cell.style.fontSize = '1rem';
            scoreRow.appendChild(cell);
            if (h.strokes > 0) totalStrokes += h.strokes;
        });
        const totalStrokesCell = document.createElement('div');
        totalStrokesCell.innerText = totalStrokes;
        totalStrokesCell.style.fontSize = '1rem';
        scoreRow.appendChild(totalStrokesCell);

        return [headerRow, parRow, scoreRow];
    }

    // --- Front e Back 9 ---
    const frontHoles = holes.slice(0, 9);
    const backHoles = holes.length > 9 ? holes.slice(9, 18) : [];
    createScoreRows(frontHoles).forEach(el => container.appendChild(el));
    if (backHoles.length > 0) createScoreRows(backHoles).forEach(el => container.appendChild(el));

    // --- Pulsante Next Hole / Fine partita ---
    const nextBtn = document.createElement('button');
    nextBtn.innerText = currentHoleIndex + 1 < holes.length ? 'Prossima buca' : 'Fine partita';
    nextBtn.classList.add('btn', 'next-hole-btn');
    nextBtn.style.marginTop = '20px';
    container.appendChild(nextBtn);

    nextBtn.addEventListener('click', () => {
        nextBtn.disabled = true; // previene doppi click
        console.log("🔹 Click Next Hole");
        console.log("Indice buca prima incremento:", currentHoleIndex);
        console.log("Totale buche:", holes.length);

        try {
            // --- Pulisci overlay e scoreboard ---
            document.querySelectorAll('.scoreboard, .modal-overlay, .shop-popup').forEach(el => el.remove());

            // --- Pulisci animazioni / timer ---
            if (window.activeRafId) {
                cancelAnimationFrame(window.activeRafId);
                window.activeRafId = null;
            }
            let highestTimeoutId = setTimeout(";");
            for (let i = 0; i < highestTimeoutId; i++) {
                clearTimeout(i);
                clearInterval(i);
            }

            // --- Reset stato buca ---
            puttMode = false;
            currentGrid = null;
            slopeGrid = null;
            ball.rowZoom = null;
            ball.colZoom = null;

            // --- Avanza indice ---
            currentHoleIndex++;
            console.log("Indice buca dopo incremento:", currentHoleIndex);

            if (currentHoleIndex >= holes.length) {
                console.log("🏁 Fine partita");
                showFinalScores();
                return;
            }

            console.log(`➡️ Partenza buca ${currentHoleIndex + 1}`);
            startHole(currentHoleIndex);
        } catch (err) {
            console.error("Errore nel Next Hole:", err);
            showFinalScores();
        }
    });
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

    // Pulsante restart
    const restartBtn = document.createElement('button');
    restartBtn.innerText = 'Ricomincia partita';
    restartBtn.classList.add('btn');
    restartBtn.style.marginTop = '20px';
    restartBtn.addEventListener('click', () => {
        container.remove();

        // Reset globale stato partita
        resetGameState();

        // Mostra di nuovo il main menu
        mainMenu.style.display = 'flex';
        rulesMenu.style.display = 'none';

        // Reset selezioni e pulsanti
        selectedHoles = null;
        selectedMode = null;
        mainMenu.querySelectorAll('[data-holes]').forEach(btn => btn.style.background = '');
        mainMenu.querySelectorAll('[data-mode]').forEach(btn => btn.style.background = '');
    });


    container.appendChild(restartBtn);

    document.body.appendChild(container);
}
// Al caricamento mostra subito menu


function startTournamentAdventure() {
    console.log("🏌️ Avvio modalità Adventure");

    // --- Mazze iniziali ---
    const getRandomClub = (minNum, maxNum) => {
        const options = Clubs.filter(c => c.num >= minNum && c.num <= maxNum);
        return options[Math.floor(Math.random() * options.length)];
    };

    const initialClubs = [
        getRandomClub(2, 4),      // legno casuale
        getRandomClub(7, 11),     // ferro casuale
        getRandomClub(13, 15),    // sand/pitch/wedge
        Clubs.find(c => c.num === 16) // putter fisso
    ];

    playerClubs = initialClubs;

    // --- Carte speciali iniziali ---
    const allowedSpecials = [2, 6, 8, 9, 10, 11, 12]; // solo questi numeri
    const specialNums = new Set([1]); // 1 sempre incluso
    while (specialNums.size < 4) {
        const pick = allowedSpecials[Math.floor(Math.random() * allowedSpecials.length)];
        specialNums.add(pick);
    }

    playerSpecials = Specials.filter(s => specialNums.has(s.num));

    // --- Reset punteggio e monete ---
    playerScore = 0;
    playerCoins = 0;

    populateDecks(); // popoliamo il deck con mazze e speciali

    // --- Numero di buche ---
    const total = parseInt(mainMenu.dataset.holes, 10);
    if (!total || total < 1) {
        console.error("Numero di buche non valido:", mainMenu.dataset.holes);
        return;
    }

    // --- Generazione buche adventure ---
    totalHolesAdventure = total;
    currentHoleIndexAdventure = 0;
    holes = [];

    console.log("Generazione buche...");
    const pars = generatePars(total);
    for (let i = 0; i < total; i++) {
        let difficulty = total === 9 ? (i < 3 ? 1 : (i < 6 ? 2 : 3)) : (i < 6 ? 1 : (i < 12 ? 2 : 3));
        holes.push({ par: pars[i], difficulty, strokes: 0 });
    }
    console.log("Pronta a partire prima buca Adventure");
    startHole(0);
}

// Funzione finishAdventureHole aggiornata
function finishAdventureHole() {
    const hole = holes[currentHoleIndex];
    if (!hole) {
        console.error("❌ Nessuna buca trovata in Adventure:", currentHoleIndex, holes);
        return;
    }

    const holePoints = {
        holeNumber: currentHoleIndex + 1,
        strokes: strokes,
        par: hole.par,
        details: [],
        total: 0
    };

    if (hole.tempPoints) {
        hole.tempPoints.details.forEach(d => holePoints.details.push(d));
        holePoints.total += hole.tempPoints.total;
    }

    // Bonus par/birdie/eagle ecc.
    const diff = hole.par - strokes;
    if (strokes === 1) {
        holePoints.details.push({ reason: "Hole in one", points: 1000 });
        holePoints.total += 1000;
    } else if (diff === 0) {
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
    } else if (diff === -1) {
        holePoints.details.push({ reason: "Bogey", points: 25 });
        holePoints.total += 25;
    } else if (diff === -2) {
        holePoints.details.push({ reason: "Doppio Bogey", points: 15 });
        holePoints.total += 15;
    } else if (diff <= -3) {
        holePoints.details.push({ reason: "Triplo Bogey", points: 5 });
        holePoints.total += 5;
    }

    // --- Calcolo difficoltà ---
    const totalHoles = holes.length;
    let difficulty = 1;
    if (totalHoles === 9) {
        if (currentHoleIndex < 3) difficulty = 1;
        else if (currentHoleIndex < 6) difficulty = 2;
        else difficulty = 3;
    } else if (totalHoles === 18) {
        if (currentHoleIndex < 6) difficulty = 1;
        else if (currentHoleIndex < 12) difficulty = 2;
        else difficulty = 3;
    }

    // --- Calcolo monete ---
    const coinsEarned = calculateCoins(strokes, hole.par, difficulty);
    playerCoins += coinsEarned;
    holePoints.details.push({ reason: `Monete guadagnate`, points: coinsEarned });

    // --- Salva log ---
    holePointsLog.push(holePoints);

    console.group(`🏌️‍♂️ Buca ${holePoints.holeNumber} finita in ${strokes} colpi (par ${hole.par})`);
    holePoints.details.forEach(d => console.log(`${d.reason}: +${d.points}`));
    console.log("Totale punti buca:", holePoints.total);
    console.log("Monete guadagnate:", coinsEarned, "Totali:", playerCoins);
    console.groupEnd();

    playerScore += holePoints.total;
    delete hole.tempPoints;

    // Vai allo shop
    showAdventureShop();
}
    // Funzione per calcolare quante monete si guadagnano in base al risultato e alla difficoltà
    function calculateCoins(strokes, par, difficulty) {
        const diff = par - strokes; // differenza tra par e colpi
        let coins = 0;

        // Mappa difficoltà → premi base
        const rewards = {
            1: { subPar:1, par: 3, birdie: 5, eagle: 8, albatross: 15, holeInOne: 30 },
            2: { subPar: 3, par: 6, birdie: 10, eagle: 15, albatross: 23, holeInOne: 40 },
            3: { subPar: 5, par: 10, birdie: 15, eagle: 25, albatross: 30, holeInOne: 55 }
        };

        const r = rewards[difficulty] || rewards[1]; // default se difficoltà sconosciuta

        if (strokes === 1) coins = r.holeInOne; // Hole in one
        else if (diff === 3) coins = r.albatross; // Albatross
        else if (diff === 2) coins = r.eagle;   // Eagle
        else if (diff === 1) coins = r.birdie;  // Birdie
        else if (diff === 0) coins = r.par;     // Par
        else if (diff < 0) coins =r.subPar; // sopra par, riduci premi ma minimo 0

        return coins;
    }

function registerLanding(tileType) {
    const hole = adventureHoles[currentHoleIndexAdventure];
    if (!hole) return;

    // Assicura che esista già il log della buca
    if (!hole.tempPoints) hole.tempPoints = { details: [], total: 0 };

    let points = 0;
    if (tileType === 'fairway') points = 20;
    else if (tileType === 'rough') points = -5;
    else if (tileType === 'sand') points = -10;
    else if (tileType === 'water') points = -20;



    hole.tempPoints.details.push({ reason: tileType.charAt(0).toUpperCase() + tileType.slice(1), points });
    hole.tempPoints.total += points;
}
function showAdventureShop() {
    // Rimuove eventuali vecchie modali e overlay
    document.querySelectorAll('.shop-popup, .modal-overlay').forEach(el => el.remove());

    // --- Crea overlay ---
    const overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 999
    });
    document.body.appendChild(overlay);

    // --- Crea container modale ---
    const container = document.createElement('div');
    container.classList.add('shop-popup');
    Object.assign(container.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: '#f5f5f5',
        padding: '20px',
        border: '2px solid #333',
        borderRadius: '10px',
        width: '600px'
    });
    document.body.appendChild(container);

    // --- Recupera buca corrente ---
    const currentHole = holes[currentHoleIndex];
    const diff = currentHole.strokes - currentHole.par;

    // --- Titolo con risultato della buca ---
    let resultText = '';
    if (currentHole.strokes === 1) resultText = 'Hole in One';
    else if (diff <= -3) resultText = 'Albatross';
    else if (diff === -2) resultText = 'Eagle';
    else if (diff === -1) resultText = 'Birdie';
    else if (diff === 0) resultText = 'Par';
    else if (diff === 1) resultText = 'Bogey';
    else if (diff === 2) resultText = 'Doppio Bogey';
    else if (diff >= 3) resultText = 'Triplo Bogey';

    const resultStyle = {
        'Hole in One': { color: '#ffd700', fontSize: '2rem', fontWeight: 'bold' },
        'Albatross': { color: '#8a2be2', fontSize: '1.8rem', fontWeight: 'bold' },
        'Eagle': { color: '#1e90ff', fontSize: '1.6rem', fontWeight: 'bold' },
        'Birdie': { color: '#00bfff', fontSize: '1.5rem', fontWeight: 'bold' },
        'Par': { color: '#7cfc00', fontSize: '1.3rem', fontWeight: 'bold' },
        'Bogey': { color: '#ffff00', fontSize: '1.3rem', fontWeight: 'bold' },
        'Doppio Bogey': { color: '#ff8c00', fontSize: '1.3rem', fontWeight: 'bold' },
        'Triplo Bogey': { color: '#ff0000', fontSize: '1.3rem', fontWeight: 'bold' }
    };

    const style = resultStyle[resultText] || { color: '#000', fontSize: '1.3rem', fontWeight: 'bold' };
    const infoRow = document.createElement('div');
    infoRow.classList.add('score-info');
    infoRow.innerText = `Buca ${currentHoleIndex + 1}: ${resultText}`;
    Object.assign(infoRow.style, {
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        marginBottom: '1rem'
    });
    container.appendChild(infoRow);

    // --- Scoreboard buche completate ---
    const frontHoles = holes.slice(0, Math.min(9, holes.length));
    const backHoles = holes.length > 9 ? holes.slice(9) : [];

    function createScoreRows(holesSubset) {
        const headerRow = document.createElement('div');
        headerRow.classList.add('score-row');
        holesSubset.forEach((h, idx) => {
            const cell = document.createElement('div');
            cell.innerText = `B${idx + 1}`;
            cell.style.fontSize = '1rem';
            headerRow.appendChild(cell);
        });
        const totalHeader = document.createElement('div');
        totalHeader.innerText = 'Totale';
        totalHeader.style.fontSize = '1rem';
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

        function createCell(text) {
            const div = document.createElement('div');
            div.innerText = text;
            div.style.fontSize = '1rem';
            return div;
        }
    }

    createScoreRows(frontHoles).forEach(el => container.appendChild(el));
    if (backHoles.length > 0) createScoreRows(backHoles).forEach(el => container.appendChild(el));

    // --- Dettagli punti della buca e monete ---
    const holePoints = holePointsLog[currentHoleIndex];
    if (holePoints) {
        const holeScoreContainer = document.createElement('div');
        Object.assign(holeScoreContainer.style, { marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1rem' });

        const totalDiv = document.createElement('div');
        totalDiv.innerText = `Totale buca: ${holePoints.total}`;
        totalDiv.style.marginBottom = '0.5rem';
        totalDiv.style.fontSize = '1.1rem';
        holeScoreContainer.appendChild(totalDiv);

        holePoints.details.forEach(d => {
            const p = document.createElement('div');
            p.innerText = d.reason.toLowerCase().includes("monete") ? `${d.reason}: +${d.points} monete` : `${d.reason}: ${d.points} punti`;
            holeScoreContainer.appendChild(p);
        });

        container.appendChild(holeScoreContainer);
    }

    // --- Stats container ---
    const statsContainer = document.createElement('div');
    Object.assign(statsContainer.style, {
        display: 'flex',
        justifyContent: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        margin: '1rem 0 0.5rem 0'
    });
    statsContainer.innerText = `Monete: ${playerCoins}`;
    container.appendChild(statsContainer);

    // --- Shop: club e special ---
    const shopContainer = document.createElement('div');
    Object.assign(shopContainer.style, { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' });

    const totalHolesCount = holes.length;
    const step = totalHolesCount === 9 ? 3 : 6;
    let difficulty = currentHoleIndex < step ? 1 : currentHoleIndex < step * 2 ? 2 : 3;

    const [clubsBox, specialsBox] = populateShopDecks(statsContainer, difficulty);
    shopContainer.appendChild(clubsBox);
    shopContainer.appendChild(specialsBox);
    container.appendChild(shopContainer);

    // --- Pulsante prossima buca / fine partita ---
    const nextBtn = document.createElement('button');
    nextBtn.innerText = currentHoleIndex + 1 < holes.length ? 'Prossima buca' : 'Fine partita';
    nextBtn.classList.add('btn', 'next-hole-btn');
    nextBtn.addEventListener('click', () => {
        console.log("🔹 Click Next Hole");
        console.log("Current hole index before increment:", currentHoleIndex);
        console.log("Total holes:", holes.length);
        console.log("Putt mode:", puttMode);
        console.log("Overlay/modale presenti:", document.querySelectorAll('.modal-overlay, .shop-popup').length);

        try {
            // --- Pulizia UI precedente ---
            document.querySelectorAll('.shop-popup, .modal-overlay').forEach(el => el.remove());

            // --- Pulizia animazioni / timer ---
            if (window.activeRafId) {
                cancelAnimationFrame(window.activeRafId);
                window.activeRafId = null;
            }
            let highestTimeoutId = setTimeout(";");
            for (let i = 0; i < highestTimeoutId; i++) {
                clearTimeout(i);
                clearInterval(i);
            }

            // --- Reset stato buca ---
            puttMode = false;
            currentGrid = null;
            slopeGrid = null;
            ball.rowZoom = null;
            ball.colZoom = null;

            // --- Avanza indice buca ---
            currentHoleIndex++;
            console.log("Current hole index after increment:", currentHoleIndex);

            if (currentHoleIndex >= holes.length) {
                console.log("🏁 Fine avventura o torneo");
                showAdventureFinalScore();
                return;
            }

            console.log(`➡️ Partenza buca ${currentHoleIndex + 1}`);
            startHole(currentHoleIndex);
        } catch (err) {
            console.error("Errore durante avanzamento buca:", err);
            showAdventureFinalScore();
        }
    });

    container.appendChild(nextBtn);
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
    const specialClassMap = {
        'normale': 'normale',
        'power': 'power',
        'spin': 'spin',
        'special': 'special',
        'curve': 'curve'
    };

    const createBox = (items, type) => {
        const box = document.createElement('div');
        box.style.display = 'flex';
        box.style.overflowX = 'auto';
        box.style.gap = '10px';
        box.style.padding = '5px 0';

        items.forEach(i => {
            const el = document.createElement('div');
            el.classList.add('card'); // base per tutte le card
            el.style.flex = '0 0 auto';
            el.tabIndex = 0;

            if (type === 'club') {
                // Assegna classe colore mazze
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
                // Assegna classe colore specials
                if (specialClassMap[i.id]) el.classList.add(specialClassMap[i.id]);

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

function showAdventureFinalScore() {
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
    container.style.width = '350px';
    container.style.margin = '40px auto';

    // Calcola punteggi totali
    let totalStrokes = 0;
    let totalPar = 0;
    adventureHoles.forEach(h => {
        totalStrokes += h.strokes || 0;
        totalPar += h.par || 0;
    });

    const diff = totalStrokes - totalPar;
    const diffText = diff < 0 ? `${Math.abs(diff)} sotto al par` :
        diff > 0 ? `${diff} sopra al par` : 'par';

    // Titolo
    const title = document.createElement('h2');
    title.innerText = 'Complimenti!';
    container.appendChild(title);

    // Punteggio colpi
    const scoreP = document.createElement('p');
    scoreP.innerText = `Hai finito la partita con ${totalStrokes} colpi.`;
    container.appendChild(scoreP);

    // Par totale
    const parP = document.createElement('p');
    parP.innerText = `Par totale: ${totalPar} (${diffText})`;
    container.appendChild(parP);

    // Punti accumulati
    const pointsP = document.createElement('p');
    pointsP.innerText = `Punti totali: ${playerScore}`;
    container.appendChild(pointsP);

    // Conversione monete → punti
    const bonusFromCoins = playerCoins * 10;
    const coinsP = document.createElement('p');
    coinsP.innerText = `Monete rimaste: ${playerCoins} (bonus ${bonusFromCoins} punti)`;
    container.appendChild(coinsP);

    // Totale finale
    const finalTotal = playerScore + bonusFromCoins;
    const finalP = document.createElement('p');
    finalP.innerText = `Punteggio finale: ${finalTotal}`;
    finalP.style.fontWeight = 'bold';
    finalP.style.marginTop = '10px';
    container.appendChild(finalP);

    // Pulsante restart
    const restartBtn = document.createElement('button');
    restartBtn.innerText = 'Ricomincia partita';
    restartBtn.classList.add('btn');
    restartBtn.style.marginTop = '20px';
    restartBtn.addEventListener('click', () => {
        container.remove();

        // Reset globale stato partita
        resetGameState();

        // Mostra di nuovo il main menu
        mainMenu.style.display = 'flex';
        rulesMenu.style.display = 'none';

        // Reset selezioni e pulsanti
        selectedHoles = null;
        selectedMode = null;
        mainMenu.querySelectorAll('[data-holes]').forEach(btn => btn.style.background = '');
        mainMenu.querySelectorAll('[data-mode]').forEach(btn => btn.style.background = '');
    });

    container.appendChild(restartBtn);

    document.body.appendChild(container);
}
