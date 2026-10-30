package com.zoonk.android.ui.scaffold

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.ui.components.SectionLabel

/** What leaving a task asks first when it would leave unsent work behind, in the screen's own words. */
data class TaskExitConfirmation(
    val title: String,
    val description: String,
    val confirm: String,
    val cancel: String,
)

/**
 * What a task shows beside it where there's room (main's task aside): a rail the window's height
 * behind a hairline, [title] level with the task's top bar and [footer] with its bottom bar. [half]
 * gives a long passage half the window.
 */
class TaskAside(
    val title: String? = null,
    val half: Boolean = false,
    val footer: (@Composable () -> Unit)? = null,
    val content: @Composable ColumnScope.() -> Unit,
)

/** In a [TaskScaffold]'s slots, whether its aside shows beside the task; where it doesn't, the screen shows that content its own way. */
@Composable
fun taskAsideBeside(): Boolean = LocalTaskAsideBeside.current

private val LocalTaskAsideBeside = compositionLocalOf { false }

/**
 * A task's frame (main's `TaskFrame`): the whole window, leave at the top start, its title centered
 * with any actions at the end, one column, and its actions pinned to the bottom over a hairline.
 * An [aside] shows beside the frame where there's room, the frame and its bars keeping to the rest.
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
    aside: TaskAside? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    var isConfirmingExit by rememberSaveable { mutableStateOf(false) }
    val leave = { if (exitConfirmation == null) onClose() else isConfirmingExit = true }

    BackHandler(enabled = exitConfirmation != null) { isConfirmingExit = true }

    val frame: @Composable () -> Unit = {
        Scaffold(
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
    }

    // The screen's modifier (focus, keys) stays on one node when an aside comes or goes.
    Box(modifier) {
        if (aside == null) {
            frame()
        } else {
            PageWithSupportingPane(supportingPane = { TaskAsideRail(aside) }, panesTouch = true, halfWidth = aside.half) { beside ->
                CompositionLocalProvider(LocalTaskAsideBeside provides beside) { frame() }
            }
        }
    }

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
private fun TaskAsideRail(aside: TaskAside) {
    Row {
        VerticalDivider()
        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.End))
                .then(
                    if (aside.footer ==
                        null
                    ) {
                        Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom))
                    } else {
                        Modifier
                    },
                ).semantics { aside.title?.let { paneTitle = it } },
        ) {
            aside.title?.let { title ->
                Box(
                    Modifier.fillMaxWidth().heightIn(min = TopAppBarDefaults.TopAppBarExpandedHeight).padding(horizontal = 24.dp),
                    contentAlignment = Alignment.CenterStart,
                ) { SectionLabel(title) }
            }
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp)
                    .padding(top = if (aside.title == null) 24.dp else 0.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                content = aside.content,
            )
            aside.footer?.let { TaskActionBar(it) }
        }
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
