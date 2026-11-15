package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.zoonkType

/** One of a page's lists: its [label], how many it holds, and what TalkBack says for both when the words alone don't. */
@Immutable
data class CountTab(
    val label: String,
    val count: Int,
    val spoken: String? = null,
)

/**
 * The tabs between a page's lists (to fix and fixed, chapters, lessons and saved): Material's tabs, each with how
 * many its list holds, its words starting on the column's edge. A page too narrow for them side by side (a book's
 * page beside the rail, a large text size) shares the row out equally with each count under its label, so no label
 * is ever cut.
 */
@Composable
fun CountTabs(
    tabs: List<CountTab>,
    selected: Int,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val numbers = tabs.map { formatNumber(it.count.toDouble(), locale) }
    val labelStyle = MaterialTheme.typography.titleSmall
    val countStyle = MaterialTheme.zoonkType.data
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current

    BoxWithConstraints(modifier.bleed(LIST_ITEM_INSET).fillMaxWidth()) {
        val natural =
            with(density) {
                tabs.indices
                    .sumOf { index ->
                        measurer.measure(tabs[index].label, labelStyle, softWrap = false).size.width +
                            measurer.measure(numbers[index], countStyle, softWrap = false).size.width
                    }.toDp()
            } + (COUNT_GAP + TAB_PADDING * 2) * tabs.size
        val fits = natural <= maxWidth

        val tab: @Composable (Int) -> Unit = { index ->
            val each = tabs[index]
            Tab(
                selected = index == selected,
                onClick = { onPick(index) },
                modifier = Modifier.heightIn(min = TAB_HEIGHT),
                selectedContentColor = MaterialTheme.colorScheme.onSurface,
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ) {
                val words =
                    if (each.spoken != null) Modifier.clearAndSetSemantics { contentDescription = each.spoken } else Modifier
                val label = @Composable { Text(each.label, style = labelStyle, softWrap = !fits, textAlign = TextAlign.Center) }
                val count =
                    @Composable {
                        Text(numbers[index], color = MaterialTheme.colorScheme.onSurfaceVariant, style = countStyle, softWrap = false)
                    }
                if (fits) {
                    Row(
                        words.padding(horizontal = TAB_PADDING),
                        horizontalArrangement = Arrangement.spacedBy(COUNT_GAP),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        label()
                        count()
                    }
                } else {
                    // Under its label, the count leaves the label the tab's whole width.
                    Column(
                        words.padding(horizontal = NARROW_TAB_PADDING, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        label()
                        count()
                    }
                }
            }
        }

        if (fits) {
            PrimaryScrollableTabRow(
                selectedTabIndex = selected,
                containerColor = MaterialTheme.colorScheme.surface,
                edgePadding = 0.dp,
                minTabWidth = 0.dp,
            ) { tabs.indices.forEach { tab(it) } }
        } else {
            PrimaryTabRow(
                selectedTabIndex = selected,
                containerColor = MaterialTheme.colorScheme.surface,
            ) { tabs.indices.forEach { tab(it) } }
        }
    }
}

/** Material's tab sides, and half of them where the tabs share a narrow row. */
private val TAB_PADDING = 16.dp
private val NARROW_TAB_PADDING = 8.dp
private val COUNT_GAP = 6.dp
private val TAB_HEIGHT = 48.dp
