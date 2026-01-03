package com.sillobite.owner.helper.ui.permission

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Check if notification permission is granted
 * 
 * For Android 13+ (API 33+): Checks POST_NOTIFICATIONS permission
 * For Android 12 and below: Always returns true (auto-granted)
 */
fun Context.hasNotificationPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    } else {
        // Below Android 13, permission is auto-granted
        true
    }
}

/**
 * Check if should show permission rationale
 */
fun Activity.shouldShowNotificationRationale(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        )
    } else {
        false
    }
}

/**
 * Open app settings page
 */
fun Context.openAppSettings() {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", packageName, null)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    startActivity(intent)
}

/**
 * Composable function to handle notification permission request
 * 
 * Flow:
 * 1. Check if permission already granted → Return true
 * 2. Check if should show rationale → Show rationale dialog
 * 3. Request permission
 * 4. Handle result (granted/denied)
 * 5. If permanently denied → Offer settings navigation
 * 
 * @param onPermissionResult Callback with permission result (true = granted, false = denied)
 */
@Composable
fun NotificationPermissionHandler(
    onPermissionResult: (Boolean) -> Unit
) {
    // Only request permission on Android 13+
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        LaunchedEffect(Unit) {
            onPermissionResult(true)
        }
        return
    }

    val context = LocalContext.current
    val activity = context as? Activity

    var showRationaleDialog by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }
    var permissionRequested by remember { mutableStateOf(false) }

    // Permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            onPermissionResult(true)
        } else {
            // Check if permission is permanently denied
            val shouldShowRationale = activity?.shouldShowNotificationRationale() ?: false
            if (!shouldShowRationale && permissionRequested) {
                // Permission permanently denied, show settings dialog
                showSettingsDialog = true
            } else {
                onPermissionResult(false)
            }
        }
    }

    // Check permission status on mount
    LaunchedEffect(Unit) {
        val hasPermission = context.hasNotificationPermission()
        if (hasPermission) {
            onPermissionResult(true)
        } else {
            // Check if should show rationale
            val shouldShowRationale = activity?.shouldShowNotificationRationale() ?: false
            if (shouldShowRationale) {
                showRationaleDialog = true
            } else {
                // Request permission directly
                permissionRequested = true
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    // Rationale Dialog
    if (showRationaleDialog) {
        NotificationPermissionRationaleDialog(
            onConfirm = {
                showRationaleDialog = false
                permissionRequested = true
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            },
            onDismiss = {
                showRationaleDialog = false
                onPermissionResult(false)
            }
        )
    }

    // Settings Dialog (for permanently denied permission)
    if (showSettingsDialog) {
        NotificationPermissionSettingsDialog(
            onOpenSettings = {
                showSettingsDialog = false
                context.openAppSettings()
            },
            onDismiss = {
                showSettingsDialog = false
                onPermissionResult(false)
            }
        )
    }
}

/**
 * Rationale dialog explaining why notification permission is needed
 */
@Composable
private fun NotificationPermissionRationaleDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Notification Permission Required")
        },
        text = {
            Text(
                "This app needs notification permission to alert you when new orders arrive. " +
                "Without this permission, you may miss important orders."
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Allow")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Deny")
            }
        }
    )
}

/**
 * Settings dialog shown when permission is permanently denied
 */
@Composable
private fun NotificationPermissionSettingsDialog(
    onOpenSettings: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Notification Permission Denied")
        },
        text = {
            Text(
                "Notification permission is required to receive order alerts. " +
                "Please enable it in app settings:\n\n" +
                "Settings → Apps → Canteen Owner Helper → Permissions → Notifications"
            )
        },
        confirmButton = {
            TextButton(onClick = onOpenSettings) {
                Text("Open Settings")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Full-screen permission request composable
 * Can be used as a dedicated screen after login
 */
@Composable
fun NotificationPermissionScreen(
    onPermissionGranted: () -> Unit,
    onPermissionDenied: () -> Unit
) {
    NotificationPermissionHandler { granted ->
        if (granted) {
            onPermissionGranted()
        } else {
            onPermissionDenied()
        }
    }
}
