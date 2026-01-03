package com.sillobite.owner.helper.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Counter data
 * Response is an array of Counter objects
 */
data class Counter(
    @SerializedName("_id")
    val id: String,  // MongoDB ObjectId
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("type")
    val type: CounterType,
    
    @SerializedName("canteenId")
    val canteenId: String,
    
    @SerializedName("isActive")
    val isActive: Boolean,
    
    @SerializedName("description")
    val description: String?,
    
    @SerializedName("createdAt")
    val createdAt: String?,
    
    @SerializedName("updatedAt")
    val updatedAt: String?
)

/**
 * Counter types enum
 */
enum class CounterType {
    @SerializedName("payment")
    PAYMENT,
    
    @SerializedName("store")
    STORE,
    
    @SerializedName("kot")
    KOT
}
