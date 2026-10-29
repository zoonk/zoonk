package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChangePreview
import java.time.LocalDate

/**
 * Main's `PlanPreviewState`: a preview belongs to the operations it asked about and the plan it
 * asked them of. Each request is its own instance, so a late answer can tell it's no longer the
 * current one.
 */
sealed class PlanPreviewState {
    data object Idle : PlanPreviewState()

    sealed class Asked(
        val operations: List<PlanOp>,
        val plan: Plan,
    ) : PlanPreviewState()

    class Loading(
        operations: List<PlanOp>,
        plan: Plan,
    ) : Asked(operations, plan)

    class Failed(
        operations: List<PlanOp>,
        plan: Plan,
    ) : Asked(operations, plan)

    class Ready(
        operations: List<PlanOp>,
        plan: Plan,
        val preview: PlanChangePreview,
    ) : Asked(operations, plan)
}

/** Idle unless it previews [operations] on [plan]; a refresh that reads the same plan again keeps it. */
internal fun PlanPreviewState.of(
    operations: List<PlanOp>,
    plan: Plan,
): PlanPreviewState =
    if (this is PlanPreviewState.Asked && this.plan == plan &&
        this.operations == operations
    ) {
        this
    } else {
        PlanPreviewState.Idle
    }

/**
 * The state once [request]'s answer arrives: unchanged when another request (or none) took its
 * place, and failed when there's nothing to show (not built yet, or a change without its effect).
 */
internal fun PlanPreviewState.resolve(
    request: PlanPreviewState.Loading,
    preview: PlanChangePreview?,
): PlanPreviewState =
    when {
        this !== request -> {
            this
        }

        preview == null || !preview.ready || (!preview.unchanged && preview.effect == null) -> {
            PlanPreviewState.Failed(
                request.operations,
                request.plan,
            )
        }

        else -> {
            PlanPreviewState.Ready(request.operations, request.plan, preview)
        }
    }

/** Main's `getGoalDateMove`: the goal's date before and after, for a change that sets it. */
internal fun goalDateMove(
    operations: List<PlanOp>,
    targetDate: LocalDate?,
): GoalDateMove? = (operations.firstOrNull() as? PlanOp.TargetDate)?.date?.let { GoalDateMove(after = it, before = targetDate) }

/**
 * Main's `OfferPreview`, in a suggestion: what a previewed change would do, and Apply, which is never
 * offered without the diff it makes. [goalDate] adds the goal's date to the diff for a change that
 * moves it.
 */
@Composable
internal fun PlanPreviewResult(
    state: PlanPreviewState,
    onApply: () -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
    goalDate: GoalDateMove? = null,
) {
    val notNow = stringResource(R.string.plan_not_now)

    when (state) {
        PlanPreviewState.Idle -> {}

        is PlanPreviewState.Loading -> {
            PreviewStatus(stringResource(R.string.plan_checking_changes))
            SuggestionActions { SuggestionAction(notNow, onDismiss, secondary = true) }
        }

        is PlanPreviewState.Failed -> {
            PreviewStatus(stringResource(R.string.plan_couldnt_check_changes))
            SuggestionActions {
                SuggestionAction(stringResource(R.string.plan_try_again), onRetry)
                SuggestionAction(notNow, onDismiss, secondary = true)
            }
        }

        is PlanPreviewState.Ready -> {
            val preview = state.preview
            if (preview.unchanged) {
                SuggestionDescription(stringResource(R.string.plan_stays_as_it_is))
            } else {
                PlanEffectDiff(preview.effect, goalDate = goalDate)
                if (preview.feasibility?.fits == true) SuggestionDescription(stringResource(R.string.plan_then_covers_everything))
            }
            SuggestionActions {
                if (!preview.unchanged && preview.effect != null) SuggestionAction(stringResource(R.string.plan_apply), onApply)
                SuggestionAction(notNow, onDismiss, secondary = true)
            }
        }
    }
}

@Composable
private fun PreviewStatus(text: String) {
    Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) { SuggestionDescription(text) }
}
