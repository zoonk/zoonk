package com.zoonk.android.ui.richtext

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.File

@RunWith(Parameterized::class)
class LessonMathFixturesTest(
    private val text: String,
    private val expected: List<RichSegment>,
) {
    @Test
    fun matchesWebSegments() {
        assertEquals(expected, splitLessonMath(text))
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{index}: {0}")
        fun cases(): List<Array<Any>> =
            Json
                .parseToJsonElement(File(requireNotNull(System.getProperty("zoonk.mathFixtures"))).readText())
                .jsonObject
                .getValue("cases")
                .jsonArray
                .map { fixture ->
                    val case = fixture.jsonObject
                    val segments =
                        case.getValue("segments").jsonArray.map { segment ->
                            val value = segment.jsonObject
                            val kind =
                                when (value.getValue("kind").jsonPrimitive.content) {
                                    "math" -> SegmentKind.Math
                                    "displayMath" -> SegmentKind.DisplayMath
                                    "text" -> SegmentKind.Text
                                    else -> error("Unknown segment kind")
                                }
                            RichSegment(kind, value.getValue("text").jsonPrimitive.content)
                        }
                    arrayOf(case.getValue("text").jsonPrimitive.content, segments)
                }
    }
}
