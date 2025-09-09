(function () {
    'use strict';
    window.addEventListener('DOMContentLoaded', () => {
        const clubs = window.Clubs;
        const specials = window.Specials;
        let viewRowStart = 20;
        let zoomedOut = false; // nuovo stato zoom
        // configurazione griglia (coerente con spec)
        let COLS = 20;
        let ROWS_TOTAL = 40;
        let VIEW_COLS = 20;
        let VIEW_ROWS = 20;

        const TILE = { EMPTY: 0, FAIRWAY: 1, ROUGH: 2, GREEN: 3, BUNKER: 4, WATER: 5, TEE: 6, HOLE: 7 };

        let mapGrid = [];
        let ball = { col: Math.floor(COLS / 2), row: ROWS_TOTAL - 2 };
        let hole = { col: Math.floor(COLS / 2), row: 32 };
        let selectedClub = Clubs[1] || Clubs[0];
        let selectedSpecial = null;
        let currentGrid = null; // griglia attuale (normale o zoom green)

        // DOM refs
        const canvas = document.getElementById('mapCanvas');
        if (!canvas) {
            console.error('Canvas non trovato: assicurati che esista un elemento con id="mapCanvas" nel DOM.');
            return;
        }
        const ctx = canvas.getContext('2d');
        const clubsDeckEl = document.getElementById('clubsDeck');
        const specialDeckEl = document.getElementById('specialDeck');


        // utility
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

        // canvas DPI / sizing
        function fitCanvas() {
            const cssW = canvas.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssW * dpr); // keep square
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        function calculateDistance(r1, c1, r2, c2) {
            const dr = r2 - r1;
            const dc = c2 - c1;
            return Math.round(Math.sqrt(dr * dr + dc * dc));
        }
        function updateDistances() {
            const teePos = findTeePosition();
            const holePos = hole;

            const travelled = calculateDistance(teePos.row, teePos.col, ball.row, ball.col);
            const remaining = calculateDistance(ball.row, ball.col, holePos.row, holePos.col);

            document.getElementById("travelledDistance").textContent = travelled;
        }


        // Generazione procedurale: fairway che percorre tutte le righe fino alla buca (tra 30 e 37)
        window.generateMap = function (par, difficulty) {
            // Se non passati, genera casuali
            if (typeof difficulty === 'undefined') difficulty = 1 + Math.floor(Math.random() * 3);
            if (typeof par === 'undefined') {
                const parOptions = [3, 4, 5];
                par = parOptions[Math.floor(Math.random() * parOptions.length)];
            }

            console.log("Par:", par, "Difficoltà:", difficulty);

            // Reset mappa come rough
            mapGrid = Array.from({ length: ROWS_TOTAL }, () =>
                Array.from({ length: COLS }, () => TILE.ROUGH)
            );

            // --- TEE BOX SMUSSATO ---
            // Maggiore difficoltà → più probabilità colonne estreme
            let teeCol;
            if (Math.random() < 0.2 * difficulty) {
                teeCol = Math.random() < 0.5 ? 0 : COLS - 5;
            } else {
                teeCol = 2 + Math.floor(Math.random() * (COLS - 7));
            }
            const teeRow = 36 + Math.floor(Math.random() * 3);

            // Costruzione tee box smussato 3x5x3
            for (let r = teeRow; r < teeRow + 3; r++) {
                for (let c = teeCol; c < teeCol + 5; c++) {
                    // smussa angoli: elimina colonna 0/4 su prima/ultima riga
                    if ((r === teeRow || r === teeRow + 2) && (c === teeCol || c === teeCol + 4)) continue;

                    if (r < ROWS_TOTAL && c < COLS) mapGrid[r][c] = TILE.TEE;
                }
            }

            // Posizione iniziale palla: centro del tee box
            ball.row = teeRow + 1;
            ball.col = teeCol + 2;


            // --- GREEN (smussato) ---
            let greenMinRow, greenMaxRow;
            if (par === 3) { greenMinRow = 30; greenMaxRow = 24; }
            else if (par === 4) { greenMinRow = 20; greenMaxRow = 10; }
            else { greenMinRow = 4; greenMaxRow = 0; }

            // Dimensione green
            const greenH = 4 + Math.floor(Math.random() * 4); // altezza
            const greenW = 4 + Math.floor(Math.random() * 4); // larghezza

            // Colonna green: assicurati che non esca dai bordi
            let greenCol;
            if (Math.random() < 0.2 * difficulty) {
                greenCol = Math.random() < 0.5 ? 0 : COLS - greenW; // estremità
            } else {
                greenCol = Math.floor(Math.random() * (COLS - greenW)); // centrato
            }

            // Riga green: assicurati di rimanere nei limiti verticali
            let greenRow = greenMinRow + Math.floor(Math.random() * (greenMaxRow - greenMinRow + 1));
            greenRow = Math.max(0, Math.min(greenRow, ROWS_TOTAL - greenH));

            // Centro e raggio per forma ellittica
            const centerR = greenRow + greenH / 2;
            const centerC = greenCol + greenW / 2;
            const radiusR = greenH / 2;
            const radiusC = greenW / 2;

            // Disegna green ellittico con bordo irregolare
            for (let r = greenRow; r < greenRow + greenH; r++) {
                for (let c = greenCol; c < greenCol + greenW; c++) {
                    const normR = (r + 0.5 - centerR) / radiusR;
                    const normC = (c + 0.5 - centerC) / radiusC;
                    const distanceSquared = normR * normR + normC * normC;

                    // Tiles principali ellittici
                    if (distanceSquared <= 1) {
                        if (r >= 0 && r < ROWS_TOTAL && c >= 0 && c < COLS) mapGrid[r][c] = TILE.GREEN;
                    } else {
                        // Aggiunge un po' di irregolarità ai bordi
                        const randomness = 0.15; // probabilità di aggiungere tile extra
                        if (Math.random() < randomness && r >= 0 && r < ROWS_TOTAL && c >= 0 && c < COLS) {
                            mapGrid[r][c] = TILE.GREEN;
                        }
                    }
                }
            }
            // Posizione buca: dentro green
            const holeRow = greenRow + Math.floor(greenH / 2) + (Math.floor(Math.random() * 3) - 1);
            const holeCol = greenCol + Math.floor(greenW / 2) + (Math.floor(Math.random() * 3) - 1);

            if (holeRow >= 0 && holeRow < ROWS_TOTAL && holeCol >= 0 && holeCol < COLS) {
                mapGrid[holeRow][holeCol] = TILE.HOLE;
                hole.row = holeRow;
                hole.col = holeCol;
            }

            // --- FAIRWAY ---
            let currentCol = ball.col;
            for (let r = teeRow - 1; r >= greenRow + greenH; r--) {
                // Larghezza base del fairway ridotta con difficoltà
                const fwWidth = Math.max(1, 6 - difficulty); // più difficile → fairway più stretti

                // Calcolo colonne percorse
                const startCol = currentCol - Math.floor(fwWidth / 2);
                const endCol = currentCol + Math.floor(fwWidth / 2);

                for (let c = startCol; c <= endCol; c++) {
                    if (c >= 0 && c < COLS) mapGrid[r][c] = TILE.FAIRWAY;
                }

                // Più difficoltà → più probabilità che il fairway si sposti lateralmente
                const shiftProb = 0.3 + 0.05 * difficulty;
                if (Math.random() < shiftProb) {
                    currentCol += Math.random() < 0.5 ? -1 : 1;
                    // vincola il fairway alle colonne centrali in base a difficoltà
                    const minCol = 2 + difficulty; // più difficile → meno colonne disponibili a sinistra
                    const maxCol = COLS - 3 - difficulty; // più difficile → meno colonne disponibili a destra
                    currentCol = Math.max(minCol, Math.min(maxCol, currentCol));
                }
            }

            // --- BUNKER PATCHES ---
            const bunkersAlongFairway = [1, 2, 2]; // difficoltà 1 → 1, 2 → 2, 3 → 2
            const bunkersNearGreen = [1, 2, 3];

            let numAlong = bunkersAlongFairway[difficulty - 1];
            let numNear = bunkersNearGreen[difficulty - 1];

            // 1) bunker lungo il fairway
            for (let i = 0; i < numAlong; i++) {
                // scegli una riga casuale lungo il fairway
                let r;
                do {
                    r = Math.floor(Math.random() * ROWS_TOTAL);
                } while (!mapGrid[r].includes(TILE.FAIRWAY));

                // scegli una colonna casuale dentro il fairway in quella riga
                const cIndices = mapGrid[r].map((tile, idx) => tile === TILE.FAIRWAY ? idx : -1).filter(idx => idx >= 0);
                if (cIndices.length === 0) continue;
                const c = cIndices[Math.floor(Math.random() * cIndices.length)];

                createBunkerPatch(r, c);
            }

            // 2) bunker vicino al green
            for (let i = 0; i < numNear; i++) {
                let r, c;
                do {
                    r = Math.floor(Math.random() * ROWS_TOTAL);
                    c = Math.floor(Math.random() * COLS);
                } while (!isNearTile(r, c, TILE.GREEN, 1) || mapGrid[r][c] !== TILE.ROUGH);

                createBunkerPatch(r, c);
            }

            // --- ACQUA ---
            const waterAttempts = 3 + difficulty; // più tentativi acqua
            for (let i = 0; i < waterAttempts; i++) {
                if (Math.random() < 0.5 + 0.15 * difficulty) {
                    const waterRow = 10 + Math.floor(Math.random() * 20);
                    const waterCol = 2 + Math.floor(Math.random() * (COLS - 8));
                    const w = 3 + Math.floor(Math.random() * 4);
                    const h = 2 + Math.floor(Math.random() * 3);
                    for (let r = waterRow; r < waterRow + h; r++) {
                        for (let c = waterCol; c < waterCol + w; c++) {
                            if (mapGrid[r] && mapGrid[r][c] === TILE.ROUGH) mapGrid[r][c] = TILE.WATER;
                        }
                    }
                }
            }
            const teePos = findTeePosition();
            const holePos = hole; // già definito dalla generazione della mappa
            const holeLength = calculateDistance(teePos.row, teePos.col, holePos.row, holePos.col);

            document.getElementById("holeNumber").textContent = currentHoleIndex + 1;
            document.getElementById("holePar").textContent = holes[currentHoleIndex].par;
            document.getElementById("holeLength").textContent = holeLength;

            // aggiorna subito la distanza percorsa e mancante
            updateDistances();

        }

        // --- Helper per generare patch bunker ---
        function createBunkerPatch(r, c) {
            const maxSize = 5; // max 5x5
            const patchW = 2 + Math.floor(Math.random() * (maxSize - 1));
            const patchH = 2 + Math.floor(Math.random() * (maxSize - 1));

            for (let rr = r; rr < r + patchH; rr++) {
                for (let cc = c; cc < c + patchW; cc++) {
                    if (rr >= 0 && rr < ROWS_TOTAL && cc >= 0 && cc < COLS) {
                        if (mapGrid[rr][cc] === TILE.ROUGH && Math.random() < 0.8) {
                            mapGrid[rr][cc] = TILE.BUNKER;
                        }
                    }
                }
            }
        }

        // Intensità massima in base alla difficoltà: facile=2, medio=3, difficile=4
        let wind = {
            direction: 0, // angolo in radianti (0 = verso destra, π/2 = giù, etc.)
            intensity: 0  // numero positivo, può essere moltiplicato per deltaCol/deltaRow
        };

        // Inizio torneo o nuova buca: genera vento casuale
        window.generateWind = function(difficulty) {
            // Intensità massima per difficoltà
            const maxIntensity = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;

            // Direzione casuale tra le 8 principali (N, NE, E, SE, S, SW, W, NW)
            const directions = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
            wind.direction = directions[Math.floor(Math.random() * directions.length)];

            // Intensità casuale tra 1 e maxIntensity
            wind.intensity = Math.random() * maxIntensity;

            console.log(`Vento generato: direzione=${wind.direction.toFixed(2)} rad, intensità=${wind.intensity.toFixed(2)}`);
        }
        window.updateWindDisplay = function() {
            const dirSymbols = ['→', '↗', '↓', '↘', '←', '↙', '↑', '↖'];
            const dirs = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
            // trova indice direzione più vicina
            let minDiff = Infinity;
            let idx = 0;
            for (let i = 0; i < dirs.length; i++) {
                const diff = Math.abs(dirs[i] - wind.direction);
                if (diff < minDiff) { minDiff = diff; idx = i; }
            }
            document.getElementById('windDir').innerText = dirSymbols[idx];
            document.getElementById('windInt').innerText = wind.intensity.toFixed(1);
        }


        // Helper: controlla se cella è vicina ad un certo tile
        function isNearTile(r, c, tileType, dist) {
            for (let dr = -dist; dr <= dist; dr++) for (let dc = -dist; dc <= dist; dc++) {
                const rr = r + dr, cc = c + dc;
                if (rr >= 0 && rr < ROWS_TOTAL && cc >= 0 && cc < COLS) {
                    if (mapGrid[rr][cc] === tileType) return true;
                }
            }
            return false;
        }

        // --- Render aggiornato con frecce sul green ---
        window.render = function() {
            fitCanvas();
            const cssW = canvas.clientWidth;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const gridToUse = puttMode && currentGrid ? currentGrid : mapGrid;
            if (!gridToUse || !gridToUse[0]) return;

            const rows = gridToUse.length;
            const cols = gridToUse[0].length;
            const tile = cssW / cols;

            const viewRows = puttMode ? rows : VIEW_ROWS;
            const viewCols = puttMode ? cols : VIEW_COLS;
            const rowStart = puttMode ? 0 : viewRowStart;

            for (let rv = 0; rv < viewRows; rv++) {
                for (let c = 0; c < viewCols; c++) {
                    const gr = rowStart + rv;
                    const gc = c;
                    const t = (gridToUse[gr] && typeof gridToUse[gr][gc] !== 'undefined') ? gridToUse[gr][gc] : TILE.EMPTY;

                    const x = c * tile;
                    const y = rv * tile;
                    const drawTileSize = tile;

                    // --- Disegna tile base ---
                    switch (t) {
                        case TILE.FAIRWAY: fillTile(x, y, drawTileSize, drawTileSize, '#77b255'); break;
                        case TILE.ROUGH: fillTile(x, y, drawTileSize, drawTileSize, '#5a7a3a'); break;
                        case TILE.GREEN: fillTile(x, y, drawTileSize, drawTileSize, '#9be36b'); break;
                        case TILE.BUNKER: fillTile(x, y, drawTileSize, drawTileSize, '#e6d6aa'); break;
                        case TILE.WATER: fillTile(x, y, drawTileSize, drawTileSize, '#5ec1ff'); break;
                        case TILE.TEE: fillTile(x, y, drawTileSize, drawTileSize, '#b5e6ff'); break;
                        case TILE.HOLE:
                            fillTile(x, y, drawTileSize, drawTileSize, '#9be36b');
                            drawHole(x, y, drawTileSize); // Disegna buca solo qui
                            break;
                        default: fillTile(x, y, drawTileSize, drawTileSize, '#8bd0a6'); break;
                    }

                    // --- Disegna frecce sul green ---
                    if (puttMode && slopeGrid && slopeGrid[gr] && slopeGrid[gr][gc]) {
                        drawArrow(x + tile / 2, y + tile / 2, tile * 0.3, slopeGrid[gr][gc]);
                    }
                }
            }

            // --- Disegna pallina ---
            const br = puttMode ? ball.rowZoom : ball.row - viewRowStart;
            const bc = puttMode ? ball.colZoom : ball.col;
            const bx = (bc + 0.5) * tile;
            const by = (br + 0.5) * tile;

            // Ombra
            ctx.beginPath();
            ctx.ellipse(bx, by + tile * 0.18, tile * 0.18, tile * 0.09, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fill();

            // Pallina
            ctx.beginPath();
            ctx.arc(bx, by, tile * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // --- Funzione helper aggiornata per disegnare frecce vere ---
        function drawArrow(cx, cy, size, dir) {
            ctx.save();
            ctx.translate(cx, cy);

            // --- Ruota di 90° in senso orario per correggere la visualizzazione ---
            const ninetyDeg = Math.PI / 2;

            switch (dir) {
                case 'UP': ctx.rotate(-Math.PI / 2 + ninetyDeg); break;
                case 'DOWN': ctx.rotate(Math.PI / 2 + ninetyDeg); break;
                case 'LEFT': ctx.rotate(Math.PI + ninetyDeg); break;
                case 'RIGHT': ctx.rotate(0 + ninetyDeg); break;
            }

            // --- Disegna asta ---
            ctx.beginPath();
            ctx.moveTo(0, size * 1.2);
            ctx.lineTo(0, -size);
            ctx.lineWidth = size * 0.3;
            ctx.strokeStyle = 'rgba(255,0,0,0.8)';
            ctx.stroke();

            // --- Disegna punta freccia ---
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(-size, -size / 4);
            ctx.lineTo(size, -size / 4);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,0,0,0.8)';
            ctx.fill();

            ctx.restore();
        }

        let puttMode = false;   // flag per zoom sul green
        let slopeGrid = null;     // frecce pendenza sul green

        function getGreenArea() {
            const greenTiles = [];
            for (let r = 0; r < ROWS_TOTAL; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (mapGrid[r][c] === TILE.GREEN) greenTiles.push({ r, c });
                }
            }
            if (!greenTiles.length) return null;

            // Trova limiti min/max
            let minR = Math.min(...greenTiles.map(t => t.r));
            let maxR = Math.max(...greenTiles.map(t => t.r));
            let minC = Math.min(...greenTiles.map(t => t.c));
            let maxC = Math.max(...greenTiles.map(t => t.c));

            return { minR, maxR, minC, maxC };
        }

        // --- Genera griglia zoomata e frecce pendenza ---
        function generateZoomGridFromGreen(minR, maxR, minC, maxC, zoomSize = 20, scale = 3) {
            const greenRows = maxR - minR + 1;
            const greenCols = maxC - minC + 1;

            const zoomGrid = Array.from({ length: zoomSize }, () => Array(zoomSize).fill(TILE.ROUGH));
            const slopeGridLocal = Array.from({ length: zoomSize }, () => Array(zoomSize).fill(null));

            const greenZoomRows = greenRows * scale;
            const greenZoomCols = greenCols * scale;
            let holePlaced = false;

            const offsetR = Math.floor((zoomSize - greenZoomRows) / 2);
            const offsetC = Math.floor((zoomSize - greenZoomCols) / 2);

            for (let r = 0; r < greenRows; r++) {
    for (let c = 0; c < greenCols; c++) {
        const tile = mapGrid[minR + r][minC + c];

        for (let rr = 0; rr < scale; rr++) {
            for (let cc = 0; cc < scale; cc++) {
                const zoomR = offsetR + r * scale + rr;
                const zoomC = offsetC + c * scale + cc;
                if (zoomR < 0 || zoomR >= zoomSize || zoomC < 0 || zoomC >= zoomSize) continue;

                // --- Imposta verde per tutte le sotto-tile della buca ---
                if (tile === TILE.GREEN || tile === TILE.HOLE) {
                    zoomGrid[zoomR][zoomC] = TILE.GREEN;
                }

                // --- Solo la tile centrale diventa HOLE ---
                if (tile === TILE.HOLE && !holePlaced) {
                    const centerR = offsetR + r * scale + Math.floor(scale / 2);
                    const centerC = offsetC + c * scale + Math.floor(scale / 2);

                    if (zoomR === centerR && zoomC === centerC) {
                        zoomGrid[zoomR][zoomC] = TILE.HOLE;
                        holePlaced = true;
                        hole.rowZoom = centerR;
                        hole.colZoom = centerC;
                    }
                }
            }
        }
    }
}

            // --- Procedural relievi sul green ---
            // 1️⃣ BOWL/HILL ad anelli
            const numReliefs = 2 + Math.floor(Math.random() * 3); // 2–4 anelli

            for (let p = 0; p < numReliefs; p++) {
                const centerR = offsetR + Math.floor(Math.random() * greenZoomRows);
                const centerC = offsetC + Math.floor(Math.random() * greenZoomCols);

                const outerRadius = 4 + Math.floor(Math.random() * 3); // raggio esterno 2–4
                const innerRadius = 1 + Math.floor(outerRadius / 2);   // raggio interno almeno metà di outerRadius
                const type = Math.random() < 0.5 ? "BOWL" : "HILL";   // verso centro o verso esterno

                for (let r = Math.max(0, centerR - outerRadius); r <= Math.min(zoomSize - 1, centerR + outerRadius); r++) {
                    for (let c = Math.max(0, centerC - outerRadius); c <= Math.min(zoomSize - 1, centerC + outerRadius); c++) {
                        if (zoomGrid[r][c] !== TILE.GREEN) continue;

                        const dr = r - centerR;
                        const dc = c - centerC;
                        const distance = Math.sqrt(dr * dr + dc * dc);

                        if (distance >= innerRadius && distance <= outerRadius) {
                            let dir;
                            // freccia verso centro o verso esterno
                            if (type === "BOWL") {
                                // verso centro
                                dir = Math.abs(dr) > Math.abs(dc) ? (dr > 0 ? "UP" : "DOWN") : (dc > 0 ? "LEFT" : "RIGHT");
                            } else {
                                // verso esterno
                                dir = Math.abs(dr) > Math.abs(dc) ? (dr > 0 ? "DOWN" : "UP") : (dc > 0 ? "RIGHT" : "LEFT");
                            }

                            slopeGridLocal[r][c] = dir;
                        }
                    }
                }
            }

            // 2️⃣ Gradoni paralleli
            const numPatches = 1 + Math.floor(Math.random() * 3); // 3–5 gradoni

            for (let p = 0; p < numPatches; p++) {
                const centerR = offsetR + Math.floor(Math.random() * greenZoomRows);
                const centerC = offsetC + Math.floor(Math.random() * greenZoomCols);

                const height = 1 + Math.floor(Math.random() * 2); // altezza 1-2 tile
                const width = 6 + Math.floor(Math.random() * 3);  // larghezza 3-5 tile

                const horizontal = Math.random() < 0.5;
                const arrow = horizontal ? (Math.random() < 0.5 ? "LEFT" : "RIGHT") : (Math.random() < 0.5 ? "UP" : "DOWN");

                for (let r = Math.max(0, centerR - Math.floor(height)); r <= Math.min(zoomSize - 1, centerR + Math.floor(height / 2)); r++) {
                    for (let c = Math.max(0, centerC - Math.floor(width * 2)); c <= Math.min(zoomSize - 1, centerC + Math.floor(width / 2)); c++) {
                        if (zoomGrid[r][c] !== TILE.GREEN) continue;
                        slopeGridLocal[r][c] = arrow;
                    }
                }
            }

            // --- Posizione pallina proporzionale ---
            const ballRelRow = ball.row - minR;
            const ballRelCol = ball.col - minC;
            ball.rowZoom = offsetR + Math.floor(ballRelRow * greenZoomRows / greenRows);
            ball.colZoom = offsetC + Math.floor(ballRelCol * greenZoomCols / greenCols);

            return { zoomGrid, slopeGrid: slopeGridLocal };
        }

        function fillTile(x, y, w, h, color) {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x + 0.5), Math.round(y + 0.5), Math.round(w - 1), Math.round(h - 1));
        }
        function drawHole(x, y, tile) {
            ctx.beginPath(); ctx.arc(x + tile / 2, y + tile / 2, tile * 0.16, 0, Math.PI * 2);
            ctx.fillStyle = 'black'; ctx.fill();
        }

        // Pointer + aiming
        let dragging = false;
        let activePointerId = null;

        function getPointerMapPos(e) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left);
            const y = (e.clientY - rect.top);
            const tile = rect.width / VIEW_COLS;
            const col = Math.floor(x / tile);
            const rowView = Math.floor(y / tile);
            const row = viewRowStart + rowView;
            return { x, y, col, row };
        }

        function drawAimLineTo(x, y) {
            render();
            const rect = canvas.getBoundingClientRect();
            const cssW = rect.width;
            const tile = cssW / VIEW_COLS;
            const bx = (ball.col + 0.5) * tile;
            const by = (ball.row - viewRowStart + 0.5) * tile;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(255,0,0,0.75)'; ctx.lineWidth = 3; ctx.stroke();
        }

        canvas.addEventListener('pointerdown', (e) => {
            if (puttMode) return; // niente aiming normale
            if (e.button !== undefined && e.button !== 0) return;
            dragging = true;
            activePointerId = e.pointerId;
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
            const p = getPointerMapPos(e);
            drawAimLineTo(p.x, p.y);
        });

        canvas.addEventListener('pointermove', (e) => {
            if (puttMode) return; // niente aiming normale)
            if (!dragging || e.pointerId !== activePointerId) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            drawAimLineTo(x, y);
        });

        canvas.addEventListener('pointerup', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (puttMode) {
                // calcola tile nel green zoom e fai il putt
                const tileSize = rect.width / VIEW_COLS; // o VIEW_COLS zoom se vuoi
                const col = Math.floor(x / tileSize);
                const row = Math.floor(y / tileSize);
                puttShot(col, row);
            } else {
                if (!dragging || e.pointerId !== activePointerId) return;
                dragging = false;
                activePointerId = null;
                try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                const pEnd = getPointerMapPos(e);
                commitShot(pEnd); // normale colpo
            }
        });

        function commitShot(point) {
            if (puttMode) return; // ignora tiro normale se siamo in putt mode
            if (!selectedClub) return;
            if (!point || typeof point.x === 'undefined') return;

            const rect = canvas.getBoundingClientRect();
            const tile = rect.width / VIEW_COLS;
            const ballScreenX = (ball.col + 0.5) * tile;
            const ballScreenY = (ball.row - viewRowStart + 0.5) * tile;

            const dx = point.x - ballScreenX;
            const dy = point.y - ballScreenY;
            if (dx === 0 && dy === 0) return;

            // --- Crea oggetto shot ---
            let shotObj = {
                distance: selectedClub.distance,
                roll: selectedClub.roll,
                curve: 0,
                backspin: false
            };
            if (selectedSpecial && typeof selectedSpecial.modify === 'function') {
                try { selectedSpecial.modify(shotObj); } catch (err) { }
            }

            // --- Angolo di tiro ---
            let angle = Math.atan2(dy, dx);

            // Deviabilità in base all'accuracy
            const maxDeviationRad = (1 - (selectedClub.accuracy || 1)) * 0.5;
            const deviation = (Math.random() * 2 - 1) * maxDeviationRad;

            // tile di partenza
            const startTile = mapGrid[ball.row][ball.col];

            // --- Modifica distanza / rotolo in base alla tile ---
            let distanceFactor = 1;
            let rollFactor = 1;

            switch (startTile) {
                case TILE.ROUGH:
                        if (selectedSpecial && selectedSpecial.name === 'Rough shot') {
                            // Rough shot: nessun malus
                            distanceFactor = 1;
                            rollFactor = 1;
                        } else {
                            if (selectedClub.id === 'driver' || selectedClub.id === 'wood') {
                                distanceFactor = 0.5;
                                rollFactor = 0.5;
                            } else {
                                if (selectedClub.id === 'pitch' || selectedClub.id === 'sand' || selectedClub.id === 'wedge') {
                                    distanceFactor = 0.9;
                                    rollFactor = 0.9;
                                } else {
                                    distanceFactor = 0.75;
                                    rollFactor = 0.75;
                                }
                            }
                        }
                    break;
                case TILE.BUNKER:
                    if (selectedSpecial && selectedSpecial.name === 'Sand shot') {
                        // Sand shot: nessun malus
                        distanceFactor = 1;
                        rollFactor = 1;
                    } else {
                        if (selectedClub.name === 'sand') {
                            distanceFactor = 1;
                            rollFactor = 1;
                        } else {
                            distanceFactor = 0.5;
                            rollFactor = 0.5;
                        }
                    }
                    break;
                case TILE.TEE:
                    if (selectedClub.id === 'driver' || selectedClub.id === 'wood') {
                        distanceFactor = 1.1;
                        rollFactor = 1.1;
                    }
                    break;
                case TILE.FAIRWAY:
                    if (selectedClub.id === 'driver' || selectedClub.id === 'wood') {
                        distanceFactor = 0.8;
                        rollFactor = 0.8;
                    }
                    break;
                case TILE.GREEN:
                default:
                    distanceFactor = 1;
                    rollFactor = 1;
                    break;
            }

            // --- calcola distanza e rotolo ---
            let flightDistance = Math.max(1, Math.round(shotObj.distance * distanceFactor));
            const rollDistance = shotObj.roll * rollFactor;

            // --- Applica effetto vento come vettore ---
            let deltaCol = Math.cos(angle) * flightDistance;
            let deltaRow = Math.sin(angle) * flightDistance;

            // Poi invoca l’animazione con i delta modificati dal vento
            executeShotAnimatedDelta(Math.round(deltaCol), Math.round(deltaRow), rollDistance, shotObj.curve);
        }

        // costruisce la traiettoria discreta tra posizione corrente e posizione target (deltaCol, deltaRow)
        // e la anima; interrompe su acqua
        function executeShotAnimatedDelta(deltaCol, deltaRow, rollDistance, curve = 0) {
            strokes++;
            if (strokesEl) strokesEl.innerText = strokes;

            const startCol = ball.col;
            const startRow = ball.row;
            const flightTargetCol = clamp(startCol + deltaCol, 0, COLS - 1);
            const flightTargetRow = clamp(startRow + deltaRow, 0, ROWS_TOTAL - 1);

            const steps = Math.max(Math.abs(flightTargetCol - startCol), Math.abs(flightTargetRow - startRow), 1);
            const path = [];
            // delta per step
            let stepDeltaCol = (flightTargetCol - startCol) / steps;
            let stepDeltaRow = (flightTargetRow - startRow) / steps;

            for (let s = 1; s <= steps; s++) {
                const c = clamp(Math.round(startCol + stepDeltaCol * s), 0, COLS - 1);
                const r = clamp(Math.round(startRow + stepDeltaRow * s), 0, ROWS_TOTAL - 1);
                path.push({ c, r });
            }

            let i = 0;
            const fpsInterval = 1000 / 40;
            let lastTime = performance.now();
            // Inizio volo: usa variabili float per la posizione
            let floatCol = ball.col;
            let floatRow = ball.row;
            const curveScale = 0.05;
            const curveDeltaPerStep = curve * curveScale; // spostamento laterale per step dovuto alla curva
            function step(now) {
                if (i < steps) {
                    if (now - lastTime >= fpsInterval) {
                        const stepDeltaCol = (flightTargetCol - startCol) / steps;
                        const stepDeltaRow = (flightTargetRow - startRow) / steps;

                        let windDeltaCol = 0;
                        let windDeltaRow = 0;
                        if (wind && wind.intensity > 0) {
                            const windScale = 0.05;
                            windDeltaCol = Math.cos(wind.direction) * wind.intensity * windScale;
                            windDeltaRow = Math.sin(wind.direction) * wind.intensity * windScale;
                        }
                        const curveDeltaCol = curveDeltaPerStep;
                        // Aggiorna posizione float
                        floatCol += stepDeltaCol + windDeltaCol + curveDeltaCol;
                        floatRow += stepDeltaRow + windDeltaRow;

                        // Solo per il render, arrotonda temporaneamente
                        ball.col = clamp(Math.round(floatCol), 0, COLS - 1);
                        ball.row = clamp(Math.round(floatRow), 0, ROWS_TOTAL - 1);

                        viewRowStart = clamp(ball.row - (VIEW_ROWS - 4), 0, ROWS_TOTAL - VIEW_ROWS);
                        render();

                        i++;
                        lastTime = now;
                    }
                    requestAnimationFrame(step);
                } else {
                    // Atterraggio: determina la tile finale
                    ball.col = clamp(Math.round(floatCol), 0, COLS - 1);
                    ball.row = clamp(Math.round(floatRow), 0, ROWS_TOTAL - 1);
                    const landedTile = mapGrid[ball.row][ball.col];

                    if (landedTile === TILE.WATER) {
                        ball.col = startCol;
                        ball.row = startRow;
                        viewRowStart = clamp(ball.row - (VIEW_ROWS - 4), 0, ROWS_TOTAL - VIEW_ROWS);
                        render();
                        alert("Palla atterrata in acqua! Ritenta il colpo.");
                        return;
                    }
                    // --- Mostra cerchio rosso sulla tile di atterraggio ---
                    const rect = canvas.getBoundingClientRect();
                    const cssW = rect.width;
                    const tileSize = cssW / VIEW_COLS;
                    const x = (ball.col + 0.5) * tileSize;
                    const y = (ball.row - viewRowStart + 0.5) * tileSize;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, tileSize * 0.25, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,0,0,0.6)';
                    ctx.fill();
                    ctx.restore();
                    // --- Disegna freccia roll extra se presente ---
                    if (rollDistance > 0) {
                        const angle = Math.atan2(deltaRow, deltaCol);
                        ctx.save();
                        ctx.strokeStyle = selectedSpecial && selectedSpecial.id === 'topspin' ? 'orange' :
                            selectedSpecial && selectedSpecial.id === 'backspin' ? 'blue' : 'gray';
                        ctx.lineWidth = 2;
                        ctx.beginPath();

                        // direzione roll = stessa del colpo
                        const arrowLen = tileSize * 0.6 + rollDistance * 2;
                        const arrowX = x + Math.cos(angle) * arrowLen;
                        const arrowY = y + Math.sin(angle) * arrowLen;


                        ctx.moveTo(x, y);
                        ctx.lineTo(arrowX, arrowY);
                        ctx.stroke();

                        // punta freccia
                        ctx.beginPath();
                        ctx.moveTo(arrowX, arrowY);
                        ctx.lineTo(arrowX - Math.cos(angle - 0.3) * 10, arrowY - Math.sin(angle - 0.3) * 10);
                        ctx.lineTo(arrowX - Math.cos(angle + 0.3) * 10, arrowY - Math.sin(angle + 0.3) * 10);
                        ctx.closePath();
                        ctx.fillStyle = ctx.strokeStyle;
                        ctx.fill();

                        ctx.restore();
                    }

                    // --- Rotolo ---
                    let rollDistanceAdjusted = rollDistance;
                    if (landedTile === TILE.GREEN) rollDistanceAdjusted *= 1.5;
                    else if (landedTile === TILE.ROUGH) rollDistanceAdjusted *= 0.5;
                    else if (landedTile === TILE.BUNKER) rollDistanceAdjusted = 1;
                    else if (landedTile === TILE.FAIRWAY) rollDistanceAdjusted = rollDistance;

                    const angle = Math.atan2(deltaRow, deltaCol);
                    const rollCol = Math.round(Math.cos(angle) * rollDistanceAdjusted);
                    const rollRow = Math.round(Math.sin(angle) * rollDistanceAdjusted);
                    const rollSteps = Math.max(Math.abs(rollCol), Math.abs(rollRow), 1);
                    let j = 0;

                    function rollStep() {
                        if (j < rollSteps) {
                            const t = (j + 1) / rollSteps;
                            ball.col = clamp(Math.round(ball.col + rollCol * t / rollSteps), 0, COLS - 1);
                            ball.row = clamp(Math.round(ball.row + rollRow * t / rollSteps), 0, ROWS_TOTAL - 1);
                            viewRowStart = clamp(ball.row - (VIEW_ROWS - 4), 0, ROWS_TOTAL - VIEW_ROWS);
                            render();
                            j++;
                            requestAnimationFrame(rollStep);
                        } else {
                            ball.col = clamp(ball.col, 0, COLS - 1);
                            ball.row = clamp(ball.row, 0, ROWS_TOTAL - 1);
                            if (mapGrid[ball.row][ball.col] === TILE.WATER) {
                                ball.col = startCol;
                                ball.row = startRow;
                                viewRowStart = clamp(ball.row - (VIEW_ROWS - 4), 0, ROWS_TOTAL - VIEW_ROWS);
                                render();
                                alert("Palla in acqua durante il rotolo! Ritenta il colpo.");
                                return;
                            }

                            if (mapGrid[ball.row][ball.col] === TILE.GREEN) {
                                const area = getGreenArea();
                                if (area) {
                                    setTimeout(() => {
                                        const { zoomGrid, slopeGrid: slopes } = generateZoomGridFromGreen(area.minR, area.maxR, area.minC, area.maxC);
                                        currentGrid = zoomGrid;
                                        slopeGrid = slopes;
                                        puttMode = true; // abilita modalità putt
                                        render();        // renderizza zoom
                                    }, 500);
                                }
                            }
                            updateDistances();
                            checkHole(); // controlla se pallina è nella buca
                        }
                    }

                    setTimeout(() => rollStep(), 200); // pausa breve per vedere il cerchio
                }
            }

            requestAnimationFrame(step);
        }

        function puttShot(targetColZoom, targetRowZoom) {
            strokes++;
            if (strokesEl) strokesEl.innerText = strokes;

            let posCol = ball.colZoom;
            let posRow = ball.rowZoom;

            const deltaCol = targetColZoom - posCol;
            const deltaRow = targetRowZoom - posRow;

            const steps = Math.max(Math.abs(deltaCol), Math.abs(deltaRow), 1) * 6;
            let i = 0;

            // direzione "base" verso il target
            let velCol = deltaCol / steps;
            let velRow = deltaRow / steps;

            function step() {
                if (i < steps) {
                    posCol += velCol;
                    posRow += velRow;

                    const r = Math.round(posRow);
                    const c = Math.round(posCol);

                    // --- influenza frecce ---
                    if (slopeGrid && slopeGrid[r] && slopeGrid[r][c]) {
                        const dir = slopeGrid[r][c];
                        const influence = 0.075; // deviazione moderata

                        switch (dir) {
                            case 'UP': posRow -= influence; break;
                            case 'DOWN': posRow += influence; break;
                            case 'LEFT': posCol -= influence; break;
                            case 'RIGHT': posCol += influence; break;
                        }
                    }
                    ball.colZoom = Math.round(posCol);
                    ball.rowZoom = Math.round(posRow);

                    render();
                    i++;
                    setTimeout(() => requestAnimationFrame(step), 30);
                } else {
                    // Conversione finale in coordinate globali
                    const greenArea = getGreenArea();
                    if (!greenArea) return;
                    
                    const scale = 3;
                    const offsetR = Math.floor((currentGrid.length - (greenArea.maxR - greenArea.minR + 1) * scale) / 2);
                    const offsetC = Math.floor((currentGrid[0].length - (greenArea.maxC - greenArea.minC + 1) * scale) / 2);
                    const ballGlobalCol = greenArea.minC + Math.round((ball.colZoom - offsetC) / scale);
                    const ballGlobalRow = greenArea.minR + Math.round((ball.rowZoom - offsetR) / scale);

                    ball.col = ballGlobalCol;
                    ball.row = ballGlobalRow;
                    render();

                    // **qui controllo buca**
                    checkHole();

                }
            }

            requestAnimationFrame(step);
        }

        function checkHole() {
            if (ball.row === hole.row && ball.col === hole.col) {
                holes[currentHoleIndex].strokes = strokes; // aggiorna colpi della buca corrente

                setTimeout(() => {
                    alert(`Hole! Hai finito in ${strokes} colpi.`);
                    finishHole();

                    // reset palla e zoom
                    puttMode = false;
                    currentGrid = null;
                    slopeGrid = null;
                    ball.rowZoom = null;
                    ball.colZoom = null;
                    zoomedOut = false;

                    const teePos = findTeePosition();
                    ball.row = teePos.row;
                    ball.col = teePos.col;
                    viewRowStart = clamp(ball.row - (VIEW_ROWS - 4), 0, ROWS_TOTAL - VIEW_ROWS);
                    render();
                }, 60);

                return true;
            }
            return false;
        }

        function findTeePosition() {
            for (let r = 0; r < ROWS_TOTAL; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (mapGrid[r][c] === TILE.TEE) return { row: r + 1, col: c + 2 };
                }
            }
            return { row: 0, col: 0 };
        }

        // UI: popola mazzi
        function populateDecks() {
            if (clubsDeckEl) {
                clubsDeckEl.innerHTML = '';

                // Ordina le carte per il campo 'order'
                const sortedClubs = [...Clubs].sort((a, b) => a.num - b.num);

                sortedClubs.forEach((c, idx) => {
                    const el = document.createElement('div');
                    el.classList.add('card');
                    el.tabIndex = 0;

                    // aggiungi classi colore in base al tipo
                    if (c.id === 'driver') el.classList.add('driver');
                    else if (c.id.startsWith('wood')) el.classList.add('wood');
                    else if (c.id.startsWith('iron')) el.classList.add('iron');
                    else if (['wedge', 'sand', 'pitch'].includes(c.id)) el.classList.add(c.id);

                    // emoji e info: distanza ⛳, roll ↘, precisione 🎯
                    el.innerHTML = `
            <div class="title">${c.name}</div>
            <div class="sub">⛳ ${c.distance} | ↘ ${c.roll} | 🎯 ${(c.accuracy * 100).toFixed(0)}%</div>
            <div class="desc">📝 ${c.desc}</div>
        `;

                    el.addEventListener('click', () => {
                        selectedClub = c;
                        clubsDeckEl.querySelectorAll('.card').forEach(x => x.style.outline = '');
                        el.style.outline = '3px solid #1f8feb';
                    });

                    clubsDeckEl.appendChild(el);

                    // seleziona di default la seconda carta
                    if (idx === 1) { setTimeout(() => el.click(), 50); }
                });
            }

            if (specialDeckEl) {
                specialDeckEl.innerHTML = '';
                Specials.forEach((s) => {
                    const el = document.createElement('div');
                    el.className = 'card';
                    el.tabIndex = 0;

                    // emoji per rendere più chiaro il tipo di special
                    el.innerHTML = `
                <div class="title">${s.name}</div>
                <div class="sub">✨ ${s.desc}</div>
            `;

                    el.addEventListener('click', () => {
                        selectedSpecial = s;
                        specialDeckEl.querySelectorAll('.card').forEach(x => x.style.outline = '');
                        el.style.outline = '3px dashed #ff9900';
                    });

                    specialDeckEl.appendChild(el);
                });
            }
        }

        const camUpBtn = document.getElementById('camUpBtn');
        const camDownBtn = document.getElementById('camDownBtn');
        const STEP = 5; // step per spostamento telecamera

        if (camUpBtn) {
            camUpBtn.addEventListener('click', () => {
                viewRowStart = clamp(viewRowStart - STEP, 0, ROWS_TOTAL - VIEW_ROWS);
                render();
            });
        }

        if (camDownBtn) {
            camDownBtn.addEventListener('click', () => {
                viewRowStart = clamp(viewRowStart + STEP, 0, ROWS_TOTAL - VIEW_ROWS);
                render();
            });
        }


        window.addEventListener('resize', () => { fitCanvas(); render(); });

        // init
        populateDecks();
        render();
    });
})();
