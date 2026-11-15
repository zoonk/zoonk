package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkRadius

/**
 * Main's "⋯" opening a page's menu, an outline square: [ButtonSize.Small] (30dp, `rounded-md`) beside
 * a page's title, [ButtonSize.Large] (44dp, `rounded-lg`) beside a detail page's main action. Either
 * stays a 48dp touch target, and grows with the text as a text button of its size beside it does, so the
 * two share a top and a bottom. Put the menu in a `Box` with it.
 */
@Composable
fun OptionsButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    size: ButtonSize = ButtonSize.Small,
) {
    val large = size == ButtonSize.Large
    val words = lineHeight(if (large) MaterialTheme.typography.labelLarge else MaterialTheme.typography.labelMedium)
    val side = if (large) maxOf(44.dp, words + 16.dp) else maxOf(30.dp, words + 8.dp)
    OutlinedIconButton(
        onClick = onClick,
        modifier = modifier.size(side),
        shape = RoundedCornerShape(if (large) ZoonkRadius.lg else ZoonkRadius.md),
    ) {
        Icon(
            painterResource(R.drawable.ic_more_horiz),
            contentDescription = contentDescription,
            modifier =
                Modifier.size(ICON * glyphScale()),
        )
    }
}

private val ICON = 16.dp
