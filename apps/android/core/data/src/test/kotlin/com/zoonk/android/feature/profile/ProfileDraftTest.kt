package com.zoonk.android.feature.profile

import com.zoonk.api.ApiJson
import com.zoonk.api.ApiRequestJson
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
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
            if (draft.declined) {
                val declineRow = if (view.id in listOf(ProfileQuestion.WORK, ProfileQuestion.CONDITIONS)) "prefer" else "none"
                assertEquals(view.id.value, declineRow, draft.declineChoice)
            }
            assertEquals(view.id.value, ApiJson.decodeFromJsonElement<ProfileAnswerInput>(expected), draft.input(view.id, true))
            assertEquals(
                view.id.value,
                ApiJson.decodeFromJsonElement<OnboardingAnswerInput>(expected),
                draft.onboardingInput(view.id, true),
            )
        }
    }

    @Test
    fun unconsentedConditionsNeverEnterEitherRequest() {
        val draft = ProfileDraft(picks = listOf("adhd", "other"), text = "Private note")
        val expected = ApiJson.parseToJsonElement("""{"question":"conditions","answer":{"declined":true}}""")
        assertEquals(expected, draft.body(ProfileQuestion.CONDITIONS, true))
        assertEquals(expected, ApiRequestJson.encodeToJsonElement(draft.input(ProfileQuestion.CONDITIONS, true)))
        assertEquals(expected, ApiRequestJson.encodeToJsonElement(draft.onboardingInput(ProfileQuestion.CONDITIONS, true)))
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
