use spellbook::Dictionary;
use std::{fs, path::Path, sync::OnceLock};
use tauri::{AppHandle, Manager};

type Cached = OnceLock<Result<Dictionary, String>>;
static ENGLISH: Cached = OnceLock::new();
static UKRAINIAN: Cached = OnceLock::new();

fn dictionary(root: &Path, lang: &str) -> Result<&'static Dictionary, String> {
    let slot = match lang {
        "en" => &ENGLISH,
        "uk" => &UKRAINIAN,
        _ => return Err(format!("Unknown dictionary: {lang}")),
    };
    slot.get_or_init(|| {
        let folder = root.join(format!("dictionary-{lang}"));
        let read = |name| {
            let path = folder.join(name);
            fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))
        };
        Dictionary::new(&read("index.aff")?, &read("index.dic")?).map_err(|e| e.to_string())
    })
    .as_ref()
    .map_err(Clone::clone)
}

fn dictionaries(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    if cfg!(dev) {
        return Ok(Path::new(env!("CARGO_MANIFEST_DIR")).join("../node_modules"));
    }
    Ok(app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("dictionaries"))
}

// The Ukrainian dictionary strips Latin letters during normalization. Choose by
// script first so that it cannot accept an English typo in bilingual mode.
fn word_language(word: &str) -> &str {
    if word
        .chars()
        .any(|ch| ('\u{0400}'..='\u{052f}').contains(&ch))
    {
        "uk"
    } else {
        "en"
    }
}

#[tauri::command]
pub async fn misspellings(
    app: AppHandle,
    words: Vec<String>,
    languages: Vec<String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = dictionaries(&app)?;
        let dicts = languages
            .iter()
            .map(|lang| Ok((lang.as_str(), dictionary(&root, lang)?)))
            .collect::<Result<std::collections::HashMap<_, _>, String>>()?;
        Ok(words
            .into_iter()
            .filter(|word| {
                !dicts
                    .get(word_language(word))
                    .is_some_and(|d| d.check(word))
            })
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn suggestions(
    app: AppHandle,
    word: String,
    languages: Vec<String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut result = Vec::new();
        let lang = word_language(&word);
        if word.chars().count() <= 64 && languages.iter().any(|l| l == lang) {
            dictionary(&dictionaries(&app)?, lang)?.suggest(&word, &mut result);
            result.truncate(6);
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn checks_both_bundled_dictionaries() {
        for (language, correct, typo) in [
            ("en", "writing", "writting"),
            ("uk", "українською", "українськоою"),
        ] {
            assert_eq!(word_language(typo), language);
            let d = dictionary(
                &Path::new(env!("CARGO_MANIFEST_DIR")).join("../node_modules"),
                language,
            )
            .unwrap();
            assert!(d.check(correct));
            assert!(!d.check(typo));
            let mut suggestions = Vec::new();
            d.suggest(typo, &mut suggestions);
            assert!(suggestions.iter().any(|s| s == correct));
        }
    }
}
