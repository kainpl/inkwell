#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::webview::NewWindowResponse;
use tauri::{Manager, WebviewWindowBuilder};

mod images;
mod recents;
mod spelling;
mod theme;

struct AppData(PathBuf);

fn main() {
    let builder = tauri::Builder::default();
    #[cfg(windows)]
    let builder = builder.plugin(
        tauri_plugin_snap_layout::init()
            .button_id("window-maximize")
            .build(),
    );
    builder
        .invoke_handler(tauri::generate_handler![
            spelling::misspellings,
            spelling::suggestions,
            theme::set_shell_theme,
            recents::recent_history,
            recents::restore_recent_access
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("ink-image", |_, request, responder| {
            tauri::async_runtime::spawn_blocking(move || {
                responder.respond(images::read(request.uri().path()))
            });
        })
        .setup(|app| {
            let config = &app.config().app.windows[0];
            let dev_url = app.config().build.dev_url.clone();
            let window = WebviewWindowBuilder::from_config(app, config)?;
            #[cfg(windows)]
            let window = window.decorations(false);
            let resources = app.path().resource_dir()?;
            let portable = cfg!(windows) && resources.join("portable").is_file();
            let data = if portable {
                resources.join("data")
            } else {
                app.path().app_data_dir()?
            };
            let window = if portable {
                window.data_directory(data.join("webview"))
            } else {
                window
            };
            app.manage(AppData(data));
            recents::protect_storage(app.handle())?;
            window
                .on_navigation(move |url| {
                    let local = url.port().is_none()
                        && matches!(
                            (url.scheme(), url.host_str()),
                            ("tauri", Some("localhost"))
                                | ("http" | "https", Some("tauri.localhost"))
                        );
                    local
                        || (cfg!(dev)
                            && dev_url
                                .as_ref()
                                .is_some_and(|dev| dev.origin() == url.origin()))
                })
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Inkwell");
}
