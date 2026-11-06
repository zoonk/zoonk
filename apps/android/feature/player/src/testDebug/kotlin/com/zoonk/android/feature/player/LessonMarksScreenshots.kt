package com.zoonk.android.feature.player

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.annotation.DelicateCoilApi
import coil3.asImage
import coil3.decode.DataSource
import coil3.intercept.Interceptor
import coil3.request.ImageResult
import coil3.request.SuccessResult
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.playedSteps
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.model.CheckOption
import com.zoonk.android.feature.player.model.CheckStepContent
import com.zoonk.android.feature.player.model.ExplanationStepContent
import com.zoonk.android.feature.player.model.GuessHook
import com.zoonk.android.feature.player.model.GuessOption
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.TextHook
import com.zoonk.android.feature.player.model.WorkedExampleStepContent
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.feature.tutor.TutorSuggestion
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LessonIcon
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.LessonMapIdeasInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOf1
import com.zoonk.api.models.PlayableLibraryStepAnyOf8ContentStepsInner
import com.zoonk.api.models.StepMarks
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import kotlin.time.Instant

/**
 * Review screenshots of a knowledge lesson's marks, strip, opening map and mind map, written only on
 * demand: `./gradlew :feature:player:testDebugUnitTest --tests '*LessonMarksScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * The text is a real lesson's; icons are drawn stand-ins in the library's sticker style.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonMarksScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val temporary = TemporaryFolder()

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
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h1800dp-night-xxhdpi")
    fun phoneDarkAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-dark-font200", dark = true)
    }

    @Test
    @Config(qualifiers = "w800dp-h1280dp-xhdpi")
    fun tablet() = capture("tablet")

    @Test
    @Config(qualifiers = "w800dp-h1280dp-night-xhdpi")
    fun tabletDark() = capture("tablet-dark", dark = true)

    @Test
    @Config(qualifiers = "w800dp-h2000dp-xhdpi")
    fun tabletAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("tablet-font200")
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("book", fold = true)

    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    fun smallPhoneRightToLeft() = capture("small-phone-rtl", rtl = true)

    private val states: List<Pair<String, () -> Pair<PlayableLesson, LessonPlayerState>>> =
        listOf(
            "opening" to { at(BIOLOGY) },
            "explanation-example" to { at(BIOLOGY, LessonAction.Continue) },
            "guess" to { at(BIOLOGY.copy(steps = listOf(GUESS))) },
            "explanation-icon" to { at(BIOLOGY.copy(steps = listOf(CELL))) },
            "check" to { at(BIOLOGY.copy(steps = listOf(CELL_CHECK))) },
            "untagged" to { at(BIOLOGY.copy(steps = listOf(CAT.copy(marks = null)), map = null)) },
            "renda-example" to { at(FINANCE) },
            "renda-worked" to { at(FINANCE, LessonAction.Continue) },
            "map" to { at(BIOLOGY.copy(steps = listOf(CELL)), LessonAction.Continue) },
            "map-three" to
                {
                    at(
                        BIOLOGY.copy(steps = listOf(CELL), map = BIOLOGY_MAP.copy(ideas = BIOLOGY_MAP.ideas.take(3))),
                        LessonAction.Continue,
                    )
                },
            "map-five" to
                {
                    at(
                        BIOLOGY.copy(steps = listOf(CELL), map = BIOLOGY_MAP.copy(ideas = BIOLOGY_MAP.ideas + STIMULUS)),
                        LessonAction.Continue,
                    )
                },
        )

    private fun at(
        lesson: PlayableLesson,
        vararg actions: LessonAction,
    ): Pair<PlayableLesson, LessonPlayerState> {
        val started =
            reduce(
                LessonPlayerState.initial(LESSON_ID, lesson.playedSteps, now = 0),
                LessonAction.RunStarted(RUN_ID, emptyList(), HyperdriveStart(emptySet(), 0), Instant.parse("2026-11-05T10:00:00Z")),
                0,
            )
        return lesson to actions.fold(started) { state, action -> reduce(state, action, 0) }
    }

    @OptIn(DelicateCoilApi::class)
    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: Boolean = false,
        rtl: Boolean = false,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(temporary.newFolder(), scope)
        val viewModel =
            LessonPlayerViewModel(
                LESSON_ID,
                null,
                null,
                LessonPlayerStore(FakeLessonPlayerApi(LessonLoad.Ready(BIOLOGY)), cache),
                cache,
                session,
                TodayChoices(drafts),
                drafts,
                saved = SavedStateHandle(),
            )
        var index by mutableIntStateOf(0)
        val simpler = TutorSuggestion("Explique de um jeito mais simples", "simpler")
        val tutor = LessonTutor(TutorIdentity("Sam", look = null), listOf(simpler)) { _, _, _, _, _, _ -> }
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }
        SingletonImageLoader.setUnsafe(stickerIcons())

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                ) {
                    key(index) {
                        val (lesson, state) = states[index].second()
                        LessonPlayer(lesson, state, LessonEnding(), viewModel, exits, rememberAppNavigator(), tutor = tutor)
                    }
                }
            }
        }
        states.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            if (fold) {
                folds.overrideWindowLayoutInfo(
                    TestWindowLayoutInfo(
                        listOf(
                            FoldingFeature(
                                compose.activity,
                                state = FoldingFeature.State.FLAT,
                                orientation = FoldingFeature.Orientation.VERTICAL,
                            ),
                        ),
                    ),
                )
                compose.waitForIdle()
            }
            write("${states[screen].first}-$name", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    /** Each icon loads at once as a sticker: a colored shape with a white die-cut border and an ink outline. */
    private fun stickerIcons(): ImageLoader {
        val loader = ImageLoader.Builder(compose.activity)
        return loader
            .components {
                add(
                    object : Interceptor {
                        override suspend fun intercept(chain: Interceptor.Chain): ImageResult {
                            val name =
                                chain.request.data
                                    .toString()
                                    .substringAfterLast('/')
                                    .substringBefore('.')
                            return SuccessResult(
                                sticker(STICKER_COLORS[name] ?: 0xFF8E8E93.toInt()).asImage(),
                                chain.request,
                                DataSource.MEMORY,
                            )
                        }
                    },
                )
            }.build()
    }

    private fun sticker(color: Int): Bitmap =
        Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888).apply {
            val canvas = Canvas(this)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            paint.color = 0xFFFFFFFF.toInt()
            canvas.drawRoundRect(24f, 40f, 232f, 216f, 70f, 70f, paint)
            paint.color = color
            canvas.drawRoundRect(44f, 60f, 212f, 196f, 56f, 56f, paint)
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 8f
            paint.color = 0xFF25324F.toInt()
            canvas.drawRoundRect(44f, 60f, 212f, 196f, 56f, 56f, paint)
            canvas.drawLine(92f, 128f, 164f, 128f, paint)
        }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }
}

private fun icon(name: String) = LessonIcon(smallUrl = "https://icons.example/$name.webp", url = "https://icons.example/$name-256.webp")

private val STICKER_COLORS =
    mapOf(
        "leaf" to 0xFF8BC34A.toInt(),
        "leaf-256" to 0xFF8BC34A.toInt(),
        "microscope" to 0xFF90A4AE.toInt(),
        "microscope-256" to 0xFF90A4AE.toInt(),
        "rabbit" to 0xFFBCAAA4.toInt(),
        "car" to 0xFFE57373.toInt(),
        "cat-256" to 0xFFFFB74D.toInt(),
        "money-256" to 0xFF81C784.toInt(),
        "money" to 0xFF81C784.toInt(),
        "receipt" to 0xFFFFF176.toInt(),
        "scale" to 0xFF9575CD.toInt(),
    )

private fun idea(
    label: String,
    text: String,
    about: String,
    icon: String,
) = LessonMapIdeasInner(text = text, label = label, about = about, icon = icon(icon))

private fun marks(
    idea: Int,
    underline: String? = null,
    example: String? = null,
    icon: String? = null,
) = StepMarks(example = example, icon = icon?.let(::icon), ideaIndex = idea.toLong(), underline = underline)

private val BIOLOGY_MAP =
    LessonMap(
        ideas =
            listOf(
                idea(
                    "Metabolismo",
                    "O metabolismo são as transformações químicas que mantêm a vida, " +
                        "como tirar energia do alimento, e ele continua até à noite.",
                    "O que acontece dentro de um ser vivo para ele se manter",
                    "leaf",
                ),
                idea(
                    "Célula",
                    "Todo ser vivo é formado por células, pequenas unidades vivas como as que aparecem na película de cebola.",
                    "Do que todo ser vivo é feito",
                    "microscope",
                ),
                idea(
                    "Reprodução",
                    "A reprodução marca a vida, mas não é obrigatória para cada ser vivo, como mostra a mula.",
                    "Se ter filhotes é o que define um ser vivo",
                    "rabbit",
                ),
                idea(
                    "Movimento não basta",
                    "Se mover, crescer ou consumir combustível, sozinhos, não decidem se algo é vivo.",
                    "Por que um carro não é um ser vivo",
                    "car",
                ),
            ),
        shape = LessonMap.Shape.HUB,
    )

private val STIMULUS =
    idea(
        "Resposta",
        "Seres vivos reagem ao ambiente, como a planta que se vira para a luz.",
        "Como um ser vivo reage ao que acontece em volta",
        "leaf",
    )

private val SCENE =
    LessonStep(
        "scene",
        null,
        StepContent.Fact(
            TextHook(
                text =
                    "Uma roseira passa anos no mesmo vaso, sem sair do lugar.\n\n" +
                        "Mesmo assim, ela cresce e abre flores novas a cada estação." +
                        "\n\nO que acontece dentro dela para mantê-la viva?",
                variant = PlayableLibraryStepAnyOf4ContentOneOf1.Variant.TEXT,
            ),
        ),
    )

private const val CAT_CASE = "Quando um gato come ração, o corpo dele transforma as substâncias do alimento para obter energia."

private val CAT =
    LessonStep(
        "cat",
        null,
        StepContent.Explanation(
            ExplanationStepContent(
                title = "O corpo transforma o alimento",
                text = "$CAT_CASE\n\nEssas e outras transformações químicas que mantêm a vida se chamam **metabolismo**.",
            ),
        ),
        marks =
            marks(
                0,
                underline = "transformações químicas que mantêm a vida",
                example = CAT_CASE,
                icon = "cat",
            ),
    )

private val GUESS =
    LessonStep(
        "guess",
        null,
        StepContent.Guess(
            GuessHook(
                options =
                    listOf(
                        GuessOption("a", false, "Só começa quando escurece"),
                        GuessOption("b", false, "Para até amanhecer"),
                        GuessOption("c", true, "Continua durante a noite"),
                    ),
                question = "Quando anoitece e a luz do sol acaba, o que acontece com o uso de energia de uma roseira?",
                reveal = "Continua: a roseira usa energia de dia e de noite.",
                variant = PlayableLibraryStepAnyOf4ContentOneOf.Variant.GUESS,
            ),
        ),
        marks = marks(0),
    )

private val CELL =
    LessonStep(
        "cell",
        null,
        StepContent.Explanation(
            ExplanationStepContent(
                title = "Seres vivos têm células",
                text =
                    "Ao microscópio, uma película fininha de cebola aparece dividida em pequenos compartimentos.\n\n" +
                        "Cada um é uma pequena unidade viva.\n\nEssa unidade se chama **célula**.\n\nTodo ser vivo é formado por células.",
            ),
        ),
        marks = marks(1, underline = "Todo ser vivo é formado por células", icon = "microscope"),
    )

private val CELL_CHECK =
    LessonStep(
        "cells-check",
        null,
        StepContent.Check(
            CheckStepContent(
                basis = null,
                options =
                    listOf(
                        CheckOption("right", true, "Toda planta é formada por células.", "Sim, como todo ser vivo"),
                        CheckOption("wrong", false, "Folhas também são feitas de células.", "Só as raízes"),
                    ),
                question = "Uma folha de alface também é formada por células?",
            ),
        ),
        marks = marks(1),
    )

private val BIOLOGY =
    PlayableLesson(
        id = LESSON_ID,
        title = "Características dos seres vivos",
        description = "O que faz algo estar vivo.",
        estimatedMinutes = 8,
        language = "pt",
        targetLanguage = null,
        chapterId = CHAPTER_ID,
        steps = listOf(SCENE, CAT, GUESS, CELL, CELL_CHECK),
        map = BIOLOGY_MAP,
        tutorSuggestions = emptyList(),
    )

private const val CINTIA_CASE =
    "Da renda bruta de Cíntia saem R$ 330,00 em descontos.\n\nSobram R$ 3.200,00 − R$ 330,00 = R$ 2.870,00, o valor que cai na conta."

private val NET_PAY =
    LessonStep(
        "net",
        null,
        StepContent.Explanation(
            ExplanationStepContent(
                title = "O que sobra para você",
                text = "$CINTIA_CASE\n\nEsse valor que sobra se chama **renda líquida**.",
            ),
        ),
        marks = marks(3, underline = "o valor que cai na conta", example = CINTIA_CASE, icon = "money"),
    )

private val NET_PAY_WORKED =
    LessonStep(
        "worked",
        null,
        StepContent.WorkedExample(
            WorkedExampleStepContent(
                problem =
                    "Rui ganha R$ 2.500,00 de **renda bruta** e tem R$ 280,00 de descontos no contracheque. " +
                        "Quanto cai na conta dele?",
                result = "R$ 2.220,00 caem na conta de Rui.",
                steps =
                    listOf("Comece pela renda bruta: R$ 2.500,00.", "Tire os descontos: R$ 2.500,00 − R$ 280,00.", "Sobram R$ 2.220,00.")
                        .map { PlayableLibraryStepAnyOf8ContentStepsInner(text = it) },
            ),
        ),
        marks =
            marks(
                3,
                underline = "Quanto cai na conta dele?",
                example = "Rui ganha R$ 2.500,00 de **renda bruta** e tem R$ 280,00 de descontos no contracheque.",
            ),
    )

private val FINANCE =
    BIOLOGY.copy(
        title = "Renda bruta e renda líquida",
        steps = listOf(NET_PAY, NET_PAY_WORKED),
        map =
            LessonMap(
                ideas =
                    listOf(
                        idea("Renda bruta", "A renda bruta é o salário antes de qualquer desconto.", "O valor do contrato", "receipt"),
                        idea("Descontos", "INSS e imposto de renda saem da renda bruta.", "O que sai do salário", "scale"),
                        idea(
                            "Benefícios",
                            "Vale-transporte e vale-refeição também aparecem no contracheque.",
                            "O que mais aparece no contracheque",
                            "receipt",
                        ),
                        idea("Renda líquida", "A renda líquida é o que sobra e cai na conta.", "O que sobra para você", "money"),
                    ),
                shape = LessonMap.Shape.HUB,
            ),
    )
