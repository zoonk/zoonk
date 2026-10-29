package com.zoonk.api

import com.zoonk.api.models.ExamBlueprintSource
import com.zoonk.api.models.MeUpdate
import com.zoonk.api.models.PlayableLibraryStepAnyOf9Exercise
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

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
}
