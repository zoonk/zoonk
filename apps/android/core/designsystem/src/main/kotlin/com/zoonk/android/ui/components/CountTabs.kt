package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
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
 * many its list holds. Their words start on the column's edge, and where they don't all fit they scroll, so a
 * narrow page never cuts a label.
 */
@Composable
fun CountTabs(
    tabs: List<CountTab>,
    selected: Int,
    onPick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()

    PrimaryScrollableTabRow(
        selectedTabIndex = selected,
        modifier = modifier.bleed(LIST_ITEM_INSET).fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.surface,
        edgePadding = 0.dp,
        minTabWidth = 0.dp,
    ) {
        tabs.forEachIndexed { index, tab ->
            Tab(
                selected = index == selected,
                onClick = { onPick(index) },
                text = {
                    Row(
                        if (tab.spoken != null) Modifier.clearAndSetSemantics { contentDescription = tab.spoken } else Modifier,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(tab.label, softWrap = false)
                        Text(
                            formatNumber(tab.count.toDouble(), locale),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.zoonkType.data,
                            softWrap = false,
                        )
                    }
                },
                selectedContentColor = MaterialTheme.colorScheme.onSurface,
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
