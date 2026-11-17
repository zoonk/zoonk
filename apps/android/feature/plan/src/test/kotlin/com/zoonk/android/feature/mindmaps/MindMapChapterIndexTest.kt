package com.zoonk.android.feature.mindmaps
import org.junit.Assert.assertEquals
import org.junit.Test

class MindMapChapterIndexTest {
    @Test fun everyRowShownInTheChapterGroupBelongsToItsCount() {
        val maps =
            goalMindMaps(
                listOf(
                    mapJson(1, "Motion", "ready"),
                    mapJson(2, "Waves", "available"),
                    mapJson(3, "Light", "drawing"),
                    mapJson(4, "Optics", "available", lessonsToWrite = 2),
                ),
            )
        assertEquals(3, maps.chapterIndex().sumOf { it.rows.size })
    }
}
