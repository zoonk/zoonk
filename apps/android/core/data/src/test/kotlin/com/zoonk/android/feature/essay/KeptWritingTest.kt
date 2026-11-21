package com.zoonk.android.feature.essay

import com.zoonk.api.models.WritingDraft
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.util.UUID

class KeptWritingTest {
    private val admission = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val rewrite = UUID.fromString("00000000-0000-4000-8000-0000000000a2")

    private fun saved(
        text: String,
        revision: Long,
        admissionId: UUID = admission,
    ) = WritingDraft(admissionId, revision, text)

    @Test
    fun theFieldsCapIsTheOneTheApiSavesAndGrades() {
        val schemas =
            Json
                .parseToJsonElement(
                    File("../../api/openapi.json").readText(),
                ).jsonObject["components"]!!
                .jsonObject["schemas"]!!
                .jsonObject
        listOf("SaveWritingDraft", "EssaySubmissionInput").forEach { schema ->
            val text = schemas[schema]!!.jsonObject["properties"]!!.jsonObject["text"]!!.jsonObject
            assertEquals(schema, MAX_WRITING_CHARACTERS, text["maxLength"]!!.jsonPrimitive.int)
        }
    }

    @Test
    fun aCopyFromAnotherAdmissionIsNeverOffered() {
        val kept = KeptWriting("The first answer.", 9, admission.toString())
        assertEquals(DraftStart.Saved("A rewrite."), chooseDraft(kept, saved("A rewrite.", 1, rewrite), rewrite.toString()))
        assertEquals(DraftStart.Saved(""), chooseDraft(kept, null, null))
    }

    @Test
    fun anEmptyTextKeptOverTheSavedDraftIsAnEdit() =
        assertEquals(DraftStart.Kept("", 3), chooseDraft(KeptWriting("", 3, admission.toString()), saved("old", 3), admission.toString()))

    @Test
    fun aSaveThatLandedWithoutItsAnswerIsThisDevicesOwn() =
        assertEquals(
            DraftStart.Kept("second", 1),
            chooseDraft(KeptWriting("second", 0, admission.toString(), sending = "first"), saved("first", 1), admission.toString()),
        )

    @Test
    fun aNewerDraftFromElsewhereKeepsBothToChooseFrom() {
        val other = saved("From the laptop.", 4)
        assertEquals(
            DraftStart.Conflict("Typed here.", other),
            chooseDraft(KeptWriting("Typed here.", 2, admission.toString()), other, admission.toString()),
        )
    }

    @Test
    fun aCopyThatIsTheSavedDraftIsNothingToKeep() =
        assertEquals(
            DraftStart.Saved("Same."),
            chooseDraft(KeptWriting("Same.", 1, admission.toString()), saved("Same.", 2), admission.toString()),
        )
}
