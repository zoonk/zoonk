package com.zoonk.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import com.zoonk.android.ui.theme.withTabularFigures

/**
 * A quantity the eye lands on (main's `BigQuantity`): its numbers in [style], semibold with
 * tabular figures, and its words ("min left", "/ 5 hr") smaller in `onSurfaceVariant`.
 */
@Composable
fun Readout(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.headlineSmall,
) {
    val unit = SpanStyle(fontSize = MaterialTheme.typography.labelLarge.fontSize, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(text = readout(text, unit), modifier = modifier, style = style.withTabularFigures().copy(fontWeight = FontWeight.SemiBold))
}

/** Digits in any script, and the separators between them ("1,292", "3.5"), are the number. */
internal fun readout(
    text: String,
    unit: SpanStyle,
): AnnotatedString =
    buildAnnotatedString {
        var index = 0
        while (index < text.length) {
            val end = numberEnd(text, index)
            if (end > index) {
                append(text, index, end)
                index = end
            } else {
                val next = (index until text.length).firstOrNull { numberEnd(text, it) > it } ?: text.length
                withStyle(unit.copy(fontWeight = FontWeight.Normal)) { append(text, index, next) }
                index = next
            }
        }
    }

private fun numberEnd(
    text: String,
    start: Int,
): Int {
    if (!text[start].isDigit()) return start
    var end = start
    while (end < text.length &&
        (text[end].isDigit() || (text[end] in SEPARATORS && end + 1 < text.length && text[end + 1].isDigit()))
    ) {
        end++
    }
    return end
}

private val SEPARATORS = setOf(',', '.', ' ', ' ', '\'', '٬', '٫')
