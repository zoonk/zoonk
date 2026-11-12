package com.zoonk.android.feature.player

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow

/**
 * Main's task frame keeps the lesson's name small, so the screen below leads. A long name takes a
 * second line, centered, before it's cut, so a phone's header still shows it whole.
 */
@Composable
fun LessonTitle(
    title: String,
    modifier: Modifier = Modifier,
) {
    Text(
        title,
        modifier,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.titleSmall,
    )
}
