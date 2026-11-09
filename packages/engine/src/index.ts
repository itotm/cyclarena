// paintarena — game engine: compiler, virtual machine, simulation.

export { compile, type CompileResult } from "./lang/compiler.ts";
export { formatDiagnostic, type Diagnostic } from "./lang/diagnostics.ts";
export { KEYWORDS } from "./lang/lexer.ts";
export { message, MESSAGES, type Lang, type MsgArg } from "./i18n.ts";
export { RULES_V0, ROBOT_CLASSES, MIN_STACK, robotClass, rulesForClass, smallestClass, splashPaint, type Rules, type RobotClass, type RobotClassId, type SplashLevel } from "./rules.ts";
export { BUILTINS, BUILTIN_CONSTS, OP_COST, OP_NAMES, Op, type Builtin } from "./vm/isa.ts";
export type { Program, FunctionInfo, VarInfo } from "./vm/program.ts";
export { disassemble, type AsmLine } from "./vm/disasm.ts";
export { Match, Robot, MAX_ROBOTS, WALL, type Entrant, type MatchEvent, type MatchOptions, type MatchResult } from "./sim/match.ts";
export { recordMatch, type Frame, type Replay, type RobotFrame } from "./sim/replay.ts";
export { mixSeed } from "./math.ts";
export {
  tournamentGroups, tournamentSeed, tournamentMatch, emptyStats, mergeStats, addMatch, playTournamentRange,
  POINTS_WIN, POINTS_SURVIVE, HIST_BINS, type TournamentStats,
} from "./sim/tournament.ts";
