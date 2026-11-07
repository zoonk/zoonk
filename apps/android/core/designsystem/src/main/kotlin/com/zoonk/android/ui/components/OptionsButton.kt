package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkRadius

/**
 * Main's "⋯" opening a page's menu, an outline square: [ButtonSize.Small] (30dp, `rounded-md`) beside
 * a page's title, [ButtonSize.Large] (44dp, `rounded-lg`) beside a detail page's main action. Either
 * stays a 48dp touch target. Put the menu in a `Box` with it.
 */
@Composable
fun OptionsButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    size: ButtonSize = ButtonSize.Small,
) {
    val large = size == ButtonSize.Large
    OutlinedIconButton(
        onClick = onClick,
        modifier = modifier.size(if (large) 44.dp else 30.dp),
        shape = RoundedCornerShape(if (large) ZoonkRadius.lg else ZoonkRadius.md),
    ) {
        Icon(painterResource(R.drawable.ic_more_horiz), contentDescription = contentDescription, modifier = Modifier.size(ICON))
    }
}

private val ICON = 16.dp
