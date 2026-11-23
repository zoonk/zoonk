package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanCertificates
import com.zoonk.api.models.StudyNext
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** A finished plan offers its certificate on the line a phone shows, as the panel beside a wider page does. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanStudyNextTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aFinishedPlansLineOffersItsCertificate() {
        show()

        compose.onNodeWithText("Get your certificate").assertIsDisplayed()
    }

    @Test
    fun aClaimFromTheLineThatFailsSaysSoOnTheLine() {
        show(claimFailed = true)

        compose.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()
    }

    /** As main's panel: what to study next under its title, and a start that didn't save said under its buttons. */
    @Test
    fun aNextLevelThatDidNotStartSaysSoInThePanel() {
        show(
            next = """{"nextLevel":{"chapterCount":0,"courseId":"$COURSE","level":"intermediate","title":"Python"},"related":[]}""",
            nextLevel = NextLevelStart.Failed,
            layout = SuggestionLayout.Panel,
        )

        compose.onNodeWithText("Here's what to study next.").assertIsDisplayed()
        compose.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()
    }

    private fun show(
        claimFailed: Boolean = false,
        next: String = """{"nextLevel":null,"related":[]}""",
        nextLevel: NextLevelStart = NextLevelStart.Idle,
        layout: SuggestionLayout = SuggestionLayout.Line,
    ) {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), plan(), summary)
        val next = ApiJson.decodeFromString<StudyNext>(next)
        val certificates = ApiJson.decodeFromString<PlanCertificates>("""{"earned":[],"unclaimed":[{"courseLevel":null}]}""")

        compose.setContent {
            ZoonkTheme {
                val slot =
                    Slot(
                        page,
                        PlanEdits(),
                        PlanLinks(rememberAppNavigator(), page),
                        SlotHost(next = next, certificates = certificates, claimFailed = claimFailed, nextLevel = nextLevel),
                        SlotState(),
                        layout,
                        SlotFocus(),
                    )
                StudyNextSuggestion(next, slot)
            }
        }
    }
}

private const val COURSE = "00000000-0000-0000-0000-000000000001"
