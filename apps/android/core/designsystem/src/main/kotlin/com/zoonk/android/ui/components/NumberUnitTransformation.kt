package com.zoonk.android.ui.components

import androidx.compose.foundation.text.input.OutputTransformation
import androidx.compose.foundation.text.input.TextFieldBuffer
import androidx.compose.foundation.text.input.insert
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import com.zoonk.android.ui.format.currencyFor
import com.zoonk.android.ui.format.formatMoney
import com.zoonk.android.ui.format.withUnit
import com.zoonk.android.ui.richtext.moneySignGap
import java.util.Locale

/** A number field's [unit] around the typed number, where the learner's [locale] writes it: money's sign before or after it. */
class NumberUnitTransformation(
    private val unit: String,
    locale: Locale,
    private val color: Color,
) : OutputTransformation {
    private val prefix = unitBeforeNumber(unit, locale)

    // The gap the answer's feedback writes: money's from the learner's language ("R$80", "R$ 80"), any other unit's
    // from the app's unit rule ("180°", "3 kg").
    private val gap = if (prefix) moneySignGap(locale, unit) ?: NO_BREAK_SPACE else withUnit("", unit).removeSuffix(unit)

    override fun TextFieldBuffer.transformOutput() {
        val start = if (prefix) 0 else length
        val decoration = if (prefix) unit + gap else gap + unit
        insert(start, decoration)
        addStyle(SpanStyle(color = color), start, start + decoration.length)
    }
}

private const val NO_BREAK_SPACE = "\u00A0"

/** Whether the learner's [locale] writes [unit] before the number, as money's sign in "R$80"; any other unit follows it. */
fun unitBeforeNumber(
    unit: String,
    locale: Locale,
): Boolean = currencyFor(unit)?.let { formatMoney(1.0, it, locale).indexOfFirst(Char::isDigit) > 0 } == true
