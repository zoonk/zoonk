package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import com.zoonk.android.ui.theme.LightTheme

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
 * Tab stop whose arrows move between keys; keys stay wide enough to press, so a narrow window scrolls them sideways, opening
 * on the marked keys. Without it the keyboard is a picture that [label] describes.
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
    val height = with(LocalDensity.current) { KEYBOARD_HEIGHT.toDp() }
    val roving = rememberRovingFocus(keys.size)
    val colors = pianoColors(MaterialTheme.colorScheme)

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier.fillMaxWidth()) {
            val width = if (onPress == null) maxWidth else max(maxWidth, PRESSABLE_WHITE_KEY * whiteCount)
            val whiteWidth = width / whiteCount
            val board =
                if (onPress == null) {
                    Modifier.clearAndSetSemantics { contentDescription = label }
                } else {
                    val marked = keys.filter { it.midi in marks }.map { it.center(whiteWidth) }
                    val opening = if (marked.isEmpty()) 0.dp else (marked.min() + marked.max()) / 2 - maxWidth / 2
                    val scroll = rememberScrollState(with(LocalDensity.current) { opening.roundToPx().coerceAtLeast(0) })

                    Modifier.horizontalScroll(scroll).semantics {
                        contentDescription = label
                        isTraversalGroup = true
                    }
                }

            Box(board) {
                Box(Modifier.width(width).height(height)) {
                    // White keys first, so the black keys sit on top of them.
                    keys.sortedBy { it.isBlack }.forEach { key ->
                        val index = keys.indexOf(key)
                        val keyWidth = if (key.isBlack) whiteWidth * BLACK_KEY_SHARE else whiteWidth
                        val left = if (key.isBlack) whiteWidth * key.whiteIndex - keyWidth / 2 else whiteWidth * key.whiteIndex
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
                            modifier = Modifier.offset(x = left).width(keyWidth).then(focus),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Key(
    key: PianoKey,
    mark: NoteMarkKind?,
    name: String,
    colors: PianoColors,
    isPressed: Boolean,
    enabled: Boolean,
    onPress: (() -> Unit)?,
    modifier: Modifier,
) {
    val press = onPress?.let { Modifier.toggleable(isPressed, enabled = enabled, role = Role.Checkbox) { it() } } ?: Modifier
    val shape =
        if (key.isBlack) {
            RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp)
        } else {
            RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp)
        }
    val surface =
        if (key.isBlack) {
            modifier
                .fillMaxHeight(BLACK_KEY_HEIGHT)
                .clip(shape)
                .then(press)
                .background(colors.black)
                .then(colors.blackBorder?.let { Modifier.border(1.dp, it, shape) } ?: Modifier)
        } else {
            modifier
                .fillMaxHeight()
                .clip(shape)
                .then(press)
                .background(colors.white)
                .border(1.dp, colors.whiteBorder, shape)
        }

    Box(surface.padding(bottom = if (key.isBlack) 6.dp else 8.dp), contentAlignment = Alignment.BottomCenter) {
        Box(Modifier.clearAndSetSemantics {}) {
            when {
                mark != null -> {
                    LightTheme { NoteMark(mark, name) }
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
)

private fun pianoColors(colors: ColorScheme): PianoColors {
    val isDark = colors.surface.luminance() < HALF

    return PianoColors(
        white = if (isDark) colors.primaryFixedDim else colors.surfaceContainerLowest,
        whiteBorder = colors.outline,
        black = colors.onPrimaryFixed,
        blackBorder = colors.outline.takeIf { isDark },
        label = colors.onPrimaryFixedVariant,
    )
}

private const val HALF = 0.5f
private const val BLACK_KEY_SHARE = 0.62f
private const val BLACK_KEY_HEIGHT = 0.6f
private val KEYBOARD_HEIGHT = 144.sp

/** Wide enough that a black key, at [BLACK_KEY_SHARE] of a white one, is still a 48dp target. */
private val PRESSABLE_WHITE_KEY: Dp = 78.dp
