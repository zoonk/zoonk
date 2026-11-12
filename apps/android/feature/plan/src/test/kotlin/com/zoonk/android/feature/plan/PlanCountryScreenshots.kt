package com.zoonk.android.feature.plan

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.callStarter
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.country.CountryStore
import com.zoonk.android.feature.country.LocalCountryCatalog
import com.zoonk.android.feature.tutor.OfferSave
import com.zoonk.android.feature.tutor.TutorOffer
import com.zoonk.android.feature.tutor.TutorRoutes
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.GoalExamCountry
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.LearningProfileSuggestedInner
import com.zoonk.api.models.LearningProfileSuggestedInnerLessonVariety
import com.zoonk.api.models.TutorToolOffer
import com.zoonk.api.models.TutorToolOfferOneOf9
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
import java.util.UUID

/** Review screenshots of a goal's country on the Plan, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PlanCountryScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1000dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1000dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200", interactive = false)
    }

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("expanded", interactive = false)

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-night-xhdpi")
    fun expandedDark() = capture("expanded-dark", dark = true, interactive = false)

    private val brasil = LearningProfileSuggestedInner("BR", "Brasil", null, null)
    private val portugal =
        LearningProfileSuggestedInner(
            "PT",
            "Portugal",
            LearningProfileSuggestedInnerLessonVariety("pt", "BR"),
            LearningProfileSuggestedInner.Tag.HOME,
        )

    private fun country(rebuild: GoalContentCountry.Rebuild) =
        GoalContentCountry(
            "PT",
            "Portugal",
            editable = true,
            kind = GoalContentCountry.Kind.CONTENT,
            lessonVariety = LearningProfileSuggestedInnerLessonVariety("pt", "BR"),
            rebuild = rebuild,
            source = GoalContentCountry.Source.PICKED,
        )

    private fun capture(
        suffix: String,
        dark: Boolean = false,
        interactive: Boolean = true,
    ) {
        val summary = learnerSummary(title = "Organizar as finanças pessoais")

        fun goal(rebuild: GoalContentCountry.Rebuild) =
            summary.goals.first().copy(contentCountry = country(rebuild), countryDependent = true, suggested = listOf(portugal, brasil))
        val exam =
            summary.goals.first().copy(
                kind = LearnerSummaryGoal.Kind.EXAM,
                title = "Ingreso a la UBA",
                displayName = "Ingreso a la UBA",
                contentCountry =
                    GoalContentCountry(
                        "AR",
                        "Argentina",
                        editable = false,
                        kind = GoalContentCountry.Kind.EXAM,
                        lessonVariety = null,
                        rebuild = GoalContentCountry.Rebuild.NONE,
                        source = GoalContentCountry.Source.SAID,
                    ),
            )
        val general =
            summary.goals.first().copy(
                title = "Learn Python",
                displayName = "Learn Python",
                examplesCountry = GoalExamCountry("PT", "Portugal"),
            )
        val pages =
            linkedMapOf(
                "plan-country-preparing" to (goal(GoalContentCountry.Rebuild.PREPARING) to CountryRebuild.Preparing),
                "plan-country-failed" to (goal(GoalContentCountry.Rebuild.FAILED) to CountryRebuild.Failed),
                "plan-country-ready" to (goal(GoalContentCountry.Rebuild.NONE) to CountryRebuild.Ready),
                "plan-country-exam" to (exam to null),
                "plan-country-examples" to (general to null),
            )
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val countries =
            CountryStore(
                {
                    listOf(
                        CountryChoice("AR", "Argentina"),
                        CountryChoice("BR", "Brasil"),
                        CountryChoice("US", "Estados Unidos"),
                        CountryChoice("AE", "Emirados Árabes Unidos"),
                        CountryChoice("GB", "Reino Unido"),
                    )
                },
                cache,
            )
        var shown by mutableStateOf<String?>(pages.keys.first())

        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark) {
                CompositionLocalProvider(LocalCountryCatalog provides countries.catalog) {
                    Surface {
                        val name = shown
                        if (name == null) {
                            EditorRows(goal(GoalContentCountry.Rebuild.NONE), general)
                        } else {
                            val (goal, rebuild) = pages.getValue(name)
                            val page = PlanPageState(goal, learnPlan(), summary.copy(goals = listOf(goal)))
                            PlanContent(
                                page = page,
                                standing = null,
                                structure = null,
                                links = PlanLinks(navigator, page),
                                resume = Resume.Plain,
                                isSaving = false,
                                onSetStatus = {},
                                onAdjust = {},
                                countryRebuild = rebuild,
                            )
                        }
                    }
                }
            }
        }
        pages.keys.forEach { name ->
            shown = name
            compose.waitForIdle()
            write("$name-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
        }
        shown = null
        compose.waitForIdle()
        write("plan-country-editor-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
        if (!interactive) return

        compose.onNodeWithText("Content country").performClick()
        compose.waitForIdle()
        write("plan-country-picker-$suffix", compose.onNode(isDialog()).captureRender().asAndroidBitmap())
        compose.onNode(hasSetTextAction()).performTextInput("uni")
        compose.waitForIdle()
        write("plan-country-picker-search-$suffix", compose.onNode(isDialog()).captureRender().asAndroidBitmap())
        compose.onAllNodesWithText("Reino Unido").onFirst().performClick()
        compose.waitForIdle()
        write("plan-country-confirm-$suffix", compose.onAllNodes(isDialog())[1].captureRender().asAndroidBitmap())
    }

    @androidx.compose.runtime.Composable
    private fun EditorRows(
        goal: LearnerSummaryGoal,
        general: LearnerSummaryGoal,
    ) {
        val routes = TutorRoutes({}, {}, {}, {}, callStarter { CallStart.Failed })

        fun offer(kind: TutorToolOfferOneOf9.Kind) =
            TutorToolOffer.TutorToolOfferOneOf9Value(
                TutorToolOfferOneOf9(
                    "PT",
                    "Portugal",
                    UUID.randomUUID(),
                    kind,
                    "pt",
                    LearningProfileSuggestedInnerLessonVariety("pt", "BR").takeIf { kind == TutorToolOfferOneOf9.Kind.CONTENT_COUNTRY },
                ),
            )
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ContentCountryRow(goal, goal.contentCountry!!, remember { EditorDrafts() }, onPick = {
                _,
                _,
                ->
            }, pending = false, failed = false)
            CountryFacts(general)
            TutorOffer(offer(TutorToolOfferOneOf9.Kind.CONTENT_COUNTRY), routes, null, {})
            TutorOffer(offer(TutorToolOfferOneOf9.Kind.CONTENT_COUNTRY), routes, OfferSave.Saved, {})
            TutorOffer(offer(TutorToolOfferOneOf9.Kind.HOME_COUNTRY), routes, OfferSave.Failed, {})
            TutorOffer(offer(TutorToolOfferOneOf9.Kind.HOME_COUNTRY), routes, OfferSave.Saved, {})
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
