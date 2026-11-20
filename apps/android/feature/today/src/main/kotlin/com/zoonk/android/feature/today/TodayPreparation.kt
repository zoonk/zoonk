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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.goalcontent.CoverageBar
import com.zoonk.android.feature.plan.WeekGain
import com.zoonk.android.feature.plan.weekGain
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.TodayProgress
import com.zoonk.api.models.TodayProgressOneOf
import com.zoonk.api.models.TodayProgressOneOf1
import kotlin.math.max
import kotlin.math.min

/** Main's `TodayPreparation` for goals other than a language's: an exam's preparation, or the lessons studied. The Plan lists the subjects. */
@Composable
internal fun TodayPreparation(
    progress: TodayProgress?,
    onOpenPlan: () -> Unit,
    modifier: Modifier = Modifier,
    goalTitle: String? = null,
) {
    when (progress) {
        is TodayProgress.TodayProgressOneOfValue -> PreparationCard(progress.value, onOpenPlan, modifier, goalTitle)
        is TodayProgress.TodayProgressOneOf1Value -> LessonsCard(progress.value, onOpenPlan, modifier)
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
    onOpenPlan: () -> Unit,
    modifier: Modifier,
) {
    val lessons = progress.lessons

    ProgressCard(
        title = stringResource(R.string.today_progress),
        detail = null,
        value = formatProgressShare(progress.value, currentLocale()),
        spoken = stringResource(R.string.today_progress_meaning),
        onOpenPlan = onOpenPlan,
        modifier = modifier,
    ) {
        if (lessons.total > 0) LessonsBar(lessons.done, lessonsLeftToday(lessons.done, lessons.today, lessons.total), lessons.total)
    }
}

@Composable
private fun ProgressCard(
    title: String,
    detail: WeekGain?,
    value: String,
    onOpenPlan: () -> Unit,
    modifier: Modifier,
    spoken: String? = null,
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
                    it.text,
                    color = it.color,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
        Text(
            value,
            Modifier.semantics { spoken?.let { contentDescription = "$value. $it" } },
            style = MaterialTheme.typography.headlineMedium.withTabularFigures(),
        )
        content()
        TextButton(onClick = onOpenPlan, forward = true, edge = ButtonEdge.Start) { Text(stringResource(R.string.today_see_your_plan)) }
    }
}

/** Today's lessons never outnumber those the plan has left. */
internal fun lessonsLeftToday(
    done: Long,
    today: Long,
    total: Long,
): Long = min(today, max(0, total - done))

/** Main's `CoverageBar` with today's lessons said to TalkBack, which only main's screen-reader summary says. */
@Composable
private fun LessonsBar(
    done: Long,
    today: Long,
    total: Long,
) {
    val summary =
        today.takeIf { it > 0 }?.let {
            pluralStringResource(R.plurals.today_progress_lessons_today, it.toInt(), formatNumber(it.toDouble(), currentLocale()))
        }

    Box(Modifier.semantics { summary?.let { contentDescription = it } }) {
        CoverageBar(studied = done.toDouble() / total)
    }
}
