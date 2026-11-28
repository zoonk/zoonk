package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
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
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TestRow
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.LevelTestAttempt
import com.zoonk.android.feature.onboarding.setup.InterfaceOffer
import com.zoonk.android.feature.onboarding.setup.LevelRow
import com.zoonk.android.feature.onboarding.setup.LevelRows
import com.zoonk.android.feature.onboarding.setup.LevelTestSteps
import com.zoonk.android.feature.onboarding.setup.LocalSetupSpeech
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.PlanAttempt
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.isPending
import com.zoonk.android.feature.onboarding.setup.rememberPoll
import com.zoonk.android.feature.onboarding.setup.withPoll
import com.zoonk.android.feature.plan.lessonsSkippedLine
import com.zoonk.android.feature.plan.levelRange
import com.zoonk.android.feature.questions.ItemSet
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ListeningStimulus
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.SetPlace
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LevelRangeBar
import com.zoonk.android.ui.components.LinkButton
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.languageName
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOf1LevelsInner
import com.zoonk.api.models.LanguageLevelTestOneOfResultRangesValue
import com.zoonk.api.models.LanguageLevelTestOut
import com.zoonk.api.models.LanguageLevelTestOutNext
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanPlacementTest
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * `/level-test`: a language course's level test from its plan, and its level test-outs. Other courses have none, so
 * they go to the plan, as main redirects.
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
    CompositionLocalProvider(LocalSetupSpeech provides app.speech) {
        TestTask(app.learnerSummary.summary, summary, goal, elsewhere, navigator) { _, onSitting ->
            goal?.takeIf { language }?.let { LevelTestPlanFlow(it, route.testOut, app, navigator, onSitting) }
        }
    }
}

@Composable
private fun ColumnScope.LevelTestPlanFlow(
    goal: LearnerSummaryGoal,
    testOutFirst: Boolean,
    app: AppContainer,
    navigator: AppNavigator,
    onSitting: (Sitting?) -> Unit,
) {
    val goalId = goal.id.toString()
    val targetLanguage = goal.targetLanguage.orEmpty()
    val store = app.onboarding
    val tracker = LocalEventTracker.current
    val vm = viewModel(key = "level-test-plan:$goalId") { LevelTestPlanViewModel(goalId, store, createSavedStateHandle()) }
    VisitOf(vm.visit)
    val plan by app.plans.plan[goal.id].collectShown()
    val row = (plan.value?.plan?.placementTest as? PlanPlacementTest.PlanPlacementTestOneOf1Value)?.value
    val testOutLevel = row?.nextTestOutLevel?.value
    val opened by store.levelTest(goalId, null).collectShown()
    // Coming back to a test left open goes on with it; a finished one is offered again.
    val open = opened.value?.takeIf { !it.isFinished }?.openAttemptId
    LaunchedEffect(open) { open?.let(vm::resume) }
    val attempt = vm.attemptId
    val testOut = vm.testOutId
    val test = languageTest(goalId, onboarding = false, opened.value)

    when {
        testOut != null -> {
            TestOutFlow(goalId, testOut, app, vm, onSitting, onLeave = navigator::closeTask)
        }

        attempt != null -> {
            LevelTestSteps(
                goalId = goalId,
                targetLanguage = targetLanguage,
                store = store,
                navigator = navigator,
                onSitting = onSitting,
                plan =
                    PlanAttempt(attempt, onLeave = navigator::closeTask, leaving = false, visit = vm.sitting) { result ->
                        val undo = rememberPlacementUndo(app.plans, goal.id, result.result?.takeIf { it.lessonsSkipped > 0 }?.changeId)
                        // Undo puts the skipped lessons back, so the next lesson may be one of them.
                        val lesson = result.result?.nextLesson?.takeIf { undo?.restoredLessons == null }
                        LevelResult(
                            result = result,
                            targetLanguage = targetLanguage,
                            testOutLevel = testOutLevel,
                            pressed = vm.pressed,
                            failed = vm.failed,
                            action =
                                stringResource(
                                    if (lesson !=
                                        null
                                    ) {
                                        R.string.placementtest_start_lesson
                                    } else {
                                        R.string.placementtest_done
                                    },
                                ),
                            onAction = {
                                navigator.closeTask()
                                lesson?.let {
                                    tracker.track(AnalyticsEvent.TestLessonStarted(test, it.id.toString()))
                                    navigator.open(AppRoute.Lesson(it.id.toString()))
                                }
                            },
                            onTestOut = { vm.testOut(it, Pressed.Other) },
                            undo = undo,
                        )
                    },
            )
        }

        opened.isPending || open != null -> {
            StepLoading()
        }

        else -> {
            val read = opened.value
            val cards =
                listOfNotNull(
                    testCard(
                        TestRow.Quick,
                        stringResource(R.string.placementtest_level_title),
                        read?.total?.toInt(),
                        read?.estimatedMinutes?.toInt(),
                    ),
                    testOutLevel?.let {
                        OfferCard(
                            TestRow.TestOut,
                            stringResource(R.string.placementtest_test_out, it),
                            LearnKind.Mock,
                            line = stringResource(R.string.placementtest_test_out_description, it),
                        )
                    },
                )
            TestOffer(
                title = stringResource(R.string.placementtest_start_title),
                sentence = stringResource(R.string.placementtest_choose_description),
                cards = cards,
                initial = if (testOutFirst) TestRow.TestOut else TestRow.Quick,
                pressed = vm.pressed,
                failed = vm.failed,
                onChoose = { if (it == TestRow.TestOut) testOutLevel?.let(vm::testOut) else vm.start() },
                test = test,
                onNotNow = {
                    tracker.track(AnalyticsEvent.TestSkipped(test))
                    navigator.closeTask()
                },
            )
        }
    }
}

/** A language's level test for analytics: its ceiling and the open attempt, once the read has them. */
internal fun languageTest(
    goalId: String,
    onboarding: Boolean,
    read: LanguageLevelTest?,
    attemptId: UUID? = read?.openAttemptId,
) = TestContext(
    goalId = goalId,
    test = TestContext.Kind.Language,
    surface = if (onboarding) TestContext.Surface.Onboarding else TestContext.Surface.Plan,
    questions = read?.total,
    attemptId = attemptId?.toString(),
)

/** The test read without an attempt: the latest sitting, which a new visit goes on with until it has a result. */
internal val LanguageLevelTest.openAttemptId: UUID?
    get() =
        when (this) {
            is LanguageLevelTest.LanguageLevelTestOneOf2Value -> null
            is LanguageLevelTest.LanguageLevelTestOneOfValue -> value.attemptId
            is LanguageLevelTest.LanguageLevelTestOneOf1Value -> value.attemptId
        }

/** The read's latest sitting has its own result; a retake's read still carries the earlier test's until it ends. */
internal val LanguageLevelTest.isFinished: Boolean
    get() {
        val result =
            when (this) {
                is LanguageLevelTest.LanguageLevelTestOneOf2Value -> null
                is LanguageLevelTest.LanguageLevelTestOneOfValue -> value.result
                is LanguageLevelTest.LanguageLevelTestOneOf1Value -> value.result
            }
        return result != null && result.attemptId == openAttemptId
    }

internal val LanguageLevelTest.total: Long
    get() =
        when (this) {
            is LanguageLevelTest.LanguageLevelTestOneOf2Value -> 0
            is LanguageLevelTest.LanguageLevelTestOneOfValue -> value.total
            is LanguageLevelTest.LanguageLevelTestOneOf1Value -> value.total
        }

internal val LanguageLevelTest.estimatedMinutes: Long
    get() =
        when (this) {
            is LanguageLevelTest.LanguageLevelTestOneOf2Value -> 0
            is LanguageLevelTest.LanguageLevelTestOneOfValue -> value.estimatedMinutes
            is LanguageLevelTest.LanguageLevelTestOneOf1Value -> value.estimatedMinutes
        }

/**
 * Main's `LevelResult`: each skill's range ("Not tested yet" for one whose questions weren't finished), what the test
 * skipped, and the lesson the plan goes on with.
 */
@Composable
internal fun ColumnScope.LevelResult(
    result: LanguageLevelTestResult,
    targetLanguage: String,
    testOutLevel: String?,
    pressed: Pressed?,
    failed: Boolean,
    action: String,
    onAction: () -> Unit,
    onTestOut: (String) -> Unit,
    undo: PlacementUndoViewModel? = null,
    busy: Boolean = false,
    /** Onboarding's quiet offer to use the app in the learner's own language, under what the test found. */
    appLanguage: String? = null,
) {
    val lessons = result.result?.lessonsSkipped?.toInt() ?: 0
    val ranges = result.result?.ranges.orEmpty()
    TestOutcome(
        title = stringResource(R.string.placementtest_your_level, languageName(targetLanguage, currentLocale())),
        lead =
            when {
                lessons > 0 -> null
                READING in ranges && LISTENING !in ranges -> stringResource(R.string.placementtest_take_again_later)
                else -> stringResource(R.string.placementtest_keeps_adjusting)
            },
        action = action,
        onAction = onAction,
        busy = busy || pressed == Pressed.Main,
        enabled = !busy && pressed != Pressed.Other,
        failed = failed,
        undo = undo,
    ) {
        SkippedCaption(if (undo?.restoredLessons == null) lessons else 0) { LevelRows(levelRows(ranges)) }
        result.result
            ?.nextLesson
            ?.takeIf { undo?.restoredLessons == null }
            ?.let { UpNext(it.title) }

        if (testOutLevel != null) {
            LinkButton(
                text = stringResource(R.string.placementtest_test_out, testOutLevel),
                onClick = { onTestOut(testOutLevel) },
                enabled = pressed != Pressed.Main && undo?.saving != true,
                busy = pressed == Pressed.Other,
            )
        }
        appLanguage?.let { InterfaceOffer(it) }
    }
}

/** Each tested skill's range on its bar, "Not tested yet" for one whose questions weren't finished. */
@Composable
private fun levelRows(ranges: Map<String, LanguageLevelTestOneOfResultRangesValue>): List<LevelRow> =
    RANGE_SKILLS.map { (key, skill) ->
        val range = ranges[key]
        val name =
            com.zoonk.android.feature.onboarding.setup
                .skillName(skill)
        if (range == null) {
            LevelRow(name, stringResource(R.string.placementtest_not_tested), muted = true) { LevelRangeBar(-1, -1, it) }
        } else {
            LevelRow(name, levelRange(range)) {
                LevelRangeBar(CEFR_LEVELS.indexOf(range.low.value), CEFR_LEVELS.indexOf(range.high.value), it)
            }
        }
    }

/** A level's test-out: its questions once written, then what it skipped. */
@Composable
private fun ColumnScope.TestOutFlow(
    goalId: String,
    attemptId: UUID,
    app: AppContainer,
    vm: LevelTestPlanViewModel,
    onSitting: (Sitting?) -> Unit,
    onLeave: () -> Unit,
) {
    val resource = app.onboarding.levelTestOuts[LevelTestAttempt(goalId, attemptId)]
    val state by resource.collectShown()
    val test = state.value
    val scope = rememberCoroutineScope()
    val preparing = test?.preparing == true
    val run = remember { GenerationRun() }
    val poll = rememberPoll(active = preparing) { vm.checkTestOut() }
    val hold = rememberReadyHold(ready = !preparing)
    val next = test?.next?.takeIf { hold.over }
    val context =
        TestContext(
            goalId,
            TestContext.Kind.LevelTestOut,
            TestContext.Surface.Plan,
            questions = test?.total,
            attemptId = attemptId.toString(),
        )
    val title = test?.let { stringResource(R.string.placementtest_test_out, it.level.value) }
    LaunchedEffect(next?.itemId, test?.total, title, vm.busy) {
        onSitting(
            if (title != null && next != null && test.total > 0) {
                asking(
                    context,
                    title,
                    test.answered,
                    test.total,
                    stop =
                        TestStop(enabled = !vm.busy, onStop = vm::stopTestOut).takeIf {
                            test.answered >
                                0
                        },
                )
            } else {
                Sitting()
            },
        )
    }
    DisposableEffect(Unit) { onDispose { onSitting(null) } }

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
                onboarding = false,
            )
        }

        next != null -> {
            TrackFirstQuestion(vm.sitting, context, test.answered + 1, attemptId.toString())
            SetupContent {
                key(next.itemId) {
                    val question = next.recode<LanguageLevelTestOutNext, Question>()
                    PlacementQuestion(
                        item = question,
                        labels = TrueFalseLabels.TRUE_FALSE,
                        pending = vm.answering,
                        saveFailures = vm.saveFailures,
                        onAnswer = { answer, durationMs -> vm.answerTestOut(next.itemId.toString(), answer, durationMs) },
                        media = { question.set?.let { TestOutMaterial(it, "$attemptId:${question.itemId}", app) } },
                    )
                }
            }
        }

        test.result == null && test.total > 0 -> {
            PlacementDone(pending = vm.busy, failed = vm.saveFailures > 0, onContinue = vm::stopTestOut)
        }

        else -> {
            val changeId = test.result?.takeIf { it.lessonsSkipped > 0 }?.changeId
            TestOutResult(test, onLeave, undo = rememberPlacementUndo(app.plans, UUID.fromString(goalId), changeId))
        }
    }
}

@Composable
private fun TestOutMaterial(
    set: ItemSet,
    askedIn: String,
    app: AppContainer,
) {
    val listening = set.listening
    if (listening == null) {
        ItemSetText(set)
        return
    }
    val session = app.sessions.current ?: return
    SetPlace(set)
    ListeningStimulus(
        listening = listening,
        playsKey = "$askedIn:${set.id}",
        session = session,
        speech = app.speech,
        plays = app.listeningPlays,
    )
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
private const val READING = "reading"
private const val LISTENING = "listening"

private val RANGE_SKILLS =
    listOf(
        READING to LanguageLevelTestOneOf1LevelsInner.Skill.READING,
        LISTENING to LanguageLevelTestOneOf1LevelsInner.Skill.LISTENING,
    )
