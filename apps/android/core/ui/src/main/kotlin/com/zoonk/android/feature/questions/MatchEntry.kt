package com.zoonk.android.feature.questions

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.AnswerTone
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.OptionKey
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.components.focusRing
import com.zoonk.android.ui.components.glyphScale
import com.zoonk.android.ui.components.keptWhole
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.components.optionKeysShown
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/**
 * Where a card is in its match. [Paired] is a pair held until Check; [Right] a pair checked and kept, as it locks and
 * on a finished board, where [Missed] is one whose left card first went with another; [Done] a locked pair once its cue
 * ends, quiet so the cards still to match stand out; [Wrong] a try that didn't go together while its cue shows; and
 * [Shown] a card shown with nothing to do, as a revealed board's.
 */
enum class MatchEntryState { Idle, Selected, Paired, Right, Done, Missed, Wrong, Shown }

/**
 * One side of a pair on every screen that asks to match these with those (main's `MatchEntry`). Its words start at the
 * card's top edge; its mark (the number key that picks it where a keyboard does, a pick's dot or that key in ink, a kept
 * pair's check, a wrong try's ✕, or a held pair's number, [pair] counted from one) sits level with the first line at the
 * end, in room every state keeps, so pairing moves no words. [place] is the card's place on the board, the left column
 * first, which names its key. [onClick] is null where the card can't be tapped. [label] is what TalkBack reads in place
 * of the words once the card is in a pair, such as "pregnant, matched with grávida", and [cue] restarts a wrong card's
 * shake for each new miss. A press gives way a little, as main's does, and leaves no tint, so both cards of a try show
 * its tone alike; its fill and words change color quickly, as main's do.
 */
@Composable
fun MatchEntry(
    state: MatchEntryState,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    place: Int? = null,
    pair: Int? = null,
    label: String? = null,
    cue: Int = 0,
    content: @Composable () -> Unit,
) {
    val tone = entryTone(state)
    // Every card sits on the page's color, so its tints look the same on an activity's panel as on the page.
    val colorChange = tween<Color>(ZoonkMotion.QUICK_MILLIS, easing = ZoonkMotion.EaseOut)
    val container by animateColorAsState(
        if (tone.container == Color.Transparent) MaterialTheme.colorScheme.surface else tone.container,
        colorChange,
        label = "fill",
    )
    val words by animateColorAsState(tone.contentColor, colorChange, label = "words")
    // Main's `pickKey`: 1 to 9, then 0 for the tenth; a card past it, done or unclickable has none.
    val key =
        place
            ?.takeIf { it < PICK_KEYS && onClick != null && optionKeysShown() }
            ?.takeIf { state == MatchEntryState.Idle || state == MatchEntryState.Selected }
            ?.let { (it + 1) % PICK_KEYS }
    val shape = RoundedCornerShape(ZoonkRadius.xl)
    val style = LocalMatchTextStyle.current ?: matchTextStyle(wide = false)
    val shake = remember { Animatable(0f) }
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val focused by interactions.collectIsFocusedAsState()
    val press by animateFloatAsState(if (pressed) PRESS_SCALE else 1f, label = "press")

    LaunchedEffect(state == MatchEntryState.Wrong, cue) {
        if (state == MatchEntryState.Wrong) {
            shake.snapTo(0f)
            shake.animateTo(
                0f,
                keyframes {
                    durationMillis = SHAKE_MILLIS
                    -4f at 80
                    4f at 160
                    -3f at 240
                    3f at 320
                },
            )
        }
    }

    Box(
        modifier
            .keptWhole()
            .graphicsLayer {
                translationX = shake.value * density
                scaleX = press
                scaleY = press
            }.focusRing(shape, MaterialTheme.colorScheme.primary) { focused }
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(container)
            .border(tone.border, shape)
            .then(
                if (onClick == null) {
                    Modifier.semantics(mergeDescendants = true) {}
                } else {
                    Modifier.selectable(
                        selected = state == MatchEntryState.Selected,
                        interactionSource = interactions,
                        indication = null,
                        role = Role.Button,
                        onClick = onClick,
                    )
                },
            ).semantics { label?.let { contentDescription = it } }
            .padding(horizontal = 12.dp, vertical = 13.dp),
        contentAlignment = Alignment.TopStart,
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // A card with a [label] is read by it alone, once, wherever TalkBack merges it.
            val spoken = if (label == null) Modifier else Modifier.clearAndSetSemantics {}
            Box(Modifier.weight(1f).then(spoken)) { ProvideTextStyle(style.copy(color = words)) { content() } }
            MarkSlot(style) {
                when {
                    key != null -> OptionKey(key, picked = state == MatchEntryState.Selected)
                    state == MatchEntryState.Selected -> PickMark()
                    state == MatchEntryState.Right -> DoneMark()
                    state == MatchEntryState.Done -> SettledMark(MaterialTheme.colorScheme.onSurfaceVariant)
                    state == MatchEntryState.Missed -> SettledMark(MaterialTheme.zoonk.destructive)
                    state == MatchEntryState.Wrong -> WrongMark()
                    state == MatchEntryState.Paired && pair != null -> PairNumber(pair)
                }
            }
        }
    }
}

/** The room at a card's end, one line tall, that its mark takes; it's there with no mark too. */
@Composable
private fun MarkSlot(
    style: TextStyle,
    content: @Composable () -> Unit,
) {
    val line = with(LocalDensity.current) { style.lineHeight.toDp() }
    Box(Modifier.size(MARK_WIDTH * glyphScale(), line), contentAlignment = Alignment.Center) { content() }
}

/**
 * A card's tone: a pick's soft fill, a try's tint and ring, the quiet fill and words of a pair already done, and a
 * finished pair that was first missed in the wrong tone, its check kept.
 */
@Composable
private fun entryTone(state: MatchEntryState): AnswerTone =
    when (state) {
        MatchEntryState.Done -> {
            AnswerTone(
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                container = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        else -> {
            answerTone(
                picked = state == MatchEntryState.Selected,
                result =
                    when (state) {
                        MatchEntryState.Right -> AnswerResult.Right
                        MatchEntryState.Wrong, MatchEntryState.Missed -> AnswerResult.Wrong
                        else -> null
                    },
            )
        }
    }

/** A pick's mark: an ink dot, as a radio's, so a picked card reads as chosen rather than dimmed. */
@Composable
private fun PickMark() {
    Box(Modifier.size(PICK_DOT * glyphScale()).background(MaterialTheme.colorScheme.onSurface, CircleShape))
}

/** The check of a pair already done, quieter than the one its pair locked with. */
@Composable
private fun SettledMark(tint: Color) {
    Icon(
        painterResource(R.drawable.ic_check),
        contentDescription = null,
        modifier = Modifier.size(markSize() * MARK_SHARE),
        tint = tint,
    )
}

@Composable
private fun WrongMark() {
    Icon(
        painterResource(R.drawable.ic_close),
        contentDescription = null,
        modifier = Modifier.size(markSize() * MARK_SHARE),
        tint = MaterialTheme.zoonk.destructive,
    )
}

/** A held pair's number, round so it never reads as a key. */
@Composable
private fun PairNumber(number: Int) {
    Box(
        Modifier.size(MARK_WIDTH * glyphScale()).background(MaterialTheme.colorScheme.onSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            number.toString(),
            color = MaterialTheme.colorScheme.surface,
            style =
                MaterialTheme.typography.labelSmall
                    .copy(fontFamily = GeistMono)
                    .withTabularFigures(),
        )
    }
}

/** A board's words: the app's body size on a phone, the reading size on a wide board, both on one 24 line. */
@Composable
internal fun matchTextStyle(wide: Boolean): TextStyle {
    val body = if (wide) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.bodyMedium
    return body.copy(fontWeight = FontWeight.Medium, lineHeight = MaterialTheme.typography.bodyLarge.lineHeight)
}

/** The board's text style, which every card on it takes; it changes with the board's width. */
internal val LocalMatchTextStyle = staticCompositionLocalOf<TextStyle?> { null }

private val MARK_WIDTH = 20.dp
private const val MARK_SHARE = 0.75f
private val PICK_DOT = 10.dp
private const val PICK_KEYS = 10

/** Main's `press` with `--press-scale: 0.99`. */
private const val PRESS_SCALE = 0.99f

/** Main's `animate-shake` (0.4 s); the wrong tone holds a beat longer ([WRONG_CUE_MILLIS]). */
private const val SHAKE_MILLIS = 400
