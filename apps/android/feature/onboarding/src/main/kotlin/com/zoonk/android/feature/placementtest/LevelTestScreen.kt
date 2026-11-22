package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.LevelTestAttempt
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.LevelRow
import com.zoonk.android.feature.onboarding.setup.LevelRows
import com.zoonk.android.feature.onboarding.setup.LevelTestSteps
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.PlanAttempt
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.rememberPoll
import com.zoonk.android.feature.onboarding.setup.withPoll
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.lessonsSkippedLine
import com.zoonk.android.feature.plan.levelRange
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.LevelRangeBar
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.languageName
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOf1
import com.zoonk.api.models.LanguageLevelTestOneOf1LevelsInner
import com.zoonk.api.models.LanguageLevelTestOut
import com.zoonk.api.models.LanguageLevelTestOutNext
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanPlacementTest
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * `/level-test`: a language course's level test from its plan, its level test-outs, and the walk a
 * whole-course test goes on with. Other courses have none, so they go to the plan, as main redirects.
 */
@Composable
fun LevelTestScreen(
    route: AppRoute.LevelTest,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val goal = summary.value?.goals?.firstOrNull { goal -> route.goalId?.let { goal.id.toString() == it } ?: goal.isActive }
    val language = goal?.kind == LearnerSummaryGoal.Kind.LANGUAGE && goal.targetLanguage != null
    val elsewhere = AppRoute.Plan().takeIf { goal != null && !language }
    TestTask(app.learnerSummary.summary, summary, goal, elsewhere, navigator, deciding = false) { _, setProgress ->
        goal?.takeIf { language }?.let { LevelTestPlanFlow(it, route.testOut, app, navigator, setProgress) }
    }
}

@Composable
private fun ColumnScope.LevelTestPlanFlow(
    goal: LearnerSummaryGoal,
    testOutFirst: Boolean,
    app: AppContainer,
    navigator: AppNavigator,
    onProgress: (Float?) -> Unit,
) {
    val goalId = goal.id.toString()
    val targetLanguage = goal.targetLanguage.orEmpty()
    val store = app.onboarding
    val vm = viewModel(key = "level-test-plan:$goalId") { LevelTestPlanViewModel(goalId, store, createSavedStateHandle()) }
    VisitOf(vm.visit)
    ActOn(vm.walking) {
        navigator.closeTask()
        navigator.open(AppRoute.PlacementTest(goalId))
    }
    val plan by app.plans.plan[goal.id].collectShown()
    val row = (plan.value?.plan?.placementTest as? PlanPlacementTest.PlanPlacementTestOneOf1Value)?.value
    val testOutLevel = row?.nextTestOutLevel?.value
    val attempt = vm.attemptId
    val testOut = vm.testOutId

    when {
        testOut != null -> {
            TestOutFlow(goalId, testOut, store, app.plans, vm, onProgress, onLeave = navigator::closeTask)
        }

        attempt != null -> {
            LevelTestSteps(
                goalId = goalId,
                targetLanguage = targetLanguage,
                store = store,
                navigator = navigator,
                onProgress = onProgress,
                plan =
                    PlanAttempt(attempt, onLeave = navigator::closeTask, leaving = false) { result ->
                        val changeId = result.result?.takeIf { it.lessonsSkipped > 0 }?.changeId
                        LevelResult(
                            result = result,
                            walks = store.levelTest(goalId, attempt).wholeCourse && result.result?.wholeCourseReady == true,
                            targetLanguage = targetLanguage,
                            testOutLevel = testOutLevel,
                            pressed = vm.pressed,
                            failed = vm.failed,
                            onDone = navigator::closeTask,
                            onWalkTopics = vm::walkTopics,
                            onTestOut = { vm.testOut(it, Pressed.Other) },
                            undo = rememberPlacementUndo(app.plans, goal.id, changeId),
                        )
                    },
            )
        }

        plan == LoadState.Idle || plan == LoadState.Loading -> {
            StepLoading()
        }

        else -> {
            LengthChoice(
                wholeCourseMinutes = row?.estimatedMinutes?.toInt() ?: 0,
                pressed = vm.pressed,
                failed = vm.failed,
                onStart = vm::start,
                testOutLevel = testOutLevel,
                initial = if (testOutFirst) TestChoice.TestOut else TestChoice.Quick,
                onTestOut = { testOutLevel?.let(vm::testOut) },
            )
        }
    }
}

private val com.zoonk.android.data.Resource<LanguageLevelTest>.wholeCourse: Boolean
    get() =
        (state.value.value as? LanguageLevelTest.LanguageLevelTestOneOf1Value)?.value?.length ==
            LanguageLevelTestOneOf1.Length.WHOLE_COURSE

/** Main's `LevelResult`: each skill's range, what the test skipped, and the way on. */
@Composable
internal fun ColumnScope.LevelResult(
    result: LanguageLevelTestResult,
    walks: Boolean,
    targetLanguage: String,
    testOutLevel: String?,
    pressed: Pressed?,
    failed: Boolean,
    onDone: () -> Unit,
    onWalkTopics: () -> Unit,
    onTestOut: (String) -> Unit,
    undo: PlacementUndoViewModel? = null,
    onboarding: Boolean = false,
) {
    val skipped =
        result.result
            ?.levelsSkipped
            .orEmpty()
            .map { it.value }
    val lessons = result.result?.lessonsSkipped?.toInt() ?: 0
    val ranges = result.result?.ranges.orEmpty()
    TestOutcome(
        title = stringResource(R.string.placementtest_your_level, languageName(targetLanguage, currentLocale())),
        lead =
            if (skipped.isNotEmpty()) {
                pluralStringResource(R.plurals.placementtest_levels_skipped, lessons, lessons, skipped.joinToString(", "))
            } else {
                stringResource(R.string.placementtest_keeps_adjusting)
            },
        action =
            stringResource(
                when {
                    walks -> R.string.placementtest_keep_going
                    onboarding -> R.string.onboarding_continue
                    else -> R.string.placementtest_done
                },
            ),
        onAction = if (walks) onWalkTopics else onDone,
        busy = pressed == Pressed.Main,
        enabled = pressed != Pressed.Other,
        failed = failed,
        undo = undo,
        other =
            if (testOutLevel != null && !walks) {
                { width ->
                    TextButton(
                        busy = pressed == Pressed.Other,
                        onClick = { onTestOut(testOutLevel) },
                        modifier = width,
                        enabled = pressed != Pressed.Main && undo?.saving != true,
                    ) {
                        Text(stringResource(R.string.placementtest_test_out, testOutLevel))
                    }
                }
            } else {
                null
            },
    ) {
        val rows =
            RANGE_SKILLS.mapNotNull { (key, skill) ->
                ranges[key]?.let { range ->
                    val low = CEFR_LEVELS.indexOf(range.low.value)
                    val high = CEFR_LEVELS.indexOf(range.high.value)
                    LevelRow(
                        com.zoonk.android.feature.onboarding.setup
                            .skillName(skill),
                        levelRange(range),
                    ) { LevelRangeBar(low, high, it) }
                }
            }
        if (rows.isNotEmpty()) LevelRows(rows)
    }
}

/** A level's test-out: its questions once written, then what it skipped. */
@Composable
private fun ColumnScope.TestOutFlow(
    goalId: String,
    attemptId: UUID,
    store: OnboardingStore,
    plans: PlanStore,
    vm: LevelTestPlanViewModel,
    onProgress: (Float?) -> Unit,
    onLeave: () -> Unit,
) {
    val resource = store.levelTestOuts[LevelTestAttempt(goalId, attemptId)]
    val state by resource.collectShown()
    val test = state.value
    val scope = rememberCoroutineScope()
    val preparing = test?.preparing == true
    val run = remember { GenerationRun() }
    val poll = rememberPoll(active = preparing) { vm.checkTestOut() }
    val hold = rememberReadyHold(ready = !preparing)
    val next = test?.next?.takeIf { hold.over }
    LaunchedEffect(next?.itemId, test?.total) {
        onProgress(test?.takeIf { next != null && it.total > 0 }?.let { it.answered.toFloat() / it.total })
    }

    when {
        test == null && state is LoadState.Failed -> {
            SetupContent { LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) }
        }

        test == null -> {
            StepLoading()
        }

        preparing || !hold.over -> {
            PlacementWaiting(
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else null,
                hold = hold,
                pending = false,
                failed = false,
                onSkip = onLeave,
                skipLabel = stringResource(R.string.placementtest_not_now),
            )
        }

        next != null -> {
            SetupContent {
                key(next.itemId) {
                    PlacementQuestion(
                        item = next.recode<LanguageLevelTestOutNext, Question>(),
                        eyebrow =
                            factsLine(
                                stringResource(R.string.placementtest_test_out, test.level.value),
                                stringResource(R.string.onboarding_test_question_progress, test.answered.toInt() + 1, test.total.toInt()),
                            ),
                        labels = TrueFalseLabels.TRUE_FALSE,
                        pending = vm.answering,
                        saveFailures = vm.saveFailures,
                        onAnswer = { answer, durationMs -> vm.answerTestOut(next.itemId.toString(), answer, durationMs) },
                        onStop = vm::stopTestOut,
                    )
                }
            }
        }

        test.result == null && test.total > 0 -> {
            PlacementDone(pending = vm.busy, failed = vm.saveFailures > 0, onContinue = vm::stopTestOut)
        }

        else -> {
            val changeId = test.result?.takeIf { it.lessonsSkipped > 0 }?.changeId
            TestOutResult(test, onLeave, undo = rememberPlacementUndo(plans, UUID.fromString(goalId), changeId))
        }
    }
}

/** Main's `TestOutResult`: what a level's test-out skipped, or why it couldn't check. */
@Composable
internal fun ColumnScope.TestOutResult(
    test: LanguageLevelTestOut,
    onDone: () -> Unit,
    undo: PlacementUndoViewModel? = null,
) {
    val lessons = test.result?.lessonsSkipped?.toInt() ?: 0
    val level = test.level.value
    TestOutcome(
        title = if (lessons > 0) lessonsSkippedLine(lessons) else stringResource(R.string.placementtest_level_stays, level),
        lead =
            when {
                test.total == 0L -> stringResource(R.string.placementtest_test_out_unavailable, level)
                lessons > 0 -> placementKnownLine(lessons)
                else -> stringResource(R.string.placementtest_keeps_adjusting)
            },
        action = stringResource(R.string.placementtest_done),
        onAction = onDone,
        undo = undo,
    )
}

private val CEFR_LEVELS = listOf("A1", "A2", "B1", "B2", "C1", "C2")

private val RANGE_SKILLS =
    listOf(
        "reading" to LanguageLevelTestOneOf1LevelsInner.Skill.READING,
        "listening" to LanguageLevelTestOneOf1LevelsInner.Skill.LISTENING,
    )
