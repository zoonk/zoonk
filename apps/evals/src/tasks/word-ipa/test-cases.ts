import { type TestCase } from "@/lib/types";
import { type WordIpaParams } from "@zoonk/ai/tasks/v2/language/word-ipa";

export type WordIpaExpected = { isLookAlike: boolean; native?: string; english?: string };

type WordIpaInput = Pick<WordIpaParams, "language" | "word">;

function getLanguage(id: string): string {
  const [language = ""] = id.split("-");
  return language;
}

function ipaCase(
  id: string,
  word: string,
  native: string,
  english: string | null,
): TestCase<WordIpaExpected, WordIpaInput> {
  return {
    expected: { isLookAlike: english !== null, native, ...(english ? { english } : {}) },
    id,
    userInput: { language: getLanguage(id), word },
  };
}

function lookAlikeCase(
  id: string,
  word: string,
  isLookAlike: boolean,
): TestCase<WordIpaExpected, WordIpaInput> {
  return { expected: { isLookAlike }, id, userInput: { language: getLanguage(id), word } };
}

export const TEST_CASES: TestCase<WordIpaExpected, WordIpaInput>[] = [
  ipaCase("de-name", "Name", "ˈnaːmə", "neɪm"),
  ipaCase("de-kind", "Kind", "kɪnt", "kaɪnd"),
  ipaCase("de-hand", "Hand", "hant", "hænd"),
  ipaCase("de-bank", "Bank", "baŋk", "bæŋk"),
  ipaCase("de-wind", "Wind", "vɪnt", "wɪnd"),
  ipaCase("nl-fruit", "fruit", "frœyt", "fruːt"),
  ipaCase("nl-boot", "boot", "boːt", "buːt"),
  ipaCase("nl-door", "door", "doːr", "dɔːr"),
  ipaCase("pt-charles", "Charles", "ˈʃaʁlis", "tʃɑːrlz"),
  ipaCase("pt-time", "time", "ˈtʃĩmi", "taɪm"),
  ipaCase("pt-mouse", "mouse", "ˈmawzi", "maʊs"),
  ipaCase("pt-hotel", "hotel", "oˈtɛw", "hoʊˈtɛl"),
  ipaCase("es-pie", "pie", "pje", "paɪ"),
  ipaCase("es-once", "once", "ˈonse", "wʌns"),
  ipaCase("es-come", "come", "ˈkome", "kʌm"),
  ipaCase("es-actual", "actual", "akˈtwal", "ˈæktʃuəl"),
  ipaCase("fr-pain", "pain", "pɛ̃", "peɪn"),
  ipaCase("fr-chat", "chat", "ʃa", "tʃæt"),
  ipaCase("fr-coin", "coin", "kwɛ̃", "kɔɪn"),
  ipaCase("fr-four", "four", "fuʁ", "fɔːr"),
  ipaCase("it-pane", "pane", "ˈpaːne", "peɪn"),
  ipaCase("it-case", "case", "ˈkaːse", "keɪs"),
  ipaCase("it-male", "male", "ˈmaːle", "meɪl"),
  ipaCase("de-schmetterling", "Schmetterling", "ˈʃmɛtɐlɪŋ", null),
  ipaCase("de-eichhoernchen", "Eichhörnchen", "ˈaɪçhœʁnçən", null),
  ipaCase("es-mariposa", "mariposa", "maɾiˈposa", null),
  ipaCase("es-ferrocarril", "ferrocarril", "ferokaˈril", null),
  ipaCase("fr-papillon", "papillon", "papijɔ̃", null),
  ipaCase("fr-grenouille", "grenouille", "ɡʁənuj", null),
  ipaCase("it-farfalla", "farfalla", "farˈfalla", null),
  ipaCase("pt-borboleta", "borboleta", "boʁboˈletɐ", null),
  ipaCase("nl-vlinder", "vlinder", "ˈvlɪndər", null),
  lookAlikeCase("de-gift", "Gift", true),
  lookAlikeCase("de-brief", "Brief", true),
  lookAlikeCase("de-rock", "Rock", true),
  lookAlikeCase("de-handy", "Handy", true),
  lookAlikeCase("de-computer", "Computer", true),
  lookAlikeCase("nl-water", "water", true),
  lookAlikeCase("nl-slim", "slim", true),
  lookAlikeCase("pt-real", "real", true),
  lookAlikeCase("pt-maria", "Maria", true),
  lookAlikeCase("es-pan", "pan", true),
  lookAlikeCase("es-son", "son", true),
  lookAlikeCase("es-cafe", "café", true),
  lookAlikeCase("fr-main", "main", true),
  lookAlikeCase("fr-paris", "Paris", true),
  lookAlikeCase("fr-cafe", "café", true),
  lookAlikeCase("it-camera", "camera", true),
  lookAlikeCase("it-dove", "dove", true),
  lookAlikeCase("it-cane", "cane", true),
  lookAlikeCase("pl-pan", "pan", true),
  lookAlikeCase("sv-barn", "barn", true),
  lookAlikeCase("sv-kiss", "kiss", true),
  lookAlikeCase("tr-on", "on", true),
  lookAlikeCase("id-air", "air", true),
  lookAlikeCase("ro-pace", "pace", true),
  lookAlikeCase("de-hund", "Hund", false),
  lookAlikeCase("de-haus", "Haus", false),
  lookAlikeCase("de-maedchen", "Mädchen", false),
  lookAlikeCase("de-broetchen", "Brötchen", false),
  lookAlikeCase("de-juergen", "Jürgen", false),
  lookAlikeCase("nl-fiets", "fiets", false),
  lookAlikeCase("nl-gezellig", "gezellig", false),
  lookAlikeCase("nl-kaas", "kaas", false),
  lookAlikeCase("pt-saudade", "saudade", false),
  lookAlikeCase("pt-janela", "janela", false),
  lookAlikeCase("pt-joao", "João", false),
  lookAlikeCase("es-perro", "perro", false),
  lookAlikeCase("es-ventana", "ventana", false),
  lookAlikeCase("es-futbol", "fútbol", false),
  lookAlikeCase("es-manana", "mañana", false),
  lookAlikeCase("fr-fenetre", "fenêtre", false),
  lookAlikeCase("fr-chien", "chien", false),
  lookAlikeCase("fr-maison", "maison", false),
  lookAlikeCase("fr-benoit", "Benoît", false),
  lookAlikeCase("it-biglietto", "biglietto", false),
  lookAlikeCase("it-gatto", "gatto", false),
  lookAlikeCase("it-strada", "strada", false),
  lookAlikeCase("pl-dziekuje", "dziękuję", false),
  lookAlikeCase("sv-fonster", "fönster", false),
  lookAlikeCase("tr-tesekkur", "teşekkür", false),
  lookAlikeCase("id-terima", "terima", false),
  lookAlikeCase("ro-fereastra", "fereastră", false),
];
