package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.RefusalPeriod
import com.zoonk.android.feature.player.engine.RefusalTier
import com.zoonk.android.feature.player.engine.Segment
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.LessonFit
import kotlinx.coroutines.delay
import java.time.ZoneId
import kotlin.math.roundToLong
import kotlin.time.Duration.Companion.seconds
import kotlin.time.toJavaInstant

/** The notes under a screen that draws its own result: the streak and where the question goes next. */
@Composable
fun LessonResultNotes(
    next: ResultNext,
    hyperdriveStreak: Int?,
) {
    val streak = hyperdriveStreak?.let { stringResource(R.string.player_hyperdrive_streak, count(it)) }
    if (streak != null) FeedbackNote(streak)
    ResultNote(next)
}

@Composable
private fun AccessLayout(
    icon: Int,
    title: String,
    description: String,
    actions: @Composable ColumnScope.() -> Unit = {},
) {
    LessonColumn(Modifier.padding(vertical = 24.dp)) {
        Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
            Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp), content = actions)
    }
}

/** A refused run never dead-ends: each refusal offers its way on (main's `LessonAccessScreen`). */
@Composable
fun LessonAccessScreen(
    refusal: LessonRefusal,
    onRetry: () -> Unit,
    exits: LessonPlayerExits,
) {
    when (refusal) {
        is LessonRefusal.SlowDown -> {
            SlowDown(refusal.retryAfterSeconds, onRetry)
        }

        LessonRefusal.PlusRequired -> {
            AccessLayout(
                R.drawable.ic_auto_awesome,
                stringResource(R.string.player_free_week_over_title),
                stringResource(R.string.player_free_week_over_description),
            ) { PlusActions(exits) }
        }

        is LessonRefusal.LimitReached -> {
            LimitReached(refusal, exits)
        }

        LessonRefusal.SignUpRequired -> {
            LimitReached(LessonRefusal.LimitReached(RefusalTier.Guest, RefusalPeriod.Day), exits)
        }

        LessonRefusal.NotFound -> {
            AccessLayout(
                R.drawable.ic_error,
                stringResource(R.string.player_not_found_title),
                stringResource(R.string.player_not_found_description),
            ) {
                Button(onClick = exits::close, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_back)) }
            }
        }

        LessonRefusal.Failed -> {
            AccessLayout(
                R.drawable.ic_error,
                stringResource(R.string.player_start_failed_title),
                stringResource(R.string.player_start_failed_description),
            ) {
                Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_try_again)) }
            }
        }
    }
}

@Composable
private fun ColumnScope.PlusActions(exits: LessonPlayerExits) {
    Button(onClick = {
        exits.open(AppRoute.Subscription)
    }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_see_plus)) }
    FilledTonalButton(onClick = exits::close, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_back)) }
}

@Composable
private fun LimitReached(
    refusal: LessonRefusal.LimitReached,
    exits: LessonPlayerExits,
) {
    when (refusal.tier) {
        RefusalTier.Guest -> {
            AccessLayout(
                R.drawable.ic_person_add,
                stringResource(R.string.player_guest_limit_title),
                stringResource(R.string.player_guest_limit_description),
            ) {
                Button(onClick = {
                    exits.open(AppRoute.Login)
                }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_create_free_account)) }
            }
        }

        RefusalTier.Free -> {
            val month = refusal.period == RefusalPeriod.Month
            AccessLayout(
                R.drawable.ic_auto_awesome,
                stringResource(if (month) R.string.player_free_limit_month_title else R.string.player_free_limit_day_title),
                stringResource(if (month) R.string.player_free_limit_month_description else R.string.player_free_limit_day_description),
            ) { PlusActions(exits) }
        }

        RefusalTier.Plus -> {
            AccessLayout(
                R.drawable.ic_hourglass_empty,
                stringResource(R.string.player_plus_limit_title),
                stringResource(R.string.player_plus_limit_description),
            ) {
                FilledTonalButton(onClick = exits::close, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_back)) }
            }
        }
    }
}

/** Counts down, then opens the lesson by itself. */
@Composable
private fun SlowDown(
    retryAfterSeconds: Long,
    onRetry: () -> Unit,
) {
    var secondsLeft by rememberSaveable(retryAfterSeconds) { mutableLongStateOf(retryAfterSeconds) }

    LaunchedEffect(secondsLeft) {
        if (secondsLeft <= 0) {
            onRetry()
        } else {
            delay(1.seconds)
            secondsLeft--
        }
    }

    val shown = secondsLeft.coerceAtLeast(0)
    AccessLayout(
        R.drawable.ic_hourglass_empty,
        stringResource(R.string.player_slow_down_title),
        pluralStringResource(R.plurals.player_slow_down_description, shown.toInt(), count(shown.toInt())),
    )
}

/** What the lesson's end says (main's `LessonCompletionMoment`): its title, then the score once saved. */
@Composable
fun LessonCompletionView(
    state: LessonPlayerState,
    ending: LessonEnding,
) {
    val completion = state.completion ?: return
    val title = stringResource(if (completion.testedOut) R.string.player_already_knew else R.string.player_lesson_complete)

    if (completion.status == CompletionStatus.Ready) {
        LessonColumn(Modifier.padding(vertical = 24.dp)) {
            Text(
                stringResource(R.string.player_nothing_left_title),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                stringResource(R.string.player_nothing_left_description),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
        return
    }

    LessonColumn(Modifier.padding(vertical = 24.dp)) {
        Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)

            if (completion.status == CompletionStatus.Saving) {
                Text(stringResource(R.string.player_saving_progress), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (completion.status == CompletionStatus.Failed) {
                Text(stringResource(R.string.player_save_failed), color = MaterialTheme.colorScheme.error)
            }
            if (completion.status == CompletionStatus.Saved) Readouts(state)
        }

        if (completion.status == CompletionStatus.Saved && ending.guest) {
            ending.fit?.let { WhereItFits(it) }
            Text(
                stringResource(R.string.player_guest_save_note),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun Readouts(state: LessonPlayerState) {
    val result = state.completion?.result ?: return
    val segments = state.screen().segments
    val correct = segments.count { it == Segment.Right }
    val answered = correct + segments.count { it == Segment.Wrong }
    val block = result.studyBlock
    val brainPower = if (block == null) result.brainPower else block.brainPower - if (block.fullMeal.paid) block.fullMeal.bonus else 0
    val locale = currentLocale()

    FlowRow(horizontalArrangement = Arrangement.spacedBy(32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (answered > 0) {
            Text(
                pluralStringResource(R.plurals.player_score, correct, count(correct), count(answered)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.titleMedium,
            )
        }
        if (brainPower > 0) {
            Text(
                stringResource(R.string.player_brain_power, formatNumber(brainPower.toDouble(), locale)),
                color = MaterialTheme.zoonk.brainText,
                style = MaterialTheme.typography.titleMedium.withTabularFigures(),
            )
        }
    }

    result.nextReviewAt?.let { reviewAt ->
        val day = reviewAt.toJavaInstant().atZone(ZoneId.systemDefault()).toLocalDate()
        Text(
            stringResource(R.string.player_review_on, formatDate(day, locale, DateStyle.Day)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/**
 * What the lesson's end does on its main button and on Enter: finish or try again, then the next
 * lesson, the guest's plan, or back. Null while it saves.
 */
internal fun completionMainAction(
    lesson: PlayableLesson,
    state: LessonPlayerState,
    ending: LessonEnding,
    viewModel: LessonPlayerViewModel,
    exits: LessonPlayerExits,
): (() -> Unit)? =
    when (state.completion?.status) {
        CompletionStatus.Ready, CompletionStatus.Failed -> {
            { viewModel.dispatch(LessonAction.CompletionRetried) }
        }

        CompletionStatus.Saved -> {
            when {
                ending.guest -> {
                    { exits.replace(guestPlan(lesson, ending)) }
                }

                ending.nextLessonId != null -> {
                    { exits.replace(AppRoute.Lesson(ending.nextLessonId)) }
                }

                else -> {
                    exits::close
                }
            }
        }

        CompletionStatus.Saving, null -> {
            null
        }
    }

/** "Build my plan" starts the lesson's course as a goal, from its chapter; without a course, from its title. */
private fun guestPlan(
    lesson: PlayableLesson,
    ending: LessonEnding,
): AppRoute =
    ending.fit?.course?.let { AppRoute.CourseStart(it.id.toString(), it.startChapterId?.toString()) }
        ?: AppRoute.StartGoal(goal = lesson.title)

/** "Next lesson" with the way back to the chapter, or one Continue; Finish when nothing is left to answer. */
@Composable
fun CompletionActions(
    lesson: PlayableLesson,
    state: LessonPlayerState,
    ending: LessonEnding,
    viewModel: LessonPlayerViewModel,
    exits: LessonPlayerExits,
) {
    val status = state.completion?.status ?: return
    val main = completionMainAction(lesson, state, ending, viewModel, exits)
    val label =
        when {
            status == CompletionStatus.Ready -> R.string.player_finish
            status == CompletionStatus.Failed -> R.string.player_try_again
            ending.guest -> R.string.player_build_my_plan
            ending.nextLessonId != null -> R.string.player_next_lesson
            else -> R.string.player_action_continue
        }
    val back = if (lesson.targetLanguage != null) R.string.player_back_to_unit else R.string.player_back_to_chapter

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (status == CompletionStatus.Saved && ending.nextLessonId != null && !ending.guest) {
                FilledTonalButton(onClick = exits::close, modifier = Modifier.weight(1f)) { Text(stringResource(back)) }
            }
            Button(onClick = { main?.invoke() }, enabled = main != null, modifier = Modifier.weight(1f)) { Text(stringResource(label)) }
        }
        if (status == CompletionStatus.Saved && ending.guest) {
            FilledTonalButton(onClick = { exits.open(AppRoute.Login) }, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.player_create_account_to_save))
            }
        }
    }
}

/** Where a guest's lesson sits: its course and its place in its chapter (main's `GuestLessonNext`). */
@Composable
private fun WhereItFits(fit: LessonFit) {
    val chapter = fit.chapter
    val lessons = chapter.lessonCount.toInt().coerceAtLeast(1)
    val locale = currentLocale()

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                stringResource(R.string.player_part_of),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            fit.course?.let { course ->
                val hours = (course.minutes / MINUTES_PER_HOUR.toDouble()).roundToLong().coerceAtLeast(1)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(course.title, style = MaterialTheme.typography.titleMedium)
                    Text(
                        pluralStringResource(
                            R.plurals.player_course_size,
                            course.chapterCount.toInt(),
                            count(course.chapterCount.toInt()),
                            formatDuration(hours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE, locale),
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    chapter.title,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    pluralStringResource(
                        R.plurals.player_lesson_of,
                        chapter.lessonCount.toInt(),
                        count(chapter.lessonNumber.toInt()),
                        count(chapter.lessonCount.toInt()),
                    ),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            MeterParts(
                List(lessons) { index ->
                    MeterPart(
                        if (index <
                            chapter.lessonNumber
                        ) {
                            MeterPart.Fill.Solid(MaterialTheme.colorScheme.tertiary)
                        } else {
                            MeterPart.Fill.Track
                        },
                    )
                },
            )
        }
    }
}

private const val MINUTES_PER_HOUR = 60L
private const val SECONDS_PER_MINUTE = 60L
