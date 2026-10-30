package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.coerceIn
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import com.zoonk.android.ui.components.fadingHorizontalScroll

private class PianoKey(
    val midi: Int,
    val isBlack: Boolean,
    val whiteIndex: Int,
)

private fun PianoKey.center(whiteWidth: Dp): Dp = if (isBlack) whiteWidth * whiteIndex else whiteWidth * (whiteIndex + HALF)

private fun layoutKeys(
    from: Int,
    to: Int,
): List<PianoKey> =
    (from..to).map { midi ->
        PianoKey(midi, MusicNotes.isBlackKey(midi), whiteIndex = (from until midi).count { !MusicNotes.isBlackKey(it) })
    }

/**
 * Main's `PianoKeyboard`, low notes on the left in every language. With [onPress] each key toggles and the keyboard is one
 * Tab stop whose arrows move between keys; keys stay wide enough to press, narrowing only so the keys it opens marked
 * all fit, and a narrow window scrolls them sideways, opening on the marked keys. Without it the keyboard is a picture
 * that [label] describes.
 */
@Composable
internal fun PianoKeyboard(
    label: String,
    marks: Map<Int, NoteMarkKind>,
    nameOf: (Int) -> String,
    spokenNameOf: (Int) -> String,
    isPressed: (Int) -> Boolean,
    onPress: ((Int) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    from: Int = KeyboardFretboard.KEYBOARD_FROM,
    to: Int = KeyboardFretboard.KEYBOARD_TO,
) {
    val keys = layoutKeys(from, to)
    val whiteCount = keys.count { !it.isBlack }
    val openingMarks = remember { marks.keys }
    val height = with(LocalDensity.current) { KEYBOARD_HEIGHT.toDp() }
    val roving = rememberRovingFocus(keys.size)
    val colors = pianoColors(MaterialTheme.colorScheme)

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier.fillMaxWidth()) {
            val fitted = maxWidth / whiteCount
            val whiteWidth = onPress?.let { max(fitted, pressableWhiteKey(maxWidth, keys, openingMarks)) } ?: fitted
            val width = whiteWidth * whiteCount
            val board =
                if (onPress == null) {
                    Modifier.clearAndSetSemantics { contentDescription = label }
                } else {
                    val marked = keys.filter { it.midi in marks }.map { it.center(whiteWidth) }
                    val opening = if (marked.isEmpty()) 0.dp else (marked.min() + marked.max()) / 2 - maxWidth / 2
                    val scroll = rememberScrollState(with(LocalDensity.current) { opening.roundToPx().coerceAtLeast(0) })

                    Modifier.fadingHorizontalScroll(scroll).semantics {
                        contentDescription = label
                        isTraversalGroup = true
                    }
                }

            Box(board) {
                Box(Modifier.width(width).height(height)) {
                    // White keys first, so the black keys sit on top of them.
                    keys.sortedBy { it.isBlack }.forEach { key ->
                        val index = keys.indexOf(key)
                        val drawnWidth = if (key.isBlack) whiteWidth * BLACK_KEY_SHARE else whiteWidth
                        val touchWidth = if (key.isBlack) max(drawnWidth, MIN_TARGET) else drawnWidth
                        val left = if (key.isBlack) whiteWidth * key.whiteIndex - touchWidth / 2 else whiteWidth * key.whiteIndex
                        val focus =
                            onPress?.let {
                                Modifier.rovingFocus(roving, index).semantics {
                                    contentDescription = spokenNameOf(key.midi)
                                    traversalIndex = index.toFloat()
                                }
                            } ?: Modifier

                        Key(
                            key = key,
                            mark = marks[key.midi],
                            name = nameOf(key.midi),
                            colors = colors,
                            isPressed = isPressed(key.midi),
                            enabled = enabled,
                            onPress = onPress?.let { { it(key.midi) } },
                            drawnWidth = drawnWidth,
                            modifier = Modifier.offset(x = left).width(touchWidth).then(focus),
                        )
                    }
                }
            }
        }
    }
}

/** A black key drawn narrower than a 48dp target still takes taps across 48dp, centered on it, over the white keys beside it. */
@Composable
private fun Key(
    key: PianoKey,
    mark: NoteMarkKind?,
    name: String,
    colors: PianoColors,
    isPressed: Boolean,
    enabled: Boolean,
    onPress: (() -> Unit)?,
    drawnWidth: Dp,
    modifier: Modifier,
) {
    val interactions = remember { MutableInteractionSource() }
    val press =
        onPress?.let {
            Modifier.toggleable(isPressed, interactions, indication = null, enabled = enabled, role = Role.Checkbox) { it() }
        } ?: Modifier
    val shape =
        if (key.isBlack) {
            RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp)
        } else {
            RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp)
        }
    val surface =
        Modifier
            .width(drawnWidth)
            .fillMaxHeight()
            .clip(shape)
            .indication(interactions, ripple())
            .then(
                if (key.isBlack) {
                    Modifier.background(colors.black).then(colors.blackBorder?.let { Modifier.border(1.dp, it, shape) } ?: Modifier)
                } else {
                    Modifier.background(colors.white).border(1.dp, colors.whiteBorder, shape)
                },
            )

    Box(modifier.fillMaxHeight(if (key.isBlack) BLACK_KEY_HEIGHT else 1f).then(press), contentAlignment = Alignment.TopCenter) {
        Box(surface.padding(bottom = if (key.isBlack) 6.dp else 8.dp), contentAlignment = Alignment.BottomCenter) {
            Box(Modifier.clearAndSetSemantics {}) {
                when {
                    mark != null -> {
                        val ring = colors.markRing
                        NoteMark(mark, name, Modifier.drawBehind { drawCircle(ring, size.minDimension / 2 + MARK_RING.toPx()) })
                    }

                    key.midi % MusicNotes.OCTAVE == 0 -> {
                        Text(
                            name,
                            color = colors.label,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        )
                    }
                }
            }
        }
    }
}

/**
 * A piano keeps its look in dark theme, as main's does: the white keys turn a soft light gray so they don't glare and the
 * black keys stay black, from the theme's fixed roles, which are the same in light and dark.
 */
private class PianoColors(
    val white: Color,
    val whiteBorder: Color,
    val black: Color,
    val blackBorder: Color?,
    val label: Color,
    /** Keys keep their shade in dark theme, so a ring in the screen's color sets a mark off a key of its shade. */
    val markRing: Color,
)

private fun pianoColors(colors: ColorScheme): PianoColors {
    val isDark = colors.surface.luminance() < HALF

    return PianoColors(
        white = if (isDark) colors.primaryFixedDim else colors.surfaceContainerLowest,
        whiteBorder = colors.outline,
        black = colors.onPrimaryFixed,
        blackBorder = colors.outline.takeIf { isDark },
        label = colors.onPrimaryFixedVariant,
        markRing = colors.surface,
    )
}

private const val HALF = 0.5f
private const val BLACK_KEY_SHARE = 0.62f
private const val BLACK_KEY_HEIGHT = 0.6f
private val KEYBOARD_HEIGHT = 144.sp
private val MARK_RING = 2.dp

/** Wide enough that a black key, at [BLACK_KEY_SHARE] of a white one, is still a 48dp target. */
private val PRESSABLE_WHITE_KEY: Dp = 78.dp

private val MIN_TARGET: Dp = 48.dp

private fun pressableWhiteKey(
    window: Dp,
    keys: List<PianoKey>,
    marked: Set<Int>,
): Dp {
    val centers = keys.filter { it.midi in marked }.map { it.center(1.dp).value }
    if (centers.isEmpty()) return PRESSABLE_WHITE_KEY
    return (window / (centers.max() - centers.min() + 1)).coerceIn(MIN_TARGET, PRESSABLE_WHITE_KEY)
}
