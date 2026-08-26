import os
import sys

def configure_android():
    print("Configuring Android project for Pixel / Android 14+ background audio playback...")

    # 1. Update variables.gradle
    var_path = 'android/variables.gradle'
    if os.path.exists(var_path):
        with open(var_path, 'r', encoding='utf-8') as f:
            content = f.read()
        content = content.replace('minSdkVersion = 22', 'minSdkVersion = 24')
        content = content.replace('minSdkVersion = 21', 'minSdkVersion = 24')
        content = content.replace('compileSdkVersion = 34', 'compileSdkVersion = 35')
        content = content.replace('targetSdkVersion = 34', 'targetSdkVersion = 35')
        with open(var_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated android/variables.gradle")

    # 2. Update gradle.properties
    prop_path = 'android/gradle.properties'
    if os.path.exists(prop_path):
        with open(prop_path, 'a', encoding='utf-8') as f:
            f.write('\nandroid.injected.testOnly=false\n')
    else:
        with open(prop_path, 'w', encoding='utf-8') as f:
            f.write('android.injected.testOnly=false\n')
    print("Configured android/gradle.properties")

    # 3. Add Foreground Audio Service Java Class
    java_dir = 'android/app/src/main/java/org/audioeco/app'
    os.makedirs(java_dir, exist_ok=True)

    service_path = os.path.join(java_dir, 'AudioForegroundService.java')
    service_code = '''package org.audioeco.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class AudioForegroundService extends Service {
    public static final String CHANNEL_ID = "audioeco_playback_channel";
    public static final int NOTIFICATION_ID = 1001;
    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";

    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "AudioECO:ContinuousAudioLock"
            );
            wakeLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire();
        }

        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AudioECO")
            .setContentText("Фоновое воспроизведение активно")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "AudioECO Playback Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Удерживает воспроизведение аудио в фоне и при выключенном экране");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
'''
    with open(service_path, 'w', encoding='utf-8') as f:
        f.write(service_code)
    print("Created AudioForegroundService.java")

    # 4. Patch MainActivity.java
    main_act_path = os.path.join(java_dir, 'MainActivity.java')
    main_activity_code = '''package org.audioeco.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Request notification permissions for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Start Foreground Audio Service to prevent Pixel / Android OS from freezing audio
        try {
            Intent serviceIntent = new Intent(this, AudioForegroundService.class);
            serviceIntent.setAction(AudioForegroundService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Configure WebView for continuous media playback without user-gesture requirements
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onPause() {
        // Do NOT pause WebView timers or audio engine when app is in background or screen is off
        super.onPause();
    }

    @Override
    public void onStop() {
        // Keep foreground service and audio threads active
        super.onStop();
    }
}
'''
    with open(main_act_path, 'w', encoding='utf-8') as f:
        f.write(main_activity_code)
    print("Configured MainActivity.java with Foreground Audio Service launcher")

    # 5. Patch AndroidManifest.xml
    manifest_path = 'android/app/src/main/AndroidManifest.xml'
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            m_content = f.read()

        m_content = m_content.replace('package="com.example.app"', 'package="org.audioeco.app"')

        # Add permissions
        perms = (
            '\n    <uses-permission android:name="android.permission.INTERNET" />\n'
            '    <uses-permission android:name="android.permission.WAKE_LOCK" />\n'
            '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
            '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\n'
            '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
            '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n'
        )
        if 'android.permission.WAKE_LOCK' not in m_content:
            m_content = m_content.replace('</manifest>', perms + '</manifest>')

        # Add Service declaration inside <application>
        service_tag = '''
        <service
            android:name="org.audioeco.app.AudioForegroundService"
            android:foregroundServiceType="mediaPlayback"
            android:exported="false" />
    </application>'''

        if 'AudioForegroundService' not in m_content:
            m_content = m_content.replace('</application>', service_tag)

        if 'android:extractNativeLibs' not in m_content:
            m_content = m_content.replace('<application', '<application\n        android:extractNativeLibs="true"')

        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(m_content)
        print("Configured AndroidManifest.xml with AudioForegroundService declaration")

if __name__ == '__main__':
    configure_android()
