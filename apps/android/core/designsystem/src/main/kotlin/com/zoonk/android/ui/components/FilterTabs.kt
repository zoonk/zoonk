package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.zoonkType

/** One of the groups a list narrows to: null [key] is every group. */
@Immutable
data class FilterTab(
    val key: String?,
    val label: String,
    val count: Long,
    val selected: Boolean,
    val leading: (@Composable () -> Unit)? = null,
)

/**
 * Main's row of tabs that scrolls sideways, for a list's groups where there's no room beside it:
 * Material's filter chips, drawn as main's small buttons, the group shown in ink and the others
 * outlined. [counts] ends each chip with how many it lists.
 */
@Composable
fun FilterChips(
    tabs: List<FilterTab>,
    label: String,
    onSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
    counts: Boolean = false,
) {
    val locale = currentLocale()

    LazyRow(
        modifier = modifier.fillMaxWidth().selectableGroup().semantics { contentDescription = label },
        contentPadding = PaddingValues(horizontal = LIST_ITEM_INSET),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(tabs.size, key = { tabs[it].key ?: "all" }) { index ->
            val tab = tabs[index]

            FilterChip(
                selected = tab.selected,
                onClick = { onSelect(tab.key) },
                label = { Text(tab.label, style = MaterialTheme.typography.labelMedium) },
                leadingIcon = tab.leading,
                trailingIcon =
                    if (counts) {
                        {
                            val scheme = MaterialTheme.colorScheme
                            Text(
                                formatNumber(tab.count.toDouble(), locale),
                                color = if (tab.selected) scheme.onPrimary else scheme.onSurfaceVariant,
                                style = MaterialTheme.zoonkType.data,
                            )
                        }
                    } else {
                        null
                    },
                colors =
                    FilterChipDefaults.filterChipColors(
                        labelColor = MaterialTheme.colorScheme.onSurface,
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                border =
                    FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = tab.selected,
                        borderColor = MaterialTheme.colorScheme.outline,
                        selectedBorderColor = MaterialTheme.colorScheme.primary,
                        selectedBorderWidth = 1.dp,
                    ),
            )
        }
    }
}

/** Main's column of the same tabs, where there's room beside the list: the group shown on `muted`, each with its count. */
@Composable
fun FilterList(
    tabs: List<FilterTab>,
    label: String,
    onSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()

    Column(modifier.selectableGroup().semantics { contentDescription = label }) {
        tabs.forEach { tab ->
            ListRow(
                headline = { Text(tab.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                modifier = Modifier.selectable(selected = tab.selected, role = Role.Tab) { onSelect(tab.key) },
                highlighted = tab.selected,
                leading = tab.leading,
                meta = { Text(formatNumber(tab.count.toDouble(), locale)) },
            )
        }
    }
}
