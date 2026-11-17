package com.zoonk.android.feature.mindmaps
import org.junit.Assert.assertFalse
import org.junit.Test

class MindMapAdvanceTest {
    @Test fun aMapStillLoadingCannotBeSkippedByNext() {
        assertFalse(Slide.Loading(null).canAdvance)
    }
}
