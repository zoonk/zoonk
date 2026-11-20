package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanChangePreview
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** The shared check every plan suggestion's preview shows (coverage, a past date, the fit offer's answer). */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanPreviewResultTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    private val plan = plan()
    private val operations = listOf<PlanOp>(PlanOp.DailyMinutes(75))

    @Test
    fun aCheckHoldsItsAnswersRoomAndItsButtonsInPlace() {
        val asked = PlanPreviewState.Loading(operations, plan)
        var state by mutableStateOf<PlanPreviewState>(asked)
        compose.setContent {
            ZoonkTheme {
                Column(Modifier.width(CARD_WIDTH).testTag(CARD)) {
                    PlanPreviewResult(state = state, onApply = {}, onRetry = {}, onDismiss = {})
                }
            }
        }
        compose.onNodeWithText("Change my plan").assertIsNotEnabled()
        val checking = layout()

        state = asked.resolve(asked, answer())
        compose.waitForIdle()

        assertEquals(checking, layout())
    }

    private fun answer() =
        PlanChangePreview(
            finishDate = null,
            effect = ApiJson.decodeFromString(effect(""""lessonsAdded":14,"endDateBefore":"2027-01-31","endDateAfter":"2027-04-18"""")),
            feasibility = null,
            ready = true,
            unchanged = false,
        )

    /** The card's height and where its buttons sit. */
    private fun layout() =
        Triple(
            compose.onNodeWithTag(CARD).getUnclippedBoundsInRoot(),
            compose.onNodeWithText("Change my plan").getUnclippedBoundsInRoot(),
            compose.onNodeWithText("Not now").getUnclippedBoundsInRoot(),
        )

    private companion object {
        const val CARD = "card"

        /** A phone's suggestion panel: the page's width less its margins and the card's padding. */
        val CARD_WIDTH = 339.dp
    }
}
