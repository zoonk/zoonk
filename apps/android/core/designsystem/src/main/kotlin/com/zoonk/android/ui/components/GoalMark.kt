package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp

/** The goal's first letter on a quiet tile (main's `GoalMark`). */
@Composable
fun GoalMark(title: String) {
    Surface(
        shape = MaterialTheme.shapes.extraSmall,
        color = MaterialTheme.colorScheme.surfaceContainerHighest,
        modifier = Modifier.size(MARK_SIZE).clearAndSetSemantics {},
    ) {
        LetterMark(
            letter =
                title
                    .firstOrNull()
                    ?.uppercase()
                    .orEmpty(),
            size = MARK_SIZE,
            share = MARK_LETTER_SHARE,
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

private val MARK_SIZE = 20.dp

/** Main's `text-[0.625rem]` on its `size-4.5` tile. */
private const val MARK_LETTER_SHARE = 0.56f
