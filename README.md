# paintarena

**English** · [Italiano](README.it.md)

A programming game: write the program of a robot and send it into the arena
to take on the others with paint balloons. During the match you don't control
it: it does everything on its own. A robot that is 100% painted is out of the
game, and the more paint it carries the slower it gets and the worse it sees.
Every instruction **costs a fixed number of cycles**, and each tick the robot
has a limited budget, so the more efficient the code, the more the robot gets
done.

Made for **learning to program**: a path of guided missions, a small C-like
language, clear error messages in English and Italian, the cost of every line
shown in the editor and a profile of where the cycles went at the end of each
match. Four classes (Micro, Mini, Standard, Unlimited) limit code size and
memory, like tournament categories.

Source code: [github.com/itotm/paintarena](https://github.com/itotm/paintarena).

## Thank you, CROBOTS

paintarena is a tribute to **CROBOTS**, the game Tom Poindexter wrote in 1985
([github.com/tpoindex/crobots](https://github.com/tpoindex/crobots)), and to the
Italian community that kept it alive for decades: the *MCmicrocomputer*
tournaments from 1988 and [crobots.deepthought.it](http://crobots.deepthought.it/).
paintarena is a new project written from scratch: the language, the virtual
machine and the rules are new, and CROBOTS robots are not compatible.

## What you can do

- **Learn**: fourteen short missions in four groups, each introducing one idea:
  moving, braking, arrays, the radar, trigonometry with `mark()`, throwing,
  aiming, moving targets, leading a target, a slow CPU, averaging noisy
  readings, dodging, a one-on-one match, a free-for-all.
- **Play**: write robots in an editor with IDE helpers (completion of functions,
  variables and blocks, signature and cost hints, go to definition, folding,
  search and replace, multiple cursors), keep as many as you like, import and
  export them as `.pa` files to swap them with friends, and run matches with
  2, 3 or 4 robots chosen among yours and the examples. Matches are replayed
  frame by frame, with a console for `print()` and a cycle profile.
- **Tournament**: thousands of matches (1k, 10k, 100k or any number) played in
  parallel in the browser, in duels or groups of 3 or 4, with ranking,
  head-to-head matrix, win-rate trend and match-length chart.

Everything runs in the browser, on your computer: robots, completed missions
and settings are saved in the browser's storage (localStorage) at every change
and **never leave the computer**. Nothing is sent over the network and no
account is needed; to move robots to another computer, export them as `.pa`
files.

## Example robots

| Robot | Class | Idea |
|---|---|---|
| `first` | Micro | the starting point, fully commented |
| `sprinkler` | Micro | stands still and sweeps the radar |
| `wanderer` | Micro | runs between random points, throwing at anything it sees |
| `spiral` | Micro | spirals around the centre (turning is only allowed at ≤ 50% speed) |
| `circuit` | Micro | drives along the walls, scanning only the inner half of the arena |
| `chaser` | Micro | narrows the radar beam, throws and chases |
| `corner` | Micro | settles in a corner, where 90° are enough to watch |
| `tracker` | Mini | locks onto a target, estimates its velocity and throws where it will be |
| `mapper` | Standard | keeps a map of the arena in memory, with the dangerous places and those already visited |
| `strategist` | Unlimited | rotates five strategies and keeps the one where it takes the least paint; fine map and history of sightings |

The example robots come in two versions with the same program: in English in
`robots/en` and in Italian in `robots/it` (`primo`, `irrigatore`, `vagabondo`,
`spirale`, `circuito`, `inseguitore`, `angolo`, `segugio`, `cartografo`, `stratega`). The website shows
the ones in the chosen language.

## Running it

The website needs nothing installed. Locally:

```sh
pnpm install
pnpm dev          # site at http://localhost:5173
```

Command line (Node.js ≥ 22.18, which runs TypeScript directly):

```sh
pnpm cli compile robots/en/tracker.pa            # cost of every line
pnpm cli compile robots/en/tracker.pa --asm      # machine instructions
pnpm cli match robots/en/{sprinkler,wanderer,corner,tracker}.pa --seed 42   # one match (2 to 4 robots)
pnpm cli tournament robots/en/*.pa --class unlimited --mode duel --rounds 1000
pnpm cli tournament robots/en/*.pa --class unlimited --size 3 --rounds 200 --json
pnpm cli tournament robots/en/{sprinkler,wanderer,corner,chaser}.pa --class micro   # classes: micro, mini, standard, unlimited
```

On a 24-thread PC a tournament plays about **6,000 matches per second**
(2 billion cycles per second); the browser, with Web Workers on all cores, gets similar speeds.

## Installable versions (Bun)

[Bun](https://bun.sh) builds a **single executable** with the website embedded:
double-click it and the game opens in the browser (local server on
`http://127.0.0.1:51517`, always the same port so the browser keeps your robots
and progress); run it from a terminal and it is the command line
(`paintarena compile|match|tournament …`). Bun doesn't need to be installed:
`pnpm dlx` fetches it.

```sh
pnpm dist          # Windows: portable folder, zip and installer
pnpm dist:linux    # Linux: tar.gz
pnpm dist:all      # Windows, Linux and macOS (arm64)
```

Output in `dist/`:

| File | Contents |
|---|---|
| `paintarena-<version>-setup.exe` | Windows installer (per user, no admin rights; Start menu, desktop shortcut, uninstaller) |
| `paintarena-<version>-windows-x64.zip` | portable version: unzip and open `paintarena.exe` |
| `paintarena-<version>-linux-x64.tar.gz` | Linux version |

The installer needs NSIS (`sudo apt install nsis`, or the `MAKENSIS` variable)
and ImageMagick for the icon. When building on Linux the Windows executable
keeps Bun's icon (Bun only applies `--windows-*` options when compiling on
Windows); shortcuts and installer use paintarena's. Useful variables:
`PAINTARENA_PORT` (port), `PAINTARENA_LANG` (it/en), `PAINTARENA_NO_BROWSER`
(don't open the browser).

## Project layout

| Folder | Contents |
|---|---|
| `packages/engine` | compiler, virtual machine, simulation, tournament statistics (pure TypeScript, no dependencies) |
| `packages/cli` | command line, multi-threaded tournaments, launcher of the installable version (`app.ts`) |
| `apps/web` | website: Svelte 5, Tailwind CSS 4, CodeMirror 6, canvas arena, Web Workers for tournaments |
| `robots` | example robots, in English (`en`) and Italian (`it`) |
| `scripts` | installable builds (`dist.ts`, NSIS installer in `windows/`) |

```sh
pnpm test         # engine and mission tests
pnpm typecheck    # TypeScript 7 + svelte-check
pnpm build        # static site in apps/web/dist
```

The site is published on GitHub Pages by `.github/workflows/pages.yml`.

## License

Free software: GNU GPL version 3 or later (see [LICENSE](LICENSE)).
