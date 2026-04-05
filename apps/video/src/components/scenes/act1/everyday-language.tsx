import { SceneContainer } from "@/components/scene-container";
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
 * "We explain hard things using stuff you already know."
 *
 * A grid of everyday icons (basketball, car, pizza, etc.) staggers in
 * below the text. The viewer instantly sees familiar objects — no thinking
 * required. This communicates the everyday-language value prop visually.
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
        {/* Explanatory text — visible immediately, no fade */}
        <span
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: COLORS.text,
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: 700,
          }}
        >
          We explain hard things using stuff you already know.
        </span>

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
            const delay = stagger({ index, baseDelay: 10, gap: 4 });
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
