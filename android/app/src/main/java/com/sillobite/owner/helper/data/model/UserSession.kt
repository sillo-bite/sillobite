package com.sillobite.owner.helper.data.model

/**
 * Data class representing user session information
 * 
 * Contains all necessary information for authenticated user session:
 * - User identification (email, userId, userRole)
 * - Canteen information (canteenId, canteenName)
 * - Server configuration (serverUrl)
 * - Authentication state (isAuthenticated)
 * 
 * Stored securely using DataStore Preferences
 */
data class UserSession(
    val email: String = "",
    val userId: String = "",
    val userRole: String = "",
    val canteenId: String = "",
    val canteenName: String = "",
    val serverUrl: String = "",
    val isAuthenticated: Boolean = false
) {
    /**
     * Check if session contains valid data
     */
    fun isValid(): Boolean {
        return isAuthenticated &&
                email.isNotBlank() &&
                userId.isNotBlank() &&
                userRole == "canteen_owner" &&
                canteenId.isNotBlank() &&
                serverUrl.isNotBlank()
    }

    /**
     * Create empty session (logged out state)
     */
    companion object {
        fun empty() = UserSession()
    }
}
