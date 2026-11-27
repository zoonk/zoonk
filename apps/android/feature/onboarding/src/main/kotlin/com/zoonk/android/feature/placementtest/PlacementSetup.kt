package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.TestRow
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.LevelTestSteps
import com.zoonk.android.feature.onboarding.setup.PlanAttempt
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.isPending
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.api.models.OnboardingPlacement
import com.zoonk.api.models.OnboardingPlacementTest
import java.util.UUID

/**
 * Onboarding's placement step for a course or a language, as the server set it up ([placement]): its offer, or the test
 * itself for a learner who asked for one on the level question (`direct`), or the test they left (`resume`).
 */
@Composable
internal fun ColumnScope.PlacementSetup(
    goalId: UUID,
    subject: String,
    /** The learner's own language, which a language's result offers to use the app in. */
    language: String,
    targetLanguage: String?,
    placement: OnboardingPlacement?,
    /** The first lesson by its name, where onboarding knows it. */
    firstLesson: String?,
    store: OnboardingStore,
    plans: PlanStore,
    navigator: AppNavigator,
    end: PlacementSetupEnd,
    onSitting: (Sitting?) -> Unit,
    onReportSaveFailure: () -> Unit,
) {
    if (targetLanguage != null) {
        LanguageSetup(
            goalId.toString(),
            language,
            targetLanguage,
            placement?.mode,
            firstLesson,
            store,
            plans,
            navigator,
            end,
            onSitting,
            onReportSaveFailure,
        )
    } else {
        CourseSetup(goalId, subject, placement, firstLesson, store, plans, navigator, end, onSitting)
    }
}

@Composable
private fun ColumnScope.CourseSetup(
    goalId: UUID,
    subject: String,
    placement: OnboardingPlacement?,
    firstLesson: String?,
    store: OnboardingStore,
    plans: PlanStore,
    navigator: AppNavigator,
    end: PlacementSetupEnd,
    onSitting: (Sitting?) -> Unit,
) {
    val id = goalId.toString()
    val vm = viewModel(key = "setup-placement:$id") { PlacementTestViewModel(id, store, createSavedStateHandle()) }
    VisitOf(vm.visit)
    ActOn(vm.declined) { end.continueWith(null) }
    val read by store.placements[id].collectShown()
    if (vm.phase(read, finished = true) != PlacementTestPhase.Choose) {
        PlacementTestFlow(goalId, subject, store, plans, onSitting, navigator, vm, onboarding = end)
        return
    }

    if (placement?.mode == OnboardingPlacement.Mode.DIRECT && !vm.failed) {
        LaunchedEffect(vm.busy) { vm.startAsked() }
        StepLoading()
        return
    }

    val offer = (placement?.test as? OnboardingPlacementTest.OnboardingPlacementTestOneOfValue)?.value?.offer
    TestOffer(
        title = stringResource(R.string.placementtest_where_to_start),
        sentence = stringResource(R.string.placementtest_choose_description),
        cards =
            listOf(
                testCard(
                    TestRow.Quick,
                    stringResource(R.string.placementtest_test),
                    offer?.questions?.toInt(),
                    offer?.estimatedMinutes?.toInt(),
                ),
                firstLessonCard(firstLesson),
            ),
        initial = TestRow.Quick,
        pressed = vm.pressed ?: Pressed.Main.takeIf { end.saving },
        failed = vm.failed,
        onChoose = { if (it == TestRow.FirstLesson) vm.decline() else vm.start() },
        test = courseTest(goalId, onboarding = true, attempt = null).copy(questions = offer?.questions),
    )
}

@Composable
private fun ColumnScope.LanguageSetup(
    goalId: String,
    language: String,
    targetLanguage: String,
    mode: OnboardingPlacement.Mode?,
    firstLesson: String?,
    store: OnboardingStore,
    plans: PlanStore,
    navigator: AppNavigator,
    end: PlacementSetupEnd,
    onSitting: (Sitting?) -> Unit,
    onReportSaveFailure: () -> Unit,
) {
    val vm = viewModel(key = "setup-level-test:$goalId") { LevelTestPlanViewModel(goalId, store, createSavedStateHandle()) }
    VisitOf(vm.visit)
    val opened by store.levelTest(goalId, null).collectShown()
    val attempt = vm.attemptId ?: opened.value?.openAttemptId

    if (attempt != null) {
        LevelTestSteps(
            goalId = goalId,
            targetLanguage = targetLanguage,
            store = store,
            navigator = navigator,
            onSitting = onSitting,
            onReportSaveFailure = onReportSaveFailure,
            plan =
                PlanAttempt(
                    attempt,
                    onLeave = { end.continueWith(null) },
                    leaving = end.saving,
                    onboarding = true,
                    visit = vm.sitting,
                ) { result ->
                    LevelResult(
                        result = result,
                        targetLanguage = targetLanguage,
                        testOutLevel = null,
                        pressed = vm.pressed,
                        failed = vm.failed,
                        action = stringResource(R.string.onboarding_continue),
                        onAction = { end.continueWith(null) },
                        onTestOut = {},
                        undo =
                            rememberPlacementUndo(
                                plans,
                                UUID.fromString(goalId),
                                result.result?.takeIf { it.lessonsSkipped > 0 }?.changeId,
                            ),
                        busy = end.saving,
                        appLanguage = language,
                    )
                },
        )
        return
    }

    if (opened.isPending || (mode == OnboardingPlacement.Mode.DIRECT && !vm.failed)) {
        if (mode == OnboardingPlacement.Mode.DIRECT) LaunchedEffect(vm.busy) { vm.startAsked() }
        StepLoading()
        return
    }

    val read = opened.value
    TestOffer(
        title = stringResource(R.string.placementtest_where_to_start),
        sentence = stringResource(R.string.placementtest_choose_description),
        cards =
            listOf(
                testCard(
                    TestRow.Quick,
                    stringResource(R.string.placementtest_level_title),
                    read?.total?.toInt(),
                    read?.estimatedMinutes?.toInt(),
                ),
                firstLessonCard(firstLesson),
            ),
        initial = TestRow.Quick,
        pressed = vm.pressed ?: Pressed.Main.takeIf { end.saving },
        failed = vm.failed,
        onChoose = { if (it == TestRow.FirstLesson) end.continueWith(null) else vm.start() },
        test = languageTest(goalId, onboarding = true, read),
    )
}
