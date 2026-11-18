package com.zoonk.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.Visit
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OnVisitEndTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun replacingTheOwnerEndsOnlyTheDepartingVisit() {
        val departing = Visit()
        val replacement = Visit()
        val owner = mutableStateOf(departing)

        compose.setContent {
            val visit = owner.value
            OnVisitEnd(visit, onEnd = visit::end)
        }

        compose.runOnIdle { owner.value = replacement }

        compose.runOnIdle {
            assertEquals(listOf(1, 0), listOf(departing.number, replacement.number))
        }
    }
}
