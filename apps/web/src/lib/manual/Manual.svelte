<script lang="ts">
  // The manual: an index on the left (a drop-down list on narrow screens) and
  // the sections on the right. Every section has an address, #manual/<id>,
  // and the index highlights the section being read.
  import { BUILTINS, BUILTIN_CONSTS, message, MIN_STACK, OP_COST, Op, ROBOT_CLASSES, RULES_V0 as R, type Lang } from "@paintarena/engine";
  import { BUILTIN_DOCS, extraCostText, FN_GROUPS } from "../builtinDocs.ts";
  import { FN_CARDS } from "./fnCards.ts";
  import FnCard from "./FnCard.svelte";
  import ArenaCoords from "./diagrams/ArenaCoords.svelte";
  import Compass from "./diagrams/Compass.svelte";
  import SplashRings from "./diagrams/SplashRings.svelte";

  let { lang, section = "" }: { lang: Lang; section?: string } = $props();
  const it = $derived(lang === "it");

  interface TocItem { id: string; it: string; en: string; children?: TocItem[] }
  const TOC: TocItem[] = [
    { id: "intro", it: "Introduzione", en: "Introduction" },
    { id: "ticks", it: "Cicli e tick", en: "Cycles and ticks" },
    { id: "language", it: "Il linguaggio", en: "The language" },
    { id: "arena", it: "L'arena e le coordinate", en: "The arena and coordinates" },
    { id: "angles", it: "Angoli e direzioni", en: "Angles and directions" },
    {
      id: "functions", it: "Funzioni del robot", en: "Robot functions",
      children: FN_GROUPS.map((g) => ({ id: "fn-" + g.id, it: g.it, en: g.en })),
    },
    { id: "rules", it: "Regole della partita", en: "Match rules" },
    { id: "classes", it: "Classi", en: "Classes" },
    { id: "costs", it: "Costo delle istruzioni", en: "Instruction costs" },
    { id: "errors", it: "Errori durante la partita", en: "Errors during the match" },
    { id: "editor", it: "L'editor", en: "The editor" },
    { id: "data", it: "I tuoi dati", en: "Your data" },
  ];
  const flat = TOC.flatMap((t) => [t, ...(t.children ?? [])]);
  const title = (id: string) => { const t = flat.find((x) => x.id === id); return t ? t[lang] : ""; };

  const GROUP_INTRO: Record<string, { it: string; en: string }> = {
    coords: {
      it: "Per chi non ha ancora studiato la trigonometria: lavorano con le coordinate x e y dei punti invece che con seno, coseno e arcotangente. Ognuna dice a quale calcolo corrisponde: il risultato e il costo in cicli sono gli stessi, quindi non danno vantaggi né svantaggi.",
      en: "For those who have not studied trigonometry yet: they work with the x and y coordinates of points instead of sine, cosine and arctangent. Each one says which calculation it matches: the result and the cost in cycles are the same, so they give no advantage and no disadvantage.",
    },
    trig: {
      it: "Per chi conosce la trigonometria. Fanno le stesse cose delle funzioni a coordinate, un pezzo alla volta: per esempio calcolando dx e dy una volta sola si risparmiano cicli.",
      en: "For those who know trigonometry. They do the same things as the coordinate functions, one piece at a time: for example computing dx and dy only once saves cycles.",
    },
  };
  const UTIL = FN_GROUPS.find((g) => g.id === "util")!.fns.map((n) => BUILTINS.find((b) => b.name === n)!);

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

  // --- navigation ---
  let active = $state("intro");
  let tocOpen = $state(false);

  function scrollToSection(id: string, smooth = true) {
    const el = document.getElementById("m-" + id);
    if (!el) return;
    el.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto", block: "start" });
    active = flat.some((t) => t.id === id) ? id : active;
  }

  function follow(e: MouseEvent, id: string) {
    e.preventDefault();
    tocOpen = false;
    history.pushState(null, "", "#manual/" + id);
    scrollToSection(id);
  }

  // address with a section (also from the browser's back and forward)
  $effect(() => {
    const id = section;
    if (id) requestAnimationFrame(() => scrollToSection(id, false));
  });

  // the index follows the reading: the section whose title is in the top
  // part of the page is the current one
  function spy(node: HTMLElement) {
    const visible = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.toc!;
        if (e.isIntersecting) visible.add(id); else visible.delete(id);
      }
      // the last one in reading order: a group inside "Robot functions" wins over it
      const last = flat.findLast((t) => visible.has(t.id));
      if (last) active = last.id;
    }, { rootMargin: "0px 0px -65% 0px" });
    for (const el of node.querySelectorAll<HTMLElement>("[data-toc]")) io.observe(el);
    return () => io.disconnect();
  }

  const activeTop = $derived(TOC.find((t) => t.id === active || t.children?.some((c) => c.id === active))?.id ?? "");

  /** The splash levels in words: "25% within 5 m, 21% within 10 m, …". */
  const splashText = $derived(R.splash.map((l) => `${l.paint}% ${it ? "entro" : "within"} ${l.range} m`).join(", "));
</script>

{#snippet tocList(items: TocItem[], depth: number)}
  <ul class={depth ? "mt-0.5 mb-1 ml-3 border-l border-line pl-2" : "m-0 p-0"}>
    {#each items as t (t.id)}
      <li class="list-none">
        <a href="#manual/{t.id}" onclick={(e) => follow(e, t.id)} aria-current={active === t.id ? "location" : undefined}
          class={["toc-link", depth && "text-[0.82rem]", activeTop === t.id && !depth && "toc-parent"]}>{t[lang]}</a>
        {#if t.children}{@render tocList(t.children, depth + 1)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet heading(id: string, level: 2 | 3 = 2)}
  {#if level === 2}<h2>{title(id)}</h2>{:else}<h3>{title(id)}</h3>{/if}
{/snippet}

<div class="mx-auto grid max-w-[74rem] gap-x-10 lg:grid-cols-[14rem_minmax(0,52rem)]">
  <!-- index: fixed on the left on wide screens, a drop-down list on narrow ones -->
  <nav class="max-lg:mb-2 lg:sticky lg:top-0 lg:max-h-[calc(100vh-74px)] lg:self-start lg:overflow-y-auto lg:py-4" aria-label={it ? "Indice del manuale" : "Manual contents"}>
    <button class="w-full text-left lg:hidden" aria-expanded={tocOpen} onclick={() => (tocOpen = !tocOpen)}>
      {tocOpen ? "▾" : "▸"} {it ? "Indice" : "Contents"} · <span class="font-normal text-muted">{title(active)}</span>
    </button>
    <div class={["max-lg:panel max-lg:mt-1 max-lg:p-2", !tocOpen && "max-lg:hidden"]}>
      <p class="label-tech mt-0 mb-2 max-lg:hidden">{it ? "Indice" : "Contents"}</p>
      {@render tocList(TOC, 0)}
    </div>
  </nav>

  <article class="doc w-full min-w-0 max-w-[52rem]" {@attach spy}>
    <section id="m-intro" data-toc="intro">
      <h1>{it ? "Manuale" : "Manual"}</h1>
      {#if it}
        <p class="lead">Un robot di paintarena è un programma che gioca a gavettoni di vernice. Durante la partita non lo comandi tu: fa tutto da solo, con le istruzioni che gli hai scritto.</p>
        <p>Il manuale spiega il linguaggio, le funzioni del robot e le regole della partita. I disegni con il simbolo ✥ si possono toccare: trascina i robot e i punti, o sposta i cursori, e guarda come cambiano i valori. I numeri sono calcolati come nel gioco.</p>
      {:else}
        <p class="lead">A paintarena robot is a program that plays with paint balloons. During the match you don't control it: it does everything on its own, following the instructions you wrote.</p>
        <p>The manual explains the language, the robot's functions and the match rules. The drawings marked ✥ can be touched: drag the robots and the points, or move the sliders, and watch the values change. The numbers are computed as in the game.</p>
      {/if}
    </section>

    <section id="m-ticks" data-toc="ticks">
      {@render heading("ticks")}
      {#if it}
        <p>La partita avanza a <strong>tick</strong>. A ogni tick ogni robot riceve <strong>{R.cyclesPerTick} cicli</strong> ed esegue istruzioni finché non li ha spesi; poi l'arena muove robot e gavettoni. Ogni istruzione ha un <strong>costo fisso</strong>, scritto nelle tabelle di questo manuale e accanto a ogni riga nell'editor (il <code>+</code> indica un costo che dipende dai valori). Se un'istruzione costa più dei cicli rimasti viene eseguita lo stesso, e la differenza si paga nel tick successivo.</p>
        <p>Tutti i robot «vedono» l'arena com'era all'inizio del tick: non conta chi gioca per primo. Le partite sono <strong>deterministiche</strong>: con lo stesso seed e gli stessi robot il risultato è sempre identico, su qualunque computer.</p>
      {:else}
        <p>The match advances in <strong>ticks</strong>. Each tick every robot gets <strong>{R.cyclesPerTick} cycles</strong> and runs instructions until they are spent; then the arena moves robots and balloons. Every instruction has a <strong>fixed cost</strong>, listed in the tables of this manual and next to each line in the editor (a <code>+</code> marks a cost that depends on values). If an instruction costs more than the cycles left it still runs, and the difference is paid in the next tick.</p>
        <p>All robots “see” the arena as it was at the start of the tick: who runs first doesn't matter. Matches are <strong>deterministic</strong>: same seed and same robots always give the same result, on any computer.</p>
      {/if}
    </section>

    <section id="m-language" data-toc="language">
      {@render heading("language")}
      {#if it}
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
    </section>

    <section id="m-arena" data-toc="arena">
      {@render heading("arena")}
      {#if it}
        <p>L'arena è un quadrato di {R.arenaSize} × {R.arenaSize} metri, come un foglio a quadretti: ogni punto ha una <strong>x</strong> (quanto è a destra) e una <strong>y</strong> (quanto è in alto). Il punto (0, 0) è l'angolo in basso a sinistra. <code>loc_x()</code> e <code>loc_y()</code> dicono dove si trova il tuo robot; <code>mark(x, y)</code> disegna una crocetta in un punto, per vedere cosa «pensa» il robot.</p>
      {:else}
        <p>The arena is a {R.arenaSize} × {R.arenaSize} metre square, like squared paper: every point has an <strong>x</strong> (how far right) and a <strong>y</strong> (how far up). The point (0, 0) is the bottom left corner. <code>loc_x()</code> and <code>loc_y()</code> say where your robot is; <code>mark(x, y)</code> draws a small cross at a point, to see what the robot is “thinking”.</p>
      {/if}
      <ArenaCoords {lang} />
    </section>

    <section id="m-angles" data-toc="angles">
      {@render heading("angles")}
      {#if it}
        <p>Le direzioni sono in <strong>gradi</strong>: 0 è est (verso destra), 90 è nord (verso l'alto), 180 è ovest, 270 è sud. Servono per muoversi (<code>drive</code>), per il radar (<code>scan</code>) e per lanciare (<code>throw</code>).</p>
        <p><strong>Attenzione:</strong> gli angoli crescono in senso <strong>antiorario</strong>, come in matematica. Sulla bussola invece si parte da nord e si gira in senso orario, e 90 è est.</p>
        <p>Qualunque angolo va bene, anche negativo o oltre 360: −90 è come 270, 450 è come 90. Se ti serve la direzione verso un punto, la calcola <code>dir_to(x, y)</code>.</p>
      {:else}
        <p>Directions are in <strong>degrees</strong>: 0 is east (to the right), 90 is north (up), 180 is west, 270 is south. They are used to move (<code>drive</code>), for the radar (<code>scan</code>) and to throw (<code>throw</code>).</p>
        <p><strong>Careful:</strong> angles grow <strong>counterclockwise</strong>, as in maths. On a compass you start from north and go clockwise, and 90 is east.</p>
        <p>Any angle is fine, even negative or above 360: −90 is the same as 270, 450 the same as 90. If you need the direction towards a point, <code>dir_to(x, y)</code> works it out.</p>
      {/if}
      <Compass {lang} />
    </section>

    <section id="m-functions" data-toc="functions">
      {@render heading("functions")}
      {#if it}
        <p>Le funzioni di sistema sono già pronte in ogni programma. Accanto a ognuna c'è il costo in cicli. Ci sono due modi di fare i calcoli di posizione: con le <a href="#manual/fn-coords" onclick={(e) => follow(e, "fn-coords")}>coordinate</a> (per chi non ha ancora studiato la trigonometria) o con la <a href="#manual/fn-trig" onclick={(e) => follow(e, "fn-trig")}>trigonometria</a>. Danno gli stessi risultati allo stesso costo.</p>
      {:else}
        <p>System functions are ready in every program. Each one shows its cost in cycles. There are two ways to do position calculations: with <a href="#manual/fn-coords" onclick={(e) => follow(e, "fn-coords")}>coordinates</a> (for those who have not studied trigonometry yet) or with <a href="#manual/fn-trig" onclick={(e) => follow(e, "fn-trig")}>trigonometry</a>. They give the same results at the same cost.</p>
      {/if}
      <div class="table-wrap">
        <table>
          <thead><tr><th>{it ? "Gruppo" : "Group"}</th><th>{it ? "Funzioni" : "Functions"}</th></tr></thead>
          <tbody>
            {#each FN_GROUPS as g (g.id)}
              <tr>
                <td class="whitespace-nowrap"><a href="#manual/fn-{g.id}" onclick={(e) => follow(e, "fn-" + g.id)}>{g[lang]}</a></td>
                <td>{#each g.fns as f, i (f)}{i ? ", " : ""}<code>{f}</code>{/each}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#each FN_GROUPS as g (g.id)}
        <section id="m-fn-{g.id}" data-toc="fn-{g.id}" class="fn-group">
          {@render heading("fn-" + g.id, 3)}
          {#if GROUP_INTRO[g.id]}<p>{GROUP_INTRO[g.id][lang]}</p>{/if}
          {#if g.id === "util"}
            <div class="table-wrap">
              <table>
                <thead><tr><th>{it ? "Funzione" : "Function"}</th><th class="num">{it ? "Cicli" : "Cycles"}</th><th>{it ? "Cosa fa" : "What it does"}</th></tr></thead>
                <tbody>
                  {#each UTIL as b (b.id)}
                    <tr id="m-fn-{b.name}">
                      <td class="whitespace-nowrap"><code>{b.name}({b.params.join(", ")})</code></td>
                      <td class="num">{b.cost}{b.extraCost ? " " + extraCostText(b, lang) : ""}</td>
                      <td>{BUILTIN_DOCS[b.name]?.[lang]}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            {#each FN_CARDS.filter((c) => c.group === g.id) as card (card.id)}
              <FnCard {card} {lang} />
            {/each}
          {/if}
        </section>
      {/each}
    </section>

    <section id="m-rules" data-toc="rules">
      {@render heading("rules")}
      <ul>
        {#if it}
          <li>A velocità 100% un robot pulito fa {R.robotMaxStep / 1000} m per tick; accelera e frena di {R.accel}% a tick; sopra il {R.turnSpeed}% non può girare (vedi <a href="#manual/fn-drive" onclick={(e) => follow(e, "fn-drive")}>drive</a>).</li>
          <li>I gavettoni volano a {R.balloonStep / 1000} m per tick e scoppiano alla distanza scelta, al massimo {R.throwRange} m. Lo schizzo colora chi è vicino, anche chi l'ha lanciato: {splashText}.</li>
          <li>Al massimo {R.balloonsPerRobot} gavettoni in volo per robot e {R.reloadTicks} tick tra un lancio e l'altro. I muri sono verniciati di fresco: urtarli colora del {R.bump}% e ferma il robot; due robot che si urtano si fermano e si scambiano il {R.bump}% di vernice.</li>
          <li>Più un robot è colorato, più è lento e vede male: al 100% la velocità massima cala del {R.paintSlow}% e il radar sbaglia la distanza fino al ±{R.paintBlur}% (la direzione resta esatta). Sotto il 100% l'effetto è proporzionale: al 50% è la metà.</li>
          <li>A 100% di vernice il robot è <strong>fuori gioco</strong>: si ferma, il radar non lo vede più e non è più un ostacolo. Vince l'ultimo robot ancora in gioco.</li>
          <li>Una partita dura al massimo {R.maxTicks} tick. Memoria e numero di istruzioni dipendono dalla <a href="#manual/classes" onclick={(e) => follow(e, "classes")}>classe</a>.</li>
        {:else}
          <li>At 100% speed a clean robot covers {R.robotMaxStep / 1000} m per tick; it speeds up and slows down by {R.accel}% per tick; above {R.turnSpeed}% it can't turn (see <a href="#manual/fn-drive" onclick={(e) => follow(e, "fn-drive")}>drive</a>).</li>
          <li>Balloons fly {R.balloonStep / 1000} m per tick and burst at the chosen distance, at most {R.throwRange} m. The splash paints whoever is near, the thrower too: {splashText}.</li>
          <li>At most {R.balloonsPerRobot} balloons in flight per robot and {R.reloadTicks} ticks between throws. The walls are freshly painted: bumping into one paints {R.bump}% and stops the robot; two robots that bump stop and swap {R.bump}% of paint.</li>
          <li>The more painted a robot, the slower it goes and the worse it sees: at 100% its top speed drops by {R.paintSlow}% and the radar gets the distance wrong by up to ±{R.paintBlur}% (the direction stays exact). Below 100% the effect is proportional: at 50% it is half.</li>
          <li>At 100% paint the robot is <strong>out of the game</strong>: it stops, the radar no longer sees it and it is no longer an obstacle. The last robot still in the game wins.</li>
          <li>A match lasts at most {R.maxTicks} ticks. Memory and instruction count depend on the <a href="#manual/classes" onclick={(e) => follow(e, "classes")}>class</a>.</li>
        {/if}
      </ul>
      <SplashRings {lang} />
    </section>

    <section id="m-classes" data-toc="classes">
      {@render heading("classes")}
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
    </section>

    <section id="m-costs" data-toc="costs">
      {@render heading("costs")}
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
    </section>

    <section id="m-errors" data-toc="errors">
      {@render heading("errors")}
      <p>{it ? "Divisione per zero, indice fuori da un array, radice di un numero negativo o troppe chiamate annidate fermano il programma: l'errore compare in console con la riga, e il robot riparte da main() (le variabili globali restano). Se main() finisce, il robot resta fermo." : "Division by zero, an index outside an array, the square root of a negative number or too many nested calls stop the program: the error shows in the console with its line, and the robot restarts from main() (global variables are kept). If main() ends, the robot stands still."}</p>
    </section>

    <section id="m-editor" data-toc="editor">
      {@render heading("editor")}
      <p>{it
        ? "Mentre scrivi, l'editor propone funzioni di sistema, costanti, parole chiave e le funzioni e variabili del tuo programma, con il costo in cicli e una breve descrizione. Nel percorso base le funzioni a coordinate vengono proposte per prime e sin, cos e atan2 sono segnate come avanzate. Le parole chiave come if, while, for e loop inseriscono il blocco intero: con Tab passi da un campo al successivo. Dentro le parentesi di una chiamata compare la firma della funzione, con l'argomento che stai scrivendo evidenziato; passando con il mouse su un nome vedi cos'è e dov'è definito."
        : "As you type, the editor suggests system functions, constants, keywords and your program's own functions and variables, with their cycle cost and a short description. In the basic path the coordinate functions are suggested first and sin, cos and atan2 are marked as advanced. Keywords like if, while, for and loop insert the whole block: Tab moves to the next field. Inside the parentheses of a call the function signature appears, with the argument you are typing highlighted; hovering over a name shows what it is and where it is defined."}</p>
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
    </section>

    <section id="m-data" data-toc="data">
      {@render heading("data")}
      <p>{it
        ? "paintarena gira tutto sul tuo computer, dentro il browser: compilatore, partite e tornei. I tuoi robot, le missioni completate e le impostazioni vengono salvati a ogni modifica nella memoria del browser (localStorage) e non lasciano mai il computer: niente viene inviato in rete, e non serve nessun account. Per portarli su un altro computer, o per conservarne una copia, esportali come file .pa. Attenzione: cancellando i dati di navigazione del sito si cancellano anche i robot."
        : "paintarena runs entirely on your computer, inside the browser: compiler, matches and tournaments. Your robots, completed missions and settings are saved in the browser's storage (localStorage) at every change and never leave the computer: nothing is sent over the network, and no account is needed. To move them to another computer, or to keep a copy, export them as .pa files. Careful: clearing the site's browsing data also deletes the robots."}</p>
    </section>
  </article>
</div>

<style>
  .toc-link {
    display: block;
    padding: 0.18rem 0.5rem;
    border-left: 2px solid transparent;
    color: var(--text-muted);
    font-size: 0.88rem;
    line-height: 1.35;
    text-decoration: none;
  }
  .toc-link:hover { color: var(--text); }
  .toc-parent { color: var(--text); }
  .toc-link[aria-current="location"] { border-left-color: var(--accent); color: var(--accent); font-weight: 600; }

  .doc :global(section[id]), .doc :global(article[id]), .doc :global(tr[id]) { scroll-margin-top: 0.75rem; }
  .doc :global(.fn-card) { margin: 1rem 0 1.4rem; padding: 0.8rem 1rem 0.4rem; border: 1px solid var(--line); border-radius: var(--radius-panel); background: var(--surface); }
  .doc :global(.fn-card pre) { background: var(--bg); }
  .doc :global(.fn-card .equiv) { font-size: 0.85rem; color: var(--text-muted); }
  .doc :global(.fn-card .equiv code) { color: var(--text-muted); }

  /* diagrams */
  .doc :global(.dg-figure) { margin: 0.9rem 0 1rem; max-width: 30rem; }
  .doc :global(.dg-figure figcaption) { margin-top: 0.35rem; font-size: 0.83rem; color: var(--text-muted); line-height: 1.45; }
  .doc :global(.dg-figure figcaption::before) { content: "✥ "; color: var(--accent); }
  .doc :global(.dg-controls) { display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; margin-top: 0.4rem; font-family: var(--font-mono); font-size: 0.8rem; }
  .doc :global(.dg-controls label) { display: flex; align-items: center; gap: 0.45rem; }
  .doc :global(.dg-controls input[type="range"]) { width: 9rem; padding: 0; accent-color: var(--accent); }
  .doc :global(.dg-controls output) { min-width: 2.5rem; color: var(--accent); }
  .doc :global(.dg-out) { margin-top: 0.35rem; font-size: 0.84rem; }
  .doc :global(.dg-out code) { color: var(--accent); }
  .doc :global(.dg text) { font-family: var(--font-mono); }
  .doc :global(.dg .dg-label) { font-size: 12px; fill: var(--text-muted); }
  .doc :global(.dg .dg-small) { font-size: 11px; fill: var(--arena-label); }
  .doc :global(.dg .dg-ring-label) { font-size: 10.5px; font-weight: 700; fill: var(--text); }
  .doc :global(.dg .dg-value) { font-size: 12px; font-weight: 700; fill: var(--accent); }
  .doc :global(.dg .dg-axis-label) { font-size: 14px; font-weight: 700; fill: var(--text); }
  .doc :global(.dg .dg-arena) { fill: var(--arena-bg); stroke: var(--line-strong); }
  .doc :global(.dg .dg-grid) { stroke: var(--arena-grid); stroke-width: 1; }
  .doc :global(.dg .dg-grid-major) { stroke: var(--arena-grid-major); stroke-width: 1; }
  .doc :global(.dg .dg-axis) { stroke: var(--text); stroke-width: 1.5; }
  .doc :global(.dg .dg-tick) { stroke: var(--line-strong); stroke-width: 1.2; }
  .doc :global(.dg .dg-ring) { fill: none; stroke: var(--line-strong); stroke-width: 1.5; }
  .doc :global(.dg .dg-guide) { stroke: var(--text-dim); stroke-width: 1.2; stroke-dasharray: 4 4; fill: none; }
  .doc :global(.dg .dg-ray) { stroke: var(--accent); stroke-width: 2.2; fill: none; }
  .doc :global(.dg .dg-arc) { stroke: var(--accent); stroke-width: 1.5; fill: none; }
  .doc :global(.dg .dg-line) { stroke: var(--accent); stroke-width: 2; fill: none; }
  .doc :global(.dg .dg-leg) { stroke: var(--hot); stroke-width: 1.5; stroke-dasharray: 5 3; }
  .doc :global(.dg .dg-leg-strong) { stroke: var(--hot); stroke-width: 2.5; }
  .doc :global(.dg .dg-cone) { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1; stroke-opacity: 0.6; }
  .doc :global(.dg .dg-cone-line) { stroke: var(--accent); stroke-width: 2; }
  .doc :global(.dg .dg-range) { fill: none; stroke: var(--text-dim); stroke-width: 1; stroke-dasharray: 2 5; }
  .doc :global(.dg .dg-splash) { fill: none; stroke: var(--hot); stroke-width: 1; stroke-opacity: 0.7; }
  .doc :global(.dg .dg-splash-fill) { fill: var(--hot); stroke: var(--hot); stroke-width: 1; }
  .doc :global(.dg .dg-point) { fill: var(--hot); stroke: var(--surface); stroke-width: 1.5; }
  .doc :global(.dg .dg-robot) { stroke: var(--surface); stroke-width: 2; }
  .doc :global(.dg .dg-robot-nose) { stroke: var(--text); stroke-width: 2.5; stroke-linecap: round; }
  .doc :global(.dg .dg-fill-ink) { fill: var(--text); }
  .doc :global(.dg .dg-fill-accent) { fill: var(--accent); }
  .doc :global(.dg .dg-handle:focus-visible) { outline: none; }
  .doc :global(.dg .dg-handle:focus-visible .dg-handle-ring) { stroke-width: 3; stroke-dasharray: none; }
  .doc :global(.dg .dg-handle-ring) { fill: none; stroke-width: 1.5; stroke-dasharray: 3 3; opacity: 0.9; }
  .doc :global(.dg .dg-handle-dot) { stroke: var(--surface); stroke-width: 2; }
</style>
