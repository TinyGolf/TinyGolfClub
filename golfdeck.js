/*
File: golfdeck.js
Contiene definizioni di mazzi: clubs e special cards.
Ogni club ha: id, name, distance (in tiles), accuracy (0..1), description
Special cards modificano il tiro: extraDistance, curve, stopOnGreen, ecc.
*/


const Clubs = [
    { num: 16, cost: 2, id: 'putt', name: 'Putt', distance: 0, roll: 2, accuracy: 1, desc: 'Per i tiri sul green' },
    { num: 15, cost: 4,  id: 'wedge', name: 'Wedge', distance: 3, roll: 1, accuracy: 1, desc: 'Tiro corto e preciso' },
    { num: 14, cost: 5, id: 'sand', name: 'Sand', distance: 4, roll: 1, accuracy: 1, desc: 'Utile per uscire dalla sabbia' },
    { num: 13, cost: 5, id: 'pitch', name: 'Pitch', distance: 5, roll: 1, accuracy: 1, desc: 'Tiro corto e preciso' },
    { num: 12, cost: 6, id: 'iron', name: 'Ferro-9', distance: 5, roll: 2, accuracy: 0.95, desc: 'Media distanza' },
    { num: 11, cost: 7, id: 'iron', name: 'Ferro-8', distance: 6, roll: 2, accuracy: 0.95, desc: 'Media distanza' },
    { num: 10, cost: 7, id: 'iron', name: 'Ferro-7', distance: 7, roll: 2, accuracy: 0.95, desc: 'Media distanza' },
    { num: 9, cost: 8, id: 'iron', name: 'Ferro-6', distance: 8, roll: 3, accuracy: 0.9, desc: 'Media distanza' },
    { num: 8, cost: 9, id: 'iron', name: 'Ferro-5', distance: 9, roll: 3, accuracy: 0.9, desc: 'Buona distanza' },
    { num: 7, cost: 10, id: 'iron', name: 'Ferro-4', distance: 10, roll: 3, accuracy: 0.9, desc: 'Buona distanza' },
    { num: 6, cost: 12, id: 'iron', name: 'Ferro-3', distance: 11, roll: 4, accuracy: 0.9, desc: 'Buona distanza' },
    { num: 5, cost: 14, id: 'iron', name: 'Ferro-2', distance: 12, roll: 4, accuracy: 0.85, desc: 'Buona distanza' },
    { num: 4, cost: 14, id: 'wood', name: 'Legno-5', distance: 11, roll: 4, accuracy: 0.85, desc: 'Lungo, meno efficacie da terra' },
    { num: 3, cost: 15, id: 'wood', name: 'Legno-4', distance: 12, roll: 4, accuracy: 0.85, desc: 'Lungo, meno efficacie da terra' },
    { num: 2, cost: 20, id: 'wood', name: 'Legno-3', distance: 13, roll: 5, accuracy: 0.85, desc: 'Lungo, meno efficacie da terra' },
    { num: 1, cost: 25, id: 'driver', name: 'Driver', distance: 14, roll: 5, accuracy: 0.8, desc: 'Lunghissimo, solo dal tee' }
];


const Specials = [
    { num: 1, cost: 1, id: 'normale', name: 'Nessun effetto', desc: 'Un normale colpo', },
    { num: 2, cost: 5, id: 'power', name: 'Power +', desc: '+10% di potenza', modify: (shot) => { shot.distance *= 1.1 } },
    { num: 3, cost: 9, id: 'power', name: 'Power +', desc: '+20% di potenza', modify: (shot) => { shot.distance *= 1.2 } },
    { num: 4, cost: 20, id: 'power', name: 'Power +', desc: '+30% di potenza', modify: (shot) => { shot.distance *= 1.3 } },
    { num: 5, cost: 15, id: 'spin', name: 'Backspin', desc: 'Riduce molto il scivolamento su green', modify: (shot) => { shot.roll -= 2.5 } },
    { num: 6, cost: 10, id: 'spin', name: 'Stop shot', desc: 'Riduce scivolamento su green', modify: (shot) => { shot.roll *= 0.5 } },
    { num: 7, cost: 7, id: 'spin', name: 'Topspin', desc: 'Aumenta scivolamento su green', modify: (shot) => { shot.roll *= 2 } },
    { num: 8, cost: 10, id: 'special', name: 'Rough shot', desc: 'Un buon tiro per uscire dal rough', modify: (shot) => { shot.roll *= 1.5 } },
    { num: 9, cost: 6, id: 'special', name: 'Sand shot', desc: 'Un buon tiro per uscire dalla sabbia', modify: (shot) => { shot.roll *= 1.5 } },
    { num: 10, cost: 4, id: 'curve', name: 'Curva ←1', desc: 'Curva sinistra', modify: (shot) => { shot.curve = shot.curve = -1 } },
    { num: 11, cost: 4, id: 'curve', name: 'Curva →1', desc: 'Curva destra', modify: (shot) => { shot.curve = shot.curve =1 } },
    { num: 12, cost: 8, id: 'curve', name: 'Curva ←2', desc: 'Curva sinistra', modify: (shot) => { shot.curve = shot.curve = -1.5 } },
    { num: 13, cost: 8, id: 'curve', name: 'Curva →2', desc: 'Curva destra', modify: (shot) => { shot.curve = shot.curve = 1.5 } },

];