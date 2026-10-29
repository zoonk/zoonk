package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `@zoonk/utils/seeded-random` returns for the same input. */
class SeededRandomTest {
    @Test
    fun drawsTheSameNumbersAsMain() {
        val random = seededRandom(42)
        assertEquals(listOf(0.0009665507832230542, 0.6563953130099879, 0.8581620285829176), List(3) { random() })

        val negative = seededRandom(-8)
        assertEquals(listOf(0.00020230095852380708, 0.7652920421820991), List(2) { negative() })
    }

    @Test
    fun hashesTextByUtf16CodeUnitsLikeMain() {
        assertEquals(
            listOf(0L, 3317598L, 2011610014L, 90630118L, 941500669L, 119756097L),
            listOf("", "leaf", "i1 i2 i3", "a b c", "🌱 sprout", "x𝄞y").map(::hashSeed),
        )
    }

    @Test
    fun shufflesInMainsOrder() {
        val items = listOf("a", "b", "c", "d", "e", "f")
        assertEquals(listOf("b", "a", "f", "d", "c", "e"), seededShuffle(items, "leaf"))
        assertEquals(listOf("e", "b", "c", "d", "f", "a"), seededShuffle(items, "i1 i2 i3"))
        assertEquals(listOf("f", "d", "c", "b", "e", "a"), seededShuffle(items, "🌱 sprout"))
        assertEquals(listOf("b", "d", "c", "a", "f", "e"), seededShuffle(items, "x𝄞y"))
    }
}
