use std::{fs, path::Path};

use percent_encoding::percent_decode_str;
use tauri::http::Response;

// The webview only needs image subresources. Filesystem commands use the dialog plugin's scope.
pub fn read(encoded: &str) -> Response<Vec<u8>> {
    let missing = || Response::builder().status(404).body(Vec::new()).unwrap();
    let Ok(decoded) = percent_decode_str(encoded.trim_start_matches('/')).decode_utf8() else {
        return missing();
    };
    let path = Path::new(decoded.as_ref());
    if !path.is_absolute() || decoded.starts_with("//") || decoded.starts_with(r"\\") {
        return missing();
    }
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        _ => return missing(),
    };
    match fs::read(path) {
        Ok(bytes) => Response::builder()
            .header("Content-Type", mime)
            .header("X-Content-Type-Options", "nosniff")
            .header(
                "Content-Security-Policy",
                "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            )
            .body(bytes)
            .unwrap(),
        Err(_) => missing(),
    }
}
