// Declared here (apply false) purely so this script's own compile classpath
// includes AGP's library-plugin classes for the compileSdk override below —
// it is never applied to the root project itself.
plugins {
    id("com.android.library") apply false
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// wireguard_flutter (0.1.3) hardcodes compileSdkVersion 31 in its own
// android/build.gradle, but its own transitive deps (androidx.appcompat,
// androidx.window, etc.) require compiling against 33/34+ — the plugin is
// simply stale. Override just that module (not `subprojects` in general —
// ":app" was already force-evaluated by `evaluationDependsOn(":app")`
// above, so calling `afterEvaluate` on it throws "already evaluated";
// wireguard_flutter itself hasn't been touched yet at this point, so
// afterEvaluate on it correctly runs after its own script sets 31,
// overriding it) instead of patching pub-cache directly (which
// `flutter pub get` would just overwrite anyway).
project(":wireguard_flutter").afterEvaluate {
    extensions.findByType(com.android.build.gradle.LibraryExtension::class.java)?.let {
        it.compileSdk = 35
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
