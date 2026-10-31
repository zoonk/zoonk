package com.zoonk.android.navigation

import androidx.annotation.DrawableRes
import com.zoonk.android.R

/** The closest Material Symbols to main's lucide icons and Apple's SF Symbols, named below. */
enum class PlaceIcon(
    @param:DrawableRes val icon: Int,
    @param:DrawableRes val selectedIcon: Int,
) {
    /** lucide Sun, SF sun.max. */
    Today(R.drawable.ic_sunny, R.drawable.ic_sunny_filled),

    /** lucide Map, SF map. */
    Plan(R.drawable.ic_map, R.drawable.ic_map_filled),

    /** lucide Smile, SF face.smiling: the buddy's tab until the summary says which buddy it is. */
    Buddy(R.drawable.ic_mood, R.drawable.ic_mood_filled),

    /** lucide NotebookPen, SF square.and.pencil. */
    Mistakes(R.drawable.ic_edit_square, R.drawable.ic_edit_square_filled),

    /** lucide GraduationCap, SF graduationcap. */
    Exam(R.drawable.ic_school, R.drawable.ic_school_filled),

    /** lucide Mic, SF mic. */
    Speaking(R.drawable.ic_mic, R.drawable.ic_mic_filled),

    /** lucide Network, SF point.3.connected.trianglepath.dotted. */
    MindMaps(R.drawable.ic_lan, R.drawable.ic_lan_filled),

    /** lucide ChartNoAxesColumn, SF chart.bar. */
    Statistics(R.drawable.ic_bar_chart, R.drawable.ic_bar_chart_filled),
}
