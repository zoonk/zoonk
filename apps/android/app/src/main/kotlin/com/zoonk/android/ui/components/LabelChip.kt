package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp

/**
 * Main's quiet chip: a few words beside a title or in a row of facts (the Plus mark, a plan
 * change's "1 week", "Focus"), in the quiet text step on the stronger line, never a colored badge.
 * It isn't tappable; a chip people tap or toggle is Material's `AssistChip` or `FilterChip`.
 * `icon` is decorative: the words say the fact.
 */
@Composable
fun LabelChip(
    text: String,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null,
) {
    val style = MaterialTheme.typography.labelMedium
    val color = MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        modifier =
            modifier
                .border(1.dp, MaterialTheme.colorScheme.outline, MaterialTheme.shapes.small)
                .padding(horizontal = 8.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                painter = painterResource(icon),
                contentDescription = null,
                modifier = Modifier.size(with(LocalDensity.current) { style.fontSize.toDp() }),
                tint = color,
            )
        }

        Text(text = text, color = color, style = style)
    }
}
