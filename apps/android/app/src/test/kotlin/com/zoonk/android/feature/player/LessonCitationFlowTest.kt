package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.model.StepCitation
import com.zoonk.api.ApiJson
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonCitationFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun citation(json: String) = ApiJson.decodeFromString<StepCitation>(json)

    @Test
    fun namesThePageOfTheLearnersMaterialAScreenComesFrom() {
        val fromSlides = citation("""{"kind":"material","page":3,"title":"Cells.pptx","unit":"slide"}""")
        val fromBook = citation("""{"kind":"material","page":12,"title":"Biology.pdf","unit":"page"}""")
        val fromNotes = citation("""{"kind":"material","page":null,"title":"My notes","unit":"section"}""")

        harness.play(
            listOf(
                explanationStep("slides").copy(citation = fromSlides),
                explanationStep("book").copy(citation = fromBook),
                explanationStep("notes").copy(citation = fromNotes),
                explanationStep("beyond").copy(citation = citation("""{"kind":"notInMaterial"}""")),
            ),
        )

        rule.onNodeWithContentDescription("From your material: Cells.pptx, slide 3").assertIsDisplayed()
        harness.tap("Next")
        rule.onNodeWithContentDescription("From your material: Biology.pdf, page 12").assertIsDisplayed()
        harness.tap("Next")
        rule.onNodeWithContentDescription("From your material: My notes").assertIsDisplayed()
        harness.tap("Next")
        rule.onNodeWithText("Not in your material").assertIsDisplayed()
    }

    @Test
    fun datesAScreenBuiltFromALawAndOpensTheLawFromItsSourcesChip() {
        val fromLaw =
            citation(
                """
                {"kind":"source","checkedAt":"2026-09-12T10:00:00.000Z","publisher":"Planalto","title":"Law 8,112",
                 "url":"https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm"}
                """.trimIndent(),
            )

        harness.play(listOf(explanationStep("law").copy(citation = fromLaw), checkStep("quiz")))

        harness.tap("Sources\u00A0· Checked Sep 2026")

        rule.onNodeWithText("Law 8,112").assertIsDisplayed()
        rule.onNodeWithText("Planalto\u00A0· Checked Sep 12, 2026").assertIsDisplayed()
        rule.onNodeWithText("Open the source").assertIsDisplayed()
    }
}
