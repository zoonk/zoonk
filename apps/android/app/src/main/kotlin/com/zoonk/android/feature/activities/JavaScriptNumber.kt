package com.zoonk.android.feature.activities

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import kotlin.math.abs

/**
 * A number as JavaScript's `String(number)` writes it, which is how core writes grid cells and code
 * traces: its shortest digits ("7", "2.5", "0.30000000000000004"), in exponent form below 1e-6 or
 * from 1e21 ("1e+21").
 */
internal fun jsNumberText(value: Double): String {
    if (value.isNaN()) return "NaN"
    if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
    if (value == 0.0) return "0"
    val shortest = shortestDecimal(value)
    if (abs(value) in JS_PLAIN_RANGE) return shortest.toPlainString()
    val digits = shortest.unscaledValue().abs().toString()
    val exponent = digits.length - 1 - shortest.scale()
    val mantissa = if (digits.length == 1) digits else "${digits[0]}.${digits.substring(1)}"
    return "${if (value < 0) "-" else ""}${mantissa}e${if (exponent < 0) "-" else "+"}${abs(exponent)}"
}

/**
 * The fewest significant digits that read back as [value], the nearest such, as JavaScript picks them.
 * Android's `Double.toString` can write more digits than that ("1.15292150460684698E18" for 2^60).
 */
private fun shortestDecimal(value: Double): BigDecimal {
    val exact = BigDecimal(value)
    return (1..MAX_DIGITS)
        .firstNotNullOf { digits ->
            listOf(RoundingMode.FLOOR, RoundingMode.CEILING)
                .map { exact.round(MathContext(digits, it)) }
                .filter { it.toString().toDouble() == value }
                .minByOrNull { (it - exact).abs() }
        }.stripTrailingZeros()
}

private val JS_PLAIN_RANGE = 1e-6..<1e21

/** Every double reads back from its 17 significant digits. */
private const val MAX_DIGITS = 17
