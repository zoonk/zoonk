package com.zoonk.android.feature.buddy

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.text.AnnotatedString
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.tutor.TutorAccess
import com.zoonk.android.feature.tutor.TutorThread
import com.zoonk.android.feature.tutor.TutorThreadKey
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.BuddyStatus
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BuddyPageTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aQuestionFromSearchFillsTheComposerOnceNotEachTimeTheTabComesBack() {
        var shown by mutableStateOf(true)
        compose.setContent {
            val tab = rememberSaveableStateHolder()
            if (shown) tab.SaveableStateProvider(GOAL) { Page() }
        }
        val composer = compose.onNode(hasSetTextAction())
        composer.assert(hasDraft(ASK))

        composer.performTextClearance()
        shown = false
        compose.waitForIdle()
        shown = true
        compose.waitForIdle()

        compose.onNode(hasSetTextAction()).assert(hasDraft(""))
    }

    @Test
    fun anUnsentQuestionFromSearchIsBackAfterAndroidEndsTheApp() {
        val restoration = StateRestorationTester(compose)
        var process by mutableStateOf(process())
        restoration.setContent { CompositionLocalProvider(LocalViewModelStoreOwner provides process) { Page() } }
        compose.onNode(hasSetTextAction()).assert(hasDraft(ASK))

        process = process()
        restoration.emulateSavedInstanceStateRestore()

        compose.onNode(hasSetTextAction()).assert(hasDraft(ASK))
    }

    @Composable
    private fun Page() {
        val context = LocalContext.current
        val app =
            remember {
                AppContainer.preview(context).apply {
                    learnerSummary.summary.replace(learnerSummary())
                    tutor.threads[TutorThreadKey.Plan(GOAL)].replace(TutorThread(emptyList(), hasMore = false, nextCursor = null))
                }
            }
        val navigator = rememberAppNavigator()
        ZoonkTheme { BuddyPage(STATUS, GOAL, ask = ASK, app, navigator, access = TutorAccess.Ask) }
    }

    private fun process() =
        object : ViewModelStoreOwner {
            override val viewModelStore = ViewModelStore()
        }

    private fun hasDraft(text: String) = SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(text))

    private companion object {
        const val GOAL = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val ASK = "Energia nas cadeias"

        val STATUS: BuddyStatus by lazy {
            ApiJson.decodeFromString(
                """
                {"belt":{"bpPerLevel":100,"bpToNextLevel":40,"color":"white","isMaxLevel":false,"level":2,"progressInLevel":60,"totalBrainPower":160},
                 "buddy":{"glasses":"round","kind":"zu","name":null,"picked":true},
                 "energy":{"current":64,"state":"awake","studiedToday":false},
                 "firstSteps":null,
                 "glasses":[{"current":1,"earned":true,"glasses":"round","target":1}],
                 "nextStage":{"belt":"yellow","brainPowerToGo":240,"stage":"young"},
                 "stage":"baby",
                 "thisWeek":{"fixes":0,"newIdeas":3,"reviews":1},
                 "today":null}
                """.trimIndent(),
            )
        }
    }
}
