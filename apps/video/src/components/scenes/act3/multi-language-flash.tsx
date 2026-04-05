import { SceneContainer } from "@/components/scene-container";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Sequence, useCurrentFrame } from "remotion";

const LANGUAGES = [
  {
    title: "Both at once",
    body: "Imagine throwing a ball through a doorway — but the ball also ripples like a wave.",
  },
  {
    title: "Ambos ao mesmo tempo",
    body: "Imagine jogar uma bola por uma porta — mas a bola também ondula como uma onda.",
  },
  {
    title: "Ambos a la vez",
    body: "Imagina lanzar una pelota por una puerta — pero la pelota también ondula como una ola.",
  },
] as const;

const FRAMES_PER_LANG = 30;

/**
 * The same content card flashing through three languages:
 * English -> Portuguese -> Spanish. Layout stays identical — only text changes.
 */
export function MultiLanguageFlash() {
  return (
    <SceneContainer bg="white">
      {LANGUAGES.map((lang, index) => (
        <Sequence
          key={lang.title}
          from={index * FRAMES_PER_LANG}
          durationInFrames={FRAMES_PER_LANG}
          layout="none"
        >
          <LanguageCard title={lang.title} body={lang.body} />
        </Sequence>
      ))}
    </SceneContainer>
  );
}

function LanguageCard({ title, body }: { title: string; body: string }) {
  const frame = useCurrentFrame();
  const style = entryScale({ frame, delay: 0, duration: 8 });

  return (
    <div style={style}>
      <div
        style={{
          width: 560,
          padding: "36px 40px",
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.white,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <h3
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: COLORS.text,
            margin: 0,
            marginBottom: 8,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 19,
            lineHeight: 1.7,
            color: COLORS.text,
            margin: 0,
            fontWeight: 400,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
