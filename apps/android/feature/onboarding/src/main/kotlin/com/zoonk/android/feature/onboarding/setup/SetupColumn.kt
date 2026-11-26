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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.requireDensity
import androidx.compose.ui.node.requireLayoutCoordinates
import androidx.compose.ui.relocation.BringIntoViewModifierNode
import androidx.compose.ui.relocation.bringIntoView
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.watchTouches
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.NumberKeys
import com.zoonk.android.ui.scaffold.BarNoteInPage
import com.zoonk.android.ui.scaffold.BarNoteRoom
import com.zoonk.android.ui.scaffold.BottomBar
import com.zoonk.android.ui.scaffold.PageFold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.barNoteViewport
import com.zoonk.android.ui.scaffold.pageMargin
import com.zoonk.android.ui.scaffold.rememberBarNoteRoom

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
 * One column with the step's actions pinned in a bar under it ([PageActions], [com.zoonk.android.feature.onboarding.start.OnboardingActions]). Across an open book's [fold] it
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
        val noteRoom = rememberBarNoteRoom()
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
                        if (spread ==
                            null
                        ) {
                            Modifier.fillMaxSize().barNoteViewport(noteRoom).verticalScroll(scroll)
                        } else {
                            Modifier.fillMaxSize()
                        },
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Column(
                            modifier =
                                if (spread == null) {
                                    Modifier
                                        .widthIn(max = COLUMN_WIDTH)
                                        .fillMaxWidth()
                                        .heightIn(min = height)
                                        .endInView(EDGE + noteRoom.height)
                                        .padding(horizontal = pageMargin(), vertical = EDGE)
                                        .padding(bottom = noteRoom.height)
                                } else {
                                    Modifier.fillMaxSize()
                                },
                            verticalArrangement = Arrangement.spacedBy(GAP),
                        ) {
                            content()
                            if (spread == null) BarNoteInPage(noteRoom)
                        }
                    }
                }
            }

            bar?.takeIf { it.visible && (it.actions != null || it.hold?.holding == true) }?.let { SetupActionBar(it, noteRoom) }
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
    val note: State<(@Composable () -> Unit)?>? = null,
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

/** The page's actions, pinned in its bottom bar; [note] (what the last action couldn't do) sits over the bar, where it moves nothing. */
@Composable
internal fun PageActions(
    hold: ReadyHold? = null,
    visible: Boolean = true,
    note: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val slot = LocalSetupPage.current?.bar
    if (slot == null) {
        note?.invoke()
        content()
        return
    }
    val actions = rememberUpdatedState(content)
    val shownNote = rememberUpdatedState(note)
    val bar = PageBar(hold, "", actions, visible, shownNote)
    SideEffect { slot.value = bar }
    DisposableEffect(slot) { onDispose { slot.value = null } }
}

@Composable
private fun SetupActionBar(
    bar: PageBar,
    noteRoom: BarNoteRoom,
) {
    BottomBar(columnWidth = COLUMN_WIDTH, note = bar.note?.value, noteRoom = noteRoom) {
        if (bar.actions != null) {
            bar.actions.value()
        } else {
            Button(onClick = { bar.hold?.moveOn() }, modifier = Modifier.fillMaxWidth()) { Text(bar.action) }
        }
    }
}

/**
 * A test's question, its number keys picking what it shows: one column, or across an open book's fold a spread like practice's, with what to [read] on the
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
        // Saved, so a recreated screen keeps the learner's place in the question it already showed.
        var scrolledTo by rememberSaveable { mutableStateOf<String?>(null) }
        LaunchedEffect(questionId) {
            if (scrolledTo != questionId) {
                scrolledTo = questionId
                page?.scroll?.scrollTo(0)
                answerScroll.scrollTo(0)
            }
        }

        // Number keys pick the question's options or cards, as main's do.
        NumberKeys(if (fold == null) Modifier.fillMaxWidth() else Modifier.weight(1f).fillMaxWidth()) {
            // The answer's page is the one column's place, so what the learner picked, typed or recorded stays as the book opens or closes.
            Column(
                if (fold == null) {
                    Modifier.fillMaxWidth()
                } else {
                    Modifier
                        .fillMaxSize()
                        .padding(start = fold.end)
                        .semantics { isTraversalGroup = true }
                },
                verticalArrangement = Arrangement.spacedBy(if (fold == null) GAP else 0.dp),
            ) {
                Column(
                    if (fold == null) {
                        Modifier
                    } else {
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(answerScroll)
                            .padding(horizontal = pageMargin(), vertical = EDGE)
                    },
                    verticalArrangement = Arrangement.spacedBy(GAP),
                ) {
                    if (fold == null) read()
                    answer()
                }
                PageActions { Column(verticalArrangement = Arrangement.spacedBy(8.dp), content = actions) }
            }

            if (fold != null) {
                Column(
                    Modifier
                        .width(fold.start)
                        .fillMaxHeight()
                        .semantics { isTraversalGroup = true }
                        .verticalScroll(page.scroll)
                        .padding(horizontal = pageMargin(), vertical = EDGE),
                    verticalArrangement = Arrangement.spacedBy(GAP),
                    content = read,
                )
            }
        }
    }
}

/**
 * Brings the page's [end] padding into view with what's last on the page, as it shows when the page is short:
 * a request that reaches into the padding (the question panel and its ring) extends to the page's end, so the
 * scroll settles with the same room under it as above the keyboard on a short page.
 */
private fun Modifier.endInView(end: Dp): Modifier = this then EndInViewElement(end)

private data class EndInViewElement(
    val end: Dp,
) : ModifierNodeElement<EndInViewNode>() {
    override fun create() = EndInViewNode(end)

    override fun update(node: EndInViewNode) {
        node.end = end
    }
}

private class EndInViewNode(
    var end: Dp,
) : Modifier.Node(),
    BringIntoViewModifierNode {
    override suspend fun bringIntoView(
        childCoordinates: LayoutCoordinates,
        boundsProvider: () -> Rect?,
    ) {
        bringIntoView {
            val own = requireLayoutCoordinates()
            val asked = boundsProvider()?.translate(own.localPositionOf(childCoordinates, Offset.Zero)) ?: return@bringIntoView null
            val pageEnd = own.size.height.toFloat()
            val padding = with(requireDensity()) { end.toPx() }
            if (asked.bottom > pageEnd - padding) asked.copy(bottom = pageEnd) else asked
        }
    }
}

private val COLUMN_WIDTH = 640.dp
private val EDGE = 16.dp
private val GAP = 24.dp
