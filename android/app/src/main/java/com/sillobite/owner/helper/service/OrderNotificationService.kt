package com.sillobite.owner.helper.service

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sillobite.owner.helper.CanteenOwnerHelperApplication
import com.sillobite.owner.helper.MainActivity
import com.sillobite.owner.helper.R

/**
 * Foreground service for handling order notifications
 * 
 * Purpose:
 * - Maintain foreground service for critical order monitoring
 * - Display notifications for new orders
 * - Play alarm sounds and vibrate for critical orders
 * 
 * Service Type: DATA_SYNC
 * - Defined in AndroidManifest with foregroundServiceType="dataSync"
 * 
 * Lifecycle:
 * - Started when user logs in successfully
 * - Updated when new orders arrive
 * - Stopped when user logs out or explicitly stops the service
 */
class OrderNotificationService : Service() {

    companion object {
        private const val TAG = "OrderNotificationService"
        private const val SERVICE_NOTIFICATION_ID = 1001
        private const val ORDER_NOTIFICATION_BASE_ID = 2000
        
        // Service actions
        const val ACTION_START_SERVICE = "com.sillobite.owner.helper.action.START_SERVICE"
        const val ACTION_STOP_SERVICE = "com.sillobite.owner.helper.action.STOP_SERVICE"
        const val ACTION_NEW_ORDER = "com.sillobite.owner.helper.action.NEW_ORDER"
        const val ACTION_UPDATE_COUNT = "com.sillobite.owner.helper.action.UPDATE_COUNT"
        const val ACTION_STOP_ALARM = "com.sillobite.owner.helper.action.STOP_ALARM"
        
        // Intent extras
        const val EXTRA_CANTEEN_ID = "canteen_id"
        const val EXTRA_ORDER_NUMBER = "order_number"
        const val EXTRA_ORDER_COUNT = "order_count"
        const val EXTRA_CUSTOMER_NAME = "customer_name"
        const val EXTRA_AMOUNT = "amount"
    }

    private var isServiceRunning = false
    private var activeOrderCount = 0
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        
        // Initialize vibrator
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SERVICE -> {
                val canteenId = intent.getStringExtra(EXTRA_CANTEEN_ID)
                val orderCount = intent.getIntExtra(EXTRA_ORDER_COUNT, 0)
                
                Log.d(TAG, "Starting service for canteen: $canteenId, orders: $orderCount")
                
                activeOrderCount = orderCount
                startForegroundService()
                isServiceRunning = true
            }
            
            ACTION_NEW_ORDER -> {
                val orderNumber = intent.getStringExtra(EXTRA_ORDER_NUMBER) ?: "Unknown"
                val customerName = intent.getStringExtra(EXTRA_CUSTOMER_NAME) ?: "Guest"
                val amount = intent.getDoubleExtra(EXTRA_AMOUNT, 0.0)
                val orderCount = intent.getIntExtra(EXTRA_ORDER_COUNT, 0)
                val repeatMode = intent.getBooleanExtra("EXTRA_REPEAT_MODE", false)
                
                Log.d(TAG, "New order received: #$orderNumber from $customerName, repeat=$repeatMode")
                
                activeOrderCount = orderCount
                updateServiceNotification()
                
                // Play alarm sound (with repeat mode)
                playAlarmSound(repeatMode)
                
                // Vibrate device
                vibrateDevice()
                
                // Show order notification
                showOrderNotification(orderNumber, customerName, amount)
            }
            
            ACTION_UPDATE_COUNT -> {
                val orderCount = intent.getIntExtra(EXTRA_ORDER_COUNT, 0)
                
                Log.d(TAG, "Updating order count: $orderCount")
                
                activeOrderCount = orderCount
                updateServiceNotification()
            }
            
            ACTION_STOP_SERVICE -> {
                Log.d(TAG, "Stopping service")
                stopForegroundService()
            }
            
            ACTION_STOP_ALARM -> {
                Log.d(TAG, "Stopping alarm sound")
                releaseMediaPlayer()
            }
        }
        
        // If service is killed by system, restart it
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        // This service doesn't support binding
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        
        // Release media player
        releaseMediaPlayer()
        
        Log.d(TAG, "Service destroyed")
    }

    /**
     * Start service in foreground mode with persistent notification
     */
    private fun startForegroundService() {
        val notification = createServiceNotification()
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ requires specifying service type
            startForeground(SERVICE_NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, notification)
        }
        
        Log.d(TAG, "Foreground service started")
    }
    
    /**
     * Update service notification with current order count
     */
    private fun updateServiceNotification() {
        val notification = createServiceNotification()
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(SERVICE_NOTIFICATION_ID, notification)
        
        Log.d(TAG, "Service notification updated: $activeOrderCount orders")
    }

    /**
     * Stop foreground service
     */
    private fun stopForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    /**
     * Create persistent notification for foreground service
     */
    private fun createServiceNotification(): Notification {
        // Intent to open app when notification is clicked
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            pendingIntentFlags
        )
        
        val contentText = if (activeOrderCount > 0) {
            "$activeOrderCount active ${if (activeOrderCount == 1) "order" else "orders"}"
        } else {
            "Listening for new orders..."
        }
        
        return NotificationCompat.Builder(this, CanteenOwnerHelperApplication.CHANNEL_ID_SERVICE)
            .setContentTitle("Order Monitoring Active")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // Cannot be dismissed by user
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    /**
     * Show notification for new order with sound and vibration
     */
    private fun showOrderNotification(orderNumber: String, customerName: String, amount: Double) {
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        
        // Intent to open app when notification is clicked
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("ORDER_NUMBER", orderNumber)
        }
        
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            orderNumber.hashCode(),
            intent,
            pendingIntentFlags
        )
        
        // Intent to stop alarm sound
        val stopAlarmIntent = Intent(this, OrderNotificationService::class.java).apply {
            action = ACTION_STOP_ALARM
        }
        val stopAlarmPendingIntent = PendingIntent.getService(
            this,
            (orderNumber.hashCode() + 1),
            stopAlarmIntent,
            pendingIntentFlags
        )
        
        // Create custom sound URI from res/raw/order_alarm.mp3
        val soundUri = Uri.parse("android.resource://" + packageName + "/" + R.raw.order_alarm)
        
        val notification = NotificationCompat.Builder(this, CanteenOwnerHelperApplication.CHANNEL_ID_ORDER_NOTIFICATIONS)
            .setContentTitle("🔔 New Order #$orderNumber")
            .setContentText("From: $customerName • Amount: ₹${String.format("%.2f", amount)}")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MAX) // MAX priority for heads-up
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(false) // Don't auto-dismiss
            .setOngoing(false) // Can be swiped away
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 500, 250, 500, 250, 500))
            .setDefaults(0) // Don't use defaults
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Show on lock screen
            .setFullScreenIntent(pendingIntent, false) // Forces heads-up notification
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
            .addAction(
                R.drawable.ic_notification,
                "🔇 Stop Alarm",
                stopAlarmPendingIntent
            )
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("🍴 Order #$orderNumber\n👤 Customer: $customerName\n💵 Amount: ₹${String.format("%.2f", amount)}")
                    .setBigContentTitle("🔔 NEW ORDER RECEIVED!")
            )
            .build()
        
        // Use order number hash as notification ID to allow multiple notifications
        val notificationId = ORDER_NOTIFICATION_BASE_ID + Math.abs(orderNumber.hashCode() % 1000)
        
        Log.d(TAG, "Posting notification with ID: $notificationId")
        notificationManager.notify(notificationId, notification)
        
        Log.d(TAG, "Order notification shown: #$orderNumber")
    }
    
    /**
     * Play alarm sound for new order
     * Uses res/raw/order_alarm.mp3
     * 
     * @param repeatMode true = loop until dismissed, false = play once
     */
    private fun playAlarmSound(repeatMode: Boolean) {
        try {
            // Release previous media player if exists
            releaseMediaPlayer()
            
            // Create new media player with alarm sound
            mediaPlayer = MediaPlayer.create(this, R.raw.order_alarm)
            
            mediaPlayer?.apply {
                // Set audio attributes for alarm stream
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build()
                    )
                } else {
                    @Suppress("DEPRECATION")
                    setAudioStreamType(android.media.AudioManager.STREAM_ALARM)
                }
                
                // Set looping based on repeat mode
                isLooping = repeatMode
                
                // Set listener to release player after completion (only if not looping)
                if (!repeatMode) {
                    setOnCompletionListener {
                        releaseMediaPlayer()
                    }
                }
                
                // Play sound
                start()
                
                Log.d(TAG, "Alarm sound playing (repeat=$repeatMode)")
            } ?: Log.e(TAG, "Failed to create MediaPlayer")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error playing alarm sound", e)
        }
    }
    
    /**
     * Release media player resources
     */
    private fun releaseMediaPlayer() {
        mediaPlayer?.apply {
            try {
                if (isPlaying) {
                    stop()
                }
                release()
            } catch (e: Exception) {
                Log.e(TAG, "Error releasing media player", e)
            }
        }
        mediaPlayer = null
    }
    
    /**
     * Vibrate device for new order alert
     * Pattern: short pause, long vibrate, short pause, long vibrate, short pause, long vibrate
     */
    private fun vibrateDevice() {
        try {
            vibrator?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Android 8.0+ - Use VibrationEffect
                    val vibrationEffect = VibrationEffect.createWaveform(
                        longArrayOf(0, 500, 250, 500, 250, 500), // Pattern
                        -1 // Don't repeat
                    )
                    it.vibrate(vibrationEffect)
                } else {
                    // Pre-Android 8.0 - Use deprecated method
                    @Suppress("DEPRECATION")
                    it.vibrate(longArrayOf(0, 500, 250, 500, 250, 500), -1)
                }
                
                Log.d(TAG, "Device vibrating")
            } ?: Log.w(TAG, "Vibrator not available")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error vibrating device", e)
        }
    }
}
