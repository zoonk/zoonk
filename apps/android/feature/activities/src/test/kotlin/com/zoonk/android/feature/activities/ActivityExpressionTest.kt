package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what core's `evaluateFormula` returns for the same source. */
class ActivityExpressionTest {
    private val cases: List<Triple<String, Map<String, Double>, Double?>> =
        listOf(
            Triple("1000000 / 86400", emptyMap(), 11.574074074074074),
            Triple("2 ^ 3 ^ 2", emptyMap(), 512.0),
            Triple("-2 ^ 2", emptyMap(), -4.0),
            Triple("round(2.5)", emptyMap(), 3.0),
            Triple("round(-2.5)", emptyMap(), -2.0),
            Triple("round(3.14159, 2)", emptyMap(), 3.14),
            Triple("round(1.005, 2)", emptyMap(), 1.0),
            Triple("round(0.49999999999999994)", emptyMap(), 0.0),
            Triple("round(2, 1.5)", emptyMap(), null),
            Triple("sqrt(16) + abs(-2) * pi", emptyMap(), 10.283185307179586),
            Triple("x * 2", mapOf("x" to 3.0), 6.0),
            Triple("LOG10(1000)", emptyMap(), 3.0),
            Triple("log(e)", emptyMap(), 1.0),
            Triple("max(1, 7, 3) - min(4, 2)", emptyMap(), 5.0),
            Triple("2e3 + .5", emptyMap(), 2000.5),
            Triple("1.", emptyMap(), 1.0),
            Triple("deg(pi)", emptyMap(), 180.0),
            Triple("+-+3", emptyMap(), -3.0),
            Triple("2 * (3 + 4) ^ 2 / 7", emptyMap(), 14.0),
            Triple("cbrt(-27) + sign(-4)", emptyMap(), -4.0),
            Triple("1 / 0", emptyMap(), null),
            Triple("sqrt(-1)", emptyMap(), null),
            Triple("sqrt 4", emptyMap(), null),
            Triple("sin", emptyMap(), null),
            Triple("y + 1", emptyMap(), null),
            Triple("Pi", emptyMap(), null),
            Triple("alert(1)", emptyMap(), null),
            Triple("(1 + 2", emptyMap(), null),
            Triple("max()", emptyMap(), null),
            Triple("1 2", emptyMap(), null),
        )

    @Test
    fun evaluatesFormulasAsCoreDoes() {
        assertEquals(cases.map { it.third }, cases.map { (source, variables) -> ActivityExpression.evaluate(source, variables) })
    }
}
