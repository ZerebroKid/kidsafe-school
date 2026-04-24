package com.kidsafe.blocker

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.kidsafe.R

/**
 * Full-screen overlay shown by [AppBlockerService] when the child opens a blocked app. Mirrors the
 * original [Application/app/.../BlockedAppActivity.java] behaviour: it simply displays a friendly
 * message and a "Go back" button that sends the user to the home screen.
 */
class BlockedAppActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked)

        val pkg = intent.getStringExtra(EXTRA_PACKAGE)
        val appName = pkg?.let(::resolveAppName) ?: "This app"
        findViewById<TextView>(R.id.blocked_app_name).text = appName

        findViewById<Button>(R.id.blocked_home_button).setOnClickListener {
            goHome()
        }
    }

    override fun onBackPressed() {
        goHome()
    }

    private fun goHome() {
        val home = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(home)
        finish()
    }

    private fun resolveAppName(pkg: String): String? = try {
        val pm = packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (_: PackageManager.NameNotFoundException) {
        null
    }

    companion object {
        const val EXTRA_PACKAGE = "extra_package"
    }
}
