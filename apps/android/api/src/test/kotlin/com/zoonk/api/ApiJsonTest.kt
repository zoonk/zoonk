package com.zoonk.api

import com.zoonk.api.models.ActivityExpectedRows
import com.zoonk.api.models.ExamBlueprintSource
import com.zoonk.api.models.ItemSetListening
import com.zoonk.api.models.LanguageConversationStartInputOneOf
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf12
import com.zoonk.api.models.MeUpdate
import com.zoonk.api.models.PlayableLibraryStepAnyOf9Exercise
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18Fields
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsExpectedRowsInnerInner as Cell

class ApiJsonTest {
    private val source =
        """
        {"fetchedAt":"2026-10-28T12:34:56.789Z","id":"7d3c1c1e-5b0a-4d43-9f55-0c9a3c1c2f10","kind":"official",
         "publisher":null,"reusePolicy":null,"title":"Edital","url":null,"later":"a field the app doesn't know yet"}
        """.trimIndent()

    @Test
    fun aPlainJsonCannotResolveTheGeneratedContextualSerializers() {
        val plain = Json { ignoreUnknownKeys = true }
        val failure = runCatching { plain.decodeFromString<ExamBlueprintSource>(source) }.exceptionOrNull()
        assertTrue(failure?.message.orEmpty().contains("UUID"))
    }

    @Test
    fun decodesUuidsTimestampsAndEnumsAndIgnoresUnknownFields() {
        val decoded = ApiJson.decodeFromString<ExamBlueprintSource>(source)
        assertEquals(UUID.fromString("7d3c1c1e-5b0a-4d43-9f55-0c9a3c1c2f10"), decoded.id)
        assertEquals("2026-10-28T12:34:56.789Z", decoded.fetchedAt.toString())
        assertEquals(ExamBlueprintSource.Kind.OFFICIAL, decoded.kind)
        val encoded = ApiJson.encodeToString(ExamBlueprintSource.serializer(), decoded)
        assertTrue(encoded.contains("\"id\":\"7d3c1c1e-5b0a-4d43-9f55-0c9a3c1c2f10\""))
    }

    @Test
    fun decodesALanguageExerciseWhoseContentIsAnEmptyObject() {
        val exercise =
            """
            {"content":{},"fillBlankOptions":[],"id":"7d3c1c1e-5b0a-4d43-9f55-0c9a3c1c2f10","kind":"listening",
             "matchColumnsRightItems":[],"position":0,"sentence":null,"sentenceWordOptions":[],"translationOptions":[],
             "vocabularyOptions":[],"word":null,"wordBankOptions":[]}
            """.trimIndent()

        val decoded = ApiJson.decodeFromString<PlayableLibraryStepAnyOf9Exercise>(exercise)
        assertTrue(decoded is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf2Value)
    }

    @Test
    fun aBodyLeavesOutTheFieldsItDoesNotSet() {
        val body = MeUpdate(name = "Ana")
        assertEquals("{\"name\":\"Ana\"}", ApiJson.encodeToString(MeUpdate.serializer(), body))
    }

    @Test
    fun aNumberLiteralUnionReadsAndWritesTheNumber() {
        val listening =
            ApiJson.decodeFromString<ItemSetListening>(
                """{"audio":null,"plays":2,"task":null,"title":null,"transcript":null}""",
            )
        assertEquals(ItemSetListening.Plays._2, listening.plays)

        val start =
            LanguageConversationStartInputOneOf(
                chapterId = UUID.fromString("7d3c1c1e-5b0a-4d43-9f55-0c9a3c1c2f10"),
                kind = LanguageConversationStartInputOneOf.Kind.PRACTICE,
                minutes = LanguageConversationStartInputOneOf.Minutes._1,
            )
        assertTrue(ApiJson.encodeToString(LanguageConversationStartInputOneOf.serializer(), start).contains("\"minutes\":1.0"))
    }

    @Test
    fun aSqlCellCanBeNullInTablesExpectedRowsAndAnswers() {
        val fields =
            ApiJson.decodeFromString<PlayableLibraryStepAnyOfContentOneOf18Fields>(
                """
                {"expected":{"columns":["name","capital"],"orderMatters":false,"rows":[["Atlantis",null]]},"mistakes":[],
                 "solution":"SELECT * FROM countries","tables":[{"name":"countries",
                 "columns":[{"name":"name","type":"text"},{"name":"capital","type":"text"}],
                 "rows":[["Atlantis",null],["Brazil","Brasília"]]}]}
                """.trimIndent(),
            )
        assertEquals(listOf(Cell.StringValue("Atlantis"), null), fields.tables.single().rows.first())
        assertEquals(listOf(listOf(Cell.StringValue("Atlantis"), null)), fields.expected.rows)

        val expected = ApiJson.decodeFromString<ActivityExpectedRows>("""{"columns":["capital"],"kind":"rows","orderMatters":true,"rows":[[null]]}""")
        assertEquals(listOf(listOf(null)), expected.rows)

        val answer = """{"columns":["name","capital"],"kind":"rows","rows":[["Atlantis",null]]}"""
        val serializer = LessonStepAnswerOneOf3AnswerOneOf12.serializer()
        assertEquals(answer, ApiJson.encodeToString(serializer, ApiJson.decodeFromString(serializer, answer)))
    }
}
