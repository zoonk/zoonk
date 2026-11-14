package com.zoonk.android.ui.testing

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.theme.ZoonkTheme
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** What a render's layout capture says about a list row, and what it refuses to say. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class LayoutCaptureTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private var shots: String? = null

    @Before
    fun writeLayouts() {
        shots = System.getProperty("zoonk.shots")
        System.setProperty("zoonk.shots", folder.root.path)
    }

    @After
    fun restore() {
        shots?.let { System.setProperty("zoonk.shots", it) } ?: System.clearProperty("zoonk.shots")
    }

    @Test
    fun aRowsPartsCarryTheirBoundsLinesAndTheFontsCapHeight() {
        val parts = capture { ListRow(headline = { Text("Mixed practice") }, meta = { Text("12 min") }, onClick = {}) }

        val label = parts.part("label")
        val value = parts.part("value")
        assertEquals("Mixed practice", label.getString("text"))
        assertEquals(1, label.getInt("lines"))
        assertEquals("Geist 14 500 20", label.getString("type"))
        assertEquals("GeistMono 12 400 16", value.getString("type"))
        // Geist's capitals are 710 of its 1000 units, read from the font file, not from the words' ink.
        assertEquals(14 * 0.71, label.getDouble("capBottom") - label.getDouble("capTop"), 0.01)
        assertEquals(label.getDouble("baseline"), label.getDouble("capBottom"), 0.0)
        assertTrue(parts.has("end"))
        assertEquals(false, parts.part("row").getBoolean("note"))
    }

    @Test
    fun aRowThatReplacesItsChildrensSemanticsIsWrittenAsUnmeasured() {
        val parts =
            capture {
                ListRow(
                    headline = { Text("Mixed practice") },
                    meta = { Text("12 min") },
                    modifier = Modifier.clearAndSetSemantics { contentDescription = "Mixed practice, 12 minutes" },
                )
            }

        assertTrue(parts.has("unmeasured"))
        assertTrue(!parts.has("label") && !parts.has("value"))
    }

    @Test
    fun clippedTextKeepsItsBaselineAndHasNoInk() {
        val parts =
            capture {
                Box(Modifier.height(10.dp).clipToBounds()) {
                    ListRow(headline = { Text("Mixed practice") }, meta = { Text("12 min") })
                }
            }

        listOf(parts.part("label"), parts.part("value")).forEach { text ->
            assertEquals(NOT_MEASURED, text.getString("ink"))
            // Laid out from the font, not read from pixels: still real when the pixels are cut off.
            assertTrue(text.get("baseline") is Number)
        }
    }

    @Test
    fun textAFallbackFontDrewHasNoCapitals() {
        val labels =
            capture {
                ListRow(headline = { Text("日本語の練習") })
                ListRow(headline = { Text("Kanji 漢字") })
            }.elements().filter { it.getString("part") == "label" }

        assertEquals(2, labels.size)
        labels.forEach { label ->
            assertEquals(NOT_MEASURED, label.getString("capTop"))
            assertEquals(NOT_MEASURED, label.getString("capBottom"))
            assertTrue(label.get("baseline") is Number)
        }
    }

    @Test
    fun aPictureWithoutItsFramesCaptureSaysItIsNotMeasured() {
        compose.setContent { ZoonkTheme { ListRow(headline = { Text("Copy") }) } }
        val copy =
            compose
                .onRoot()
                .captureRender()
                .asAndroidBitmap()
                .copy(Bitmap.Config.ARGB_8888, true)
        writeRender(File(folder.root, "copied.png"), copy)

        val record = JSONObject(File(folder.root, "copied.json").readText())
        assertEquals("copied.png", record.getJSONObject("picture").getString("file"))
        assertEquals(NOT_MEASURED, record.getString("elements"))
        assertTrue(record.getString("reason").isNotEmpty())
    }

    private fun capture(content: @androidx.compose.runtime.Composable () -> Unit): JSONArray {
        compose.setContent { ZoonkTheme { Column { content() } } }
        val file = File(folder.root, "row.png")
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
        return JSONObject(File(folder.root, "row.json").readText()).getJSONArray("elements")
    }

    private fun JSONArray.elements() = (0 until length()).map { getJSONObject(it) }

    private fun JSONArray.has(part: String) = elements().any { it.getString("part") == part }

    private fun JSONArray.part(part: String) = elements().first { it.getString("part") == part }
}

private const val NOT_MEASURED = "not measured"
