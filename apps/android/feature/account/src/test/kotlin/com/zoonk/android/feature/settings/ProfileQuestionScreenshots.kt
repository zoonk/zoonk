package com.zoonk.android.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.profile.ProfileQuestionsApi
import com.zoonk.android.feature.profile.ProfileQuestionsStore
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewOptionsInner
import com.zoonk.api.models.ProfileQuestionViewSaved
import com.zoonk.api.models.ProfileQuestionViewSavedStudiesInner
import com.zoonk.api.models.ProfileQuestions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of Settings › About you and its chip questions, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ProfileQuestionScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("expanded")

    private fun options(vararg labels: Pair<String, String>) =
        labels.map { (id, label) -> ProfileQuestionViewOptionsInner(null, id, label) }

    private val general =
        options(
            "canva" to "Canva",
            "excel" to "Excel",
            "figma" to "Figma",
            "googleSheets" to "Google Sheets",
            "notion" to "Notion",
            "powerPoint" to "PowerPoint",
            "vsCode" to "VS Code",
            "word" to "Word",
        )

    private val written =
        options(
            "Tasy" to "Tasy",
            "MV Soul" to "MV Soul",
            "Whitebook" to "Whitebook",
            "UpToDate" to "UpToDate",
            "Medscape" to "Medscape",
            "WhatsApp" to "WhatsApp",
            "Google Drive" to "Google Drive",
            "Excel" to "Excel",
        )

    private val watch =
        options(
            "anime" to "Anime",
            "sciFi" to "Sci-fi",
            "documentaries" to "Documentaries",
            "sports" to "Sports",
            "comedy" to "Comedy",
            "drama" to "Drama",
            "news" to "News",
        )

    private val studies =
        options(
            "computing" to "Computing",
            "business" to "Business",
            "health" to "Health",
            "engineering" to "Engineering",
            "media" to "Media",
            "humanities" to "Humanities",
            "other" to "Other",
        )

    private fun question(
        id: ProfileQuestion,
        options: List<ProfileQuestionViewOptionsInner>,
        picks: List<String> = emptyList(),
        text: String = "",
        studies: List<ProfileQuestionViewSavedStudiesInner> = emptyList(),
    ) = ProfileQuestionView(
        id,
        options,
        ProfileQuestionViewSaved(picks, studies, text),
        ProfileQuestionView.Status.ANSWERED.takeIf { picks.isNotEmpty() || text.isNotEmpty() || studies.isNotEmpty() },
        1,
    )

    private fun capture(
        suffix: String,
        dark: Boolean = false,
    ) {
        val pages =
            linkedMapOf(
                "tools-general" to question(ProfileQuestion.TOOLS, general, listOf("excel", "notion"), "Python, SAP"),
                "tools-written" to question(ProfileQuestion.TOOLS, written, listOf("Tasy", "Whitebook"), "ClinicalKey"),
                "tools-empty" to question(ProfileQuestion.TOOLS, written),
                "watch" to question(ProfileQuestion.WATCH, watch, listOf("anime", "sciFi", "sports"), "Star Trek"),
                "studies" to
                    question(
                        ProfileQuestion.STUDIES,
                        studies,
                        studies = listOf(ProfileQuestionViewSavedStudiesInner("health", "Nursing")),
                    ),
            )
        val all =
            ProfileQuestions(
                true,
                listOf(
                    question(ProfileQuestion.WORK, options("work" to "Working"), listOf("work"), "Nurse"),
                    pages.getValue("tools-written"),
                    pages.getValue("studies"),
                    pages.getValue("watch"),
                ) +
                    listOf(
                        ProfileQuestion.LISTEN,
                        ProfileQuestion.PLAY,
                        ProfileQuestion.READ,
                        ProfileQuestion.ACTIVITIES,
                        ProfileQuestion.ADDRESS_FORM,
                        ProfileQuestion.CONDITIONS,
                        ProfileQuestion.LEARNING_SUPPORT,
                    ).map { question(it, emptyList()) },
            )
        var shown by mutableStateOf<String?>(null)
        val app = AppContainer.preview(RuntimeEnvironment.getApplication())

        fun store(view: ProfileQuestions) =
            ProfileQuestionsStore(
                object : ProfileQuestionsApi {
                    override suspend fun questions(session: AuthenticatedSession) = view

                    override suspend fun answer(
                        session: AuthenticatedSession,
                        input: ProfileAnswerInput,
                    ) = view.questions.first()
                },
                AppCache(
                    FakeSession(AuthenticatedSession("ana", "token", "local")),
                    CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                ),
            )
        val stores = pages.mapValues { (_, page) -> store(ProfileQuestions(true, listOf(page))) }
        val list = store(all)

        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark) {
                when (val name = shown) {
                    null -> AboutYouScreen(app, navigator, list)
                    else -> ProfileQuestionScreen(pages.getValue(name).id.value, app, navigator, stores.getValue(name))
                }
            }
        }
        compose.waitForIdle()
        write("about-you-$suffix")
        pages.keys.forEach { name ->
            shown = name
            compose.waitForIdle()
            write("$name-$suffix")
        }

        shown = "watch"
        compose.waitForIdle()
        compose.onNodeWithText("Comedy").performClick()
        compose.waitForIdle()
        write("watch-four-picks-$suffix")

        shown = "tools-written"
        compose.waitForIdle()
        compose.onNode(hasSetTextAction()).performTextInput("Notion, whitebook, ")
        compose.waitForIdle()
        write("tools-written-typed-$suffix")
        compose.onNode(hasSetTextAction()).performTextInput("tasy")
        compose.waitForIdle()
        write("tools-written-pending-$suffix")
        compose.onNodeWithContentDescription("Remove Notion").performClick()
        compose.waitForIdle()
        write("tools-written-removed-$suffix")
    }

    private fun write(name: String) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
    }
}
