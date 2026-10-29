package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.SkillOutline
import com.zoonk.api.models.SkillOutlineChapter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h900dp")
class FarTopicSheetTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val api = FakePlanApi()
    private val store =
        PlanStore(
            api,
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            ),
        )
    private val topics = FarTopicViewModel(store, UUID.fromString(GOAL))
    private val flask = FarTopic(UUID.fromString(FAR_SKILL), "Flask", lessons = 6, nextDate = LocalDate(2026, 12, 21))
    private val opened = mutableListOf<UUID>()

    private fun show() {
        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme { FarTopicSheet(topics, navigator) { opened += it } }
        }
        compose.runOnIdle { topics.open(flask) }
    }

    @Test
    fun seeTheLessonsWritesThemOnTheLearnersTap() {
        show()

        compose.onNodeWithText("Flask").assertIsDisplayed()
        assertEquals(emptyList<UUID>(), api.outlineWrites)
        compose.onNodeWithText("See the lessons").performClick()

        compose.onNodeWithText("Preparing the lessons… It takes about half a minute.").assertIsDisplayed()
        assertEquals(listOf(flask.skillId), api.outlineWrites)
    }

    @Test
    fun aWrittenTopicOpensItsChaptersAndCloses() {
        val chapter = UUID.fromString(CHAPTER_LATER)
        api.outline = { SkillOutline(listOf(SkillOutlineChapter(chapter, "Routes and views")), SkillOutline.Status.READY) }
        show()

        compose.onNodeWithText("Routes and views").performClick()

        compose.runOnIdle {
            assertEquals(listOf(chapter), opened)
            assertNull(topics.sheet.value)
        }
    }
}
