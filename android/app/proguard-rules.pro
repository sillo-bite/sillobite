# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ================================
# APP SPECIFIC RULES
# ================================

# Keep all app classes and members
-keep class com.sillobite.owner.helper.** { *; }

# Keep data classes (used for JSON serialization)
-keep class com.sillobite.owner.helper.data.model.** { *; }

# Keep ViewModels
-keep class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}

# Keep Service classes
-keep class * extends android.app.Service
-keep class com.sillobite.owner.helper.service.** { *; }

# ================================
# JETPACK COMPOSE
# ================================

# Keep Composable functions
-keep @androidx.compose.runtime.Composable class * { *; }
-keep class androidx.compose.** { *; }

# Keep Compose Navigation
-keep class androidx.navigation.** { *; }

# Keep Material3 components
-keep class androidx.compose.material3.** { *; }

# ================================
# RETROFIT & NETWORKING
# ================================

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# Retrofit interfaces - keep all methods
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

# ================================
# OKHTTP & OKIO
# ================================

-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# OkHttp platform classes
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ================================
# SOCKET.IO
# ================================

# Keep Socket.IO client classes
-keep class io.socket.** { *; }
-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.** { *; }
-keepclassmembers class io.socket.** { *; }

# Keep JSON classes used by Socket.IO
-keep class org.json.** { *; }
-keepclassmembers class org.json.** { *; }

-dontwarn io.socket.**
-dontwarn org.json.**

# ================================
# GSON
# ================================

-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**

# Keep Gson classes
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep generic signatures for Gson
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# Prevent obfuscation of generic types used in Gson
-keep class * extends com.google.gson.TypeAdapter

# ================================
# KOTLIN COROUTINES
# ================================

-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

-keepclassmembers class kotlinx.** {
    volatile <fields>;
}

# Coroutines debug metadata
-keepattributes *Annotation*
-keep class kotlin.coroutines.Continuation

# ServiceLoader support for coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# ================================
# KOTLIN METADATA
# ================================

-keep class kotlin.Metadata { *; }
-keep class kotlin.reflect.** { *; }
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# ================================
# DATASTORE PREFERENCES
# ================================

# Keep DataStore classes
-keep class androidx.datastore.** { *; }
-keepclassmembers class androidx.datastore.** { *; }

# Keep preference keys
-keep class androidx.datastore.preferences.** { *; }

# ================================
# ANDROIDX LIFECYCLE
# ================================

# Keep ViewModel classes
-keep class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}
-keep class * extends androidx.lifecycle.AndroidViewModel {
    <init>(...);
}

# Keep lifecycle observers
-keepclassmembers class * implements androidx.lifecycle.LifecycleObserver {
    <init>(...);
}

# ================================
# ANDROID COMPONENTS
# ================================

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom views
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
    public void set*(...);
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ================================
# DEBUGGING & OPTIMIZATION
# ================================

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable

# Rename source file attribute to hide original file names
-renamesourcefileattribute SourceFile

# Remove logging in release builds (optional - comment out if you need logs)
# -assumenosideeffects class android.util.Log {
#     public static *** d(...);
#     public static *** v(...);
#     public static *** i(...);
# }

# ================================
# GENERAL WARNINGS TO SUPPRESS
# ================================

-dontwarn java.lang.invoke.StringConcatFactory
