package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.TestRow
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/** What a screen reader hears for the offer's cards: each one is a radio named by what its card shows. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class TestOfferTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun eachCardIsOneRadioWhoseNameStartsWithItsCardsNameAndThePickedOneIsSelected() {
        rule.setContent {
            ZoonkTheme {
                Column {
                    SetupColumn {
                        TestOffer(
                            title = "Where would you like to start?",
                            sentence = "A short test finds what you already know.",
                            cards = listOf(testCard(TestRow.Quick, "Test", 8, 4), firstLessonCard("Why prices move")),
                            initial = TestRow.Quick,
                            pressed = null,
                            failed = false,
                            onChoose = {},
                            test = courseTest(UUID.randomUUID(), onboarding = true, attempt = null),
                        )
                    }
                }
            }
        }
        val radios =
            rule
                .onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton))
                .fetchSemanticsNodes()
                .map { node ->
                    // Minutes are written with a no-break space before their unit.
                    node.config
                        .getOrElse(SemanticsProperties.Text) { emptyList() }
                        .joinToString(", ")
                        .replace('\u00A0', ' ') to
                        node.config.getOrElse(SemanticsProperties.Selected) { false }
                }

        assertEquals(listOf("Test, Up to 8 questions, 4 min" to true, "First lesson, Why prices move" to false), radios)
    }

    @Test
    fun aTestOfferedAloneIsPlainTextWithStartAsItsControl() {
        rule.setContent {
            ZoonkTheme {
                Column {
                    SetupColumn {
                        TestOffer(
                            title = "Test what you already know",
                            sentence = "Skip the lessons you can already do.",
                            cards = listOf(testCard(TestRow.Quick, "Test", 8, 4)),
                            initial = TestRow.Quick,
                            pressed = null,
                            failed = false,
                            onChoose = {},
                            test = courseTest(UUID.randomUUID(), onboarding = false, attempt = null),
                        )
                    }
                }
            }
        }

        rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton)).assertCountEquals(0)
        rule.onAllNodesWithText("Start").assertCountEquals(1)
    }
}
