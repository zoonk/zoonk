package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.LearnerSummaryMissions

/**
 * The Buddy tab's icon: the buddy's still face, ringed by today's missions on a day that has any.
 * Decorative, as the tab's label names it; [buddyTabMissions] is what TalkBack says of the ring.
 */
@Composable
fun BuddyTabIcon(
    buddy: LearnerSummaryBuddy,
    missions: LearnerSummaryMissions?,
    modifier: Modifier = Modifier,
) {
    Box(modifier.size(ICON_SIZE), contentAlignment = Alignment.Center) {
        if (missions == null) {
            Buddy(buddy.look(), Modifier.fillMaxSize(), crop = BuddyCrop.Face)
        } else {
            MissionsRing(missions.done.toInt(), missions.total.toInt(), Modifier.requiredSize(RING_SIZE)) {
                Buddy(buddy.look(), Modifier.size(RINGED_FACE_SIZE), crop = BuddyCrop.Face)
            }
        }
    }
}

/** Main's screen-reader words for the ring, said after the tab's name: "1 of 3 missions today". */
@Composable
fun buddyTabMissions(missions: LearnerSummaryMissions?): String? {
    missions ?: return null
    val locale = currentLocale()

    return pluralStringResource(
        R.plurals.buddy_tab_missions,
        missions.done.toInt(),
        formatNumber(missions.done.toDouble(), locale),
        formatNumber(missions.total.toDouble(), locale),
    )
}

private val ICON_SIZE = 24.dp

// Main's ring (32 px) reaches past its tab glyph's box (28 px) so the face in it (24 px) stays big.
private val RING_SIZE = ICON_SIZE * 32 / 28
private val RINGED_FACE_SIZE = ICON_SIZE * 24 / 28
