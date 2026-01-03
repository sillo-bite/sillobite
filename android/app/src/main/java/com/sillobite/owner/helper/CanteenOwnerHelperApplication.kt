package com.sillobite.owner.helper

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import com.sillobite.owner.helper.data.local.TokenStorage

/**
 * Custom Application class for CanteenOwnerHelper
 * 
 * Responsibilities:
 * - Initialize notification channels
 * - Setup app-wide configurations
 * - Initialize crash reporting (if needed)
 * - Provide singleton TokenStorage instance
 */
class CanteenOwnerHelperApplication : Application() {

    companion object {
        private const val TAG = "CanteenOwnerHelperApp"
        
        // Notification Channel IDs
        const val CHANNEL_ID_ORDER_NOTIFICATIONS = "order_notifications"
        const val CHANNEL_ID_SERVICE = "foreground_service"
        
        // Singleton TokenStorage instance
        // MUST be singleton to avoid multiple DataStore instances for same file
        @Volatile
        private var tokenStorageInstance: TokenStorage? = null
        
        /**
         * Get singleton TokenStorage instance
         * Thread-safe double-checked locking pattern
         */
        fun getTokenStorage(application: Application): TokenStorage {
            return tokenStorageInstance ?: synchronized(this) {
                tokenStorageInstance ?: TokenStorage(application.applicationContext).also {
                    tokenStorageInstance = it
                }
            }
        }
    }

    // Public access to singleton TokenStorage
    lateinit var tokenStorage: TokenStorage
        private set

    override fun onCreate() {
        super.onCreate()
        
        Log.d(TAG, "Application initialized")
        
        // Initialize singleton TokenStorage
        tokenStorage = getTokenStorage(this)
        
        // Create notification channels for Android 8.0+
        createNotificationChannels()
    }

    /**
     * Create notification channels required for the app
     * Required for Android 8.0 (API 26) and above
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            
            // Channel for order notifications (high priority)
            val orderChannel = NotificationChannel(
                CHANNEL_ID_ORDER_NOTIFICATIONS,
                "Order Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new orders and order updates"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 500)
                enableLights(true)
                lightColor = android.graphics.Color.RED
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setBypassDnd(true) // Bypass Do Not Disturb
            }
            
            // Channel for foreground service (low priority)
            val serviceChannel = NotificationChannel(
                CHANNEL_ID_SERVICE,
                "Service Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when the notification service is running"
                enableVibration(false)
                enableLights(false)
                setShowBadge(false)
            }
            
            // Register channels with system
            notificationManager.createNotificationChannel(orderChannel)
            notificationManager.createNotificationChannel(serviceChannel)
            
            Log.d(TAG, "Notification channels created")
        }
    }
}
