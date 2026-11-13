package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

/**
 * Main's `DetailLayout`: one column from the window's start margin, capped at a readable measure
 * (wider windows give it room, never wider margins), and [aside] beside it behind a hairline where
 * there's room, with [asideBar] pinned under it. Where there isn't, [content] is told so and shows
 * what the aside and its bar hold its own way, as main does under `lg`.
 */
@Composable
fun DetailPage(
    aside: @Composable ColumnScope.() -> Unit,
    asideLabel: String,
    modifier: Modifier = Modifier,
    listState: LazyListState = rememberLazyListState(),
    asideBar: (@Composable () -> Unit)? = null,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val padding = pagePadding()

    PageWithSupportingPane(
        modifier = modifier,
        supportingPane = {
            Row {
                VerticalDivider()
                Column(Modifier.semantics { paneTitle = asideLabel }) {
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(padding),
                        verticalArrangement = Arrangement.spacedBy(DETAIL_SECTION_GAP),
                        content = aside,
                    )
                    asideBar?.let { bar -> BottomBar { bar() } }
                }
            }
        },
    ) { asideBeside ->
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopStart) {
            LazyColumn(
                state = listState,
                modifier = Modifier.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(),
                contentPadding = padding,
                verticalArrangement = Arrangement.spacedBy(DETAIL_SECTION_GAP),
            ) { content(asideBeside) }
        }
    }
}

/** A page's main action fills the row on a phone and on a book's page, as main's does under `md` ([isMediumLayout]), and keeps its own width beyond. */
@Composable
fun Modifier.mainActionWidth(): Modifier = if (isMediumLayout()) this else fillMaxWidth()

val DETAIL_PAGE_WIDTH = 720.dp
val DETAIL_SECTION_GAP = 32.dp
