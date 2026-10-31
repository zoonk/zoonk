import { type TTSVoice } from "@zoonk/utils/languages";
import { seededShuffle } from "@zoonk/utils/seeded-random";

/** The clearest of Gemini's prebuilt voices of each gender (Google's voice list, 10 Oct 2026). */
const VOICES_BY_GENDER = {
  female: ["Kore", "Aoede", "Leda", "Despina", "Erinome", "Sulafat", "Autonoe", "Gacrux"],
  male: ["Puck", "Charon", "Orus", "Iapetus", "Achird", "Algieba", "Schedar", "Sadaltager"],
} as const satisfies Record<string, readonly TTSVoice[]>;

type VoiceGender = keyof typeof VOICES_BY_GENDER;

/**
 * Every speaker gets a different voice, so a listener tells them apart. The same `seed` always gets
 * the same voices, and two recordings don't all start with the same two.
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
