package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.country.CountryStore
import com.zoonk.android.feature.country.LocalCountryCatalog
import com.zoonk.android.feature.onboarding.setup.CountryStep
import com.zoonk.android.feature.onboarding.start.FactEdits
import com.zoonk.android.feature.onboarding.start.UnderstoodScreen
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.GoalExamCountry
import com.zoonk.api.models.GoalUnderstandingOneOf
import com.zoonk.api.models.LearningProfileSuggestedInner
import com.zoonk.api.models.LearningProfileSuggestedInnerLessonVariety
import com.zoonk.api.models.OnboardingContentCountry
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

/** Review screenshots of the country question and the review's country row, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OnboardingCountryScreenshots {
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

    private val variety = LearningProfileSuggestedInnerLessonVariety("pt", "BR")
    private val question =
        OnboardingContentCountry(
            GoalExamCountry("BR", "Brasil"),
            listOf(
                LearningProfileSuggestedInner("PT", "Portugal", variety, LearningProfileSuggestedInner.Tag.HOME),
                LearningProfileSuggestedInner("BR", "Brasil", null, null),
                LearningProfileSuggestedInner("AO", "Angola", null, null),
                LearningProfileSuggestedInner("MZ", "Moçambique", null, null),
            ),
        )

    private fun review(): GoalUnderstandingOneOf {
        val understanding: GoalUnderstandingOneOf = ApiJson.decodeFromString(goalsUnderstanding(title = "Declarar o imposto de renda"))
        val goal =
            understanding.goals.single().let {
                it.copy(
                    draft = it.draft.copy(kind = com.zoonk.api.models.GoalDraftOutput.Kind.LEARN, language = "pt"),
                    countryDependent = true,
                    contentCountry =
                        GoalContentCountry(
                            "PT",
                            "Portugal",
                            editable = true,
                            kind = GoalContentCountry.Kind.CONTENT,
                            lessonVariety = variety,
                            rebuild = GoalContentCountry.Rebuild.NONE,
                            source = GoalContentCountry.Source.HOME,
                        ),
                    suggested = question.suggested,
                )
            }
        return understanding.copy(goals = listOf(goal))
    }

    private fun capture(
        suffix: String,
        dark: Boolean = false,
        interactive: Boolean = true,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val countries =
            CountryStore({ listOf(CountryChoice("DE", "Alemanha"), CountryChoice("AO", "Angola"), CountryChoice("BR", "Brasil")) }, cache)
        var reviewing by mutableStateOf(false)

        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                CompositionLocalProvider(LocalCountryCatalog provides countries.catalog) {
                    Surface {
                        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                            if (reviewing) {
                                UnderstoodScreen(
                                    goal = "declarar meu imposto de renda",
                                    understanding = review(),
                                    activeGoalsLeft = null,
                                    timeZone = "America/Sao_Paulo",
                                    material = emptyList(),
                                    hasAccount = true,
                                    isCreating = false,
                                    error = null,
                                    goalLimit = null,
                                    onConfirm = {},
                                    edits = FactEdits(null, null, null, {}, { _, _ -> }),
                                    onRewrite = {},
                                    onCreateAccount = {},
                                    onSubscribe = {},
                                    onOpenPlan = {},
                                )
                            } else {
                                CountryStep("Declarar o imposto de renda", question, "pt", pending = false, onAnswer = {})
                            }
                        }
                    }
                }
            }
        }
        compose.waitForIdle()
        write("onboarding-country-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
        if (interactive) {
            compose.onNodeWithText("Portugal").performClick()
            compose.waitForIdle()
            write("onboarding-country-picked-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
            compose.onNodeWithText("Another country").performClick()
            compose.waitForIdle()
            write("onboarding-country-picker-$suffix", compose.onNode(isDialog()).captureRender().asAndroidBitmap())
            compose.onNodeWithText("Alemanha").performClick()
            compose.waitForIdle()
            write("onboarding-country-other-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
        }
        reviewing = true
        compose.waitForIdle()
        write("onboarding-review-country-$suffix", compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
