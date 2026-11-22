#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::WebviewWindowBuilder;
use tauri::webview::NewWindowResponse;

mod images;
mod spelling;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            spelling::misspellings,
            spelling::suggestions
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
            WebviewWindowBuilder::from_config(app, config)?
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
