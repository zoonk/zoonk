package com.zoonk.android.feature.questions

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.withTabularFigures

/**
 * Where a card is in its match. [Paired] is a pair held until Check, [Right] a pair checked and kept, [Wrong] a try
 * that didn't go together while its cue shows, [Missed] a pair the learner got wrong first, shown solved after the
 * board ends, and [Shown] a card shown with nothing to do, as a revealed board's.
 */
enum class MatchEntryState { Idle, Selected, Paired, Right, Wrong, Missed, Shown }

/**
 * One side of a pair on every screen that asks to match these with those (main's `MatchEntry`). The words start at the
 * card's edge and nothing moves them: a kept pair's check or a held pair's number ([pair], counted from one) sits on
 * the card's corner, over its line. [onClick] is null where the card can't be tapped. [partner] is what TalkBack adds
 * to the card's words, such as "Matched with Tuesday", and [cue] restarts a wrong card's shake for each new miss.
 */
@Composable
fun MatchEntry(
    state: MatchEntryState,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    pair: Int? = null,
    partner: String? = null,
    cue: Int = 0,
    content: @Composable () -> Unit,
) {
    val tone =
        answerTone(
            picked = state == MatchEntryState.Selected,
            result =
                when (state) {
                    MatchEntryState.Right -> AnswerResult.Right
                    MatchEntryState.Wrong, MatchEntryState.Missed -> AnswerResult.Wrong
                    else -> null
                },
        )
    // A card without a verdict or a pick sits on the page's color, so it reads as a card on an activity's panel too.
    val container = if (tone.container == Color.Transparent) MaterialTheme.colorScheme.surface else tone.container
    val shape = RoundedCornerShape(ZoonkRadius.option)
    val shake = remember { Animatable(0f) }

    LaunchedEffect(state == MatchEntryState.Wrong, cue) {
        if (state == MatchEntryState.Wrong) {
            shake.snapTo(0f)
            shake.animateTo(
                0f,
                keyframes {
                    durationMillis = WRONG_CUE_MILLIS.toInt()
                    -4f at 80
                    4f at 160
                    -3f at 240
                    3f at 320
                },
            )
        }
    }

    // The card takes the size its board gives it (a column's width, a row's height); its mark sits on top.
    Box(modifier.graphicsLayer { translationX = shake.value * density }, propagateMinConstraints = true) {
        Box(
            Modifier
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
                ).semantics { partner?.let { stateDescription = it } }
                .padding(12.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            ProvideTextStyle(MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium, color = tone.contentColor)) {
                content()
            }
        }
        when {
            state == MatchEntryState.Right -> CornerMark(right = true) { CheckGlyph() }
            state == MatchEntryState.Paired && pair != null -> CornerMark(right = false) { PairNumber(pair) }
        }
    }
}

/** What TalkBack adds to a card in a pair: its partner, and whether the learner missed it first. */
@Composable
fun matchPartnerWords(
    state: MatchEntryState,
    other: String,
): String =
    when (state) {
        MatchEntryState.Missed -> stringResource(R.string.questions_match_missed_partner, other)
        MatchEntryState.Shown -> stringResource(R.string.questions_match_goes_with, other)
        else -> stringResource(R.string.questions_match_partner, other)
    }

/** A round mark pinned over the card's top end corner, so it never takes room from the words. */
@Composable
private fun CornerMark(
    right: Boolean,
    content: @Composable () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    Box(Modifier.wrapContentSize(Alignment.TopEnd)) {
        Box(
            Modifier
                .offset(x = MARK_OVERHANG, y = -MARK_OVERHANG)
                .size(MARK_SIZE)
                .clearAndSetSemantics {}
                .background(if (right) colors.tertiary else colors.onSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) { content() }
    }
}

@Composable
private fun CheckGlyph() {
    Icon(painterResource(R.drawable.ic_check), contentDescription = null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onTertiary)
}

@Composable
private fun PairNumber(number: Int) {
    Text(
        number.toString(),
        color = MaterialTheme.colorScheme.surface,
        style = MaterialTheme.typography.labelSmall.withTabularFigures(),
    )
}

private val MARK_SIZE = 20.dp
private val MARK_OVERHANG = 6.dp
