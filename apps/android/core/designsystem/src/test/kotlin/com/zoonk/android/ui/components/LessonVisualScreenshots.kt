package com.zoonk.android.ui.components

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.LessonVisual.Chart
import com.zoonk.android.ui.components.LessonVisual.Plot
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review renders of lesson charts on phones, inside the screen's 16 dp gutter, written only on demand:
 * `./gradlew :core:designsystem:testDebugUnitTest --tests '*LessonVisualScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * No goldens: people and agents look at them.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonVisualScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w320dp-h1600dp-xxhdpi")
    fun narrowPhone() = capture("320-light", CHARTS)

    @Test
    @Config(qualifiers = "w320dp-h1600dp-night-xxhdpi")
    fun narrowPhoneDark() = capture("320-dark", CHARTS, dark = true)

    @Test
    @Config(qualifiers = "w390dp-h1600dp-xxhdpi")
    fun phone() = capture("390-light", CHARTS)

    @Test
    @Config(qualifiers = "w390dp-h1600dp-night-xxhdpi")
    fun phoneDark() = capture("390-dark", CHARTS, dark = true)

    @Test
    @Config(qualifiers = "w320dp-h1600dp-xxhdpi")
    fun narrowPhoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("320-light-font200", CHARTS.filterKeys { it in LARGE_FONT })
    }

    @Test
    @Config(qualifiers = "w390dp-h1600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("390-light-font200", CHARTS.filterKeys { it in LARGE_FONT })
    }

    private fun capture(
        suffix: String,
        charts: Map<String, LessonVisual>,
        dark: Boolean = false,
    ) {
        var shown by mutableStateOf(charts.values.first())
        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                Surface {
                    Box(Modifier.testTag(TAG).padding(16.dp)) { LessonVisual(shown) }
                }
            }
        }
        charts.forEach { (name, chart) ->
            shown = chart
            compose.waitForIdle()
            write(File(folder, "android-$name-$suffix.png"), compose.onNodeWithTag(TAG).captureRender().asAndroidBitmap())
        }
    }

    private fun write(
        file: File,
        bitmap: Bitmap,
    ) {
        file.parentFile?.mkdirs()
        writeRender(file, bitmap)
    }

    private companion object {
        const val TAG = "chart"

        val LARGE_FONT = setOf("regions", "plot-scatter", "plot-control")

        private val REGIONS = listOf("Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste")

        val CHARTS: Map<String, LessonVisual> =
            linkedMapOf(
                "plot-scatter" to
                    plot(
                        "Detector scan",
                        "Detector position",
                        "mm",
                        "Count rate",
                        "counts/s",
                        Plot.Series(
                            "Scan",
                            Plot.Mark.Points,
                            listOf(0.5 to 810.0, 1.5 to 880.0, 3.0 to 952.0, 4.5 to 890.0, 5.5 to 820.0).mapIndexed { index, (x, y) ->
                                Plot.Point(x, y, "ABCDE"[index].toString())
                            },
                        ),
                    ),
                "plot-control" to
                    plot(
                        "Bottle fill weight, last 10 days",
                        "Day",
                        null,
                        "Fill weight",
                        "ml",
                        Plot.Series(
                            "Fill weight",
                            Plot.Mark.LineWithPoints,
                            listOf(499.8, 500.6, 499.3, 501.0, 500.4, 501.6, 502.3, 503.8, 502.9, 502.1).mapIndexed { day, weight ->
                                Plot.Point(day + 1.0, weight)
                            },
                        ),
                    ).copy(
                        references =
                            listOf(
                                Plot.Reference("Upper limit", 503.0),
                                Plot.Reference("Target", 500.0),
                                Plot.Reference("Lower limit", 497.0),
                            ),
                    ),
                "plot-named-countries" to
                    plot(
                        "Spending on health and life expectancy, 2021",
                        "Health spending per person",
                        "US$",
                        "Life expectancy",
                        "years",
                        Plot.Series(
                            "Countries",
                            Plot.Mark.Points,
                            listOf(
                                Plot.Point(12_318.0, 76.4, "United States"),
                                Plot.Point(8_011.0, 82.9, "Switzerland"),
                                Plot.Point(6_166.0, 80.8, "Germany"),
                                Plot.Point(4_666.0, 84.5, "Japan"),
                                Plot.Point(1_514.0, 72.8, "Brazil"),
                                Plot.Point(1_265.0, 74.4, "Mexico"),
                                Plot.Point(57.0, 67.2, "India"),
                            ),
                        ),
                    ).copy(source = "World Bank"),
                "plot-two-lines" to
                    plot(
                        "Average temperature by month",
                        "Month",
                        null,
                        "Temperature",
                        "°C",
                        Plot.Series(
                            "Recife",
                            Plot.Mark.Line,
                            listOf(27.6, 27.7, 27.5, 27.0, 26.2, 25.4, 24.9, 25.0, 25.6, 26.4, 26.9, 27.3).mapIndexed { month, value ->
                                Plot.Point(month + 1.0, value)
                            },
                        ),
                        Plot.Series(
                            "Porto Alegre",
                            Plot.Mark.Line,
                            listOf(24.6, 24.4, 23.1, 19.9, 16.6, 14.1, 13.9, 15.1, 16.4, 19.1, 21.2, 23.4).mapIndexed { month, value ->
                                Plot.Point(month + 1.0, value)
                            },
                        ),
                    ),
                "plot-years" to
                    plot(
                        "World population",
                        "Year",
                        null,
                        "People",
                        "billion",
                        Plot.Series(
                            "Population",
                            Plot.Mark.LineWithPoints,
                            listOf(1950.0 to 2.5, 1970.0 to 3.7, 1990.0 to 5.3, 2010.0 to 6.9, 2023.0 to 8.0).map { (x, y) ->
                                Plot.Point(x, y)
                            },
                        ),
                    ),
                "regions" to bars("Participação no total, por região", "Região", "Participação", REGIONS, "%", 18, 42, 64, 30, 22),
                "long-names" to
                    bars(
                        "Chamados abertos por mês",
                        "Mês",
                        "Chamados",
                        listOf("Maio, antes da mudança de sistema", "Junho, durante a migração", "Julho, depois do treinamento da equipe"),
                        null,
                        35,
                        21,
                        40,
                    ),
                "regions-two-series" to
                    Chart(
                        chart = Chart.Kind.Bar,
                        title = "Participação no total, por região",
                        categoryLabel = "Região",
                        valueLabel = "Participação",
                        categories = REGIONS,
                        series =
                            listOf(
                                Chart.Series("2019", listOf(18.0, 42.0, 64.0, 30.0, 22.0)),
                                Chart.Series("2024", listOf(21.0, 39.0, 66.0, 34.0, 27.0)),
                            ),
                        unit = "%",
                        source = "IBGE",
                    ),
                "short-names" to
                    bars("Exercícios por dia", "Dia", "Exercícios", listOf("Seg", "Ter", "Qua", "Qui", "Sex"), null, 12, 18, 9, 22, 15),
                "cropped-axis" to
                    bars(
                        "Nota média por turma",
                        "Turma",
                        "Nota",
                        listOf("Turma da manhã, prédio antigo", "Turma da tarde, prédio novo", "Turma da noite, a distância"),
                        null,
                        35,
                        36,
                        40,
                    ).copy(axisStart = 30.0),
                "negatives" to bars("Saldo do mês", "Região", "Saldo", REGIONS, "mil R$", -12, 8, 25, -4, 3),
                "line" to
                    bars(
                        "Participação ao longo do ano",
                        "Região",
                        "Participação",
                        REGIONS,
                        "%",
                        18,
                        42,
                        64,
                        30,
                        22,
                    ).copy(chart = Chart.Kind.Line),
                "five-series" to months(5),
                "five-series-line" to months(5).copy(chart = Chart.Kind.Line),
                "eight-series" to months(8),
                "eight-series-line" to months(8).copy(chart = Chart.Kind.Line),
            )

        private fun months(series: Int) =
            Chart(
                chart = Chart.Kind.Bar,
                title = "Ofícios por região",
                categoryLabel = "Mês",
                valueLabel = "Ofícios",
                categories = listOf("Jan", "Fev", "Mar", "Abr"),
                series =
                    listOf(
                        Chart.Series("Norte", listOf(12.0, 18.0, 24.0, 31.0)),
                        Chart.Series("Nordeste", listOf(20.0, 22.0, 19.0, 27.0)),
                        Chart.Series("Sudeste", listOf(8.0, 14.0, 22.0, 16.0)),
                        Chart.Series("Sul", listOf(28.0, 25.0, 30.0, 36.0)),
                        Chart.Series("Centro-Oeste", listOf(15.0, 11.0, 13.0, 21.0)),
                        Chart.Series("Capital", listOf(33.0, 29.0, 26.0, 24.0)),
                        Chart.Series("Interior", listOf(5.0, 9.0, 12.0, 10.0)),
                        Chart.Series("Litoral", listOf(24.0, 31.0, 35.0, 40.0)),
                    ).take(series),
            )

        private fun plot(
            title: String,
            xLabel: String,
            xUnit: String?,
            yLabel: String,
            yUnit: String?,
            vararg series: Plot.Series,
        ) = Plot(title = title, xLabel = xLabel, yLabel = yLabel, series = series.toList(), xUnit = xUnit, yUnit = yUnit)

        private fun bars(
            title: String,
            categoryLabel: String,
            valueLabel: String,
            categories: List<String>,
            unit: String?,
            vararg values: Int,
        ) = Chart(
            chart = Chart.Kind.Bar,
            title = title,
            categoryLabel = categoryLabel,
            valueLabel = valueLabel,
            categories = categories,
            series = listOf(Chart.Series(valueLabel, values.map(Int::toDouble))),
            unit = unit,
        )
    }
}
