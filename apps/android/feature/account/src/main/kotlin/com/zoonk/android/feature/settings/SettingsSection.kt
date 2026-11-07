package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.SectionHeader

/**
 * Main's settings section (`PageSection` with its title): flat rows on the page, set apart from the
 * next section by space, never a box. Rows reach the column's edges; other [content] takes the margin.
 */
@Composable
internal fun SettingsSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionHeader(title, Modifier.padding(horizontal = LIST_ITEM_INSET))
        content()
    }
}
