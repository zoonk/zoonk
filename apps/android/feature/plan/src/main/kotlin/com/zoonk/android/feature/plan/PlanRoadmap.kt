package com.zoonk.android.feature.plan

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.Hyphens
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.components.glyphScale
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.Geist
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.PlanPhase
import kotlinx.datetime.toJavaLocalDate
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
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
    if (phases.size < 2) return

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val bandsFit = MIN_BAND_WIDTH * phases.size + BAND_GAP * (phases.size - 1) <= maxWidth
        if (maxWidth < FULL_ROADMAP_WIDTH || !bandsFit) {
            RoadmapCompact(page, phases, onOpenPath)
        } else {
            RoadmapFull(page, phases, links, maxWidth)
        }
    }
}

private val FULL_ROADMAP_WIDTH = 560.dp

private data class RoadmapPosition(
    val name: String,
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
        phaseName(current, page.mocksRequirePlus),
        phaseEnd(page, current),
        index + 1,
        phases.size,
    )
}

@Composable
private fun RoadmapCompact(
    page: PlanPageState,
    phases: List<PlanPhase>,
    onOpen: (() -> Unit)?,
) {
    val position = roadmapPosition(page, phases)
    val done = phases.count { it.state == PlanPhase.State.DONE }
    val small = MaterialTheme.typography.labelMedium
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
        RoadmapMeter(phases)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (position != null) {
                Text(
                    text =
                        positionWords(
                            stringResource(R.string.plan_roadmap_phase_number, position.number, position.total),
                            listOf(position.name),
                        ),
                    modifier = Modifier.weight(1f),
                    style = small,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                position.end?.let { TrailingText(it) }
            } else {
                Text(
                    text = pluralStringResource(R.plurals.plan_phases_done, phases.size, done, phases.size),
                    modifier = Modifier.weight(1f),
                    style = small,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (onOpen != null) ListRowChevron()
        }
    }
}

@Composable
private fun RoadmapMeter(phases: List<PlanPhase>) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val fill = MaterialTheme.colorScheme.tertiary
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Canvas(
        Modifier
            .fillMaxWidth()
            .height(8.dp)
            .clearAndSetSemantics {},
    ) {
        val gap = 2.dp.toPx()
        val minimum = 24.dp.toPx()
        val ring = 1.5.dp.toPx()
        val radius = CornerRadius(size.height / 2)
        val widths = weightedWidths(phases.map { it.weight() }, size.width, List(phases.size) { minimum }, gap)
        var start = 0f

        phases.forEachIndexed { index, phase ->
            val width = widths[index]
            val left = if (rtl) size.width - start - width else start
            drawRoundRect(track, Offset(left, 0f), Size(width, size.height), radius)
            val done = width * phase.lessonShare()
            if (done > 0) {
                drawRoundRect(fill, Offset(if (rtl) left + width - done else left, 0f), Size(done, size.height), radius)
            }
            if (phase.state == PlanPhase.State.CURRENT) {
                drawRoundRect(
                    color = fill,
                    topLeft = Offset(left + ring / 2, ring / 2),
                    size = Size(width - ring, size.height - ring),
                    cornerRadius = radius,
                    style = Stroke(ring),
                )
            }
            start += width + gap
        }
    }
}

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
    val weights = phases.map { it.weight() }
    // Each name's parts kept whole when every band fits its widest part; otherwise the names break between words.
    val parted = phases.map { bandName(it, phaseName(it, page.mocksRequirePlus), keepParts = true) }
    val loose = phases.map { bandName(it, phaseName(it, page.mocksRequirePlus), keepParts = false) }
    val partedBands = bandLayout(parted, weights, width)
    val looseBands = bandLayout(loose, weights, width)
    val names = if (partedBands.fitsWords) parted else loose
    val bands = if (partedBands.fitsWords) partedBands else looseBands

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
                    name = names[index],
                    width = bands.widths[index],
                    bandHeight = bands.height,
                    isLast = index == phases.lastIndex,
                    shownWhen = phaseWhen(index, currentIndex),
                    overrun = overrun?.takeIf { it.phaseIndex == phase.index },
                    hasOverrun = overrun != null,
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
                { Trickster(Modifier.size(16.dp * glyphScale()), face = true) },
            ) { Text(challengeName(page), style = style, color = color) }
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
                Text(stringResource(if (page.isExam) R.string.plan_exam_day else R.string.plan_goal_date), style = style, color = color)
            }
        }
    }
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

/** Main's `getPhaseWhen`: what the axis says under a phase, "Today" under the current one and the start of each after it. */
private enum class PhaseWhen { Today, Start }

private fun phaseWhen(
    position: Int,
    currentIndex: Int,
): PhaseWhen? =
    when {
        position == currentIndex -> PhaseWhen.Today
        currentIndex != -1 && position > currentIndex -> PhaseWhen.Start
        else -> null
    }

/** A band's name; a done phase's check sits in its first line, so a narrow band's lines get its whole width. */
private class BandName(
    val plain: String,
    val text: AnnotatedString,
    val placeholders: List<AnnotatedString.Range<Placeholder>>,
)

private fun bandName(
    phase: PlanPhase,
    name: String,
    keepParts: Boolean,
): BandName {
    // Each part keeps its words together, so a band is as wide as its widest part and breaks only between parts.
    val shown = if (keepParts) bandNameParts(name).joinToString(" ") { it.replace(' ', NO_BREAK_SPACE) } else name
    return if (phase.state == PlanPhase.State.DONE) {
        val text =
            buildAnnotatedString {
                appendInlineContent(CHECK, "✓")
                append(WORD_JOINER)
                append(shown)
            }
        BandName(name, text, listOf(AnnotatedString.Range(CHECK_MARK, 0, 1)))
    } else {
        BandName(name, AnnotatedString(shown), emptyList())
    }
}

/** Main's `splitBandName`: a short name is one part; a longer one is cut between words where its longer part is shortest. */
internal fun bandNameParts(name: String): List<String> {
    val words = name.split(" ")
    if (name.length <= ONE_LINE_NAME_LENGTH || words.size == 1) return listOf(name)
    val cut = (1 until words.size).minBy { maxOf(words.take(it).joinToString(" ").length, words.drop(it).joinToString(" ").length) }
    return listOf(words.take(cut).joinToString(" "), words.drop(cut).joinToString(" "))
}

private const val ONE_LINE_NAME_LENGTH = 16
private const val NO_BREAK_SPACE = '\u00A0'
private const val WORD_JOINER = "\u2060"

/** Names wrap and hyphenate rather than being cut. */
@Composable
private fun bandStyle() = MaterialTheme.typography.labelMedium.copy(hyphens = Hyphens.Auto, lineBreak = LineBreak.Heading)

private class BandLayout(
    val widths: List<Dp>,
    val height: Dp,
    /** Every band is at least as wide as its name's longest unbreakable run. */
    val fitsWords: Boolean,
)

/**
 * Main's bands: each drawn to its phase's time but never narrower than its name's longest word, and
 * every band in the row as tall as the one whose name takes the most lines. When the longest words
 * don't fit the row, each band keeps only the floor and its name hyphenates. Sizes are whole pixels
 * rounded as the band's padding and the row's gaps round them, so a name measured to fit does.
 */
@Composable
private fun bandLayout(
    names: List<BandName>,
    weights: List<Float>,
    width: Dp,
): BandLayout {
    val measurer = rememberTextMeasurer()
    val style = bandStyle()

    with(LocalDensity.current) {
        fun measure(
            name: BandName,
            maxWidth: Int = Constraints.Infinity,
        ) = measurer.measure(name.text, style, constraints = Constraints(maxWidth = maxWidth), placeholders = name.placeholders)

        val padding = BAND_PADDING_X.roundToPx() * 2
        val narrowest = MIN_BAND_WIDTH.roundToPx()
        val gap = BAND_GAP.roundToPx()
        val total = width.roundToPx()
        val words = names.map { max(narrowest, ceil(measure(it).multiParagraph.intrinsics.minIntrinsicWidth).toInt() + padding) }
        val fitsWords = words.sum() + gap * (names.size - 1) <= total
        val minimums = if (fitsWords) words else List(names.size) { narrowest }
        val widths = weightedWidths(weights, total.toFloat(), minimums.map(Int::toFloat), gap.toFloat()).map { floor(it).toInt() }
        val text = names.indices.maxOfOrNull { measure(names[it], (widths[it] - padding).coerceAtLeast(0)).size.height } ?: 0
        return BandLayout(widths.map { it.toDp() }, max(BAND_HEIGHT.roundToPx(), text + BAND_PADDING_Y.roundToPx() * 2).toDp(), fitsWords)
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
    shownWhen: PhaseWhen?,
    overrun: PlanOverrun?,
    hasOverrun: Boolean,
    onOpen: () -> Unit,
) {
    val todayShare = if (phase.state == PlanPhase.State.CURRENT) phase.shareAt(page.today, DayPart.Start) else null

    Column(Modifier.width(width)) {
        PhaseBand(page, phase, name, bandHeight, isLast, shownWhen, todayShare, onOpen)
        PhaseLane(page, phase, isLast, overrun, hasOverrun)
        PhaseAxis(page, phase, isLast, shownWhen == PhaseWhen.Start, todayShare, overrun, hasOverrun, width)
    }
}

private val BAND_HEIGHT = 32.dp
private val BAND_GAP = 3.dp
private val BAND_PADDING_X = 10.dp
private val BAND_PADDING_Y = 4.dp
private val MIN_BAND_WIDTH = 72.dp
private const val CHECK = "check"
private val CHECK_MARK = Placeholder(1.5.em, 1.2.em, PlaceholderVerticalAlign.TextCenter)

@Composable
private fun PhaseBand(
    page: PlanPageState,
    phase: PlanPhase,
    name: BandName,
    height: Dp,
    isLast: Boolean,
    shownWhen: PhaseWhen?,
    todayShare: Float?,
    onOpen: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val whenWords =
        phase.start?.let { start ->
            when (shownWhen) {
                PhaseWhen.Today -> stringResource(R.string.plan_today)
                PhaseWhen.Start -> stringResource(R.string.plan_roadmap_from, formatPlanDate(start, page.today, currentLocale()))
                null -> null
            }
        }
    val ends =
        page.finish
            ?.takeIf {
                isLast
            }?.let { endWords(formatPlanDate(it.date, page.today, currentLocale(), it.month), it.estimate, it.month).spoken }
    val label = listOfNotNull(name.plain + phaseStateWords(phase.state), whenWords, ends).joinToString(". ")
    val (container, content) =
        when (phase.state) {
            PlanPhase.State.CURRENT -> colors.surfaceContainerHighest to colors.onSurface
            PlanPhase.State.DONE -> colors.tertiaryContainer to colors.onTertiaryContainer
            else -> colors.surfaceContainerHigh to colors.onSurfaceVariant
        }
    val current = phase.state == PlanPhase.State.CURRENT
    val share = phase.lessonShare()
    val ink = colors.onSurface

    Surface(
        onClick = onOpen,
        modifier =
            Modifier
                .fillMaxWidth()
                // Before the height, so the ticks meet the band rather than the 48dp touch target Surface centers on it.
                .drawBehind {
                    todayShare ?: return@drawBehind
                    val x = size.width * if (layoutDirection == LayoutDirection.Rtl) 1 - todayShare else todayShare
                    val tick = 6.dp.toPx()
                    val line = 1.5.dp.toPx()
                    drawRect(ink, Offset(x, -tick), Size(line, tick))
                    drawRect(ink, Offset(x, size.height), Size(line, tick))
                }.height(height)
                .semantics { contentDescription = label },
        shape = MaterialTheme.shapes.small,
        color = container,
        contentColor = content,
        border = if (current) BorderStroke(1.5.dp, colors.tertiary) else null,
    ) {
        Box(
            Modifier.drawBehind {
                if (current &&
                    share > 0
                ) {
                    val width = size.width * share
                    val left = if (layoutDirection == LayoutDirection.Rtl) size.width - width else 0f
                    drawRect(colors.tertiary, Offset(left, size.height - 2.dp.toPx()), Size(width, 2.dp.toPx()))
                }
            },
        ) {
            Text(
                text = name.text,
                modifier = Modifier.padding(horizontal = BAND_PADDING_X, vertical = BAND_PADDING_Y).align(Alignment.CenterStart),
                style = bandStyle(),
                inlineContent =
                    mapOf(
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
                ) { Trickster(Modifier.size(16.dp), face = true) }
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
    todayShare: Float?,
    overrun: PlanOverrun?,
    hasOverrun: Boolean,
    width: Dp,
) {
    // A date carries the data face (withData); a word on the axis, such as "Today", keeps the text face.
    val style = MaterialTheme.zoonkType.data.copy(fontFamily = Geist, lineBreak = LineBreak.Heading)
    val faint = MaterialTheme.colorScheme.onSurfaceVariant
    val ink = MaterialTheme.colorScheme.onSurface
    val overrunSide = overrun?.let { if (it.share < MIDDLE_SHARE) Anchor.Start else Anchor.End }
    val start = phase.start?.takeIf { labelled && overrunSide != Anchor.Start && (!isLast || width >= 160.dp) }
    val finishShown = isLast && overrunSide != Anchor.End
    val finishWords = page.finish?.let { planDate(it.date, page.today, it.estimate, it.month) }
    val examFinish =
        finishWords?.let {
            if (page.isExam &&
                width >= 128.dp
            ) {
                withData(stringResource(R.string.plan_exam_date_label, it.text), it.text)
            } else {
                withData(it.text, it.text)
            }
        }
    val overrunEnd = phase.end?.takeIf { hasOverrun }
    val labels =
        listOfNotNull(
            todayShare?.takeIf { overrun == null }?.let { AxisLabel(AnnotatedString(stringResource(R.string.plan_today)), ink, it) },
            start?.let {
                // A learn phase's start is an estimate, marked as the list marks it; an exam phase's is booked.
                val learn = phase.kind == PlanPhase.Kind.LEARN
                val date = planDate(it, page.today, estimate = learn, month = learn)
                AxisLabel(withData(date.text, date.text), faint, 0f)
            },
            overrun?.let { at -> examFinish?.let { AxisLabel(it, ink, at.share) } },
            when {
                !finishShown -> null
                overrunEnd != null -> formatPlanDate(overrunEnd, page.today, currentLocale()).let { AxisLabel(withData(it, it), faint, 1f) }
                examFinish != null -> AxisLabel(examFinish, ink, 1f)
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
                    textAlign = if (it.share < MIDDLE_SHARE) TextAlign.Start else TextAlign.End,
                )
            }
        },
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val placeables = measurables.map { it.measure(Constraints(maxWidth = width)) }
        val places = axisLabelPlaces(labels.map { it.share }, placeables.map { IntSize(it.width, it.height) }, width, AXIS_GAP.roundToPx())
        val height = placeables.indices.maxOfOrNull { places[it].y + placeables[it].height } ?: 0

        layout(width, max(AXIS_LINE.roundToPx(), height)) {
            placeables.forEachIndexed { index, placeable -> placeable.placeRelative(places[index]) }
        }
    }
}

private class AxisLabel(
    val text: AnnotatedString,
    val color: Color,
    val share: Float,
)

/** Main's `AxisLabel`, for labels in point order, each measured no wider than the phase. */
internal fun axisLabelPlaces(
    shares: List<Float>,
    sizes: List<IntSize>,
    width: Int,
    gap: Int,
): List<IntOffset> {
    var top = 0
    var lineHeight = 0
    var lineEnd: Int? = null

    return shares.zip(sizes) { share, size ->
        val point = (width * share).roundToInt()
        val x = (if (share < MIDDLE_SHARE) point else point - size.width).coerceIn(0, max(0, width - size.width))
        val end = lineEnd
        if (end != null && x < end + gap) {
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
private fun positionWords(
    name: String,
    details: List<String>,
): AnnotatedString {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    return buildAnnotatedString {
        append(name)
        withStyle(SpanStyle(color = quiet)) { details.forEach { append("$FACT_SEPARATOR$it") } }
    }
}

@Composable
internal fun phaseStateWords(state: PlanPhase.State): String =
    when (state) {
        PlanPhase.State.CURRENT -> stringResource(R.string.plan_you_are_here_suffix)
        PlanPhase.State.DONE -> stringResource(R.string.plan_done_suffix)
        else -> ""
    }
