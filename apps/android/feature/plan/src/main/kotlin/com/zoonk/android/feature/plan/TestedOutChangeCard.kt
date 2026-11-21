package com.zoonk.android.feature.plan

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionCard
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionResult
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.api.models.PlanChange

@Composable
fun TestedOutChangeCard(
    change: PlanChange,
    dateKind: GoalDateKind,
    undone: Boolean,
    saving: Boolean,
    failed: Boolean,
    onUndo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val restored = undone || change.status == PlanChange.Status.UNDONE
    val title = planChangeSentence(change, dateKind)
    SuggestionCard(
        label = title,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_playlist_add),
        answered = restored,
        card = {
            if (restored) {
                SuggestionResult(pluralStringResource(R.plurals.testout_lessons_back, change.lessonsSkipped.toInt()))
            } else {
                SuggestionHeader(title)
                PlanEffectDiff(change.effect, dateKind = dateKind, summary = false)
                if (change.canUndo) {
                    SuggestionActions {
                        SuggestionAction(
                            stringResource(R.string.plan_undo),
                            onClick = onUndo,
                            busy = saving,
                            secondary = true,
                            leadingIcon = { ButtonIcon(R.drawable.ic_undo) },
                        )
                    }
                }
            }
            if (failed) SuggestionSaveError(stringResource(R.string.plan_undo_failed))
        },
    )
}
