package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.scaffold.PageScaffold

/**
 * Main's detail page: the page's name heads its first item and moves to the top app bar once that
 * scrolls away. Where the page itself is wide, [aside] runs beside it behind a hairline (main's
 * aside from 72rem); otherwise [content] places what it needs of it in the page.
 */
@Composable
internal fun DetailPage(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    aside: (@Composable ColumnScope.() -> Unit)? = null,
    actions: @Composable RowScope.(asideBeside: Boolean) -> Unit = {},
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val listState = rememberLazyListState()
    val titleAway by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }

    BoxWithConstraints(modifier) {
        val asideBeside = aside != null && maxWidth >= ASIDE_FROM

        PageScaffold(
            onBack = onBack,
            title = { if (titleAway) Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            actions = { actions(asideBeside) },
        ) { padding ->
            DetailPageContent(listState, padding, if (asideBeside) aside else null, content)
        }
    }
}

@Composable
private fun DetailPageContent(
    listState: LazyListState,
    padding: PaddingValues,
    aside: (@Composable ColumnScope.() -> Unit)?,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val direction = LocalLayoutDirection.current
    val listPadding =
        PaddingValues(
            start = padding.calculateStartPadding(direction),
            top = padding.calculateTopPadding() + 8.dp,
            end = padding.calculateEndPadding(direction),
            bottom = padding.calculateBottomPadding() + SECTION_GAP,
        )

    if (aside == null) {
        LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = listPadding) { content(false) }
        return
    }

    Row(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.weight(1f), state = listState, contentPadding = listPadding) { content(true) }
        VerticalDivider(Modifier.padding(top = padding.calculateTopPadding()))
        Column(
            modifier =
                Modifier
                    .width(ASIDE_WIDTH)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState())
                    .padding(listPadding.copyWithoutStart(direction)),
            verticalArrangement = Arrangement.spacedBy(SECTION_GAP),
            content = aside,
        )
    }
}

/** The page's name and facts, with its main action under them on a narrow page and at their end on a wide one. */
@Composable
internal fun DetailHero(
    action: (@Composable (Modifier) -> Unit)?,
    text: @Composable ColumnScope.() -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = PAGE_PADDING)) {
        if (maxWidth >= HERO_ROW_FROM) {
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp), content = text)
                action?.invoke(Modifier)
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                text()
                if (action != null) {
                    Spacer(Modifier.height(12.dp))
                    action(Modifier.fillMaxWidth())
                }
            }
        }
    }
}

/** A block of the aside: its title, then what it holds. */
@Composable
internal fun AsideSection(
    title: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitle(title, detail = detail)
        content()
    }
}

/** A label and its value on one line, as main's aside lists a page's properties. */
@Composable
internal fun PropertyRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier.padding(horizontal = PAGE_PADDING, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = label,
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(text = value, style = MaterialTheme.typography.bodyMedium.copy(fontFeatureSettings = "tnum"))
    }
}

private fun PaddingValues.copyWithoutStart(direction: LayoutDirection) =
    PaddingValues(top = calculateTopPadding(), end = calculateEndPadding(direction), bottom = calculateBottomPadding())

/** Room for the page's column beside a 320dp aside, about where main's aside appears. */
private val ASIDE_FROM = 840.dp
private val ASIDE_WIDTH = 320.dp

/** Main's `md`: from here the hero's action sits at its end. */
private val HERO_ROW_FROM = 600.dp
