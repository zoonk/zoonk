package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test

class ActivityBandTest {
    @Test fun aDayWithoutStudyStaysEmptyWhateverItsTime() {
        assertEquals(0, activityBand(studied = false, seconds = 120, maximumSeconds = 600))
    }

    @Test fun aLongerStudyDayIsDarker() {
        assertEquals(1, activityBand(studied = true, seconds = 60, maximumSeconds = 600))
        assertEquals(2, activityBand(studied = true, seconds = 300, maximumSeconds = 600))
        assertEquals(3, activityBand(studied = true, seconds = 360, maximumSeconds = 600))
        assertEquals(4, activityBand(studied = true, seconds = 600, maximumSeconds = 600))
    }

    /** Older imported days have lessons but no recorded time. */
    @Test fun aStudyDayWithoutRecordedTimeStillShowsTheLightestShade() {
        assertEquals(1, activityBand(studied = true, seconds = 0, maximumSeconds = 600))
        assertEquals(1, activityBand(studied = true, seconds = 0, maximumSeconds = 0))
    }
}
