package com.zoonk.android.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle
import com.zoonk.android.ui.format.currencyFor
import com.zoonk.android.ui.format.formatMoney
import java.util.Locale

/** A number field's [unit] around the typed number, where the learner's [locale] writes it: money's sign before or after it. */
class NumberUnitTransformation(
    private val unit: String,
    locale: Locale,
    private val color: Color,
) : VisualTransformation {
    private val prefix = currencyFor(unit)?.let { formatMoney(1.0, it, locale).indexOfFirst(Char::isDigit) > 0 } == true

    // A sign ("°", "%", "$") closes up on its number, as the answer's feedback writes it; a word ("kg", "R$") keeps a space.
    private val gap = if (unit.length == 1 && !unit.first().isLetterOrDigit()) "" else "\u00A0"

    override fun filter(text: AnnotatedString): TransformedText {
        val start = if (prefix) unit.length + gap.length else 0
        val shown =
            buildAnnotatedString {
                if (prefix) {
                    withStyle(SpanStyle(color = color)) {
                        append(unit)
                        append(gap)
                    }
                }
                append(text)
                if (!prefix) {
                    withStyle(SpanStyle(color = color)) {
                        append(gap)
                        append(unit)
                    }
                }
            }
        return TransformedText(
            shown,
            object : OffsetMapping {
                override fun originalToTransformed(offset: Int): Int = offset + start

                override fun transformedToOriginal(offset: Int): Int = (offset - start).coerceIn(0, text.length)
            },
        )
    }
}
