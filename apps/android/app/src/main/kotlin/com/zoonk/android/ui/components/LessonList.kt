package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import java.util.UUID

@Immutable
data class ListedLesson(
    val id: UUID,
    val title: String,
    val minutes: Int,
    val done: Boolean,
    val next: Boolean,
    val plusRequired: Boolean = false,
)

/**
 * The next lesson is marked only when [upNext]: its chapter is the plan's current one. Rows reach
 * the list's edges and inset their own content, so place it without the page's side padding.
 */
@Composable
fun LessonList(
    lessons: List<ListedLesson>,
    upNext: Boolean,
    onOpen: (UUID) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val done = lessons.count { it.done }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(
            stringResource(R.string.lessons_title),
            modifier = Modifier.padding(horizontal = LIST_ITEM_INSET),
            detail =
                stringResource(
                    R.string.lessons_done_count,
                    formatNumber(done.toDouble(), locale),
                    formatNumber(lessons.size.toDouble(), locale),
                ),
        )
        Column {
            lessons.forEachIndexed { index, lesson ->
                if (index > 0) HorizontalDivider()
                LessonRow(lesson, index + 1, isNext = upNext && lesson.next, onOpen = { onOpen(lesson.id) })
            }
        }
    }
}

@Composable
private fun LessonRow(
    lesson: ListedLesson,
    position: Int,
    isNext: Boolean,
    onOpen: () -> Unit,
) {
    val locale = currentLocale()
    val (status, label) =
        when {
            lesson.done -> MarkStatus.Done to stringResource(R.string.lessons_done)
            isNext -> MarkStatus.Next to stringResource(R.string.lessons_up_next)
            else -> MarkStatus.Todo to stringResource(R.string.lessons_coming_up)
        }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    ListRow(
        headline = {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    stringResource(R.string.lessons_position, formatNumber(position.toDouble(), locale)),
                    Modifier.alignByBaseline(),
                    color = muted,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
                Text(lesson.title, Modifier.alignByBaseline(), color = if (lesson.done) muted else Color.Unspecified)
            }
        },
        onClick = onOpen,
        highlighted = isNext,
        leading = { StatusMark(status, contentDescription = label) },
        meta =
            if (lesson.plusRequired || lesson.minutes > 0) {
                {
                    if (lesson.plusRequired) PlusMark()
                    if (lesson.minutes > 0) Text(formatMinutes(lesson.minutes, locale))
                }
            } else {
                null
            },
    )
}

@Composable
fun LessonProgress(
    lessons: List<ListedLesson>,
    modifier: Modifier = Modifier,
) {
    val done = MaterialTheme.colorScheme.tertiary
    MeterParts(lessons.map { MeterPart(if (it.done) MeterPart.Fill.Solid(done) else MeterPart.Fill.Track) }, modifier)
}
