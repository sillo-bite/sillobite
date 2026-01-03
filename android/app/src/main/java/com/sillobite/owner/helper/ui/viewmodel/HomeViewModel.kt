package com.sillobite.owner.helper.ui.viewmodel

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sillobite.owner.helper.CanteenOwnerHelperApplication
import com.sillobite.owner.helper.data.local.TokenStorage
import com.sillobite.owner.helper.data.model.UserSession
import com.sillobite.owner.helper.data.remote.socket.SocketManager
import com.sillobite.owner.helper.service.OrderNotificationService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel for Home/Monitor Screen
 * 
 * Manages:
 * - User session data display
 * - WebSocket connection state
 * - Order monitoring
 * - Service lifecycle
 */
class HomeViewModel(private val context: Context) : ViewModel() {

    companion object {
        private const val TAG = "HomeViewModel"
    }

    // Use singleton TokenStorage from Application
    private val tokenStorage = CanteenOwnerHelperApplication.getTokenStorage(context.applicationContext as CanteenOwnerHelperApplication)
    private var socketManager: SocketManager? = null

    // UI State
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    /**
     * UI State data class
     */
    data class HomeUiState(
        val canteenName: String = "",
        val canteenId: String = "",
        val ownerEmail: String = "",
        val isSocketConnected: Boolean = false,
        val isSocketConnecting: Boolean = false,
        val activeOrderCount: Int = 0,
        val isServiceRunning: Boolean = false,
        val isLoading: Boolean = true,
        val errorMessage: String? = null
    )

    init {
        loadUserSession()
    }

    /**
     * Load user session data
     */
    private fun loadUserSession() {
        viewModelScope.launch {
            try {
                val session = tokenStorage.getSessionSync()
                
                if (!session.isValid()) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = "Invalid session. Please login again."
                    )
                    return@launch
                }

                _uiState.value = _uiState.value.copy(
                    canteenName = session.canteenName,
                    ownerEmail = session.email,
                    canteenId = session.canteenId,
                    isLoading = false
                )

                // Initialize socket connection
                initializeSocket(session)

            } catch (e: Exception) {
                Log.e(TAG, "Error loading session", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Failed to load session: ${e.message}"
                )
            }
        }
    }

    /**
     * Initialize WebSocket connection
     */
    private fun initializeSocket(session: UserSession) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "=== Initializing Socket ===")
                Log.d(TAG, "Canteen: ${session.canteenName}")
                Log.d(TAG, "Canteen ID: ${session.canteenId}")
                Log.d(TAG, "Server URL: ${session.serverUrl}")
                Log.d(TAG, "User ID: ${session.userId}")
                Log.d(TAG, "User Role: ${session.userRole}")
                Log.d(TAG, "User Email: ${session.email}")

                // Create SocketManager
                socketManager = SocketManager(session.serverUrl)

                // Observe connection state
                observeConnectionState()

                // Observe order updates
                observeOrderUpdates()

                // Connect to WebSocket
                socketManager?.connect(
                    userId = session.userId,
                    userRole = session.userRole
                )

                // Join canteen room
                socketManager?.joinCanteenRoom(session.canteenId)

                Log.d(TAG, "Socket initialization complete")
                Log.d(TAG, "=============================")

            } catch (e: Exception) {
                Log.e(TAG, "=== Socket Initialization Error ===")
                Log.e(TAG, "Error: ${e.message}")
                Log.e(TAG, "Exception type: ${e::class.simpleName}")
                Log.e(TAG, "Stack trace: ${e.stackTraceToString()}")
                Log.e(TAG, "===================================")
                _uiState.value = _uiState.value.copy(
                    isSocketConnected = false,
                    isSocketConnecting = false,
                    errorMessage = "Socket connection failed: ${e.message}"
                )
            }
        }
    }

    /**
     * Observe WebSocket connection state
     * 
     * Maps SocketManager states to UI boolean flags:
     * - Connected → isSocketConnected = true, isSocketConnecting = false
     * - Connecting → isSocketConnected = false, isSocketConnecting = true
     * - Disconnected → both false
     * - Error → isSocketConnected = false, isSocketConnecting = false
     */
    private fun observeConnectionState() {
        viewModelScope.launch {
            socketManager?.connectionState?.collect { state ->
                val (isConnected, isConnecting) = when (state) {
                    is SocketManager.ConnectionState.Connected -> {
                        Log.d(TAG, "Socket connected")
                        Pair(true, false)
                    }
                    is SocketManager.ConnectionState.Connecting -> {
                        Log.d(TAG, "Socket connecting...")
                        Pair(false, true)
                    }
                    is SocketManager.ConnectionState.Disconnected -> {
                        Log.d(TAG, "Socket disconnected")
                        Pair(false, false)
                    }
                    is SocketManager.ConnectionState.Error -> {
                        Log.e(TAG, "Socket error: ${state.message}")
                        Pair(false, false)
                    }
                }

                _uiState.value = _uiState.value.copy(
                    isSocketConnected = isConnected,
                    isSocketConnecting = isConnecting,
                    errorMessage = if (state is SocketManager.ConnectionState.Error) {
                        state.message
                    } else null
                )
            }
        }
    }

    /**
     * Observe order updates from WebSocket
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
     * 
     * Filters for "new_order" and "new_offline_order" types:
     * 1. Increment activeOrderCount
     * 2. Send ACTION_NEW_ORDER to service with order details
     */
    private fun handleOrderUpdate(update: SocketManager.OrderUpdate) {
        when (update.type) {
            "new_order", "new_offline_order" -> {
                Log.d(TAG, "New order received: ${update.orderNumber}")
                
                // Increment active order count
                val newCount = _uiState.value.activeOrderCount + 1
                _uiState.value = _uiState.value.copy(activeOrderCount = newCount)
                
                // Send NEW_ORDER action to service with order details
                sendNewOrderToService(update, newCount)
            }
            
            "order_status_changed" -> {
                Log.d(TAG, "Order status changed: ${update.orderNumber} -> ${update.newStatus}")
                
                // If order completed/cancelled, decrement count
                if (update.newStatus in listOf("completed", "cancelled", "rejected")) {
                    val newCount = (_uiState.value.activeOrderCount - 1).coerceAtLeast(0)
                    _uiState.value = _uiState.value.copy(activeOrderCount = newCount)
                    
                    // Update service with new count
                    updateServiceCount(newCount)
                }
            }
            
            else -> {
                Log.d(TAG, "Order update: type=${update.type}")
            }
        }
    }
    
    /**
     * Send new order notification to service
     * Triggers sound, vibration, and notification display
     */
    private fun sendNewOrderToService(update: SocketManager.OrderUpdate, orderCount: Int) {
        viewModelScope.launch {
            try {
                // Get alarm repeat mode setting
                val repeatMode = tokenStorage.getAlarmRepeatModeSync()
                
                // Extract customer name and amount from data JSONObject
                val customerName = update.data?.optString("customerName") ?: "Guest"
                val totalAmount = update.data?.optDouble("total", 0.0) ?: 0.0
                
                val intent = Intent(context, OrderNotificationService::class.java).apply {
                    action = OrderNotificationService.ACTION_NEW_ORDER
                    putExtra(OrderNotificationService.EXTRA_ORDER_NUMBER, update.orderNumber ?: "Unknown")
                    putExtra(OrderNotificationService.EXTRA_CUSTOMER_NAME, customerName)
                    putExtra(OrderNotificationService.EXTRA_AMOUNT, totalAmount)
                    putExtra(OrderNotificationService.EXTRA_ORDER_COUNT, orderCount)
                    putExtra("EXTRA_REPEAT_MODE", repeatMode)
                }
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                
                Log.d(TAG, "New order sent to service: ${update.orderNumber} (repeat=$repeatMode)")
                
            } catch (e: Exception) {
                Log.e(TAG, "Error sending new order to service", e)
            }
        }
    }
    
    /**
     * Update service with current order count only
     */
    private fun updateServiceCount(count: Int) {
        try {
            val intent = Intent(context, OrderNotificationService::class.java).apply {
                action = OrderNotificationService.ACTION_UPDATE_COUNT
                putExtra(OrderNotificationService.EXTRA_ORDER_COUNT, count)
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            
            Log.d(TAG, "Service count updated: $count")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error updating service count", e)
        }
    }

    /**
     * Start foreground monitoring service
     */
    fun startMonitoringService() {
        viewModelScope.launch {
            try {
                val session = tokenStorage.getSessionSync()
                
                val intent = Intent(context, OrderNotificationService::class.java).apply {
                    action = OrderNotificationService.ACTION_START_SERVICE
                    putExtra(OrderNotificationService.EXTRA_CANTEEN_ID, session.canteenId)
                    putExtra("EXTRA_ORDER_COUNT", _uiState.value.activeOrderCount)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }

                _uiState.value = _uiState.value.copy(isServiceRunning = true)
                Log.d(TAG, "Monitoring service started")

            } catch (e: Exception) {
                Log.e(TAG, "Error starting service", e)
                _uiState.value = _uiState.value.copy(
                    errorMessage = "Failed to start monitoring: ${e.message}"
                )
            }
        }
    }

    /**
     * Stop foreground monitoring service
     */
    fun stopMonitoringService() {
        try {
            val intent = Intent(context, OrderNotificationService::class.java).apply {
                action = OrderNotificationService.ACTION_STOP_SERVICE
            }
            context.startService(intent)

            _uiState.value = _uiState.value.copy(isServiceRunning = false)
            Log.d(TAG, "Monitoring service stopped")

        } catch (e: Exception) {
            Log.e(TAG, "Error stopping service", e)
        }
    }

    /**
     * Manually reconnect socket
     */
    fun reconnectSocket() {
        socketManager?.reconnect()
    }

    /**
     * Logout user
     */
    fun logout(onLogoutComplete: () -> Unit) {
        viewModelScope.launch {
            try {
                // Stop monitoring service
                stopMonitoringService()

                // Disconnect socket
                socketManager?.disconnect()
                socketManager = null

                // Clear session
                tokenStorage.clearSession()

                Log.d(TAG, "Logout successful")
                onLogoutComplete()

            } catch (e: Exception) {
                Log.e(TAG, "Error during logout", e)
                onLogoutComplete()
            }
        }
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    /**
     * Cleanup on ViewModel destruction
     * 
     * IMPORTANT: Do NOT disconnect socket here - it must persist
     * across ViewModel lifecycle to maintain background monitoring
     */
    override fun onCleared() {
        super.onCleared()
        // Socket is intentionally NOT disconnected here
        // It must persist to maintain background order monitoring
        Log.d(TAG, "ViewModel cleared, socket remains connected")
    }
}
