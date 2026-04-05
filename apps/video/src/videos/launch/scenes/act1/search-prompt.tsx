import { SceneContainer } from "@/components/scene-container";
import { entryScale, stagger, typewriter } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { useT } from "../../use-translations";

const ITEM_HEIGHT = 44;
const ITEM_GAP = 8;
const INITIAL_VISIBLE = 3;

/** Search input sits at vertical center (540px - half of 72px). */
const INPUT_CENTER_Y = 504;

/** After typing, the input slides to this fixed Y position near the top. */
const INPUT_FINAL_Y = 160;

/** Chapter list starts below the input with a gap. */
const LIST_TOP = INPUT_FINAL_Y + 72 + 20;

/**
 * Continuous scene: search input types "quantum physics", then slides to
 * the top as chapters appear below it one by one.
 *
 * Phase 1: 3 chapters stagger in slowly. The viewer reads them for ~1.5s.
 * Phase 2: the remaining chapters cascade in rapidly, filling the screen
 * downward — communicating "a complete course was generated."
 */
export function SearchPrompt() {
  const frame = useCurrentFrame();
  const t = useT();

  const PLACEHOLDER = t.searchPlaceholder;
  const QUERY = t.searchQuery;

  const inputEntryStyle = entryScale({ frame, delay: 0, duration: 12 });

  const { visibleText, cursorOpacity } = typewriter({
    frame,
    text: QUERY,
    startFrame: 15,
    framesPerChar: 2,
  });

  const isTyping = visibleText.length > 0;
  const displayText = isTyping ? visibleText : PLACEHOLDER;
  const textColor = isTyping ? COLORS.text : COLORS.muted;

  const typingDone = 15 + QUERY.length * 2 + 8;
  const inputY = interpolate(
    frame,
    [typingDone, typingDone + 15],
    [INPUT_CENTER_Y, INPUT_FINAL_Y],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  /** Chapters become visible after the input has slid up. */
  const chaptersVisible = frame >= typingDone + 8;

  return (
    <SceneContainer bg="white">
      {/* Search input — slides from center to top, then stays */}
      <div
        style={{
          ...inputEntryStyle,
          position: "absolute",
          top: inputY,
          left: "50%",
          transform: `translateX(-50%) ${inputEntryStyle.transform}`,
          width: 700,
          height: 72,
          borderRadius: 36,
          border: `1.5px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 28,
          paddingRight: 28,
          backgroundColor: COLORS.white,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={COLORS.muted}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: 16, flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <span style={{ fontSize: 24, fontWeight: 400, color: textColor, letterSpacing: "0.01em" }}>
          {displayText}
        </span>

        <span
          style={{
            width: 2,
            height: 28,
            backgroundColor: COLORS.text,
            marginLeft: 2,
            opacity: cursorOpacity,
          }}
        />
      </div>

      {/* Chapters — appear below the input, filling downward */}
      {chaptersVisible && (
        <div
          style={{
            position: "absolute",
            top: LIST_TOP,
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            display: "flex",
            flexDirection: "column",
            gap: ITEM_GAP,
            paddingLeft: 28,
          }}
        >
          {t.chapters.map((title, index) => {
            const delay = stagger({ index, baseDelay: typingDone + 8, gap: 3 });
            const style = entryScale({ frame, delay });

            return (
              <div
                key={title}
                style={{
                  ...style,
                  height: ITEM_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: COLORS.muted,
                    width: 28,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    color: COLORS.text,
                    marginLeft: 12,
                  }}
                >
                  {title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SceneContainer>
  );
}
