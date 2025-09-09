/*
File: golfdeck.js
Contiene definizioni di mazzi: clubs e special cards.
Ogni club ha: id, name, distance (in tiles), accuracy (0..1), description
Special cards modificano il tiro: extraDistance, curve, stopOnGreen, ecc.
*/


const Clubs = [
    { num: 15, id: 'wedge', name: 'Wedge', distance: 3, roll: 1, accuracy: 1, desc: 'Tiro corto e preciso' },
    { num: 14, id: 'sand', name: 'Sand', distance: 4, roll: 1, accuracy: 1, desc: 'Utile per uscire dalla sabbia' },
    { num: 13, id: 'pitch', name: 'Pitch', distance: 5, roll: 1, accuracy: 1, desc: 'Tiro corto e preciso' },
    { num: 12, id: 'iron', name: 'Ferro-9', distance: 5, roll: 2, accuracy: 0.95, desc: 'Media distanza' },
    { num: 11, id: 'iron', name: 'Ferro-8', distance: 6, roll: 2, accuracy: 0.95, desc: 'Media distanza' },
    { num: 10, id: 'iron', name: 'Ferro-7', distance: 7, roll: 2, accuracy: 0.95, desc: 'Media distanza' },
    { num: 9, id: 'iron', name: 'Ferro-6', distance: 8, roll: 3, accuracy: 0.9, desc: 'Media distanza' },
    { num: 8, id: 'iron', name: 'Ferro-5', distance: 9, roll: 3, accuracy: 0.9, desc: 'Buona distanza' },
    { num: 7, id: 'iron', name: 'Ferro-4', distance: 10, roll: 3, accuracy: 0.9, desc: 'Buona distanza' },
    { num: 6, id: 'iron', name: 'Ferro-3', distance: 11, roll: 4, accuracy: 0.9, desc: 'Buona distanza' },
    { num: 5, id: 'iron', name: 'Ferro-2', distance: 12, roll: 4, accuracy: 0.85, desc: 'Buona distanza' },
    { num: 4, id: 'wood', name: 'Legno-5', distance: 11, roll: 4, accuracy: 0.85, desc: 'Lungo, meno efficacie da terra' },
    { num: 3, id: 'wood', name: 'Legno-4', distance: 12, roll: 4, accuracy: 0.85, desc: 'Lungo, meno efficacie da terra' },
    { num: 2, id: 'wood', name: 'Legno-3', distance: 13, roll: 5, accuracy: 0.85, desc: 'Lungo, meno efficacie da terra' },
    { num: 1, id: 'driver', name: 'Driver', distance: 14, roll: 5, accuracy: 0.8, desc: 'Lunghissimo, solo dal tee' }
];


const Specials = [
    { num : 1, id: 'normale', name: 'Nessun effetto', desc: 'Un normale colpo', },
    { num: 2, id: 'power', name: 'Power +', desc: '+15% di potenza', modify: (shot) => { shot.distance *= 1.15 } },
    { num: 3, id: 'power', name: 'Power +', desc: '+25% di potenza', modify: (shot) => { shot.distance *= 1.25 } },
    { num: 4, id: 'power', name: 'Power +', desc: '+40% di potenza', modify: (shot) => { shot.distance *= 1.40 } },
    { num: 3, id: 'spin', name: 'Backspin', desc: 'Riduce scivolamento su green', modify: (shot) => { shot.roll -= 3 } },

    { num: 3, id: 'spin', name: 'Stop shot', desc: 'Riduce scivolamento su green', modify: (shot) => { shot.roll *= 0.5 } },
    { num: 4, id: 'spin', name: 'Topspin', desc: 'Aumenta scivolamento su green', modify: (shot) => { shot.roll *= 1.75 } },
    { num: 5, id: 'special', name: 'Rough shot', desc: 'Un buon tiro per uscire dal rough', modify: (shot) => { shot.roll *= 1.5 } },
    { num: 6, id: 'special', name: 'Sand shot', desc: 'Un buon tiro per uscire dalla sabbia', modify: (shot) => { shot.roll *= 1.5 } },
    { num: 7, id: 'curve', name: 'Curva ←', desc: 'Curva sinistra', modify: (shot) => { shot.curve = shot.curve = -1 } },
    { num: 8, id: 'curve', name: 'Curva →', desc: 'Curva destra', modify: (shot) => { shot.curve = shot.curve =1 } }
];