package com.sillobite.owner.helper.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Response for getting canteen by owner email
 */
data class CanteenResponse(
    @SerializedName("canteen")
    val canteen: Canteen
)

/**
 * Canteen data
 */
data class Canteen(
    @SerializedName("id")
    val id: String,  // MongoDB ObjectId
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("code")
    val code: String,
    
    @SerializedName("canteenOwnerEmail")
    val canteenOwnerEmail: String,
    
    @SerializedName("isActive")
    val isActive: Boolean,
    
    @SerializedName("location")
    val location: String?,
    
    @SerializedName("contactNumber")
    val contactNumber: String?,
    
    @SerializedName("description")
    val description: String?,
    
    @SerializedName("email")
    val email: String?,
    
    @SerializedName("operatingHours")
    val operatingHours: OperatingHours?,
    
    @SerializedName("createdAt")
    val createdAt: String?,
    
    @SerializedName("updatedAt")
    val updatedAt: String?
)

/**
 * Operating hours data
 */
data class OperatingHours(
    @SerializedName("open")
    val open: String,
    
    @SerializedName("close")
    val close: String,
    
    @SerializedName("days")
    val days: List<String>
)
