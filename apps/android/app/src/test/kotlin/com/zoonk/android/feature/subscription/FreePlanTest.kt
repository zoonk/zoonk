package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.FreePlan
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class FreePlanTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val limits =
        FreePlan(
            activeGoals = 1,
            examPrepDays = 7,
            guestLessons = 3,
            lessonsPerDay = 5,
            lessonsPerMonth = 40,
            tutorMessagesPerDay = 10,
            uploadsPerDay = 1,
        )

    @Test
    fun theCardSumsUpTheFreePlanWithAWeekOfExamPrep() {
        rule.setContent { ZoonkTheme { FreePlanCard(limits, currency = "USD", onStart = {}) } }

        rule.onNode(hasText("1 goal · 40 lessons a month")).assertIsDisplayed()
        rule.onNode(hasText("For an exam: the diagnostic, your plan and its first week")).assertIsDisplayed()
        rule.onNode(hasText("An AI study buddy: 10 messages a day")).assertIsDisplayed()
    }

    @Test
    fun withoutAnAccountTheFirstAnswerStartsWithTheGuestLessons() {
        questions(hasAccount = false)

        rule.onNode(hasText("Start free with 3 lessons, no account needed. With a free account, you get:")).assertIsDisplayed()
        rule.onNode(hasText("10 messages to your buddy and 1 upload a day")).assertIsDisplayed()
    }

    @Test
    fun anAccountReadsTheFreePlanAndOpensTheOtherAnswers() {
        questions(hasAccount = true)

        rule.onNode(hasText("With the free plan, you get:")).assertIsDisplayed()
        rule.onNode(hasText("You keep Plus", substring = true)).assertDoesNotExist()
        rule.onNode(hasText("What happens if I cancel?") and hasClickAction()).performScrollTo().performClick()
        rule.onNode(hasText("You keep Plus", substring = true)).assertIsDisplayed()
    }

    private fun questions(hasAccount: Boolean) {
        rule.setContent {
            ZoonkTheme {
                Column(Modifier.verticalScroll(rememberScrollState())) { CommonQuestions(limits, hasAccount, rememberAppNavigator()) }
            }
        }
    }
}
