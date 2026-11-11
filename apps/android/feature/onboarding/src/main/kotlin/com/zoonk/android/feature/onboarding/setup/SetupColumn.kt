package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.watchTouches
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.scaffold.DockedActionBar
import com.zoonk.android.ui.scaffold.PageFold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane

internal data class SetupLayout(
    val fold: PageFold?,
    val supportingPane: Boolean,
    val foldAside: Boolean,
    val aside: @Composable () -> Unit,
    val failure: String?,
)

internal val LocalSetupLayout = compositionLocalOf<SetupLayout?> { null }

@Composable
internal fun ColumnScope.SetupContent(
    aside: (@Composable () -> Unit)? = null,
    reversed: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (LocalSetupLayout.current == null || LocalSetupPage.current != null) {
        content()
    } else {
        SetupColumn(aside = aside, reversed = reversed, content = content)
    }
}

/**
 * At least the page's height, so a step's actions can sit at its bottom on phones. Across an open book's [fold] it
 * is the page before the fold, with [aside] on the page after it; without an aside, a test's question takes both
 * pages ([QuestionPages]). A held wait's way on is pinned to the page's bottom ([PageHold]).
 */
@Composable
internal fun SetupColumn(
    fold: PageFold? = null,
    aside: (@Composable () -> Unit)? = null,
    reversed: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val layout = LocalSetupLayout.current
    if (layout == null) {
        SetupColumnBody(fold, aside, reversed, content)
        return
    }
    val pane = aside ?: layout.aside
    PageWithSupportingPane(supportingPane = pane.takeIf { layout.supportingPane }, panesTouch = layout.fold != null) { beside ->
        CompositionLocalProvider(LocalWaitBeside provides (beside || layout.fold != null)) {
            SetupColumnBody(layout.fold, pane.takeIf { layout.foldAside }, reversed) {
                layout.failure?.let {
                    Text(
                        it,
                        color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                        modifier = Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
                    )
                }
                content()
            }
        }
    }
}

@Composable
private fun SetupColumnBody(
    fold: PageFold?,
    aside: (@Composable () -> Unit)?,
    reversed: Boolean,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(Modifier.fillMaxSize().imePadding()) {
        val scroll = rememberScrollState()
        val spread = fold?.takeIf { aside == null }
        val barSlot = remember { mutableStateOf<PageBar?>(null) }
        val bar = barSlot.value

        Column(
            when {
                fold != null && aside != null -> {
                    (
                        if (reversed) {
                            Modifier.fillMaxSize().padding(
                                start = fold.end,
                            )
                        } else {
                            Modifier.width(fold.start).fillMaxHeight()
                        }
                    ).semantics {
                        isTraversalGroup =
                            true
                    }
                }

                else -> {
                    Modifier.fillMaxSize()
                }
            }.then(bar?.hold?.let { Modifier.watchTouches(it) } ?: Modifier),
        ) {
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val height = maxHeight

                CompositionLocalProvider(LocalSetupPage provides SetupPage(spread, scroll, barSlot)) {
                    Box(
                        if (spread == null) Modifier.fillMaxSize().verticalScroll(scroll) else Modifier.fillMaxSize(),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Column(
                            modifier =
                                if (spread == null) {
                                    Modifier
                                        .widthIn(max = COLUMN_WIDTH)
                                        .fillMaxWidth()
                                        .heightIn(min = height)
                                        .padding(horizontal = MARGIN, vertical = EDGE)
                                } else {
                                    Modifier.fillMaxSize()
                                },
                            verticalArrangement = Arrangement.spacedBy(GAP),
                            content = content,
                        )
                    }
                }
            }

            bar?.takeIf { it.visible && (it.actions != null || it.hold?.holding == true) }?.let { SetupActionBar(it) }
        }

        if (fold != null && aside != null) {
            Box(
                (if (reversed) Modifier.width(fold.start).fillMaxHeight() else Modifier.fillMaxSize().padding(start = fold.end)).semantics {
                    isTraversalGroup =
                        true
                },
            ) { aside() }
        }
    }
}

internal data class SetupPage(
    val fold: PageFold?,
    val scroll: ScrollState,
    val bar: MutableState<PageBar?>,
)

internal val LocalSetupPage = compositionLocalOf<SetupPage?> { null }

internal data class PageBar(
    val hold: ReadyHold?,
    val action: String,
    val actions: State<@Composable () -> Unit>? = null,
    val visible: Boolean = true,
)

/**
 * Puts a wait's [hold] on the setup's page: a touch anywhere on it starts the hold's quiet second, and while it holds,
 * [action] is the only way on, pinned to the page's bottom so it's in reach under a long card (main's `HeldFooter`).
 */
@Composable
internal fun PageHold(
    hold: ReadyHold,
    action: String,
) {
    val slot = LocalSetupPage.current?.bar ?: return
    val bar = PageBar(hold, action)
    SideEffect { slot.value = bar }
    DisposableEffect(slot) { onDispose { slot.value = null } }
}

@Composable
internal fun PageActions(
    hold: ReadyHold? = null,
    visible: Boolean = true,
    content: @Composable () -> Unit,
) {
    val slot = LocalSetupPage.current?.bar
    if (slot == null) {
        content()
        return
    }
    val actions = rememberUpdatedState(content)
    val bar = PageBar(hold, "", actions, visible)
    SideEffect { slot.value = bar }
    DisposableEffect(slot) { onDispose { slot.value = null } }
}

@Composable
private fun SetupActionBar(bar: PageBar) {
    DockedActionBar {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Box(Modifier.widthIn(max = COLUMN_WIDTH).fillMaxWidth().padding(horizontal = MARGIN, vertical = EDGE)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (bar.actions !=
                        null
                    ) {
                        bar.actions.value()
                    } else {
                        Button(onClick = { bar.hold?.moveOn() }, modifier = Modifier.fillMaxWidth()) { Text(bar.action) }
                    }
                }
            }
        }
    }
}

/**
 * A test's question: one column, or across an open book's fold a spread like practice's, with what to [read] on the
 * page before the fold and the [answer] on the page after it, its [actions] pinned at that page's bottom. The page
 * before the fold scrolls with the one column, so a reading place keeps as the book opens or closes.
 */
@Composable
internal fun ColumnScope.QuestionPages(
    questionId: String,
    read: @Composable ColumnScope.() -> Unit,
    answer: @Composable ColumnScope.() -> Unit,
    actions: @Composable ColumnScope.() -> Unit,
) {
    SetupContent {
        val page = LocalSetupPage.current
        val fold = page?.fold
        val answerScroll = rememberScrollState()
        LaunchedEffect(questionId) {
            page?.scroll?.scrollTo(0)
            answerScroll.scrollTo(0)
        }

        Box(if (fold == null) Modifier.fillMaxWidth() else Modifier.weight(1f).fillMaxWidth()) {
            // The answer's page is the one column's place, so what the learner picked, typed or recorded stays as the book opens or closes.
            Column(
                if (fold == null) {
                    Modifier.fillMaxWidth()
                } else {
                    Modifier
                        .fillMaxSize()
                        .padding(start = fold.end)
                        .semantics { isTraversalGroup = true }
                        .padding(start = MARGIN, end = MARGIN, bottom = EDGE)
                },
                verticalArrangement = Arrangement.spacedBy(GAP),
            ) {
                Column(
                    if (fold == null) {
                        Modifier
                    } else {
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(answerScroll)
                            .padding(top = EDGE)
                    },
                    verticalArrangement = Arrangement.spacedBy(GAP),
                ) {
                    if (fold == null) read()
                    answer()
                }
                if (fold != null) {
                    OnboardingActions(actions)
                } else {
                    PageActions { Column(verticalArrangement = Arrangement.spacedBy(8.dp), content = actions) }
                }
            }

            if (fold != null) {
                Column(
                    Modifier
                        .width(fold.start)
                        .fillMaxHeight()
                        .semantics { isTraversalGroup = true }
                        .verticalScroll(page.scroll)
                        .padding(horizontal = MARGIN, vertical = EDGE),
                    verticalArrangement = Arrangement.spacedBy(GAP),
                    content = read,
                )
            }
        }
    }
}

private val COLUMN_WIDTH = 640.dp
private val MARGIN = 16.dp
private val EDGE = 16.dp
private val GAP = 24.dp
