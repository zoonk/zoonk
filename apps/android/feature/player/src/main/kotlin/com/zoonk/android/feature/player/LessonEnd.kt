package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.ceremonies.momentBuddy
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.lessonMap
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.steps.LessonMapView
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.session.CatchUpLine
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.session.SessionDayProgress
import com.zoonk.android.feature.session.ownBrainPower
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TaskSegment
import com.zoonk.android.ui.components.limitWords
import com.zoonk.android.ui.components.stillReviewLine
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.components.taskOption
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.scaffold.ResultPages
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.StudyReminderOffer
import kotlinx.coroutines.delay
import kotlin.math.roundToLong
import kotlin.time.Duration.Companion.seconds

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
    description: String?,
) {
    LessonColumnBeforeFold {
        Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
            description?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge) }
        }
    }
}

/** A refused run never dead-ends: each refusal says why here, and [lessonAccessBar] holds its way on (main's `LessonAccessScreen`). */
@Composable
fun LessonAccessScreen(
    refusal: LessonRefusal,
    onRetry: () -> Unit,
) {
    when (refusal) {
        is LessonRefusal.Limited, LessonRefusal.PlusRequired -> {
            val limit = (refusal as? LessonRefusal.Limited)?.limit
            if (limit is Limit.SlowDown) {
                SlowDown(limit.retryAfterSeconds.toLong(), onRetry)
            } else {
                refusal.reached()?.let { Limited(it) }
            }
        }

        LessonRefusal.NotFound -> {
            AccessLayout(R.drawable.ic_error, stringResource(R.string.player_not_found_title), null)
        }

        LessonRefusal.NotInApp -> {
            AccessLayout(
                R.drawable.ic_error,
                stringResource(R.string.player_not_in_app_title),
                stringResource(R.string.player_not_in_app_description),
            )
        }

        LessonRefusal.Failed -> {
            AccessLayout(
                R.drawable.ic_error,
                stringResource(R.string.player_start_failed_title),
                stringResource(R.string.player_start_failed_description),
            )
        }
    }
}

/** The bottom bar's one way on from [LessonAccessScreen]; none while a slow-down counts down to opening the lesson. */
fun lessonAccessBar(
    refusal: LessonRefusal,
    onRetry: () -> Unit,
    exits: LessonPlayerExits,
): (@Composable () -> Unit)? {
    val (label, onClick) =
        when (refusal) {
            LessonRefusal.NotFound, LessonRefusal.NotInApp -> {
                R.string.player_back to exits::close
            }

            LessonRefusal.Failed -> {
                R.string.player_try_again to onRetry
            }

            is LessonRefusal.Limited, LessonRefusal.PlusRequired -> {
                when (refusal.reached()?.tier) {
                    null -> return null
                    LimitTier.Guest -> R.string.limit_create_account to { exits.open(AppRoute.Login) }
                    LimitTier.Free -> R.string.subscription_subscribe to { exits.open(AppRoute.Subscription) }
                    LimitTier.Plus -> R.string.player_back to exits::close
                }
            }
        }
    return { TaskActionBar { TaskActions { main -> Button(onClick = onClick, modifier = main) { Text(stringResource(label)) } } } }
}

/** A refusal that still says the old free week draws the month's gate, so no screen says "free week". */
private fun LessonRefusal.reached(): Limit.Reached? =
    when (this) {
        is LessonRefusal.Limited -> {
            when (val limit = limit) {
                is Limit.SlowDown -> null
                Limit.SignUpRequired -> Limit.Reached(LimitTier.Guest, LimitPeriod.Total)
                is Limit.Reached -> limit
            }
        }

        LessonRefusal.PlusRequired -> {
            Limit.Reached(LimitTier.Free, LimitPeriod.Month)
        }

        else -> {
            null
        }
    }

@Composable
private fun Limited(reached: Limit.Reached) {
    val title = limitWords(reached, LimitSubject.Lessons).title.orEmpty()

    when (reached.tier) {
        LimitTier.Guest -> {
            AccessLayout(R.drawable.ic_person_add, title, stringResource(R.string.player_guest_limit_description))
        }

        LimitTier.Free -> {
            TrackShown(AnalyticsEvent.SubscriptionGateShown)
            AccessLayout(R.drawable.ic_auto_awesome, title, stillReviewLine(reached))
        }

        LimitTier.Plus -> {
            AccessLayout(R.drawable.ic_hourglass_empty, title, stillReviewLine(reached))
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

/** Main's `getLessonCelebration`: a lesson played in a session carries its ceremony in its block. */
internal fun LibraryLessonCompletion.ceremonyMilestone(): Milestone? {
    val block = studyBlock ?: return ceremony
    return block.ceremony
}

/** Its certificates come the same way as its ceremony. */
internal fun LibraryLessonCompletion.awardedCertificates(): List<CertificateName> =
    (studyBlock?.certificates ?: certificates).map {
        it.naming
    }

@Composable
fun LessonCompletionView(
    state: LessonPlayerState,
    ending: LessonEnding,
    buddy: LearnerSummaryBuddy? = null,
    finishedChapter: FinishedChapterSlot? = null,
    onReportSaveFailure: () -> Unit = {},
    reminderOffer: (@Composable (StudyReminderOffer) -> Unit)? = null,
) {
    val completion = state.completion ?: return

    if (completion.status == CompletionStatus.Ready) {
        ResultPages(
            withMoment = false,
            columnModifier = Modifier.taskColumn(),
            done = {
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
            },
            next = {},
        )
        return
    }

    val saving = completion.status == CompletionStatus.Saving
    val title =
        when {
            saving -> R.string.player_saving_progress
            completion.status == CompletionStatus.Failed -> R.string.player_lesson_not_saved
            completion.testedOut -> R.string.player_already_knew
            else -> R.string.player_lesson_complete
        }

    ResultPages(
        withMoment = completion.status == CompletionStatus.Saved,
        columnModifier = Modifier.taskColumn(),
        done = {
            Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    stringResource(title),
                    Modifier.semantics { heading() },
                    color = if (saving) MaterialTheme.colorScheme.onSurfaceVariant else Color.Unspecified,
                    style = MaterialTheme.typography.headlineSmall,
                )

                if (completion.status == CompletionStatus.Failed) {
                    SaveErrorText(
                        failures = completion.saveFailures,
                        firstFailureMessage = stringResource(R.string.player_save_failed),
                        textStyle = MaterialTheme.typography.bodyLarge,
                        onReport = onReportSaveFailure,
                    )
                }
                if (completion.status == CompletionStatus.Saved) {
                    LessonReadouts(state)
                    CatchUpLine(
                        completion.result
                            ?.studyBlock
                            ?.dayProgress
                            ?.catchUp,
                    )
                }
            }
            val result = completion.result
            if (completion.status == CompletionStatus.Saved && result != null) {
                result.studyBlock?.let { SessionDayProgress(it) }
                val moment = buddy.momentBuddy()
                DayMoment(result, moment.look, moment.name)
                result.finishedChapter?.let { finishedChapter?.invoke(it) }
                result.studyBlock?.reminderOffer?.let { reminderOffer?.invoke(it) }
            }
        },
        // On a spread the lesson's map sits under what was done; one column keeps it behind ⋮.
        doneWhenSplit = { state.lessonMap?.let { LessonEndMap(it) } },
        next = {
            completion.result?.planReveal?.let { reveal ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.onboarding_whats_next), style = MaterialTheme.typography.labelLarge)
                    Text(
                        stringResource(
                            if (reveal.planReady) R.string.onboarding_your_plan_ready else R.string.onboarding_reveal_building_title,
                        ),
                        style = MaterialTheme.typography.titleSmall,
                    )
                    Text(reveal.goalTitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
            if (completion.result?.planReveal == null && completion.status == CompletionStatus.Saved && ending.guest) {
                ending.fit?.let { WhereItFits(it) }
                Text(
                    stringResource(R.string.player_guest_save_note),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        },
    )
}

@Composable
private fun LessonEndMap(map: StepContent.Map) {
    HorizontalDivider()
    SectionHeader(stringResource(R.string.player_lesson_map))
    LessonMapView(map)
}

@Composable
internal fun LessonReadouts(
    state: LessonPlayerState,
    withFacts: Boolean = true,
) {
    val result = state.completion?.result ?: return
    val segments = state.screen().segments
    val correct = segments.count { it == TaskSegment.Right }
    val answered = correct + segments.count { it == TaskSegment.Wrong }
    val block = result.studyBlock
    val brainPower = block?.ownBrainPower ?: result.brainPower
    val locale = currentLocale()

    val studied =
        result.seconds.takeIf { withFacts && it > 0 }?.let { seconds ->
            stringResource(R.string.player_time_studied, formatDuration(seconds, locale))
        }

    MomentReadouts(brainPower, score = MomentScore(answered, correct), facts = listOfNotNull(studied))
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
                state.completion?.result?.planReveal != null -> {
                    {
                        state.completion?.result?.planReveal?.let {
                            exits.replace(
                                AppRoute.GoalSetup(it.goalId.toString(), revealMoment = true),
                            )
                        }
                    }
                }

                ending.inSession -> {
                    viewModel::continueSession
                }

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
            state.completion?.result?.planReveal != null -> R.string.onboarding_see_plan
            ending.guest -> R.string.player_build_my_plan
            ending.nextLessonId != null -> R.string.player_next_lesson
            else -> R.string.player_action_continue
        }
    val back = if (lesson.targetLanguage != null) R.string.player_back_to_unit else R.string.player_back_to_chapter

    if (status == CompletionStatus.Saved && state.completion?.result?.planReveal == null && ending.inSession) {
        LessonSessionEnd(state, viewModel, exits)
        return
    }

    if (status == CompletionStatus.Saved && state.completion?.result?.planReveal == null && ending.guest) {
        TaskActions { width ->
            OutlinedButton(onClick = { exits.replace(AppRoute.Login) }, modifier = Modifier.taskOption()) {
                Text(stringResource(R.string.player_create_account_to_save))
            }
            Button(onClick = { main?.invoke() }, enabled = main != null, modifier = width) { Text(stringResource(label)) }
        }
        return
    }

    TaskActions { width ->
        if (status == CompletionStatus.Saved && state.completion?.result?.planReveal == null && ending.nextLessonId != null) {
            OutlinedButton(onClick = exits::close, modifier = width) { Text(stringResource(back)) }
        }
        Button(onClick = { main?.invoke() }, enabled = main != null, modifier = width) { Text(stringResource(label)) }
    }
}

@Composable
private fun LessonSessionEnd(
    state: LessonPlayerState,
    viewModel: LessonPlayerViewModel,
    exits: LessonPlayerExits,
) {
    val move by viewModel.sessionMove.collectAsStateWithLifecycle()
    val block = state.completion?.result?.studyBlock

    LaunchedEffect(move.leaving) { move.leaving?.let(exits::replace) }

    SessionEndActions(
        move,
        completed = block?.sessionCompleted == true,
        canStop = block != null,
        onStop = viewModel::stopSession,
        onContinue = viewModel::continueSession,
    )
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
