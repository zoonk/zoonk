import { type PublishedAlphabetLesson } from "@zoonk/ai/tasks/language/alphabet-lesson";

export type AlphabetCheckInput = {
  alphabet: PublishedAlphabetLesson;
  learnerLanguage: string;
  targetLanguage: string;
};

type Letter = PublishedAlphabetLesson["letters"][number];

function letter(
  symbol: string,
  readingAid: string,
  audioText: string,
  pronunciation: string,
): Letter {
  return { audioText, forms: [], pronunciation, readingAid, symbol };
}

/** `screen` is 1-based over the intro screens, then the letters, as the reviewer numbers them. */
function plantCue(
  base: AlphabetCheckInput,
  screen: number,
  pronunciation: string,
): AlphabetCheckInput {
  const index = screen - 1 - base.alphabet.intro.length;

  return {
    ...base,
    alphabet: {
      ...base.alphabet,
      letters: base.alphabet.letters.map((current, position) =>
        position === index ? { ...current, pronunciation } : current,
      ),
    },
  };
}

const cyrillic: AlphabetCheckInput = {
  alphabet: {
    canDo:
      "Leia e pronuncie в (v), н (n), р (r), с (s), у (u), х (kh), а (a), к (k), м (m) e о (o).",
    description: "Com estas letras, você já consegue ler сон (son), que significa “sono”.",
    intro: [
      {
        text: "No russo impresso, leia uma letra por vez, da esquerda para a direita. As letras não se ligam umas às outras.",
        title: "Leia da esquerda para a direita",
      },
      {
        text: "Algumas letras lembram letras latinas, mas têm outro som: В (v) parece B, Н (n) parece H e Р (r) parece P. Confie no som de cada cartão, não no desenho.",
        title: "Não confie só no formato",
      },
    ],
    letters: [
      letter("в", "v", "ва", "Como o v de “vida”; você ouvirá o som em ва (va)."),
      letter("н", "n", "на", "Como o n de “nada”; você ouvirá o som em на (na)."),
      letter(
        "р",
        "r",
        "ра",
        "Parecido com o r de “caro”, mas com a ponta da língua batendo várias vezes, um r rolado; você ouvirá o som em ра (ra).",
      ),
      letter("с", "s", "са", "Como o s de “sapo”; você ouvirá o som em са (sa)."),
      letter("у", "u", "у", "Como o u de “uva”, curto e sem deslizar."),
      letter(
        "х",
        "kh",
        "ха",
        "Parecido com o r de “rato”, mas mais áspero, raspando no fundo da boca; você ouvirá o som em ха (kha).",
      ),
      letter("а", "a", "а", "Como o a de “pá”; numa sílaba sem força, fica mais breve e fraco."),
      letter("к", "k", "ка", "Como o c de “casa”; você ouvirá o som em ка (ka)."),
      letter("м", "m", "ма", "Como o m de “mala”; você ouvirá o som em ма (ma)."),
      letter(
        "о",
        "o",
        "о",
        "Como o ô de “avô” quando a sílaba é forte; numa sílaba sem força, soa quase como a.",
      ),
    ],
    summary: [
      "Leia as letras russas da esquerda para a direita, uma por vez, pelo som de cada cartão.",
      "Várias letras parecem latinas, mas têm outro som: в é v, н é n, р é r, у é u e х é kh. Juntando с, о e н, você lê сон (son), “sono”.",
    ],
    title: "Suas primeiras letras russas",
  },
  learnerLanguage: "pt",
  targetLanguage: "ru",
};

const hangul: AlphabetCheckInput = {
  alphabet: {
    canDo: "Read and say ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ, ㄱ, ㄴ, ㅁ, and ㅅ.",
    description: "Read simple syllable blocks such as 가, 나, 마, and 사.",
    intro: [
      {
        text: "Korean letters join into square syllable blocks. Start with a consonant and vowel together: ㄱ (g) + ㅏ (a) makes 가 (ga).",
        title: "Read in blocks",
      },
      {
        text: "Read each block from left to right or from top to bottom. Vowels like ㅏ (a) sit beside a consonant, while vowels like ㅗ (o) sit below it; ㅇ (ng) is a silent placeholder at the start of a block.",
        title: "Find the vowel",
      },
    ],
    letters: [
      letter("ㅏ", "a", "아", "Like the a in “father,” short and pure; you’ll hear it as 아 (a)."),
      letter(
        "ㅓ",
        "eo",
        "어",
        "Closest to the u in “cup,” but keep it pure without the English glide; you’ll hear it as 어 (eo).",
      ),
      letter(
        "ㅗ",
        "o",
        "오",
        "Like the vowel in “go,” but hold it steady without the English glide; you’ll hear it as 오 (o).",
      ),
      letter("ㅜ", "u", "우", "Like the oo in “food,” held steady; you’ll hear it as 우 (u)."),
      letter(
        "ㅡ",
        "eu",
        "으",
        "English has no exact match: say “oo” with your lips unrounded and your tongue pulled back; you’ll hear it as 으 (eu).",
      ),
      letter("ㅣ", "i", "이", "Like the ee in “see,” held steady; you’ll hear it as 이 (i)."),
      letter(
        "ㄱ",
        "g",
        "가",
        "Between English k and g, with no puff of air; it can sound more voiced between voiced sounds. You’ll hear it as 가 (ga).",
      ),
      letter("ㄴ", "n", "나", "Like the n in “no”; you’ll hear it as 나 (na)."),
      letter("ㅁ", "m", "마", "Like the m in “mom”; you’ll hear it as 마 (ma)."),
      letter(
        "ㅅ",
        "s",
        "사",
        "Like the s in “sun”; before ㅣ it sounds closer to English sh. You’ll hear it as 사 (sa).",
      ),
    ],
    summary: [
      "Korean letters combine into syllable blocks, read from left to right and top to bottom.",
      "The six vowels each have a steady sound, and ㄱ, ㄴ, ㅁ, and ㅅ give you consonants to build simple blocks.",
    ],
    title: "Your First Hangul Letters",
  },
  learnerLanguage: "en",
  targetLanguage: "ko",
};

export const ALPHABET_LESSONS = { cyrillic, hangul };

export const ALPHABET_SLIPS = {
  /** Korean ㅡ is a high back unrounded vowel; the vowel of "book" is lower and lax. */
  bookVowel: plantCue(
    hangul,
    7,
    "Like the oo in “book,” but with your lips unrounded; you’ll hear it as 으 (eu).",
  ),
  /** The h of Portuguese "hora" is silent, so it can't place Russian х. */
  silentH: plantCue(
    cyrillic,
    8,
    "Não há esse som no português brasileiro padrão; faça uma fricção no fundo da boca, mais atrás que o h de “hora”. Você ouvirá o som em ха (kha).",
  ),
};
