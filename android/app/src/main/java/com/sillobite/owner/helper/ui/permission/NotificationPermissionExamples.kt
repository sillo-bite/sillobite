package com.sillobite.owner.helper.ui.permission

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Example: Permission Request Screen After Login
 * 
 * Shows a full-screen UI explaining the notification permission
 * before requesting it from the user.
 */
@Composable
fun NotificationPermissionExplanationScreen(
    onPermissionGranted: () -> Unit,
    onSkip: () -> Unit
) {
    var requestPermission by remember { mutableStateOf(false) }

    if (requestPermission) {
        // Show the actual permission request
        NotificationPermissionHandler { granted ->
            if (granted) {
                onPermissionGranted()
            } else {
                // Permission denied, allow user to skip
                onSkip()
            }
        }
    } else {
        // Show explanation screen first
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Notifications,
                contentDescription = "Notifications",
                modifier = Modifier.size(120.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "Stay Updated on Orders",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Enable notifications to receive instant alerts when:\n" +
                        "• New orders arrive\n" +
                        "• Order status changes\n" +
                        "• Payment is confirmed",
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(48.dp))

            Button(
                onClick = { requestPermission = true },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Enable Notifications")
            }

            Spacer(modifier = Modifier.height(16.dp))

            TextButton(onClick = onSkip) {
                Text("Skip for Now")
            }
        }
    }
}

/**
 * Example: Inline Permission Request in MainActivity
 * 
 * Request permission after successful login, before starting monitoring service.
 */
@Composable
fun MainAppWithPermission(
    isAuthenticated: Boolean,
    onLogout: () -> Unit,
    content: @Composable () -> Unit
) {
    var permissionChecked by remember { mutableStateOf(false) }
    var hasPermission by remember { mutableStateOf(false) }

    if (isAuthenticated && !permissionChecked) {
        // Request permission after login
        NotificationPermissionHandler { granted ->
            hasPermission = granted
            permissionChecked = true
        }
    } else if (isAuthenticated && permissionChecked) {
        // Permission checked, show main content
        content()
        
        // If permission was denied, show a snackbar
        if (!hasPermission) {
            Snackbar(
                action = {
                    TextButton(onClick = { /* Re-request or open settings */ }) {
                        Text("Enable")
                    }
                }
            ) {
                Text("Notifications disabled. You may miss order alerts.")
            }
        }
    } else {
        // Not authenticated, show login screen
        // LoginScreen()
    }
}

/**
 * Example: Check Permission Before Starting Service
 * 
 * Usage in ViewModel or Service initialization:
 */
/*
class HomeViewModel(private val context: Context) : ViewModel() {
    
    fun startOrderMonitoring() {
        // Check permission before starting service
        if (!context.hasNotificationPermission()) {
            Log.w(TAG, "Notification permission not granted, service may not show notifications")
            // Still start service, but notifications won't be visible
        }
        
        // Start OrderNotificationService
        val intent = Intent(context, OrderNotificationService::class.java).apply {
            action = OrderNotificationService.ACTION_START_SERVICE
            putExtra(OrderNotificationService.EXTRA_CANTEEN_ID, canteenId)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
}
*/

/**
 * Example: Permission Request in Settings Screen
 * 
 * Allow users to grant permission later from settings.
 */
@Composable
fun SettingsScreenWithPermission() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val hasPermission = context.hasNotificationPermission()
    var showPermissionDialog by remember { mutableStateOf(false) }

    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            text = "Notification Settings",
            style = MaterialTheme.typography.titleLarge
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Notification Permission Status
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Order Notifications",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = if (hasPermission) "Enabled" else "Disabled",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (hasPermission) 
                            MaterialTheme.colorScheme.primary 
                        else 
                            MaterialTheme.colorScheme.error
                    )
                }

                if (!hasPermission) {
                    Button(onClick = { showPermissionDialog = true }) {
                        Text("Enable")
                    }
                } else {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                        contentDescription = "Enabled",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }

    // Show permission dialog
    if (showPermissionDialog) {
        NotificationPermissionHandler { granted ->
            showPermissionDialog = false
            // Handle result if needed
        }
    }
}

/**
 * Example: Request Permission in MainActivity onCreate
 * 
 * ```kotlin
 * class MainActivity : ComponentActivity() {
 *     override fun onCreate(savedInstanceState: Bundle?) {
 *         super.onCreate(savedInstanceState)
 *         
 *         setContent {
 *             CanteenOwnerHelperTheme {
 *                 var permissionGranted by remember { mutableStateOf(false) }
 *                 var permissionChecked by remember { mutableStateOf(false) }
 *                 
 *                 LaunchedEffect(Unit) {
 *                     permissionChecked = false
 *                 }
 *                 
 *                 if (!permissionChecked) {
 *                     NotificationPermissionHandler { granted ->
 *                         permissionGranted = granted
 *                         permissionChecked = true
 *                         
 *                         if (granted) {
 *                             // Start monitoring service
 *                             startOrderMonitoringService()
 *                         }
 *                     }
 *                 } else {
 *                     // Show main app content
 *                     HomeScreen()
 *                 }
 *             }
 *         }
 *     }
 * }
 * ```
 */
