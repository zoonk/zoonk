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
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
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
 * there's room. Where there isn't, [content] is told so and shows what the aside holds after its
 * own, as main does under `lg`.
 */
@Composable
fun DetailPage(
    aside: @Composable ColumnScope.() -> Unit,
    asideLabel: String,
    modifier: Modifier = Modifier,
    listState: LazyListState = rememberLazyListState(),
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val padding = detailPagePadding()

    PageWithSupportingPane(
        modifier = modifier,
        supportingPane = {
            Row {
                VerticalDivider()
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(padding)
                        .semantics { paneTitle = asideLabel },
                    verticalArrangement = Arrangement.spacedBy(DETAIL_SECTION_GAP),
                    content = aside,
                )
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

/** Material's window margins: 16dp on phones, 24dp from medium windows up. */
@Composable
fun detailPagePadding(): PaddingValues {
    val compact = !currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    return PaddingValues(horizontal = if (compact) 16.dp else 24.dp, vertical = 24.dp)
}

/** A page's main action fills the row on phones, as main's does under `md`, and keeps its own width beyond. */
@Composable
fun Modifier.mainActionWidth(): Modifier =
    if (currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(
            WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND,
        )
    ) {
        this
    } else {
        fillMaxWidth()
    }

val DETAIL_PAGE_WIDTH = 720.dp
val DETAIL_SECTION_GAP = 32.dp
