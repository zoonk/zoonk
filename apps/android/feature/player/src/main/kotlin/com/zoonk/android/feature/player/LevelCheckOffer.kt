package com.zoonk.android.feature.player

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionCard
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionMainAction
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.api.models.LibraryLessonCompletionPlacementOffer

/** A level test-out names its level; the quick test takes none. */
private val LibraryLessonCompletionPlacementOffer.level: String?
    get() = (this as? LibraryLessonCompletionPlacementOffer.LibraryLessonCompletionPlacementOfferOneOf1Value)?.value?.level?.value

/** Where the offer opens: the test of what the learner knows, or a level's test-out with that choice picked. */
internal fun LibraryLessonCompletionPlacementOffer.route(): AppRoute =
    when (this) {
        is LibraryLessonCompletionPlacementOffer.LibraryLessonCompletionPlacementOfferOneOfValue -> {
            AppRoute.PlacementTest(value.goalId.toString())
        }

        is LibraryLessonCompletionPlacementOffer.LibraryLessonCompletionPlacementOfferOneOf1Value -> {
            AppRoute.LevelTest(value.goalId.toString(), testOut = true)
        }
    }

/**
 * Main's `LevelCheckOfferCard`: after a run of easy lessons, a lesson's end offers a check that can
 * skip what the learner already knows. "Not now" is saved, so the same offer waits until something new happens.
 */
@Composable
internal fun LevelCheckOffer(
    offer: LibraryLessonCompletionPlacementOffer,
    dismissing: Boolean,
    failed: Boolean,
    onOpen: (AppRoute) -> Unit,
    onDismiss: () -> Unit,
) {
    val level = offer.level
    val title = stringResource(R.string.placementtest_offer_title)
    SuggestionCard(label = title, card = {
        SuggestionHeader(title)
        SuggestionDescription(
            if (level !=
                null
            ) {
                stringResource(R.string.placementtest_offer_level, level)
            } else {
                stringResource(R.string.placementtest_offer_quick)
            },
        )
        if (failed) SuggestionSaveError()
        SuggestionActions {
            SuggestionMainAction(
                if (level !=
                    null
                ) {
                    stringResource(R.string.placementtest_test_out, level)
                } else {
                    stringResource(R.string.placementtest_check_my_level)
                },
                onClick = { onOpen(offer.route()) },
                enabled = !dismissing,
            )
            SuggestionAction(stringResource(R.string.placementtest_not_now), onDismiss, busy = dismissing, secondary = true)
        }
    })
}
