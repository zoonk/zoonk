package com.zoonk.android.feature.language

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageTodayLevel
import com.zoonk.api.models.LanguageTodayPronunciation
import com.zoonk.api.models.LanguageUnits
import com.zoonk.api.models.LanguageUnitsAlphabet
import com.zoonk.api.models.TodayPattern
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

private val GOAL = UUID.fromString("00000000-0000-4000-8000-000000000050")
private val LESSON = UUID.fromString("00000000-0000-4000-8000-000000000051")
private val PATTERN = UUID.fromString("00000000-0000-4000-8000-000000000052")

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class LanguagePracticeTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val opened = mutableListOf<AppRoute>()

    private class FakeAlphabetApi(
        var failures: Int = 0,
    ) : AlphabetApi {
        var skips = 0

        override suspend fun units(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = LanguageUnits(null, goalId, emptyList())

        override suspend fun skipAlphabet(
            session: AuthenticatedSession,
            goalId: UUID,
        ) {
            skips++
            if (failures-- > 0) throw ApiException(ApiError.Network)
        }
    }

    private fun showAlphabet(
        api: FakeAlphabetApi,
        pending: Boolean = true,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val alphabet = LanguageUnitsAlphabet(canDo = null, lessonId = LESSON, minutes = 10, pending = pending, title = "Hiragana")
        rule.setContent { ZoonkTheme { AlphabetRow(alphabet, GOAL, AlphabetStore(api, cache), { opened += it }) } }
    }

    private fun showNotice(
        pattern: TodayPattern? = null,
        pronunciation: LanguageTodayPronunciation? = null,
    ) {
        rule.setContent {
            ZoonkTheme { LanguagePracticeNotice(GOAL, pattern, pronunciation, SuggestionLayout.Panel, { opened += it }) }
        }
    }

    @Test
    fun aLearnerWhoReadsTheScriptSkipsTheAlphabetAndCanTryAgainWhenTheSaveFails() {
        val api = FakeAlphabetApi(failures = 1)
        showAlphabet(api)

        rule.onNodeWithText("First in your next session", substring = true).assertIsDisplayed()
        rule.onNodeWithText("I can already read it").performClick()
        rule.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()

        rule.onNodeWithText("I can already read it").performClick()
        rule.onNodeWithText("That didn't save. Try again.").assertDoesNotExist()
        assertEquals(2, api.skips)
    }

    @Test
    fun anAlphabetAlreadyBehindTheLearnerOpensForPracticeWithoutASkip() {
        showAlphabet(FakeAlphabetApi(), pending = false)

        rule.onNodeWithText("Practice anytime", substring = true).assertIsDisplayed()
        rule.onNodeWithText("I can already read it").assertDoesNotExist()
        rule.onNodeWithText("Hiragana").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Lesson(LESSON.toString())), opened)
    }

    @Test
    fun wordsToSayAgainComeBeforeANoticedPattern() {
        showNotice(
            TodayPattern(PATTERN, TodayPattern.Kind.PATTERN, "Ser and estar"),
            LanguageTodayPronunciation(2, listOf("hola", "gracias")),
        )

        rule.onNodeWithText("Say 2 words again").assertIsDisplayed()
        rule.onNodeWithText("hola and gracias").assertIsDisplayed()
        rule.onNodeWithText("Ser and estar").assertDoesNotExist()
        rule.onNodeWithText("Say them").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Pronunciation(GOAL.toString())), opened)
    }

    @Test
    fun slipsAreToldApartFromARuleToLearn() {
        showNotice(TodayPattern(PATTERN, TodayPattern.Kind.TYPOS, "ignored"))

        rule.onNodeWithText("Just typos").assertIsDisplayed()
        rule.onNodeWithText("Your recent mistakes were slips, not a rule to learn.").assertIsDisplayed()
        rule.onNodeWithText("Open").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Pattern(PATTERN.toString())), opened)
    }

    @Test
    fun aNoticedPatternOpensForPractice() {
        showNotice(TodayPattern(PATTERN, TodayPattern.Kind.PATTERN, "Ser and estar"))

        rule.onNodeWithText("We noticed a pattern").assertIsDisplayed()
        rule.onNodeWithText("Ser and estar").assertIsDisplayed()
        rule.onNodeWithText("Practice it").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Pattern(PATTERN.toString())), opened)
    }

    @Test
    fun todaysLevelSaysWhereTheLearnerAimsAndLeadsToThePlan() {
        rule.setContent { ZoonkTheme { LanguageLevelCard(LanguageTodayLevel("A2+", "B1"), onOpenPlan = { opened += AppRoute.Plan() }) } }

        rule.onNodeWithText("A2+ → B1").assertIsDisplayed()
        rule.onNodeWithContentDescription("A2+, goal B1").assertIsDisplayed()
        rule.onNodeWithText("See your plan").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Plan()), opened)
    }
}
