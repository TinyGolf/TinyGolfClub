// Impostazioni torneo
let totalHoles = 9; // o 18
let currentHoleIndex = 0;
// Array di oggetti buca: { par: 3|4|5, difficulty: 1|2|3, strokes: 0 }
let holes = [];
let strokes = 0; // colpi della buca corrente

// Score globale
let scores = [];

function askHoles() {
    const choice = prompt("Quante buche vuoi giocare? 9 o 18", "9");
    const numHoles = (choice === "18") ? 18 : 9;
    startTournament(numHoles);
}
window.addEventListener('load', () => {
    strokesEl = document.querySelector('#strokes'); // l’elemento span nel header
    askHoles();
});

function startTournament(selectedHoles) {
    totalHoles = selectedHoles; // 9 o 18
    currentHoleIndex = 0;
    holes = [];
    scores = [];

    // Genera array par con frequenze: 40% par4, 30% par3, 30% par5
    for (let i = 0; i < totalHoles; i++) {
        const rand = Math.random();
        let par;
        if (rand < 0.3) par = 3;
        else if (rand < 0.7) par = 4;
        else par = 5;

        // Imposta difficoltà a scaglioni
        let difficulty;
        if (totalHoles === 9) {
            if (i < 3) difficulty = 1;
            else if (i < 6) difficulty = 2;
            else difficulty = 3;
        } else if (totalHoles === 18) {
            if (i < 6) difficulty = 1;
            else if (i < 12) difficulty = 2;
            else difficulty = 3;
        }

        holes.push({ par, difficulty, strokes: 0 });
    }

    // Inizia prima buca
    startHole(currentHoleIndex);
}

function startHole(index) {
    const hole = holes[index];
    document.getElementById('holeNumber').innerText = index + 1;

    // reset colpi buca corrente
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
    console.log(`Buca ${currentHoleIndex + 1} finita in ${strokes} colpi (par ${holes[currentHoleIndex].par})`);
    // Non incrementare currentHoleIndex qui: lo fa il pulsante "Prossima buca"
}

function showScoreboard() {
    console.log("Mostra scoreboard");
    const old = document.querySelector('.scoreboard');
    if (old) old.remove();

    const container = document.createElement('div');
    container.classList.add('scoreboard');

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
