package com.sillobite.owner.helper.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Login request body
 */
data class LoginRequest(
    @SerializedName("identifier")
    val identifier: String,
    
    @SerializedName("password")
    val password: String
)

/**
 * Login response
 */
data class LoginResponse(
    @SerializedName("message")
    val message: String,
    
    @SerializedName("user")
    val user: User
)

/**
 * User data from login response
 */
data class User(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("email")
    val email: String,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("role")
    val role: String,
    
    @SerializedName("phoneNumber")
    val phoneNumber: String?
)
