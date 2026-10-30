package com.zoonk.android.feature.activities.sorting

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.Hyphens
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReason
import com.zoonk.android.feature.activities.ActivityReasons
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf27Value as MatchPairsContent

val matchPairsRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_match_pairs, R.drawable.ic_link) },
        canvas = { MatchPairsActivity(it) },
    )

private enum class CardState { Idle, Selected, Matched, Missed, NoMatch }

private data class Miss(
    val left: String,
    val right: String,
    val explanation: String?,
)

@Composable
private fun MatchPairsActivity(props: ActivityProps) {
    val fields = (props.content as MatchPairsContent).value.fields
    val (left, right) = remember(fields) { arrangeMatchColumns(fields) }
    val pairIds = fields.pairs.map { it.id }
    var progress by rememberSaveable(stateSaver = MatchProgressSaver) { mutableStateOf(progressFromAnswer(props.answer.assignmentPairs)) }
    var selectedLeft by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedRight by rememberSaveable { mutableStateOf<String?>(null) }
    var miss by remember { mutableStateOf<Miss?>(null) }
    var announcement by remember { mutableStateOf("") }
    val resources = LocalResources.current
    val isComplete = progress.matched.size == pairIds.size
    val expected = props.expected.assignmentPairs.takeIf { props.isChecked }

    fun tryPair(
        leftCard: MatchCard,
        rightCard: MatchCard,
    ) {
        val next = progress.recordTry(leftCard, rightCard)
        progress = next
        selectedLeft = null
        selectedRight = null
        props.onAnswerChange(matchAnswer(pairIds, next))

        if (isMatch(leftCard, rightCard)) {
            miss = null
            announcement =
                resources.getString(
                    R.string.activities_sorting_matched,
                    leftCard.text,
                    rightCard.text,
                    next.matched.size,
                    pairIds.size,
                )
            return
        }

        val (reason, trap) = explainMismatch(leftCard, rightCard)
        val explanation =
            listOfNotNull(trap?.let { resources.getString(R.string.activities_sorting_no_match_note, it.text) }, reason)
                .joinToString(" ")
                .ifEmpty { null }
        miss = Miss(leftCard.id, rightCard.id, explanation)
        announcement =
            listOfNotNull(resources.getString(R.string.activities_sorting_dont_go_together, leftCard.text, rightCard.text), explanation)
                .joinToString(" ")
    }

    fun pick(
        side: MatchSide,
        card: MatchCard,
    ) {
        if (props.isLocked) return
        miss = null
        val nextLeft = if (side == MatchSide.Left) card.id.takeUnless { it == selectedLeft } else selectedLeft
        val nextRight = if (side == MatchSide.Right) card.id.takeUnless { it == selectedRight } else selectedRight
        val leftCard = left.firstOrNull { it.id == nextLeft }
        val rightCard = right.firstOrNull { it.id == nextRight }
        if (leftCard != null && rightCard != null) {
            tryPair(leftCard, rightCard)
        } else {
            selectedLeft = nextLeft
            selectedRight = nextRight
        }
    }

    fun stateOf(
        card: MatchCard,
        side: MatchSide,
    ): CardState =
        when {
            !card.isTrap && card.id in progress.matched -> CardState.Matched
            card.isTrap && (isComplete || card.id in progress.traps) -> CardState.NoMatch
            (if (side == MatchSide.Left) miss?.left else miss?.right) == card.id -> CardState.Missed
            (if (side == MatchSide.Left) selectedLeft else selectedRight) == card.id -> CardState.Selected
            else -> CardState.Idle
        }

    Box {
        ActivityCanvas(gap = 16.dp) {
            val traps = fields.distractors.size
            Text(
                listOfNotNull(
                    stringResource(R.string.activities_sorting_pairs_matched, progress.matched.size, pairIds.size),
                    if (traps > 0) pluralStringResource(R.plurals.activities_sorting_cards_without_match, traps, traps) else null,
                ).joinToString(" · "),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )

            val cardsLabel = stringResource(R.string.activities_sorting_cards_to_match)
            Row(Modifier.semantics { contentDescription = cardsLabel }, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(MatchSide.Left to left, MatchSide.Right to right).forEach { (side, cards) ->
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        cards.forEach { card ->
                            val state = stateOf(card, side)
                            MatchCardButton(
                                card = card,
                                state = state,
                                enabled = !props.isChecked && !props.isLocked && state != CardState.Matched && state != CardState.NoMatch,
                                missKey = miss,
                                onPick = { pick(side, card) },
                            )
                        }
                    }
                }
            }

            miss?.let { MissNote(it.explanation) }
            if (expected != null) MatchPairsResults(left, right, expected, progress.firstTries)
        }
        ActivityAnnouncement(announcement)
    }
}

@Composable
private fun MatchCardButton(
    card: MatchCard,
    state: CardState,
    enabled: Boolean,
    missKey: Miss?,
    onPick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    val shake = remember { Animatable(0f) }
    val label =
        when (state) {
            CardState.Matched -> stringResource(R.string.activities_sorting_card_matched, card.text)
            CardState.NoMatch -> stringResource(R.string.activities_sorting_card_no_match, card.text)
            else -> null
        }
    val (border, container) =
        when (state) {
            CardState.Idle -> BorderStroke(1.dp, colors.outline) to colors.surface
            CardState.Selected -> answerTone(picked = true, result = null).let { it.border to it.container }
            CardState.Matched -> answerTone(picked = false, result = AnswerResult.Right).let { it.border to it.container }
            CardState.Missed -> BorderStroke(2.dp, colors.error) to colors.errorContainer
            CardState.NoMatch -> null to Color.Transparent
        }

    LaunchedEffect(state == CardState.Missed, missKey) {
        if (state ==
            CardState.Missed
        ) {
            shake.animateTo(
                0f,
                keyframes {
                    durationMillis = SHAKE_MILLIS
                    -4f at 60
                    4f at 120
                    -3f at 180
                    2f at 240
                },
            )
        }
    }

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .graphicsLayer { translationX = shake.value * density }
            .clip(shape)
            .background(container)
            .then(if (border == null) Modifier.dashedOutline(colors.outline) else Modifier.border(border, shape))
            .selectable(selected = state == CardState.Selected, enabled = enabled, role = Role.Button, onClick = onPick)
            .then(if (label == null) Modifier else Modifier.semantics { contentDescription = label })
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RichText(
            card.text,
            Modifier.weight(1f),
            style =
                MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Medium,
                    hyphens = Hyphens.Auto,
                    lineBreak = LineBreak.Paragraph,
                    color =
                        when (state) {
                            CardState.Matched -> colors.onTertiaryContainer
                            CardState.NoMatch -> colors.onSurfaceVariant
                            else -> colors.onSurface
                        },
                ),
        )
        when (state) {
            CardState.Matched -> CardIcon(R.drawable.ic_check, colors.onTertiaryContainer)
            CardState.Missed -> CardIcon(R.drawable.ic_close, colors.error)
            else -> Unit
        }
    }
}

@Composable
private fun CardIcon(
    icon: Int,
    tint: Color,
) {
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(16.dp), tint = tint)
}

@Composable
private fun MissNote(explanation: String?) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.errorContainer, shape)
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LineMarker(MaterialTheme.typography.bodyMedium) {
            Icon(
                painterResource(R.drawable.ic_cancel),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                stringResource(R.string.activities_sorting_not_quite),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            )
            if (explanation != null) {
                RichText(explanation, style = MaterialTheme.typography.bodyMedium)
            } else {
                Text(stringResource(R.string.activities_sorting_dont_go_together_short), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun MatchPairsResults(
    left: List<MatchCard>,
    right: List<MatchCard>,
    expected: Map<String, String>,
    firstTries: Map<String, String>,
) {
    val missed = left.filter { !it.isTrap && firstTries[it.id] != expected[it.id] }
    val traps = (left + right).filter { it.isTrap }
    val textOf = { id: String? -> right.firstOrNull { it.id == id }?.text.orEmpty() }

    if (missed.isNotEmpty()) {
        ResultsSection(stringResource(R.string.activities_sorting_missed_first_try)) {
            missed.forEach { card ->
                ActivityReason(card.why) {
                    Text(
                        stringResource(
                            R.string.activities_sorting_goes_with,
                            card.text,
                            textOf(expected[card.id]),
                            textOf(firstTries[card.id]),
                        ),
                    )
                }
            }
        }
    }
    if (traps.isNotEmpty()) {
        ResultsSection(stringResource(R.string.activities_sorting_look_alikes)) {
            traps.forEach { card -> ActivityReason(card.why) { RichText(card.text) } }
        }
    }
}

@Composable
private fun ResultsSection(
    title: String,
    reasons: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
        ActivityReasons { reasons() }
    }
}

private val MatchProgressSaver =
    androidx.compose.runtime.saveable.listSaver<MatchProgress, ArrayList<String>>(
        save = {
            listOf(
                ArrayList(
                    it.firstTries.flatMap { (key, value) ->
                        listOf(key, value)
                    },
                ),
                ArrayList(it.matched),
                ArrayList(it.traps),
            )
        },
        restore = { (tries, matched, traps) -> MatchProgress(tries.chunked(2).associate { (key, value) -> key to value }, matched, traps) },
    )

private const val SHAKE_MILLIS = 300
