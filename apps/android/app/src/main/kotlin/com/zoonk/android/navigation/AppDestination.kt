package com.zoonk.android.navigation

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import com.zoonk.android.R

enum class AppDestination(
    @param:DrawableRes val iconResource: Int,
    @param:StringRes val labelResource: Int,
) {
    Home(
        iconResource = R.drawable.ic_home,
        labelResource = R.string.navigation_home,
    ),
    NewCourse(
        iconResource = R.drawable.ic_add_circle,
        labelResource = R.string.navigation_new,
    ),
    Courses(
        iconResource = R.drawable.ic_school,
        labelResource = R.string.navigation_courses,
    ),
    Progress(
        iconResource = R.drawable.ic_show_chart,
        labelResource = R.string.navigation_progress,
    ),
}
