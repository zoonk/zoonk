package com.zoonk.android.feature.questions

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.TouchInjectionScope
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipe
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class QuestionControlsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var answer: Answer? = null
    private var submitted: Answer? = null

    private fun show(
        question: Question,
        allowBlank: Boolean = false,
        check: AnswerCheck? = null,
    ) = setContent {
        QuestionAnswer(question, TrueFalseWords.TrueFalse, allowBlank, check, enabled = true, onAnswer = { answer = it }, onSubmit = {
            submitted =
                it
        })
    }

    /** A finger moving [distance] sideways from the statement's middle, past where its words end. */
    private fun TouchInjectionScope.swipeBy(distance: Float) = swipe(center, center.copy(x = center.x + distance))

    private fun setContent(content: @Composable () -> Unit) = rule.setContent { ZoonkTheme { content() } }

    private fun choice(select: Select? = null) =
        Question(
            "choice",
            QuestionFormat.MultipleChoice,
            "Which are planets?",
            options = listOf("Mars", "Moon", "Venus", "Sun"),
            select = select,
        )

    @Test
    fun onePickAnswersAtOnceAndASecondTapTakesItBack() {
        show(choice())

        rule.onNodeWithText("Moon", substring = true).performClick()
        assertEquals(Answer.Choice(1), answer)
        rule.onNodeWithText("Moon", substring = true).assertIsSelected()

        rule.onNodeWithText("Moon", substring = true).performClick()
        assertNull(answer)
    }

    @Test
    fun severalPicksAnswerOnlyOnceAsManyAsAskedArePicked() {
        show(choice(Select.Count(2)))

        rule.onNodeWithText("Choose 2 options.").assertExists()
        rule.onNodeWithText("Mars", substring = true).performClick()
        assertNull(answer)
        rule.onNodeWithText("Venus", substring = true).performClick()
        assertEquals(Answer.Choices(listOf(0, 2)), answer)
        rule.onNodeWithText("Venus", substring = true).assertIsOn()
    }

    @Test
    fun aCheckedChoiceKeepsOnlyTheRightOptionAndTheLearners() {
        show(choice(), check = AnswerCheck(Answer.Choice(1), Answer.Choice(0), isCorrect = false))

        rule.onNodeWithText("Your answer", substring = true).assertExists()
        rule.onNodeWithText("Correct", substring = true).assertExists()
        rule.onAllNodesWithText("Sun", substring = true).assertCountEquals(0)
    }

    @Test
    fun aStatementIsSwipedOrPickedAndCanBeLeftBlank() {
        val statement = Question("statement", QuestionFormat.TrueFalse, "Water boils at 100 °C at sea level.")
        show(statement, allowBlank = true)

        rule.onNodeWithText("Water boils", substring = true).performTouchInput { swipeBy(150.dp.toPx()) }
        rule.waitForIdle()
        assertEquals(Answer.TrueFalse(true), answer)
        rule.onNodeWithText("Water boils", substring = true).performTouchInput { swipeBy(-150.dp.toPx()) }
        rule.waitForIdle()
        assertEquals(Answer.TrueFalse(false), answer)
        rule.onNodeWithText("Leave blank", substring = true).performClick()
        assertEquals(Answer.DontKnow, answer)
    }

    @Test
    fun rightToLeftATrueStatementIsSwipedTowardTheEnd() {
        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                QuestionAnswer(
                    Question("statement", QuestionFormat.TrueFalse, "Water boils at 100 °C at sea level."),
                    TrueFalseWords.TrueFalse,
                    allowBlank = false,
                    check = null,
                    enabled = true,
                    onAnswer = { answer = it },
                    onSubmit = {},
                )
            }
        }

        rule.onNodeWithText("Water boils", substring = true).performTouchInput { swipeBy(-150.dp.toPx()) }
        rule.waitForIdle()
        assertEquals(Answer.TrueFalse(true), answer)
    }

    @Test
    fun stepsAreTappedInOrderAndAPlacedStepComesBackOut() {
        show(Question("order", QuestionFormat.Order, "Order them.", options = listOf("B", "A", "C")))

        rule.onNodeWithText("A", substring = true).performClick()
        rule.onNodeWithText("B", substring = true).performClick()
        rule.onNodeWithContentDescription("Place 2", substring = true).assertExists()
        rule.onNodeWithText("B", substring = true).performClick()
        assertNull(answer)
        rule.onNodeWithText("B", substring = true).performClick()
        rule.onNodeWithText("C", substring = true).performClick()
        assertEquals(Answer.Order(listOf(1, 0, 2)), answer)
    }

    @Test
    fun pairsAreMatchedLeftThenRightAndUndoneWithATap() {
        show(Question("pairs", QuestionFormat.MatchPairs, "Match.", left = listOf("Lisbon", "Lima"), right = listOf("Peru", "Portugal")))

        rule.onNodeWithText("Lisbon", substring = true).performClick()
        rule.onNodeWithText("Portugal", substring = true).performClick()
        rule.onNodeWithContentDescription("Portugal, matched with Lisbon").assertExists()
        rule.onNodeWithText("Lima", substring = true).performClick()
        rule.onNodeWithText("Peru", substring = true).performClick()
        assertEquals(Answer.Matches(listOf(1, 0)), answer)

        rule.onNodeWithContentDescription("Peru, matched with Lima").performClick()
        assertNull(answer)
    }

    @Test
    @Config(qualifiers = "pt")
    fun aNumberIsReadWithADecimalCommaAndDoneSendsIt() {
        show(Question("numeric", QuestionFormat.Numeric, "Quanto?", unit = NumericUnit(NumericUnit.Position.Prefix, "R$")))

        rule.onNodeWithText("R$").assertExists()
        rule.onNode(hasSetTextAction()).performTextInput("2,5")
        assertEquals(Answer.Numeric(2.5), answer)
        rule.onNode(hasSetTextAction()).performImeAction()
        assertEquals(Answer.Numeric(2.5), submitted)
    }

    @Test
    fun doneOnSomethingThatIsntANumberSaysWhatToType() {
        show(Question("numeric", QuestionFormat.Numeric, "How many?", entry = NumericEntry(NumericEntry.Kind.Integer)))

        rule.onNodeWithText("A whole number.").assertExists()
        rule.onNode(hasSetTextAction()).performTextInput("2.5")
        assertNull(answer)
        rule.onNode(hasSetTextAction()).performImeAction()
        rule.onNodeWithText("Type a whole number, like 12.").assertExists()
        assertNull(submitted)
    }

    @Test
    fun aTypedAnswerIsSentTrimmed() {
        show(Question("typed", QuestionFormat.Typed, "Symbol for sodium?"))

        rule.onNode(hasSetTextAction()).performTextInput("  Na ")
        assertEquals(Answer.Text("Na"), answer)
        rule.onNode(hasSetTextAction()).performImeAction()
        assertEquals(Answer.Text("Na"), submitted)
    }

    @Test
    fun aMissedNumberShowsTheRightAnswerItsStepsAndWhereTheMistakeWent() {
        val question = Question("numeric", QuestionFormat.Numeric, "How much?", unit = NumericUnit(NumericUnit.Position.Suffix, "km"))
        setContent {
            QuestionFeedback(
                question = question,
                answer = Answer.Numeric(64.0),
                feedback =
                    AnswerFeedback(
                        isCorrect = false,
                        correctAnswer = Answer.Numeric(68.0),
                        workedSteps = listOf("80 − 12 = 68"),
                        savedToNotebook = true,
                    ),
                words = TrueFalseWords.TrueFalse,
                examTomorrow = false,
                timedOut = false,
            )
        }

        rule.onNodeWithText("Not quite").assertExists()
        rule.onNodeWithText("Right answer: 68 km").assertExists()
        rule.onNodeWithContentDescription("Result: 80 − 12 = 68").assertExists()
        rule.onNodeWithText("Saved to your mistakes · it comes back tomorrow").assertExists()
    }

    @Test
    fun theLearnersOwnDontKnowIsNeverCalledAMiss() {
        setContent {
            QuestionFeedback(
                question = choice(),
                answer = Answer.DontKnow,
                feedback = AnswerFeedback(isCorrect = false),
                words = TrueFalseWords.TrueFalse,
                examTomorrow = false,
                timedOut = false,
            )
        }

        rule.onNodeWithText("I don't know yet").assertExists()
        rule.onAllNodesWithText("Not quite").assertCountEquals(0)
    }
}
