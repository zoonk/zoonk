package com.zoonk.android.feature.questions

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.components.glyphScale
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/**
 * Where a card is in its match. [Paired] is a pair held until Check, [Right] a pair checked and kept, [Wrong] a try
 * that didn't go together while its cue shows, and [Shown] a card shown with nothing to do, as a revealed board's.
 */
enum class MatchEntryState { Idle, Selected, Paired, Right, Wrong, Shown }

/**
 * One side of a pair on every screen that asks to match these with those (main's `MatchEntry`). Its words start at the
 * card's edge; its mark (a kept pair's check, a wrong try's ✕, or a held pair's number, [pair] counted from one) sits
 * level with the first line at the end, in room every state keeps, so pairing moves no words. [onClick] is null where
 * the card can't be tapped. [label] is what TalkBack reads in place of the words once the card is in a pair, such as
 * "pregnant, matched with grávida", and [cue] restarts a wrong card's shake for each new miss.
 */
@Composable
fun MatchEntry(
    state: MatchEntryState,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    pair: Int? = null,
    label: String? = null,
    cue: Int = 0,
    content: @Composable () -> Unit,
) {
    val tone =
        answerTone(
            picked = state == MatchEntryState.Selected,
            result =
                when (state) {
                    MatchEntryState.Right -> AnswerResult.Right
                    MatchEntryState.Wrong -> AnswerResult.Wrong
                    else -> null
                },
        )
    // Every card sits on the page's color, so its tints look the same on an activity's panel as on the page.
    val container = if (tone.container == Color.Transparent) MaterialTheme.colorScheme.surface else tone.container
    val shape = RoundedCornerShape(ZoonkRadius.xl)
    val style = LocalMatchTextStyle.current ?: matchTextStyle(wide = false)
    val shake = remember { Animatable(0f) }

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
            .graphicsLayer { translationX = shake.value * density }
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(container)
            .border(tone.border, shape)
            .then(
                if (onClick == null) {
                    Modifier.semantics(mergeDescendants = true) {}
                } else {
                    Modifier.selectable(selected = state == MatchEntryState.Selected, role = Role.Button, onClick = onClick)
                },
            ).semantics { label?.let { contentDescription = it } }
            .padding(horizontal = 12.dp, vertical = 13.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // A card with a [label] is read by it alone, once, wherever TalkBack merges it.
            val words = if (label == null) Modifier else Modifier.clearAndSetSemantics {}
            Box(Modifier.weight(1f).then(words)) { ProvideTextStyle(style.copy(color = tone.contentColor)) { content() } }
            MarkSlot(style) {
                when {
                    state == MatchEntryState.Right -> DoneMark()
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

/** Main's `animate-shake` (0.4 s); the wrong tone holds a beat longer ([WRONG_CUE_MILLIS]). */
private const val SHAKE_MILLIS = 400
