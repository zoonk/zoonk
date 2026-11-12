package com.zoonk.android.feature.profile

import com.zoonk.api.ApiJson
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ProfileDraftTest {
    @Test
    fun everyCoreSavedAnswerRoundTripsThroughSettingsAndOnboarding() {
        val fixtures =
            ApiJson
                .parseToJsonElement(File(requireNotNull(System.getProperty("zoonk.profileFixtures"))).readText())
                .jsonObject
                .getValue("fixtures")
                .jsonArray
        assertTrue(fixtures.isNotEmpty())
        fixtures.forEach { fixture ->
            val view = ApiJson.decodeFromJsonElement<ProfileQuestionView>(fixture.jsonObject.getValue("view"))
            val expected = fixture.jsonObject.getValue("answer")
            val draft = ProfileDraft.from(view)
            assertEquals(view.id.value, ApiJson.decodeFromJsonElement<ProfileAnswerInput>(expected), draft.input(view.id, true))
            assertEquals(
                view.id.value,
                ApiJson.decodeFromJsonElement<OnboardingAnswerInput>(expected),
                draft.onboardingInput(view.id, true),
            )
        }
    }

    @Test
    fun conditionsContinueOnlyWithAPick() {
        assertFalse(ProfileDraft().valid(ProfileQuestion.CONDITIONS))
        assertFalse(ProfileDraft(declined = true).valid(ProfileQuestion.CONDITIONS))
        assertTrue(ProfileDraft(picks = listOf("adhd")).valid(ProfileQuestion.CONDITIONS))
    }

    @Test
    fun aRolePrefillFitsTheJobLimit() {
        val question =
            ProfileQuestionView(
                ProfileQuestion.WORK,
                emptyList(),
                com.zoonk.api.models
                    .ProfileQuestionViewSaved(emptyList(), emptyList(), ""),
                null,
                1,
            )
        val role = "  " + "a".repeat(200) + "  "
        assertEquals("a".repeat(80), ProfileDraft.from(question, role).text)
    }

    @Test
    fun pickedConditionsAreSentWithConsentAndNoPicksAsADecline() {
        val draft = ProfileDraft(picks = listOf("adhd", "other"), text = " Private note ")
        val expected =
            ApiJson.parseToJsonElement(
                """{"question":"conditions","answer":{"declined":false,"consented":true,""" +
                    """"conditions":[{"condition":"adhd"},{"condition":"other","note":"Private note"}]}}""",
            )
        assertEquals(expected, draft.body(ProfileQuestion.CONDITIONS, true))
        assertEquals(ApiJson.decodeFromJsonElement<ProfileAnswerInput>(expected), draft.input(ProfileQuestion.CONDITIONS, true))
        assertEquals(
            ApiJson.decodeFromJsonElement<OnboardingAnswerInput>(expected),
            draft.onboardingInput(ProfileQuestion.CONDITIONS, true),
        )
        assertEquals(
            ApiJson.parseToJsonElement("""{"question":"conditions","answer":{"declined":true}}"""),
            draft.copy(picks = emptyList()).body(ProfileQuestion.CONDITIONS, true),
        )
    }

    @Test
    fun exclusiveAnswersClearContentAndSoundPreferences() {
        val draft = ProfileDraft(picks = listOf("noSoundEffects"), text = "Private note").decline()
        assertTrue(draft.declined)
        assertTrue(draft.picks.isEmpty())
        assertEquals(
            ApiJson.parseToJsonElement("""{"question":"learningSupport","answer":{"declined":true,"soundEffects":true}}"""),
            draft.body(ProfileQuestion.LEARNING_SUPPORT, true),
        )
        assertFalse(draft.toggle("shortAnswers").declined)
    }

    @Test
    fun memoryOffOmitsSupportNotesAndOtherFieldsNeedTheirText() {
        val support = ProfileDraft(text = "Private note")
        assertFalse(support.valid(ProfileQuestion.LEARNING_SUPPORT, false))
        assertFalse(support.body(ProfileQuestion.LEARNING_SUPPORT, false).toString().contains("Private note"))
        assertFalse(ProfileDraft(picks = listOf("other")).valid(ProfileQuestion.STUDIES))
        assertFalse(ProfileDraft(picks = listOf("other")).valid(ProfileQuestion.CONDITIONS))
        assertTrue(ProfileDraft(picks = listOf("noSoundEffects")).valid(ProfileQuestion.LEARNING_SUPPORT))
    }
}
