// Interface texts in Italian and English. Compiler and machine messages
// live in the engine instead (packages/engine/src/i18n.ts).

import type { Lang } from "@paintarena/engine";
import { load, save } from "./storage.ts";

const DICT = {
  it: {
    learn: "Impara", play: "Gioca", manual: "Manuale", about: "Info",
    learnTitle: "Impara a programmare un robot",
    learnIntro: "Un percorso di missioni brevi: ognuna spiega una cosa sola e ti chiede di usarla. Puoi farle nell'ordine che vuoi, ma ognuna parte da quello che hai imparato prima.",
    missionN: "Missione {0}", done: "Completata", start: "Inizia", goal: "Obiettivo",
    showHint: "Mostra un suggerimento", hintN: "Suggerimento {0}", resetCode: "Ricomincia da capo",
    success: "Missione compiuta!", nextMission: "Prossima missione →", allMissions: "← Tutte le missioni",
    failTimeout: "Non ancora: tempo scaduto dopo {0} tick. Riprova!", failOut: "Non ancora: il tuo robot è finito fuori gioco. Riprova!",
    failGeneric: "Non ancora: obiettivo non raggiunto. Riprova!", freePlay: "Gioco libero", progress: "{0} di {1} completate",
    paintOf: "vernice {0}%",
    groupMove: "Muoversi", groupSee: "Vedere", groupThrow: "Lanciare", groupPlay: "Giocare",
    theme: "Tema", themeAuto: "Auto", themeDark: "Scuro", themeLight: "Chiaro",
    robotClass: "Classe", fitsClass: "classe minima: {0}", codeUsage: "codice", memUsage: "memoria",
    classHint: "La classe fissa quante istruzioni e quanta memoria può usare il robot. Cicli e regole sono uguali in tutte le classi.",
    myRobot: "Il mio robot", loadExample: "Carica un esempio…", undoHint: "Ctrl+Z annulla",
    opponents: "Avversari", none: "— nessuno —", fight: "In campo!", fixErrors: "Correggi gli errori per giocare",
    playBtn: "Avvia", pause: "Pausa", restart: "Dall'inizio", speed: "Velocità", seed: "Seme", newSeed: "Nuovo seme",
    compiled: "{0} istruzioni · memoria usata: {1}", errors: "Errori: {0}", warnings: "avvisi: {0}",
    console: "Console", consoleEmpty: "Qui compaiono i print() e gli errori dei robot durante la partita.",
    speedLabel: "velocità", cyclesTick: "cicli/tick", outOfGame: "fuori gioco", outLabel: "FUORI", halted: "fermo",
    winner: "Vince {0}!", draw: "Pareggio: tutti fuori gioco", timeout: "Tempo scaduto: pareggio tra chi è ancora in gioco",
    wentOut: "è fuori gioco: colorato al 100%", programEnded: "il programma è terminato",
    profile: "Dove spende i cicli il tuo robot", profileHint: "Le righe più costose della partita: ottimizzando queste il robot fa più cose a ogni tick.",
    line: "riga", noMatch: "Scegli da 2 a 4 robot e premi «In campo!»",
    arena: "Arena", tick: "tick",
    tournament: "Torneo",
    editorLabel: "Codice del robot (puoi trascinare qui dei file .pa)",
    participantN: "Partecipante {0}", slotInvalid: "Questo robot ha errori o non entra nella classe scelta",
    myRobots: "I miei robot", examples: "Esempi", needTwo: "Scegli almeno due robot validi",
    imported: "Importati: {0}", importSkipped: "non importati (non sono file di testo): {0}", deleted: "Eliminato: {0}",
    newRobotName: "Nuovo robot", robotName: "Nome del robot", robotToEdit: "Robot da modificare",
    rename: "Rinomina", duplicate: "Duplica", delete: "Elimina", confirmDelete: "Elimina davvero?",
    import: "Importa", importHint: "Importa robot da file .pa (anche più di uno, o trascinali sull'editor)",
    export: "Esporta", exportHint: "Scarica questo robot come file .pa, da condividere",
    newRobot: "Nuovo", blankRobot: "Robot vuoto", copyOfExample: "Copia di un esempio",
    tournamentSetup: "Torneo", tRobots: "Robot", all: "Tutti", noneSel: "Nessuno", notInClass: "non valido",
    perMatch: "Robot per partita", duel: "Duelli", robotsN: "{0} insieme", matchCount: "Partite", customN: "Altro",
    needRobots: "Servono almeno {0} robot validi.",
    groupsInfo: "{0} combinazioni di robot, circa {1} partite ciascuna. Si gioca su {2} thread.",
    startTournament: "Avvia il torneo", stop: "Ferma",
    tournamentTitle: "Torneo",
    tournamentIntro: "Una partita sola dice poco: le posizioni di partenza sono a caso, e un robot può vincere per fortuna. Con migliaia di partite la fortuna si compensa e resta la bravura. Scegli i robot, quanti per partita e quante partite: il torneo mette in campo a turno tutte le combinazioni possibili, e alla fine trovi la classifica, gli scontri diretti e i grafici.",
    tournamentPoints: "Punteggio: {0} punti a chi vince, {1} a chi è ancora in gioco quando scade il tempo. La classifica è per punti a partita.",
    matchesWord: "partite", perSecond: "partite/s", etaLeft: "mancano {0}", avgTicks: "durata media {0} tick",
    timeouts: "{0}% a tempo scaduto", stopped: "fermato prima della fine",
    tRobot: "Robot", pointsPerMatch: "Punti/partita", pointsHint: "{0} punti per una vittoria, {1} se si è ancora in gioco allo scadere del tempo",
    winRate: "Vittorie", wtl: "V / P / S", avgPlace: "Piazzamento", avgPlaceHint: "Piazzamento medio: 1 = primo. Chi è ancora in gioco è davanti a chi è fuori; tra chi è fuori è davanti chi ha resistito di più",
    avgPaint: "Vernice presa", avgPaintHint: "Vernice media sul robot a fine partita",
    headToHead: "Scontri diretti", headToHeadHint: "Quante volte il robot della riga finisce davanti a quello della colonna (%). Blu: meglio la riga; rosso: meglio la colonna.",
    h2hTip: "{0} finisce davanti a {1} nel {2}% delle {3} partite giocate insieme",
    winTrend: "Andamento delle vittorie", durations: "Durata delle partite", durationsHint: "Partite per durata, in tick; l'ultima colonna comprende quelle finite a tempo scaduto.",
    durTip: "{0}–{1} tick: {2} partite ({3}%)",
  },
  en: {
    learn: "Learn", play: "Play", manual: "Manual", about: "About",
    learnTitle: "Learn to program a robot",
    learnIntro: "A path of short missions: each one explains a single thing and asks you to use it. You can take them in any order, but each builds on what came before.",
    missionN: "Mission {0}", done: "Completed", start: "Start", goal: "Goal",
    showHint: "Show a hint", hintN: "Hint {0}", resetCode: "Start over",
    success: "Mission complete!", nextMission: "Next mission →", allMissions: "← All missions",
    failTimeout: "Not yet: time ran out after {0} ticks. Try again!", failOut: "Not yet: your robot went out of the game. Try again!",
    failGeneric: "Not yet: goal not reached. Try again!", freePlay: "Free play", progress: "{0} of {1} completed",
    paintOf: "paint {0}%",
    groupMove: "Moving", groupSee: "Seeing", groupThrow: "Throwing", groupPlay: "Playing",
    theme: "Theme", themeAuto: "Auto", themeDark: "Dark", themeLight: "Light",
    robotClass: "Class", fitsClass: "smallest class: {0}", codeUsage: "code", memUsage: "memory",
    classHint: "The class sets how many instructions and how much memory the robot may use. Cycles and rules are the same in every class.",
    myRobot: "My robot", loadExample: "Load an example…", undoHint: "Ctrl+Z to undo",
    opponents: "Opponents", none: "— none —", fight: "Let's play!", fixErrors: "Fix the errors to play",
    playBtn: "Play", pause: "Pause", restart: "Restart", speed: "Speed", seed: "Seed", newSeed: "New seed",
    compiled: "{0} instructions · memory used: {1}", errors: "Errors: {0}", warnings: "warnings: {0}",
    console: "Console", consoleEmpty: "Robot print() output and errors show up here during the match.",
    speedLabel: "speed", cyclesTick: "cycles/tick", outOfGame: "out of the game", outLabel: "OUT", halted: "stopped",
    winner: "{0} wins!", draw: "Draw: everyone out", timeout: "Time out: draw between the robots still in the game",
    wentOut: "is out of the game: 100% painted", programEnded: "the program has ended",
    profile: "Where your robot spends its cycles", profileHint: "The most expensive lines of the match: optimize these and the robot does more each tick.",
    line: "line", noMatch: "Pick 2 to 4 robots and press “Let's play!”",
    arena: "Arena", tick: "tick",
    tournament: "Tournament",
    editorLabel: "Robot code (you can drop .pa files here)",
    participantN: "Participant {0}", slotInvalid: "This robot has errors or doesn't fit the chosen class",
    myRobots: "My robots", examples: "Examples", needTwo: "Pick at least two valid robots",
    imported: "Imported: {0}", importSkipped: "not imported (not text files): {0}", deleted: "Deleted: {0}",
    newRobotName: "New robot", robotName: "Robot name", robotToEdit: "Robot to edit",
    rename: "Rename", duplicate: "Duplicate", delete: "Delete", confirmDelete: "Really delete?",
    import: "Import", importHint: "Import robots from .pa files (several at once, or drop them on the editor)",
    export: "Export", exportHint: "Download this robot as a .pa file, to share it",
    newRobot: "New", blankRobot: "Empty robot", copyOfExample: "Copy of an example",
    tournamentSetup: "Tournament", tRobots: "Robots", all: "All", noneSel: "None", notInClass: "not valid",
    perMatch: "Robots per match", duel: "Duels", robotsN: "{0} at a time", matchCount: "Matches", customN: "Other",
    needRobots: "At least {0} valid robots are needed.",
    groupsInfo: "{0} robot combinations, about {1} matches each. Running on {2} threads.",
    startTournament: "Start the tournament", stop: "Stop",
    tournamentTitle: "Tournament",
    tournamentIntro: "A single match says little: starting positions are random, and a robot can win by luck. Over thousands of matches luck evens out and skill remains. Pick the robots, how many per match and how many matches: the tournament plays every possible combination in turn, and at the end you get the ranking, the head-to-head results and the charts.",
    tournamentPoints: "Scoring: {0} points to the winner, {1} to each robot still in the game when time runs out. The ranking is by points per match.",
    matchesWord: "matches", perSecond: "matches/s", etaLeft: "{0} left", avgTicks: "average length {0} ticks",
    timeouts: "{0}% timed out", stopped: "stopped before the end",
    tRobot: "Robot", pointsPerMatch: "Points/match", pointsHint: "{0} points for a win, {1} for still being in the game when time runs out",
    winRate: "Wins", wtl: "W / T / L", avgPlace: "Placing", avgPlaceHint: "Average placing: 1 = first. Robots still in the game rank above those that are out; among those out, the one that lasted longer ranks higher",
    avgPaint: "Paint taken", avgPaintHint: "Average paint on the robot at the end of the match",
    headToHead: "Head to head", headToHeadHint: "How often the row robot finishes ahead of the column robot (%). Blue: row is better; red: column is better.",
    h2hTip: "{0} finishes ahead of {1} in {2}% of the {3} matches they played together",
    winTrend: "Win rate over time", durations: "Match length", durationsHint: "Matches by length, in ticks; the last column includes the timed-out ones.",
    durTip: "{0}–{1} ticks: {2} matches ({3}%)",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TextKey = keyof (typeof DICT)["it"];

function initialLang(): Lang {
  const saved = load("lang");
  if (saved === "it" || saved === "en") return saved;
  return typeof navigator !== "undefined" && !navigator.language.startsWith("it") ? "en" : "it";
}

class I18n {
  lang = $state<Lang>(initialLang());

  t = (key: TextKey, ...args: (string | number)[]): string =>
    DICT[this.lang][key].replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));

  set(lang: Lang) {
    this.lang = lang;
    save("lang", lang);
    document.documentElement.lang = lang;
  }
}

export const i18n = new I18n();
if (typeof document !== "undefined") document.documentElement.lang = i18n.lang;
