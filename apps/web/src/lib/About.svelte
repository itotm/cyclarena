<script lang="ts">
  import type { Lang } from "@paintarena/engine";
  let { lang, onopen }: { lang: Lang; onopen: (page: string) => void } = $props();
</script>

{#snippet start(learn: string, play: string)}
  <p class="flex flex-wrap gap-2">
    <button class="btn-primary" onclick={() => onopen("learn")}>{learn}</button>
    <button onclick={() => onopen("play")}>{play}</button>
  </p>
{/snippet}

<article class="doc max-w-[46rem]">
  {#if lang === "it"}
    <h1>paintarena</h1>
    <p class="lead">Un gioco di programmazione: scrivi il programma di un robot che gioca a gavettoni di vernice, e ogni istruzione costa cicli.</p>
    {@render start("Inizia dalle missioni", "Gioco libero")}

    <section class="panel relative my-6 px-5 pt-1.5 pb-3 [&_h2]:mt-4 before:absolute before:-top-2.5 before:right-4 before:bg-bg before:px-1.5 before:font-mono before:text-xs before:tracking-widest before:text-accent before:content-['1985']">
      <h2>Grazie, CROBOTS</h2>
      <p>paintarena esiste grazie a <strong>CROBOTS</strong>, il gioco che <strong>Tom Poindexter</strong> scrisse nel 1985: un compilatore C, un computer virtuale e un'arena dove i robot combattono da soli, guidati solo dal codice dei loro autori. Un'idea semplice e geniale che ha fatto imparare a programmare generazioni di persone.</p>
      <p>In Italia CROBOTS ha avuto una seconda vita lunghissima: i tornei di <em>MCmicrocomputer</em> dal 1988, raccontati da Corrado Giustozzi, e poi la comunità di <a href="http://crobots.deepthought.it/" rel="noopener">crobots.deepthought.it</a>, che li organizza ancora. paintarena è un omaggio a tutti loro.</p>
      <p>Il codice originale è su <a href="https://github.com/tpoindex/crobots" rel="noopener">github.com/tpoindex/crobots</a>. paintarena è un progetto nuovo, scritto da zero: linguaggio, macchina e regole sono nuovi, e i robot di CROBOTS non sono compatibili.</p>
    </section>

    <h2>Cosa c'è di diverso</h2>
    <ul>
      <li>Niente armi: i robot si lanciano gavettoni di vernice. Chi è colorato al 100% esce dal gioco, e più vernice ha addosso più diventa lento e vede male.</li>
      <li>Ogni istruzione ha un costo in cicli dichiarato, e l'editor lo mostra riga per riga: ottimizzare il codice è parte del gioco.</li>
      <li>Le partite sono deterministiche e identiche su ogni computer: si possono rigiocare, condividere e verificare.</li>
      <li>Messaggi di errore pensati per chi impara, in italiano e in inglese.</li>
      <li>Funziona nel browser, senza installare niente; per i tornei grandi c'è la riga di comando.</li>
      <li>Tutto gira sul tuo computer: robot e progressi restano nella memoria del browser e non vengono mai inviati in rete.</li>
    </ul>

    <h2>Licenza</h2>
    <p>paintarena è software libero, distribuito con licenza <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noopener">GNU GPL versione 3</a> o successive. Il codice sorgente è su <a href="https://github.com/itotm/paintarena" rel="noopener">github.com/itotm/paintarena</a>.</p>
  {:else}
    <h1>paintarena</h1>
    <p class="lead">A programming game: write the program of a robot that plays with paint balloons, where every instruction costs cycles.</p>
    {@render start("Start with the missions", "Free play")}

    <section class="panel relative my-6 px-5 pt-1.5 pb-3 [&_h2]:mt-4 before:absolute before:-top-2.5 before:right-4 before:bg-bg before:px-1.5 before:font-mono before:text-xs before:tracking-widest before:text-accent before:content-['1985']">
      <h2>Thank you, CROBOTS</h2>
      <p>paintarena exists thanks to <strong>CROBOTS</strong>, the game <strong>Tom Poindexter</strong> wrote in 1985: a C compiler, a virtual computer and an arena where robots fight on their own, driven only by their authors' code. A simple, brilliant idea that taught generations of people to program.</p>
      <p>In Italy CROBOTS had a very long second life: the <em>MCmicrocomputer</em> tournaments from 1988, chronicled by Corrado Giustozzi, and then the community at <a href="http://crobots.deepthought.it/" rel="noopener">crobots.deepthought.it</a>, which still runs them. paintarena is a tribute to all of them.</p>
      <p>The original code is at <a href="https://github.com/tpoindex/crobots" rel="noopener">github.com/tpoindex/crobots</a>. paintarena was rewritten from scratch: language, machine and rules are new, and CROBOTS robots are not compatible.</p>
    </section>

    <h2>What's different</h2>
    <ul>
      <li>No weapons: robots throw paint balloons at each other. A robot 100% painted is out of the game, and the more paint it carries the slower it gets and the worse it sees.</li>
      <li>Every instruction has a declared cycle cost, and the editor shows it line by line: optimizing code is part of the game.</li>
      <li>Matches are deterministic and identical on every computer: they can be replayed, shared and verified.</li>
      <li>Error messages written for learners, in Italian and English.</li>
      <li>Runs in the browser with nothing to install; large tournaments use the command line.</li>
      <li>Everything runs on your computer: robots and progress stay in the browser's storage and are never sent over the network.</li>
    </ul>

    <h2>License</h2>
    <p>paintarena is free software, released under the <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noopener">GNU GPL version 3</a> or later. The source code is at <a href="https://github.com/itotm/paintarena" rel="noopener">github.com/itotm/paintarena</a>.</p>
  {/if}
</article>
