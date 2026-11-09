# paintarena

[English](README.md) · **Italiano**

Un gioco di programmazione: scrivi il programma di un robot e lo mandi
nell'arena a sfidare gli altri a gavettoni di vernice. Durante la partita non lo
comandi tu: fa tutto da solo. Chi è colorato al 100% esce dal gioco, e più
vernice ha addosso più diventa lento e vede male. Ogni istruzione **costa un
numero fisso di cicli**, e a ogni tick il robot ha un budget limitato: più il
codice è efficiente, più il robot fa.

Pensato per **imparare a programmare**: un percorso di missioni guidate,
linguaggio piccolo in stile C, messaggi di errore chiari in italiano e in
inglese, costo di ogni riga mostrato nell'editor e profilo dei cicli spesi alla
fine della partita. Quattro classi (Micro, Mini, Standard, Illimitata) limitano
codice e memoria, come le categorie dei tornei.

Codice sorgente: [github.com/itotm/paintarena](https://github.com/itotm/paintarena).

## Grazie, CROBOTS

paintarena è un omaggio a **CROBOTS**, il gioco che Tom Poindexter scrisse nel
1985 ([github.com/tpoindex/crobots](https://github.com/tpoindex/crobots)), e
alla comunità italiana che lo ha tenuto vivo per decenni: i tornei di
*MCmicrocomputer* dal 1988 e [crobots.deepthought.it](http://crobots.deepthought.it/).
paintarena è un progetto nuovo, scritto da zero: linguaggio, macchina virtuale e
regole sono nuovi, e i robot di CROBOTS non sono compatibili.

## Cosa si può fare

- **Impara**: quattordici missioni brevi in quattro gruppi, ognuna con un'idea
  sola: muoversi, frenare, array, il radar, la trigonometria con `mark()`,
  lanciare, mirare, bersagli mobili, anticipare un bersaglio, una CPU lenta, la
  media di letture imprecise, schivare, una sfida a due, tutti contro tutti.
- **Gioca**: scrivi robot in un editor con gli aiuti di un IDE (completamento di
  funzioni, variabili e blocchi, firma e costo delle funzioni, vai alla
  definizione, ripiegamento, cerca e sostituisci, più cursori), tienine quanti vuoi, importali ed
  esportali come file `.pa` per scambiarli con gli amici, e fai partite con 2,
  3 o 4 robot scelti tra i tuoi e gli esempi. Le partite si rivedono fotogramma
  per fotogramma, con la console dei `print()` e il profilo dei cicli.
- **Torneo**: migliaia di partite (1.000, 10.000, 100.000 o quante vuoi) giocate
  in parallelo nel browser, a duelli o a gruppi di 3 o 4, con classifica,
  scontri diretti, andamento delle vittorie e durata delle partite.

Tutto funziona nel browser, sul tuo computer: robot, missioni completate e
impostazioni vengono salvati nella memoria del browser (localStorage) a ogni
modifica e **non lasciano mai il computer**. Niente viene inviato in rete e non
serve un account; per spostare i robot su un altro computer si esportano come
file `.pa`.

## Robot di esempio

| Robot | Classe | Idea |
|---|---|---|
| `primo` | Micro | il punto di partenza, tutto commentato |
| `irrigatore` | Micro | sta fermo e fa girare il radar |
| `vagabondo` | Micro | corre tra punti a caso lanciando a chiunque veda |
| `spirale` | Micro | gira a spirale attorno al centro (si sterza solo a velocità ≤ 50%) |
| `circuito` | Micro | percorre i muri e sorveglia solo la metà interna dell'arena |
| `inseguitore` | Micro | stringe il fascio del radar, lancia e insegue |
| `angolo` | Micro | si mette in un angolo, da dove bastano 90° da sorvegliare |
| `segugio` | Mini | aggancia un bersaglio, ne stima la velocità e lancia dove sarà |
| `cartografo` | Standard | tiene in memoria una mappa dell'arena con i posti pericolosi e quelli già visitati |
| `stratega` | Illimitata | alterna cinque strategie e tiene quella con cui prende meno vernice; mappa fine e cronologia degli avvistamenti |

I robot di esempio esistono in due versioni con lo stesso programma: in italiano
in `robots/it` e in inglese in `robots/en` (`first`, `sprinkler`, `wanderer`,
`spiral`, `circuit`, `chaser`, `corner`, `tracker`, `mapper`, `strategist`). Il sito mostra quelli nella
lingua scelta.

## Come si avvia

Il sito non richiede di installare niente. In locale:

```sh
pnpm install
pnpm dev          # sito su http://localhost:5173
```

Riga di comando (Node.js ≥ 22.18, che esegue TypeScript direttamente):

```sh
pnpm cli compile robots/it/segugio.pa            # costo di ogni riga
pnpm cli compile robots/it/segugio.pa --asm      # istruzioni macchina
pnpm cli match robots/it/{irrigatore,vagabondo,angolo,segugio}.pa --seed 42   # una partita (da 2 a 4 robot)
pnpm cli tournament robots/it/*.pa --class unlimited --mode duel --rounds 1000
pnpm cli tournament robots/it/*.pa --class unlimited --size 3 --rounds 200 --json
pnpm cli tournament robots/it/{irrigatore,vagabondo,angolo,inseguitore}.pa --class micro   # classi: micro, mini, standard, unlimited
```

Su un PC a 24 thread un torneo gioca circa **6.000 partite al secondo**
(2 miliardi di cicli al secondo); il browser, con i Web Worker su tutti i core, va a velocità simili.

## Versioni installabili (Bun)

Con [Bun](https://bun.sh) si crea un **eseguibile unico** con il sito
incorporato: con un doppio clic apre il gioco nel browser (server locale su
`http://127.0.0.1:51517`, sempre la stessa porta così il browser ricorda robot
e progressi); da terminale fa da riga di comando
(`paintarena compile|match|tournament …`). Bun non va installato: lo scarica
`pnpm dlx`.

```sh
pnpm dist          # Windows: cartella portatile, zip e installer
pnpm dist:linux    # Linux: tar.gz
pnpm dist:all      # Windows, Linux e macOS (arm64)
```

Risultati in `dist/`:

| File | Contenuto |
|---|---|
| `paintarena-<versione>-setup.exe` | installer per Windows (per l'utente, senza permessi di amministratore; menu Start, desktop, disinstallazione) |
| `paintarena-<versione>-windows-x64.zip` | versione portatile: si scompatta e si apre `paintarena.exe` |
| `paintarena-<versione>-linux-x64.tar.gz` | versione per Linux |

L'installer richiede NSIS (`sudo apt install nsis`, oppure la variabile
`MAKENSIS`) e ImageMagick per l'icona. Compilando da Linux l'eseguibile per
Windows tiene l'icona di Bun (Bun applica le opzioni `--windows-*` solo
compilando su Windows); collegamenti e installer usano quella di paintarena.
Variabili utili: `PAINTARENA_PORT` (porta), `PAINTARENA_LANG` (it/en),
`PAINTARENA_NO_BROWSER` (non aprire il browser).

## Struttura

| Cartella | Contenuto |
|---|---|
| `packages/engine` | compilatore, macchina virtuale, simulazione, statistiche dei tornei (TypeScript puro, nessuna dipendenza) |
| `packages/cli` | riga di comando, tornei su più thread, avvio del programma installabile (`app.ts`) |
| `apps/web` | sito: Svelte 5, Tailwind CSS 4, CodeMirror 6, arena su canvas, Web Worker per i tornei |
| `robots` | robot di esempio, in italiano (`it`) e in inglese (`en`) |
| `scripts` | creazione delle versioni installabili (`dist.ts`, installer NSIS in `windows/`) |

```sh
pnpm test         # test del motore e delle missioni
pnpm typecheck    # TypeScript 7 + svelte-check
pnpm build        # sito statico in apps/web/dist
```

Il sito si pubblica su GitHub Pages con `.github/workflows/pages.yml`.

## Licenza

Software libero: GNU GPL versione 3 o successive (vedi [LICENSE](LICENSE)).
