package com.zoonk.android.feature.activities.math

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityPlot
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReadout
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivitySlider
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.ui.components.niceTicks
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf
import kotlin.math.abs
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOfValue as FormulaModelContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue

val formulaModelRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_math_badge_try_it, R.drawable.ic_tune) },
        canvas = { FormulaModelActivity(it) },
        showsData = { true },
    )

private class Readout(
    val output: ModelOutput,
    val isPrimary: Boolean,
    val value: String,
    val note: String?,
)

@Composable
private fun FormulaModelActivity(props: ActivityProps) {
    val content = (props.content as FormulaModelContent).value
    val asked =
        when (val check = content.check) {
            is NumericCheckValue -> check.value.output
            is ChoiceCheckValue -> check.value.output
            else -> null
        }
    val charted = chartedOutput(content.fields, asked) ?: return
    val axis = chartAxis(content.fields) ?: return
    FormulaModelBoard(content, props, axis, charted)
}

@Composable
private fun FormulaModelBoard(
    content: PlayableLibraryStepAnyOfContentOneOf,
    props: ActivityProps,
    axis: ModelVariable,
    charted: ModelOutput,
) {
    val fields = content.fields
    val numeric = (content.check as? NumericCheckValue)?.value
    val locale = currentLocale()
    var sliders by rememberSaveable { mutableStateOf(startingValues(fields.variables)) }
    var events by rememberSaveable { mutableStateOf(eventsOff(fields)) }
    val view = remember(sliders, events) { modelView(fields, axis, charted, sliders, events) }
    val formatOutput = { output: ModelOutput, value: Double? -> value?.let { formatAmount(it, locale, output.unit) }.orEmpty() }
    val formatX = { value: Double -> formatAmount(value, locale, axis.unit) }
    val readouts = readouts(fields, charted, view, formatOutput)
    val update = { nextSliders: ModelValues, nextEvents: ModelValues ->
        sliders = nextSliders
        events = nextEvents
        if (numeric != null) props.onAnswerChange(formulaValue(fields, nextSliders + nextEvents, numeric.output)?.let(::numericAnswer))
    }
    val compared = view.compared?.let { (x, y) -> formatX(x) to formatOutput(charted, y) }

    ActivityCanvas(description = description(fields, axis, charted, view, readouts, compared)) {
        fields.title?.let { ActivityCanvasLabel(it) }
        if (!fields.events.isNullOrEmpty()) {
            ModelEvents(fields, events, disabled = props.isLocked) { name ->
                update(sliders, events + (name to if (events[name] == 1.0) 0.0 else 1.0))
            }
        }
        OutputReadouts(readouts)
        compared?.let { (x, y) ->
            Text(
                stringResource(R.string.activities_math_formula_compared, charted.label, x, y),
                Modifier.clearAndSetSemantics {},
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
        FormulaChart(
            axis = axis,
            charted = charted,
            view = view,
            expected =
                props.expected.numericValue?.takeIf { props.isChecked && numeric != null }?.let { y ->
                    (numeric?.inputs?.find { it.name == axis.name }?.`value` ?: axis.initial) to y
                },
            formatX = formatX,
        )
        view.baseline?.let { ModelLegend(it.kind) }
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val drives = formatOutput(charted, view.chartedNow)
            fields.variables.forEach { variable ->
                val value = sliders[variable.name] ?: variable.initial
                val formatInput = { input: Double -> formatAmount(input, locale, variable.unit) }
                ActivitySlider(
                    label = variable.label,
                    range = SnapRange(variable.min, variable.max, variable.step),
                    value = value,
                    valueLabel = formatInput(value),
                    valueText = stringResource(R.string.activities_math_formula_slider_value, formatInput(value), charted.label, drives),
                    onValueChange = { update(sliders + (variable.name to it), events) },
                    disabled = props.isLocked,
                ) {
                    Row(Modifier.fillMaxWidth()) {
                        SliderEnd(formatInput(variable.min))
                        Spacer(Modifier.weight(1f))
                        SliderEnd(formatInput(variable.max))
                    }
                }
            }
        }
    }
}

@Composable
private fun readouts(
    fields: FormulaFields,
    charted: ModelOutput,
    view: ModelView,
    formatOutput: (ModelOutput, Double?) -> String,
): List<Readout> {
    val locale = currentLocale()
    val baseline = view.readoutBaseline
    return fields.outputs.map { output ->
        val value = formulaValue(fields, view.now, output.id)
        val before = baseline?.let { formulaValue(fields, it.values, output.id) }
        val note =
            when {
                value == null || before == null || value == before -> {
                    null
                }

                baseline.kind == BaselineKind.WhatIf -> {
                    stringResource(
                        R.string.activities_math_formula_before,
                        formatOutput(output, before),
                    )
                }

                else -> {
                    stringResource(
                        R.string.activities_math_formula_from_start,
                        formatAmount(value - before, locale, output.unit, signed = true),
                    )
                }
            }
        Readout(output, output.id == charted.id, formatOutput(output, value), note)
    }
}

@Composable
private fun description(
    fields: FormulaFields,
    axis: ModelVariable,
    charted: ModelOutput,
    view: ModelView,
    readouts: List<Readout>,
    compared: Pair<String, String>?,
): String =
    listOfNotNull(
        stringResource(R.string.activities_math_formula_description, charted.label, axis.label),
        when {
            fields.events.isNullOrEmpty() -> null
            view.activeLabels.isEmpty() -> stringResource(R.string.activities_math_formula_no_what_ifs)
            else -> stringResource(R.string.activities_math_formula_what_ifs_on, view.activeLabels.joinToString(", "))
        },
        *readouts
            .map {
                if (it.note == null) {
                    stringResource(R.string.activities_math_formula_readout, it.output.label, it.value)
                } else {
                    stringResource(R.string.activities_math_formula_readout_note, it.output.label, it.value, it.note)
                }
            }.toTypedArray(),
        compared?.let { (x, y) -> stringResource(R.string.activities_math_formula_comparison, x, y) },
    ).joinToString(" ")

@Composable
private fun ModelEvents(
    fields: FormulaFields,
    events: ModelValues,
    disabled: Boolean,
    onToggle: (String) -> Unit,
) {
    val label = stringResource(R.string.activities_math_formula_what_if_events)
    FlowRow(
        Modifier.semantics { contentDescription = label },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        fields.events.orEmpty().forEach { event ->
            val on = events[event.name] == 1.0
            FilterChip(
                selected = on,
                onClick = { onToggle(event.name) },
                label = { Text(event.label) },
                enabled = !disabled,
                leadingIcon = {
                    Icon(
                        painterResource(if (on) R.drawable.ic_check else R.drawable.ic_add),
                        contentDescription = null,
                        modifier = Modifier.size(FilterChipDefaults.IconSize),
                    )
                },
            )
        }
    }
}

@Composable
private fun OutputReadouts(readouts: List<Readout>) {
    val columns = if (readouts.size > 1) 2 else 1
    Column(Modifier.clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        readouts.chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                row.forEach { readout ->
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            readout.output.label,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        ActivityReadout(
                            readout.value,
                            color = if (readout.isPrimary) MaterialTheme.zoonk.vizAccent else MaterialTheme.colorScheme.onSurface,
                        )
                        readout.note?.let {
                            Text(
                                it,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                            )
                        }
                    }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** Main's `ActivityFormulaChart`: the plotted output across the axis slider, with its start or before curve dashed and the change between them. */
@Composable
private fun FormulaChart(
    axis: ModelVariable,
    charted: ModelOutput,
    view: ModelView,
    expected: Pair<Double, Double>?,
    formatX: (Double) -> String,
) {
    val locale = currentLocale()
    val accent = MaterialTheme.zoonk.vizAccent
    val highlight = MaterialTheme.zoonk.vizHighlight
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val ring = MaterialTheme.colorScheme.surface
    val right = MaterialTheme.colorScheme.tertiary
    val delta = view.delta.takeIf { it != 0.0 }?.let { formatAmount(it, locale, charted.unit, signed = true) }
    val before = view.chartedBefore
    val now = view.chartedNow
    val minDelta = with(LocalDensity.current) { MIN_DELTA.toPx() }

    ActivityPlot(
        xDomain = axis.min..axis.max,
        yDomain = view.yDomain,
        yTicks = niceTicks(view.yDomain, Y_TICKS),
        xTicks = listOf(axis.min, axis.max),
        formatY = { formatAmount(it, locale, charted.unit, compact = true) },
        formatX = formatX,
        area = CHART_AREA,
    ) {
        view.baselineCurve?.let { line(it, muted, width = 2.dp, dash = BASELINE_DASH) }
        if (view.yDomain.start >= 0) area(view.current, accent.copy(alpha = SOFT))
        line(view.current, accent)
        if (before != null && now != null && delta != null && abs(at(view.x, before).y - at(view.x, now).y) >= minDelta) {
            line(listOf(view.x to before, view.x to now), highlight, width = 1.5.dp, dash = 3.dp)
            sideLabel(delta, view.x, (before + now) / 2, highlight)
        }
        before?.let { dot(view.x, it, ring, muted, radius = MARK_INNER) }
        view.compared?.let { (x, y) -> dot(x, y, accent.copy(alpha = SOFT).compositeOver(ring), accent, radius = MARK_INNER) }
        expected?.let { (x, y) -> dot(x, y, right, ring, radius = EXPECTED_INNER) }
        now?.let {
            guide(view.x, it, accent.copy(alpha = GUIDE_ALPHA))
            dot(view.x, it, accent, ring, radius = CURRENT_INNER)
        }
    }
}

@Composable
private fun ModelLegend(kind: BaselineKind) {
    val accent = MaterialTheme.zoonk.vizAccent
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    FlowRow(
        Modifier.clearAndSetSemantics {
        },
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        LegendItem(
            stringResource(
                if (kind ==
                    BaselineKind.WhatIf
                ) {
                    R.string.activities_math_formula_with_what_ifs
                } else {
                    R.string.activities_math_formula_now
                },
            ),
        ) {
            drawLine(accent, Offset(0f, center.y), Offset(size.width, center.y), 2.dp.toPx())
        }
        LegendItem(
            stringResource(
                if (kind ==
                    BaselineKind.WhatIf
                ) {
                    R.string.activities_math_formula_before_curve
                } else {
                    R.string.activities_math_formula_at_start
                },
            ),
        ) {
            val dash = 3.dp.toPx()
            drawLine(
                muted,
                Offset(0f, center.y),
                Offset(size.width, center.y),
                2.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash)),
            )
        }
    }
}

@Composable
private fun LegendItem(
    text: String,
    swatch: DrawScope.() -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(width = 16.dp, height = 8.dp), onDraw = swatch)
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun SliderEnd(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall.withTabularFigures())
}

private const val Y_TICKS = 3
private const val SOFT = 0.18f
private const val GUIDE_ALPHA = 0.4f
private val CHART_AREA = 132.dp
private val BASELINE_DASH = 5.dp
private val MIN_DELTA = 12.dp
private val MARK_INNER = 3.25.dp
private val EXPECTED_INNER = 5.75.dp
private val CURRENT_INNER = 4.75.dp
