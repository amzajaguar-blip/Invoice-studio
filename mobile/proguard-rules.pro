# ── React Native Core ────────────────────────────────────────────────────────
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
  <init>(...);
  void set*(***);
  *** get*();
}
-keep class com.facebook.jni.** { *; }
-keep class *  { @com.facebook.react.uimanager.UIProp <fields>; }
-keep class *  { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keep class *  { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }
-keep class com.facebook.react.** { *; }

# ── Hermes Engine ─────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jscexecutor.** { *; }

# ── OkHttp ────────────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── Gson ──────────────────────────────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }

# ── Supabase ──────────────────────────────────────────────────────────────────
-keep class io.supabase.** { *; }
-dontwarn io.supabase.**

# ── Expo Modules ──────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }
-dontwarn expo.modules.**
-keep class abi**.expo.modules.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ── Expo Camera (also keeps Kotlin companions used via reflection) ────────────
-keep class expo.modules.camera.** { *; }
-keep class expo.modules.cameraview.** { *; }
-keep class **.CameraViewModuleKt { *; }
-keep class **.CameraView { *; }
-keep class **ExpoCameraView { *; }
-keepclassmembers class expo.modules.camera.** { *; }
-dontwarn expo.modules.camera.**
-dontwarn com.google.mlkit.**

# ── React Native Screens (native fragments) ───────────────────────────────────
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# ── React Native Safe Area Context ────────────────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.th3rdwave.safeareacontext.**

# ── React Native SVG ─────────────────────────────────────────────────────────
-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# ── Main Activity / Application (referenced from AndroidManifest only) ────────
# CRITICAL: must match the actual package declared in app/build.gradle
# namespace 'com.Invoice_Studio.myapp' → these classes live under that package.
# Stripping them = crash "ClassNotFoundException: MainActivity" on launch.
-keep class com.Invoice_Studio.myapp.MainActivity { *; }
-keep class com.Invoice_Studio.myapp.MainApplication { *; }
# Belt-and-braces: keep ANY MainActivity/MainApplication that the manifest might
# point to after a future package rename, since these names are referenced via
# the manifest's android:name="...MainActivity" attribute (string-only).
-keep class **.MainActivity { *; }
-keep class **.MainApplication { *; }
-keep class **.MainActivityKt { *; }
-keep class **.MainApplicationKt { *; }

# ── Expo-specific: keep all expo modules by interface ─────────────────────────
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * implements expo.modules.core.interfaces.InternalModule { *; }

# ── Kotlin coroutines (if used by expo modules) ───────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.** {
    volatile <fields>;
}

# ── Google Mobile Ads ─────────────────────────────────────────────────────────
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
-keep class com.google.ads.** { *; }
-dontwarn com.google.ads.**
-keep class com.google.android.gms.ads.sdk.** { *; }
-dontwarn com.google.android.gms.ads.sdk.**
# Keep ad unit ID strings (referenced via reflection by AdMob SDK)
-keepclassmembers class * {
  public static volatile *** ADMOB_*;
  public static volatile *** AD_UNIT_*;
}

# ── Glide / Fresco / ImagePipeline (used by Expo Notifications rich images) ──
-keep class com.bumptech.glide.** { *; }
-dontwarn com.bumptech.glide.**
-keep class com.facebook.imagepipeline.** { *; }
-dontwarn com.facebook.imagepipeline.**
-keep public class * extends com.facebook.imagepipeline.producers.NetworkFetcher { *; }
-keep class * implements com.facebook.imagepipeline.producers.NetworkFetcher { *; }

# ── RevenueCat ────────────────────────────────────────────────────────────────
-keep class com.revenuecat.** { *; }
-dontwarn com.revenuecat.**

# ── Sentry ────────────────────────────────────────────────────────────────────
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ── Firebase / ML Kit (Camera Scanner) ────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ── AndroidX ──────────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ── AsyncStorage (React Native Community) ──────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

# ── React Native New Architecture / Codegen ────────────────────
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# ── General ───────────────────────────────────────────────────────────────────
-keepattributes Exceptions,InnerClasses,Signature,Deprecated,SourceFile,LineNumberTable,*Annotation*,EnclosingMethod
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-dontwarn java.lang.invoke.StringConcatFactory

# ── Tink / Google HTTP client / Joda-Time ────────────────────────────────────
# R8 was stripping com.google.crypto.tink.KeysDownloader transitively; it pulls
# class refs from com.google.api.client.http.* and org.joda.time.* that have no
# static call chain from app code → "Missing class" R8 errors at release build.
-keep class com.google.crypto.tink.** { *; }
-keep class com.google.api.client.http.** { *; }
-keep class org.joda.time.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.api.client.**
-dontwarn org.joda.time.**

# ── Supabase + OkHttp/Okio transitive (real-device crash in v62#1) ───────────
# Supabase JS client uses Java reflection on response objects + kotlin
# companion objects. Stripping these breaks auth callback handling.
-keep class kotlin.Metadata { *; }
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations
-keep class kotlinx.serialization.** { *; }
-dontwarn kotlinx.serialization.**
-keep,includedescriptorclasses class kotlin.coroutines.Continuation
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# ── RevenueCat — PurchasesAndroid (reflection on offerings/periods) ──────────
# Purchases SDK calls com.revenuecat.purchases.Purchases via reflection; the
# default SDK ProGuard rules cover most cases but offer ID parsing hits
# kotlin.Result which R8 strips unless explicitly kept.
-keep class kotlin.Result { *; }
-keep class com.revenuecat.purchases.common.** { *; }
-keep class com.revenuecat.purchases.models.** { *; }

# ── React Native CLI runtime (Java reflection for turbomodules + new arch) ───
# Without these, newArchitectureEnabled causes ABI-safety crashes on first JS
# bridge call.
-keep class com.facebook.react.runtime.** { *; }
-keep class com.facebook.react.modules.core.DeviceEventManagerModule** { *; }
-keep class * implements com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }

# ── WebView / Reanimated / Gesture Handler ───────────────────────────────────
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.**
-dontwarn com.reactnativecommunity.**
