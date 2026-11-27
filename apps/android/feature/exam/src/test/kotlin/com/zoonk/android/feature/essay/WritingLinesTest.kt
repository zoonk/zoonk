package com.zoonk.android.feature.essay

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class WritingLinesTest {
    @Test
    fun everyCoreCaseCountsAsCoreDoes() {
        val cases = Json.parseToJsonElement(File(requireNotNull(System.getProperty("zoonk.writingLines"))).readText()).jsonArray
        assertTrue(cases.isNotEmpty())
        cases.forEach { case ->
            val fields = case.jsonObject.mapValues { it.value.jsonPrimitive }
            val text = fields.getValue("text").content
            assertEquals(
                text,
                WritingLines(fields.getValue("estimatedLines").int, fields.getValue("ignoredFrom").intOrNull),
                countWritingLines(
                    text,
                    fields.getValue("charactersPerLine").int,
                    fields.getValue("maxCharactersPerLine").int,
                    fields.getValue("limit").intOrNull,
                ),
            )
        }
    }
}
