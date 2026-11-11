package com.zoonk.android.ui.richtext

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.commonmark.node.AbstractVisitor
import org.commonmark.node.Text
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.File

@RunWith(Parameterized::class)
internal class TutorMathFixturesTest(
    private val text: String,
    private val expected: List<Pair<Boolean, String>>,
) {
    @Test
    fun showsTheWebFormulas() {
        val document = parseMarkdown(text)
        val shown = mutableListOf<MarkdownFormula>()

        document.root.accept(
            object : AbstractVisitor() {
                override fun visit(text: Text) {
                    FORMULA.findAll(text.literal).forEach { shown += document.formulas[it.groupValues[1].toInt()] }
                }
            },
        )

        assertEquals(expected, shown.map { it.display to it.latex })
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
                            value.getValue("display").jsonPrimitive.boolean to value.getValue("latex").jsonPrimitive.content
                        }
                    arrayOf(case.getValue("text").jsonPrimitive.content, formulas)
                }
    }
}
