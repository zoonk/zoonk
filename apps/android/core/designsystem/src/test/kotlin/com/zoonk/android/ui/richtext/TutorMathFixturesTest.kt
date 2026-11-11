package com.zoonk.android.ui.richtext

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.File

@RunWith(Parameterized::class)
internal class TutorMathFixturesTest(
    private val text: String,
    private val expected: List<MarkdownFormula>,
) {
    @Test
    fun matchesWebFormulas() {
        assertEquals(expected, takeOutFormulas(text).second)
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{index}: {0}")
        fun cases(): List<Array<Any>> =
            Json
                .parseToJsonElement(File(requireNotNull(System.getProperty("zoonk.tutorMathFixtures"))).readText())
                .jsonObject
                .getValue("cases")
                .jsonArray
                .map { fixture ->
                    val case = fixture.jsonObject
                    val formulas =
                        case.getValue("formulas").jsonArray.map { formula ->
                            val value = formula.jsonObject
                            MarkdownFormula(value.getValue("display").jsonPrimitive.boolean, value.getValue("latex").jsonPrimitive.content)
                        }
                    arrayOf(case.getValue("text").jsonPrimitive.content, formulas)
                }
    }
}
