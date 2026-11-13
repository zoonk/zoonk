package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's `Eyebrow`: the one chip for a small label over or beside a title (22dp, an outline, no fill,
 * 12sp words as written), with an optional [icon] before them. It holds a few words, never a sentence
 * or a control, and nothing taps it: a chip people tap is Material's `AssistChip` or `FilterChip`.
 */
@Composable
fun Eyebrow(
    text: String,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null,
) {
    val ink = MaterialTheme.colorScheme.onSurfaceVariant
    Chip(text, MaterialTheme.colorScheme.outline, ink, modifier) {
        icon?.let { Icon(painterResource(it), contentDescription = null, modifier = Modifier.size(CHIP_ICON), tint = ink) }
    }
}

/** Main's `SuccessEyebrow`: the same chip in green with a check, saying something is done. */
@Composable
fun SuccessEyebrow(
    text: String,
    modifier: Modifier = Modifier,
    iconModifier: Modifier = Modifier,
) {
    val green = MaterialTheme.colorScheme.tertiary
    Chip(text, green.copy(alpha = SUCCESS_LINE_ALPHA), MaterialTheme.colorScheme.onTertiaryContainer, modifier) {
        Icon(painterResource(R.drawable.ic_check), contentDescription = null, modifier = iconModifier.size(CHIP_ICON), tint = green)
    }
}

@Composable
private fun Chip(
    text: String,
    line: Color,
    ink: Color,
    modifier: Modifier,
    mark: @Composable () -> Unit,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 22.dp)
                .border(1.dp, line, MaterialTheme.shapes.small)
                .padding(horizontal = 8.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        mark()
        Text(text = text, color = ink, style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium))
    }
}

private val CHIP_ICON = 14.dp
private const val SUCCESS_LINE_ALPHA = 0.4f
