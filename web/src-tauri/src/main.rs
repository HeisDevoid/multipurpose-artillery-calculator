// No console window in the Windows release build
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

/// Global hotkeys: they work while the game has focus.
/// A press is forwarded to the windows as a `hotkey` event with the action name.
fn shortcuts() -> [(Shortcut, &'static str); 7] {
    let modifiers = Some(Modifiers::CONTROL | Modifiers::ALT);
    [
        (Shortcut::new(modifiers, Code::KeyF), "fire"),
        (Shortcut::new(modifiers, Code::KeyO), "overlay"),
        (Shortcut::new(modifiers, Code::KeyD), "input"),
        (Shortcut::new(modifiers, Code::KeyS), "screen-markers"),
        (Shortcut::new(modifiers, Code::KeyM), "mode"),
        (Shortcut::new(modifiers, Code::KeyN), "next-target"),
        (Shortcut::new(modifiers, Code::KeyP), "previous-target"),
    ]
}

fn main() {
    tauri::Builder::default()
        // A single copy of the app: a second launch shows the window that is already open
        // (a second copy would not get the hotkeys) and checks for updates
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = app.emit("second-instance", ());
        }))
        // The app update from GitHub Releases and the restart after it
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if let Some((_, action)) =
                        shortcuts().into_iter().find(|(s, _)| s == shortcut)
                    {
                        let _ = app.emit("hotkey", action);
                    }
                })
                .build(),
        )
        .setup(|app| {
            for (shortcut, _) in shortcuts() {
                // The shortcut may be taken by another program:
                // the app starts anyway.
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    eprintln!("global shortcut not registered: {error}");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
