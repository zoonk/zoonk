package com.zoonk.android.app.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.GoalMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.goalSpokenName
import com.zoonk.api.models.LearnerSummaryGoal
import java.util.UUID

/**
 * A waiting goal the free plan has no room for: pausing one of the [active] goals starts it, in one
 * request, so a start the server refuses pauses nothing. [pausing] is the goal that request pauses,
 * and a start that [failed] is said here, since the sheet covers the window's snackbars.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun MakeRoomSheet(
    waitingName: String,
    active: List<LearnerSummaryGoal>,
    pausing: UUID?,
    failed: Boolean,
    onPause: (UUID) -> Unit,
    onGetPlus: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        MakeRoomContent(waitingName, active, pausing, failed, onPause, onGetPlus)
    }
}

@Composable
internal fun MakeRoomContent(
    waitingName: String,
    active: List<LearnerSummaryGoal>,
    pausing: UUID?,
    failed: Boolean,
    onPause: (UUID) -> Unit,
    onGetPlus: () -> Unit,
) {
    val title = stringResource(R.string.goal_switcher_make_room_title, waitingName)

    Column(
        Modifier
            .verticalScroll(rememberScrollState())
            .navigationBarsPadding()
            .padding(bottom = 16.dp)
            .semantics { paneTitle = title },
    ) {
        Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            Text(
                stringResource(R.string.goal_switcher_make_room_description, waitingName),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        Column(Modifier.padding(vertical = 8.dp)) {
            active.forEachIndexed { index, goal ->
                if (index > 0) ListDivider()
                ActiveGoalRow(goal, busy = pausing == goal.id, enabled = pausing == null, onPause = { onPause(goal.id) })
            }
        }

        Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (failed) {
                Text(
                    stringResource(R.string.goal_switcher_start_failed),
                    Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            OutlinedButton(onClick = onGetPlus, modifier = Modifier.fillMaxWidth(), size = ButtonSize.Large) {
                Text(stringResource(R.string.subscription_get_plus))
            }
        }
    }
}

@Composable
private fun ActiveGoalRow(
    goal: LearnerSummaryGoal,
    busy: Boolean,
    enabled: Boolean,
    onPause: () -> Unit,
) {
    val spoken = goalSpokenName(goal.displayName, goal.targetLanguage, goal.targetRegion)
    val pauseGoal = stringResource(R.string.goal_switcher_pause_goal, spoken)

    ListRow(
        headline = { Text(goal.displayName, Modifier.semantics { contentDescription = spoken }) },
        leading = { GoalMark(goal.displayName, goal.languageFlag) },
        trailing = {
            Button(
                onClick = onPause,
                modifier = Modifier.semantics { contentDescription = pauseGoal },
                enabled = enabled,
                busy = busy,
                size = ButtonSize.Small,
            ) {
                Text(stringResource(R.string.goal_switcher_pause))
            }
        },
    )
}
