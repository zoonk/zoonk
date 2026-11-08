package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationFirstLesson
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TrackVisibleWait
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.WaitContent
import com.zoonk.android.feature.warmup.WaitQuizAction
import com.zoonk.android.feature.warmup.WaitQuizState
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.rememberWaitQuiz
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon

internal val LocalSetupWarmUp = compositionLocalOf<WarmUpStore?> { null }
internal val LocalSetupWait = compositionLocalOf { SetupWaitContext() }
internal val LocalSetupQuiz = compositionLocalOf<WaitQuizState?> { null }
internal val LocalWaitBeside = compositionLocalOf { false }

internal data class SetupWaitContext(
    val goalId: String? = null,
    val firstLesson: GenerationFirstLesson? = null,
    val onStartLesson: (() -> Unit)? = null,
    val planReady: Boolean = false,
    val warmUpId: String? = null,
    val course: com.zoonk.api.models.OnboardingLibraryCourse? = null,
    val onOpenCourse: (() -> Unit)? = null,
)

@Composable
internal fun androidx.compose.foundation.layout.ColumnScope.SetupWait(
    run: GenerationRun,
    kind: GenerationKind,
    surface: AnalyticsEvent.WarmUpSurface,
    title: String,
    hold: ReadyHold,
    readyAction: String,
    onRetry: (() -> Unit)? = null,
    next: PlanNext? = null,
    waitSurface: String = surface.value,
    progress: @Composable (Float) -> Unit,
) {
    val context = LocalSetupWait.current
    val quiz = LocalSetupQuiz.current ?: rememberWaitQuiz(run.warmUpId ?: context.warmUpId, LocalSetupWarmUp.current)
    quiz.open()
    val canShowAside = quiz.canShowQuiz && quiz.visitedQuiz
    val first = context.firstLesson
    val share =
        com.zoonk.android.ui.components
            .rememberGenerationProgress(kind, run)
    val shownProgress: @Composable () -> Unit = {
        progress(share)
        first?.let { FirstLessonRow(it, run) }
    }
    val layout = LocalSetupLayout.current
    val aside: (@Composable () -> Unit)? =
        if (canShowAside && layout != null) {
            {
                Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) { shownProgress() }
                    layout.aside()
                }
            }
        } else {
            null
        }
    val opensFirst = first?.ready == true && !context.planReady && hold.isOverFor(true)
    LaunchedEffect(opensFirst) {
        if (opensFirst) {
            context.onStartLesson?.let { start ->
                // Back from the lesson keeps this wait open.
                hold.guess()
                start()
            }
        }
    }
    val line =
        first?.takeUnless { it.done }?.let {
            if (it.ready) {
                stringResource(R.string.warm_up_first_lesson_ready)
            } else {
                it.title?.let { name -> stringResource(R.string.warm_up_first_lesson_writing, name) }
            }
        }
    TrackVisibleWait(waitSurface, "curriculum", context.goalId)
    SetupContent(aside = aside, reversed = canShowAside) {
        val beside = LocalWaitBeside.current && canShowAside
        WaitContent(
            quiz,
            hold,
            surface,
            kind,
            run,
            title,
            goalId = context.goalId,
            lessonLine = line,
            lessonReady = first?.ready == true,
            progressBeside = beside,
            progressShare = share,
            onRetry = onRetry,
            progress = shownProgress,
        )
        val firstReady = first?.ready == true && !context.planReady && context.onStartLesson != null
        val course = context.course?.takeIf { !context.planReady && first?.ready != true }
        val actionsVisible =
            hold.holding || firstReady || course != null ||
                (quiz.canShowQuiz && ((quiz.showingProgress && !beside) || quiz.hasNext))
        PageWaitActions(hold, visible = actionsVisible) {
            when {
                hold.holding -> {
                    if (!quiz.showingProgress && next == PlanNext.TimeQuestion) {
                        Text(
                            stringResource(R.string.warm_up_plan_ready_one_question),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Button(onClick = hold::moveOn, modifier = Modifier.fillMaxWidth()) { Text(readyAction) }
                }

                firstReady -> {
                    Text(
                        stringResource(R.string.warm_up_plan_waiting),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(
                        onClick = context.onStartLesson,
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
                    ) {
                        Text(stringResource(R.string.warm_up_start_first_lesson))
                    }
                }

                else -> {
                    if (course != null && context.onOpenCourse != null) LibraryCourseOffer(course, context.onOpenCourse)
                    WaitQuizAction(quiz, hold, beside)
                }
            }
        }
    }
}

@Composable
internal fun FirstLessonRow(
    lesson: GenerationFirstLesson,
    run: GenerationRun,
) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val started = run.stepTimes["writeFirstLesson"]?.started
    val finished = run.stepTimes["firstLessonReady"]?.completed
    val settled = lesson.ready || lesson.done
    LaunchedEffect(settled, started) {
        if (started != null && !settled) {
            while (true) {
                kotlinx.coroutines.delay(1_000)
                now = System.currentTimeMillis()
            }
        }
    }
    com.zoonk.android.ui.components.ListRow(
        headline = { Text(stringResource(R.string.warm_up_first_lesson)) },
        leading = {
            if (settled) {
                com.zoonk.android.ui.components
                    .DoneMark()
            } else {
                androidx.compose.material3.CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }
        },
        supporting = {
            lesson.title?.let { Text(it) }
            Text(
                stringResource(
                    when {
                        lesson.done -> R.string.lessons_done
                        lesson.ready -> R.string.warm_up_ready_to_start
                        else -> R.string.warm_up_first_lesson_screens
                    },
                ),
            )
        },
        meta = {
            val elapsed =
                started?.let { start ->
                    finished?.minus(start) ?: run.clockOffsetMillis?.let { offset -> now - offset - start }
                }
            elapsed?.let {
                Text(
                    com.zoonk.android.ui.format
                        .formatClock(it.coerceAtLeast(0)),
                )
            }
        },
    )
}
