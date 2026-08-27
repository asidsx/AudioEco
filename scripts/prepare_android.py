import os
import sys

def configure_android():
    print("Configuring Android project for Pixel / Android 14+ background audio playback and lockscreen media controls...")

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

    # 3. Add AndroidX Media dependencies to app/build.gradle
    build_gradle_path = 'android/app/build.gradle'
    if os.path.exists(build_gradle_path):
        with open(build_gradle_path, 'r', encoding='utf-8') as f:
            bg_content = f.read()
        if 'androidx.media:media:' not in bg_content:
            dep_block = "dependencies {\n    implementation 'androidx.media:media:1.7.0'"
            bg_content = bg_content.replace("dependencies {", dep_block)
            with open(build_gradle_path, 'w', encoding='utf-8') as f:
                f.write(bg_content)
            print("Added androidx.media dependency to app/build.gradle")

    # 4. Add Full MediaSession Foreground Audio Service Java Class
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
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

public class AudioForegroundService extends Service {
    public static final String CHANNEL_ID = "audioeco_playback_channel";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String ACTION_UPDATE_STATE = "ACTION_UPDATE_STATE";
    public static final String ACTION_REWIND_10 = "ACTION_REWIND_10";
    public static final String ACTION_FAST_FORWARD_10 = "ACTION_FAST_FORWARD_10";
    public static final String ACTION_TOGGLE_PLAY = "ACTION_TOGGLE_PLAY";
    public static final String ACTION_PLAY = "ACTION_PLAY";
    public static final String ACTION_PAUSE = "ACTION_PAUSE";

    public static final String EXTRA_TITLE = "EXTRA_TITLE";
    public static final String EXTRA_ARTIST = "EXTRA_ARTIST";
    public static final String EXTRA_IS_PLAYING = "EXTRA_IS_PLAYING";
    public static final String EXTRA_POSITION_MS = "EXTRA_POSITION_MS";
    public static final String EXTRA_DURATION_MS = "EXTRA_DURATION_MS";

    private PowerManager.WakeLock wakeLock;
    private MediaSessionCompat mediaSession;

    private String currentTitle = "Аудиокнига";
    private String currentArtist = "AudioECO";
    private boolean isPlaying = false;
    private long currentPositionMs = 0;
    private long currentDurationMs = 0;

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

        initMediaSession();
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "AudioECO_MediaSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                handlePlay();
            }

            @Override
            public void onPause() {
                handlePause();
            }

            @Override
            public void onRewind() {
                handleRewind();
            }

            @Override
            public void onFastForward() {
                handleFastForward();
            }

            @Override
            public void onSkipToPrevious() {
                handleRewind();
            }

            @Override
            public void onSkipToNext() {
                handleFastForward();
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if ("ACTION_REWIND_10".equals(action) || "REWIND_10".equals(action)) {
                    handleRewind();
                } else if ("ACTION_FAST_FORWARD_10".equals(action) || "FORWARD_10".equals(action)) {
                    handleFastForward();
                }
            }

            @Override
            public void onSeekTo(long pos) {
                currentPositionMs = pos;
                updatePlaybackState();
                sendControlEvent("seek:" + pos);
            }
        });

        mediaSession.setActive(true);
    }

    private void handleTogglePlay() {
        if (isPlaying) {
            handlePause();
        } else {
            handlePlay();
        }
    }

    private void handlePlay() {
        isPlaying = true;
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire();
        }
        updatePlaybackState();
        updateNotification();
        sendControlEvent("play");
    }

    private void handlePause() {
        isPlaying = false;
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        updatePlaybackState();
        updateNotification();
        sendControlEvent("pause");
    }

    private void handleRewind() {
        currentPositionMs = Math.max(0, currentPositionMs - 10000);
        updatePlaybackState();
        sendControlEvent("rewind_10");
    }

    private void handleFastForward() {
        currentPositionMs = Math.min(currentDurationMs > 0 ? currentDurationMs : Long.MAX_VALUE, currentPositionMs + 10000);
        updatePlaybackState();
        sendControlEvent("forward_10");
    }

    private void sendControlEvent(String actionType) {
        if (MainActivity.getInstance() != null) {
            MainActivity.getInstance().dispatchAudioAction(actionType);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (mediaSession != null) {
                mediaSession.setActive(false);
            }
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_REWIND_10.equals(action)) {
            handleRewind();
            return START_STICKY;
        }

        if (ACTION_FAST_FORWARD_10.equals(action)) {
            handleFastForward();
            return START_STICKY;
        }

        if (ACTION_TOGGLE_PLAY.equals(action)) {
            handleTogglePlay();
            return START_STICKY;
        }

        if (ACTION_PLAY.equals(action)) {
            handlePlay();
            return START_STICKY;
        }

        if (ACTION_PAUSE.equals(action)) {
            handlePause();
            return START_STICKY;
        }

        if (ACTION_UPDATE_STATE.equals(action) || ACTION_START.equals(action)) {
            if (intent.hasExtra(EXTRA_TITLE)) currentTitle = intent.getStringExtra(EXTRA_TITLE);
            if (intent.hasExtra(EXTRA_ARTIST)) currentArtist = intent.getStringExtra(EXTRA_ARTIST);
            if (intent.hasExtra(EXTRA_IS_PLAYING)) isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, isPlaying);
            if (intent.hasExtra(EXTRA_POSITION_MS)) currentPositionMs = intent.getLongExtra(EXTRA_POSITION_MS, currentPositionMs);
            if (intent.hasExtra(EXTRA_DURATION_MS)) currentDurationMs = intent.getLongExtra(EXTRA_DURATION_MS, currentDurationMs);
        }

        if (isPlaying) {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }
        } else {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }

        updatePlaybackState();
        updateNotification();

        return START_STICKY;
    }

    private void updatePlaybackState() {
        if (mediaSession == null) return;

        long actions = PlaybackStateCompat.ACTION_PLAY |
                       PlaybackStateCompat.ACTION_PAUSE |
                       PlaybackStateCompat.ACTION_PLAY_PAUSE |
                       PlaybackStateCompat.ACTION_REWIND |
                       PlaybackStateCompat.ACTION_FAST_FORWARD |
                       PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                       PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                       PlaybackStateCompat.ACTION_SEEK_TO;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat.CustomAction rewindAction = new PlaybackStateCompat.CustomAction.Builder(
            "ACTION_REWIND_10", "-10с", android.R.drawable.ic_media_rew
        ).build();

        PlaybackStateCompat.CustomAction forwardAction = new PlaybackStateCompat.CustomAction.Builder(
            "ACTION_FAST_FORWARD_10", "+10с", android.R.drawable.ic_media_ff
        ).build();

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .addCustomAction(rewindAction)
            .addCustomAction(forwardAction)
            .setState(state, currentPositionMs, isPlaying ? 1.0f : 0.0f);

        mediaSession.setPlaybackState(stateBuilder.build());

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "AudioECO")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);

        mediaSession.setMetadata(metaBuilder.build());
    }

    private void updateNotification() {
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
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Action: -10s
        Intent rewindIntent = new Intent(this, AudioForegroundService.class);
        rewindIntent.setAction(ACTION_REWIND_10);
        PendingIntent pRewind = PendingIntent.getService(
            this, 1, rewindIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Action: Play / Pause
        Intent toggleIntent = new Intent(this, AudioForegroundService.class);
        toggleIntent.setAction(ACTION_TOGGLE_PLAY);
        PendingIntent pToggle = PendingIntent.getService(
            this, 2, toggleIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Action: +10s
        Intent forwardIntent = new Intent(this, AudioForegroundService.class);
        forwardIntent.setAction(ACTION_FAST_FORWARD_10);
        PendingIntent pForward = PendingIntent.getService(
            this, 3, forwardIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseTitle = isPlaying ? "Пауза" : "Воспроизведение";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText("AudioECO")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            // Three control buttons: [-10s] [Play/Pause] [+10s]
            .addAction(android.R.drawable.ic_media_rew, "-10с", pRewind)
            .addAction(playPauseIcon, playPauseTitle, pToggle)
            .addAction(android.R.drawable.ic_media_ff, "+10с", pForward)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
                .setShowCancelButton(true)
                .setCancelButtonIntent(pToggle));

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Управление воспроизведением AudioECO",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Элементы управления аудиокнигой на экране блокировки и в шторке");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
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
        if (mediaSession != null) {
            mediaSession.release();
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
    print("Created AudioForegroundService.java with LockScreen MediaStyle controls [-10s, Play/Pause, +10s]")

    # 5. Patch MainActivity.java
    main_act_path = os.path.join(java_dir, 'MainActivity.java')
    main_activity_code = '''package org.audioeco.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // Request notification permissions for Android 13+ (Pixel 8a, Android 14/15/16/17)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Configure WebView for continuous media playback and immediate JS execution
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setJavaScriptEnabled(true);

                // Add Javascript Bridge for 2-way native sync
                webView.addJavascriptInterface(new AudioBridgeInterface(), "AndroidNativeAudio");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void dispatchAudioAction(final String actionType) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (bridge != null && bridge.getWebView() != null) {
                        WebView webView = bridge.getWebView();
                        webView.resumeTimers();
                        String script = "try { if (window.__onNativeAudioAction) { window.__onNativeAudioAction('" + actionType + "'); } } catch(e) {}";
                        webView.evaluateJavascript(script, null);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    public class AudioBridgeInterface {
        @JavascriptInterface
        public void updatePlayback(String title, String artist, boolean isPlaying, long positionMs, long durationMs) {
            try {
                Intent serviceIntent = new Intent(MainActivity.this, AudioForegroundService.class);
                serviceIntent.setAction(AudioForegroundService.ACTION_UPDATE_STATE);
                serviceIntent.putExtra(AudioForegroundService.EXTRA_TITLE, title);
                serviceIntent.putExtra(AudioForegroundService.EXTRA_ARTIST, artist);
                serviceIntent.putExtra(AudioForegroundService.EXTRA_IS_PLAYING, isPlaying);
                serviceIntent.putExtra(AudioForegroundService.EXTRA_POSITION_MS, positionMs);
                serviceIntent.putExtra(AudioForegroundService.EXTRA_DURATION_MS, durationMs);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent);
                } else {
                    startService(serviceIntent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Prevent Chromium from freezing JS evaluation and timers in background
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }
}
'''
    with open(main_act_path, 'w', encoding='utf-8') as f:
        f.write(main_activity_code)
    print("Configured MainActivity.java with 2-way Native AudioBridge")

    # 6. Patch AndroidManifest.xml
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
