package com.zoonk.android.feature.plan

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlanPhase
import kotlinx.datetime.toJavaLocalDate
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
        if (maxWidth < FULL_ROADMAP_WIDTH) {
            RoadmapCompact(page, phases, onOpenPath)
        } else {
            RoadmapFull(page, phases, links)
        }
    }
}

private val FULL_ROADMAP_WIDTH = 560.dp

private data class RoadmapPosition(
    val name: String,
    val day: String?,
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
    val day = current.dayOf(page.today)?.let { stringResource(R.string.plan_roadmap_day_of, it.day, it.days) }
    return RoadmapPosition(phaseName(current, page.mocksRequirePlus), day, index + 1, phases.size)
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
                    text = positionWords(position.name, listOfNotNull(position.day)),
                    modifier = Modifier.weight(1f),
                    style = small,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val spoken = stringResource(R.string.plan_roadmap_phase_of, position.number, position.total)
                Text(
                    text = stringResource(R.string.plan_roadmap_number_of, position.number, position.total),
                    modifier = Modifier.semantics { contentDescription = spoken },
                    style = small.withTabularFigures(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text(
                    text = pluralStringResource(R.plurals.plan_phases_done, phases.size, done, phases.size),
                    modifier = Modifier.weight(1f),
                    style = small,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
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
        val widths = weightedWidths(phases.map { it.weight() }, size.width, minimum, gap)
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

/** Each part gets [minimum], then its share of what's left by weight, as main's flex rows do. */
internal fun weightedWidths(
    weights: List<Float>,
    total: Float,
    minimum: Float,
    gap: Float,
): List<Float> {
    val shared = (total - weights.size * minimum - (weights.size - 1).coerceAtLeast(0) * gap).coerceAtLeast(0f)
    val sum = weights.sum()
    return weights.map { minimum + if (sum > 0) shared * it / sum else 0f }
}

@Composable
private fun RoadmapFull(
    page: PlanPageState,
    phases: List<PlanPhase>,
    links: PlanLinks,
) {
    var opened by rememberSaveable { mutableStateOf<Long?>(null) }
    val position = roadmapPosition(page, phases)
    val currentIndex = phases.indexOfFirst { it.state == PlanPhase.State.CURRENT }
    val overrun = page.plan.overrun(page.goal.kind)

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            position?.let {
                Text(
                    text =
                        positionWords(
                            it.name,
                            listOfNotNull(it.day, stringResource(R.string.plan_roadmap_phase_of, it.number, it.total)),
                        ),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            RoadmapLegend(page, phases)
        }
        WeightedRow(weights = phases.map { it.weight() }, minimum = 64.dp, gap = 3.dp) {
            phases.forEachIndexed { index, phase ->
                PhaseColumn(
                    page = page,
                    phase = phase,
                    isLast = index == phases.lastIndex,
                    labelled = currentIndex != -1 && index > currentIndex,
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

    Row(
        modifier = Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (hasMocks) {
            KindDot(LearnKind.Mock)
            Text(stringResource(R.string.plan_mock_exam), style = style, color = color)
        }
        if (hasChallenges) {
            Trickster(Modifier.size(14.dp))
            Text(stringResource(R.string.plan_phase_challenge), style = style, color = color)
        }
        if (page.finish != null) {
            Icon(painterResource(R.drawable.ic_flag), contentDescription = null, modifier = Modifier.size(14.dp), tint = color)
            Text(stringResource(if (page.isExam) R.string.plan_exam_day else R.string.plan_goal_date), style = style, color = color)
        }
    }
}

@Composable
private fun PhaseColumn(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
    labelled: Boolean,
    overrun: PlanOverrun?,
    hasOverrun: Boolean,
    onOpen: () -> Unit,
) {
    val todayShare = if (phase.state == PlanPhase.State.CURRENT) phase.shareAt(page.today, DayPart.Start) else null
    val ink = MaterialTheme.colorScheme.onSurface

    BoxWithConstraints {
        val width = maxWidth
        Column(
            Modifier.drawBehind {
                todayShare ?: return@drawBehind
                val x = size.width * if (layoutDirection == LayoutDirection.Rtl) 1 - todayShare else todayShare
                val tick = 6.dp.toPx()
                val line = 1.5.dp.toPx()
                drawRect(ink, Offset(x, -tick), Size(line, tick))
                drawRect(ink, Offset(x, BAND_HEIGHT.toPx()), Size(line, tick))
            },
        ) {
            PhaseBand(page, phase, isLast, onOpen)
            PhaseLane(page, phase, isLast, overrun, hasOverrun)
            PhaseAxis(page, phase, isLast, labelled, todayShare, overrun, hasOverrun, width)
        }
    }
}

private val BAND_HEIGHT = 32.dp

@Composable
private fun PhaseBand(
    page: PlanPageState,
    phase: PlanPhase,
    isLast: Boolean,
    onOpen: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val name = phaseName(phase, page.mocksRequirePlus)
    val from = phase.start?.let { stringResource(R.string.plan_roadmap_from, formatPlanDate(it, page.today, currentLocale())) }
    val until =
        page.finish
            ?.takeIf {
                isLast
            }?.let { stringResource(R.string.plan_roadmap_until, planDate(it.date, page.today, it.estimate, it.month).spoken) }
    val label = listOfNotNull(name + phaseStateWords(phase.state), from, until).joinToString(". ")
    val (container, content) =
        when (phase.state) {
            PlanPhase.State.CURRENT -> colors.surfaceContainerHighest to colors.onSurface
            PlanPhase.State.DONE -> colors.tertiaryContainer to colors.onTertiaryContainer
            else -> colors.surfaceContainerHigh to colors.onSurfaceVariant
        }
    val current = phase.state == PlanPhase.State.CURRENT
    val share = phase.lessonShare()

    Surface(
        onClick = onOpen,
        modifier =
            Modifier
                .fillMaxWidth()
                .height(BAND_HEIGHT)
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
            Row(
                modifier = Modifier.padding(horizontal = 10.dp).align(Alignment.CenterStart),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (phase.state == PlanPhase.State.DONE) {
                    Icon(painterResource(R.drawable.ic_check), contentDescription = null, modifier = Modifier.size(14.dp))
                }
                Text(text = name, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
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

    FractionRow(
        Modifier
            .padding(top = 4.dp)
            .height(16.dp)
            .fillMaxWidth()
            .clearAndSetSemantics {},
    ) {
        mockShare?.let { At(it, Anchor.Center) { KindDot(LearnKind.Mock) } }
        challengeShare?.let { At(it, if (it > PHASE_END_SHARE) Anchor.End else Anchor.Center) { Trickster(Modifier.size(14.dp)) } }
        if (flag) At(1f, Anchor.End) { Icon(painterResource(R.drawable.ic_flag), null, Modifier.size(14.dp), tint = flagTint) }
        overrun?.let {
            At(
                it.share,
                Anchor.Center,
            ) { Icon(painterResource(R.drawable.ic_flag), null, Modifier.size(14.dp), tint = flagTint) }
        }
    }
}

private const val PHASE_END_SHARE = 0.9f

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
    val style = MaterialTheme.typography.labelSmall.withTabularFigures()
    val faint = MaterialTheme.colorScheme.onSurfaceVariant
    val ink = MaterialTheme.colorScheme.onSurface
    val overrunSide = overrun?.let { if (it.share < MIDDLE_SHARE) Anchor.Start else Anchor.End }
    val start = phase.start?.takeIf { labelled && overrunSide != Anchor.Start && width >= if (isLast) 160.dp else 72.dp }
    val finishShown = isLast && overrunSide != Anchor.End
    val finishWords = page.finish?.let { planDate(it.date, page.today, it.estimate, it.month) }
    val examFinish =
        finishWords?.let {
            if (page.isExam &&
                width >= 128.dp
            ) {
                stringResource(R.string.plan_exam_date_label, it.text)
            } else {
                it.text
            }
        }

    FractionRow(Modifier.height(16.dp).fillMaxWidth().clearAndSetSemantics {}) {
        if (todayShare != null && overrun == null) {
            At(todayShare, sideOf(todayShare)) { Text(stringResource(R.string.plan_today), style = style, color = ink, maxLines = 1) }
        }
        if (overrun != null && examFinish != null) {
            At(overrun.share, sideOf(overrun.share)) { Text(examFinish, style = style, color = ink, maxLines = 1) }
        }
        if (start != null) {
            At(0f, Anchor.Start) {
                Text(
                    formatPlanDate(start, page.today, currentLocale(), month = phase.kind == PlanPhase.Kind.LEARN),
                    style = style,
                    color = faint,
                    maxLines = 1,
                )
            }
        }
        if (finishShown) {
            val end = phase.end
            when {
                hasOverrun && end != null -> {
                    At(1f, Anchor.End) {
                        Text(formatPlanDate(end, page.today, currentLocale()), style = style, color = faint, maxLines = 1)
                    }
                }

                examFinish != null -> {
                    At(1f, Anchor.End) { Text(examFinish, style = style, color = ink, maxLines = 1) }
                }
            }
        }
    }
}

private const val MIDDLE_SHARE = 0.5f

private fun sideOf(share: Float) = if (share < MIDDLE_SHARE) Anchor.Start else Anchor.End

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
    content: FractionScope.() -> Unit,
) {
    val items = FractionScope().apply(content).items
    Layout(content = { items.forEach { it.third() } }, modifier = modifier) { measurables, constraints ->
        val placeables = measurables.map { it.measure(Constraints()) }
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
                placeable.placeRelative(left, 0)
            }
        }
    }
}

@Composable
private fun WeightedRow(
    weights: List<Float>,
    minimum: Dp,
    gap: Dp,
    content: @Composable () -> Unit,
) {
    Layout(content = content, modifier = Modifier.fillMaxWidth()) { measurables, constraints ->
        val gapPx = gap.roundToPx()
        val widths = weightedWidths(weights, constraints.maxWidth.toFloat(), minimum.toPx(), gapPx.toFloat())
        val placeables =
            measurables.mapIndexed {
                index,
                it,
                ->
                it.measure(Constraints.fixedWidth(widths[index].roundToInt().coerceAtLeast(0)))
            }
        layout(constraints.maxWidth, placeables.maxOfOrNull { it.height } ?: 0) {
            var x = 0
            placeables.forEach {
                it.placeRelative(x, 0)
                x += it.width + gapPx
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
        withStyle(SpanStyle(color = quiet)) { details.forEach { append(" · $it") } }
    }
}

@Composable
internal fun phaseStateWords(state: PlanPhase.State): String =
    when (state) {
        PlanPhase.State.CURRENT -> stringResource(R.string.plan_you_are_here_suffix)
        PlanPhase.State.DONE -> stringResource(R.string.plan_done_suffix)
        else -> ""
    }
