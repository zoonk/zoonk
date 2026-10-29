package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.scaffold.PageScaffold

/**
 * Main's detail page: [hero] heads it, and its title moves to the top app bar once it has scrolled
 * under the bar. Where the page itself is wide, [aside] runs beside it behind a hairline (main's
 * aside from 72rem); otherwise [content] places what it needs of it in the page. [ask] sits in the
 * bar, as the buddy's face on a narrow page, unless [askInAside] and the aside is showing.
 */
@Composable
internal fun DetailPage(
    title: String,
    onBack: () -> Unit,
    hero: @Composable (onTitlePlaced: (LayoutCoordinates) -> Unit) -> Unit,
    modifier: Modifier = Modifier,
    aside: (@Composable ColumnScope.() -> Unit)? = null,
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
    askInAside: Boolean = false,
    menu: @Composable () -> Unit = {},
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val listState = rememberLazyListState()
    var titleUnderBar by remember { mutableStateOf(false) }
    val titleAway by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 || titleUnderBar } }

    BoxWithConstraints(modifier) {
        val asideBeside = aside != null && maxWidth >= ASIDE_FROM
        val wide = maxWidth >= WIDE_FROM

        PageScaffold(
            onBack = onBack,
            title = { if (titleAway) BarTitle(title) },
            actions = {
                if (ask != null && !(askInAside && asideBeside)) ask(if (wide) AskTutorAppearance.Button else AskTutorAppearance.Icon)
                menu()
            },
        ) { padding ->
            DetailPageContent(listState, padding, if (asideBeside) aside else null, hero, { titleUnderBar = it }, content)
        }
    }
}

/** Two lines where the bar has room for them, one at large text. */
@Composable
private fun BarTitle(title: String) {
    val style = MaterialTheme.typography.titleMedium
    val twoLines = with(LocalDensity.current) { style.lineHeight.toDp() * 2 } <= TopAppBarDefaults.TopAppBarExpandedHeight
    Text(title, maxLines = if (twoLines) 2 else 1, overflow = TextOverflow.Ellipsis, style = style)
}

@Composable
private fun DetailPageContent(
    listState: LazyListState,
    padding: PaddingValues,
    aside: (@Composable ColumnScope.() -> Unit)?,
    hero: @Composable (onTitlePlaced: (LayoutCoordinates) -> Unit) -> Unit,
    onTitleUnderBar: (Boolean) -> Unit,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val direction = LocalLayoutDirection.current
    val barBottom = with(LocalDensity.current) { padding.calculateTopPadding().toPx() }
    val listPadding =
        PaddingValues(
            start = padding.calculateStartPadding(direction),
            top = padding.calculateTopPadding() + 8.dp,
            end = padding.calculateEndPadding(direction),
            bottom = padding.calculateBottomPadding() + SECTION_GAP,
        )
    val list = remember { mutableStateOf<LayoutCoordinates?>(null) }
    val onTitlePlaced: (LayoutCoordinates) -> Unit = { title ->
        list.value?.takeIf { it.isAttached }?.let { coordinates ->
            onTitleUnderBar(coordinates.localPositionOf(title, Offset(0f, title.size.height.toFloat())).y <= barBottom)
        }
    }
    val listModifier = Modifier.onGloballyPositioned { list.value = it }
    val items: LazyListScope.(Boolean) -> Unit = { asideBeside ->
        item(key = "hero", contentType = "hero") { hero(onTitlePlaced) }
        content(asideBeside)
    }

    if (aside == null) {
        LazyColumn(Modifier.fillMaxSize().then(listModifier), state = listState, contentPadding = listPadding) { items(false) }
        return
    }

    Row(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.weight(1f).then(listModifier), state = listState, contentPadding = listPadding) { items(true) }
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
        if (maxWidth >= WIDE_FROM) {
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
        SectionHeader(title, Modifier.padding(horizontal = PAGE_PADDING), detail = detail)
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

/** Main's `md`: from here the hero's action sits at its end and Ask shows the buddy's name. */
private val WIDE_FROM = 600.dp
