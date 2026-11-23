package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.components.TextButton
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
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    stringResource(R.string.placementtest_offer_title),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    if (level != null) {
                        stringResource(R.string.placementtest_offer_level, level)
                    } else {
                        stringResource(R.string.placementtest_offer_quick)
                    },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onOpen(offer.route()) }, enabled = !dismissing) {
                    Text(
                        if (level != null) {
                            stringResource(R.string.placementtest_test_out, level)
                        } else {
                            stringResource(R.string.placementtest_title)
                        },
                    )
                }
                TextButton(onClick = onDismiss, busy = dismissing) { Text(stringResource(R.string.placementtest_not_now)) }
            }
            if (failed) SuggestionSaveError()
        }
    }
}
