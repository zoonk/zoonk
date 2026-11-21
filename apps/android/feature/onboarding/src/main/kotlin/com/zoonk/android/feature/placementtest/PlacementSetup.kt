package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.LevelTestSteps
import com.zoonk.android.feature.onboarding.setup.PlacementStep
import com.zoonk.android.feature.onboarding.setup.PlanAttempt
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.VisitOf
import com.zoonk.api.models.PlacementLength
import java.util.UUID

internal class SetupTestChoice(
    val minutes: Int,
    val pressed: Pressed?,
    val failed: Boolean,
    val startWhole: () -> Unit,
)

internal class PlacementSetupEnd(
    val saving: Boolean,
    val continueWith: (UUID?) -> Unit,
)

@Composable
internal fun ColumnScope.SetupLengthChoice(
    choice: SetupTestChoice,
    busy: Boolean,
    failed: Boolean,
    onQuick: () -> Unit,
    onSkip: () -> Unit,
) {
    LengthChoice(
        wholeCourseMinutes = choice.minutes,
        pressed = if (busy) Pressed.Main else choice.pressed,
        failed = failed || choice.failed,
        onStart = { length -> if (length == PlacementLength.QUICK) onQuick() else choice.startWhole() },
        onSkip = onSkip,
    )
}

@Composable
internal fun ColumnScope.PlacementSetup(
    goalId: UUID,
    subject: String,
    areaCount: Int,
    language: String,
    targetLanguage: String?,
    quickMinutes: Int,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    store: OnboardingStore,
    plans: PlanStore,
    navigator: AppNavigator,
    end: PlacementSetupEnd,
    onProgress: (Float?) -> Unit,
    onProgressLabel: (String?) -> Unit,
    onReportSaveFailure: () -> Unit,
    onQuickDone: suspend () -> WriteOutcome<*>,
) {
    val id = goalId.toString()
    val plan by plans.plan[goalId].collectShown()
    val minutes =
        plan.value
            ?.plan
            ?.placementTest
            ?.estimatedMinutes ?: 0
    val placement by store.placements[id].collectShown()
    val walk = viewModel(key = "setup-placement-walk:$id") { PlacementTestViewModel(id, store) }
    VisitOf(walk.visit)
    val phase = walk.setupPhase(placement)
    if (placement.value?.attempt != null || phase is PlacementTestPhase.Result || phase is PlacementTestPhase.Between) {
        PlacementTestFlow(goalId, subject, store, plans, onProgress, navigator::closeTask, walk, onboarding = end)
        return
    }

    if (targetLanguage == null) {
        PlacementStep(
            id,
            subject,
            areaCount,
            run,
            onRetryRun,
            store,
            onProgress,
            onQuickDone,
            onReportSaveFailure,
            onProgressLabel,
            lengthChoice = SetupTestChoice(minutes, walk.pressed, walk.failed) { walk.start(PlacementLength.WHOLE_COURSE) },
        )
        return
    }

    val assessment = viewModel(key = "setup-level-assessment:$id") { LevelTestPlanViewModel(id, store, createSavedStateHandle()) }
    VisitOf(assessment.visit)
    val attempt = assessment.attemptId
    LevelTestSteps(
        goalId = id,
        language = language,
        targetLanguage = targetLanguage,
        testMinutes = quickMinutes,
        store = store,
        navigator = navigator,
        onProgress = onProgress,
        onDone = onQuickDone,
        onReportSaveFailure = onReportSaveFailure,
        onProgressLabel = onProgressLabel,
        plan =
            attempt?.let {
                PlanAttempt(it, onLeave = navigator::closeTask, leaving = false) { result ->
                    val changeId = result.result?.takeIf { it.lessonsSkipped > 0 }?.changeId
                    LevelResult(
                        result = result,
                        walks = result.result?.wholeCourseReady == true,
                        targetLanguage = targetLanguage,
                        testOutLevel = null,
                        pressed = if (end.saving) Pressed.Main else assessment.pressed,
                        failed = assessment.failed,
                        onDone = { end.continueWith(null) },
                        onWalkTopics = assessment::walkTopics,
                        onTestOut = {},
                        undo = rememberPlacementUndo(plans, goalId, changeId),
                    )
                }
            },
        lengthChoice =
            SetupTestChoice(
                minutes,
                assessment.pressed,
                assessment.failed,
            ) { assessment.start(PlacementLength.WHOLE_COURSE) },
    )
}
