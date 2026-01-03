package com.sillobite.owner.helper.data.remote.socket

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

/**
 * WebSocket Manager using Socket.IO
 * 
 * Manages real-time communication for order updates:
 * - Connection lifecycle management
 * - Room join/leave operations
 * - Order update event handling
 * - Automatic reconnection with room rejoin
 * 
 * CRITICAL: Rooms are NOT automatically rejoined by server after reconnection.
 * This manager handles manual room rejoin on reconnect.
 */
class SocketManager(private val serverUrl: String) {

    companion object {
        private const val TAG = "SocketManager"
        
        // Connection configuration
        private const val CONNECTION_TIMEOUT = 15000L // 15 seconds
        private const val RECONNECTION_DELAY = 1000L // 1 second initial
        private const val RECONNECTION_DELAY_MAX = 8000L // 8 seconds max
        private const val RECONNECTION_ATTEMPTS = 10
    }

    private var socket: Socket? = null
    
    // Store room IDs for reconnection
    private var currentCanteenId: String? = null
    private var currentUserId: String? = null
    private var currentUserRole: String? = null
    private val counterIds = mutableSetOf<String>()
    
    // Observable state
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()
    
    private val _orderUpdate = MutableStateFlow<OrderUpdate?>(null)
    val orderUpdate: StateFlow<OrderUpdate?> = _orderUpdate.asStateFlow()
    
    /**
     * Connection states
     */
    sealed class ConnectionState {
        object Disconnected : ConnectionState()
        object Connecting : ConnectionState()
        object Connected : ConnectionState()
        data class Error(val message: String) : ConnectionState()
    }
    
    /**
     * Order update data
     */
    data class OrderUpdate(
        val type: String,
        val data: JSONObject?,
        val orderNumber: String?,
        val oldStatus: String?,
        val newStatus: String?,
        val timestamp: Long = System.currentTimeMillis()
    )

    /**
     * Connect to WebSocket server
     * 
     * @param userId User ID for tracking
     * @param userRole User role (should be "canteen_owner")
     */
    fun connect(userId: String, userRole: String) {
        if (socket?.connected() == true) {
            Log.d(TAG, "Already connected")
            return
        }

        currentUserId = userId
        currentUserRole = userRole
        
        _connectionState.value = ConnectionState.Connecting
        
        try {
            // Log the exact URL being used for connection
            Log.d(TAG, "=== Socket Connection Debug ===")
            Log.d(TAG, "Server URL: $serverUrl")
            Log.d(TAG, "User ID: $userId")
            Log.d(TAG, "User Role: $userRole")
            
            val options = IO.Options().apply {
                // Transport configuration
                transports = arrayOf(
                    io.socket.engineio.client.transports.WebSocket.NAME,
                    io.socket.engineio.client.transports.Polling.NAME
                )
                
                // Reconnection configuration
                reconnection = true
                reconnectionDelay = RECONNECTION_DELAY
                reconnectionDelayMax = RECONNECTION_DELAY_MAX
                reconnectionAttempts = RECONNECTION_ATTEMPTS
                
                // Timeout configuration
                timeout = CONNECTION_TIMEOUT
                
                // Force WebSocket secure for HTTPS URLs
                secure = serverUrl.startsWith("https://")
                
                // NO authentication required (per server implementation)
            }
            
            val uri = URI.create(serverUrl)
            Log.d(TAG, "Socket URI: ${uri.scheme}://${uri.host}${if (uri.port != -1) ":${uri.port}" else ""}")
            Log.d(TAG, "Secure mode: ${options.secure}")
            Log.d(TAG, "Timeout: ${options.timeout}ms")
            
            socket = IO.socket(uri, options)
            setupEventHandlers()
            socket?.connect()
            
            Log.d(TAG, "Socket.connect() called successfully")
            Log.d(TAG, "===============================")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create socket", e)
            Log.e(TAG, "Exception type: ${e::class.simpleName}")
            Log.e(TAG, "Stack trace: ${e.stackTraceToString()}")
            _connectionState.value = ConnectionState.Error("Connection failed: ${e.message}")
        }
    }

    /**
     * Setup all Socket.IO event handlers
     */
    private fun setupEventHandlers() {
        socket?.apply {
            // 1. Connection established
            on(Socket.EVENT_CONNECT) {
                val socketId = id()
                Log.d(TAG, "=== Socket Connected ===")
                Log.d(TAG, "Socket ID: $socketId")
                Log.d(TAG, "Server URL: $serverUrl")
                Log.d(TAG, "Connected successfully")
                Log.d(TAG, "========================")
                _connectionState.value = ConnectionState.Connected
                
                // CRITICAL: Auto-rejoin all rooms after reconnection
                rejoinAllRooms()
            }
            
            // 2. Connection error
            on(Socket.EVENT_CONNECT_ERROR) { args ->
                val error = args.firstOrNull()?.toString() ?: "Unknown error"
                Log.e(TAG, "=== Socket Connection Error ===")
                Log.e(TAG, "Error: $error")
                Log.e(TAG, "Server URL: $serverUrl")
                Log.e(TAG, "Args count: ${args.size}")
                args.forEachIndexed { index, arg ->
                    Log.e(TAG, "Arg[$index]: $arg (${arg?.javaClass?.simpleName})")
                }
                Log.e(TAG, "===============================")
                _connectionState.value = ConnectionState.Error(error)
            }
            
            // 3. Disconnection
            on(Socket.EVENT_DISCONNECT) { args ->
                val reason = args.firstOrNull() as? String ?: "unknown"
                Log.d(TAG, "Disconnected: reason = $reason")
                _connectionState.value = ConnectionState.Disconnected
            }
            
            // 4. Room joined confirmation
            on("roomJoined") { args ->
                val data = args.firstOrNull() as? JSONObject
                val canteenIds = data?.optJSONArray("canteenIds")
                val connectedAt = data?.optString("connectedAt")
                Log.d(TAG, "Joined canteen rooms: $canteenIds at $connectedAt")
            }
            
            // 5. Counter room joined confirmation
            on("counterRoomJoined") { args ->
                val data = args.firstOrNull() as? JSONObject
                val counterId = data?.optString("counterId")
                val canteenId = data?.optString("canteenId")
                Log.d(TAG, "Joined counter room: $counterId in canteen $canteenId")
            }
            
            // 6. Order update (CRITICAL)
            on("orderUpdate") { args ->
                val message = args.firstOrNull() as? JSONObject
                if (message != null) {
                    handleOrderUpdate(message)
                }
            }
            
            // 7. Socket error
            on("error") { args ->
                val errorData = args.firstOrNull() as? JSONObject
                val errorMessage = errorData?.optString("message") ?: "Socket error"
                Log.e(TAG, "Socket error: $errorMessage")
            }
        }
    }

    /**
     * Handle order update event
     */
    private fun handleOrderUpdate(message: JSONObject) {
        try {
            val type = message.optString("type")
            val data = message.optJSONObject("data")
            val orderNumber = message.optString("orderNumber")
            val oldStatus = message.optString("oldStatus")
            val newStatus = message.optString("newStatus")
            
            val orderUpdate = OrderUpdate(
                type = type,
                data = data,
                orderNumber = orderNumber.takeIf { it.isNotEmpty() },
                oldStatus = oldStatus.takeIf { it.isNotEmpty() },
                newStatus = newStatus.takeIf { it.isNotEmpty() }
            )
            
            _orderUpdate.value = orderUpdate
            
            Log.d(TAG, "Order update received: type=$type, orderNumber=$orderNumber")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing order update", e)
        }
    }

    /**
     * Join canteen room to receive order notifications
     * 
     * @param canteenId MongoDB ObjectId of the canteen
     */
    fun joinCanteenRoom(canteenId: String) {
        currentCanteenId = canteenId
        
        val payload = JSONObject().apply {
            put("canteenIds", JSONArray().apply { put(canteenId) })
            put("userId", currentUserId)
            put("userRole", currentUserRole)
        }
        
        socket?.emit("joinCanteenRooms", payload)
        Log.d(TAG, "Joining canteen room: $canteenId")
    }

    /**
     * Join counter room for counter-specific notifications
     * 
     * @param counterId MongoDB ObjectId of the counter
     * @param canteenId MongoDB ObjectId of the canteen
     */
    fun joinCounterRoom(counterId: String, canteenId: String) {
        counterIds.add(counterId)
        
        val payload = JSONObject().apply {
            put("counterId", counterId)
            put("canteenId", canteenId)
        }
        
        socket?.emit("joinCounterRoom", payload)
        Log.d(TAG, "Joining counter room: $counterId")
    }

    /**
     * Leave canteen room
     * 
     * @param canteenId MongoDB ObjectId of the canteen
     */
    fun leaveCanteenRoom(canteenId: String) {
        val payload = JSONObject().apply {
            put("canteenIds", JSONArray().apply { put(canteenId) })
        }
        
        socket?.emit("leaveCanteenRooms", payload)
        currentCanteenId = null
        Log.d(TAG, "Leaving canteen room: $canteenId")
    }

    /**
     * Leave counter room
     * 
     * @param counterId MongoDB ObjectId of the counter
     */
    fun leaveCounterRoom(counterId: String) {
        val payload = JSONObject().apply {
            put("counterId", counterId)
        }
        
        socket?.emit("leaveCounterRoom", payload)
        counterIds.remove(counterId)
        Log.d(TAG, "Leaving counter room: $counterId")
    }

    /**
     * CRITICAL: Rejoin all rooms after reconnection
     * Server does NOT automatically rejoin rooms after disconnect
     */
    private fun rejoinAllRooms() {
        // Rejoin canteen room
        currentCanteenId?.let { canteenId ->
            Log.d(TAG, "Auto-rejoining canteen room: $canteenId")
            joinCanteenRoom(canteenId)
        }
        
        // Rejoin counter rooms
        counterIds.forEach { counterId ->
            currentCanteenId?.let { canteenId ->
                Log.d(TAG, "Auto-rejoining counter room: $counterId")
                joinCounterRoom(counterId, canteenId)
            }
        }
    }

    /**
     * Check if socket is connected
     */
    fun isConnected(): Boolean {
        return socket?.connected() == true
    }

    /**
     * Disconnect from server
     */
    fun disconnect() {
        Log.d(TAG, "Disconnecting socket")
        
        // Leave all rooms before disconnecting
        currentCanteenId?.let { leaveCanteenRoom(it) }
        counterIds.toList().forEach { leaveCounterRoom(it) }
        
        socket?.disconnect()
        socket?.off() // Remove all listeners
        socket = null
        
        _connectionState.value = ConnectionState.Disconnected
    }

    /**
     * Manually trigger reconnection
     */
    fun reconnect() {
        if (socket?.connected() == false) {
            Log.d(TAG, "Manual reconnection triggered")
            socket?.connect()
        }
    }
}
