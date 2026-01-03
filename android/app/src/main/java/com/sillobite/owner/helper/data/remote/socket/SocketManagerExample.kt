package com.sillobite.owner.helper.data.remote.socket

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sillobite.owner.helper.data.local.TokenStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Example ViewModel demonstrating SocketManager usage
 * 
 * Shows:
 * - Connecting to WebSocket server
 * - Joining canteen room after login
 * - Observing order updates
 * - Handling connection states
 * - Proper cleanup
 */
class SocketManagerExample(context: Context) : ViewModel() {

    companion object {
        private const val TAG = "SocketManagerExample"
    }

    private val tokenStorage = TokenStorage(context)
    private var socketManager: SocketManager? = null

    private val _orders = MutableStateFlow<List<OrderData>>(emptyList())
    val orders: StateFlow<List<OrderData>> = _orders

    data class OrderData(
        val orderNumber: String,
        val type: String,
        val status: String?,
        val timestamp: Long
    )

    /**
     * Initialize WebSocket connection after login
     */
    fun initializeSocket() {
        viewModelScope.launch {
            try {
                // Get session data
                val session = tokenStorage.getSessionSync()
                
                if (!session.isValid()) {
                    Log.e(TAG, "Invalid session, cannot connect to socket")
                    return@launch
                }

                // Create SocketManager with server URL from session
                socketManager = SocketManager(session.serverUrl)

                // Observe connection state
                observeConnectionState()

                // Observe order updates
                observeOrderUpdates()

                // Connect to server
                socketManager?.connect(
                    userId = session.userId,
                    userRole = session.userRole
                )

                // Join canteen room
                socketManager?.joinCanteenRoom(session.canteenId)

                Log.d(TAG, "Socket initialized for canteen: ${session.canteenName}")

            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize socket", e)
            }
        }
    }

    /**
     * Observe connection state changes
     */
    private fun observeConnectionState() {
        viewModelScope.launch {
            socketManager?.connectionState?.collect { state ->
                when (state) {
                    is SocketManager.ConnectionState.Connected -> {
                        Log.d(TAG, "WebSocket connected")
                        // Update UI: Show connected status
                    }
                    is SocketManager.ConnectionState.Connecting -> {
                        Log.d(TAG, "WebSocket connecting...")
                        // Update UI: Show connecting indicator
                    }
                    is SocketManager.ConnectionState.Disconnected -> {
                        Log.d(TAG, "WebSocket disconnected")
                        // Update UI: Show disconnected status
                    }
                    is SocketManager.ConnectionState.Error -> {
                        Log.e(TAG, "WebSocket error: ${state.message}")
                        // Update UI: Show error message
                    }
                }
            }
        }
    }

    /**
     * Observe order updates
     */
    private fun observeOrderUpdates() {
        viewModelScope.launch {
            socketManager?.orderUpdate?.collect { update ->
                if (update != null) {
                    handleOrderUpdate(update)
                }
            }
        }
    }

    /**
     * Handle incoming order update
     */
    private fun handleOrderUpdate(update: SocketManager.OrderUpdate) {
        when (update.type) {
            "new_order", "new_offline_order" -> {
                Log.d(TAG, "New order received: ${update.orderNumber}")
                
                // Add to orders list
                val orderData = OrderData(
                    orderNumber = update.orderNumber ?: "Unknown",
                    type = update.type,
                    status = "pending",
                    timestamp = update.timestamp
                )
                _orders.value = _orders.value + orderData
                
                // Show notification
                showOrderNotification(update)
            }
            
            "order_status_changed" -> {
                Log.d(TAG, "Order status changed: ${update.orderNumber} from ${update.oldStatus} to ${update.newStatus}")
                // Update order in list
                updateOrderStatus(update.orderNumber, update.newStatus)
            }
            
            "payment_confirmed" -> {
                Log.d(TAG, "Payment confirmed: ${update.orderNumber}")
                // Update order payment status
            }
            
            else -> {
                Log.d(TAG, "Order update: type=${update.type}, order=${update.orderNumber}")
            }
        }
    }

    /**
     * Show notification for new order
     */
    private fun showOrderNotification(update: SocketManager.OrderUpdate) {
        // Parse order data from JSON
        val orderData = update.data
        val customerName = orderData?.optString("customerName") ?: "Unknown"
        val amount = orderData?.optDouble("amount") ?: 0.0
        
        // TODO: Show notification using NotificationManager
        Log.d(TAG, "Show notification: New order #${update.orderNumber} from $customerName - ₹$amount")
    }

    /**
     * Update order status in list
     */
    private fun updateOrderStatus(orderNumber: String?, newStatus: String?) {
        if (orderNumber == null || newStatus == null) return
        
        _orders.value = _orders.value.map { order ->
            if (order.orderNumber == orderNumber) {
                order.copy(status = newStatus)
            } else {
                order
            }
        }
    }

    /**
     * Join additional counter room
     */
    fun joinCounterRoom(counterId: String) {
        viewModelScope.launch {
            val session = tokenStorage.getSessionSync()
            socketManager?.joinCounterRoom(counterId, session.canteenId)
        }
    }

    /**
     * Disconnect socket on logout or app exit
     */
    fun disconnectSocket() {
        socketManager?.disconnect()
        socketManager = null
        Log.d(TAG, "Socket disconnected")
    }

    /**
     * Cleanup on ViewModel destruction
     */
    override fun onCleared() {
        super.onCleared()
        disconnectSocket()
    }
}

/**
 * Usage in Service:
 * 
 * ```kotlin
 * class OrderNotificationService : Service() {
 *     private lateinit var socketManager: SocketManager
 *     
 *     override fun onCreate() {
 *         super.onCreate()
 *         
 *         val tokenStorage = TokenStorage(applicationContext)
 *         val session = runBlocking { tokenStorage.getSessionSync() }
 *         
 *         socketManager = SocketManager(session.serverUrl)
 *         
 *         // Observe connection state
 *         lifecycleScope.launch {
 *             socketManager.connectionState.collect { state ->
 *                 // Update foreground notification
 *             }
 *         }
 *         
 *         // Observe order updates
 *         lifecycleScope.launch {
 *             socketManager.orderUpdate.collect { update ->
 *                 if (update?.type == "new_order") {
 *                     showOrderNotification(update)
 *                     playAlarmSound()
 *                 }
 *             }
 *         }
 *         
 *         // Connect and join room
 *         socketManager.connect(session.userId, session.userRole)
 *         socketManager.joinCanteenRoom(session.canteenId)
 *     }
 *     
 *     override fun onDestroy() {
 *         super.onDestroy()
 *         socketManager.disconnect()
 *     }
 * }
 * ```
 */
