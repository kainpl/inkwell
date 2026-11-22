#[tauri::command]
pub fn set_shell_theme(app: tauri::AppHandle, theme: tauri::Theme) {
    #[cfg(windows)]
    set_popup_theme(theme);
    app.set_theme(Some(theme));
}

// Tauri themes the caption and menu bar. The Win32 popup menu also uses a
// process preference, which otherwise follows the Windows apps color setting.
#[cfg(windows)]
fn set_popup_theme(theme: tauri::Theme) {
    use windows_sys::{
        Wdk::System::SystemServices::RtlGetVersion,
        Win32::System::{
            LibraryLoader::{GetModuleHandleW, GetProcAddress},
            SystemInformation::OSVERSIONINFOW,
        },
        core::w,
    };

    let mut version = OSVERSIONINFOW {
        dwOSVersionInfoSize: size_of::<OSVERSIONINFOW>() as u32,
        ..Default::default()
    };
    // Before Windows 10 1903 ordinal 135 had a different signature.
    // These optional UxTheme exports are also used by Microsoft's PowerToys.
    unsafe {
        if RtlGetVersion(&mut version) != 0 || version.dwBuildNumber < 18362 {
            return;
        }
        let module = GetModuleHandleW(w!("uxtheme.dll"));
        if module.is_null() {
            return;
        }
        let (Some(set_mode), Some(flush)) = (
            GetProcAddress(module, 135usize as *const u8),
            GetProcAddress(module, 136usize as *const u8),
        ) else {
            return;
        };
        let set_mode: unsafe extern "system" fn(i32) -> i32 = std::mem::transmute(set_mode);
        let flush: unsafe extern "system" fn() = std::mem::transmute(flush);
        const FORCE_DARK: i32 = 2;
        const FORCE_LIGHT: i32 = 3;
        set_mode(if theme == tauri::Theme::Dark {
            FORCE_DARK
        } else {
            FORCE_LIGHT
        });
        flush();
    }
}
