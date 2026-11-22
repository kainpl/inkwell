use spellbook::Dictionary;
use std::sync::OnceLock;

type Cached = OnceLock<Result<Dictionary, String>>;
static ENGLISH: Cached = OnceLock::new();
static UKRAINIAN: Cached = OnceLock::new();

fn dictionary(lang: &str) -> Result<&'static Dictionary, String> {
    let (slot, aff, dic) = match lang {
        "en" => (
            &ENGLISH,
            include_str!("../../node_modules/dictionary-en/index.aff"),
            include_str!("../../node_modules/dictionary-en/index.dic"),
        ),
        "uk" => (
            &UKRAINIAN,
            include_str!("../../node_modules/dictionary-uk/index.aff"),
            include_str!("../../node_modules/dictionary-uk/index.dic"),
        ),
        _ => return Err(format!("Unknown dictionary: {lang}")),
    };
    slot.get_or_init(|| Dictionary::new(aff, dic).map_err(|e| e.to_string()))
        .as_ref()
        .map_err(Clone::clone)
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
    words: Vec<String>,
    languages: Vec<String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dicts = languages
            .iter()
            .map(|lang| Ok((lang.as_str(), dictionary(lang)?)))
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
pub async fn suggestions(word: String, languages: Vec<String>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut result = Vec::new();
        let lang = word_language(&word);
        if word.chars().count() <= 64 && languages.iter().any(|l| l == lang) {
            dictionary(lang)?.suggest(&word, &mut result);
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
            let d = dictionary(language).unwrap();
            assert!(d.check(correct));
            assert!(!d.check(typo));
            let mut suggestions = Vec::new();
            d.suggest(typo, &mut suggestions);
            assert!(suggestions.iter().any(|s| s == correct));
        }
    }
}
