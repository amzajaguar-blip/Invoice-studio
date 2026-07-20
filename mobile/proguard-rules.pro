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
-dontwarn expo.modules.**
-keep class abi**.expo.modules.** { *; }

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
