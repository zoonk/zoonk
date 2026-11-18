package com.zoonk.android.feature.settings

import android.content.pm.ActivityInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.profile.ProfileQuestionsApi
import com.zoonk.android.feature.profile.ProfileQuestionsStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewSaved
import com.zoonk.api.models.ProfileQuestions
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class ProfileQuestionWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    @Test
    fun aSavedAnswerGoesBackOnceWhileTheRecreatedScreenRereadsQuestions() = savedBetweenWindows(false)

    @Test
    fun aSavedAnswerGoesBackOnceEvenIfTheRecreatedScreensReadFails() = savedBetweenWindows(true)

    private fun savedBetweenWindows(failRead: Boolean) {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = ProfileQuestionTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val save = CompletableDeferred<Unit>()
        val refresh = CompletableDeferred<Unit>()
        val question =
            ProfileQuestionView(
                ProfileQuestion.TOOLS,
                emptyList(),
                ProfileQuestionViewSaved(emptyList(), emptyList(), "Python"),
                ProfileQuestionView.Status.ANSWERED,
                1,
            )
        var reads = 0
        val api =
            object : ProfileQuestionsApi {
                override suspend fun questions(session: AuthenticatedSession): ProfileQuestions {
                    reads++
                    if (reads > 1) {
                        refresh.await()
                        if (failRead) throw ApiException(ApiError.Network)
                    }
                    return ProfileQuestions(true, listOf(question))
                }

                override suspend fun answer(
                    session: AuthenticatedSession,
                    input: ProfileAnswerInput,
                ): ProfileQuestionView {
                    save.await()
                    return question
                }
            }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        ProfileQuestionWindow.store = ProfileQuestionsStore(api, AppCache(session, scope))
        ProfileQuestionWindow.app = AppContainer.preview(application)
        val scenario = ActivityScenario.launch(ProfileQuestionTestActivity::class.java)
        try {
            scenario.onActivity { it.compose() }
            rule.onNodeWithText("Save").performClick()
            rule.waitForIdle()
            lateinit var model: ProfileQuestionViewModel
            scenario.onActivity { model = ViewModelProvider(it)[ProfileQuestion.TOOLS.value, ProfileQuestionViewModel::class.java] }
            val visit = model.visit.number
            RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
            scenario.recreate()
            save.complete(Unit)
            shadowOf(android.os.Looper.getMainLooper()).idle()
            assertEquals(Unit, model.answered.value)
            assertEquals(visit, model.visit.number)
            if (failRead) {
                refresh.complete(Unit)
            }
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            if (failRead) {
                rule.waitUntil { ProfileQuestionWindow.store.questions.freshState.value is LoadState.Failed }
            } else {
                assertFalse(refresh.isCompleted)
            }
            assertEquals(AppRoute.AboutYou, ProfileQuestionWindow.navigator.currentRoute)
            assertNull(model.answered.value)
            assertFalse(model.failed)
            rule.onNodeWithText("This page didn't load").assertDoesNotExist()
            RuntimeEnvironment.setQualifiers("w411dp-h891dp")
            scenario.recreate()
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            assertEquals(AppRoute.AboutYou, ProfileQuestionWindow.navigator.currentRoute)
            assertTrue(reads >= 2)
        } finally {
            scenario.close()
            scope.cancel()
        }
    }
}

object ProfileQuestionWindow {
    lateinit var app: AppContainer
    lateinit var store: ProfileQuestionsStore
    lateinit var navigator: AppNavigator
}

class ProfileQuestionTestActivity : ComponentActivity() {
    fun compose() {
        setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                ProfileQuestionWindow.navigator = navigator
                androidx.compose.runtime.LaunchedEffect(Unit) {
                    if (navigator.currentRoute == AppRoute.Today) {
                        navigator.open(AppRoute.AboutYou)
                        navigator.open(AppRoute.ProfileQuestionEdit(ProfileQuestion.TOOLS.value))
                    }
                }
                if (navigator.currentRoute is AppRoute.ProfileQuestionEdit) {
                    ProfileQuestionScreen(ProfileQuestion.TOOLS.value, ProfileQuestionWindow.app, navigator, ProfileQuestionWindow.store)
                }
            }
        }
    }
}
