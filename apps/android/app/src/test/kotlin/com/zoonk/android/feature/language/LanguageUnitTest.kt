package com.zoonk.android.feature.language

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageUnit
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class LanguageUnitTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val requests = mutableListOf<CallRequest>()
    private val opened = mutableListOf<AppRoute>()

    private fun show(
        unit: LanguageUnit = languageUnit(),
        upNext: Boolean = true,
    ) {
        val actions =
            UnitActions(
                open = { opened += it },
                start = {
                    requests += it
                    CallStart.Started(STARTED)
                },
            )
        compose.setContent { ZoonkTheme { UnitPage(unit, upNext, actions) } }
    }

    /** The page is a lazy list: what's out of view isn't there until scrolled to. */
    private fun seen(text: String) {
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun theHeroSaysWhereTheUnitStandsAndContinuesItsNextLesson() {
        show()

        compose.onNodeWithText("Unit 3 · A1–A2").assertIsDisplayed()
        compose.onNodeWithText("3 lessons · 30 min · 33% done").assertIsDisplayed()
        compose.onNodeWithText("Continue").performClick()

        assertEquals(listOf<AppRoute>(AppRoute.Lesson(NEXT_LESSON.toString())), opened)
    }

    @Test
    fun aUnitNotStartedSaysStart() {
        show(languageUnit(firstDone = false))

        compose.onNodeWithText("Start").assertIsDisplayed()
    }

    @Test
    fun theNextLessonIsMarkedOnlyWhenTheUnitIsThePlansCurrentOne() {
        show(upNext = false)
        seen("Order a coffee")

        compose.onNodeWithContentDescription("Up next").assertDoesNotExist()
        compose.onNodeWithText("Order a coffee").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Lesson(NEXT_LESSON.toString())), opened)
    }

    @Test
    fun theNextLessonIsUpNextInTheCurrentUnit() {
        show()
        seen("Order a coffee")

        compose.onNodeWithContentDescription("Up next").assertExists()
        compose.onNodeWithContentDescription("Done").assertExists()
    }

    @Test
    fun aFinishedUnitSaysWhatTheLearnerCanAlreadyDo() {
        show(languageUnit(firstDone = true, allDone = true))
        seen("Order food and drinks")

        compose.onNodeWithText("I can already…").assertExists()
    }

    @Test
    fun thePracticeCallStartsFromItsSheet() {
        show()
        seen("Practice a conversation")

        compose.onNodeWithText("Practice a conversation").performClick()
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.Practice(CHAPTER, GOAL, 3)), requests)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(STARTED.toString())), opened)
    }

    @Test
    fun theTestOutAndTheLanguageRowsOpenTheirPages() {
        show()
        seen("Say 2 words again")

        compose.onNodeWithText("Already know this?").performClick()
        compose.onNodeWithText("We noticed a pattern").performClick()
        compose.onNodeWithText("Say 2 words again").performClick()

        assertEquals(
            listOf(AppRoute.TestOut(CHAPTER.toString()), AppRoute.Pattern(PATTERN.toString()), AppRoute.Pronunciation(GOAL.toString())),
            opened,
        )
    }

    @Test
    fun theMistakesOpenToWhatWasAnsweredAndWhatWasRight() {
        show()
        seen("Your mistakes")

        compose.onNodeWithText("Your mistakes").performClick()
        seen("café con leche")

        compose.onNodeWithText("Listening").assertExists()
        compose.onNodeWithText("café con leche").assertExists()
        compose.onNodeWithText("café solo").assertExists()
    }

    @Test
    fun theWordsShowAFewAndHowManyMore() {
        show()
        seen("Words in this unit")

        compose.onNodeWithText("Words in this unit").performClick()
        seen("hola · gracias and 10 more")
    }

    /** A Fold opening or a tablet turning moves practice and reference between the aside and the page. */
    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun whatsOpenStaysOpenWhenTheAsideMovesBelow() {
        var wide by mutableStateOf(true)
        val actions = UnitActions(open = {}, start = { CallStart.Started(STARTED) })
        compose.setContent {
            ZoonkTheme { Box(Modifier.width(if (wide) 1280.dp else 480.dp)) { UnitPage(languageUnit(), upNext = true, actions = actions) } }
        }
        compose.onNodeWithText("Grammar tips").performClick()
        compose.onNodeWithText("Practice a conversation").performClick()

        wide = false
        compose.waitForIdle()

        compose.onNodeWithText("Start the call").assertExists()
        seen("Use quisiera to ask politely.")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aWideWindowShowsProgressAndPracticeBeside() {
        show()

        compose.onNodeWithText("Progress").assertIsDisplayed()
        compose.onNodeWithText("Practice a conversation").assertIsDisplayed()
    }
}

private val CHAPTER = UUID.fromString("00000000-0000-4000-8000-0000000000e1")
private val GOAL = UUID.fromString("00000000-0000-4000-8000-0000000000e2")
private val NEXT_LESSON = UUID.fromString("00000000-0000-4000-8000-0000000000e4")
private val PATTERN = UUID.fromString("00000000-0000-4000-8000-0000000000e6")
private val STARTED = UUID.fromString("00000000-0000-4000-8000-0000000000e7")

internal fun languageUnit(
    firstDone: Boolean = true,
    allDone: Boolean = false,
): LanguageUnit {
    fun lesson(
        id: String,
        title: String,
        done: Boolean,
        state: String,
    ) = """{"done":$done,"lessonId":"$id","minutes":10,"state":"$state","title":"$title","written":true}"""

    val lessons =
        listOf(
            lesson("00000000-0000-4000-8000-0000000000e3", "Greet the waiter", firstDone, if (firstDone) "done" else "next"),
            lesson(
                "$NEXT_LESSON",
                "Order a coffee",
                allDone,
                if (allDone) {
                    "done"
                } else if (firstDone) {
                    "next"
                } else {
                    "upcoming"
                },
            ),
            lesson("00000000-0000-4000-8000-0000000000e5", "Pay the bill", allDone, if (allDone) "done" else "upcoming"),
        ).joinToString(",")

    return ApiJson.decodeFromString(
        """
        {"canTestOut":true,
         "conversation":{"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":null,"minutes":[1,2,3],"paused":false,"plusMinutes":[5]},
         "goalId":"$GOAL",
         "grammarTips":[{"title":"Querer and quisiera","text":"Use quisiera to ask politely."}],
         "lessons":[$lessons],
         "mistakes":[{"answer":"café solo","correctAnswer":"café con leche","explanation":null,"id":"00000000-0000-4000-8000-0000000000e8",
           "question":"What did she order?","skill":"listening"}],
         "pattern":{"id":"$PATTERN","kind":"pattern","title":"Ser and estar"},
         "pronunciation":{"count":2,"words":["leche","cuenta"]},
         "summaries":[{"ideas":["Quisiera asks politely."],"lessonId":"00000000-0000-4000-8000-0000000000e3","title":"Greet the waiter"}],
         "unit":{"chapterId":"$CHAPTER","description":"At a café","levelRange":"A1–A2","objectives":["Order food and drinks"],"position":3,"title":"At the café"},
         "words":{"count":12,"sample":["hola","gracias"]}}
        """.trimIndent(),
    )
}
