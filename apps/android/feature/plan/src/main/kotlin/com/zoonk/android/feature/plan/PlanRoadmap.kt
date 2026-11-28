package com.zoonk.android.feature.plan

import androidx.annotation.StringRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.Hyphens
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.components.glyphScale
import com.zoonk.android.ui.theme.Geist
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.balanced
import com.zoonk.android.ui.theme.layoutEnd
import com.zoonk.android.ui.theme.layoutStart
import com.zoonk.android.ui.theme.wrappedAs
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.PlanPhase
import kotlinx.datetime.toJavaLocalDate
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The phases in time (main's `PlanRoadmap`): on a narrow pane one meter with where the learner is,
 * which opens the path when the page lists subjects instead; wider, a band per phase that opens
 * its details, with today, mocks, challenges and the goal's date under it.
 */
@Composable
internal fun PlanRoadmap(
    page: PlanPageState,
    links: PlanLinks,
    modifier: Modifier = Modifier,
    onOpenPath: (() -> Unit)? = null,
) {
    val phases = page.plan.roadmapPhases
    if (phases.isEmpty()) return

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val bandsFit = MIN_BAND_WIDTH * phases.size + BAND_GAP * (phases.size - 1) <= maxWidth
        // A plan with one phase has no phases to set side by side, but its bar still ends on its finish.
        if (phases.size == 1 || maxWidth < FULL_ROADMAP_WIDTH || !bandsFit) {
            RoadmapCompact(page, phases, onOpenPath)
        } else {
            RoadmapFull(page, phases, links, maxWidth)
        }
    }
}

private val FULL_ROADMAP_WIDTH = 560.dp

/** Where the learner is: the row under the roadmap already names the phase. */
private data class RoadmapPosition(
    val end: PlanDateWords?,
    val number: Int,
    val total: Int,
)

@Composable
private fun roadmapPosition(
    page: PlanPageState,
    phases: List<PlanPhase>,
): RoadmapPosition? {
    val index = phases.indexOfFirst { it.state == PlanPhase.State.CURRENT }
    val current = phases.getOrNull(index) ?: return null
    return RoadmapPosition(
        phaseEnd(page, current).takeUnless { page.isPaused },
        index + 1,
        phases.size,
    )
}

/** The compact line's end, "Ends ~Dec 2": the words TalkBack reads, in the line's face, so the date says what it is. */
@Composable
private fun PhaseEndLine(end: PlanDateWords) {
    Text(
        text = if (end.date) stringResource(R.string.plan_ends, end.text) else end.text,
        modifier = Modifier.semantics { contentDescription = end.spoken },
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
    )
}

@Composable
private fun PositionLine(
    position: RoadmapPosition,
    modifier: Modifier,
) {
    Text(
        text = stringResource(R.string.plan_roadmap_phase_number, position.number, position.total),
        modifier = modifier,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Medium,
    )
}

@Composable
private fun RoadmapCompact(
    page: PlanPageState,
    phases: List<PlanPhase>,
    onOpen: (() -> Unit)?,
) {
    val position = roadmapPosition(page, phases)
    val clickable =
        if (onOpen == null) {
            Modifier
        } else {
            Modifier
                .clip(MaterialTheme.shapes.medium)
                .clickable(onClickLabel = stringResource(R.string.plan_your_path), role = Role.Button, onClick = onOpen)
        }

    Column(
        modifier = clickable.heightIn(min = 48.dp).padding(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RoadmapMeter(phases, Modifier.weight(1f))
            CompactFinish(page)
            // One phase has no place to say under the bar, so the way to its path ends the bar.
            if (phases.size == 1 && onOpen != null) ListRowChevron()
        }
        if (phases.size > 1) CompactLine(phases, position, onOpen)
    }
}

/** Main's `CompactFinish`: where the bar ends, as the full timeline's axis ends: the flag and the goal's date, or open. */
@Composable
private fun CompactFinish(page: PlanPageState) {
    val finish = page.finish ?: return
    val words = planDate(finish.date, page.today, finish.estimate, finish.month, finish.year)
    val label = stringResource(page.finishLabel())
    val color = MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        modifier = Modifier.clearAndSetSemantics { contentDescription = "$label, ${words.spoken}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(painterResource(R.drawable.ic_flag), contentDescription = null, modifier = Modifier.size(14.dp * glyphScale()), tint = color)
        Text(words.text, style = MaterialTheme.typography.labelMedium, color = color, maxLines = 1)
    }
}

@Composable
private fun CompactLine(
    phases: List<PlanPhase>,
    position: RoadmapPosition?,
    onOpen: (() -> Unit)?,
) {
    val done = phases.count { it.state == PlanPhase.State.DONE }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (position != null) {
            PositionLine(position, Modifier.weight(1f))
            position.end?.let { PhaseEndLine(it) }
        } else if (onOpen != null) {
            Text(
                text = pluralStringResource(R.plurals.plan_phases_done, phases.size, done, phases.size),
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (onOpen != null) ListRowChevron()
    }
}

@Composable
private fun RoadmapMeter(
    phases: List<PlanPhase>,
    modifier: Modifier,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val fill = MaterialTheme.colorScheme.tertiary
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Canvas(
        modifier
            .height(6.dp)
            .clearAndSetSemantics {},
    ) {
        val gap = 2.dp.toPx()
        val minimum = 24.dp.toPx()
        val radius = CornerRadius(size.height / 2)
        val widths = weightedWidths(phases.map { it.weight() }, size.width, List(phases.size) { minimum }, gap)
        var start = 0f

        phases.forEachIndexed { index, phase ->
            val width = widths[index]
            val left = if (rtl) size.width - start - width else start
            val current = phase.state == PlanPhase.State.CURRENT
            drawRoundRect(track, Offset(left, 0f), Size(width, size.height), radius)
            val done = width * phase.lessonShare()
            if (done > 0) {
                drawRoundRect(
                    if (current) fill.copy(alpha = CURRENT_FILL_ALPHA) else fill,
                    Offset(if (rtl) left + width - done else left, 0f),
                    Size(done, size.height),
                    radius,
                )
            }
            start += width + gap
        }
    }
}

private const val CURRENT_FILL_ALPHA = 0.3f
private const val CURRENT_RING_ALPHA = 0.15f

/** Each part gets its minimum, then its share of what's left by weight, as main's flex rows do. */
internal fun weightedWidths(
    weights: List<Float>,
    total: Float,
    minimums: List<Float>,
    gap: Float,
): List<Float> {
    val shared = (total - minimums.sum() - (weights.size - 1).coerceAtLeast(0) * gap).coerceAtLeast(0f)
    val sum = weights.sum()
    return weights.mapIndexed { index, weight -> minimums[index] + if (sum > 0) shared * weight / sum else 0f }
}

@Composable
private fun RoadmapFull(
    page: PlanPageState,
    phases: List<PlanPhase>,
    links: PlanLinks,
    width: Dp,
) {
    var opened by rememberSaveable { mutableStateOf<Long?>(null) }
    val position = roadmapPosition(page, phases)
    val currentIndex = phases.indexOfFirst { it.state == PlanPhase.State.CURRENT }
    val overrun = page.plan.overrun(page.goal.kind)
    val axisDated = page.plan.axisDatedPhases(page.goal.kind, page.today)
    val weights = phases.map { it.weight() }
    val names = phases.map { phaseRowName(it, page.mocksRequirePlus) }
    val parted = phases.mapIndexed { index, phase -> bandName(phase, names[index], keepParts = true) }
    val loose = phases.mapIndexed { index, phase -> bandName(phase, names[index], keepParts = false) }
    // Main's `AxisDateSizer`: a band is never narrower than the date under it, so dates keep one line and never meet.
    val endDate = page.finish?.let { dateValue(planDate(it.date, page.today, it.estimate, it.month, it.year).text) }
    val dates =
        phases.mapIndexed { index, phase ->
            when {
                phase.index in axisDated -> phaseEnd(page, phase)?.let { if (it.date) dateValue(it.text) else AnnotatedString(it.text) }
                index == phases.lastIndex -> endDate
                else -> null
            }
        }
    val bands = bandLayout(parted, loose, weights, width, dates)

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            // The bands name each phase, so the line names only the place.
            position?.let {
                Text(
                    text = stringResource(R.string.plan_roadmap_phase_number, it.number, it.total),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            RoadmapLegend(page, phases)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BAND_GAP)) {
            phases.forEachIndexed { index, phase ->
                PhaseColumn(
                    page = page,
                    phase = phase,
                    name = bands.names[index],
                    width = bands.widths[index],
                    bandHeight = bands.height,
                    isLast = index == phases.lastIndex,
                    dated = phase.index in axisDated,
                    overrun = overrun?.takeIf { it.phaseIndex == phase.index },
                    hasOverrun = overrun != null,
                    todayRow = currentIndex >= 0,
                    onOpen = { opened = phase.index },
                )
            }
        }
    }

    phases.firstOrNull { it.index == opened }?.let { phase ->
        PhaseDetailsSheet(page, phase, links, onDismiss = { opened = null })
    }
}

@Composable
private fun RoadmapLegend(
    page: PlanPageState,
    phases: List<PlanPhase>,
) {
    val hasMocks = phases.any { it.mocks.nextDate != null }
    val hasChallenges = phases.any { it.checkpoint?.date != null }
    val style = MaterialTheme.typography.labelSmall
    val color = MaterialTheme.colorScheme.onSurfaceVariant

    // Main's legend: each mark 6dp from its words, the pairs 12dp apart, so a mark reads with its own words.
    Row(
        modifier = Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (hasMocks) {
            LegendPair({ KindDot(LearnKind.Mock) }) { Text(stringResource(R.string.plan_mock_exam), style = style, color = color) }
        }
        if (hasChallenges) {
            LegendPair(
                { PhaseCheckpointMark(page, Modifier.size(16.dp * glyphScale())) },
            ) { Text(legendChallengeName(page), style = style, color = color) }
        }
        if (page.finish != null) {
            LegendPair(
                {
                    Icon(
                        painterResource(R.drawable.ic_flag),
                        contentDescription = null,
                        modifier = Modifier.size(14.dp * glyphScale()),
                        tint = color,
                    )
                },
            ) {
                Text(stringResource(page.finishLabel()), style = style, color = color)
            }
        }
    }
}

/** Main's `useFinishLabel`: what the flag at the plan's finish stands for: the goal's date, or with none the finish the plan works out. */
@StringRes
private fun PlanPageState.finishLabel(): Int =
    when {
        isExam -> R.string.plan_exam_date
        plan.schedule.targetDate != null -> R.string.plan_deadline
        else -> R.string.plan_roadmap_you_finish
    }

@Composable
private fun LegendPair(
    mark: @Composable () -> Unit,
    words: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        mark()
        words()
    }
}

/**
 * A band's name; a done phase's check sits in its first line, so a narrow band's lines get its whole width. It
 * [hyphenates] only when not even each band's longest word fits the row.
 */
private class BandName(
    val plain: String,
    val text: AnnotatedString,
    val placeholders: List<AnnotatedString.Range<Placeholder>>,
    val hyphenates: Boolean = false,
)

private fun bandName(
    phase: PlanPhase,
    name: String,
    keepParts: Boolean,
): BandName {
    // Each part keeps its words together, so a band is as wide as its widest part and breaks only between parts.
    val shown = if (keepParts) bandNameParts(name).joinToString(" ") { it.replace(' ', NO_BREAK_SPACE) } else name
    val (mark, placeholder) =
        when (phase.state) {
            PlanPhase.State.DONE -> CHECK to CHECK_MARK
            PlanPhase.State.CURRENT -> CURRENT to CURRENT_MARK
            else -> return BandName(name, AnnotatedString(shown), emptyList())
        }
    val text =
        buildAnnotatedString {
            appendInlineContent(mark, "•")
            append(WORD_JOINER)
            append(shown)
        }
    return BandName(name, text, listOf(AnnotatedString.Range(placeholder, 0, 1)))
}

/**
 * Main's `splitBandName`: a short name is one part; a longer one is cut between words where its longer part is
 * shortest. Each thing that reads badly, a short word ("e", "of") at the first line's end or one word alone on the
 * second, makes a cut cost as if that part were longer, so a short name dodges them and a long one stays balanced.
 */
internal fun bandNameParts(name: String): List<String> {
    val words = name.split(" ")
    if (name.length <= ONE_LINE_NAME_LENGTH || words.size == 1) return listOf(name)
    val cut =
        (1 until words.size).minBy { cut ->
            val faults = listOf(words[cut - 1].count(Char::isLetter) <= SHORT_WORD_LETTERS, cut == words.lastIndex).count { it }
            maxOf(words.take(cut).joinToString(" ").length, words.drop(cut).joinToString(" ").length) + faults * FAULT_LETTERS
        }
    return listOf(words.take(cut).joinToString(" "), words.drop(cut).joinToString(" "))
}

private const val SHORT_WORD_LETTERS = 3
private const val FAULT_LETTERS = 6

private const val ONE_LINE_NAME_LENGTH = 16
private const val NO_BREAK_SPACE = '\u00A0'
private const val WORD_JOINER = "\u2060"

/** A date carries the data face (withData); a word on the axis, such as "Today", keeps the text face. */
@Composable
internal fun axisStyle() =
    MaterialTheme.zoonkType.data
        .copy(fontFamily = Geist)
        .wrappedAs(MaterialTheme.typography.labelMedium)

/** Names wrap between words, and inside them only when they must ([BandName.hyphenates]), rather than being cut. */
@Composable
private fun bandStyle(hyphenates: Boolean = false) =
    MaterialTheme.typography.labelMedium
        .copy(hyphens = if (hyphenates) Hyphens.Auto else Hyphens.None)
        .balanced()

private class BandLayout(
    val names: List<BandName>,
    val widths: List<Dp>,
    val height: Dp,
)

internal enum class BandFit { PARTS, WORDS, LETTERS }

/** A band's fit, and the width it's held to when the row sets one. */
internal data class BandSize(
    val fit: BandFit,
    val width: Int?,
)

/**
 * Main's `fitBandSizes`: how the bands share a row [available] wide (gaps left out), from each band's least width
 * with its name's parts kept whole ([parts]) and with it broken between words ([words]). When every band fits its
 * parts, they keep them. Otherwise each band is held to one shared width, never under its longest word nor over
 * its parts, the widest that fits the row, so a short name keeps its two lines and only the longest take more.
 * When not even the longest words fit, the names break inside words.
 */
internal fun fitBandSizes(
    available: Int,
    parts: List<Int>,
    words: List<Int>,
): List<BandSize> {
    if (parts.sum() <= available) return parts.map { BandSize(BandFit.PARTS, null) }
    if (words.sum() > available) return parts.map { BandSize(BandFit.LETTERS, null) }

    fun widthsAt(cap: Int) = parts.mapIndexed { index, part -> minOf(part, maxOf(words[index], cap)) }

    var low = 0
    var high = parts.max()
    while (low < high) {
        val cap = (low + high + 1) / 2
        if (widthsAt(cap).sum() <= available) low = cap else high = cap - 1
    }
    return widthsAt(low).mapIndexed { index, width -> BandSize(if (width >= parts[index]) BandFit.PARTS else BandFit.WORDS, width) }
}

/**
 * Main's bands: each drawn to its phase's time but never narrower than its name ([fitBandSizes] picks how the
 * names break), and every band in the row as tall as the one whose name takes the most lines. Sizes are whole
 * pixels rounded as the band's padding and the row's gaps round them, so a name measured to fit does.
 */
@Composable
private fun bandLayout(
    parted: List<BandName>,
    loose: List<BandName>,
    weights: List<Float>,
    width: Dp,
    dates: List<AnnotatedString?>,
): BandLayout {
    val measurer = rememberTextMeasurer()
    val style = bandStyle()
    val dateStyle = axisStyle()

    with(LocalDensity.current) {
        fun measure(
            name: BandName,
            maxWidth: Int = Constraints.Infinity,
        ) = measurer.measure(
            name.text,
            if (name.hyphenates) style.copy(hyphens = Hyphens.Auto) else style,
            constraints = Constraints(maxWidth = maxWidth),
            placeholders = name.placeholders,
        )

        val padding = BAND_PADDING_X.roundToPx() * 2
        val narrowest = MIN_BAND_WIDTH.roundToPx()
        val gap = BAND_GAP.roundToPx()
        val total = width.roundToPx()
        val dateFloors = dates.map { date -> max(narrowest, date?.let { measurer.measure(it, dateStyle).size.width + padding } ?: 0) }

        fun least(names: List<BandName>) =
            names.mapIndexed { index, name ->
                max(dateFloors[index], ceil(measure(name).multiParagraph.intrinsics.minIntrinsicWidth).toInt() + padding)
            }

        val partsLeast = least(parted)
        val sizes = fitBandSizes(total - gap * (parted.size - 1), partsLeast, least(loose))
        val names =
            sizes.mapIndexed { index, size ->
                when (size.fit) {
                    BandFit.PARTS -> parted[index]
                    BandFit.WORDS -> loose[index]
                    BandFit.LETTERS -> loose[index].let { BandName(it.plain, it.text, it.placeholders, hyphenates = true) }
                }
            }
        val minimums =
            sizes.mapIndexed { index, size ->
                size.width ?: if (size.fit == BandFit.PARTS) partsLeast[index] else narrowest
            }
        val floors = minimums.mapIndexed { index, minimum -> max(minimum, dateFloors[index]) }
        val widths = weightedWidths(weights, total.toFloat(), floors.map(Int::toFloat), gap.toFloat()).map { floor(it).toInt() }
        val text = names.indices.maxOfOrNull { measure(names[it], (widths[it] - padding).coerceAtLeast(0)).size.height } ?: 0
        return BandLayout(names, widths.map { it.toDp() }, max(BAND_HEIGHT.roundToPx(), text + BAND_PADDING_Y.roundToPx() * 2).toDp())
    }
}

@Composable
private fun PhaseColumn(
    page: PlanPageState,
    phase: PlanPhase,
    name: BandName,
    width: Dp,
    bandHeight: Dp,
    isLast: Boolean,
    dated: Boolean,
    overrun: PlanOverrun?,
    hasOverrun: Boolean,
    todayRow: Boolean,
    onOpen: () -> Unit,
) {
    val todayShare = if (phase.state == PlanPhase.State.CURRENT) phase.shareAt(page.today, DayPart.Start) else null

    Column(Modifier.width(width)) {
        // Every column keeps the row, so the bands stay on one line.
        if (todayRow) TodayLabel(todayShare)
        PhaseBand(page, phase, name, bandHeight, todayShare, onOpen)
        PhaseLane(page, phase, isLast, overrun, hasOverrun)
        PhaseAxis(page, phase, isLast, dated, overrun, hasOverrun)
    }
}

/** Main's `TodayTick`: "Today" over the current band, at its day; the band draws the tick's top under it. */
@Composable
private fun TodayLabel(share: Float?) {
    val style = axisStyle()
    val line = with(LocalDensity.current) { style.lineHeight.toDp() }

    FractionRow(
        Modifier
            .fillMaxWidth()
            .padding(bottom = TODAY_STUB)
            .height(line)
            .clearAndSetSemantics {},
    ) {
        share?.let {
            At(it, if (it < MIDDLE_SHARE) Anchor.Start else Anchor.End) {
                Text(stringResource(R.string.plan_today), style = style, color = MaterialTheme.colorScheme.onSurface, maxLines = 1)
            }
        }
    }
}

/** Where today's tick stands in a band, off its rounded corners. */
private fun DrawScope.todayX(share: Float): Float {
    val corner = BAND_RADIUS.toPx()
    val point = size.width * if (layoutDirection == LayoutDirection.Rtl) 1 - share else share
    return point.coerceIn(corner, max(corner, size.width - corner - TODAY_LINE.toPx()))
}

/**
 * Today's line inside a band, top to bottom, with a gap where it would cross the name ([name], centered at the
 * band's start), so it never reads as a stroke of a letter. At least [TODAY_MIN_SEGMENT] of it shows over and
 * under the name, so it always reaches into the band.
 */
private fun DrawScope.drawTodayThrough(
    x: Float,
    ink: Color,
    name: IntSize,
) {
    val line = TODAY_LINE.toPx()
    val gap = TODAY_NAME_GAP.toPx()
    val padding = BAND_PADDING_X.toPx()
    val left = if (layoutDirection == LayoutDirection.Rtl) size.width - padding - name.width else padding
    if (x + line < left - gap || x > left + name.width + gap) {
        drawRect(ink, Offset(x, 0f), Size(line, size.height))
        return
    }
    val middle = size.height / 2
    val half = min(name.height / 2f + gap, middle - TODAY_MIN_SEGMENT.toPx())
    drawRect(ink, Offset(x, 0f), Size(line, middle - half))
    drawRect(ink, Offset(x, middle + half), Size(line, middle - half))
}

private val TODAY_NAME_GAP = 2.dp
private val TODAY_MIN_SEGMENT = 4.dp

/** The tick's top, from "Today" down to the band. */
private val TODAY_STUB = 4.dp
private val TODAY_LINE = 1.5.dp
private const val COVERED_ALPHA = 0.3f
private val BAND_HEIGHT = 32.dp
private val BAND_RADIUS = ZoonkRadius.md
private val BAND_GAP = 8.dp
private val BAND_PADDING_X = 10.dp
private val BAND_PADDING_Y = 4.dp
private val MIN_BAND_WIDTH = 72.dp
private const val CHECK = "check"
private val CHECK_MARK = Placeholder(1.5.em, 1.2.em, PlaceholderVerticalAlign.TextCenter)
private const val CURRENT = "current"
private val CURRENT_MARK = Placeholder(1.em, 1.2.em, PlaceholderVerticalAlign.TextCenter)

@Composable
private fun PhaseBand(
    page: PlanPageState,
    phase: PlanPhase,
    name: BandName,
    height: Dp,
    todayShare: Float?,
    onOpen: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    // "Foundations, you are here, Ends Feb 16, 2027": the end every other place names the phase by.
    val label = listOfNotNull(name.plain + phaseStateWords(phase.state), phaseEnd(page, phase)?.spoken).joinToString(", ")
    val (container, content) =
        when (phase.state) {
            PlanPhase.State.CURRENT -> colors.surfaceContainerHighest to colors.onSurface
            PlanPhase.State.DONE -> colors.tertiaryContainer to colors.onTertiaryContainer
            else -> colors.surfaceContainerHigh to colors.onSurfaceVariant
        }
    val current = phase.state == PlanPhase.State.CURRENT
    val share = phase.lessonShare()
    val ink = colors.onSurface
    var nameSize by remember { mutableStateOf(IntSize.Zero) }

    Surface(
        onClick = onOpen,
        modifier =
            Modifier
                .fillMaxWidth()
                // Before the height, so the tick meets the band rather than the 48dp touch target Surface centers on it.
                .drawBehind {
                    todayShare ?: return@drawBehind
                    val stub = TODAY_STUB.toPx()
                    drawRect(ink, Offset(todayX(todayShare), -stub), Size(TODAY_LINE.toPx(), stub))
                }.height(height)
                .semantics { contentDescription = label },
        shape = RoundedCornerShape(BAND_RADIUS),
        color = container,
        contentColor = content,
    ) {
        // The part already covered, tinted under the name: a line at the band's edge read as a thicker ring.
        // Today's tick runs on through the band, over its fill, so "Today" over it points at one day; it breaks around the name.
        Box(
            Modifier.drawBehind {
                if (current &&
                    share > 0
                ) {
                    val width = size.width * share
                    val left = if (layoutDirection == LayoutDirection.Rtl) size.width - width else 0f
                    drawRect(colors.tertiary.copy(alpha = COVERED_ALPHA), Offset(left, 0f), Size(width, size.height))
                }
                todayShare?.let { drawTodayThrough(todayX(it), ink, nameSize) }
            },
        ) {
            Text(
                text = name.text,
                // The band's description already says its name, as main's band's label does.
                modifier =
                    Modifier
                        .padding(horizontal = BAND_PADDING_X, vertical = BAND_PADDING_Y)
                        .align(Alignment.CenterStart)
                        .clearAndSetSemantics {},
                style = bandStyle(name.hyphenates),
                onTextLayout = { nameSize = it.size },
                inlineContent =
                    mapOf(
                        // Main's `CurrentPhaseMark` before the current phase's name: an ink dot in a faint ring.
                        CURRENT to
                            InlineTextContent(CURRENT_MARK) {
                                Canvas(Modifier.fillMaxSize()) {
                                    val middle = Offset(5.dp.toPx(), size.height / 2)
                                    drawCircle(ink.copy(alpha = CURRENT_RING_ALPHA), radius = 5.dp.toPx(), center = middle)
                                    drawCircle(ink, radius = 3.dp.toPx(), center = middle)
                                }
                            },
                        CHECK to
                            InlineTextContent(CHECK_MARK) {
                                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                                    Icon(
                                        painterResource(R.drawable.ic_check),
                                        contentDescription = null,
                                        Modifier.fillMaxHeight().aspectRatio(1f),
                                    )
                                }
                            },
                    ),
            )
        }
    }
}

@Composable
private fun PhaseLane(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
    overrun: PlanOverrun?,
    hasOverrun: Boolean,
) {
    val mockShare = phase.mocks.nextDate?.let { phase.shareAt(it.toJavaLocalDate(), DayPart.Middle) }
    val challengeShare = phase.checkpoint?.date?.let { phase.shareAt(it.toJavaLocalDate(), DayPart.End) }
    val flag = isLast && page.finish != null && !hasOverrun
    val flagTint = MaterialTheme.colorScheme.onSurface

    Box(
        Modifier
            .padding(top = 8.dp)
            .height(16.dp)
            .fillMaxWidth()
            .clearAndSetSemantics {},
    ) {
        FractionRow(Modifier.fillMaxSize(), endRoom = FLAG_ROOM.takeIf { flag }) {
            mockShare?.let { At(it, Anchor.Center) { KindDot(LearnKind.Mock) } }
            challengeShare?.let {
                At(
                    it,
                    if (it >
                        PHASE_END_SHARE
                    ) {
                        Anchor.End
                    } else {
                        Anchor.Center
                    },
                ) { PhaseCheckpointMark(page, Modifier.size(16.dp)) }
            }
            overrun?.let {
                At(
                    it.share,
                    Anchor.Center,
                ) { Icon(painterResource(R.drawable.ic_flag), null, Modifier.size(14.dp), tint = flagTint) }
            }
        }
        if (flag) Icon(painterResource(R.drawable.ic_flag), null, Modifier.align(Alignment.TopEnd).size(14.dp), tint = flagTint)
    }
}

private const val PHASE_END_SHARE = 0.9f
private val FLAG_ROOM = 16.dp

@Composable
private fun PhaseAxis(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
    labelled: Boolean,
    overrun: PlanOverrun?,
    hasOverrun: Boolean,
) {
    val style = axisStyle()
    val faint = MaterialTheme.colorScheme.onSurfaceVariant
    val ink = MaterialTheme.colorScheme.onSurface
    val axisFinish = page.plan.axisFinish(page.goal.kind, page.today)
    val goalShare = overrun?.share?.takeIf { axisFinish != null }
    val goalAtEnd = goalShare != null && goalShare >= MIDDLE_SHARE
    // The legend names the flag's date ("Exam date"), so the axis shows the date alone, in the data face.
    val goalDate = page.finish?.let { dateValue(planDate(it.date, page.today, it.estimate, it.month, it.year).text) }
    val end = phaseEnd(page, phase)?.let { if (it.date) dateValue(it.text) else AnnotatedString(it.text) }
    // A phase's end gives way when it meets an earlier label: its row on the path says it.
    val labels =
        listOfNotNull(
            goalShare?.let { at -> goalDate?.let { AxisLabel(it, ink, at) } },
            end?.takeIf { labelled && !goalAtEnd }?.let { AxisLabel(it, faint, 1f, givesWay = true) },
            when {
                !isLast || goalAtEnd -> null
                hasOverrun -> end?.let { AxisLabel(it, faint, 1f, givesWay = true) }
                axisFinish != null -> goalDate?.let { AxisLabel(it, ink, 1f) }
                else -> null
            },
        )

    Layout(
        content = {
            labels.forEach {
                Text(
                    it.text,
                    style = style,
                    color = it.color,
                    textAlign = if (it.share < MIDDLE_SHARE) layoutStart() else layoutEnd(),
                )
            }
        },
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val placeables = measurables.map { it.measure(Constraints(maxWidth = width)) }
        val places =
            axisLabelPlaces(
                labels.map { it.share },
                placeables.map { IntSize(it.width, it.height) },
                width,
                AXIS_GAP.roundToPx(),
                labels.map { it.givesWay },
            )
        val height = placeables.indices.maxOfOrNull { index -> places[index]?.let { it.y + placeables[index].height } ?: 0 } ?: 0

        layout(width, max(AXIS_LINE.roundToPx(), height)) {
            placeables.forEachIndexed { index, placeable -> places[index]?.let { placeable.placeRelative(it) } }
        }
    }
}

private class AxisLabel(
    val text: AnnotatedString,
    val color: Color,
    val share: Float,
    val givesWay: Boolean = false,
)

/**
 * Main's `AxisLabel`, for labels in point order, each measured no wider than the phase: a label that meets the
 * one before takes the next line, unless it [givesWay], when it isn't shown (null).
 */
internal fun axisLabelPlaces(
    shares: List<Float>,
    sizes: List<IntSize>,
    width: Int,
    gap: Int,
    givesWay: List<Boolean> = shares.map { false },
): List<IntOffset?> {
    var top = 0
    var lineHeight = 0
    var lineEnd: Int? = null

    return shares.indices.map { index ->
        val size = sizes[index]
        val point = (width * shares[index]).roundToInt()
        val x = (if (shares[index] < MIDDLE_SHARE) point else point - size.width).coerceIn(0, max(0, width - size.width))
        val end = lineEnd
        val meets = end != null && x < end + gap
        if (meets && givesWay[index]) return@map null
        if (meets) {
            top += lineHeight
            lineHeight = 0
        }
        lineHeight = max(lineHeight, size.height)
        lineEnd = x + size.width
        IntOffset(x, top)
    }
}

private val AXIS_LINE = 16.dp
private val AXIS_GAP = 8.dp

private const val MIDDLE_SHARE = 0.5f

internal enum class Anchor { Start, Center, End }

private class FractionScope {
    val items = mutableListOf<Triple<Float, Anchor, @Composable () -> Unit>>()

    @Suppress("FunctionName")
    fun At(
        share: Float,
        anchor: Anchor,
        content: @Composable () -> Unit,
    ) {
        items += Triple(share, anchor, content)
    }
}

@Composable
private fun FractionRow(
    modifier: Modifier,
    endRoom: Dp? = null,
    content: FractionScope.() -> Unit,
) {
    val items = FractionScope().apply(content).items
    Layout(content = { items.forEach { it.third() } }, modifier = modifier) { measurables, constraints ->
        val placeables = measurables.map { it.measure(Constraints()) }
        val end = endRoom?.let { constraints.maxWidth - it.roundToPx() }
        layout(
            constraints.maxWidth,
            constraints.maxHeight.takeIf { it != Constraints.Infinity } ?: placeables.maxOfOrNull { it.height } ?: 0,
        ) {
            placeables.forEachIndexed { index, placeable ->
                val (share, anchor) = items[index]
                val x = (constraints.maxWidth * share).roundToInt()
                val left =
                    when (anchor) {
                        Anchor.Start -> x
                        Anchor.Center -> x - placeable.width / 2
                        Anchor.End -> x - placeable.width
                    }
                placeable.placeRelative(end?.let { left.coerceAtMost(it - placeable.width) } ?: left, 0)
            }
        }
    }
}

@Composable
internal fun phaseStateWords(state: PlanPhase.State): String =
    when (state) {
        PlanPhase.State.CURRENT -> stringResource(R.string.plan_you_are_here_suffix)
        PlanPhase.State.DONE -> stringResource(R.string.plan_done_suffix)
        else -> ""
    }
