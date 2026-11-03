package com.zoonk.android.feature.certificates

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PictureFileNameTest {
    @Test
    fun aShortNameKeepsEveryPart() {
        assertEquals("Ana Souza - Python - Zoonk.png", pictureFileName(listOf("Ana Souza", "Python", "Zoonk")))
    }

    @Test
    fun aLongJapaneseNameFitsAndroidsByteLimit() {
        val parts = listOf("山田花子", "量子物理学".repeat(40), "Zoonk")
        val name = pictureFileName(parts)

        assertTrue(name.encodeToByteArray().size <= 255)
        assertTrue(name.endsWith(".png"))
        assertTrue(parts.joinToString(" - ").startsWith(name.removeSuffix(".png")))
    }

    @Test
    fun theCutNeverSplitsALetterOutsideTheBasicPlane() {
        assertEquals("a".repeat(198) + ".png", pictureFileName(listOf("a".repeat(198) + "😀😀")))
    }
}
