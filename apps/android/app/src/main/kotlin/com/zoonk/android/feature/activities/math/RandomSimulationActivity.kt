package com.zoonk.android.feature.activities.math

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
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
import com.zoonk.android.feature.activities.choiceId
import com.zoonk.android.feature.activities.hashSeed
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.niceTicks
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.pluralQuantity
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1
import kotlin.math.abs
import kotlin.math.roundToInt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf8Value as RandomSimulationContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8Fields.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Value as SamplingMode
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8Fields.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfValue as ChanceMode
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Population.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1PopulationOneOfValue as ProportionPopulation
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModel.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOf2Value as SharedBirthdayModel
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue

val randomSimulationRenderer =
    ActivityRenderer(
        badge = {
            if ((it as RandomSimulationContent).value.fields is ChanceMode) {
                ActivityBadge(R.string.activities_math_badge_predict_first, R.drawable.ic_casino)
            } else {
                ActivityBadge(R.string.activities_math_badge_simulate, R.drawable.ic_repeat)
            }
        },
        canvas = { RandomSimulationActivity(it) },
        checkFirst = { (it as RandomSimulationContent).value.fields is ChanceMode },
        showsData = { (it as RandomSimulationContent).value.fields is SamplingMode },
    )

/** Main's simulations: the first run is seeded by the lesson so everyone sees the same one; "Run again" draws anew. */
@Composable
private fun RandomSimulationActivity(props: ActivityProps) {
    val content = (props.content as RandomSimulationContent).value
    val seedText =
        remember(content.fields) {
            seedText(ApiJson.encodeToJsonElement(PlayableLibraryStepAnyOfContentOneOf8Fields.serializer(), content.fields))
        }
    when (val fields = content.fields) {
        is ChanceMode -> ChanceSimulation(content, fields.value, seedText, props)
        is SamplingMode -> SamplingSimulation(fields.value, seedText, props)
    }
}

/** Fills a run in over about a second; Compose skips it when animations are off. */
@Composable
private fun revealCount(
    key: Long,
    total: Int,
): Int {
    val shown = remember(key) { Animatable(0f) }
    LaunchedEffect(key, total) { shown.animateTo(total.toFloat(), tween(REVEAL_MS, easing = LinearEasing)) }
    return shown.value.roundToInt()
}

@Composable
private fun ChanceSimulation(
    content: PlayableLibraryStepAnyOfContentOneOf8,
    fields: PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf,
    seedText: String,
    props: ActivityProps,
) {
    val locale = currentLocale()
    var runIndex by rememberSaveable { mutableIntStateOf(0) }
    val running = props.isChecked
    val seed = hashSeed(seedText) + runIndex
    val runs = fields.runs.toInt()
    val outcomes = remember(running, seed) { if (running) runSimulation(fields.model, runs, seed) else emptyList() }
    val revealed = revealCount(if (running) seed else -1, outcomes.size)
    val shown = outcomes.take(revealed)
    val hits = shown.map { isHit(fields.model, it) }
    val share = if (hits.isEmpty()) 0.0 else hits.count { it }.toDouble() / hits.size
    val done = running && shown.size == outcomes.size
    val guess = (content.check as? ChoiceCheckValue)?.value?.options?.find { it.id == props.answer.choiceId }?.`value`
    val percent = { value: Double -> formatAmount(value * PERCENT, locale, "%", maximumFractionDigits = if (value * PERCENT < SMALL_PERCENT) 1 else 0) }
    val runsLabel = stringResource(R.string.activities_math_chance_runs, formatAmount(fields.runs.toDouble(), locale), fields.trialLabel)
    val guessLabel = guess?.let { stringResource(R.string.activities_math_chance_your_guess, percent(it)) }
    val description = if (running) stringResource(R.string.activities_math_chance_description, runsLabel, fields.hitLabel, percent(share)) else runsLabel

    ActivityCanvas(description = description) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(runsLabel, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                ActivityCanvasLabel(fields.hitLabel)
                if (running && guessLabel != null) Text(guessLabel, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium))
            }
            if (running) ActivityReadout(percent(share), Modifier.clearAndSetSemantics {}, color = MaterialTheme.zoonk.vizAccent)
        }
        when {
            !running -> {
                Box(Modifier.fillMaxWidth().heightIn(min = WAITING_HEIGHT), contentAlignment = Alignment.Center) {
                    Text(
                        stringResource(R.string.activities_math_chance_pick_first),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            fields.model is SharedBirthdayModel -> {
                RunningShareChart(hits, runs, guess, guessLabel.orEmpty())
            }

            else -> {
                OutcomeHistogram(outcomes, shown) { isHit(fields.model, it) }
            }
        }
        if (done) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                itemVerticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.activities_math_chance_result, fields.hitLabel, percent(share), percent(hitProbability(fields.model))),
                    Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                    style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                )
                RunAgain(enabled = true) { runIndex += 1 }
            }
        }
    }
}

@Composable
private fun RunAgain(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    OutlinedButton(onClick = onClick, enabled = enabled) {
        Icon(painterResource(R.drawable.ic_replay), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
        Text(stringResource(R.string.activities_math_run_again), Modifier.padding(start = ButtonDefaults.IconSpacing))
    }
}

/** Main's `OutcomeHistogram`: how often each outcome came up, hits highlighted, the bars growing as the runs come in. */
@Composable
private fun OutcomeHistogram(
    all: List<Int>,
    shown: List<Int>,
    isHit: (Int) -> Boolean,
) {
    val locale = currentLocale()
    val counts = outcomeCounts(all)
    val first = counts.firstOrNull()?.first ?: 0
    val last = counts.lastOrNull()?.first ?: 1
    val binary = last - first == 1
    val bars = outcomeCounts(shown).filter { it.second > 0 }
    val hitTicks = counts.filter { isHit(it.first) }.map { it.first }
    val ticks = if (binary) listOf(first, last) else (listOf(first, last) + hitTicks.takeIf { it.size == 1 }.orEmpty()).distinct()
    val yes = stringResource(R.string.activities_math_chance_yes)
    val no = stringResource(R.string.activities_math_chance_no)
    val highlight = MaterialTheme.zoonk.vizHighlight
    val muted = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = MISS_ALPHA)

    ActivityPlot(
        xDomain = first - HALF..last + HALF,
        yDomain = 0.0..maxOf(counts.maxOfOrNull { it.second } ?: 1, 1).toDouble(),
        yTicks = emptyList(),
        xTicks = ticks.map { it.toDouble() },
        formatY = { "" },
        formatX = { value ->
            when {
                !binary -> formatAmount(value, locale)
                isHit(value.toInt()) -> yes
                else -> no
            }
        },
        area = CHART_AREA,
    ) {
        val width = maxOf(abs(at(1.0, 0.0).x - at(0.0, 0.0).x), 1f) * (1 - BAR_GAP)
        bars.forEach { (outcome, count) -> bar(outcome.toDouble(), count.toDouble(), width, if (isHit(outcome)) highlight else muted) }
    }
}

/** Main's `RunningShareChart`: the share of hits so far, settling as the runs come in, against the learner's guess. */
@Composable
private fun RunningShareChart(
    hits: List<Boolean>,
    runs: Int,
    guess: Double?,
    guessLabel: String,
) {
    val locale = currentLocale()
    val accent = MaterialTheme.zoonk.vizAccent
    val wrong = MaterialTheme.colorScheme.error
    ActivityPlot(
        xDomain = 0.0..runs.toDouble(),
        yDomain = 0.0..1.0,
        yTicks = listOf(0.0, HALF, 1.0),
        xTicks = listOf(0.0, runs.toDouble()),
        formatY = { formatAmount(it * PERCENT, locale, "%", maximumFractionDigits = 0) },
        formatX = { formatAmount(it, locale) },
        area = CHART_AREA,
    ) {
        guess?.let {
            line(listOf(0.0 to it, runs.toDouble() to it), wrong, width = 2.dp, dash = GUESS_DASH)
            label(guessLabel, runs.toDouble(), it, wrong, lift = GUESS_LIFT, end = true)
        }
        line(runningShare(hits, LINE_POINTS), accent)
    }
}

@Composable
private fun SamplingSimulation(
    fields: PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1,
    seedText: String,
    props: ActivityProps,
) {
    val locale = currentLocale()
    val sizes = fields.sampleSizes.map { it.toInt() }
    var sizeIndex by rememberSaveable { mutableIntStateOf(sizes.size - 1) }
    var runIndex by rememberSaveable { mutableIntStateOf(0) }
    val smallest = sizes.firstOrNull() ?: 1
    val size = sizes.getOrNull(sizeIndex) ?: smallest
    val runs = fields.runs.toInt()
    val population = fields.population
    val domain = samplingDomain(population, smallest)
    val truth = truthOf(population)
    val seedFor = { forSize: Int -> hashSeed("$seedText:$forSize") + runIndex }
    val results = remember(seedFor(size)) { simulateSamples(population, runs, seedFor(size), size) }
    val baseline = remember(seedFor(smallest)) { simulateSamples(population, runs, seedFor(smallest), smallest) }
    val revealed = revealCount(seedFor(size), runs)
    val shown = results.take(revealed)
    val done = shown.size == results.size
    val (from, to) = middleRange(results)
    val margin = (to - from) / 2
    val digits = valueDigits(margin, population)
    val isShare = population is ProportionPopulation
    val formatResult = { value: Double ->
        if (isShare) {
            formatAmount(value * PERCENT, locale, "%", maximumFractionDigits = digits)
        } else {
            formatAmount(value, locale, fields.unit, maximumFractionDigits = digits)
        }
    }
    val formatSize = { value: Int -> formatAmount(value.toDouble(), locale) }
    val comparison = if (size == smallest) null else histogram(baseline, domain)
    val maxCount = (histogram(results, domain).map { it.count } + comparison.orEmpty().map { it.count } + 1).max()
    val marginShown = marginText(margin, isShare, fields.unit)
    val summary =
        stringResource(
            R.string.activities_math_sampling_summary,
            formatAmount(fields.runs.toDouble(), locale),
            formatSize(size),
            fields.populationLabel,
            formatResult(truth),
            formatResult(from),
            formatResult(to),
        )

    ActivityCanvas(description = summary) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(stringResource(R.string.activities_math_sampling_within, formatAmount(MIDDLE_PERCENT, locale, "%")), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                ActivityCanvasLabel(fields.populationLabel)
            }
            ActivityReadout(
                marginShown,
                Modifier.clearAndSetSemantics {},
                color = if (done) MaterialTheme.zoonk.vizAccent else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        SamplingChart(
            bins = histogram(shown, domain),
            comparison = comparison,
            domain = domain,
            maxCount = maxCount,
            range = from to to,
            rangeLabel = stringResource(R.string.activities_math_sampling_range, formatResult(from), formatResult(to)),
            truth = truth,
            truthLabel = stringResource(R.string.activities_math_sampling_truth, formatResult(truth)),
            format = formatResult,
        )
        if (comparison != null) SizeLegend(formatSize(smallest), formatSize(size))
        ActivitySlider(
            label = fields.sizeLabel ?: stringResource(R.string.activities_math_sampling_size),
            range = SnapRange(0.0, (sizes.size - 1).toDouble(), 1.0),
            value = sizeIndex.toDouble(),
            valueLabel = formatSize(size),
            valueText = stringResource(R.string.activities_math_sampling_slider_value, formatSize(size), marginShown),
            onValueChange = { sizeIndex = it.toInt() },
            disabled = props.isLocked,
        ) { SizeStops(sizes.map(formatSize), sizeIndex) }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (done) {
                    stringResource(R.string.activities_math_sampling_done, formatAmount(fields.runs.toDouble(), locale), formatSize(size))
                } else {
                    stringResource(R.string.activities_math_sampling_running, formatAmount(shown.size.toDouble(), locale), formatAmount(fields.runs.toDouble(), locale))
                },
                Modifier.weight(1f).semantics { if (done) liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
            )
            RunAgain(enabled = done) { runIndex += 1 }
        }
        if (props.isChecked) ExpectedSpread(fields, sizes, isShare, formatSize)
    }
}

/** Main's margin: "±5.2 points" for a share, "±3 cm" for a mean. */
@Composable
private fun marginText(
    margin: Double,
    isShare: Boolean,
    unit: String?,
): String {
    val locale = currentLocale()
    if (!isShare) return stringResource(R.string.activities_math_sampling_margin, formatAmount(margin, locale, unit))
    val points = (margin * PERCENT * TENTHS).roundToInt() / TENTHS.toDouble()
    return pluralStringResource(R.plurals.activities_math_sampling_margin_points, pluralQuantity(points, locale), formatAmount(points, locale))
}

/** Main's `SamplingChart`: the polls' results, the smallest size's behind them, the true value and where the middle 95% fall. */
@Composable
private fun SamplingChart(
    bins: List<HistogramBin>,
    comparison: List<HistogramBin>?,
    domain: ClosedFloatingPointRange<Double>,
    maxCount: Int,
    range: Pair<Double, Double>,
    rangeLabel: String,
    truth: Double,
    truthLabel: String,
    format: (Double) -> String,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val tickStyle = MaterialTheme.typography.labelSmall.withTabularFigures()
    val markStyle = tickStyle.copy(fontWeight = FontWeight.SemiBold)
    val labelHeight = measurer.measure("0", markStyle).size.height
    val gap = with(density) { LABEL_GAP.toPx() }
    val top = labelHeight + gap * 2
    val axis = top + with(density) { SAMPLING_AREA.toPx() }
    val bracket = axis + labelHeight + gap * 2 + with(density) { BRACKET_TICK.toPx() }
    val height = bracket + gap + labelHeight + with(density) { CHART_BOTTOM.toPx() }
    val ink = MaterialTheme.colorScheme.onSurface
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val border = MaterialTheme.colorScheme.outlineVariant
    val accent = MaterialTheme.zoonk.vizAccent

    BoxWithConstraints(Modifier.fillMaxWidth().height(with(density) { height.toDp() }).clearAndSetSemantics {}) {
        val side = with(density) { CHART_SIDE.toPx() }
        val x = LinearScale(domain, side to constraints.maxWidth - side)
        val y = LinearScale(0.0..maxCount.toDouble(), axis to top)

        Canvas(Modifier.matchParentSize()) {
            val barGap = BAR_SPACE.toPx()
            val drawBars = { list: List<HistogramBin>, color: Color ->
                list.filter { it.count > 0 }.forEach { bin ->
                    val width = maxOf(x.toPixel(bin.to) - x.toPixel(bin.from) - barGap, 1f)
                    val barTop = y.toPixel(bin.count.toDouble())
                    drawRoundRect(
                        color,
                        Offset(x.toPixel(bin.from) + barGap / 2, barTop),
                        Size(width, axis - barTop),
                        CornerRadius(minOf(BAR_RADIUS.toPx(), width / 2)),
                    )
                }
            }
            comparison?.let { drawBars(it, muted.copy(alpha = MISS_ALPHA)) }
            drawBars(bins, accent)

            val truthX = x.toPixel(truth)
            val dash = TRUTH_DASH.toPx()
            drawLine(ink, Offset(truthX, axis), Offset(truthX, top), LINE_WIDTH.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash * 3 / 4)))
            val truthText = measurer.measure(truthLabel, markStyle.copy(color = ink))
            drawText(truthText, topLeft = Offset((truthX - truthText.size.width / 2).coerceIn(0f, size.width - truthText.size.width), top - gap - truthText.size.height))

            drawLine(border, Offset(x.range.first, axis), Offset(x.range.second, axis), LINE_WIDTH.toPx())
            val (from, to) = x.toPixel(range.first) to x.toPixel(range.second)
            val middle = (from + to) / 2
            niceTicks(domain, AXIS_TICKS).filter { abs(x.toPixel(it) - middle) >= LABEL_CLEARANCE.toPx() }.forEach { tick ->
                val label = measurer.measure(format(tick), tickStyle.copy(color = muted))
                drawText(label, topLeft = Offset(x.toPixel(tick) - label.size.width / 2, axis + gap))
            }
            val tick = BRACKET_TICK.toPx()
            val bracketPath =
                Path().apply {
                    moveTo(from, bracket - tick)
                    lineTo(from, bracket)
                    lineTo(to, bracket)
                    lineTo(to, bracket - tick)
                }
            drawPath(bracketPath, accent, style = Stroke(LINE_WIDTH.toPx()))
            val rangeText = measurer.measure(rangeLabel, markStyle.copy(color = accent))
            drawText(rangeText, topLeft = Offset((middle - rangeText.size.width / 2).coerceIn(0f, size.width - rangeText.size.width), bracket + gap))
        }
    }
}

@Composable
private fun SizeLegend(
    smallest: String,
    current: String,
) {
    val style = MaterialTheme.typography.labelSmall.withTabularFigures()
    FlowRow(Modifier.clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        LegendItem(smallest, MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = MISS_ALPHA), MaterialTheme.colorScheme.onSurfaceVariant, style)
        LegendItem(current, MaterialTheme.zoonk.vizAccent, MaterialTheme.colorScheme.onSurface, style.copy(fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun LegendItem(
    label: String,
    swatch: Color,
    color: Color,
    style: TextStyle,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(Modifier.size(10.dp), shape = RoundedCornerShape(2.dp), color = swatch) {}
        Text(label, color = color, style = style)
    }
}

/** Main's `SampleSizeStops`: each size under its stop, the ends kept inside the track. */
@Composable
private fun SizeStops(
    labels: List<String>,
    index: Int,
) {
    val style = MaterialTheme.typography.labelSmall.withTabularFigures()
    Layout(
        content = {
            labels.forEachIndexed { position, label ->
                Text(
                    label,
                    color = if (position == index) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = if (position == index) style.copy(fontWeight = FontWeight.Medium) else style,
                    maxLines = 1,
                )
            }
        },
        modifier = Modifier.fillMaxWidth(),
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(constraints.copy(minWidth = 0)) }
        val width = constraints.maxWidth
        val last = maxOf(placeables.size - 1, 1)
        layout(width, placeables.maxOfOrNull { it.height } ?: 0) {
            placeables.forEachIndexed { position, placeable ->
                val x =
                    when (position) {
                        0 -> 0
                        placeables.size - 1 -> width - placeable.width
                        else -> width * position / last - placeable.width / 2
                    }
                placeable.placeRelative(x, 0)
            }
        }
    }
}

/** Main's `SamplingExpectedSpread`: what each size's margin should be, and how much it shrinks from the smallest to the largest. */
@Composable
private fun ExpectedSpread(
    fields: PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1,
    sizes: List<Int>,
    isShare: Boolean,
    formatSize: (Int) -> String,
) {
    val locale = currentLocale()
    val smallest = sizes.firstOrNull() ?: 1
    val largest = sizes.lastOrNull() ?: smallest
    val error = { size: Int -> standardError(fields.population, size) }
    val style = MaterialTheme.typography.bodyMedium.withTabularFigures()

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.activities_math_sampling_math), style = style.copy(fontWeight = FontWeight.Medium))
            sizes.forEach { size ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(formatSize(size), Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
                    Text(marginText(error(size) * MIDDLE_95, isShare, fields.unit), style = style.copy(fontWeight = FontWeight.Medium))
                }
            }
            Text(
                stringResource(
                    R.string.activities_math_sampling_shrinks,
                    formatSize(smallest),
                    formatSize(largest),
                    formatAmount(error(largest) / error(smallest) * PERCENT, locale, "%", maximumFractionDigits = 1),
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = style,
            )
        }
    }
}

private const val PERCENT = 100
private const val SMALL_PERCENT = 10
private const val TENTHS = 10
private const val REVEAL_MS = 1200
private const val HALF = 0.5
private const val BAR_GAP = 0.18f
private const val MISS_ALPHA = 0.3f
private const val LINE_POINTS = 120
private const val AXIS_TICKS = 4
private const val MIDDLE_95 = 1.96
private const val MIDDLE_PERCENT = 95.0
private val CHART_AREA = 112.dp
private val WAITING_HEIGHT = 128.dp
private val GUESS_DASH = 5.dp
private val GUESS_LIFT = 10.dp
private val SAMPLING_AREA = 100.dp
private val LABEL_GAP = 4.dp
private val BRACKET_TICK = 4.dp
private val CHART_BOTTOM = 4.dp
private val CHART_SIDE = 10.dp
private val BAR_SPACE = 1.dp
private val BAR_RADIUS = 2.dp
private val TRUTH_DASH = 4.dp
private val LINE_WIDTH = 1.5.dp
private val LABEL_CLEARANCE = 44.dp
