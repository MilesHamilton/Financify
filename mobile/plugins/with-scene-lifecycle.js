/**
 * Expo config plugin: adopt the UIKit scene-based life cycle.
 *
 * Xcode 27's iOS SDK refuses to launch apps that have not adopted UIScene
 * ("UIScene life cycle is required for apps built with this SDK"). Expo SDK 57 /
 * React Native 0.86 templates still create the window in
 * `application(_:didFinishLaunchingWithOptions:)`, so we:
 *   1. add `UIApplicationSceneManifest` to Info.plist,
 *   2. generate `SceneDelegate.swift` that creates the window inside
 *      `scene(_:willConnectTo:options:)`, starts React Native there, and
 *      forwards deep links / universal links to RCTLinkingManager,
 *   3. patch the generated AppDelegate to stop creating the window itself
 *      (it still builds the React Native factory).
 *
 * Remove this plugin once Expo ships native scene-lifecycle support.
 */
const fs = require('node:fs');
const path = require('node:path');

const { withInfoPlist, withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const SCENE_DELEGATE_SWIFT = `import UIKit
import React

/// Scene-based life cycle entry point (see plugins/with-scene-lifecycle.js).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)
    window.makeKeyAndVisible()

    for context in connectionOptions.urlContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = RCTLinkingManager.application(UIApplication.shared, continue: activity) { _ in }
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity) { _ in }
  }
}
`;

function patchAppDelegate(source) {
  if (source.includes('var launchOptions:')) return source; // already patched
  let out = source.replace(
    'var window: UIWindow?',
    'var window: UIWindow?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?',
  );
  // Remember launch options for the scene delegate, then drop the window
  // creation block (the scene delegate owns the window now).
  out = out.replace(
    /(\n\s*let delegate = ReactNativeDelegate\(\))/,
    '\n    self.launchOptions = launchOptions$1',
  );
  out = out.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\n/,
    '    // Window creation moved to SceneDelegate (UIScene life cycle).\n',
  );
  if (!out.includes('Window creation moved to SceneDelegate')) {
    throw new Error('[with-scene-lifecycle] Could not patch AppDelegate.swift window block; template changed?');
  }
  return out;
}

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName;
      const dir = path.join(cfg.modRequest.platformProjectRoot, projectName);
      fs.writeFileSync(path.join(dir, 'SceneDelegate.swift'), SCENE_DELEGATE_SWIFT);
      const appDelegatePath = path.join(dir, 'AppDelegate.swift');
      fs.writeFileSync(appDelegatePath, patchAppDelegate(fs.readFileSync(appDelegatePath, 'utf8')));
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = cfg.modRequest.projectName;
    const filepath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project,
      });
    }
    return cfg;
  });

  return config;
};

module.exports = withSceneLifecycle;
