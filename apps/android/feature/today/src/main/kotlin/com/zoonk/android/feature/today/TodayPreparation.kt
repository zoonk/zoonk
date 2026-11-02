package com.zoonk.android.feature.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.goalcontent.CoverageBar
import com.zoonk.android.feature.goalcontent.LegendDot
import com.zoonk.android.feature.goalcontent.LegendItem
import com.zoonk.android.feature.goalcontent.bar
import com.zoonk.android.feature.goalcontent.hasSubjectPages
import com.zoonk.android.feature.plan.lessonsStudied
import com.zoonk.android.feature.plan.studiedLessonsLine
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatGoalProgress
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.TodayProgress
import com.zoonk.api.models.TodayProgressOneOf
import com.zoonk.api.models.TodayProgressOneOf1
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Main's `TodayPreparation` for goals other than a language's: an exam's preparation, or the lessons studied, with the subjects behind them. */
@Composable
internal fun TodayPreparation(
    progress: TodayProgress?,
    syllabus: Syllabus?,
    todaySubjects: Set<String>,
    onOpenPlan: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (progress) {
        is TodayProgress.TodayProgressOneOfValue -> PreparationCard(progress.value, syllabus, todaySubjects, onOpenPlan, modifier)
        is TodayProgress.TodayProgressOneOf1Value -> LessonsCard(progress.value, syllabus, todaySubjects, onOpenPlan, modifier)
        null -> Unit
    }
}

@Composable
private fun PreparationCard(
    progress: TodayProgressOneOf,
    syllabus: Syllabus?,
    todaySubjects: Set<String>,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
) {
    ProgressCard(
        title = stringResource(R.string.today_preparation),
        detail = weekGain(progress.weekGain),
        value = formatPercent(progress.value, currentLocale()),
        onOpenPlan = onOpenPlan,
        modifier = modifier,
    ) {
        SubjectRows(syllabus, todaySubjects)
    }
}

@Composable
private fun LessonsCard(
    progress: TodayProgressOneOf1,
    syllabus: Syllabus?,
    todaySubjects: Set<String>,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
) {
    val lessons = progress.lessons
    val counts = LessonCounts.of(lessons.done, lessons.today, lessons.total, syllabusKnown = syllabus?.lessons?.known ?: 0)

    ProgressCard(
        title = stringResource(R.string.today_progress),
        detail = studiedLessonsLine(lessons.done, counts.known),
        value = formatGoalProgress(progress.value, currentLocale()),
        onOpenPlan = onOpenPlan,
        modifier = modifier,
    ) {
        if (counts.total > 0) {
            LessonCells(counts)
            CoverageLegend(counts)
        }
        SubjectRows(syllabus, todaySubjects)
    }
}

@Composable
private fun ProgressCard(
    title: String,
    detail: String?,
    value: String,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // The short line moves under the title once both don't fit, as a large font or German's words need.
        FlowRow(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(2.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
            detail?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
        Text(value, style = MaterialTheme.typography.headlineMedium.withTabularFigures())
        content()
        TextButton(onClick = onOpenPlan) {
            Text(stringResource(R.string.today_see_your_plan))
            Spacer(Modifier.size(4.dp))
            Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun weekGain(gain: Double): String? {
    val points = (gain * PERCENT).roundToInt()
    val shown = formatNumber(points.toDouble(), currentLocale())
    return when {
        points > 0 -> stringResource(R.string.today_week_gain, shown)
        points < 0 -> stringResource(R.string.today_week_loss, shown)
        else -> null
    }
}

internal data class LessonCounts(
    val known: Long,
    val studied: Long,
    val today: Long,
    val total: Long,
) {
    companion object {
        /** Today's lessons and the syllabus come from different reads, so the syllabus's known lessons never outnumber those done. */
        fun of(
            done: Long,
            today: Long,
            total: Long,
            syllabusKnown: Long,
        ): LessonCounts {
            val known = min(done, syllabusKnown)
            return LessonCounts(
                known = known,
                studied = lessonsStudied(done, known),
                today = min(today, max(0, total - done)),
                total = total,
            )
        }
    }
}

/** Shares from 0 to 1 of one cell; [planned] marks a lesson planned today, shown only when each cell is one lesson. */
internal data class LessonCell(
    val studied: Float,
    val known: Float,
    val planned: Boolean,
)

/** Main's `getLessonCells`: at most [MAX_CELLS] cells, each holding as many lessons as it takes. */
internal fun lessonCells(counts: LessonCounts): List<LessonCell> {
    val (known, studied, today, total) = counts
    if (total <= 0) return emptyList()
    val size = max(1, ceil(total.toDouble() / MAX_CELLS).toLong())
    val done = studied + known

    return (0 until ceil(total.toDouble() / size).toLong()).map { index ->
        val start = index * size
        val end = min(total, start + size)
        val length = (end - start).toFloat()
        LessonCell(
            studied = overlap(start, end, 0, studied) / length,
            known = overlap(start, end, studied, done) / length,
            planned = size == 1L && start >= done && start < done + today,
        )
    }
}

private fun overlap(
    start: Long,
    end: Long,
    from: Long,
    to: Long,
): Float = max(0, min(end, to) - max(start, from)).toFloat()

/** Hidden from TalkBack but for today's lessons, which only the cells show. */
@Composable
private fun LessonCells(counts: LessonCounts) {
    val cells = lessonCells(counts)
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val studiedColor = MaterialTheme.colorScheme.tertiary
    val knownColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = KNOWN_ALPHA)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val summary =
        counts.today.takeIf { it > 0 }?.let {
            pluralStringResource(R.plurals.today_progress_lessons_today, it.toInt(), formatNumber(it.toDouble(), currentLocale()))
        }

    Canvas(
        Modifier
            .fillMaxWidth()
            .height(CELL_HEIGHT)
            .clearAndSetSemantics { summary?.let { contentDescription = it } },
    ) {
        val gap = CELL_GAP.toPx()
        val width = (size.width - gap * (cells.size - 1)) / cells.size
        val radius = CornerRadius(CELL_CORNER.toPx())
        val ring = 1.dp.toPx()

        cells.forEachIndexed { index, cell ->
            val start = index * (width + gap)
            val left = if (rtl) size.width - start - width else start

            fun fill(
                from: Float,
                share: Float,
                color: Color,
            ) {
                if (share <= 0f) return
                val fillWidth = width * share
                val x = if (rtl) left + width - from - fillWidth else left + from
                drawRoundRect(color, Offset(x, 0f), Size(fillWidth, size.height), radius)
            }

            if (cell.planned) {
                drawRoundRect(
                    studiedColor,
                    Offset(left + ring / 2, ring / 2),
                    Size(width - ring, size.height - ring),
                    radius,
                    style = Stroke(ring),
                )
            } else {
                drawRoundRect(track, Offset(left, 0f), Size(width, size.height), radius)
            }
            fill(0f, cell.studied, studiedColor)
            fill(width * cell.studied, cell.known, knownColor)
        }
    }
}

/** Main shows it only when the cells hold more than lessons studied; the words beside it say the same, so TalkBack skips it. */
@Composable
private fun CoverageLegend(counts: LessonCounts) {
    val dots =
        listOfNotNull(
            LegendDot.Studied to stringResource(R.string.today_progress_studied),
            (LegendDot.Known to stringResource(R.string.today_progress_known)).takeIf { counts.known > 0 },
            (LegendDot.Today to stringResource(R.string.today_progress_today)).takeIf { counts.today > 0 },
        )
    if (dots.size < 2) return

    FlowRow(
        Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        dots.forEach { (dot, label) -> LegendItem(dot, label) }
    }
}

/** Main's `SubjectRows`: the first subjects the plan holds, marked when today works on them. */
@Composable
private fun SubjectRows(
    syllabus: Syllabus?,
    todaySubjects: Set<String>,
) {
    val subjects =
        syllabus
            ?.takeIf { it.hasSubjectPages }
            ?.subjects
            ?.filter { it.notPlannedReason == null }
            .orEmpty()
            .take(SHOWN_SUBJECTS)
    if (subjects.isEmpty()) return
    val locale = currentLocale()

    Column {
        subjects.forEach { subject ->
            val bar = subject.bar
            Row(
                Modifier.fillMaxWidth().heightIn(min = ROW_HEIGHT).semantics(mergeDescendants = true) {},
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        subject.shortName,
                        Modifier.weight(1f, fill = false),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (subject.shortName in todaySubjects) {
                        Text(
                            stringResource(R.string.today_progress_today),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
                CoverageBar(studied = bar.studied, modifier = Modifier.width(BAR_WIDTH), known = bar.known)
                Text(
                    formatProgressShare(bar.share, locale),
                    Modifier.widthIn(min = SHARE_WIDTH),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.End,
                    maxLines = 1,
                    softWrap = false,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

private const val PERCENT = 100
private const val MAX_CELLS = 30
private const val SHOWN_SUBJECTS = 5
private const val KNOWN_ALPHA = 0.7f
private val CELL_HEIGHT = 8.dp
private val CELL_GAP = 3.dp
private val CELL_CORNER = 2.dp
private val ROW_HEIGHT = 30.dp
private val BAR_WIDTH = 72.dp
private val SHARE_WIDTH = 40.dp
