package com.zoonk.android.ui.components

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.unit.LayoutDirection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DropdownMenuRoomTest {
    private val bookFold = Rect(left = 1000f, top = 0f, right = 1010f, bottom = 2000f)
    private val tabletopFold = Rect(left = 0f, top = 1000f, right = 2000f, bottom = 1010f)

    @Test
    fun besideABooksFoldAMenuOpensTowardItsPagesRoom() {
        val endOfFirstPage = Rect(left = 900f, top = 100f, right = 950f, bottom = 150f)
        assertEquals(MenuRoom(rightward = false, width = 950f), bookFold.roomBeside(endOfFirstPage, window = 2000f, LayoutDirection.Ltr))

        val startOfSecondPage = Rect(left = 1050f, top = 100f, right = 1100f, bottom = 150f)
        assertEquals(MenuRoom(rightward = true, width = 950f), bookFold.roomBeside(startOfSecondPage, window = 2000f, LayoutDirection.Ltr))
    }

    @Test
    fun withAsMuchRoomEitherWayAMenuOpensFromItsButtonsStart() {
        val middleOfFirstPage = Rect(left = 475f, top = 100f, right = 525f, bottom = 150f)
        assertEquals(true, bookFold.roomBeside(middleOfFirstPage, window = 2000f, LayoutDirection.Ltr)?.rightward)
        assertEquals(false, bookFold.roomBeside(middleOfFirstPage, window = 2000f, LayoutDirection.Rtl)?.rightward)
    }

    @Test
    fun overATabletopsFoldAMenuDropsOnlyToTheFold() {
        val button = Rect(left = 900f, top = 550f, right = 950f, bottom = 600f)
        assertEquals(MenuRoom(height = 400f), tabletopFold.roomOnHalf(button, MATERIAL_TOP, MATERIAL_BOTTOM, USABLE))
    }

    @Test
    fun aButtonRightOverATabletopsFoldOpensItsMenuUpward() {
        val button = Rect(left = 900f, top = 900f, right = 950f, bottom = 980f)
        assertEquals(MenuRoom(height = 780f, upward = true), tabletopFold.roomOnHalf(button, MATERIAL_TOP, MATERIAL_BOTTOM, USABLE))
    }

    @Test
    fun underATabletopsFoldAMenuTakesTheLargerRoomOnTheFlatHalf() {
        val nearTheFold = Rect(left = 900f, top = 1050f, right = 950f, bottom = 1100f)
        assertEquals(MenuRoom(height = 700f), tabletopFold.roomOnHalf(nearTheFold, MATERIAL_TOP, MATERIAL_BOTTOM, USABLE))

        val nearTheBottom = Rect(left = 900f, top = 1700f, right = 950f, bottom = 1750f)
        assertEquals(MenuRoom(height = 690f), tabletopFold.roomOnHalf(nearTheBottom, MATERIAL_TOP, MATERIAL_BOTTOM, USABLE))
    }

    @Test
    fun aButtonOnTheFoldKeepsMaterialsPlacement() {
        assertNull(
            tabletopFold.roomOnHalf(Rect(left = 900f, top = 980f, right = 950f, bottom = 1030f), MATERIAL_TOP, MATERIAL_BOTTOM, USABLE),
        )
        assertNull(bookFold.roomBeside(Rect(left = 980f, top = 100f, right = 1030f, bottom = 150f), window = 2000f, LayoutDirection.Ltr))
    }

    private companion object {
        const val MATERIAL_TOP = 120f
        const val MATERIAL_BOTTOM = 1800f
        const val USABLE = 160f
    }
}
