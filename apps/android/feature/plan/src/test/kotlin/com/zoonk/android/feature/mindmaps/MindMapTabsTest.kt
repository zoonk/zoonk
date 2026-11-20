package com.zoonk.android.feature.mindmaps

import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isHeading
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Each tab counts what it lists: "Chapter maps" its ready maps, Saved every saved map it shows. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MindMapTabsTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    private fun show(tab: StudyTab = StudyTab.Chapters) {
        val saved =
            listOf(
                savedJson("chapter", mapChapter(1), "Motion and forces", chapter = 1),
                savedJson("chapter", mapChapter(30), "Thermodynamics", chapter = null, available = false),
            )
        compose.setContent {
            ZoonkTheme {
                MindMapsPage(goalMindMaps(saved = saved), MindMapsState(), MindMapsActions({}, {}, {}), initialTab = tab)
            }
        }
    }

    @Test fun theWithAMapTabCountsOnlyTheChaptersWhoseMapIsReady() {
        show()

        compose.onNodeWithContentDescription("Chapter maps, 2 maps").assertExists()
    }

    @Test fun withoutAMapIsAHeadingForScreenReaders() {
        show()

        compose.onNode(hasText("No map yet") and isHeading()).assertExists()
    }

    @Test fun theSavedTabCountsEverySavedMapItLists() {
        show(StudyTab.Saved)

        compose.onNodeWithText("Thermodynamics").assertExists()
        compose.onNodeWithContentDescription("Saved, 2 maps").assertExists()
    }
}
