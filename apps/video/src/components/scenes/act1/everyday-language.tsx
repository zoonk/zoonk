import { SceneContainer } from "@/components/scene-container";
import { WordReveal } from "@/components/word-reveal";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import {
  IconBallBasketball,
  IconBuildingStore,
  IconCar,
  IconCoffee,
  IconDeviceGamepad2,
  IconHanger,
  IconMusic,
  IconPizza,
  IconPlane,
  IconMovie,
} from "@tabler/icons-react";
import { useCurrentFrame } from "remotion";

const ICONS = [
  IconBallBasketball,
  IconCar,
  IconHanger,
  IconMusic,
  IconPizza,
  IconMovie,
  IconPlane,
  IconDeviceGamepad2,
  IconCoffee,
  IconBuildingStore,
];

/**
 * "We explain hard things" (instant)
 * → "using stuff you already know." (word by word)
 * → icons stagger in below.
 */
export function EverydayLanguage() {
  const frame = useCurrentFrame();

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 700, color: COLORS.text, textAlign: "center" }}>
            We explain hard things
          </span>
          <WordReveal
            text="using stuff you already know."
            startFrame={18}
            style={{ fontSize: 40, fontWeight: 400, color: COLORS.text, textAlign: "center", justifyContent: "center" }}
          />
        </div>

        {/* Icon grid — 2 rows of 5 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 28,
            maxWidth: 440,
          }}
        >
          {ICONS.map((Icon, index) => {
            const delay = stagger({ index, baseDelay: 55, gap: 3 });
            const style = entryScale({ frame, delay });

            return (
              <div key={index} style={style}>
                <Icon size={52} stroke={1.5} color={COLORS.text} />
              </div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}
