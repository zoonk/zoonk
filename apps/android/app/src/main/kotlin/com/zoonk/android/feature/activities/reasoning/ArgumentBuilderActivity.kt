package com.zoonk.android.feature.activities.reasoning

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityDragDrop
import com.zoonk.android.feature.activities.ActivityDragDropState
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.activityDraggable
import com.zoonk.android.feature.activities.activityDropTarget
import com.zoonk.android.feature.activities.rememberActivityDragDrop
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.feature.activities.selectionAnswer
import com.zoonk.android.feature.activities.selectionIds
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf28Value as ArgumentBuilderContent

val argumentBuilderRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_reasoning_badge_build_argument, R.drawable.ic_extension) },
        canvas = { ArgumentBuilderActivity(it) },
    )

private enum class ArgumentPart { Evidence, Reasoning }

@Composable
private fun ArgumentBuilderActivity(props: ActivityProps) {
    val fields = (props.content as ArgumentBuilderContent).value.fields
    val answered = props.answer.selectionIds.orEmpty()
    var evidenceId by rememberSaveable { mutableStateOf(fields.evidence.find { it.id in answered }?.id) }
    var reasoningId by rememberSaveable { mutableStateOf(fields.reasoning.find { it.id in answered }?.id) }
    val quotes = remember(fields) { seededShuffle(fields.evidence, "evidence ${fields.claim}") }
    val lines = remember(fields) { seededShuffle(fields.reasoning, "reasoning ${fields.claim}") }
    val quote = fields.evidence.find { it.id == evidenceId }
    val line = fields.reasoning.find { it.id == reasoningId }
    val strongIds = props.expected.selectionIds
    val editable = !props.isChecked && !props.isLocked
    val openPart =
        when {
            props.isChecked -> null
            quote == null -> ArgumentPart.Evidence
            line == null -> ArgumentPart.Reasoning
            else -> null
        }
    val resources = LocalResources.current
    var announcement by remember { mutableStateOf("") }
    val next = remember { FocusRequester() }
    var moves by remember { mutableIntStateOf(0) }

    LaunchedEffect(moves) { if (moves > 0) next.requestFocus() }

    fun update(
        evidence: String?,
        reasoning: String?,
    ) {
        evidenceId = evidence
        reasoningId = reasoning
        props.onAnswerChange(if (evidence != null && reasoning != null) selectionAnswer(listOf(evidence, reasoning)) else null)
        moves++
    }

    fun choose(id: String) {
        when (openPart) {
            ArgumentPart.Evidence -> {
                fields.evidence.find { it.id == id }?.let {
                    update(it.id, reasoningId)
                    val quoted = resources.getString(R.string.activities_reasoning_quote, it.quote)
                    announcement = resources.getString(R.string.activities_reasoning_evidence_chosen, quoted)
                }
            }

            ArgumentPart.Reasoning -> {
                fields.reasoning.find { it.id == id }?.let {
                    update(evidenceId, it.id)
                    announcement = resources.getString(R.string.activities_reasoning_reasoning_chosen, it.text)
                }
            }

            null -> {}
        }
    }

    fun resultOf(id: String?): AnswerResult? =
        when {
            strongIds == null || id == null -> null
            id in strongIds -> AnswerResult.Right
            else -> AnswerResult.Wrong
        }

    val drag = rememberActivityDragDrop { itemId, part -> if (editable && part == openPart?.name) choose(itemId) }

    ActivityCanvas(gap = 16.dp) {
        ActivityDragDrop(drag) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Claim(fields.claim)
                    ArgumentSlot(
                        part = ArgumentPart.Evidence,
                        drag = drag,
                        label = stringResource(R.string.activities_reasoning_evidence),
                        hint = stringResource(R.string.activities_reasoning_evidence_hint),
                        isOpen = openPart == ArgumentPart.Evidence,
                        isFilled = quote != null,
                        result = resultOf(quote?.id),
                        clearLabel = stringResource(R.string.activities_reasoning_take_quote_out),
                        onClear = if (editable && quote != null) ({ update(null, reasoningId) }) else null,
                    ) {
                        quote?.let {
                            QuoteText(it.quote, it.citation)
                            if (props.isChecked) Why(it.why)
                        }
                    }
                    ArgumentSlot(
                        part = ArgumentPart.Reasoning,
                        drag = drag,
                        label = stringResource(R.string.activities_reasoning_reasoning),
                        hint =
                            stringResource(
                                if (openPart == ArgumentPart.Reasoning) {
                                    R.string.activities_reasoning_reasoning_hint
                                } else {
                                    R.string.activities_reasoning_reasoning_next
                                },
                            ),
                        isOpen = openPart == ArgumentPart.Reasoning,
                        isFilled = line != null,
                        result = resultOf(line?.id),
                        clearLabel = stringResource(R.string.activities_reasoning_take_reasoning_out),
                        onClear = if (editable && line != null) ({ update(evidenceId, null) }) else null,
                        clearFocus = next.takeIf { openPart == null },
                    ) {
                        line?.let {
                            ReasoningText(it.text)
                            if (props.isChecked) Why(it.why)
                        }
                    }
                }

                when (openPart) {
                    ArgumentPart.Evidence -> {
                        Candidates(stringResource(R.string.activities_reasoning_quotes)) {
                            val action = stringResource(R.string.activities_reasoning_use_as_evidence)
                            quotes.forEachIndexed { index, item ->
                                Candidate(
                                    item.id,
                                    action,
                                    drag,
                                    editable,
                                    next.takeIf { index == 0 },
                                    MaterialTheme.typography.bodyLarge,
                                    onClick = { choose(item.id) },
                                ) {
                                    QuoteText(item.quote, item.citation)
                                }
                            }
                        }
                    }

                    ArgumentPart.Reasoning -> {
                        Candidates(stringResource(R.string.activities_reasoning_reasoning)) {
                            val action = stringResource(R.string.activities_reasoning_use_as_reasoning)
                            lines.forEachIndexed { index, item ->
                                Candidate(
                                    item.id,
                                    action,
                                    drag,
                                    editable,
                                    next.takeIf { index == 0 },
                                    MaterialTheme.typography.bodyMedium,
                                    onClick = { choose(item.id) },
                                ) {
                                    ReasoningText(item.text)
                                }
                            }
                        }
                    }

                    null -> {
                        if (!props.isChecked) {
                            Text(
                                stringResource(R.string.activities_reasoning_argument_ready),
                                Modifier.fillMaxWidth(),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                    }
                }
            }
        }

        if (props.isChecked && strongIds != null) {
            fields.evidence.find { it.id in strongIds && it.id != quote?.id }?.let {
                Stronger(stringResource(R.string.activities_reasoning_stronger_evidence)) {
                    QuoteText(it.quote, it.citation)
                    Why(it.why)
                }
            }
            fields.reasoning.find { it.id in strongIds && it.id != line?.id }?.let {
                Stronger(stringResource(R.string.activities_reasoning_stronger_reasoning)) {
                    ReasoningText(it.text)
                    Why(it.why)
                }
            }
        }
        ActivityAnnouncement(if (props.isChecked) "" else announcement)
    }
}

@Composable
private fun Claim(claim: String) {
    val accent = MaterialTheme.zoonk.vizAccent
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CORNER))
            .background(accent.copy(alpha = SOFT))
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            stringResource(R.string.activities_reasoning_claim),
            color = accent,
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
        )
        RichText(claim, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
    }
}

/**
 * Main's `ArgumentSlot`: dashed while empty, tinted while it's the part to fill (more while a piece
 * is held over it), and marked strong or weak once checked, with a word as well as a color.
 */
@Composable
private fun ArgumentSlot(
    part: ArgumentPart,
    drag: ActivityDragDropState,
    label: String,
    hint: String,
    isOpen: Boolean,
    isFilled: Boolean,
    result: AnswerResult?,
    clearLabel: String,
    onClear: (() -> Unit)?,
    clearFocus: FocusRequester? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val isOver = isOpen && drag.overId == part.name
    val fill =
        when {
            result == AnswerResult.Right -> colors.tertiaryContainer
            result == AnswerResult.Wrong -> colors.errorContainer
            isOver -> accent.copy(alpha = SOFT)
            isFilled -> colors.surface
            isOpen -> accent.copy(alpha = OPEN_ALPHA)
            else -> Color.Transparent
        }
    val border =
        when {
            result == AnswerResult.Right -> colors.tertiary
            result == AnswerResult.Wrong -> colors.error
            isOpen -> accent
            else -> colors.outlineVariant
        }

    Column(
        Modifier
            .fillMaxWidth()
            .activityDropTarget(drag, part.name, enabled = isOpen)
            .slotFrame(fill, border, dashed = !isFilled)
            .semantics(mergeDescendants = true) {}
            // The clear button's 48dp row takes the top padding's place, so the label stays where it was.
            .padding(start = 14.dp, end = 14.dp, top = if (onClear == null) 10.dp else 0.dp, bottom = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            Modifier.heightIn(min = LABEL_ROW),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                label,
                Modifier.weight(1f),
                color = if (isOpen || isFilled) accent else colors.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
            )
            if (result != null) Verdict(strong = result == AnswerResult.Right)
            if (onClear != null) {
                IconButton(
                    onClick = onClear,
                    modifier =
                        Modifier
                            .then(
                                if (clearFocus !=
                                    null
                                ) {
                                    Modifier.focusRequester(clearFocus)
                                } else {
                                    Modifier
                                },
                            ).offset(x = CLEAR_OVERHANG),
                ) {
                    Icon(painterResource(R.drawable.ic_close), contentDescription = clearLabel, modifier = Modifier.size(18.dp))
                }
            }
        }
        if (isFilled) {
            content()
        } else {
            Text(hint, color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun Modifier.slotFrame(
    fill: Color,
    border: Color,
    dashed: Boolean,
): Modifier =
    drawBehind {
        val corner = CornerRadius(CORNER.toPx())
        val line = SLOT_BORDER.toPx()
        drawRoundRect(fill, cornerRadius = corner)
        drawRoundRect(
            border,
            topLeft = Offset(line / 2, line / 2),
            size = Size(size.width - line, size.height - line),
            cornerRadius = CornerRadius(corner.x - line / 2),
            style = Stroke(line, pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(DASH.toPx(), DASH.toPx())) else null),
        )
    }

@Composable
private fun Verdict(strong: Boolean) {
    val color = if (strong) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onErrorContainer
    val style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(
            painterResource(if (strong) R.drawable.ic_check else R.drawable.ic_close),
            contentDescription = null,
            modifier = Modifier.size(14.dp * LocalDensity.current.fontScale),
            tint = color,
        )
        Text(
            stringResource(if (strong) R.string.activities_reasoning_strong else R.string.activities_reasoning_weak),
            color = color,
            style = style,
        )
    }
}

@Composable
private fun QuoteText(
    quote: String,
    citation: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        RichText(stringResource(R.string.activities_reasoning_quote, quote), style = MaterialTheme.typography.bodyLarge)
        Text(citation, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ReasoningText(text: String) {
    RichText(text, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun Why(text: String) {
    RichText(text, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
}

@Composable
private fun Candidates(
    label: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ActivityCanvasLabel(label)
        content()
    }
}

/** Main's `ArgumentCandidate`: a tap puts it in the open part; a held finger or a mouse drags it there. */
@Composable
private fun Candidate(
    id: String,
    action: String,
    drag: ActivityDragDropState,
    enabled: Boolean,
    focus: FocusRequester?,
    firstLine: TextStyle,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(CORNER)
    Row(
        Modifier
            .then(if (focus != null) Modifier.focusRequester(focus) else Modifier)
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .activityDraggable(drag, id, enabled = enabled, shape = shape)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline, shape)
            .clickable(enabled = enabled, onClickLabel = action, role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LineMarker(firstLine) {
            Icon(
                painterResource(R.drawable.ic_drag_indicator),
                contentDescription = null,
                modifier = Modifier.size(18.dp * LocalDensity.current.fontScale),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        content()
    }
}

/** Main's `ArgumentReview`: the strong part the learner didn't pick, and why it's stronger. */
@Composable
private fun Stronger(
    label: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(CORNER),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                label,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
            )
            content()
        }
    }
}

private val CORNER: Dp = 12.dp
private val SLOT_BORDER: Dp = 2.dp
private val DASH: Dp = 5.dp
private const val SOFT = 0.16f
private const val OPEN_ALPHA = 0.07f
private val LABEL_ROW: Dp = 28.dp
private val CLEAR_OVERHANG: Dp = 8.dp
