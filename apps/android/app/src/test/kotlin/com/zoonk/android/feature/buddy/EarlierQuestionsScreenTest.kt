package com.zoonk.android.feature.buddy

import androidx.activity.ComponentActivity
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.EarlierQuestions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class EarlierQuestionsScreenTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val api = FakeEarlierQuestionsApi()

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = EarlierQuestionsStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main)), session)

        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            ZoonkTheme { EarlierQuestionsScreen(app, rememberAppNavigator(), store) }
        }
    }

    @Test
    fun eachQuestionSaysWhereItWasAskedWithItsAnswerAndOlderOnesFollow() {
        api.first =
            api.first.copy(
                questions = listOf(earlierQuestion(1), earlierQuestion(2, answer = null, courseTitle = null, lessonTitle = null)),
            )
        show()

        compose.onNodeWithText("From an earlier version of Atoms · Bonds").assertExists()
        compose.onNodeWithText("Question 1").assertExists()
        compose.onNodeWithText("Answer 1").assertExists()
        compose.onNodeWithText("From an earlier version of this course").assertExists()
        compose.onNodeWithText("No answer was saved.").assertExists()

        compose.onNodeWithText("Older questions").performScrollTo().performClick()

        compose.onNodeWithText("Question 4").performScrollTo().assertExists()
        compose.onNodeWithText("Older questions").assertDoesNotExist()
    }

    @Test
    fun aLearnerWithoutEarlierQuestionsIsToldSo() {
        api.first = EarlierQuestions(nextCursor = null, questions = emptyList())
        show()

        compose.onNodeWithText("You have no earlier questions.").assertExists()
    }
}
