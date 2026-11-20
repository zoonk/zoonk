package com.zoonk.android.feature.plan

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TextButton

/**
 * Main's `ExamOverActions`: an exam whose date passed with lessons left, answered in the page's bar on
 * Today and the Plan. "Archive goal" asks first; "Keep studying" is the main action and applies at once.
 * Either answer ends the state, so nothing remembers it was asked.
 */
@Composable
fun ExamOverActions(
    goalTitle: String,
    keeping: Boolean,
    archiving: Boolean,
    onArchive: () -> Unit,
    onKeepStudying: () -> Unit,
) {
    var asking by rememberSaveable { mutableStateOf(false) }

    TaskActions(
        back = {
            OutlinedButton(
                onClick = { asking = true },
                enabled = !keeping,
                busy = archiving,
                leadingIcon = { ButtonIcon(R.drawable.ic_archive) },
            ) { Text(stringResource(R.string.plan_archive_goal_short)) }
        },
    ) { main ->
        Button(onClick = onKeepStudying, modifier = main, enabled = !archiving, busy = keeping) {
            Text(stringResource(R.string.plan_keep_studying))
        }
    }

    if (asking) {
        ArchiveGoalDialog(
            goalTitle,
            onArchive = {
                asking = false
                onArchive()
            },
            onDismiss = { asking = false },
        )
    }
}

/** Main's `ArchiveGoal` question, wherever a goal can be archived. */
@Composable
fun ArchiveGoalDialog(
    goalTitle: String,
    onArchive: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.plan_archive_title, goalTitle)) },
        text = { Text(stringResource(R.string.plan_archive_description)) },
        confirmButton = { TextButton(onClick = onArchive) { Text(stringResource(R.string.plan_archive)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.plan_cancel)) } },
    )
}
