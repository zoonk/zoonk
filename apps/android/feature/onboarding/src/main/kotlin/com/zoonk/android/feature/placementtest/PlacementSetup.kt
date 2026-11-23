package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.TrackOnboardingQuestion
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.LevelTestLanguageNotes
import com.zoonk.android.feature.onboarding.setup.LevelTestSteps
import com.zoonk.android.feature.onboarding.setup.PlacementStep
import com.zoonk.android.feature.onboarding.setup.PlanAttempt
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.showAlphabetNote
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.PlacementLength
import kotlinx.coroutines.Deferred
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
internal fun ColumnScope.PlacementSetup(
    goalId: UUID,
    subject: String,
    language: String,
    targetLanguage: String?,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    store: OnboardingStore,
    plans: PlanStore,
    navigator: AppNavigator,
    end: PlacementSetupEnd,
    onProgress: (Float?) -> Unit,
    onReportSaveFailure: () -> Unit,
    onQuickDone: () -> Deferred<WriteOutcome<*>>?,
) {
    val id = goalId.toString()
    val plan by plans.plan[goalId].collectShown()
    val minutes =
        plan.value
            ?.plan
            ?.placementTest
            ?.estimatedMinutes ?: 0
    val placement by store.placements[id].collectShown()
    val walk = viewModel(key = "setup-placement-walk:$id") { PlacementTestViewModel(id, store, createSavedStateHandle()) }
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
            run,
            onRetryRun,
            store,
            onProgress,
            { onQuickDone()?.await() ?: WriteOutcome.Obsolete },
            onReportSaveFailure,
            lengthChoice = SetupTestChoice(minutes, walk.pressed, walk.failed) { walk.start(PlacementLength.WHOLE_COURSE) },
        )
        return
    }

    val assessment = viewModel(key = "setup-level-assessment:$id") { LevelTestPlanViewModel(id, store, createSavedStateHandle()) }
    VisitOf(assessment.visit)
    ActOn(assessment.skipped) { assessment.completeSkip(onQuickDone()) }
    val opened by store.levelTest(id, null).collectShown()
    val attempt = assessment.attemptId ?: opened.value?.openAttemptId
    if (attempt == null) {
        if (opened == LoadState.Idle || opened == LoadState.Loading) {
            StepLoading()
            return
        }
        TrackOnboardingQuestion(id, "placement")
        LengthChoice(
            wholeCourseMinutes = minutes,
            pressed = assessment.pressed,
            failed = assessment.failed,
            onStart = assessment::start,
            onSkip = assessment::skip,
            notes = { LevelTestLanguageNotes(language, showAlphabetNote = opened.value?.showAlphabetNote == true) },
        )
        return
    }

    LevelTestSteps(
        goalId = id,
        targetLanguage = targetLanguage,
        store = store,
        navigator = navigator,
        onProgress = onProgress,
        onReportSaveFailure = onReportSaveFailure,
        plan =
            PlanAttempt(attempt, onLeave = { end.continueWith(null) }, leaving = end.saving, onboarding = true) { result ->
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
                    onboarding = true,
                )
            },
    )
}

/** The test onboarding opened earlier and left open, which a new visit goes on with. */
private val LanguageLevelTest.openAttemptId: UUID?
    get() =
        when (this) {
            is LanguageLevelTest.LanguageLevelTestOneOfValue -> value.attemptId.takeIf { value.length != null }
            is LanguageLevelTest.LanguageLevelTestOneOf1Value -> value.attemptId.takeIf { value.length != null }
        }
