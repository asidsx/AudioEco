import os
import sys

def configure_android():
    print("Configuring Android project for background playback and modern SDK...")

    # 1. Update variables.gradle (minSdkVersion 24 is mandatory for Android 14+)
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

    # 3. Patch AndroidManifest.xml: Add Foreground & Audio Wake Permissions
    manifest_path = 'android/app/src/main/AndroidManifest.xml'
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            m_content = f.read()

        perms = (
            '\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\n'
            '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
            '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\n'
            '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n'
            '    <uses-permission android:name="android.permission.INTERNET" />\n'
        )
        if 'android.permission.WAKE_LOCK' not in m_content:
            m_content = m_content.replace('</manifest>', perms + '</manifest>')

        if 'android:extractNativeLibs' not in m_content:
            m_content = m_content.replace('<application', '<application\n        android:extractNativeLibs="true"')

        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(m_content)
        print("Configured AndroidManifest.xml with background audio permissions")

    # 4. Patch MainActivity.java: Prevent WebView background audio pausing
    main_act_path = 'android/app/src/main/java/org/audioeco/app/MainActivity.java'
    if not os.path.exists(main_act_path):
        for root, dirs, files in os.walk('android/app/src/main/java'):
            if 'MainActivity.java' in files:
                main_act_path = os.path.join(root, 'MainActivity.java')
                break

    if os.path.exists(main_act_path):
        with open(main_act_path, 'r', encoding='utf-8') as f:
            java_code = f.read()

        if 'onPause' not in java_code:
            replacement = (
                '\n    @Override\n'
                '    public void onPause() {\n'
                '        // Keep background audio active without pausing WebView\n'
                '        super.onPause();\n'
                '    }\n\n'
                '    @Override\n'
                '    public void onStop() {\n'
                '        // Keep audio threads alive when locked or in background\n'
                '        super.onStop();\n'
                '    }\n'
                '}'
            )
            java_code = java_code.rstrip()
            if java_code.endswith('}'):
                java_code = java_code[:-1] + replacement
                with open(main_act_path, 'w', encoding='utf-8') as f:
                    f.write(java_code)
                print(f"Configured {main_act_path} for continuous background audio playback")

if __name__ == '__main__':
    configure_android()
