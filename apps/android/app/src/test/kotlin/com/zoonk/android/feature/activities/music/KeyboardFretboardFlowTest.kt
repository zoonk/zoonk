package com.zoonk.android.feature.activities.music

import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepAnswer
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's music player tests for the keyboard and fretboard, played in the real player. */
@RunWith(AndroidJUnit4::class)
class KeyboardFretboardFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun play(
        fixture: String,
        isCorrect: Boolean,
    ) = harness.play(listOf(ActivityFixtures.step(fixture))) {
        grade = { _, _ -> checkResult(isCorrect, expected = ActivityFixtures.expected(fixture)) }
    }

    private fun key(name: String) = rule.onNode(hasContentDescription(name) and hasAnyAncestor(hasContentDescription("Piano keys")))

    private fun shows(text: String) = rule.onNodeWithText(text).performScrollTo().assertIsDisplayed()

    private fun sentNotes(): String =
        ApiJson.encodeToString(
            LessonStepAnswer.serializer(),
            harness.api.checks
                .single()
                .second.answer,
        )

    @Test
    fun changingOneNoteTurnsCMajorIntoCMinor() {
        play("keyboardFretboard", isCorrect = true)

        shows("C minor")
        key("E").assertIsOn()
        shows("Same chord on guitar")
        key("E").performScrollTo().performClick()
        key("E flat").performScrollTo().performClick()
        harness.tap("Check")

        shows("Correct!")
        shows("C, E♭, G")
        assertTrue(sentNotes(), """"notes":["C4","D#4","G4"]""" in sentNotes())
    }

    @Test
    fun addingANoteWithoutTakingOneAwayIsntMinor() {
        play("keyboardFretboard", isCorrect = false)

        key("E flat").performScrollTo().performClick()
        rule.onNode(hasContentDescription("On the keys: C, E flat, E, G")).assertExists()
        harness.tap("Check")

        shows("Not quite")
    }

    @Test
    fun aCheckedKeyboardStillSaysWhichKeysWerePressed() {
        play("keyboardFretboard", isCorrect = false)

        key("E flat").performScrollTo().performClick()
        harness.tap("Check")

        shows("Not quite")
        rule.onNode(hasContentDescription("A piano keyboard from C to B. Pressed: C, E flat, E, G.")).assertExists()
    }

    @Test
    fun byEarTheSoundIsNotNamedUntilItsNotesAreFound() {
        play("keyboardFretboard.byEar", isCorrect = true)

        shows("By ear")
        rule.onNodeWithText("2 notes").assertDoesNotExist()
        key("C").assertIsOff()
        harness.tap("Play the sound")
        key("C").performScrollTo().performClick()
        key("G").performScrollTo().performClick()
        harness.tap("Check")

        shows("Correct!")
        shows("2 notes")
    }

    @Test
    fun aLearnerWhoCantListenReadsTheNotesInstead() {
        play("keyboardFretboard.byEar", isCorrect = true)

        rule.onNodeWithText("Can't listen? Show the notes").performScrollTo().performClick()

        shows("The sound plays: C, G")
    }

    @Test
    fun byEarNamingAChordWrongShowsTheChordThatPlayed() {
        play("keyboardFretboard.byEarChoice", isCorrect = false)

        harness.tap("Play the sound")
        rule.onNodeWithText("A major chord").performScrollTo().performClick()
        harness.tap("Check")

        shows("Not quite")
        shows("A minor")
        rule.onNode(hasContentDescription("On the keys: C, E, A")).assertExists()
    }

    @Test
    fun aGuitarChordIsPlayedOneStringAtATime() {
        harness.play(listOf(guitarChord)) { grade = { _, _ -> checkResult(true) } }

        pickFret("Fret 3, G", string = "Low E string")
        pickFret("Fret 2, B", string = "A string")
        pickFret("Open, D", string = "D string")
        pickFret("Open, G", string = "G string")
        pickFret("Open, B", string = "B string")
        pickFret("Fret 3, G", string = "High E string")
        harness.tap("Check")

        shows("Correct!")
        assertTrue(sentNotes(), """"notes":["G2","B2","D3","G3","B3","G4"]""" in sentNotes())
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun theKeysArePlayedWithAKeyboardOnly() {
        play("keyboardFretboard", isCorrect = true)

        rule.onRoot().performKeyInput { pressKey(Key.ShiftLeft) }
        key("C").requestFocus()
        rule.onRoot().performKeyInput { repeat(4) { pressKey(Key.DirectionRight) } }
        key("E").assertIsFocused()
        rule.onRoot().performKeyInput {
            pressKey(Key.Enter)
            pressKey(Key.DirectionLeft)
            pressKey(Key.Enter)
        }
        harness.tap("Check")

        shows("Correct!")
        assertTrue(sentNotes(), """"notes":["C4","D#4","G4"]""" in sentNotes())
    }

    private fun pickFret(
        position: String,
        string: String,
    ) = rule
        .onNode(hasContentDescription(position) and hasAnyAncestor(hasContentDescription(string)))
        .performScrollTo()
        .performClick()

    private val guitarChord =
        activityStep(
            """
            {"check":{"explanation":"G major is G, B and D.","kind":"interaction"},
             "fields":{"instruments":["guitar"],"target":{"kind":"chord","quality":"major","root":"G"}},
             "prompt":"Play a G major chord.","template":"keyboardFretboard"}
            """,
        )
}
