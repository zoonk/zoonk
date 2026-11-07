package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp

/**
 * Main's `GoalMark`: a language goal's flag (`languageFlag`, as the API names it), or the goal's first
 * letter on a quiet tile.
 */
@Composable
fun GoalMark(
    title: String,
    languageFlag: String? = null,
) {
    val flag = languageFlag?.let(::flagEmoji)

    if (flag != null) {
        Box(Modifier.size(MARK_SIZE).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
            Text(flag, style = MaterialTheme.typography.bodyMedium)
        }
        return
    }

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

/** A country's two letters as its flag; regions (`es-ct`, `arab`) have no standard emoji. */
fun flagEmoji(code: String): String? {
    if (code.length != 2 || !code.all { it.isLetter() }) return null
    return code.uppercase().map { Character.toChars(REGIONAL_INDICATOR_A + (it - 'A')).concatToString() }.joinToString("")
}

private const val REGIONAL_INDICATOR_A = 0x1F1E6
