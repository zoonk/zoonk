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
import com.zoonk.android.ui.scaffold.pageListMargin
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

/**
 * A settings page's column, [SETTINGS_COLUMN_WIDTH] at most, which its `PageScaffold` names as its `columnWidth`: the page's
 * own top and bottom ([pagePadding]), and sides that put its rows' words on the page's margin, as its way back is.
 */
@Composable
internal fun Modifier.settingsColumn(): Modifier {
    val page = pagePadding()
    return widthIn(max = SETTINGS_COLUMN_WIDTH)
        .fillMaxWidth()
        .padding(horizontal = pageListMargin(), vertical = 0.dp)
        .padding(top = page.calculateTopPadding(), bottom = page.calculateBottomPadding())
}

internal val SETTINGS_COLUMN_WIDTH = 640.dp
