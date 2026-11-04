package com.zoonk.android.ui.scaffold

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.LocalWideLayout
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.SnackbarHost
import com.zoonk.android.ui.components.readWideLayout

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

/**
 * One bar either way, so what its [actions] opened stays open as the book folds. Across an unfolded
 * book's fold, or a spread's split on a wide window ([screenSplit]), the title sits beside the way
 * out, centered over the page before it, as main's title sits over the task's column; the actions
 * stay at the bar's end, past it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskTopBar(
    title: @Composable () -> Unit,
    actions: @Composable RowScope.() -> Unit,
    onClose: () -> Unit,
    closeLabel: String?,
    focus: TitleTarget,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(Modifier.onPageSpan { span = it }) {
        val fold = screenSplit(maxWidth, span)

        CenterAlignedTopAppBar(
            title = { if (fold == null) Box(Modifier.titleTarget(focus)) { title() } },
            navigationIcon = {
                if (fold == null) {
                    CloseButton(onClick = onClose, label = closeLabel)
                } else {
                    Row(Modifier.width(fold.start), verticalAlignment = Alignment.CenterVertically) {
                        CloseButton(onClick = onClose, label = closeLabel)
                        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                            Box(Modifier.titleTarget(focus)) { ProvideTextStyle(MaterialTheme.typography.titleLarge) { title() } }
                        }
                        Spacer(Modifier.width(CLOSE_WIDTH))
                    }
                }
            },
            actions = actions,
        )
    }
}

/** Material's icon button, which the way out is: the space that keeps the title centered over its page. */
private val CLOSE_WIDTH = 48.dp

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
    val focus = rememberTitleFocus()

    BackHandler(enabled = exitConfirmation != null) { isConfirmingExit = true }

    val frame: @Composable (snackbars: Boolean) -> Unit = { snackbars ->
        Scaffold(
            topBar = { Box(Modifier.pageBar(focus)) { TaskTopBar(title, actions, onClose = leave, closeLabel, focus.bar) } },
            bottomBar = { if (bottomBar != null) TaskBottomBar(bottomBar) },
            snackbarHost = { if (snackbars) SnackbarHost(LocalSnackbarHostState.current) },
            content = { padding -> CompositionLocalProvider(LocalTitleFocus provides focus) { content(padding) } },
        )
    }

    // The screen's modifier (focus, keys) and its frame stay in one place when an aside comes or goes, as it does across a fold.
    Box(Modifier.pageFocus(focus).then(modifier)) {
        CompositionLocalProvider(LocalWideLayout provides readWideLayout()) {
            PageWithSupportingPane(
                supportingPane = aside?.let { { TaskAsideRail(it) } },
                panesTouch = true,
                halfWidth = aside?.half == true,
            ) { beside ->
                // An aside's footer beside the task holds its actions, so the aside shows its snackbars over them.
                CompositionLocalProvider(LocalTaskAsideBeside provides beside) { frame(!beside || aside?.footer == null) }
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
    // A footer's bar keeps clear of the bottom inset itself.
    val sides =
        if (aside.footer ==
            null
        ) {
            WindowInsetsSides.Vertical + WindowInsetsSides.End
        } else {
            WindowInsetsSides.Top + WindowInsetsSides.End
        }

    Surface(color = MaterialTheme.colorScheme.background) {
        Row {
            VerticalDivider()
            Column(
                Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing.only(sides))
                    .semantics { aside.title?.let { paneTitle = it } },
            ) {
                aside.title?.let { title ->
                    Box(
                        Modifier.fillMaxWidth().heightIn(min = TopAppBarDefaults.TopAppBarExpandedHeight).padding(horizontal = 24.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) { SectionLabel(title) }
                }
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    Column(
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp)
                            .padding(top = if (aside.title == null) 24.dp else 0.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        content = aside.content,
                    )
                    if (aside.footer != null) SnackbarHost(LocalSnackbarHostState.current, Modifier.align(Alignment.BottomCenter))
                }
                aside.footer?.let { TaskBottomBar(it) }
            }
        }
    }
}

@Composable
private fun TaskBottomBar(content: @Composable () -> Unit) {
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
