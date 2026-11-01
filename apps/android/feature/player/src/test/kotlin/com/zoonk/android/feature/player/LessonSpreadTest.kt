package com.zoonk.android.feature.player

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import coil3.ImageLoader
import coil3.intercept.Interceptor
import coil3.request.ImageResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.player.language.reading
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.ui.components.PrivatePictures
import kotlinx.coroutines.awaitCancellation
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** An unfolded book foldable's spread: the screen on the page before the fold, the learner's turn on the page after it. */
@RunWith(AndroidJUnit4::class)
class LessonSpreadTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    /** Opens the book flat, its fold down the middle of the window. */
    private fun unfold() {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    private fun text(text: String): DpRect = rule.onNodeWithText(text).getUnclippedBoundsInRoot()

    private fun described(description: String): DpRect = rule.onNodeWithContentDescription(description).getUnclippedBoundsInRoot()

    private fun assertBeforeFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what ends before the fold: $bounds", bounds.right <= FOLD)

    private fun assertAfterFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what starts after the fold: $bounds", bounds.left >= FOLD)

    @Test
    @Config(qualifiers = BOOK)
    fun anOpenBookAsksBeforeTheFoldAndTakesTheAnswerAndItsVerdictAfterIt() {
        harness.play(listOf(checkStep("quiz"), summaryStep("end")))
        unfold()

        assertBeforeFold("the question", text("Question quiz?"))
        assertAfterFold("an option", text("Right"))

        harness.tap("Right")
        harness.tap("Check")

        rule.onNodeWithText("Correct!").assertIsDisplayed()
        assertAfterFold("the verdict", text("Correct!"))
        assertBeforeFold("the question", text("Question quiz?"))
    }

    @Test
    @Config(qualifiers = BOOK)
    fun anOpenBookShowsAReadingScreensPictureOnThePageAfterTheFold() {
        val picture = StepImage("cloud", "https://blob.zoonk.test/cloud.png", "A cloud over a hill", 1024, 1280)
        harness.play(listOf(explanationStep("idea").copy(image = picture), summaryStep("end")), pictures = loadingPictures())
        unfold()

        assertBeforeFold("the title", text("Title idea"))
        assertBeforeFold("the text", text("Idea idea"))
        assertAfterFold("the picture", described(picture.alt))
    }

    /** Text twice as large leaves a page too narrow for it, so the lesson keeps main's one column. */
    @Test
    @Config(qualifiers = BOOK, fontScale = 2f)
    fun largeTextKeepsOneColumnOnAnOpenBook() {
        harness.play(listOf(checkStep("quiz"), summaryStep("end")))
        unfold()

        val question = text("Question quiz?")
        val option = text("Right")
        assertTrue("the options sit under the question: $question, $option", option.top > question.bottom)
        assertTrue("the options start before the fold: $option", option.left < FOLD)
    }

    @Test
    @Config(qualifiers = PHONE)
    fun aPhoneKeepsTheQuestionAndItsOptionsInOneColumn() {
        harness.play(listOf(checkStep("quiz"), summaryStep("end")))

        val question = text("Question quiz?")
        val option = text("Right")
        assertTrue("the options sit under the question: $question, $option", option.top > question.bottom)
        assertEquals("the column's margin", question.left.value, 20f, 0.5f)
    }

    @Test
    @Config(qualifiers = PHONE)
    fun aPhoneKeepsAReadingScreensPictureAboveItsText() {
        val picture = StepImage("cloud", "https://blob.zoonk.test/cloud.png", "A cloud over a hill", 1024, 1280)
        harness.play(listOf(explanationStep("idea").copy(image = picture), summaryStep("end")), pictures = loadingPictures())

        assertTrue("the picture leads the screen", described(picture.alt).bottom < text("Title idea").top)
    }

    /** A sentence half built isn't the player's answer yet, only the screen's own state: opening or closing the book keeps it. */
    @Test
    @Config(qualifiers = BOOK)
    fun wordsPlacedStayPlacedAsTheBookOpensAndCloses() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(reading("read"), summaryStep("end")), restoration = restoration)
        rule
            .onAllNodesWithText("gato.")
            .onFirst()
            .performClick()

        unfold()
        assertAfterFold("the placed word", described(PLACED))

        // Android recreates the screen as the book folds; window-testing tells the new one of no fold, so it's one column.
        restoration.emulateSavedInstanceStateRestore()
        assertTrue("the placed word is in the one column", described(PLACED).left < FOLD)

        unfold()
        assertAfterFold("the placed word", described(PLACED))
    }

    /** Folding or unfolding recreates the screen: a learner who scrolled down to the options stays there. */
    @Test
    @Config(qualifiers = SHORT_PHONE)
    fun theScrollStaysWhereTheLearnerLeftItWhenTheScreenIsRecreated() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(checkStep("quiz"), summaryStep("end")), restoration = restoration)
        rule.onNodeWithText("Wrong").performScrollTo()
        val scrolled = text("Question quiz?").top

        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()

        assertEquals("the question stays scrolled", scrolled.value, text("Question quiz?").top.value, 0.5f)
    }

    private companion object {
        /** A phone so short the question and its options scroll. */
        const val SHORT_PHONE = "w411dp-h300dp"

        /** A Pixel 10 Pro Fold's inner display, whose fold runs down its middle. */
        const val BOOK = "w852dp-h883dp"
        const val PHONE = "w411dp-h891dp"
        val FOLD: Dp = 426.dp
        const val PLACED = "Position 1: gato."
    }
}

/** Pictures that stay loading, so each shows as the frame it fills. */
internal fun loadingPictures(): PrivatePictures {
    val loader =
        ImageLoader
            .Builder(ApplicationProvider.getApplicationContext<Context>())
            .components {
                add(
                    object : Interceptor {
                        override suspend fun intercept(chain: Interceptor.Chain): ImageResult = awaitCancellation()
                    },
                )
            }.build()
    return PrivatePictures(PrivateImages("https://api.zoonk.test/v1/".toHttpUrl(), loader), null)
}
