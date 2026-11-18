package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.goalcontent.CoverageBar
import com.zoonk.android.feature.goalcontent.LegendDot
import com.zoonk.android.feature.goalcontent.LegendItem
import com.zoonk.android.feature.goalcontent.bar
import com.zoonk.android.feature.plan.lessonsStudied
import com.zoonk.android.feature.plan.studiedLessonsLine
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.TodayProgress
import com.zoonk.api.models.TodayProgressOneOf
import com.zoonk.api.models.TodayProgressOneOf1
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Main's `TodayPreparation` for goals other than a language's: an exam's preparation, or the lessons studied. The Plan lists the subjects. */
@Composable
internal fun TodayPreparation(
    progress: TodayProgress?,
    syllabus: Syllabus?,
    onOpenPlan: () -> Unit,
    modifier: Modifier = Modifier,
    goalTitle: String? = null,
) {
    when (progress) {
        is TodayProgress.TodayProgressOneOfValue -> PreparationCard(progress.value, onOpenPlan, modifier, goalTitle)
        is TodayProgress.TodayProgressOneOf1Value -> LessonsCard(progress.value, syllabus, onOpenPlan, modifier)
        null -> Unit
    }
}

@Composable
private fun PreparationCard(
    progress: TodayProgressOneOf,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
    goalTitle: String?,
) {
    ProgressCard(
        title = listOfNotNull(stringResource(R.string.today_preparation), goalTitle).factsLine(),
        detail = weekGain(progress.weekGain),
        value = formatPercent(progress.value, currentLocale()),
        onOpenPlan = onOpenPlan,
        modifier = modifier,
    )
}

@Composable
private fun LessonsCard(
    progress: TodayProgressOneOf1,
    syllabus: Syllabus?,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
) {
    val lessons = progress.lessons
    val counts = LessonCounts.of(lessons.done, lessons.today, lessons.total, syllabusKnown = syllabus?.lessons?.known ?: 0)

    ProgressCard(
        title = stringResource(R.string.today_progress),
        detail = studiedLessonsLine(lessons.done, counts.known),
        value = formatProgressShare(progress.value, currentLocale()),
        onOpenPlan = onOpenPlan,
        modifier = modifier,
    ) {
        if (counts.total > 0) {
            LessonsBar(counts)
            CoverageLegend(counts)
        }
    }
}

@Composable
private fun ProgressCard(
    title: String,
    detail: String?,
    value: String,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
    content: @Composable ColumnScope.() -> Unit = {},
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
        TextButton(onClick = onOpenPlan, forward = true, edge = ButtonEdge.Start) { Text(stringResource(R.string.today_see_your_plan)) }
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

/** Main's `CoverageBar` with today's lessons said to TalkBack, which only main's screen-reader summary says. */
@Composable
private fun LessonsBar(counts: LessonCounts) {
    val summary =
        counts.today.takeIf { it > 0 }?.let {
            pluralStringResource(R.plurals.today_progress_lessons_today, it.toInt(), formatNumber(it.toDouble(), currentLocale()))
        }

    Box(Modifier.semantics { summary?.let { contentDescription = it } }) {
        CoverageBar(studied = counts.studied.toDouble() / counts.total, known = counts.known.toDouble() / counts.total)
    }
}

/** Main's `CoverageLegend`: what the bar's parts are, "Already knew" only when some are; the words beside it say the counts, so TalkBack skips it. */
@Composable
private fun CoverageLegend(counts: LessonCounts) {
    val dots =
        listOfNotNull(
            LegendDot.Studied to stringResource(R.string.today_progress_studied),
            (LegendDot.Known to stringResource(R.string.today_progress_known)).takeIf { counts.known > 0 },
            LegendDot.New to stringResource(R.string.goalcontent_new),
        )

    FlowRow(
        Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        dots.forEach { (dot, label) -> LegendItem(dot, label) }
    }
}

private const val PERCENT = 100
