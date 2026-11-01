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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.ui.scaffold.PageFold

/**
 * At least the window's height, so a step's actions can sit at its bottom on phones. Across an open book's [fold] it
 * is the page before the fold, with [aside] on the page after it; without an aside, a test's question takes both
 * pages ([QuestionPages]).
 */
@Composable
internal fun SetupColumn(
    fold: PageFold? = null,
    aside: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize().imePadding()) {
        val windowHeight = maxHeight
        val scroll = rememberScrollState()
        val spread = fold?.takeIf { aside == null }

        CompositionLocalProvider(LocalSetupPage provides SetupPage(spread, scroll, windowHeight - EDGE * 2)) {
            Box(
                when {
                    spread != null -> {
                        Modifier.fillMaxSize()
                    }

                    fold != null -> {
                        Modifier
                            .width(fold.start)
                            .fillMaxHeight()
                            .semantics { isTraversalGroup = true }
                            .verticalScroll(scroll)
                    }

                    else -> {
                        Modifier.fillMaxSize().verticalScroll(scroll)
                    }
                },
                contentAlignment = Alignment.TopCenter,
            ) {
                Column(
                    modifier =
                        if (spread == null) {
                            Modifier
                                .widthIn(max = 640.dp)
                                .fillMaxWidth()
                                .heightIn(min = windowHeight)
                                .padding(horizontal = MARGIN, vertical = EDGE)
                        } else {
                            Modifier.fillMaxSize()
                        },
                    verticalArrangement = Arrangement.spacedBy(GAP),
                    content = content,
                )
            }

            if (fold != null && aside != null) {
                Box(Modifier.fillMaxSize().padding(start = fold.end).semantics { isTraversalGroup = true }) { aside() }
            }
        }
    }
}

internal data class SetupPage(
    val fold: PageFold?,
    val scroll: ScrollState,
    val height: Dp,
)

internal val LocalSetupPage = compositionLocalOf<SetupPage?> { null }

/**
 * A test's question: one column, or across an open book's fold a spread like practice's, with what to [read] on the
 * page before the fold and the [answer] on the page after it, its [actions] pinned at that page's bottom. The page
 * before the fold scrolls with the one column, so a reading place keeps as the book opens or closes.
 */
@Composable
internal fun ColumnScope.QuestionPages(
    read: @Composable ColumnScope.() -> Unit,
    answer: @Composable ColumnScope.() -> Unit,
    actions: @Composable ColumnScope.() -> Unit,
) {
    val page = LocalSetupPage.current
    val fold = page?.fold
    val answerScroll = rememberScrollState()

    Box(if (fold == null) Modifier.fillMaxWidth() else Modifier.weight(1f).fillMaxWidth()) {
        // The answer's page is the one column's place, so what the learner picked, typed or recorded stays as the book opens or closes.
        Column(
            if (fold == null) {
                Modifier.fillMaxWidth().heightIn(min = page?.height ?: 0.dp)
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
            OnboardingActions(actions)
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

private val MARGIN = 24.dp
private val EDGE = 16.dp
private val GAP = 24.dp
