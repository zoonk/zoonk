package com.zoonk.android.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle

class NumberUnitTransformation(
    private val unit: String,
    private val prefix: Boolean,
    private val color: Color,
) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val start = if (prefix) unit.length + 1 else 0
        val shown =
            buildAnnotatedString {
                if (prefix) {
                    withStyle(SpanStyle(color = color)) {
                        append(unit)
                        append(' ')
                    }
                }
                append(text)
                if (!prefix) {
                    withStyle(SpanStyle(color = color)) {
                        append(' ')
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
