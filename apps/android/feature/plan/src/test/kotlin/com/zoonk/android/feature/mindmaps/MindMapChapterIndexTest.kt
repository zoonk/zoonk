package com.zoonk.android.feature.mindmaps
import org.junit.Assert.assertEquals
import org.junit.Test

class MindMapChapterIndexTest {
    @Test fun theChapterIndexListsOnlyTheChaptersWhoseMapIsReady() {
        val maps =
            goalMindMaps(
                listOf(
                    mapJson(1, "Motion", "ready"),
                    mapJson(2, "Waves", "available"),
                    mapJson(3, "Light", "drawing"),
                    mapJson(4, "Optics", "available", lessonsToWrite = 2),
                ),
            )
        assertEquals(listOf("Motion"), maps.chapterIndex().flatMap { group -> group.rows.map { it.title } })
    }
}
