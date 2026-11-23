package com.zoonk.android.feature.session

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockWritingAvailability
import com.zoonk.api.models.StudyBlockWritingAvailabilityOneOf
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en")
class WritingBlockDetailTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun writingRowUsesSavedDraftField() {
        val continuing =
            decodeFixture<StudyBlock>("study-block").copy(
                canDo = null,
                kind = StudyBlock.Kind.PRODUCE,
                writingAvailability =
                    StudyBlockWritingAvailability.StudyBlockWritingAvailabilityOneOfValue(
                        StudyBlockWritingAvailabilityOneOf(status = StudyBlockWritingAvailabilityOneOf.Status.CONTINUE),
                    ),
            )
        val blocks =
            listOf(
                continuing,
                continuing.copy(hasWritingDraft = false),
                continuing.copy(hasWritingDraft = true),
                continuing.copy(hasWritingDraft = true, writingAvailability = null),
            )
        var lines = emptyList<String?>()

        rule.setContent { lines = blocks.map { blockDetail(it.toDayStep()) } }
        rule.waitForIdle()
        assertEquals(listOf(null, null, "Your draft is saved", "Your draft is saved"), lines)
    }
}
