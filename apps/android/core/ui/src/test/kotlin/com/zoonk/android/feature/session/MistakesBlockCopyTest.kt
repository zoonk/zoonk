package com.zoonk.android.feature.session

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.StudyBlock
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en")
class MistakesBlockCopyTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val mistakes =
        decodeFixture<StudyBlock>("study-block").copy(
            kind = StudyBlock.Kind.PRACTICE,
            screen = StudyBlock.Screen.MISTAKES_PRACTICE,
            questions = 3,
        )

    @Test
    fun aRowWithNothingLeftToFixSaysItIsAlreadyFixedAndNothingElse() {
        val copy = copyOf(mistakes.copy(questions = 0))

        assertEquals("Already fixed" to null, copy)
    }

    @Test
    fun aRowWithMistakesLeftCountsThem() {
        assertEquals("Fix 3 mistakes" to "Questions you missed before", copyOf(mistakes))
    }

    @Test
    fun aFinishedRowKeepsWhatItRecorded() {
        val done = mistakes.copy(questions = 0, status = StudyBlock.Status.COMPLETED)

        assertEquals("Fix 0 mistakes" to "Questions you missed before", copyOf(done))
    }

    private fun copyOf(block: StudyBlock): Pair<String, String?> {
        var copy: Pair<String, String?> = "" to null
        rule.setContent {
            val step = block.toDayStep()
            copy = blockTitle(step) to blockDetail(step)
        }
        rule.waitForIdle()
        return copy
    }
}
