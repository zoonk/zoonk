package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.StepState
import com.zoonk.android.data.StepTimes
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.catalog.CHAPTER_ONE
import com.zoonk.android.feature.catalog.COURSE
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.FakeCatalogApi
import com.zoonk.android.feature.onboarding.course.CourseStartScreen
import com.zoonk.android.feature.onboarding.noAllowance
import com.zoonk.android.feature.onboarding.setup.GoalSetupScreen
import com.zoonk.android.feature.onboarding.setup.LocalSetupSpeech
import com.zoonk.android.feature.onboarding.setup.PlanRevealStep
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.start.AttachPanel
import com.zoonk.android.feature.onboarding.start.MaterialAnswer
import com.zoonk.android.feature.onboarding.start.MaterialIntent
import com.zoonk.android.feature.onboarding.start.StartGoalScreen
import com.zoonk.android.feature.onboarding.start.StartGoalViewModel
import com.zoonk.android.feature.placementtest.PlacementSetup
import com.zoonk.android.feature.placementtest.PlacementSetupEnd
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.planlink.PlanLinkScreen
import com.zoonk.android.feature.research.SourceChangeNotice
import com.zoonk.android.feature.research.UploadRequestNotice
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.pageMargin
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOfResult
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.SourceReadStatus
import com.zoonk.api.models.TodayUploadRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.putJsonArray
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.util.ReflectionHelpers
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.Locale
import java.util.UUID

/**
 * Review screenshots of the start flow and goal setup, written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*OnboardingScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OnboardingScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneScreen() = capture("phone-screen")

    @Test
    @Config(qualifiers = "w448dp-h997dp-xxhdpi")
    fun largePhoneScreen() = capture("large-phone-screen")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    /** Questions still being written wait for the learner's Start, so it's tapped first. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun placementWaiting() {
        val api =
            FakeOnboardingApi().apply {
                placement = placementOf(status = "done", next = null)
                sitting = { placementOf(status = "waitingForQuestions", next = null).copy(attempt = QUICK_ATTEMPT) }
            }
        compose.setContent { ZoonkTheme { Surface { Placement(api) } } }
        compose.onNodeWithText("Start").performClick()
        compose.waitForIdle()
        write("placement-waiting-phone-screen", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** The questions of a new language pair wait for the learner's Start, so it's tapped first. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun levelTestWaiting() = captureLevelTestWaiting("phone-screen")

    /** The card names the draft's material; back on the entry, five sources leave the paperclip off. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialFull() {
        val sources =
            listOf("Cell cycle.pdf", "Mitosis slides.pptx", "", "Chapter 12: Meiosis", "Lab notes")
                .map { draftSource(it) }
        val api =
            FakeOnboardingApi().apply {
                draft =
                    understoodDraft(prompt = "test on Friday").copy(
                        materialIntent = OnboardingDraft.MaterialIntent.EXAM,
                        sources = sources,
                    )
            }
        compose.setContent { ZoonkTheme { Surface { Start(api, AppRoute.StartGoal(draftId = DRAFT_ID)) } } }
        compose.waitForIdle()
        write("understood-material-phone-screen", compose.onRoot().captureRender().asAndroidBitmap())
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        write("start-material-full-phone-screen", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** A class test has no exam notice, so the card asks for its date when the learner knows it. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun classTest() {
        val api =
            FakeOnboardingApi().apply {
                draft = understoodDraft(prompt = "biology test next week", understanding = goalsUnderstanding(title = "Biology test"))
            }
        compose.setContent { ZoonkTheme { Surface { Start(api, AppRoute.StartGoal(draftId = DRAFT_ID)) } } }
        compose.waitForIdle()
        write("understood-class-test-phone-screen", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** The card says when some of the goal's material can't be read anymore, with what's left of it or with none. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialMissing() = captureMaterialMissing(listOf("Mitosis slides.pptx"), "understood-material-missing-phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialAllMissing() = captureMaterialMissing(emptyList(), "understood-material-missing-all-phone-screen")

    /** Material that can't be read anymore sends the learner back to their start, with what to add again marked. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialUnreadable() = captureUnreadable(1, "start-material-unreadable-phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialSeveralUnreadable() = captureUnreadable(2, "start-material-unreadable-several-phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialUnreadableDarkMoreContrast() =
        captureUnreadable(1, "start-material-unreadable-phone-screen-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialUnreadableAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureUnreadable(1, "start-material-unreadable-phone-font200")
    }

    private fun captureMaterialMissing(
        titles: List<String>,
        name: String,
    ) {
        val api =
            FakeOnboardingApi().apply {
                draft =
                    understoodDraft(prompt = "test on Friday").copy(
                        materialIntent = OnboardingDraft.MaterialIntent.EXAM,
                        materialMissing = true,
                        sources = titles.map { draftSource(it) },
                    )
            }
        compose.setContent { ZoonkTheme { Surface { Start(api, AppRoute.StartGoal(draftId = DRAFT_ID)) } } }
        compose.waitForIdle()
        write(name, compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun captureUnreadable(
        unreadable: Int,
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val sources =
            listOf("Cell cycle notes.pdf", "Mitosis slides.pptx", "Chapter 12: Meiosis")
                .map { draftSource(it) }
        val api =
            FakeOnboardingApi().apply {
                draft =
                    understoodDraft(prompt = "test on Friday").copy(
                        materialIntent = OnboardingDraft.MaterialIntent.EXAM,
                        sources = sources,
                    )
            }
        lateinit var focus: FocusManager
        compose.setContent {
            focus = LocalFocusManager.current
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) { Surface { Start(api, AppRoute.StartGoal(draftId = DRAFT_ID)) } }
        }
        compose.waitForIdle()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        api.refusal =
            ApiException(
                ApiError.Unavailable,
                "MATERIAL_UNAVAILABLE",
                status = 422,
                details = buildJsonObject { putJsonArray("sourceIds") { sources.take(unreadable).forEach { add(it.id.toString()) } } },
            )
        // Sent from the keyboard and the box left, as a tap on Build my plan leaves its press ripple drawn in the picture.
        compose.onNode(hasSetTextAction()).performImeAction()
        compose.runOnUiThread { focus.clearFocus() }
        compose.waitForIdle()
        write(name, compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** A photo of notes on Start: read, being read (a spinner in place of its icon) and with nothing readable in it. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialPhoto() = captureMaterialPhoto("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialPhotoReading() = captureMaterialPhoto("reading-phone-screen", SourceReadStatus.READING)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialPhotoReadingDark() = captureMaterialPhoto("reading-phone-dark", SourceReadStatus.READING, dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialPhotoReadingAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialPhoto("reading-phone-font200", SourceReadStatus.READING)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialPhotoUnreadable() = captureMaterialPhoto("unreadable-phone-screen", SourceReadStatus.UNREADABLE)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialPhotoUnreadableDark() = captureMaterialPhoto("unreadable-phone-dark", SourceReadStatus.UNREADABLE, dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialPhotoUnreadableAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialPhoto("unreadable-phone-font200", SourceReadStatus.UNREADABLE)
    }

    private fun captureMaterialPhoto(
        name: String,
        status: SourceReadStatus = SourceReadStatus.READABLE,
        dark: Boolean = false,
    ) {
        val api = FakeOnboardingApi().apply { readStatuses = listOf(status.value) }
        compose.setContent { ZoonkTheme(darkTheme = dark) { Surface { Start(api, AppRoute.StartGoal()) } } }
        compose.waitForIdle()
        val vm = ViewModelProvider(compose.activity)[StartGoalViewModel::class.java]
        compose.runOnUiThread {
            vm.setAttached(listOf(AttachedSource(UUID.randomUUID().toString(), "IMG_2041.jpg", status)))
            vm.setIntent(MaterialIntent.Exam)
        }
        compose.waitForIdle()
        write("start-material-photo-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** The card's note on its material: all of it read, only some of it, or none. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialAllRead() = captureMaterialNote("all-read", "phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialAllReadDark() = captureMaterialNote("all-read", "phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialAllReadAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialNote("all-read", "phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialSomeRead() = captureMaterialNote("some-read", "phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialSomeReadDark() = captureMaterialNote("some-read", "phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialSomeReadAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialNote("some-read", "phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialNoneRead() = captureMaterialNote("none-read", "phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialNoneReadDark() = captureMaterialNote("none-read", "phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialNoneReadAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialNote("none-read", "phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialSomeReadSeveral() = captureMaterialNote("some-read-several", "phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialNoneReadSeveral() = captureMaterialNote("none-read-several", "phone-screen")

    /** Short names share a row, as main's chips wrap: read, being read and with nothing readable, under the choices' line. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialChips() = captureMaterialChips("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialChipsDark() = captureMaterialChips("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun materialChipsAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialChips("phone-font200")
    }

    private fun captureMaterialChips(
        name: String,
        dark: Boolean = false,
    ) {
        val api = FakeOnboardingApi().apply { readStatuses = listOf("reading") }
        compose.setContent { ZoonkTheme(darkTheme = dark) { Surface { Start(api, AppRoute.StartGoal()) } } }
        compose.waitForIdle()
        val vm = ViewModelProvider(compose.activity)[StartGoalViewModel::class.java]
        compose.runOnUiThread {
            vm.setAttached(
                listOf(
                    AttachedSource(UUID.randomUUID().toString(), "Notes.pdf", SourceReadStatus.READABLE),
                    AttachedSource(UUID.randomUUID().toString(), "IMG_2041.jpg", SourceReadStatus.READING),
                    AttachedSource(UUID.randomUUID().toString(), "IMG_2042.jpg", SourceReadStatus.UNREADABLE),
                    AttachedSource(UUID.randomUUID().toString(), "IMG_2043.jpg", SourceReadStatus.UNREADABLE),
                ),
            )
            vm.setIntent(MaterialIntent.Exam)
        }
        compose.waitForIdle()
        write("start-material-chips-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** Sent while material is still being added: Build my plan waits, busy, and the goal goes with the material. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialSentWhileAdding() {
        val api = FakeOnboardingApi().apply { attachGate = kotlinx.coroutines.CompletableDeferred() }
        lateinit var focus: FocusManager
        compose.setContent {
            focus = LocalFocusManager.current
            ZoonkTheme { Surface { Start(api, AppRoute.StartGoal()) } }
        }
        compose.waitForIdle()
        val vm = ViewModelProvider(compose.activity)[StartGoalViewModel::class.java]
        compose.runOnUiThread {
            vm.words.setTextAndPlaceCursorAtEnd("test on Friday")
            vm.toggleAttach()
            vm.attachText("Mitosis has four phases.", "en")
        }
        compose.waitForIdle()
        compose.runOnUiThread {
            vm.submit("test on Friday", "", "en")
            focus.clearFocus()
        }
        compose.waitForIdle()
        write("start-material-sent-while-adding-phone-screen", compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun captureMaterialNote(
        card: String,
        name: String,
        dark: Boolean = false,
    ) {
        val notes = draftSource("Cell cycle notes.pdf")
        val photo = draftSource("IMG_2041.jpg", SourceReadStatus.UNREADABLE)
        val other = draftSource("IMG_2042.jpg", SourceReadStatus.UNREADABLE)
        val sources =
            when (card) {
                "all-read" -> listOf(notes)
                "some-read" -> listOf(notes, photo)
                "some-read-several" -> listOf(notes, photo, other)
                "none-read-several" -> listOf(photo, other)
                else -> listOf(photo)
            }
        val api =
            FakeOnboardingApi().apply {
                draft =
                    understoodDraft(prompt = "test tomorrow").copy(
                        materialIntent = OnboardingDraft.MaterialIntent.EXAM,
                        sources = sources,
                    )
            }
        compose.setContent { ZoonkTheme(darkTheme = dark) { Surface { Start(api, AppRoute.StartGoal(draftId = DRAFT_ID)) } } }
        compose.waitForIdle()
        write("understood-material-$card-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** A question about attached material: main's goal panel with its send inside, empty and with a question typed. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialQuestions() = captureMaterialQuestions("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialQuestionsDarkMoreContrast() = captureMaterialQuestions("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xhdpi")
    fun materialQuestionsAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMaterialQuestions("phone-font200")
    }

    /** A question about a photo still being read is asked at once: it waits as the learner's, its answer pending. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun materialQuestionWhileReading() = captureQuestionWhileReading("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun materialQuestionWhileReadingDark() = captureQuestionWhileReading("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xhdpi")
    fun materialQuestionWhileReadingAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureQuestionWhileReading("phone-font200")
    }

    private fun captureQuestionWhileReading(
        name: String,
        dark: Boolean = false,
    ) {
        val api = FakeOnboardingApi().apply { askFailure = ApiException(ApiError.Unavailable, "materialReading", status = 409) }
        compose.setContent { ZoonkTheme(darkTheme = dark) { Surface { Start(api, AppRoute.StartGoal()) } } }
        compose.waitForIdle()
        val vm = ViewModelProvider(compose.activity)[StartGoalViewModel::class.java]
        compose.runOnUiThread {
            vm.setAttached(listOf(AttachedSource(UUID.randomUUID().toString(), "IMG_2041.jpg", SourceReadStatus.READING)))
            vm.setIntent(MaterialIntent.Questions)
            vm.submit("", "", "en")
        }
        compose.waitForIdle()
        compose.runOnUiThread {
            vm.question.setTextAndPlaceCursorAtEnd("What is the mitotic spindle?")
            vm.ask("en")
        }
        compose.waitForIdle()
        write("start-material-question-while-reading-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun captureMaterialQuestions(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) { Surface { Start(FakeOnboardingApi(), AppRoute.StartGoal()) } }
        }
        compose.waitForIdle()
        val vm = ViewModelProvider(compose.activity)[StartGoalViewModel::class.java]
        compose.runOnUiThread {
            vm.setAttached(listOf(AttachedSource(UUID.randomUUID().toString(), "Cell cycle.pdf")))
            vm.setIntent(MaterialIntent.Questions)
            vm.submit("", "", "en")
        }
        compose.waitForIdle()
        write("start-material-questions-$name", compose.onRoot().captureRender().asAndroidBitmap())
        compose.onNode(hasSetTextAction()).performTextInput("Why does glycolysis net only 2 ATP?")
        compose.waitForIdle()
        write("start-material-questions-typed-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    /** The ask back on Today after nothing could be read in the upload that answered it. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun uploadAskUnreadable() = captureUploadAskUnreadable("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun uploadAskUnreadableDark() = captureUploadAskUnreadable("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun uploadAskUnreadableAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureUploadAskUnreadable("phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun uploadAskUnreadableLine() = captureUploadAskUnreadable("line-phone-screen", layout = SuggestionLayout.Line)

    private fun captureUploadAskUnreadable(
        name: String,
        dark: Boolean = false,
        layout: SuggestionLayout = SuggestionLayout.Panel,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = dark) { Surface { ResearchNotices(layout, uploadAskOf(unreadable = "IMG_2041.jpg")) } }
        }
        compose.waitForIdle()
        write("research-upload-unreadable-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun uploadAskOpen() {
        compose.setContent { ZoonkTheme { Surface { ResearchNotices(SuggestionLayout.Panel) } } }
        compose.onNodeWithText("Upload the notice").performClick()
        compose.waitForIdle()
        write("research-upload-open-phone-screen", compose.onRoot().captureRender().asAndroidBitmap())
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun timeQuestionPicks() = captureTimePicks("phone-screen", Locale.US)

    @Test
    @Config(qualifiers = "pt-rBR-w411dp-h891dp-xxhdpi")
    fun timeQuestionPicksInPortuguese() = captureTimePicks("pt-phone-screen", Locale.forLanguageTag("pt-BR"))

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun timeQuestionPicksTablet() = captureTimePicks("tablet", Locale.US)

    /**
     * The time question as a learner picks: on a goal whose suggestion covers everything, that time, then shorter ones
     * that offer it; on one no time covers, the suggestion, then a shorter one.
     */
    private fun captureTimePicks(
        name: String,
        locale: Locale,
    ) {
        val covers =
            FakeOnboardingApi().apply {
                setup = { setupView(listOf("schedule", "plan"), kind = "exam", details = ENEM_DETAILS, targetDate = "2030-11-08") }
                cover = { coverOf(recommended = 150) }
            }
        val none =
            FakeOnboardingApi().apply {
                setup = { setupView(listOf("schedule", "plan"), kind = "exam", details = ENEM_DETAILS, targetDate = "2030-11-08") }
                cover = { coverOf(recommended = 805, focus = 240) }
            }
        var api by mutableStateOf(covers)
        compose.setContent { ZoonkTheme { Surface { key(api) { Setup(api) } } } }
        compose.waitForIdle()
        write("time-question-default-$name", compose.onRoot().captureRender(scenario = "default").asAndroidBitmap())
        listOf(15, 60).forEach { minutes ->
            pickTime(minutes, locale)
            write("time-question-$minutes-$name", compose.onRoot().captureRender(scenario = "picked $minutes").asAndroidBitmap())
        }

        compose.activity.viewModelStore.clear()
        api = none
        compose.waitForIdle()
        write("time-question-none-default-$name", compose.onRoot().captureRender(scenario = "none default").asAndroidBitmap())
        pickTime(60, locale)
        write("time-question-none-60-$name", compose.onRoot().captureRender(scenario = "none picked 60").asAndroidBitmap())
    }

    private fun pickTime(
        minutes: Int,
        locale: Locale,
    ) {
        compose
            .onAllNodes(
                SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.DropdownList),
            ).onFirst()
            .performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()
        compose.onNodeWithText(formatMinutes(minutes, locale)).performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun levelTestWaitingDarkMoreContrast() = captureLevelTestWaiting("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun levelTestWaitingAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureLevelTestWaiting("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun levelTestWaitingTablet() = captureLevelTestWaiting("tablet")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun levelTestResult() = captureLevelTestResult("phone-screen")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun levelTestResultDark() = captureLevelTestResult("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun levelTestResultTablet() = captureLevelTestResult("tablet", saved = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-night-xhdpi")
    fun levelTestResultTabletDark() = captureLevelTestResult("tablet-dark", dark = true, saved = true)

    private fun captureLevelTestResult(
        name: String,
        dark: Boolean = false,
        saved: Boolean = false,
    ) {
        val result = ApiJson.parseToJsonElement(LEVEL_RESULT).jsonObject.getValue("result")
        val api =
            FakeOnboardingApi().apply {
                val completed = levelTestOf(next = DONE_NEXT, answered = 10, total = 10, attemptId = ATTEMPT)
                val ready = (completed as LanguageLevelTest.LanguageLevelTestOneOf1Value).value
                levelTest =
                    if (saved) {
                        LanguageLevelTest.LanguageLevelTestOneOf1Value(
                            ready.copy(result = ApiJson.decodeFromJsonElement(LanguageLevelTestOneOfResult.serializer(), result)),
                        )
                    } else {
                        completed
                    }
                levelTestResult = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), LEVEL_RESULT)
            }
        val levelDetails = if (saved) ""","level":"B1+","levelTest":{"lastResult":$result}""" else ""
        compose.setContent { ZoonkTheme(darkTheme = dark) { Surface { LevelTest(api, levelDetails = levelDetails) } } }
        compose.waitUntil(WAIT_MS) {
            compose.onAllNodesWithText("Your Italian level").fetchSemanticsNodes().isNotEmpty() ||
                compose.onAllNodesWithText("Your answers are saved").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Your Italian level").assertExists()
        assertEquals(if (saved) 0 else 1, api.finishedLevelTests)
        if (saved) compose.onNodeWithText("Reading B1–B2 · Listening A2–B1", substring = true).assertExists()
        write("level-test-result-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun captureLevelTestWaiting(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val api =
            FakeOnboardingApi().apply {
                levelTest = preparingTestOf()
                startedLevelTest = { preparingTestOf(attemptId = ATTEMPT) }
            }
        compose.setContent { ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) { Surface { LevelTest(api) } } }
        compose.onNodeWithText("Start").performClick()
        compose.onNodeWithText("Preparing your level test").assertIsDisplayed()
        write("level-test-waiting-$name", compose.onRoot().captureRender().asAndroidBitmap())

        api.levelTest = preparingTestOf(startedAt = "2026-10-29T10:00:03Z", attemptId = ATTEMPT)
        compose.mainClock.advanceTimeBy(3_500)
        compose.waitForIdle()
        write("level-test-writing-$name", compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface { key(index) { SCREENS[index].second() } }
            }
        }
        SCREENS.indices.forEach { screen ->
            // Each navigation entry has its own ViewModels in the app.
            compose.activity.viewModelStore.clear()
            index = screen
            compose.waitForIdle()
            write("${SCREENS[screen].first}-$name", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, bitmap)
        println("Screenshot ${file.path}")
    }

    private companion object {
        const val ATTEMPT = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d"
        const val WAIT_MS = 5_000L

        const val LEVEL_RESULT =
            """{"levels":[],"result":{"attemptId":"$ATTEMPT","finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":12,
             "levelsSkipped":["A1"],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}}}}"""

        val SPECIALTY =
            """
            [{"group":"Specialty","leftOut":{"examPoints":360,"examQuestions":null,"name":"Specialty knowledge (P3)","points":180,"questions":null},
              "options":[{"name":"Auditing and control","shortName":null},{"name":"Information technology","shortName":null}],"subjects":[],"take":1}]
            """.trimIndent()

        val MODULES =
            """
            [{"group":"Knowledge modules","leftOut":{"examPoints":null,"examQuestions":null,"name":"Knowledge modules","points":null,"questions":48},
              "options":[{"name":"Biology","shortName":null},{"name":"Chemistry","shortName":null},{"name":"Law","shortName":null},
               {"name":"Social sciences and humanities","shortName":null}],"subjects":["Biology","Chemistry"],"take":2}]
            """.trimIndent()

        val SCREENS: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "start" to { Start(FakeOnboardingApi(), AppRoute.StartGoal()) },
                "start-visitor" to { Start(FakeOnboardingApi(), AppRoute.StartGoal(), visitor = true) },
                "reading" to {
                    Column(Modifier.padding(24.dp)) {
                        GenerationWait(
                            kind = GenerationKind.Understanding,
                            run =
                                GenerationRun(
                                    status = GenerationRun.Status.Following,
                                    steps = mapOf("readGoal" to StepState.Completed, "findExamDates" to StepState.Started),
                                    stepTimes = mapOf("readGoal" to StepTimes(started = 0, completed = 6_000)),
                                ),
                            onRetry = null,
                        )
                    }
                },
                "connection-lost" to {
                    Column(Modifier.padding(24.dp)) {
                        GenerationWait(
                            kind = GenerationKind.Understanding,
                            run = GenerationRun(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection),
                            onRetry = {},
                        )
                    }
                },
                "understood" to {
                    Start(
                        FakeOnboardingApi().apply {
                            draft =
                                understoodDraft(
                                    understanding =
                                        goalsUnderstanding(
                                            title = "Pass the ENEM",
                                            details = ENEM_DETAILS,
                                            examDates =
                                                """
                                                [{"date":"2026-11-08","estimated":false,"label":"Day 1","registrationClosed":false,
                                                  "source":{"title":"Edital ENEM 2026","url":"https://www.gov.br/inep"}},
                                                 {"date":"2026-11-15","estimated":false,"label":"Day 2","registrationClosed":false,"source":null}]
                                                """.trimIndent(),
                                        ),
                                )
                        },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "understood-booked" to {
                    Start(
                        FakeOnboardingApi().apply {
                            draft =
                                understoodDraft(
                                    understanding =
                                        goalsUnderstanding(
                                            title = "Prepare for the GRE",
                                            details = """{"examDay":"booked","onboardingId":"$DRAFT_ID"}""",
                                        ),
                                )
                        },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "explain" to {
                    Start(
                        FakeOnboardingApi().apply { draft = understoodDraft(prompt = "how does inflation work", understanding = EXPLAIN) },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "instrument" to {
                    Start(
                        FakeOnboardingApi().apply { draft = understoodDraft(prompt = "play the guitar", understanding = INSTRUMENT) },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "unsafe" to {
                    Start(
                        FakeOnboardingApi().apply { draft = understoodDraft(prompt = "win at roulette", understanding = UNSAFE) },
                        AppRoute.StartGoal(draftId = DRAFT_ID),
                    )
                },
                "placement-offer" to {
                    Placement(FakeOnboardingApi().apply { placement = placementOf(status = "done", next = null) })
                },
                "placement-question" to {
                    Placement(FakeOnboardingApi().apply { placement = placementOf().copy(attempt = QUICK_ATTEMPT.copy(answered = 2)) })
                },
                "placement-order" to {
                    Placement(FakeOnboardingApi().apply { placement = placementOf(next = orderQuestion()).copy(attempt = QUICK_ATTEMPT) })
                },
                "reveal" to {
                    Reveal(
                        setupPlanApi().apply {
                            shownPlan =
                                planOf(feasibility = feasibilityOf(coreFits = true, deepensMostAsked = true), numbers = numbersOf(1_380.0))
                            shownSyllabus =
                                syllabusOf(
                                    listOf(
                                        subjectOf("Civil procedure", percent = 35),
                                        subjectOf("Contracts", percent = 25),
                                        subjectOf("Criminal law", percent = 25),
                                        subjectOf("Ethics", percent = 15, assumed = true),
                                    ),
                                )
                        },
                    )
                },
                "reveal-focus-trade-off" to {
                    Reveal(setupPlanApi().apply { shownPlan = focusedPlan(FOCUS_CHECKED, focused = true) })
                },
                "reveal-focus-test-offer" to {
                    Reveal(setupPlanApi().apply { shownPlan = focusedPlan(FOCUS_NOT_STARTED, focused = false) })
                },
                "reveal-exam-choice" to {
                    Reveal(
                        setupPlanApi().apply {
                            shownPlan = planOf(examChoices = specialtyChoice("Tecnologia da Informação – Desenvolvimento de Sistemas"))
                        },
                    )
                },
                "reveal-exam-choice-later" to { Reveal(setupPlanApi().apply { shownPlan = planOf(examChoices = specialtyChoice()) }) },
                "reveal-chapters" to {
                    Reveal(
                        setupPlanApi().apply {
                            val chapters = (1..7).joinToString(",", "[", "]") { chapterOf("Chapter $it") }
                            shownPlan =
                                planOf(
                                    targetDate = null,
                                    endDate = LocalDate.now().plusDays(90),
                                    phases =
                                        listOf(
                                            phaseOf(0, "learn", "current", LocalDate.now(), LocalDate.now().plusDays(90), chapters),
                                        ),
                                )
                        },
                        isGuest = true,
                    )
                },
                "reveal-building" to {
                    Reveal(
                        setupPlanApi().apply { shownPlan = planOf(ready = false) },
                        run =
                            GenerationRun(
                                status = GenerationRun.Status.Following,
                                steps = mapOf("understandGoal" to StepState.Completed, "buildSkillGraph" to StepState.Completed),
                            ),
                    )
                },
                "reveal-mapping" to {
                    Reveal(
                        setupPlanApi().apply { shownPlan = planOf(ready = false) },
                        run =
                            GenerationRun(
                                status = GenerationRun.Status.Following,
                                steps = mapOf("understandGoal" to StepState.Completed, "buildSkillGraph" to StepState.Started),
                                stepTimes = mapOf("understandGoal" to StepTimes(started = 0, completed = 8_000)),
                                skillName = "Prepare colonies for winter",
                            ),
                    )
                },
                "reveal-reading" to {
                    Reveal(setupPlanApi().apply { shownPlan = planOf(notice = "reading") })
                },
                "wait-claimed" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup =
                                {
                                    setupView(
                                        listOf("plan"),
                                        planReady = false,
                                        warmUp = """{"id":"019a482c-6a00-7000-8000-000000000001","status":"writing"}""",
                                    )
                                }
                            generationId = { "claimed-run" }
                            events = kotlinx.coroutines.flow.flow { kotlinx.coroutines.awaitCancellation() }
                        },
                        setupPlanApi().apply { shownPlan = planOf(ready = false) },
                    )
                },
                "setup-language-reason" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup =
                                { setupView(listOf("reason", "level", "schedule", "plan"), kind = "language", targetLanguage = "fr") }
                        },
                    )
                },
                "setup-language-schedule" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup =
                                {
                                    setupView(
                                        listOf("schedule", "plan"),
                                        kind = "language",
                                        targetLanguage = "fr",
                                        languageAim = languageAimOf("B1", targetLanguage = "fr"),
                                    )
                                }
                            advice = { adviceOf(null, endDate = kotlinx.datetime.LocalDate(2029, 11, 6), targetDate = null) }
                        },
                    )
                },
                "setup-purpose" to
                    { Setup(FakeOnboardingApi().apply { setup = { setupView(listOf("purpose", "level", "schedule", "plan")) } }) },
                "setup-level" to { Setup(FakeOnboardingApi().apply { setup = { setupView(listOf("level", "schedule", "plan")) } }) },
                "setup-exam-date" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = { setupView(listOf("targetDate", "schedule", "plan"), kind = "exam", details = ENEM_DETAILS) }
                        },
                    )
                },
                "setup-schedule" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = {
                                setupView(listOf("schedule", "plan"), kind = "exam", details = ENEM_DETAILS, targetDate = "2030-11-08")
                            }
                            cover = { coverOf(recommended = 805, focus = 240) }
                        },
                    )
                },
                "setup-schedule-undated" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = { setupView(listOf("schedule", "plan")) }
                            advice = { adviceOf(null, endDate = kotlinx.datetime.LocalDate(2027, 3, 15), targetDate = null) }
                        },
                    )
                },
                "setup-exam-choice" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = {
                                setupView(
                                    listOf("examChoice", "schedule", "plan"),
                                    kind = "exam",
                                    details = ENEM_DETAILS,
                                    examChoices = SPECIALTY,
                                )
                            }
                        },
                    )
                },
                "setup-exam-modules" to {
                    Setup(
                        FakeOnboardingApi().apply {
                            setup = { setupView(listOf("examChoice", "schedule", "plan"), kind = "exam", examChoices = MODULES) }
                        },
                    )
                },
                "setup-buddy" to { Setup(FakeOnboardingApi().apply { setup = { setupView(listOf("buddy", "plan")) } }) },
                "plan-link" to { PlanLink(FakeOnboardingApi()) },
                "course-start" to { CourseStart(AppRoute.CourseStart(COURSE)) },
                "course-start-chapter" to { CourseStart(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_ONE, dailyMinutes = 15)) },
                "course-start-goals-at-once" to { CourseStart(AppRoute.CourseStart(COURSE), AT_THE_LIMIT) },
                "course-start-monthly-goals" to { CourseStart(AppRoute.CourseStart(COURSE, chapterId = CHAPTER_ONE), MONTHLY_GOALS_USED) },
                "material-notices" to { MaterialNotices() },
                "research-notices" to { ResearchNotices(SuggestionLayout.Panel) },
                "research-notices-line" to { ResearchNotices(SuggestionLayout.Line) },
                "level-test-intro" to { LevelTest(FakeOnboardingApi(), targetLanguage = "ja", native = "pt") },
                "level-test-reading" to
                    { LevelTest(FakeOnboardingApi().apply { levelTest = levelTestOf(answered = 3, attemptId = ATTEMPT) }) },
                "level-test-listening" to {
                    LevelTest(
                        FakeOnboardingApi().apply {
                            levelTest =
                                levelTestOf(
                                    next = listeningQuestion(),
                                    answered = 6,
                                    attemptId = ATTEMPT,
                                )
                        },
                    )
                },
            )

        /**
         * A language goal's setup at its level test, with the app's locale config, which Robolectric
         * doesn't read from the manifest, and a speech player that never plays.
         */
        @Composable
        private fun LevelTest(
            api: FakeOnboardingApi,
            targetLanguage: String = "it",
            native: String = "en",
            levelDetails: String = "",
        ) {
            val context = LocalContext.current
            val resources = LocalResources.current
            val speech =
                remember {
                    val config = resources.getIdentifier("_generated_res_locale_config", "xml", context.packageName)
                    ReflectionHelpers.setField(context.applicationInfo, "localeConfigRes", config)
                    api.setup = {
                        setupView(
                            listOf("placement", "plan"),
                            kind = "language",
                            details = """{"answered":["level","schedule"],"nativeLanguage":"$native"$levelDetails}""",
                            targetLanguage = targetLanguage,
                        )
                    }
                    val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                    SpeechPlayer(
                        clips = { _, _, _, _ -> throw ApiException(ApiError.Unavailable) },
                        files = VoiceFiles(File(context.cacheDir, "voice"), OkHttpClient(), { false }, session),
                        output =
                            object : AudioOutput {
                                override suspend fun play(
                                    file: File,
                                    rate: Float,
                                    onStart: () -> Unit,
                                ) = PlaybackEnd.Ended

                                override fun stop() = Unit
                            },
                        sessions = session,
                        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                    )
                }
            CompositionLocalProvider(LocalSetupSpeech provides speech) { Setup(api) }
        }

        @Composable
        private fun PlanLink(api: FakeOnboardingApi) {
            PlanLinkScreen(
                AppRoute.PlanLink("3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f"),
                rememberStore(api),
                signedIn = true,
                rememberAppNavigator(),
            )
        }

        @Composable
        private fun ResearchNotices(
            layout: SuggestionLayout,
            request: TodayUploadRequest = uploadAskOf(),
        ) {
            val store = rememberStore(FakeOnboardingApi())
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                UploadRequestNotice(
                    UUID.fromString(GOAL_ID),
                    request,
                    store,
                    visit = 0,
                    layout = layout,
                    onCreateAccount = {},
                    onSubscribe = {},
                )
                SourceChangeNotice("The 2027 notice moves the exam to March 14 and adds Statistics to what it covers.", layout)
            }
        }

        /** A refused upload and a refused question about attached material: the shared dated notice, and a day's cap. */
        @Composable
        private fun MaterialNotices() {
            val opens = Instant.now().plus(9, ChronoUnit.DAYS).toString()

            fun refused(
                resource: String,
                period: String,
                availableAt: String?,
            ) = WriteOutcome.Refused(Refusal.Limit(UsageLimit(period, resource, "free", availableAt).received(Instant.now())))
            Column(Modifier.padding(horizontal = pageMargin(), vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                AttachPanel(false, refused("upload", "rolling30Days", opens), {}, {}, {}, onCreateAccount = {}, onSubscribe = {})
                MaterialAnswer(refused("materialQuestion", "rolling30Days", opens), onCreateAccount = {}, onSubscribe = {})
                MaterialAnswer(refused("materialQuestion", "day", null), onCreateAccount = {}, onSubscribe = {})
            }
        }

        @Composable
        private fun CourseStart(
            route: AppRoute.CourseStart,
            limit: AllowanceResponse? = null,
        ) {
            val session = remember { FakeSession(AuthenticatedSession("ana", "token-a", "local-a")) }
            val cache = remember { AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
            CourseStartScreen(
                route = route,
                catalog = remember { CatalogStore(FakeCatalogApi(), cache) },
                store = remember { OnboardingStore(FakeOnboardingApi(), cache, session) { SignInResult.SignedIn } },
                allowance =
                    remember {
                        limit?.let { value -> cache.resource<AllowanceResponse>(Audience.SignedIn) { value } }
                            ?: cache.noAllowance()
                    },
                signedIn = limit != null,
                existingGoalId = null,
                navigator = rememberAppNavigator(),
            )
        }

        @Composable
        private fun Setup(
            api: FakeOnboardingApi,
            plans: FakePlanApi = setupPlanApi(),
        ) {
            val store = rememberStore(api)
            GoalSetupScreen(
                AppRoute.GoalSetup(GOAL_ID),
                store,
                rememberPlans(plans),
                isGuest = false,
                rememberAppNavigator(),
            )
        }

        @Composable
        private fun Start(
            api: FakeOnboardingApi,
            route: AppRoute.StartGoal,
            visitor: Boolean = false,
        ) {
            val session = remember { FakeSession(AuthenticatedSession("ana", "token-a", "local-a")) }
            val cache = remember { AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
            val store = remember { OnboardingStore(api, cache, session) { SignInResult.SignedIn } }
            StartGoalScreen(
                route,
                store,
                remember { cache.noAllowance() },
                sessionKey = if (visitor) null else "local-a",
                canAttach = !visitor,
                rememberAppNavigator(),
            )
        }

        @Composable
        private fun Placement(api: FakeOnboardingApi) {
            val store = rememberStore(api)
            SetupColumn {
                PlacementSetup(
                    UUID.fromString(GOAL_ID),
                    "bar exam",
                    targetLanguage = null,
                    placement = ApiJson.decodeFromString(COURSE_OFFER),
                    store = store,
                    plans = rememberPlans(FakePlanApi()),
                    navigator = rememberAppNavigator(),
                    end = PlacementSetupEnd(saving = false) {},
                    onSitting = {},
                    onReportSaveFailure = {},
                )
            }
        }

        val QUICK_ATTEMPT =
            PlacementAttempt(
                answered = 0,
                chapter = "Civil procedure",
                estimatedMinutes = 6,
                id = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d"),
                length = PlacementLength.QUICK,
                nextPart = null,
                part = 1,
                partComplete = false,
                parts = 14,
                partsLeft = 14,
                questions = 12,
                remainingEstimatedMinutes = 85,
                resume = null,
                totalEstimatedMinutes = 85,
            )

        const val COURSE_OFFER =
            """{"mode":"offer","test":{"kind":"course","offer":{"estimatedMinutes":6,"questions":12,"wholeCourse":{"estimatedMinutes":85,"parts":14}}}}"""

        @Composable
        private fun Reveal(
            api: FakePlanApi,
            isGuest: Boolean = false,
            run: GenerationRun = GenerationRun(status = GenerationRun.Status.Following),
        ) {
            val preview =
                remember {
                    val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                    AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
                        .resource<com.zoonk.api.models.PlanRevealToday>(com.zoonk.android.data.Audience.SignedIn) { revealTodayOf() }
                }
            SetupColumn {
                PlanRevealStep(
                    examGoal(),
                    isGuest,
                    run,
                    onRetryRun = {},
                    rememberPlans(api),
                    rememberAppNavigator(),
                    today = preview,
                )
            }
        }

        private fun setupPlanApi() =
            FakePlanApi().apply {
                shownPlan = planOf()
                shownSyllabus = syllabusOf(emptyList(), kind = "modules")
            }

        @Composable
        private fun rememberPlans(api: FakePlanApi = setupPlanApi()) =
            remember {
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                PlanStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
            }

        @Composable
        private fun rememberStore(api: FakeOnboardingApi) =
            remember {
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                OnboardingStore(
                    api,
                    AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                    session,
                ) { SignInResult.SignedIn }
            }
    }
}

private const val ENEM_DETAILS =
    """{"targetCourse":"Medicine","institution":"USP","reason":"I want to be a doctor","answered":["schedule"]}"""
private const val EXPLAIN = """{"status":"explain","question":"How does inflation work?"}"""
private const val INSTRUMENT = """{"status":"instrument","instrument":"guitar"}"""
private const val UNSAFE = """{"status":"unsafe"}"""

private const val FOCUS_NOT_STARTED =
    """{"state":"notStarted","offer":{"minutes":15},"sessionQuestions":"off","suggestsFocus":true}"""
private const val FOCUS_CHECKED =
    """{"state":"checked","offer":{"minutes":10},"sessionQuestions":"on","suggestsFocus":true}"""

/** A short exam plan whose first three subjects get more time when [focused]. */
private fun focusedPlan(
    focusTest: String,
    focused: Boolean,
): com.zoonk.api.models.Plan {
    val areas =
        listOf("Administrative law", "Constitutional law", "Portuguese", "Logical reasoning", "Statistics").mapIndexed { index, name ->
            """{"focusPart":null,"focused":${focused && index < 3},"name":"$name","partOf":null,"pastBasics":false,"reduced":false,"skillCount":4,"skipped":false}"""
        }
    return planOf(feasibility = feasibilityOf(coreFits = false, deepensMostAsked = false), numbers = numbersOf(1_380.0)).copy(
        areas = ApiJson.decodeFromString("[${areas.joinToString(",")}]"),
        focusTest = ApiJson.decodeFromString(focusTest),
    )
}

/** At the goals-at-once limit: three goals studied at once. */
private val AT_THE_LIMIT: AllowanceResponse =
    ApiJson.decodeFromString(
        """
        {"tier":"free","activeGoals":{"limit":3,"used":3},
         "examPrep":{"includesMockExams":false},"generatedLessons":null,
         "resets":{"day":"2026-10-29T00:00:00Z"},
         "items":[{"kind":"goal","dailyLimit":null,"rollingLimit":3,"totalLimit":null,"usedToday":0,"usedLast30Days":1,
           "usedTotal":1,"fairUseDailyLimit":null,"remaining":null,"availableAt":null}]}
        """.trimIndent(),
    )

/** A free learner's new goals over the last 30 days used up, the next one nine days away. */
private val MONTHLY_GOALS_USED: AllowanceResponse =
    ApiJson.decodeFromString(
        """
        {"tier":"free","activeGoals":{"limit":3,"used":1},
         "examPrep":{"includesMockExams":false},"generatedLessons":null,
         "resets":{"day":"2026-10-29T00:00:00Z"},
         "items":[{"kind":"goal","dailyLimit":null,"rollingLimit":3,"totalLimit":null,"usedToday":0,"usedLast30Days":3,
           "usedTotal":3,"fairUseDailyLimit":null,"remaining":0,"availableAt":"${Instant.now().plus(9, ChronoUnit.DAYS)}"}]}
        """.trimIndent(),
    )
