package com.zoonk.android.feature.today
import org.junit.Assert.assertFalse
import org.junit.Test

class TodayWeekVisibilityTest {
    @Test fun noWeekRowsMeansNoEmptyWeekSection() {
        assertFalse(showsWeek(emptyList()))
    }
}
