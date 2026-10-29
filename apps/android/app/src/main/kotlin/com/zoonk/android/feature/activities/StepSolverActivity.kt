package com.zoonk.android.feature.activities

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf4FieldsStepsInner
import kotlin.math.abs
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf4Value as StepSolverContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

private typealias Step = PlayableLibraryStepAnyOfContentOneOf4FieldsStepsInner

private enum class StepStatus { Done, Current, Later }

val stepSolverRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_step_by_step, R.drawable.ic_format_list_numbered) },
        canvas = { StepSolverActivity(it) },
    )

@Composable
private fun StepSolverActivity(props: ActivityProps) {
    val content = (props.content as StepSolverContent).value
    val steps = content.fields.steps
    val solver = steps.map { step -> SolverStep(step.id, step.choices.firstOrNull { it.isCorrect }?.id) }
    var picks by rememberSaveable { mutableStateOf<SolverPicks>(emptyMap()) }
    val current = if (props.isChecked) steps.size else currentStepIndex(solver, picks)
    val maxValue = steps.maxOf { abs(it.value) }
    val numeric = content.check as? NumericCheckValue
    val pick = { stepId: String, choiceId: String ->
        val next = addPick(picks, stepId, choiceId)
        picks = next
        val pairs = firstPicks(solver, next)
        props.onAnswerChange(
            when {
                pairs == null -> null
                numeric != null -> solverValue(steps, numeric.value.output)?.let(::numericAnswer)
                else -> assignmentAnswer(pairs)
            },
        )
    }
    val line = MaterialTheme.colorScheme.outlineVariant
    val stepsLabel = stringResource(R.string.activities_solver_steps)

    ActivityCanvas(stringResource(R.string.activities_solver_description, minOf(current + 1, steps.size), steps.size)) {
        RichText(content.fields.problem, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        Column(
            Modifier
                .semantics { contentDescription = stepsLabel }
                .drawBehind {
                    val x = MARKER.toPx() / 2
                    drawLine(line, Offset(x, MARKER.toPx() / 2), Offset(x, size.height - MARKER.toPx() / 2), strokeWidth = 2.dp.toPx())
                },
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            steps.forEachIndexed { index, step ->
                SolverStepRow(
                    index = index,
                    step = step,
                    status =
                        when {
                            index < current -> StepStatus.Done
                            index == current -> StepStatus.Current
                            else -> StepStatus.Later
                        },
                    picks = picks[step.id].orEmpty(),
                    isChecked = props.isChecked,
                    maxValue = maxValue,
                    onPick = { pick(step.id, it) },
                )
            }
        }
    }
}

@Composable
private fun SolverStepRow(
    index: Int,
    step: Step,
    status: StepStatus,
    picks: List<String>,
    isChecked: Boolean,
    maxValue: Double,
    onPick: (String) -> Unit,
) {
    val correct = step.choices.firstOrNull { it.isCorrect }
    val wrongPicks = step.choices.filter { it.id in picks && !it.isCorrect }
    val firstPickWrong = picks.firstOrNull()?.let { it != correct?.id } == true

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        StepMarker(index, status, wrong = isChecked && firstPickWrong)
        Column(Modifier.weight(1f).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val heading = MaterialTheme.typography.bodyLarge
            when {
                status == StepStatus.Done && correct != null -> {
                    RichText(
                        correct.text,
                        style = heading.copy(fontWeight = FontWeight.SemiBold),
                    )
                }

                status == StepStatus.Later -> {
                    RichText(
                        step.prompt,
                        style = heading.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                    )
                }

                else -> {
                    RichText(step.prompt, style = heading.copy(fontWeight = FontWeight.SemiBold))
                }
            }
            if (status == StepStatus.Done) {
                RichText(step.prompt, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
            }
            if (status == StepStatus.Current && !isChecked) {
                ActivitySelectGrid(step.choices, label = step.prompt) { choice ->
                    ActivityTile(
                        picked = false,
                        result = AnswerResult.Wrong.takeIf { choice.id in picks },
                        enabled = choice.id !in picks,
                        onClick = { onPick(choice.id) },
                    ) { RichText(choice.text) }
                }
            }
            if (status == StepStatus.Current) {
                wrongPicks.lastOrNull()?.let { Verdict(stringResource(R.string.activities_solver_not_quite), it.reason, right = false) }
            }
            if (status == StepStatus.Done && correct != null) {
                StepWork(step, maxValue)
                Verdict(stringResource(R.string.activities_solver_right), correct.reason, right = true)
            }
            if (isChecked && firstPickWrong) {
                wrongPicks.firstOrNull()?.let {
                    Text(
                        stringResource(R.string.activities_solver_first_pick, it.text),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}

@Composable
private fun StepMarker(
    index: Int,
    status: StepStatus,
    wrong: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val modifier = Modifier.size(MARKER).clip(CircleShape).clearAndSetSemantics {}
    val number = @Composable { color: Color ->
        Text("${index + 1}", color = color, style = MaterialTheme.typography.labelLarge.withTabularFigures())
    }
    when (status) {
        StepStatus.Done -> {
            Box(modifier.background(if (wrong) colors.error else colors.tertiary), contentAlignment = Alignment.Center) {
                Icon(
                    painterResource(if (wrong) R.drawable.ic_close else R.drawable.ic_check),
                    null,
                    Modifier.size(16.dp),
                    tint = if (wrong) colors.onError else colors.onTertiary,
                )
            }
        }

        StepStatus.Current -> {
            Box(modifier.background(colors.primary), contentAlignment = Alignment.Center) { number(colors.onPrimary) }
        }

        StepStatus.Later -> {
            Box(
                modifier.background(colors.surface).border(BorderStroke(2.dp, colors.outlineVariant), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                number(colors.onSurfaceVariant)
            }
        }
    }
}

/** The step's value as a bar and as math. */
@Composable
private fun StepWork(
    step: Step,
    maxValue: Double,
) {
    val locale = currentLocale()
    val accent = MaterialTheme.zoonk.vizAccent
    val share = if (maxValue == 0.0) BAR_MIN else maxOf(abs(step.value) / maxValue, BAR_MIN)

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            Modifier.clearAndSetSemantics {},
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.weight(1f, fill = false)) {
                Box(
                    Modifier
                        .fillMaxWidth(
                            share.toFloat(),
                        ).height(28.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(accent.copy(alpha = SOFT)),
                )
            }
            Text(
                formatAmount(step.value, locale, step.unit),
                color = accent,
                style =
                    MaterialTheme.typography.labelLarge
                        .withTabularFigures()
                        .copy(fontWeight = FontWeight.SemiBold),
            )
        }
        RichText(step.math, style = MaterialTheme.typography.bodyMedium.withTabularFigures())
    }
}

@Composable
private fun Verdict(
    lead: String,
    reason: String,
    right: Boolean,
) {
    val color = if (right) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.error
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = color, fontWeight = FontWeight.SemiBold)) { append(lead) }
            append(" ")
            append(reason)
        },
        modifier = if (right) Modifier else Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Core's stepSolver value: the named step's expression, or the last step's. */
internal fun solverValue(
    steps: List<Step>,
    output: String?,
): Double? {
    val step = if (output != null) steps.find { it.id == output } else steps.lastOrNull()
    return step?.let { ActivityExpression.evaluate(it.expression) }
}

private val MARKER = 32.dp
private const val BAR_MIN = 0.04
private const val SOFT = 0.16f
