package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivitySelectGrid
import com.zoonk.android.feature.activities.ActivityTile
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf17Value as CodeTracerContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsPausesInner as Pause

val codeTracerRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_code_badge_step_through, R.drawable.ic_footprint) },
        canvas = { CodeTracerActivity(it) },
    )

private const val SHORT_OPTION_LENGTH = 8

private fun optionColumns(pause: Pause): Int =
    when {
        pause.options.any { it.text.length > SHORT_OPTION_LENGTH } -> 1
        pause.options.size == 3 -> 3
        else -> 2
    }

private fun PlayableLibraryStepAnyOfContentOneOf17Fields.tracedText(pause: Pause): String =
    trace
        .getOrNull(pause.step.toInt())
        ?.propertyValues
        ?.firstOrNull { it.name == pause.variable }
        ?.value
        ?.text
        .orEmpty()

private data class PauseResult(
    val question: String,
    val guess: String,
    val traced: String,
    val isRight: Boolean,
)

@Composable
private fun CodeTracerActivity(props: ActivityProps) {
    val fields = (props.content as CodeTracerContent).value.fields
    val isPython = fields.language == PlayableLibraryStepAnyOfContentOneOf17Fields.Language.PYTHON
    val language = if (isPython) CodeLanguage.Python else CodeLanguage.JavaScript
    val onAnswerChange by rememberUpdatedState(props.onAnswerChange)
    val start = firstStep(fields.pauses)
    var step by rememberSaveable { mutableIntStateOf(start) }
    var furthest by rememberSaveable { mutableIntStateOf(start) }
    var predictions by rememberSaveable(stateSaver = draftsSaver { it }) { mutableStateOf(props.answer.assignmentPairs.orEmpty()) }
    val expectedPairs = props.expected.assignmentPairs
    val lastStep = fields.trace.size - 1
    val blocking = if (props.isChecked) null else blockingPause(fields.pauses, predictions, step)
    val upcoming = if (props.isChecked) null else upcomingPause(fields.pauses, predictions, step)
    val isRevealed = { pause: Pause -> props.isChecked || furthest >= pause.step }
    val asking = upcoming?.takeUnless { isRevealed(it.value) }

    fun goTo(next: Int) {
        step = next
        furthest = maxOf(furthest, next)
    }

    fun predict(
        index: Int,
        optionId: String,
    ) {
        if (props.isLocked) return
        predictions = predictions + (index.toString() to optionId)
        onAnswerChange(tracerAnswer(fields.pauses, predictions))
    }

    val revealed =
        fields.pauses.withIndex().mapNotNull { (index, pause) ->
            val guess = predictions[index.toString()]?.takeIf { isRevealed(pause) } ?: return@mapNotNull null
            val guessText =
                pause.options
                    .firstOrNull { it.id == guess }
                    ?.text
                    .orEmpty()
            val traced = fields.tracedText(pause)
            val rightId = expectedPairs?.get(index.toString())
            val isRight = if (rightId == null) guessText.jsTrim() == traced else guess == rightId
            PauseResult(pause.question, guessText, traced, isRight)
        }

    ActivityCanvas {
        TracerVariables(watchedValues(step, fields.trace, fields.watch))
        TracerPanel(
            code = fields.code,
            language = language,
            currentLine =
                fields.trace
                    .getOrNull(step)
                    ?.line
                    ?.toInt(),
            position =
                if (step < 0) {
                    stringResource(R.string.activities_code_before_first_line)
                } else {
                    stringResource(R.string.activities_code_step_of, step + 1, lastStep + 1)
                },
            canGoBack = step > start,
            canGoForward = step < lastStep && blocking == null,
            onBack = { goTo(step - 1) },
            onForward = { goTo(step + 1) },
        )
        if (asking != null) {
            Prediction(asking, predictions[asking.index.toString()], props.isLocked) { predict(asking.index, it) }
        } else if (!props.isChecked) {
            Text(
                stringResource(if (step >= lastStep) R.string.activities_code_whole_run else R.string.activities_code_step_next_line),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        PredictionLog(revealed)
    }
}

/** Main's `TracerVariables`: each watched value, with what it was when this step changed it. */
@Composable
private fun TracerVariables(values: List<WatchedValue>) {
    val colors = MaterialTheme.colorScheme
    val highlight = MaterialTheme.zoonk.vizHighlight
    val mono = FontFamily.Monospace
    val label = stringResource(R.string.activities_code_variables)
    Row(
        Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .semantics { contentDescription = label },
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        values.forEach { item ->
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(12.dp))
                    .then(if (item.changed) Modifier.background(highlight.copy(alpha = SOFT_ALPHA)) else Modifier)
                    .semantics(mergeDescendants = true) {}
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            ) {
                Text(
                    item.name,
                    color = if (item.changed) highlight else colors.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall.copy(fontFamily = mono),
                )
                val was = item.previous?.takeIf { item.changed }?.let { stringResource(R.string.activities_code_value_was, it) }
                val wasStyle =
                    MaterialTheme.typography.labelSmall
                        .toSpanStyle()
                        .copy(color = highlight, fontFamily = mono)
                Text(
                    buildAnnotatedString {
                        was?.let { withStyle(wasStyle) { append("$it ") } }
                        append(item.value ?: stringResource(R.string.activities_code_not_set))
                    },
                    color = if (item.value == null) colors.onSurfaceVariant else colors.onSurface,
                    style =
                        MaterialTheme.typography.titleMedium.copy(
                            fontFamily = mono,
                            fontWeight = if (item.value == null) FontWeight.Normal else FontWeight.SemiBold,
                        ),
                )
            }
        }
    }
}

@Composable
private fun TracerPanel(
    code: String,
    language: CodeLanguage,
    currentLine: Int?,
    position: String,
    canGoBack: Boolean,
    canGoForward: Boolean,
    onBack: () -> Unit,
    onForward: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outlineVariant, shape)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            Modifier.padding(start = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                position,
                Modifier
                    .weight(1f)
                    .semantics { liveRegion = LiveRegionMode.Polite },
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
            )
            StepButton(stringResource(R.string.activities_code_step_back), R.drawable.ic_skip_previous, canGoBack, onBack)
            StepButton(stringResource(R.string.activities_code_step_forward), R.drawable.ic_skip_next, canGoForward, onForward)
        }
        CodeListing(code, language, stringResource(R.string.activities_code_code), currentLine = currentLine)
    }
}

@Composable
private fun StepButton(
    label: String,
    icon: Int,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    OutlinedIconButton(onClick = onClick, modifier = Modifier.size(48.dp).semantics { contentDescription = label }, enabled = enabled) {
        Icon(painterResource(icon), contentDescription = null)
    }
}

@Composable
private fun Prediction(
    pause: IndexedValue<Pause>,
    pickedId: String?,
    isLocked: Boolean,
    onPick: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        RichText(pause.value.question, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        ActivitySelectGrid(pause.value.options, label = pause.value.question, columns = optionColumns(pause.value)) { option ->
            ActivityTile(
                picked = pickedId == option.id,
                result = null,
                onClick = { onPick(option.id) },
                enabled = !isLocked,
                role = Role.RadioButton,
            ) {
                Text(option.text, fontFamily = FontFamily.Monospace)
            }
        }
        Text(
            stringResource(if (pickedId == null) R.string.activities_code_predict_first else R.string.activities_code_step_to_see),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

/** Main's `TracerPredictionLog`: each revealed prediction against what the run did. */
@Composable
private fun PredictionLog(results: List<PauseResult>) {
    if (results.isEmpty()) return
    val colors = MaterialTheme.colorScheme
    val label = stringResource(R.string.activities_code_your_predictions)
    val style = MaterialTheme.typography.bodyMedium
    Column(
        Modifier.semantics {
            contentDescription = label
            liveRegion = LiveRegionMode.Polite
        },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        results.forEach { result ->
            Row(Modifier.semantics(mergeDescendants = true) {}, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LineMarker(style) {
                    Icon(
                        painterResource(if (result.isRight) R.drawable.ic_check else R.drawable.ic_close),
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (result.isRight) colors.tertiary else colors.error,
                    )
                }
                Column(Modifier.weight(1f)) {
                    RichText(result.question, style = style.copy(color = colors.onSurfaceVariant))
                    Text(
                        if (result.isRight) {
                            stringResource(R.string.activities_code_you_said_right, result.guess)
                        } else {
                            stringResource(R.string.activities_code_you_said_wrong, result.guess, result.traced)
                        },
                        style = style.copy(fontWeight = FontWeight.Medium),
                    )
                }
            }
        }
    }
}
