package com.zoonk.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.zoonkType

/** The inset Material's `ListItem` gives its content; a header or line above rows takes it to share their edge. */
val LIST_ITEM_INSET = 16.dp

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
) {
    if (detail == null) {
        Text(
            text = title,
            modifier = modifier.semantics { heading() },
            style = MaterialTheme.zoonkType.sectionTitle,
        )
        return
    }

    SectionHeader(title, modifier) {
        Text(
            detail,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.zoonkType.data,
        )
    }
}

/** Main's `PageSectionHeader` with something other than a short fact at its end, such as a legend or a button. */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    trailing: @Composable () -> Unit,
) {
    HeadingRow(title, MaterialTheme.zoonkType.sectionTitle, modifier, Alignment.CenterVertically, trailing = trailing)
}

/** Main's `PageSectionLabel`: a quiet label naming a group inside a section, still a heading for TalkBack. */
@Composable
fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier.semantics { heading() },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium,
    )
}
