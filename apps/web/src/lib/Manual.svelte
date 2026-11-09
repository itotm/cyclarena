<script lang="ts">
  import { BUILTIN_DOCS as DESC, extraCostText } from "./builtinDocs.ts";
  import { BUILTINS, BUILTIN_CONSTS, message, MIN_STACK, OP_COST, Op, ROBOT_CLASSES, RULES_V0 as R, type Lang } from "@paintarena/engine";

  let { lang }: { lang: Lang } = $props();


  const opGroups = [
    { ops: ["PUSH", "POP", "DUP", "LDG", "STG", "LDL", "STL"], it: "costanti e variabili", en: "constants and variables" },
    { ops: ["LDGI", "STGI", "LDLI", "STLI"], it: "elementi di array (con controllo dei limiti)", en: "array elements (bounds checked)" },
    { ops: ["ADD", "SUB", "NEG", "AND", "OR", "XOR", "SHL", "SHR", "NOT", "BNOT", "EQ", "NE", "LT", "LE", "GT", "GE"], it: "+ − e operatori logici e di confronto", en: "+ − and logic and comparison operators" },
    { ops: ["MUL"], it: "moltiplicazione", en: "multiplication" },
    { ops: ["DIV", "MOD"], it: "divisione e resto", en: "division and remainder" },
    { ops: ["JMP", "JZ", "JNZ"], it: "salti (if, cicli, && e ||)", en: "jumps (if, loops, && and ||)" },
    { ops: ["CALL"], it: "chiamata di una tua funzione", en: "calling one of your functions" },
    { ops: ["ENTER"], it: "inizio di una funzione", en: "function start" },
    { ops: ["RET"], it: "return", en: "return" },
  ].map((g) => ({ ...g, cost: OP_COST[Op[g.ops[0] as keyof typeof Op]] }));

  const SHORTCUTS: [string, string, string][] = [
    ["Ctrl+Spazio", "suggerimenti (anche senza aver scritto niente)", "suggestions (even before typing)"],
    ["Invio / Tab", "accetta il suggerimento; nei modelli, Tab passa al campo successivo", "accept the suggestion; in templates, Tab moves to the next field"],
    ["Ctrl+Z / Ctrl+Y", "annulla / ripeti", "undo / redo"],
    ["Ctrl+/", "commenta o scommenta le righe", "comment or uncomment lines"],
    ["Ctrl+F", "cerca e sostituisci", "find and replace"],
    ["Ctrl+D", "seleziona anche la prossima occorrenza (più cursori)", "also select the next occurrence (multiple cursors)"],
    ["Alt+clic", "aggiunge un cursore", "adds a cursor"],
    ["Ctrl+clic / F12", "va alla definizione di funzione o variabile", "goes to the definition of a function or variable"],
    ["Alt+↑ / Alt+↓", "sposta la riga in su o in giù", "moves the line up or down"],
    ["Tab / Shift+Tab", "rientra / riduce il rientro delle righe selezionate", "indents / unindents the selected lines"],
    ["Ctrl+Shift+[ / ]", "ripiega / apre il blocco (anche con ▾ accanto ai numeri di riga)", "folds / unfolds the block (also with ▾ next to the line numbers)"],
  ];

  const it = $derived(lang === "it");

  /** The splash levels in words: "25% within 5 m, 21% within 10 m, …". */
  function splashText(it: boolean): string {
    return R.splash.map((l) => `${l.paint}% ${it ? "entro" : "within"} ${l.range} m`).join(", ");
  }
</script>

<article class="doc max-w-[52rem]">
  {#if it}
    <h1>Manuale</h1>
    <p class="lead">Un robot di paintarena è un programma che gioca a gavettoni di vernice. Durante la partita non lo comandi tu: fa tutto da solo, con le istruzioni che gli hai scritto.</p>

    <h2>Cicli e tick</h2>
    <p>La partita avanza a <strong>tick</strong>. A ogni tick ogni robot riceve <strong>{R.cyclesPerTick} cicli</strong> ed esegue istruzioni finché non li ha spesi; poi l'arena muove robot e gavettoni. Ogni istruzione ha un <strong>costo fisso</strong>, scritto nelle tabelle qui sotto e accanto a ogni riga nell'editor (il <code>+</code> indica un costo che dipende dai valori). Se un'istruzione costa più dei cicli rimasti viene eseguita lo stesso, e la differenza si paga nel tick successivo.</p>
    <p>Tutti i robot «vedono» l'arena com'era all'inizio del tick: non conta chi gioca per primo. Le partite sono <strong>deterministiche</strong>: con lo stesso seme e gli stessi robot il risultato è sempre identico, su qualunque computer.</p>

    <h2>Il linguaggio</h2>
    <pre><code>{`const PASSO = 20;          // costante: vale sempre 20
var dir = 0;               // variabile globale
var visti[8];              // array di 8 elementi, tutti a 0

fn main() {                // il robot parte da qui
  loop {                   // ciclo infinito
    var d = scan(dir, 10); // variabile locale
    if (d > 0 && d <= MAX_RANGE) {
      throw(dir, d);
    } else {
      dir = (dir + PASSO) % 360;
    }
  }
}`}</code></pre>
    <ul>
      <li>Esiste un solo tipo: l'<strong>intero</strong> a 32 bit (da −2147483648 a 2147483647). Le divisioni troncano: <code>7 / 2</code> vale 3. Vero è 1, falso è 0.</li>
      <li>Istruzioni: <code>if</code> / <code>else if</code> / <code>else</code>, <code>while (…)</code>, <code>for (var i = 0; i &lt; 10; i++)</code>, <code>loop</code>, <code>break</code>, <code>continue</code>, <code>return</code>.</li>
      <li>Operatori, dal più debole al più forte: <code>||</code> · <code>&amp;&amp;</code> · <code>|</code> · <code>^</code> · <code>&amp;</code> · <code>== !=</code> · <code>&lt; &lt;= &gt; &gt;=</code> · <code>&lt;&lt; &gt;&gt;</code> · <code>+ -</code> · <code>* / %</code> · <code>- ! ~</code> (unari).</li>
      <li>Assegnazioni: <code>=</code>, <code>+=</code>, <code>-=</code>, <code>*=</code>, <code>/=</code>, <code>%=</code>… e <code>x++</code>, <code>x--</code>.</li>
      <li>Funzioni: <code>fn nome(a, b) {"{ … }"}</code>; restituiscono un valore con <code>return</code> (0 se manca). Sono permesse anche le funzioni che chiamano sé stesse.</li>
      <li>Costanti già pronte: {#each Object.entries(BUILTIN_CONSTS) as [k, v] (k)}<code>{k}</code> = {v}{" "}{/each}</li>
    </ul>
    <h3>Regole pensate per chi impara</h3>
    <ul>
      <li>Il corpo di <code>if</code>, <code>while</code> e <code>for</code> va sempre tra graffe: niente errori da «riga in più».</li>
      <li><code>=</code> non si può usare dentro una condizione: <code>if (x = 5)</code> è un errore, si scrive <code>if (x == 5)</code>.</li>
      <li><code>x++</code> e le assegnazioni sono istruzioni, non valori: niente <code>a = b++</code>.</li>
      <li>Il compilatore non ottimizza: quello che scrivi è quello che paghi. Ottimizzare tocca a te.</li>
    </ul>
  {:else}
    <h1>Manual</h1>
    <p class="lead">A paintarena robot is a program that plays with paint balloons. During the match you don't control it: it does everything on its own, following the instructions you wrote.</p>

    <h2>Cycles and ticks</h2>
    <p>The match advances in <strong>ticks</strong>. Each tick every robot gets <strong>{R.cyclesPerTick} cycles</strong> and runs instructions until they are spent; then the arena moves robots and balloons. Every instruction has a <strong>fixed cost</strong>, listed in the tables below and next to each line in the editor (a <code>+</code> marks a cost that depends on values). If an instruction costs more than the cycles left it still runs, and the difference is paid in the next tick.</p>
    <p>All robots “see” the arena as it was at the start of the tick: who runs first doesn't matter. Matches are <strong>deterministic</strong>: same seed and same robots always give the same result, on any computer.</p>

    <h2>The language</h2>
    <pre><code>{`const STEP = 20;           // constant: always 20
var dir = 0;               // global variable
var seen[8];               // array of 8 elements, all 0

fn main() {                // the robot starts here
  loop {                   // endless loop
    var d = scan(dir, 10); // local variable
    if (d > 0 && d <= MAX_RANGE) {
      throw(dir, d);
    } else {
      dir = (dir + STEP) % 360;
    }
  }
}`}</code></pre>
    <ul>
      <li>There is a single type: the 32-bit <strong>integer</strong> (−2147483648 to 2147483647). Division truncates: <code>7 / 2</code> is 3. True is 1, false is 0.</li>
      <li>Statements: <code>if</code> / <code>else if</code> / <code>else</code>, <code>while (…)</code>, <code>for (var i = 0; i &lt; 10; i++)</code>, <code>loop</code>, <code>break</code>, <code>continue</code>, <code>return</code>.</li>
      <li>Operators, weakest to strongest: <code>||</code> · <code>&amp;&amp;</code> · <code>|</code> · <code>^</code> · <code>&amp;</code> · <code>== !=</code> · <code>&lt; &lt;= &gt; &gt;=</code> · <code>&lt;&lt; &gt;&gt;</code> · <code>+ -</code> · <code>* / %</code> · <code>- ! ~</code> (unary).</li>
      <li>Assignments: <code>=</code>, <code>+=</code>, <code>-=</code>, <code>*=</code>, <code>/=</code>, <code>%=</code>… and <code>x++</code>, <code>x--</code>.</li>
      <li>Functions: <code>fn name(a, b) {"{ … }"}</code>; they return a value with <code>return</code> (0 if missing). Recursion is allowed.</li>
      <li>Built-in constants: {#each Object.entries(BUILTIN_CONSTS) as [k, v] (k)}<code>{k}</code> = {v}{" "}{/each}</li>
    </ul>
    <h3>Rules designed for learners</h3>
    <ul>
      <li>The body of <code>if</code>, <code>while</code> and <code>for</code> always goes in braces: no “extra line” bugs.</li>
      <li><code>=</code> can't be used inside a condition: <code>if (x = 5)</code> is an error, write <code>if (x == 5)</code>.</li>
      <li><code>x++</code> and assignments are statements, not values: no <code>a = b++</code>.</li>
      <li>The compiler doesn't optimize: what you write is what you pay. Optimizing is your job.</li>
    </ul>
  {/if}

  <h2>{it ? "Funzioni del robot" : "Robot functions"}</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>{it ? "Funzione" : "Function"}</th><th class="num">{it ? "Cicli" : "Cycles"}</th><th>{it ? "Cosa fa" : "What it does"}</th></tr></thead>
      <tbody>
        {#each BUILTINS as b (b.id)}
          <tr>
            <td><code>{b.name}({b.params.join(", ")})</code></td>
            <td class="num">{b.cost}{b.extraCost ? " " + extraCostText(b, lang) : ""}</td>
            <td>{DESC[b.name]?.[lang]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2>{it ? "Costo delle istruzioni macchina" : "Machine instruction costs"}</h2>
  <p>{it ? "Il compilatore traduce il programma in istruzioni di una macchina a stack. Esempio: «x = y + 1» diventa LDG y (1) · PUSH 1 (1) · ADD (1) · STG x (1) = 4 cicli." : "The compiler turns the program into instructions for a stack machine. Example: “x = y + 1” becomes LDG y (1) · PUSH 1 (1) · ADD (1) · STG x (1) = 4 cycles."}</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>{it ? "Istruzioni" : "Instructions"}</th><th class="num">{it ? "Cicli" : "Cycles"}</th><th>{it ? "Servono per" : "Used for"}</th></tr></thead>
      <tbody>
        {#each opGroups as g (g.ops[0])}
          <tr><td><code>{g.ops.join(" ")}</code></td><td class="num">{g.cost}</td><td>{g[lang]}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2>{it ? "L'arena" : "The arena"}</h2>
  <ul>
    {#if it}
      <li>Quadrato di {R.arenaSize} × {R.arenaSize} metri; (0, 0) è in basso a sinistra. Gli angoli sono in gradi: 0 = est, 90 = nord, 180 = ovest, 270 = sud.</li>
      <li>A velocità 100% un robot pulito fa {R.robotMaxStep / 1000} m per tick; accelera e frena di {R.accel}% a tick; sopra il {R.turnSpeed}% non può girare.</li>
      <li>I gavettoni volano a {R.balloonStep / 1000} m per tick e scoppiano alla distanza scelta, al massimo {R.throwRange} m. Lo schizzo colora chi è vicino, anche chi l'ha lanciato: {splashText(true)}.</li>
      <li>Al massimo {R.balloonsPerRobot} gavettoni in volo per robot e {R.reloadTicks} tick tra un lancio e l'altro. I muri sono verniciati di fresco: urtarli colora del {R.bump}% e ferma il robot; due robot che si urtano si fermano e si scambiano il {R.bump}% di vernice.</li>
      <li>Più un robot è colorato, più è lento e vede male: al 100% la velocità massima cala del {R.paintSlow}% e il radar sbaglia la distanza fino al ±{R.paintBlur}% (la direzione resta esatta). Sotto il 100% l'effetto è proporzionale: al 50% è la metà.</li>
      <li>A 100% di vernice il robot è <strong>fuori gioco</strong>: si ferma, il radar non lo vede più e non è più un ostacolo. Vince l'ultimo robot ancora in gioco.</li>
      <li>Una partita dura al massimo {R.maxTicks} tick. Memoria e numero di istruzioni dipendono dalla classe (vedi sotto).</li>
    {:else}
      <li>A {R.arenaSize} × {R.arenaSize} metre square; (0, 0) is bottom left. Angles are in degrees: 0 = east, 90 = north, 180 = west, 270 = south.</li>
      <li>At 100% speed a clean robot covers {R.robotMaxStep / 1000} m per tick; it speeds up and slows down by {R.accel}% per tick; above {R.turnSpeed}% it can't turn.</li>
      <li>Balloons fly {R.balloonStep / 1000} m per tick and burst at the chosen distance, at most {R.throwRange} m. The splash paints whoever is near, the thrower too: {splashText(false)}.</li>
      <li>At most {R.balloonsPerRobot} balloons in flight per robot and {R.reloadTicks} ticks between throws. The walls are freshly painted: bumping into one paints {R.bump}% and stops the robot; two robots that bump stop and swap {R.bump}% of paint.</li>
      <li>The more painted a robot, the slower it goes and the worse it sees: at 100% its top speed drops by {R.paintSlow}% and the radar gets the distance wrong by up to ±{R.paintBlur}% (the direction stays exact). Below 100% the effect is proportional: at 50% it is half.</li>
      <li>At 100% paint the robot is <strong>out of the game</strong>: it stops, the radar no longer sees it and it is no longer an obstacle. The last robot still in the game wins.</li>
      <li>A match lasts at most {R.maxTicks} ticks. Memory and instruction count depend on the class (see below).</li>
    {/if}
  </ul>

  <h2>{it ? "Classi" : "Classes"}</h2>
  <p>{it
    ? "Come nelle categorie dei tornei, la classe fissa quanto può essere grande un robot. Cicli per tick, fisica e costi sono identici in tutte le classi: cambia solo lo spazio a disposizione. Un robot appartiene alla classe più piccola in cui entra e può gareggiare anche in quelle più grandi. La memoria comprende le variabili globali e lo stack: almeno " + MIN_STACK + " parole devono restare libere per lo stack."
    : "As in tournament categories, the class sets how big a robot may be. Cycles per tick, physics and costs are identical in every class: only the available space changes. A robot belongs to the smallest class it fits in and can also compete in the larger ones. Memory holds global variables and the stack: at least " + MIN_STACK + " words must stay free for the stack."}</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>{it ? "Classe" : "Class"}</th><th class="num">{it ? "Istruzioni" : "Instructions"}</th><th class="num">{it ? "Memoria (parole)" : "Memory (words)"}</th></tr></thead>
      <tbody>
        {#each ROBOT_CLASSES as c (c.id)}
          <tr><td>{message("CLASS_" + c.id, [], lang)}</td><td class="num">{c.id === "unlimited" ? "∞" : c.maxCodeSize}</td><td class="num">{c.memorySize}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2>{it ? "Errori durante la partita" : "Errors during the match"}</h2>
  <p>{it ? "Divisione per zero, indice fuori da un array, radice di un numero negativo o troppe chiamate annidate fermano il programma: l'errore compare in console con la riga, e il robot riparte da main() (le variabili globali restano). Se main() finisce, il robot resta fermo." : "Division by zero, an index outside an array, the square root of a negative number or too many nested calls stop the program: the error shows in the console with its line, and the robot restarts from main() (global variables are kept). If main() ends, the robot stands still."}</p>

  <h2>{it ? "I tuoi dati" : "Your data"}</h2>
  <p>{it
    ? "paintarena gira tutto sul tuo computer, dentro il browser: compilatore, partite e tornei. I tuoi robot, le missioni completate e le impostazioni vengono salvati a ogni modifica nella memoria del browser (localStorage) e non lasciano mai il computer: niente viene inviato in rete, e non serve nessun account. Per portarli su un altro computer, o per conservarne una copia, esportali come file .pa. Attenzione: cancellando i dati di navigazione del sito si cancellano anche i robot."
    : "paintarena runs entirely on your computer, inside the browser: compiler, matches and tournaments. Your robots, completed missions and settings are saved in the browser's storage (localStorage) at every change and never leave the computer: nothing is sent over the network, and no account is needed. To move them to another computer, or to keep a copy, export them as .pa files. Careful: clearing the site's browsing data also deletes the robots."}</p>

  <h2>{it ? "L'editor" : "The editor"}</h2>
  <p>{it
    ? "Mentre scrivi, l'editor propone funzioni di sistema, costanti, parole chiave e le funzioni e variabili del tuo programma, con il costo in cicli e una breve descrizione. Le parole chiave come if, while, for e loop inseriscono il blocco intero: con Tab passi da un campo al successivo. Dentro le parentesi di una chiamata compare la firma della funzione, con l'argomento che stai scrivendo evidenziato; passando con il mouse su un nome vedi cos'è e dov'è definito."
    : "As you type, the editor suggests system functions, constants, keywords and your program's own functions and variables, with their cycle cost and a short description. Keywords like if, while, for and loop insert the whole block: Tab moves to the next field. Inside the parentheses of a call the function signature appears, with the argument you are typing highlighted; hovering over a name shows what it is and where it is defined."}</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>{it ? "Tasti" : "Keys"}</th><th>{it ? "Azione" : "Action"}</th></tr></thead>
      <tbody>
        {#each SHORTCUTS as [keys, itText, enText] (keys)}
          <tr><td class="whitespace-nowrap"><code>{keys}</code></td><td>{it ? itText : enText}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</article>
