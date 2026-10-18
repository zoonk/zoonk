import { type TTSVoice } from "@zoonk/utils/languages";
import { seededShuffle } from "@zoonk/utils/seeded-random";

/**
 * Gemini's prebuilt voices that sound like a woman or a man, the clearest of each (Google's voice
 * list, checked 10 Oct 2026). Speakers in one recording get different voices, so a listener tells
 * them apart.
 */
const VOICES_BY_GENDER = {
  female: ["Kore", "Aoede", "Leda", "Despina", "Erinome", "Sulafat", "Autonoe", "Gacrux"],
  male: ["Puck", "Charon", "Orus", "Iapetus", "Achird", "Algieba", "Schedar", "Sadaltager"],
} as const satisfies Record<string, readonly TTSVoice[]>;

type VoiceGender = keyof typeof VOICES_BY_GENDER;

/**
 * Picks each speaker's voice by gender, different for every speaker of the recording, in an order
 * `seed` (the recording) fixes: the same script always gets the same voices, and two recordings
 * don't all start with the same two.
 */
export function assignListeningVoices<Speaker extends { gender: VoiceGender; name: string }>({
  seed,
  speakers,
}: {
  seed: string;
  speakers: readonly Speaker[];
}): (Speaker & { voice: TTSVoice })[] {
  const pools = {
    female: seededShuffle(VOICES_BY_GENDER.female, `${seed}:female`),
    male: seededShuffle(VOICES_BY_GENDER.male, `${seed}:male`),
  };

  return speakers.map((speaker, index) => {
    const pool = pools[speaker.gender];

    const sameGenderBefore = speakers
      .slice(0, index)
      .filter((other) => other.gender === speaker.gender);

    const voice = pool[sameGenderBefore.length % pool.length] ?? VOICES_BY_GENDER.female[0];

    return { ...speaker, voice };
  });
}
