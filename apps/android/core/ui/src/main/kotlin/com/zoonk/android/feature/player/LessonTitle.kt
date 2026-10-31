package com.zoonk.android.feature.player

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.style.TextOverflow

/** Main's task frame keeps the lesson's name small, so the screen below leads. */
@Composable
fun LessonTitle(title: String) {
    Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
}
