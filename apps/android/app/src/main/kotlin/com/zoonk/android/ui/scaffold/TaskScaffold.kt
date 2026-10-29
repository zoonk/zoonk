package com.zoonk.android.ui.scaffold

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.app.LocalSnackbarHostState

/** What leaving a task asks first when it would leave unsent work behind, in the screen's own words. */
data class TaskExitConfirmation(
    val title: String,
    val description: String,
    val confirm: String,
    val cancel: String,
)

/**
 * A task's frame (main's `TaskFrame`): the whole window, leave at the top start, its title centered
 * with any actions at the end, one column, and its actions pinned to the bottom over a hairline.
 * With an [exitConfirmation], leaving (the close action or back) asks first. [closeLabel] says what
 * closing does when it's more than leaving, as ending a practice that keeps its answers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskScaffold(
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    title: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
    exitConfirmation: TaskExitConfirmation? = null,
    closeLabel: String? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    var isConfirmingExit by rememberSaveable { mutableStateOf(false) }
    val leave = { if (exitConfirmation == null) onClose() else isConfirmingExit = true }

    BackHandler(enabled = exitConfirmation != null) { isConfirmingExit = true }

    Scaffold(
        modifier = modifier,
        topBar = {
            CenterAlignedTopAppBar(
                title = title,
                navigationIcon = { CloseButton(onClick = leave, label = closeLabel) },
                actions = actions,
            )
        },
        bottomBar = { if (bottomBar != null) TaskActionBar(bottomBar) },
        snackbarHost = { SnackbarHost(LocalSnackbarHostState.current) },
        content = content,
    )

    if (exitConfirmation != null && isConfirmingExit) {
        AlertDialog(
            onDismissRequest = { isConfirmingExit = false },
            title = { Text(exitConfirmation.title) },
            text = { Text(exitConfirmation.description) },
            confirmButton = {
                TextButton(
                    onClick = {
                        isConfirmingExit = false
                        onClose()
                    },
                ) { Text(exitConfirmation.confirm) }
            },
            dismissButton = { TextButton(onClick = { isConfirmingExit = false }) { Text(exitConfirmation.cancel) } },
        )
    }
}

@Composable
private fun TaskActionBar(content: @Composable () -> Unit) {
    DockedActionBar {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(
                        WindowInsets.safeDrawing
                            .only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)
                            .union(WindowInsets.ime),
                    ).padding(16.dp),
        ) {
            content()
        }
    }
}
