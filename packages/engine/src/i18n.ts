// Compiler and machine messages, in Italian and English.
// The engine only produces codes and arguments; the text is chosen here, so
// the website and the command line show the same messages.

export type Lang = "it" | "en";

type Catalog = Record<string, { it: string; en: string }>;

export const MESSAGES: Catalog = {
  // lexical analysis
  E_CHAR: { it: "Carattere inatteso «{0}»", en: "Unexpected character '{0}'" },
  E_NUMBER: { it: "Numero non valido «{0}»", en: "Invalid number '{0}'" },
  E_NUMBER_RANGE: { it: "Numero troppo grande «{0}»: i valori vanno da -2147483648 a 2147483647", en: "Number too large '{0}': values go from -2147483648 to 2147483647" },
  E_STRING: { it: "Stringa non chiusa: manca la \" finale", en: "Unterminated string: missing closing \"" },
  E_COMMENT: { it: "Commento non chiuso: manca */", en: "Unterminated comment: missing */" },
  // syntax
  E_EXPECTED: { it: "Mi aspettavo {0}, invece c'è {1}", en: "Expected {0}, found {1}" },
  E_EXPR: { it: "Mi aspettavo un'espressione, invece c'è {0}", en: "Expected an expression, found {0}" },
  E_STMT: { it: "Mi aspettavo un'istruzione, invece c'è {0}", en: "Expected a statement, found {0}" },
  E_TOPLEVEL: { it: "Fuori dalle funzioni si possono scrivere solo const, var e fn; trovato {0}", en: "Only const, var and fn are allowed outside functions; found {0}" },
  E_ASSIGN_IN_EXPR: { it: "Qui «=» non è permesso: per confrontare due valori si usa «==»", en: "'=' is not allowed here: to compare two values use '=='" },
  E_BRACES: { it: "Il corpo di {0} va scritto tra parentesi graffe {{ … }}", en: "The body of {0} must be written in braces {{ … }}" },
  E_BAD_TARGET: { it: "A sinistra di «{0}» ci vuole una variabile", en: "The left side of '{0}' must be a variable" },
  E_STRING_PLACE: { it: "I testi tra virgolette si possono usare solo dentro print()", en: "Quoted text can only be used inside print()" },
  // semantics
  E_UNKNOWN: { it: "Nome sconosciuto «{0}»", en: "Unknown name '{0}'" },
  E_UNKNOWN_HINT: { it: "Nome sconosciuto «{0}»: forse intendevi «{1}»?", en: "Unknown name '{0}': did you mean '{1}'?" },
  E_DUP: { it: "«{0}» esiste già (riga {1})", en: "'{0}' is already defined (line {1})" },
  E_BUILTIN_NAME: { it: "«{0}» è il nome di una funzione o costante di sistema: scegline un altro", en: "'{0}' is the name of a system function or constant: choose another one" },
  E_NOT_FUNC: { it: "«{0}» non è una funzione", en: "'{0}' is not a function" },
  E_NOT_ARRAY: { it: "«{0}» non è un array", en: "'{0}' is not an array" },
  E_IS_ARRAY: { it: "«{0}» è un array: indica la posizione, per esempio {0}[0]", en: "'{0}' is an array: give a position, e.g. {0}[0]" },
  E_IS_FUNC: { it: "«{0}» è una funzione: per chiamarla scrivi {0}(…)", en: "'{0}' is a function: to call it write {0}(…)" },
  E_ARGS: { it: "«{0}» vuole {1} argomenti, ne hai dati {2}", en: "'{0}' takes {1} arguments, you gave {2}" },
  E_ARGS_ONE: { it: "«{0}» vuole un argomento, ne hai dati {2}", en: "'{0}' takes one argument, you gave {2}" },
  E_CONST_ASSIGN: { it: "«{0}» è una costante e non si può cambiare", en: "'{0}' is a constant and cannot be changed" },
  E_NOT_CONST: { it: "Qui serve un valore costante, calcolabile prima della partita", en: "A constant value is needed here, computable before the match" },
  E_CONST_DIV0: { it: "Divisione per zero in una costante", en: "Division by zero in a constant" },
  E_ARRAY_SIZE: { it: "La dimensione di un array va da 1 a {0}", en: "Array size must be between 1 and {0}" },
  E_ARRAY_INIT: { it: "Un array non si può inizializzare con «=»: parte sempre con tutti zeri", en: "An array cannot be initialized with '=': it always starts as all zeros" },
  E_NO_MAIN: { it: "Manca la funzione «fn main()»: è da lì che parte il robot", en: "Missing 'fn main()': that's where the robot starts" },
  E_MAIN_PARAMS: { it: "main non deve avere parametri", en: "main must not have parameters" },
  E_BREAK: { it: "«break» si può usare solo dentro un ciclo", en: "'break' can only be used inside a loop" },
  E_CONTINUE: { it: "«continue» si può usare solo dentro un ciclo", en: "'continue' can only be used inside a loop" },
  E_CODE_SIZE: { it: "Programma troppo lungo per la classe {2}: {0} istruzioni, al massimo {1}", en: "Program too long for the {2} class: {0} instructions, at most {1}" },
  E_MEMORY: { it: "Troppe variabili per la classe {2}: {0} parole di memoria, al massimo {1}", en: "Too many variables for the {2} class: {0} memory words, at most {1}" },
  E_PRINT_EMPTY: { it: "print() vuole almeno un argomento", en: "print() needs at least one argument" },
  W_NO_VALUE: { it: "«{0}» non restituisce un valore utile (vale sempre 0)", en: "'{0}' does not return a useful value (always 0)" },
  W_UNUSED: { it: "La variabile «{0}» non viene mai letta", en: "Variable '{0}' is never read" },
  // execution
  R_DIV0: { it: "Divisione per zero", en: "Division by zero" },
  R_MOD0: { it: "Resto della divisione per zero (% 0)", en: "Remainder of division by zero (% 0)" },
  R_INDEX: { it: "Posizione {0} fuori dall'array (va da 0 a {1})", en: "Index {0} is outside the array (0 to {1})" },
  R_STACK: { it: "Memoria esaurita: troppe chiamate una dentro l'altra (ricorsione infinita?)", en: "Out of memory: too many nested calls (infinite recursion?)" },
  R_SQRT_NEG: { it: "Radice quadrata di un numero negativo ({0})", en: "Square root of a negative number ({0})" },
  R_RESTART: { it: "{0} alla riga {1}: il programma riparte da main()", en: "{0} at line {1}: the program restarts from main()" },
  R_HALT: { it: "main() è terminata: il robot non esegue più istruzioni", en: "main() has ended: the robot runs no more instructions" },
  // robot classes
  CLASS_micro: { it: "Micro", en: "Micro" },
  CLASS_mini: { it: "Mini", en: "Mini" },
  CLASS_standard: { it: "Standard", en: "Standard" },
  CLASS_unlimited: { it: "Illimitata", en: "Unlimited" },
  // symbol names for messages
  T_EOF: { it: "la fine del file", en: "the end of the file" },
  T_NUMBER: { it: "il numero {0}", en: "the number {0}" },
  T_IDENT: { it: "il nome «{0}»", en: "the name '{0}'" },
  T_STRING: { it: "un testo tra virgolette", en: "a quoted string" },
  T_SYMBOL: { it: "«{0}»", en: "'{0}'" },
};

/** Message argument: text, number or another message to translate. */
export type MsgArg = string | number | { code: string; args: MsgArg[] };

export function message(code: string, args: MsgArg[] = [], lang: Lang = "it"): string {
  const entry = MESSAGES[code];
  const text = (a: MsgArg | undefined): string =>
    a === undefined ? "" : typeof a === "object" ? message(a.code, a.args, lang) : String(a);
  if (!entry) return code + (args.length ? " " + args.map(text).join(", ") : "");
  return entry[lang].replace(/\{\{|\}\}|\{(\d+)\}/g, (m, i) =>
    m === "{{" ? "{" : m === "}}" ? "}" : text(args[Number(i)]));
}
