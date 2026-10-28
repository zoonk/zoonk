package com.zoonk.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics

/**
 * An app page's block named by a real title in sentence case ("This week"), a TalkBack heading so
 * the page can be skimmed by its parts.
 */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = title,
        modifier = modifier.semantics { heading() },
        style = MaterialTheme.typography.titleMedium,
    )
}
