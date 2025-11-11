(() => {
    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const upBtn = document.getElementById("upBtn");
    const downBtn = document.getElementById("downBtn");
    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");
    const zoomInBtn = document.getElementById("zoomInBtn");
    const zoomOutBtn = document.getElementById("zoomOutBtn");
    const playerControls = document.querySelector(".player-controls");
    const shotControls = document.querySelector(".shot-controls");
    let shotTarget = null; // {c: , r: } oppure null se non selezionato
    let lastLandingSpot = null; // { c, r, time }
    // Stato buche
    let currentHoleIndex = 0; // indice della buca corrente
    let holeShots = 0;        // colpi attuali nella buca corrente
    let gameHoles = [];       // array di buche generate dalla mappa

    const COLORS = {
        rough: "#5a7a3a",
        fairway: "#9fd08b",
        green: "#9be36b",
        bunker: "#fad087",
        tee: "#ff6b6b",
        hole: "#9be36b",
        water: "#2f7deb"
    };
    const LAYERS = {
        ROUGH: 0,
        FAIRWAY: 1,
        BUNKER: 2,
        GREEN: 3,
        TEE: 4,
        HOLE: 5,
        WATER: 6
    };

    let view = { x: 0, y: 0, size: 30 };
    const zoomLevels = [20, 25, 30, 40, 60, 80, 100];
    let zoomIndex = 1;
    let currentMap = null;
    let gameState = {
        mode: "player",  // "player", "shot", "ball"
        player: { c: 0, r: 0 },
        ball: { c: 0, r: 0, dx: 0, dy: 0, moving: false },
        club: "wood",
        shotPower: 0
    };


    const PARS9 = [3, 3, 4, 4, 4, 4, 4, 5, 5];
    const PAR_RANGES = { 3: [12, 18], 4: [22, 30], 5: [35, 45] };

    function createRng(seed = Math.random() * 1e9) {
        let t = seed >>> 0;
        return () => {
            t += 0x6D2B79F5;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }

    function updateHoleHUD() {
        if (!gameHoles || gameHoles.length === 0) return;

        const hole = gameHoles[currentHoleIndex];
        const distanceCells = Math.hypot(hole.holePos.c - hole.tee.c, hole.holePos.r - hole.tee.r);
        const distanceMeters = Math.round(distanceCells * 10); // esempio: 1 cella = 10 m

        document.getElementById("holeNumber").textContent = hole.number;
        document.getElementById("holePar").textContent = hole.par;
        document.getElementById("holeDistance").textContent = distanceMeters;
        document.getElementById("holeShots").textContent = holeShots;
    }

    function updateDistanceTravelled() {
        if (!gameHoles || gameHoles.length === 0) return;
        const hole = gameHoles[currentHoleIndex];

        // distanza tra tee e pallina attuale
        const dx = gameState.ball.c - hole.tee.c;
        const dy = gameState.ball.r - hole.tee.r;
        const distanceCells = Math.hypot(dx, dy);
        const distanceMeters = Math.round(distanceCells * 10); // 1 cella = 10 m

        document.getElementById("distanceValue").textContent = distanceMeters;
    }

    function updateShotInfo(pointerPos) {
        const ball = gameState.ball;
        if (!ball || !pointerPos) return;

        // DISTANZA DAL PUNTATORE — sempre
        const distCells = Math.hypot(pointerPos.c - ball.c, pointerPos.r - ball.r);
        const distMeters = Math.round(distCells * 10);
        document.getElementById("pointerDistance").textContent = distMeters;

        const club = gameState.selectedClub || selectedClub; // mazza scelta
        const special = gameState.selectedSpecial || selectedSpecial; // carta speciale

        // Tile su cui si trova la pallina
        const tileType = getTileTypeAt(ball.c, ball.r);
        const tileModifier = club ? getTileModifierAt(ball.c, ball.r, club.id) : { distance: 1, roll: 1, accuracy: 1 };

        console.log("Tile rilevata:", tileType);
        console.log("Mazza selezionata:", club ? club.name : "nessuna");
        console.log("Special selezionata:", special ? special.name : "nessuna");

        // Oggetto tiro temporaneo: base 1.0, poi moltiplicatori della tile
        const shotSim = {
            distance: tileModifier.distance ?? 1,
            roll: tileModifier.roll ?? 1,
            accuracy: tileModifier.accuracy ?? 1
        };

        // Applica la special card se ce n'è una selezionata
        if (special && typeof special.modify === "function") {
            special.modify(shotSim);
        }

        const power = Math.round(shotSim.distance * 100);
        const roll = Math.round(shotSim.roll * 100);
        const accuracy = Math.round(shotSim.accuracy * 100);

        document.getElementById("shotPower").textContent = power + "%";
        document.getElementById("shotRoll").textContent = roll + "%";
        document.getElementById("shotAccuracy").textContent = accuracy + "%";
    }

    function globalToLocal(puttView, globalC, globalR) {
        return {
            c: (globalC - puttView.center.c) * puttView.zoom + Math.floor(puttView.grid[0].length / 2),
            r: (globalR - puttView.center.r) * puttView.zoom + Math.floor(puttView.grid.length / 2)
        };
    }

    function localToGlobal(puttView, localC, localR) {
        return {
            c: puttView.center.c + (localC - Math.floor(puttView.grid[0].length / 2)) / puttView.zoom,
            r: puttView.center.r + (localR - Math.floor(puttView.grid.length / 2)) / puttView.zoom
        };
    }

    function markTee(grid, cols, cx, cy, val) {
        const horizontal = Math.random() < 0.5;
        if (horizontal) {
            for (let y = -1; y <= 0; y++)
                for (let x = -1; x <= 1; x++) {
                    const gx = cx + x;
                    const gy = cy + y;
                    if (gx >= 0 && gy >= 0 && gx < cols && gy < grid.length / cols)
                        grid[gy * cols + gx] = Math.max(grid[gy * cols + gx], val);
                }
        } else {
            for (let y = -1; y <= 1; y++)
                for (let x = -1; x <= 0; x++) {
                    const gx = cx + x;
                    const gy = cy + y;
                    if (gx >= 0 && gy >= 0 && gx < cols && gy < grid.length / cols)
                        grid[gy * cols + gx] = Math.max(grid[gy * cols + gx], val);
                }
        }
    }

    function markEllipticalGreen(grid, cols, cx, cy, rx, ry, val, rng) {
        const rows = grid.length / cols | 0;
        for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
            for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
                if (x >= 0 && y >= 0 && x < cols && y < rows) {
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    const noise = (rng() - 0.5) * 0.2; // piccolo disturbo casuale
                    if (dx * dx + dy * dy + noise <= 1) {
                        grid[y * cols + x] = Math.max(grid[y * cols + x], val);
                    }
                }
            }
        }
    }

    function markCircle(grid, cols, cx, cy, r, val, rng) {
        const rows = grid.length / cols | 0;
        for (let y = cy - r - 1; y <= cy + r + 1; y++) {
            for (let x = cx - r - 1; x <= cx + r + 1; x++) {
                if (x >= 0 && y >= 0 && x < cols && y < rows) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const noise = (rng() - 0.5) * r * 0.3; // disturbo proporzionale al raggio
                    if (dx * dx + dy * dy + noise <= r * r) {
                        grid[y * cols + x] = Math.max(grid[y * cols + x], val);
                    }
                }
            }
        }
    }

    // --- Funzione aggiornata markWater ---
    function markWater(grid, cols, cx, cy, rx, ry, rng, protectedPoints = []) {
        const rows = grid.length / cols | 0;
        for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
            for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
                if (x >= 0 && y >= 0 && x < cols && y < rows) {
                    const dx = 0.8*(x - cx) / rx;
                    const dy = 0.8*(y - cy) / ry;
                    const noise = (rng() - 0.5)*0.8;

                    // Salta se non rough o se vicino a punti protetti
                    const isProtected = protectedPoints.some(p =>
                        Math.abs(x - p.c) <= 2 && Math.abs(y - p.r) <= 2
                    );
                    if (grid[y * cols + x] === LAYERS.ROUGH && !isProtected) {
                        if (dx * dx + dy * dy + noise <= 1) {
                            grid[y * cols + x] = LAYERS.WATER;
                        }
                    }
                }
            }
        }
    }

    function carveCurvedLine(grid, cols, a, b, width, val, rng) {
        const steps = 40;

        // Decidi se il fairway sarà normale o con angolo netto
        const angleChance = rng();
        let mid;

        if (angleChance < 0.25) {
            mid = {
                c: (a.c + b.c) / 2 + (rng() - 0.5) * 25,
                r: (a.r + b.r) / 2 + (rng() - 0.5) * 25
            };
        } else {
            mid = {
                c: (a.c + b.c) / 2 + (rng() - 0.5) * 12,
                r: (a.r + b.r) / 2 + (rng() - 0.5) * 12
            };
        }

        const startPixels = 4 + Math.floor(rng() * 2);
        const endPixels = 2 + Math.floor(rng() * 2);

        for (let i = 0; i <= steps; i++) {
            const t = startPixels / steps + ((steps - startPixels - endPixels) / steps) * (i / steps);
            const cx = (1 - t) * (1 - t) * a.c + 2 * (1 - t) * t * mid.c + t * t * b.c;
            const cy = (1 - t) * (1 - t) * a.r + 2 * (1 - t) * t * mid.r + t * t * b.r;

            const ix = Math.round(cx);
            const iy = Math.round(cy);
            const idx = iy * cols + ix;

            if (grid[idx] !== LAYERS.TEE && grid[idx] !== LAYERS.GREEN && grid[idx] !== LAYERS.HOLE) {
                markCircle(grid, cols, ix, iy, width, val, rng);
            }
        }

        // --- Clear radius separati per tee e green ---
        const teeClearRadius = 0 + Math.floor(rng() * 5);   // 1–2 celle attorno al tee
        const greenClearRadius = 1 + Math.floor(rng() * 4); // 2–3 celle attorno alla buca

        for (let dy = -teeClearRadius; dy <= teeClearRadius; dy++) {
            for (let dx = -teeClearRadius; dx <= teeClearRadius; dx++) {
                const idxTee = (a.r + dy) * cols + (a.c + dx);
                if (grid[idxTee] === LAYERS.FAIRWAY) grid[idxTee] = LAYERS.ROUGH;
            }
        }

        for (let dy = -greenClearRadius; dy <= greenClearRadius; dy++) {
            for (let dx = -greenClearRadius; dx <= greenClearRadius; dx++) {
                const idxGreen = (b.r + dy) * cols + (b.c + dx);
                if (grid[idxGreen] === LAYERS.FAIRWAY) grid[idxGreen] = LAYERS.ROUGH;
            }
        }
    }
    function generateParSequence(basePARS) {
        const counts = {};
        for (let p of basePARS) counts[p] = (counts[p] || 0) + 1;
        const result = [];
        let lastPar = null;

        while (result.length < basePARS.length) {
            let candidates = Object.keys(counts)
                .map(Number)
                .filter(p => counts[p] > 0 && !(lastPar === 3 && p === 3) && !(lastPar === 5 && p === 5));
            if (candidates.length === 0) {
                candidates = Object.keys(counts).map(Number).filter(p => counts[p] > 0);
            }
            const choice = candidates[Math.floor(Math.random() * candidates.length)];
            result.push(choice);
            counts[choice]--;
            lastPar = choice;
        }
        return result;
    }

    function generateMap(holeCount = 9) {
        const rng = createRng();
        const PARS = generateParSequence(holeCount === 9 ? PARS9 : PARS9.concat(PARS9));

        const directions = [
            { name: "N", dx: 0, dy: -1 },
            { name: "NE", dx: 0.7, dy: -0.7 },
            { name: "E", dx: 1, dy: 0 },
            { name: "SE", dx: 0.7, dy: 0.7 },
            { name: "S", dx: 0, dy: 1 },
            { name: "SW", dx: -0.7, dy: 0.7 },
            { name: "W", dx: -1, dy: 0 },
            { name: "NW", dx: -0.7, dy: -0.7 }
        ];
        const getDirIndex = name => directions.findIndex(d => d.name === name);

        let holes = [];
        let tempCoords = [];
        let cur = { c: 0, r: 0 };

        // --- Generazione tee e green per ogni buca ---
        for (let i = 0; i < holeCount; i++) {
            const par = PARS[i];
            const [minL, maxL] = PAR_RANGES[par];
            const len = Math.floor(minL + rng() * (maxL - minL));

            const teeDist = 6;
            let dir, dirIdx, tee, green;
            let attempts = 0;
            do {
                attempts++;
                if (attempts > 30) break;

                const forbidden = holes.length > 0
                    ? [
                        getDirIndex(holes[holes.length - 1].dirName),
                        (getDirIndex(holes[holes.length - 1].dirName) + 1) % 8,
                        (getDirIndex(holes[holes.length - 1].dirName) + 7) % 8,
                        (getDirIndex(holes[holes.length - 1].dirName) + 4) % 8
                    ]
                    : [];

                const candidates = directions.filter((_, idx) => !forbidden.includes(idx));
                const baseDir = candidates[Math.floor(rng() * candidates.length)];

                const angleVar = (rng() - 0.5) * 0.3;
                dir = {
                    dx: baseDir.dx * Math.cos(angleVar) - baseDir.dy * Math.sin(angleVar),
                    dy: baseDir.dx * Math.sin(angleVar) + baseDir.dy * Math.cos(angleVar)
                };
                dirIdx = getDirIndex(baseDir.name);

                tee = { c: cur.c + Math.round(dir.dx * teeDist), r: cur.r + Math.round(dir.dy * teeDist) };
                green = { c: tee.c + Math.round(dir.dx * len), r: tee.r + Math.round(dir.dy * len) };

            } while (
                tempCoords.some(p =>
                    (Math.abs(p.c - tee.c) <= 5 && Math.abs(p.r - tee.r) <= 5) ||
                    (Math.abs(p.c - green.c) <= 8 && Math.abs(p.r - green.r) <= 8)
                )
            );

            holes.push({ number: i + 1, par, tee, holePos: green, dirName: directions[dirIdx].name });
            tempCoords.push({ c: tee.c, r: tee.r });
            tempCoords.push({ c: green.c, r: green.r });

            cur = { c: green.c + Math.round(dir.dx * 6), r: green.r + Math.round(dir.dy * 6) };
        }

        // --- Calcolo dimensioni griglia ---
        const margin = 10;
        const minC = Math.min(...tempCoords.map(p => p.c));
        const maxC = Math.max(...tempCoords.map(p => p.c));
        const minR = Math.min(...tempCoords.map(p => p.r));
        const maxR = Math.max(...tempCoords.map(p => p.r));
        const cols = maxC - minC + 1 + margin * 2;
        const rows = maxR - minR + 1 + margin * 2;

        // --- Normalizza le coordinate delle buche e tee ---
        for (let h of holes) {
            h.tee.c = h.tee.c - minC + margin;
            h.tee.r = h.tee.r - minR + margin;
            h.holePos.c = h.holePos.c - minC + margin;
            h.holePos.r = h.holePos.r - minR + margin;
        }

        // --- Inizializza griglia ---
        const grid = new Uint8Array(cols * rows).fill(LAYERS.ROUGH);

        // --- Aggiungi acqua ---
        const waterCount = 4 + Math.floor(rng() * 15);
        for (let w = 0; w < waterCount; w++) {
            const wx = Math.floor(rng() * cols);
            const wy = Math.floor(rng() * rows);
            const rx = 3 + Math.floor(rng() * 3);
            const ry = 2 + Math.floor(rng() * 2);

            const protectedPoints = [];
            for (let h of holes) {
                protectedPoints.push({ c: h.tee.c, r: h.tee.r });
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        protectedPoints.push({ c: h.holePos.c + dx, r: h.holePos.r + dy });
                    }
                }
            }

            markWater(grid, cols, wx, wy, rx, ry, rng, protectedPoints);
        }

        // --- Costruzione green, tee, fairway, bunker e altezze ---
        for (let h of holes) {
            // Tee
            markTee(grid, cols, h.tee.c, h.tee.r, LAYERS.TEE);

            // Green
            const rx = 3 + Math.round(rng() * 2);
            const ry = 3 + Math.round(rng() * 2);
            markEllipticalGreen(grid, cols, h.holePos.c, h.holePos.r, rx, ry, LAYERS.GREEN, rng);

            // Fairway
            carveCurvedLine(grid, cols, h.tee, h.holePos, 2 + Math.floor(rng() * 2.5), LAYERS.FAIRWAY, rng);

            // --- Genera le altezze del green una sola volta per la buca ---
            const greenSizeRows = ry * 2 + 1;
            const greenSizeCols = rx * 2 + 1;
            h.greenHeights = generateGreenHeights(greenSizeRows, greenSizeCols, 0.5);

            // Bunker
            const bunkerCount = 1 + Math.floor(rng() * 3);
            for (let b = 0; b < bunkerCount; b++) {
                const ang = rng() * Math.PI * 2;
                const dist = 2 + rng() * 4;
                const bx = Math.round(h.holePos.c + Math.cos(ang) * dist);
                const by = Math.round(h.holePos.r + Math.sin(ang) * dist);
                markCircle(grid, cols, bx, by, 2, LAYERS.BUNKER, rng);
            }

            // Buca
            grid[h.holePos.r * cols + h.holePos.c] = LAYERS.HOLE;
        }

        return { grid, cols, rows, holes };
    }

    function expandTileGrid(tiles, zoomFactor = 3) {
        const newRows = tiles.length * zoomFactor;
        const newCols = tiles[0].length * zoomFactor;
        const newGrid = new Array(newRows).fill(0).map(() => new Array(newCols).fill(0));

        for (let r = 0; r < tiles.length; r++) {
            for (let c = 0; c < tiles[0].length; c++) {
                const tile = tiles[r][c];
                const baseR = r * zoomFactor;
                const baseC = c * zoomFactor;

                for (let zr = 0; zr < zoomFactor; zr++) {
                    for (let zc = 0; zc < zoomFactor; zc++) {
                        newGrid[baseR + zr][baseC + zc] = tile;
                    }
                }
            }
        }

        return newGrid;
    }

    function enterPuttView() {
        if (!currentMap || !currentMap.holes || currentMap.holes.length === 0) {
            console.warn("⚠️ Nessuna buca trovata nella mappa!");
            return;
        }

        const ballC = Math.round(gameState.ball.c);
        const ballR = Math.round(gameState.ball.r);

        // trova la buca più vicina
        let closestHole = currentMap.holes[0];
        let minDist = Infinity;
        for (const hole of currentMap.holes) {
            const dx = hole.holePos.c - ballC;
            const dy = hole.holePos.r - ballR;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                closestHole = hole;
            }
        }

        if (!closestHole || !closestHole.holePos) {
            console.warn("⚠️ Nessuna buca valida trovata vicino alla pallina");
            return;
        }

        console.log(`⛳ Modalità PUTT attivata per buca ${closestHole.number}`);

        const holeC = closestHole.holePos.c;
        const holeR = closestHole.holePos.r;
        const radius = 10; // 21x21 tiles base
        const tiles = [];

        // estrai le tile dalla mappa
        for (let r = -radius; r <= radius; r++) {
            const row = [];
            for (let c = -radius; c <= radius; c++) {
                const srcC = holeC + c;
                const srcR = holeR + r;
                if (srcC >= 0 && srcC < currentMap.cols && srcR >= 0 && srcR < currentMap.rows) {
                    const layer = currentMap.grid[srcR * currentMap.cols + srcC];
                    row.push(layer);
                } else {
                    row.push(LAYERS.ROUGH);
                }
            }
            tiles.push(row);
        }

        const zoom = 3;
        const tileSize = 18;
        const zoomedTiles = expandTileGrid(tiles, zoom);

        const zoomRows = zoomedTiles.length;
        const zoomCols = zoomedTiles[0].length;

        // --- genera heightMap per tutta la mini-mappa zoomata ---
        const greenHeights = closestHole.greenHeights;
        const greenRows = greenHeights.length;
        const greenCols = greenHeights[0].length;

        const centerR = Math.floor(zoomRows / 2);
        const centerC = Math.floor(zoomCols / 2);

        const heightMap = Array.from({ length: zoomRows }, (_, r) =>
            Array.from({ length: zoomCols }, (_, c) => {
                // distanza dal centro della mini-mappa
                const dr = r - centerR;
                const dc = c - centerC;

                // coord nel green originale
                const ghR = Math.floor(dr / zoom + greenRows / 2);
                const ghC = Math.floor(dc / zoom + greenCols / 2);

                if (ghR >= 0 && ghR < greenRows && ghC >= 0 && ghC < greenCols) {
                    // dentro il green: altezza reale
                    return greenHeights[ghR][ghC];
                } else {
                    // fuori green: piccolo gradiente casuale/fairway
                    return (Math.random() - 0.5) * 0.2;
                }
            })
        );

        // assegna puttView
        gameState.puttView = {
            grid: zoomedTiles,
            heights: heightMap,
            center: { c: holeC, r: holeR },
            zoom,
            tileSize,
            offset: { x: 0, y: 0 }
        };

        // ✅ converti globali in locali SOLO se non esistono già
        if (!gameState.ball.local) {
            gameState.ball.local = globalToLocal(gameState.puttView, gameState.ball.c, gameState.ball.r);
        }
        if (!gameState.player.local) {
            gameState.player.local = globalToLocal(gameState.puttView, gameState.player.c, gameState.player.r);
        }
        if (!gameState.puttView.localHole) {
            gameState.puttView.localHole = globalToLocal(gameState.puttView, closestHole.holePos.c, closestHole.holePos.r);
        }

        // imposta modalità e UI
        updateControlsUI();
        renderPuttView(gameState.puttView);
        startPuttLoop();
    }

    function exitPuttView() {
        console.log("🏌️‍♂️ Uscita dalla modalità PUTT");
        gameState.mode = "player";
        gameState.puttView = null;
        updateControlsUI();
        render(); // torna a disegnare la mappa normale
    }

    function generateGreenHeights(rows, cols, amplitude = 1, centerCount = 8, maxCenterHeight = 1, maxRadius = 8) {
        const heights = new Array(rows).fill(0).map(() => new Array(cols).fill(0));

        const smooth = 4; // più alto = più morbido base
        // --- base sinusoidale semplice
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const val = (Math.sin(r / smooth) + Math.cos(c / smooth) + Math.random() * 0.3) / 2;
                heights[r][c] = val;
            }
        }

        // --- Genera centri casuali di pendenza ---
        for (let i = 0; i < centerCount; i++) {
            const centerR = Math.floor(Math.random() * rows);
            const centerC = Math.floor(Math.random() * cols);
            const radius = 2 + Math.random() * maxRadius; // raggio casuale
            const height = (Math.random() * 2 - 1) * maxCenterHeight; // altezza casuale

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const dr = r - centerR;
                    const dc = c - centerC;
                    let dist = Math.hypot(dr, dc);

                    if (dist <= radius) {
                        // aggiungi un falloff morbido tipo coseno
                        let t = dist / radius;
                        let falloff = Math.cos(t * Math.PI / 2); // più naturale
                        // aggiungi un piccolo noise per rendere la forma irregolare
                        const noise = (Math.random() - 0.5) * 0.3;
                        heights[r][c] += height * falloff + noise * amplitude;
                    }
                }
            }
        }

        // --- normalizza tra -1 e +1 e applica amplitude ---
        let min = Infinity, max = -Infinity;
        for (const row of heights) {
            for (const v of row) {
                min = Math.min(min, v);
                max = Math.max(max, v);
            }
        }
        const range = max - min || 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                heights[r][c] = (((heights[r][c] - min) / range) * 2 - 1) * amplitude;
            }
        }

        return heights;
    }

    function startPuttLoop() {
        function loop() {
            if (gameState.mode !== "putt") return; // esce se si torna alla mappa normale
            renderPuttView(gameState.puttView);
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    function renderPuttView(puttView) {
        if (!puttView || !puttView.grid) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tileSize = puttView.tileSize || 18;
        const rows = puttView.grid.length;
        const cols = puttView.grid[0].length;

        const totalWidth = cols * tileSize;
        const totalHeight = rows * tileSize;

        // offset base per centrare la mini-mappa
        const baseOffsetX = (canvas.width - totalWidth) / 2;
        const baseOffsetY = (canvas.height - totalHeight) / 2;

        // offset della "camera" (in pixel) modificabile via moveView
        const camOffsetX = puttView.offset?.x || 0;
        const camOffsetY = puttView.offset?.y || 0;

        const offsetX = baseOffsetX + camOffsetX;
        const offsetY = baseOffsetY + camOffsetY;

        // --- Disegna le tile del green zoomato ---
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const layer = puttView.grid[r][c];
                let color = COLORS.fairway;

                switch (layer) {
                    case LAYERS.ROUGH: color = COLORS.rough; break;
                    case LAYERS.FAIRWAY: color = COLORS.fairway; break;
                    case LAYERS.GREEN: color = COLORS.green; break;
                    case LAYERS.BUNKER: color = COLORS.bunker; break;
                    case LAYERS.TEE: color = COLORS.tee; break;
                    case LAYERS.HOLE: color = COLORS.hole; break;
                    case LAYERS.WATER: color = COLORS.water; break;
                }

                // 🎨 Applica variazione cromatica in base all’altimetria
                if (puttView.heights) {
                    const h = puttView.heights[r]?.[c] ?? 0;
                    const shade = Math.floor((h + 1) * 40) - 20;
                    color = shadeTileColor(color, shade);
                }

                ctx.fillStyle = color;
                ctx.fillRect(offsetX + c * tileSize, offsetY + r * tileSize, tileSize, tileSize);
            }
        }

        // --- Disegna le frecce di pendenza ---
        // --- Disegna le frecce di pendenza ---
        if (puttView.heights) {
            ctx.save();
            ctx.strokeStyle = "rgba(255,0,0,0.4)";
            ctx.lineWidth = 1.5;
            ctx.fillStyle = "rgba(255,0,0,0.4)";

            for (let r = 1; r < rows - 1; r++) {
                for (let c = 1; c < cols - 1; c++) {
                    const hL = puttView.heights[r][c - 1];
                    const hR = puttView.heights[r][c + 1];
                    const hU = puttView.heights[r - 1][c];
                    const hD = puttView.heights[r + 1][c];
                    if ([hL, hR, hU, hD].some(h => h === undefined)) continue;

                    // Gradiente
                    const gx = (hR - hL) / 2;
                    const gy = (hD - hU) / 2;
                    const mag = Math.sqrt(gx * gx + gy * gy);
                    if (mag < 0.05) continue;

                    // Direzione normalizzata
                    const nx = gx / mag;
                    const ny = gy / mag;

                    const cx = offsetX + (c + 0.5) * tileSize;
                    const cy = offsetY + (r + 0.5) * tileSize;

                    const arrowLength = tileSize * Math.min(1.2, mag * 12); // lunghezza totale
                    const tipLength = tileSize * 0.4; // punta corta
                    const tailLength = arrowLength - tipLength; // lunghezza coda

                    // --- Linea freccia (coda → punta) ---
                    ctx.beginPath();
                    ctx.moveTo(cx - nx * tailLength, cy - ny * tailLength); // inizio coda
                    ctx.lineTo(cx + nx * tipLength, cy + ny * tipLength);    // punta
                    ctx.stroke();

                    // --- Punta della freccia ---
                    const angle = Math.atan2(ny, nx);
                    const headSize = 7 + mag * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx + nx * tipLength, cy + ny * tipLength);
                    ctx.lineTo(
                        cx + nx * tipLength - Math.cos(angle - Math.PI / 6) * headSize,
                        cy + ny * tipLength - Math.sin(angle - Math.PI / 6) * headSize
                    );
                    ctx.lineTo(
                        cx + nx * tipLength - Math.cos(angle + Math.PI / 6) * headSize,
                        cy + ny * tipLength - Math.sin(angle + Math.PI / 6) * headSize
                    );
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        // --- Disegna la buca (centro della mappa) ---
        const centerC = Math.floor(cols / 2);
        const centerR = Math.floor(rows / 2);
        ctx.beginPath();
        ctx.arc(
            offsetX + (centerC + 0.5) * tileSize,
            offsetY + (centerR + 0.5) * tileSize,
            tileSize * 0.3,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = "black";
        ctx.fill();

        // --- Posizione relativa della pallina rispetto alla buca ---
        const dx = Math.round(gameState.ball.c - puttView.center.c);
        const dy = Math.round(gameState.ball.r - puttView.center.r);
        const px = centerC + dx * puttView.zoom;
        const py = centerR + dy * puttView.zoom;
        // --- Disegna la pallina ---
        const ballLocal = gameState.ball.local;
        if (ballLocal) {
            ctx.beginPath();
            ctx.arc(
                offsetX + (ballLocal.c + 0.5) * tileSize,
                offsetY + (ballLocal.r + 0.5) * tileSize,
                tileSize * 0.25,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = "white";
            ctx.fill();
            ctx.strokeStyle = "#333";
            ctx.stroke();
        }

        // --- Disegna il giocatore sul green (stile mappa generale) ---
        if (gameState.player) {
            const pdx = gameState.player.c - puttView.center.c;
            const pdy = gameState.player.r - puttView.center.r;

            // Coordinate in celle zoomate
            const px = centerC + pdx * puttView.zoom + 0.5;
            const pyFeet = centerR + pdy * puttView.zoom + 0.5;

            const cellPx = puttView.tileSize;

            ctx.lineWidth = Math.max(1, cellPx * 0.08);

            // --- Tile superiore: testa ---
            const headRadius = cellPx * 0.4;
            const headY = (pyFeet - 1.5) * cellPx; // centro testa nella tile più alta
            ctx.beginPath();
            ctx.arc(offsetX + px * cellPx, offsetY + headY, headRadius, 0, Math.PI * 2);
            ctx.fillStyle = "black";
            ctx.fill();

            // --- Tronco e braccia ---
            const bodyTopY = (pyFeet - 1 - 0.1) * cellPx;   // parte superiore corpo
            const bodyBottomY = (pyFeet - 0.4) * cellPx;    // parte inferiore corpo

            // Tronco
            ctx.beginPath();
            ctx.moveTo(offsetX + px * cellPx, offsetY + bodyTopY);
            ctx.lineTo(offsetX + px * cellPx, offsetY + bodyBottomY);
            ctx.strokeStyle = "blue";
            ctx.stroke();

            // Braccia a metà corpo
            ctx.beginPath();
            ctx.moveTo(offsetX + px * cellPx - cellPx * 0.3, offsetY + (bodyTopY + bodyBottomY) / 2);
            ctx.lineTo(offsetX + px * cellPx + cellPx * 0.3, offsetY + (bodyTopY + bodyBottomY) / 2);
            ctx.stroke();

            // --- Gambe ---
            const legExtra = cellPx * 0.3; // lunghezza gambe
            // Gamba sinistra
            ctx.beginPath();
            ctx.moveTo(offsetX + px * cellPx, offsetY + bodyBottomY);
            ctx.lineTo(offsetX + px * cellPx - cellPx * 0.25, offsetY + pyFeet * cellPx + legExtra);
            ctx.stroke();

            // Gamba destra
            ctx.beginPath();
            ctx.moveTo(offsetX + px * cellPx, offsetY + bodyBottomY);
            ctx.lineTo(offsetX + px * cellPx + cellPx * 0.25, offsetY + pyFeet * cellPx + legExtra);
            ctx.stroke();
        }

        // --- LINEA DEL TIRO (coordinate locali corrette) ---
        if (puttTarget && gameState.ball.local) {
            const cellPx = puttView.tileSize || 18;

            // Posizione palla in celle locali
            const ballC = gameState.ball.local.c;
            const ballR = gameState.ball.local.r;

            // Posizione target in celle locali
            const targetC = puttTarget.c;
            const targetR = puttTarget.r;

            // Converti entrambe in pixel, usando offset per centrare la mappa
            const ballX = offsetX + (ballC +0.5) * cellPx;
            const ballY = offsetY + (ballR +0.5) * cellPx;
            const targetX = offsetX + (targetC) * cellPx;
            const targetY = offsetY + (targetR) * cellPx;

            // Disegna la linea rossa del tiro
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ballX, ballY);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
        }

    }

    /* Helper per schiarire/scurire colori in base all'altimetria */
    function shadeTileColor(color, amount) {
        try {
            const num = parseInt(color.replace("#", ""), 16);
            let r = (num >> 16) & 0xFF;
            let g = (num >> 8) & 0xFF;
            let b = num & 0xFF;

            // moduliamo i canali in base ad "amount" (pendenza)
            r = Math.min(255, Math.max(0, r + amount));      // rosso meno dominante
            g = Math.min(255, Math.max(0, g + amount*1.5));            // verde più sensibile
            b = Math.min(255, Math.max(0, b + amount * 1.2));      // blu leggermente più alto per effetto rilievo

            return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        } catch {
            return color;
        }
    }

    function render() {
        if (!currentMap) return;
        const { grid, cols, rows, holes } = currentMap;
        const rect = canvas.getBoundingClientRect();
        const cellPx = rect.width / view.size;

        // Sfondo
        ctx.fillStyle = COLORS.rough;
        ctx.fillRect(0, 0, rect.width, rect.height);

        const startC = Math.floor(view.x);
        const startR = Math.floor(view.y);
        const endC = Math.min(cols, Math.ceil(view.x + view.size));
        const endR = Math.min(rows, Math.ceil(view.y + view.size));

        // Disegna celle della mappa
        for (let r = startR; r < endR; r++) {
            for (let c = startC; c < endC; c++) {
                const v = grid[r * cols + c];

                if (v === LAYERS.ROUGH) ctx.fillStyle = COLORS.rough;
                else if (v === LAYERS.FAIRWAY) ctx.fillStyle = COLORS.fairway;
                else if (v === LAYERS.WATER) ctx.fillStyle = COLORS.water;
                else if (v === LAYERS.BUNKER) ctx.fillStyle = COLORS.bunker;
                else if (v === LAYERS.GREEN) ctx.fillStyle = COLORS.green;
                else if (v === LAYERS.TEE) ctx.fillStyle = COLORS.tee;
                else if (v === LAYERS.HOLE) ctx.fillStyle = COLORS.hole;

                ctx.fillRect((c - view.x) * cellPx, (r - view.y) * cellPx, cellPx, cellPx);
            }
        }

        // Griglia
        ctx.strokeStyle = "rgba(150,250,150,0.4)";
        ctx.lineWidth = 1;
        for (let r = 0; r <= endR - startR; r++) {
            const y = r * cellPx;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo((endC - startC) * cellPx, y);
            ctx.stroke();
        }
        for (let c = 0; c <= endC - startC; c++) {
            const x = c * cellPx;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, (endR - startR) * cellPx);
            ctx.stroke();
        }

        // Disegna pallina
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(
            (gameState.ball.c - view.x + 0.5) * cellPx,
            (gameState.ball.r - view.y + 0.5) * cellPx,
            cellPx * 0.3,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // --- Visualizzazione punto di atterraggio ---
        if (lastLandingSpot) {
            const now = performance.now();
            const age = now - lastLandingSpot.time;
            if (age < 2000) {
                const fade = 1 - age / 2000;

                // Posizione in pixel
                const x = (lastLandingSpot.c - view.x + 0.5) * cellPx;
                const y = (lastLandingSpot.r - view.y + 0.5) * cellPx;

                // Cerchio più grande con bordo bianco e riempimento rosso trasparente
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.beginPath();
                ctx.arc(x, y, cellPx * 1.0, 0, Math.PI * 2); // grande e visibile
                ctx.fillStyle = "rgba(255, 50, 50, 0.5)";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "white";
                ctx.stroke();
                ctx.restore();
            }
        }
        if (gameState.mode === "shot" && shotTarget) {
            // Linea rossa verso il target
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(
                (gameState.ball.c - view.x +0.5) * cellPx,
                (gameState.ball.r - view.y +0.5) * cellPx
            );
            ctx.lineTo(
                (shotTarget.c - view.x) * cellPx,
                (shotTarget.r - view.y) * cellPx
            );
            ctx.stroke();

            // --- CERCHIO DI PRECISIONE ---
            const selectedClubObj = Clubs.find(c => c.name === selectedClub?.name);

            if (selectedClubObj && shotTarget) {
                const baseDistance = selectedClubObj.distance;
                const accuracy = selectedClubObj.accuracy;

                // Valore della barra di accuracy
                const slider = document.getElementById("accuracyRange");
                const barValue = slider ? slider.value : 50; // default 50
                const normBar = barValue / 100;
                const precisionFactor = getAccuracyFromBar(normBar);

                // Raggio d'errore in celle
                const errorRadius = baseDistance * (1 - accuracy * precisionFactor);

                // Converti in pixel
                const errorRadiusPx = errorRadius * cellPx;

                // Colore
                let color = "rgba(255,100,100,0.5)";

                // Disegna cerchio centrato sul punto di destinazione
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.fillStyle = color.replace("0.4", "0.15");
                ctx.lineWidth = 2;
                ctx.arc(
                    (shotTarget.c - view.x) * cellPx,
                    (shotTarget.r - view.y) * cellPx,
                    errorRadiusPx,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                ctx.stroke();
            }

        }

        const px = gameState.player.c - view.x + 0.5;
        const pyFeet = gameState.player.r - view.y + 0.5;

        ctx.lineWidth = Math.max(1, cellPx * 0.08);

        // --- Tile superiore: testa ---
        const headRadius = cellPx * 0.4;
        const headY = (pyFeet - 2 + 0.5) * cellPx; // centro testa nella tile più alta
        ctx.beginPath();
        ctx.arc(px * cellPx, headY, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();

        // --- Tile centrale: tronco e braccia ---
        const bodyTopY = (pyFeet - 1 + -0.1) * cellPx;   // parte superiore corpo
        const bodyBottomY = (pyFeet - 0.4) * cellPx;    // parte inferiore corpo
        ctx.beginPath();
        ctx.strokeStyle = "blue";
        // Tronco
        ctx.moveTo(px * cellPx, bodyTopY);
        ctx.lineTo(px * cellPx, bodyBottomY);
        ctx.stroke();

        // Braccia a metà corpo
        ctx.beginPath();
        ctx.moveTo(px * cellPx - cellPx * 0.3, (bodyTopY + bodyBottomY) / 2);
        ctx.lineTo(px * cellPx + cellPx * 0.3, (bodyTopY + bodyBottomY) / 2);
        ctx.stroke();

        // --- Tile inferiore: gambe ---
        const legExtra = cellPx * 0.3; // quanto vuoi allungare le gambe

        ctx.beginPath();
        // Gamba sinistra
        ctx.moveTo(px * cellPx, bodyBottomY);
        ctx.lineTo(px * cellPx - cellPx * 0.25, pyFeet * cellPx + legExtra);

        // Gamba destra
        ctx.moveTo(px * cellPx, bodyBottomY);
        ctx.lineTo(px * cellPx + cellPx * 0.25, pyFeet * cellPx + legExtra);

        ctx.stroke();

        // Disegna numero buca e par sul tee
        for (const h of holes) {
            const teeC = h.tee.c;
            const teeR = h.tee.r;

            const teeX = (teeC - view.x + 0.5) * cellPx;
            const teeY = (teeR - view.y + 0.5) * cellPx;

            // Numero della buca grande sopra il tee
            ctx.fillStyle = "black";
            ctx.font = `bold ${Math.floor(cellPx * 1.5)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(h.number, teeX, teeY - cellPx * 0.05);

            // Par della buca, sotto il numero
            ctx.font = `bold ${Math.floor(cellPx * 1.3)}px sans-serif`;
            ctx.textBaseline = "top";
            ctx.fillText(`Par ${h.par}`, teeX, teeY + cellPx * 0.05);
        }

        // Disegna buche con bandierina e numero tee
        for (const h of holes) {
            const holeC = h.holePos.c;
            const holeR = h.holePos.r;

            const cellPx = rect.width / view.size;

            // --- Tile della buca: cerchio nero ---
            const holeX = (holeC - view.x + 0.5) * cellPx;
            const holeY = (holeR - view.y + 0.5) * cellPx;
            ctx.fillStyle = "black";
            ctx.beginPath();
            ctx.arc(holeX, holeY, cellPx * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // --- Tile sopra: asta della bandiera ---
            const flagPoleR = holeR - 1;
            if (flagPoleR >= 0) {
                const poleX = (holeC - view.x + 0.5) * cellPx;
                const poleY = (flagPoleR - view.y + 0.5) * cellPx;
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(poleX, poleY + cellPx * 0.5);
                ctx.lineTo(poleX, poleY - cellPx * 0.5);
                ctx.stroke();
            }

            // --- Tile ancora sopra: bandierina rossa + numero buca ---
            const flagTopR = holeR - 2;
            if (flagTopR >= 0) {
                const flagX = (holeC - view.x + 0.5) * cellPx;
                const flagY = (flagTopR - view.y + 0.5) * cellPx;

                // Bandierina triangolare più grande
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.moveTo(flagX, flagY - cellPx * 0.8);
                ctx.lineTo(flagX + cellPx * 1.5, flagY);
                ctx.lineTo(flagX, flagY + cellPx * 0.8);
                ctx.closePath();
                ctx.fill();

                // Numero della buca più grande
                ctx.fillStyle = "white";
                ctx.font = `bold ${Math.floor(cellPx * 1.5)}px sans-serif`;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(h.number, flagX, flagY);
            }

        }
        //logAnimationQueue();
    }

    // Controllo camera libera (freccette)
    function moveView(dx, dy) {
        if ((gameState.mode === "putt" || gameState.mode === "puttmove") && gameState.puttView) {
            // 🔍 Muovi la vista del putt
            const pv = gameState.puttView;
            if (!pv.offset) pv.offset = { x: 0, y: 0 };

            const tileSize = pv.tileSize || 18;

            // 🔄 Movimento libero in pixel
            pv.offset.x -= dx * tileSize;
            pv.offset.y -= dy * tileSize;

            // ❌ Niente più limiti o clamp
            renderPuttView(pv);
        } else {
            // 🔍 Muovi la vista principale
            if (!currentMap) return;

            // ❌ Rimuoviamo i limiti (movimento totalmente libero)
            view.x += dx;
            view.y += dy;

            render();
        }
    }

    // Zoom: centra sempre la camera sul giocatore
    function zoomView(dir) {
        zoomIndex = Math.min(zoomLevels.length - 1, Math.max(0, zoomIndex + dir));
        view.size = zoomLevels[zoomIndex];

        render();
    }

    function updateControlsUI() {
        stopAccuracyBar();
        if (gameState.mode === "player") {
            playerControls.style.display = "flex";
            shotControls.style.display = "none";
            updateWind();

        } else if (gameState.mode === "shot") {
            playerControls.style.display = "none";
            shotControls.style.display = "flex";

            // Mostra tutte le tessere e i bottoni di tiro
            document.querySelectorAll("#clubDeck, #shotDeck").forEach(el => el.style.display = "flex");
            document.querySelectorAll("#shootBtn, #accuracyBarContainer").forEach(el => el.style.display = "flex");

            startAccuracyBar();
            updateHoleHUD();

        } else if (gameState.mode === "putt") {
            playerControls.style.display = "none";
            shotControls.style.display = "flex";

            // Nascondi tessere mazze, mostra solo tiro e barra accuracy
            document.querySelectorAll("#clubDeck, #shotDeck").forEach(el => el.style.display = "none");
            document.querySelectorAll("#shootBtn, #accuracyBarContainer").forEach(el => el.style.display = "block");

            // Avvia la barra solo se la palla NON si sta muovendo
            if (!gameState.ball.moving) {
                startAccuracyBar();
            }

        } else if (gameState.mode === "puttmove") {
            // Mostra frecce movimento sul green
            playerControls.style.display = "flex";

            // Nascondi controlli tiro
            shotControls.style.display = "none";

            // La visuale resta zoomata sul green
        }
    }

    // Movimento giocatore
    function movePlayer(dc, dr) {
        if (gameState.mode !== "player" && gameState.mode !== "puttmove") return;

        let newC = gameState.player.c + dc;
        let newR = gameState.player.r + dr;

        if (gameState.mode === "puttmove" && gameState.puttView) {
            const pv = gameState.puttView;
            let newLocalC = (gameState.player.local?.c || 0) + dc;
            let newLocalR = (gameState.player.local?.r || 0) + dr;

            // Limita all’interno del green
            if (newLocalC < 0 || newLocalC >= pv.grid[0].length) return;
            if (newLocalR < 0 || newLocalR >= pv.grid.length) return;

            // Aggiorna posizione locale
            gameState.player.local.c = newLocalC;
            gameState.player.local.r = newLocalR;

            // Aggiorna coordinate globali
            const global = localToGlobal(pv, newLocalC, newLocalR);
            newC = gameState.player.c = global.c;
            newR = gameState.player.r = global.r;

            // --- CONTROLLO SE IL GIOCATORE È SULLA PALLINA ---
            const ballLocal = gameState.ball.local;
            if (ballLocal && newLocalC === Math.round(ballLocal.c) && newLocalR === Math.round(ballLocal.r)) {
                console.log("⛳ Giocatore ha raggiunto la pallina → modalità PUTT");
                gameState.mode = "putt";
                updateControlsUI();
            }

            // --- CONTROLLO FINE BUCA ---
            const hole = pv.localHole;
            if (ballLocal && hole &&
                Math.round(ballLocal.c) === Math.round(hole.c) &&
                Math.round(ballLocal.r) === Math.round(hole.r) &&
                newLocalC === Math.round(ballLocal.c) &&
                newLocalR === Math.round(ballLocal.r)
            ) {
                console.log("🏁 Palla imbucata! Passaggio alla buca successiva");

                // Salva colpi della buca corrente
                if (!gameState.shotsTotal) gameState.shotsTotal = [];
                gameState.shotsTotal[currentHoleIndex] = holeShots;
                console.log(`🏌️ Colpi buca ${currentHoleIndex + 1}: ${holeShots}`);

                // Reset variabili green/putt
                gameState.mode = "player";
                gameState.puttView = null;
                gameState.player.local = null;
                gameState.ball.local = null;

                updateControlsUI();
                render(); // torna alla mappa generale

                // Passa alla buca successiva
                currentHoleIndex++;
                if (currentHoleIndex >= gameHoles.length) currentHoleIndex = 0;
                const nextHole = gameHoles[currentHoleIndex];
                if (nextHole) {
                    // Posiziona pallina sul tee della nuova buca
                    gameState.ball.c = nextHole.tee.c;
                    gameState.ball.r = nextHole.tee.r;
                    holeShots = 0; // reset colpi per la nuova buca
                    console.log(`🏌️ Pallina spostata al tee della buca ${nextHole.number}`);
                }
                return; // esce per non processare altro
            }

            renderPuttView(pv);
        } else {
            // Movimento normale sulla mappa generale
            if (newC < 0 || newC >= currentMap.cols) return;
            if (newR < 0 || newR >= currentMap.rows) return;

            gameState.player.c = newC;
            gameState.player.r = newR;

            // Aggiorna la camera a seguire
            if (!gameState.followingPlayer) {
                gameState.followingPlayer = true;
                const follow = () => {
                    if (!gameState.followingPlayer) return;
                    const targetX = gameState.player.c - view.size / 2;
                    const targetY = gameState.player.r - view.size / 2;
                    const lerpFactor = 0.15;
                    view.x += (targetX - view.x) * lerpFactor;
                    view.y += (targetY - view.y) * lerpFactor;
                    render();
                    if (Math.abs(targetX - view.x) > 0.05 || Math.abs(targetY - view.y) > 0.05) {
                        requestAnimationFrame(follow);
                    } else {
                        gameState.followingPlayer = false;
                    }
                };
                requestAnimationFrame(follow);
            }
        }

        const ballC = Math.round(gameState.ball.c);
        const ballR = Math.round(gameState.ball.r);

        // --- Solo se siamo in modalità player normale ---
        if (gameState.mode === "player" && newC === ballC && newR === ballR) {
            const holePos = gameHoles[currentHoleIndex].holePos;
            const tileType = getTileTypeAt(ballC, ballR);

            // Controllo speciale: pallina sulla buca
            if (ballC === holePos.c && ballR === holePos.r) {
                console.log("🎯 Pallina sulla buca (fuori dal green)!");
                const chance = Math.random();

                if (chance <= 0.15) {
                    // ✅ 15% imbucata
                    console.log("🏁 Colpo fortunato! Palla imbucata!");
                    if (!gameState.shotsTotal) gameState.shotsTotal = [];
                    gameState.shotsTotal[currentHoleIndex] = holeShots;

                    // Reset variabili
                    gameState.mode = "player";
                    gameState.puttView = null;
                    if (gameState.player.local) gameState.player.local = null;
                    if (gameState.ball.local) gameState.ball.local = null;

                    updateControlsUI();
                    render();

                    // Passa alla buca successiva
                    currentHoleIndex++;
                    if (currentHoleIndex >= gameHoles.length) currentHoleIndex = 0;
                    const nextHole = gameHoles[currentHoleIndex];
                    if (nextHole) {
                        gameState.ball.c = nextHole.tee.c;
                        gameState.ball.r = nextHole.tee.r;
                        holeShots = 0;
                        console.log(`🏌️ Pallina spostata al tee della buca ${nextHole.number}`);
                    }
                    return;

                } else {
                    // ❌ 85% → palla vicino alla buca
                    console.log("😅 Colpo sfortunato! La palla resta vicino alla buca...");
                    const offsets = [
                        [-1, -1], [0, -1], [1, -1],
                        [-1, 0], [1, 0],
                        [-1, 1], [0, 1], [1, 1]
                    ];
                    const choice = offsets[Math.floor(Math.random() * offsets.length)];
                    gameState.ball.c = ballC + choice[0];
                    gameState.ball.r = ballR + choice[1];

                    render();
                    // Resta in modalità PLAYER: il giocatore deve muoversi verso la pallina
                    return; // molto importante, esce qui per non attivare subito la modalità putt
                }
            }

            // Gestione normale green / shot SOLO se la pallina non era sulla buca
            if (tileType === "green") {
                gameState.mode = "putt";
                enterPuttView();
            } else if (tileType !== "hole") {
                gameState.mode = "shot";
            }

            updateControlsUI();
            console.log(`ℹ️ Giocatore e pallina coincidono! Modalità attuale: ${gameState.mode}`);
        }
    }

    // Eventi frecce
    upBtn.onclick = () => moveView(0, -5);
    downBtn.onclick = () => moveView(0, 5);
    leftBtn.onclick = () => moveView(-5, 0);
    rightBtn.onclick = () => moveView(5, 0);

    // Eventi zoom
    zoomInBtn.onclick = () => zoomView(-1);
    zoomOutBtn.onclick = () => zoomView(1);

    document.getElementById("playerLU").onclick = () => movePlayer(-1, -1);
    document.getElementById("playerUp").onclick = () => movePlayer(0, -1);
    document.getElementById("playerRU").onclick = () => movePlayer(1, -1);
    document.getElementById("playerDown").onclick = () => movePlayer(0, 1);
    document.getElementById("playerLD").onclick = () => movePlayer(-1, 1);
    document.getElementById("playerRD").onclick = () => movePlayer(1, 1);
    document.getElementById("playerLeft").onclick = () => movePlayer(-1, 0);
    document.getElementById("playerRight").onclick = () => movePlayer(1, 0);


    canvas.addEventListener("click", e => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (gameState.mode === "shot") {
            // Mappa normale
            const cellPx = rect.width / view.size;
            const targetC = view.x + mouseX / cellPx;
            const targetR = view.y + mouseY / cellPx;

            shotTarget = { c: targetC, r: targetR };
            render();
            updateShotInfo(shotTarget);

        } else if (gameState.mode === "putt" && gameState.puttView) {
            // Mappa putt zoomata
            const putt = gameState.puttView;

            const offsetX = (canvas.width - putt.grid[0].length * putt.tileSize) / 2 + (putt.offset?.x || 0);
            const offsetY = (canvas.height - putt.grid.length * putt.tileSize) / 2 + (putt.offset?.y || 0);

            const px = mouseX - offsetX;
            const py = mouseY - offsetY;

            const localC = px / putt.tileSize;
            const localR = py / putt.tileSize;
            puttTarget = { c: localC, r: localR };

            renderPuttView(putt);
            updateShotInfo(puttTarget);
        }
    });

    let ballAnimFrame = null; // tiene traccia dell'animazione della pallina

    function updateBall() {
        if (!gameState.ball.moving) return;

        // aggiorna posizione con la velocità corrente
        gameState.ball.c += gameState.ball.dx;
        gameState.ball.r += gameState.ball.dy;

        // se siamo in fase di volo
        if (gameState.ball.phase === "flight") {
            const ft = gameState.ball.flightTarget;
            const distToFlight = Math.hypot(ft.c - gameState.ball.c, ft.r - gameState.ball.r);

            // soglia per considerare "arrivato" (in celle)
            if (distToFlight < 0.08) {
                gameState.ball.c = ft.c;
                gameState.ball.r = ft.r;

                // segna il punto di atterraggio
                lastLandingSpot = { c: Math.round(ft.c), r: Math.round(ft.r), time: performance.now() };
                setTimeout(() => { lastLandingSpot = null; }, 2000);

                // passa alla fase di rotolo
                gameState.ball.phase = "roll";

                const rt = gameState.ball.rollTarget;
                const rollDistance = Math.hypot(rt.c - ft.c, rt.r - ft.r);

                if (rollDistance <= 0.001) {
                    gameState.ball.dx = 0;
                    gameState.ball.dy = 0;
                    gameState.ball.moving = false;
                } else {
                    const rollFrames = Math.max(6, Math.round((gameState.ball.currentShot.roll || 1) * 6));
                    gameState.ball.dx = (rt.c - ft.c) / rollFrames;
                    gameState.ball.dy = (rt.r - ft.r) / rollFrames;
                }

                console.log(`%c🛬 Atterraggio volo: c=${Math.round(ft.c)}, r=${Math.round(ft.r)}`, "color:orange;font-weight:bold;");
            }
        }
        // fase di rotolo
        else if (gameState.ball.phase === "roll") {
            const friction = 0.88;
            gameState.ball.dx *= friction;
            gameState.ball.dy *= friction;

            const rt = gameState.ball.rollTarget;
            const distToRoll = Math.hypot(rt.c - gameState.ball.c, rt.r - gameState.ball.r);

            if (
                distToRoll < 0.08 ||
                (Math.abs(gameState.ball.dx) < 0.01 && Math.abs(gameState.ball.dy) < 0.01)
            ) {
                gameState.ball.c = rt.c;
                gameState.ball.r = rt.r;
                gameState.ball.dx = 0;
                gameState.ball.dy = 0;
                gameState.ball.moving = false;
                gameState.ball.phase = "stopped";

                console.log(`%c🔚 Rotolo finito: c=${Math.round(rt.c)}, r=${Math.round(rt.r)}`, "color:green;font-weight:bold;");
            }
        }
        // fase di movimento residuo
        else {
            const friction = 0.92;
            gameState.ball.dx *= friction;
            gameState.ball.dy *= friction;
        }

        // --- Movimento camera (segue la palla) ---
        if (currentMap) {
            const targetViewX = gameState.ball.c - view.size / 2;
            const targetViewY = gameState.ball.r - view.size / 2;
            const lerpFactor = 0.1;
            view.x += (targetViewX - view.x) * lerpFactor;
            view.y += (targetViewY - view.y) * lerpFactor;
        }

        // --- Rendering normale ---
        render();

        // --- Se la palla si è fermata ---
        if (!gameState.ball.moving) {
            gameState.ball.c = Math.round(gameState.ball.c);
            gameState.ball.r = Math.round(gameState.ball.r);

            // ritorna al controllo del giocatore
            gameState.mode = "player";
            gameState.ball.landed = false;
            updateControlsUI();

            // --- ritorno dolce della camera sul giocatore ---
            setTimeout(() => {
                const smoothReturn = () => {
                    const targetViewX = gameState.player.c - view.size / 2;
                    const targetViewY = gameState.player.r - view.size / 2;
                    const lerpFactor = 0.1;
                    const dx = targetViewX - view.x;
                    const dy = targetViewY - view.y;

                    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
                        view.x = targetViewX;
                        view.y = targetViewY;
                        render();
                        return;
                    }

                    view.x += dx * lerpFactor;
                    view.y += dy * lerpFactor;
                    render();
                    requestAnimationFrame(smoothReturn);
                };
                requestAnimationFrame(smoothReturn);
            }, 1000);

            return;
        }

        // --- Continua animazione ---
        ballAnimFrame = requestAnimationFrame(updateBall);
        updateDistanceTravelled();
    }

    // --- Funzione di aggiornamento del putt ---
    function updatePutt() {
        const pv = gameState.puttView;
        const ball = gameState.ball.local;
        const target = gameState.puttTarget;

        if (!pv || !ball || !gameState.ball.moving) return;

        // Calcola differenza diretta
        const deltaC = target.c - ball.c;
        const deltaR = target.r - ball.r;
        const dist = Math.hypot(deltaC, deltaR);

        // 🔹 Se siamo arrivati a destinazione
        if (dist < 0.3) {
            ball.c = target.c;
            ball.r = target.r;
            gameState.ball.moving = false;

            console.log(
                `🟢 Palla ferma → modalità PUTTMOVE\n` +
                `   Posizione finale: c=${ball.c.toFixed(2)}, r=${ball.r.toFixed(2)}`
            );

            gameState.mode = "puttmove";
            updateControlsUI();
            enterPuttView();
            renderPuttView(pv);
            return;
        }

        // --- Movimento costante verso il target corretto ---
        const speed = 0.05;

        // Calcola direzione normalizzata
        const dx = (deltaC / dist) * speed;
        const dy = (deltaR / dist) * speed;

        // Aggiorna posizione
        ball.c += dx;
        ball.r += dy;

        // Rendering continuo
        renderPuttView(pv);
        requestAnimationFrame(updatePutt);
    }

    let wind = {
        direction: Math.floor(Math.random() * 8), // 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SO, 6=O, 7=NO
        strength: parseFloat((Math.random() * 3.5).toFixed(1)) // 0.0 - 3.5
    };
    function updateWind() {
        // Vento varia leggermente ogni tiro
        wind.strength = Math.max(0, Math.min(2.5, wind.strength + (Math.random() - 0.5)));
        wind.direction = (wind.direction + Math.floor(Math.random() * 3) - 1 + 8) % 8;
    }
    function updateWindDisplay() {
        const arrow = document.getElementById("windArrow");
        const value = document.getElementById("windValue");
        if (!arrow || !value) return;

        // 45° per ogni direzione (0–7)
        const angle = wind.direction * 45;
        arrow.style.transform = `rotate(${angle}deg)`;

        // Forza vento
        value.textContent = wind.strength.toFixed(1);
    }

    function getTileTypeAt(c, r) {
        if (!currentMap || !currentMap.grid) return "fairway";

        const col = Math.round(c);
        const row = Math.round(r);

        // Controlla che siamo dentro i limiti
        if (row < 0 || row >= currentMap.rows || col < 0 || col >= currentMap.cols) {
            return "rough"; // bordo fuori mappa
        }

        // Calcola indice lineare
        const idx = row * currentMap.cols + col;
        const layer = currentMap.grid[idx];

        // Converte da numero → tipo leggibile
        switch (layer) {
            case LAYERS.ROUGH: return "rough";
            case LAYERS.FAIRWAY: return "fairway";
            case LAYERS.BUNKER: return "bunker";
            case LAYERS.GREEN: return "green";
            case LAYERS.TEE: return "tee";
            case LAYERS.HOLE: return "green"; // buca: trattiamola come green
            case LAYERS.WATER: return "water";
            default: return "fairway";
        }
    }
    function getTileModifierAt(c, r, clubId) {
        const tileType = getTileTypeAt(c, r);
        const tileData = TILE_MODIFIERS[tileType] || TILE_MODIFIERS.fairway;

        // Modificatore di base
        let modifier = { ...tileData.default };

        // Se la tile ha modifiche specifiche per questa mazza, le applica sopra
        if (tileData.clubs && tileData.clubs[clubId]) {
            modifier = { ...modifier, ...tileData.clubs[clubId] };
        }

        return modifier;
    }

    // --- Funzione hitBall ---
    function hitBall(club, special, shotTarget, barValue = 50) {

        // --- 1️⃣ Normalizza barra ---
        const normBar = barValue / 100; // 0..1

        // --- 2️⃣ Costruisci shot base ---
        let shot = {
            distance: club.distance || 5,
            roll: club.roll || 0,
            accuracy: club.accuracy || 1
        };

        const tileMod = getTileModifierAt(gameState.ball.c, gameState.ball.r, club.id);
        shot.distance *= tileMod.distance ?? 1;
        shot.roll *= tileMod.roll ?? 1;
        shot.accuracy *= tileMod.accuracy ?? 1;

        if (special && typeof special.modify === "function") {
            special.modify(shot);
        }

        shot.accuracy = Math.min(1, Math.max(0.1, shot.accuracy));
        shot.roll = Math.max(0, shot.roll);
        shot.distance = Math.max(1, shot.distance);

        // --- 3️⃣ Calcola precisione finale in base alla barra ---
        let precisionFactor;
        if (barValue >= 45 && barValue <= 65) {
            precisionFactor = 0.99; // 100%
        } else {
            let distFromCenter = Math.abs(normBar - 0.5) * 2;
            precisionFactor = 1 - (1 - shot.accuracy) * distFromCenter;
        }

        const lateralDeviation = normBar - 0.5; // per deviazione angolare

        // --- 4️⃣ Direzione verso target ---
        const dx = shotTarget.c - gameState.ball.c;
        const dy = shotTarget.r - gameState.ball.r;
        const len = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / len;
        const dirY = dy / len;

        // --- 5️⃣ Calcolo errore dovuto all'accuracy ---
        const errorRadius = shot.distance * (1 - precisionFactor);
        const angleError = lateralDeviation * (Math.PI / 4) + (Math.random() - 0.5) * (Math.PI / 16) * (1 - precisionFactor);
        const distError = (Math.random() - 0.5) * errorRadius;

        const finalX = Math.cos(angleError) * dirX - Math.sin(angleError) * dirY;
        const finalY = Math.sin(angleError) * dirX + Math.cos(angleError) * dirY;

        const pureAccuracyOffset = Math.hypot(finalX * shot.distance - dx, finalY * shot.distance - dy);

        console.log(
            `%c🌟 HIT BALL INFO:` +
            `\n   Barra accuracy: ${barValue}%` +
            `\n   Precisione complessiva: ${(precisionFactor * 100).toFixed(2)}%` +
            `\n   Deviazione dovuta all'accuracy: ${pureAccuracyOffset.toFixed(2)} tiles`,
            "color:#fa0;font-weight:bold;"
        );

        // --- 6️⃣ Volo senza vento ---
        let flightTarget = {
            c: gameState.ball.c + finalX * (shot.distance + distError),
            r: gameState.ball.r + finalY * (shot.distance + distError)
        };

        const flightWithoutWind = { ...flightTarget };

        // --- 7️⃣ Calcolo vento ---
        const windAngleRad = wind.direction * (Math.PI / 4); // 8 direzioni → radianti
        const windVectorX = Math.cos(windAngleRad);
        const windVectorY = Math.sin(windAngleRad);

        // ✅ Applica eventuale moltiplicatore dallo special
        const windMultiplier = special?.windMultiplier ?? 1;
        const effectiveWindStrength = wind.strength * windMultiplier;

        const windEffect = shot.distance * (effectiveWindStrength / 15);
        flightTarget.c += windVectorX * windEffect;
        flightTarget.r += windVectorY * windEffect;

        // --- 🔹 Log effetto vento ---
        const windOffset = Math.hypot(flightTarget.c - flightWithoutWind.c, flightTarget.r - flightWithoutWind.r);
        console.log(
            `%c💨 Effetto vento:` +
            `\n   Forza effettiva: ${effectiveWindStrength.toFixed(2)} (×${windMultiplier})` +
            `\n   Vettore vento: dx=${(flightTarget.c - flightWithoutWind.c).toFixed(2)}, dy=${(flightTarget.r - flightWithoutWind.r).toFixed(2)}` +
            `\n   Spostamento totale dovuto al vento: ${windOffset.toFixed(2)} tiles`,
            "color:#0cf;font-weight:bold;"
        );

        // --- 8️⃣ Rotolo finale ---
        const landingMod = getTileModifierAt(flightTarget.c, flightTarget.r, club.id);
        shot.roll *= landingMod.roll ?? 1;

        let rollTarget = {
            c: flightTarget.c + finalX * shot.roll,
            r: flightTarget.r + finalY * shot.roll
        };

        // --- 9️⃣ Arrotonda solo alla fine ---
        flightTarget.c = Math.floor(flightTarget.c);
        flightTarget.r = Math.floor(flightTarget.r);
        rollTarget.c = Math.floor(rollTarget.c);
        rollTarget.r = Math.floor(rollTarget.r);

        return {
            flightTarget,
            rollTarget,
            shot
        };
    }

    function hitPutt(ball, puttTarget, pv, barValue = 50) {
        // --- ⚙️ Parametri ---
        const basePower = Math.max(0.2, barValue / 100);
        const baseSlopeInfluence = 8;
        const samplingStep = 0.3;
        const maxDeviation = 20;

        const start = { c: ball.c, r: ball.r };
        const target = { c: puttTarget.c, r: puttTarget.r };

        const dx = target.c - start.c;
        const dy = target.r - start.r;
        const dist = Math.hypot(dx, dy);
        const dirX = dx / dist;
        const dirY = dy / dist;

        // --- Influenza pendenza ---
        const minDist = 4;
        const maxDist = 12;
        const distFactor = Math.min(1, Math.max(0, (dist - minDist) / (maxDist - minDist)));
        const slopeInfluence = baseSlopeInfluence * distFactor;

        let offsetC = 0;
        let offsetR = 0;

        for (let t = 0; t <= dist; t += samplingStep) {
            const cPos = start.c + dirX * t;
            const rPos = start.r + dirY * t;
            const rIdx = Math.floor(rPos);
            const cIdx = Math.floor(cPos);
            if (!pv.heights[rIdx] || pv.heights[rIdx][cIdx] === undefined) continue;

            const h = pv.heights[rIdx][cIdx];
            const hL = pv.heights[rIdx]?.[cIdx - 1] ?? h;
            const hR = pv.heights[rIdx]?.[cIdx + 1] ?? h;
            const hU = pv.heights[rIdx - 1]?.[cIdx] ?? h;
            const hD = pv.heights[rIdx + 1]?.[cIdx] ?? h;

            const gradC = (hR - hL) * 0.5;
            const gradR = (hD - hU) * 0.5;

            offsetC += gradC * slopeInfluence * (1 - t / dist) * basePower;
            offsetR += gradR * slopeInfluence * (1 - t / dist) * basePower;
        }

        offsetC = Math.max(-maxDeviation, Math.min(maxDeviation, offsetC));
        offsetR = Math.max(-maxDeviation, Math.min(maxDeviation, offsetR));

        // --- 🎯 Deviazione da barra accuracy (putt = max ±10%) ---
        const normBar = barValue / 100;
        const basePuttAccuracy = 0.9; // 90% di precisione base

        // Calcolo precisione effettiva della barra
        let precisionFactor;
        if (barValue >= 45 && barValue <= 55) { // centro barra ±5%
            precisionFactor = 0.99; // 100%
        } else {
            const distFromCenter = Math.abs(normBar - 0.5) * 2; // 0..1
            precisionFactor = 1 - (1 - basePuttAccuracy) * distFromCenter;
        }

        // Deviazione laterale massima ±10% della distanza
        const lateralDeviation = (1 - precisionFactor) * 0.1 * dist;
        const angle = (Math.random() < 0.5 ? -1 : 1) * lateralDeviation;

        const adjustedTarget = {
            c: Math.floor(target.c + offsetC + angle * dirY),
            r: Math.floor(target.r + offsetR - angle * dirX)
        };

        const pureAccuracyOffset = Math.hypot(adjustedTarget.c - target.c, adjustedTarget.r - target.r);

        console.log(
            `%c⛳ PUTT HIT INFO:` +
            `\n   Barra accuracy: ${barValue}%` +
            `\n   Precisione effettiva: ${(precisionFactor * 100).toFixed(2)}%` +
            `\n   Deviazione dovuta all'accuracy: ${pureAccuracyOffset.toFixed(2)} tiles`,
            "color:#4af;font-weight:bold;"
        );

        // --- Rotolo residuo ---
        const rollDistance = 1.2 * basePower;
        const rollDirX = (adjustedTarget.c - start.c) / dist;
        const rollDirR = (adjustedTarget.r - start.r) / dist;
        const rollTarget = {
            c: adjustedTarget.c + rollDirX * rollDistance,
            r: adjustedTarget.r + rollDirR * rollDistance
        };

        return {
            finalTarget: adjustedTarget,
            rollTarget
        };
    }

    document.getElementById("shootBtn").onclick = () => {
        const barValue = stopAccuracyBar(); // ferma la barra e ottieni il valore corrente (0..100)
        isAnimatingAccuracy = false;

        // Aggiorna visivamente la barra
        const fill = document.getElementById("accuracyFill");
        if (fill) fill.style.width = `${barValue}%`;

        if (gameState.mode === "shot") {
            if (!selectedClub || !shotTarget) return;

            holeShots++;
            updateHoleHUD();
            updateDistanceTravelled();

            // --- Calcolo colpo normale ---
            const result = hitBall(selectedClub, selectedSpecial, shotTarget, barValue);
            const { flightTarget, rollTarget, shot } = result;

            gameState.ball.phase = "flight";
            gameState.ball.flightTarget = { ...flightTarget };
            gameState.ball.rollTarget = { ...rollTarget };
            gameState.ball.currentShot = shot;

            const flightFrames = Math.max(8, Math.round(shot.distance * 6));
            gameState.ball.dx = (flightTarget.c - gameState.ball.c) / flightFrames;
            gameState.ball.dy = (flightTarget.r - gameState.ball.r) / flightFrames;
            gameState.ball.moving = true;
            gameState.ball.landed = false;

            gameState.mode = "ball";
            updateControlsUI();
            cancelAnimationFrame(ballAnimFrame);
            requestAnimationFrame(updateBall);
            updateWindDisplay();
            return;
        }

        if (gameState.mode === "putt") {
            if (!puttTarget || !gameState.puttView || !gameState.ball.local) return;

            holeShots++;
            updateHoleHUD();

            const pv = gameState.puttView;
            const ball = gameState.ball.local;

            // --- Normalizza barra e calcola precisione (limite 10%) ---
            const normBar = barValue / 100; // 0..1
            const precisionFactor = getAccuracyFromBar(normBar); // 0..1, massimo al centro
            const lateralDeviationFactor = 0.1; // massimo 10% della distanza del putt
            const adjustedBarValue = precisionFactor * lateralDeviationFactor * Math.hypot(puttTarget.c - ball.c, puttTarget.r - ball.r);

            // Passa la deviazione calcolata a hitPutt
            const { finalTarget, rollTarget } = hitPutt(ball, puttTarget, pv, adjustedBarValue);

            gameState.puttTarget = finalTarget;
            gameState.puttRollTarget = rollTarget;

            console.log(`🎯 PUTT confermato: target finale c:${finalTarget.c}, r:${finalTarget.r}`);

            // Avvia animazione putt
            gameState.ball.moving = true;
            gameState.mode = "putt";
            updateControlsUI();
            renderPuttView(pv);
            requestAnimationFrame(updatePutt);
        }
    };

    // Stato selezionato
    let selectedClub = Clubs[0];
    let selectedSpecial = Specials[0];

    // Popola le carte
    function populateDecks() {
        const clubDeck = document.getElementById("clubDeck");
        const shotDeck = document.getElementById("shotDeck");

        clubDeck.innerHTML = "";
        shotDeck.innerHTML = "";

        Clubs.sort((a, b) => a.num - b.num);
        Clubs.forEach(club => {
            const card = document.createElement("div");
            card.className = "deck-card";
            card.dataset.name = club.name;

            // Colori per tipo di club
            switch (club.id) {
                case 'putt':
                    card.style.backgroundColor = '#000'; // nero
                    card.style.color = '#fff'; // scritte bianche
                    break;
                case 'sand':
                case 'pitch':
                case 'wedge':
                    card.style.backgroundColor = '#87CEFA'; // azzurro chiaro
                    card.style.color = '#000';
                    break;
                case 'iron':
                    card.style.backgroundColor = '#d3d3d3'; // grigio chiaro
                    card.style.color = '#000';
                    break;
                case 'wood':
                    card.style.backgroundColor = '#A0522D'; // marroncino
                    card.style.color = '#000';
                    break;
                case 'driver':
                    card.style.backgroundColor = '#555555'; // marroncino anche per driver
                    card.style.color = '#fff';
                    break;
                default:
                    card.style.backgroundColor = '#fff';
                    card.style.color = '#000';
            }

            // Simbolini per distance, roll e accuracy
            card.innerHTML = `
            <div class="name">${club.name}</div>
            <div class="stats">
                ⛳ ${club.distance} &nbsp; 🌀 ${club.roll} &nbsp; 🎯 ${Math.round(club.accuracy * 100)}%
            </div>
            <div class="desc">${club.desc}</div>
        `;
            card.onclick = () => selectClub(club.name);
            clubDeck.appendChild(card);
        });

        Specials.forEach(shot => {
            const card = document.createElement("div");
            card.className = "deck-card";
            card.dataset.name = shot.name;

            // Colori in base al tipo di shot
            switch (shot.id) {
                case 'power':
                    card.style.backgroundColor = '#ff0000'; // arancione acceso
                    card.style.color = '#fff';
                    break;
                case 'spin':
                    card.style.backgroundColor = '#1E90FF'; // blu intenso
                    card.style.color = '#fff';
                    break;
                case 'accuracy':
                    card.style.backgroundColor = '#ff9500'; // verde lime
                    card.style.color = '#000';
                    break;
                case 'special':
                    card.style.backgroundColor = '#8A2BE2'; // viola
                    card.style.color = '#fff';
                    break;
                case 'wind':
                    card.style.backgroundColor = '#03fca1'; // viola
                    card.style.color = '#000000';
                    break;
                default:
                    card.style.backgroundColor = '#ccc'; // grigio neutro
                    card.style.color = '#000';
            }

            card.innerHTML = `
        <div class="name">${shot.name}</div>
        <div class="desc">${shot.desc}</div>
    `;
            card.onclick = () => selectSpecial(shot.name);
            shotDeck.appendChild(card);
        });
    }


    // Funzioni di selezione
    function selectClub(name) {
        selectedClub = Clubs.find(c => c.name === name);
        document.querySelectorAll("#clubDeck .deck-card")
            .forEach(c => c.classList.toggle("selected", c.dataset.name === name));
        updateShotInfo(shotTarget || gameState.ball);
        render();
    }

    function selectSpecial(name) {
        selectedSpecial = Specials.find(s => s.name === name);

        document.querySelectorAll("#shotDeck .deck-card")
            .forEach(c => c.classList.toggle("selected", c.dataset.name === name));

        // ✅ Se lo special influisce sul vento, aggiorna subito la forza e il display
        if (selectedSpecial?.id === "wind") {
            // Applica moltiplicatore
            const baseWind = wind.baseStrength ?? wind.strength; // salva il vento originale una sola volta
            if (!wind.baseStrength) wind.baseStrength = baseWind;

            wind.strength = wind.baseStrength * (selectedSpecial.windMultiplier ?? 1);
            updateWindDisplay();

            console.log(`💨 Vento modificato: base=${baseWind.toFixed(2)}, attuale=${wind.strength.toFixed(2)} (×${selectedSpecial.windMultiplier})`);
        } else if (wind.baseStrength) {
            // Se cambio carta e il vento era stato modificato, ripristinalo
            wind.strength = wind.baseStrength;
            updateWindDisplay();
        }

        // Aggiorna HUD
        updateShotInfo(shotTarget || gameState.ball);
    }

    // Inizializza
    populateDecks();
    selectClub(selectedClub);
    selectSpecial(selectedSpecial);

    function regenerate() {
        const n = parseInt(9);
        currentMap = generateMap(n);

        // ===================== INIZIALIZZAZIONE BUCA =====================
        if (currentMap && currentMap.holes && currentMap.holes.length > 0) {
            gameHoles = currentMap.holes;    // salva le buche globalmente
            currentHoleIndex = 0;             // inizio dalla prima buca
            holeShots = 0;                    // colpi iniziali

            // tee della prima buca
            const firstTee = gameHoles[0].tee;

            view.x = Math.max(0, firstTee.c - view.size / 2);
            view.y = Math.max(0, firstTee.r - view.size / 2);
            view.x = Math.min(currentMap.cols - view.size, view.x);
            view.y = Math.min(currentMap.rows - view.size, view.y);

            // Posiziona pallina e giocatore sul tee
            gameState.ball.c = firstTee.c;
            gameState.ball.r = firstTee.r;
            gameState.ball.phase = "stopped";
            gameState.ball.moving = false;

            gameState.player.c = firstTee.c - 1;
            gameState.player.r = firstTee.r;
            gameState.mode = "player";

            // Aggiorna HUD
            updateHoleHUD();
        } else {
            view.x = 0;
            view.y = 0;

            // fallback
            gameState.ball.c = 0;
            gameState.ball.r = 0;
            gameState.player.c = 0;
            gameState.player.r = 0;

            gameHoles = [];
            currentHoleIndex = 0;
            holeShots = 0;
        }

        render();
    }


    function fitCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        render();
    }

    window.addEventListener("resize", () => {
        clearTimeout(window._resizeT);
        window._resizeT = setTimeout(fitCanvas, 200);
    });

    const fillRight = document.getElementById("accuracyFillRight");
    const fillLeft = document.getElementById("accuracyFillLeft");
    let accValue = 0.5;   // centro
    let accPhase = 0;     // 0: centro→destra, 1: destra→centro, 2: centro→sinistra, 3: sinistra→centro
    let accuracyAnimation = null;
    let isAnimatingAccuracy = false;
    const speed = 0.015;

    function startAccuracyBar() {
        if (!fillRight || !fillLeft) return;
        if (isAnimatingAccuracy) return;

        isAnimatingAccuracy = true;

        const animate = () => {
            if (!isAnimatingAccuracy) return;

            switch (accPhase) {
                case 0: accValue += speed; if (accValue >= 1) { accValue = 1; accPhase = 1; } break;
                case 1: accValue -= speed; if (accValue <= 0.5) { accValue = 0.5; accPhase = 2; } break;
                case 2: accValue -= speed; if (accValue <= 0) { accValue = 0; accPhase = 3; } break;
                case 3: accValue += speed; if (accValue >= 0.5) { accValue = 0.5; accPhase = 0; } break;
            }

            // Aggiorna fill destro
            if (accPhase === 0 || accPhase === 1) {
                const rightScale = Math.max(0, (accValue - 0.5) * 2); // 0..1
                fillRight.style.transform = `scaleX(${rightScale})`;
                fillLeft.style.transform = `scaleX(0)`;
            } else {
                const leftScale = Math.max(0, (0.5 - accValue) * 2); // 0..1
                fillLeft.style.transform = `scaleX(${leftScale})`;
                fillRight.style.transform = `scaleX(0)`;
            }

            accuracyAnimation = requestAnimationFrame(animate);
        };

        accuracyAnimation = requestAnimationFrame(animate);
    }

    function stopAccuracyBar() {
        if (accuracyAnimation) {
            cancelAnimationFrame(accuracyAnimation);
            accuracyAnimation = null;
        }
        isAnimatingAccuracy = false;
        return Math.round(accValue * 100);
    }
    function getAccuracyFromBar(value) {
        const distanceFromCenter = Math.abs(value - 0.5);
        return Math.max(0, 1 - distanceFromCenter * 2);
    }

    document.addEventListener("keydown", e => {
        if (gameState.mode === "putt" && e.key === "Escape") {
            exitPuttView();
        }
    });

    regenerate();
    fitCanvas();
    updateControlsUI();
    updateWindDisplay();
})();
