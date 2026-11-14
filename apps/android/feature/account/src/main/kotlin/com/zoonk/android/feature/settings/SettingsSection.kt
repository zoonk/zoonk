package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.scaffold.pagePadding

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

/** A settings page's column, at most 640dp wide: the page's own top and bottom ([pagePadding]), its rows reaching its edges. */
@Composable
internal fun Modifier.settingsColumn(): Modifier {
    val page = pagePadding()
    return widthIn(max = 640.dp).fillMaxWidth().padding(top = page.calculateTopPadding(), bottom = page.calculateBottomPadding())
}
