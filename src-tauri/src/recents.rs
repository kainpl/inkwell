use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Files,
    Folders,
}

#[derive(Deserialize, Serialize)]
pub struct RecentList {
    limit: usize,
    paths: Vec<PathBuf>,
}

impl Default for RecentList {
    fn default() -> Self {
        Self {
            limit: 10,
            paths: Vec::new(),
        }
    }
}

impl RecentList {
    fn visit(&mut self, path: PathBuf) -> bool {
        if self.limit == 0 || self.paths.first() == Some(&path) {
            return false;
        }
        self.paths.retain(|p| p != &path);
        self.paths.insert(0, path);
        self.paths.truncate(self.limit);
        true
    }
}

#[derive(Default, Deserialize, Serialize)]
pub struct History {
    files: RecentList,
    folders: RecentList,
}

impl History {
    fn list(&mut self, kind: Kind) -> &mut RecentList {
        match kind {
            Kind::Files => &mut self.files,
            Kind::Folders => &mut self.folders,
        }
    }

    fn apply(&mut self, change: Change) -> bool {
        match change {
            Change::Visit { kind, path } => return self.list(kind).visit(path),
            Change::Limit { kind, limit } => {
                let list = self.list(kind);
                list.limit = limit.min(100);
                list.paths.truncate(list.limit);
            }
            Change::Remove { kind, path } => self.list(kind).paths.retain(|p| p != &path),
            Change::Clear { kind } => self.list(kind).paths.clear(),
        }
        true
    }
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Change {
    Visit { kind: Kind, path: PathBuf },
    Remove { kind: Kind, path: PathBuf },
    Clear { kind: Kind },
    Limit { kind: Kind, limit: usize },
}

fn directory(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.state::<crate::AppData>().0.join("history"))
}

pub fn protect_storage(app: &AppHandle) -> tauri::Result<()> {
    app.fs_scope().forbid_directory(directory(app)?, true)
}

// Keep path grants and displayed entries in one bounded list. A second app
// instance must read the latest snapshot before modifying it.
fn access(
    dir: &Path,
    operation: impl FnOnce(&mut History) -> Result<bool, String>,
) -> Result<History, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(dir.join("lock"))
        .map_err(|e| e.to_string())?;
    lock.lock().map_err(|e| e.to_string())?;
    let path = dir.join("recents.json");
    let mut history: History = match fs::read(&path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| e.to_string())?,
        Err(e) if e.kind() == io::ErrorKind::NotFound => History::default(),
        Err(e) => return Err(e.to_string()),
    };
    if operation(&mut history)? {
        let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| e.to_string())?;
        serde_json::to_writer(&mut tmp, &history).map_err(|e| e.to_string())?;
        tmp.persist(path).map_err(|e| e.to_string())?;
    }
    Ok(history)
}

fn checked_path(path: &Path, kind: Kind) -> Result<PathBuf, String> {
    let resolved = dunce::canonicalize(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let metadata = fs::metadata(&resolved).map_err(|e| e.to_string())?;
    if !match kind {
        Kind::Files => metadata.is_file(),
        Kind::Folders => metadata.is_dir(),
    } {
        return Err(format!("Unexpected path type: {}", path.display()));
    }
    Ok(resolved)
}

#[tauri::command]
pub async fn recent_history(app: AppHandle, change: Option<Change>) -> Result<History, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = directory(&app).map_err(|e| e.to_string())?;
        access(&dir, |history| {
            let Some(mut change) = change else {
                return Ok(false);
            };
            if let Change::Visit { kind, path } = &mut change {
                if history.list(*kind).limit == 0 {
                    return Ok(false);
                }
                *path = checked_path(path, *kind)?;
                let scope = app.fs_scope();
                if !scope.is_allowed(&*path) {
                    return Err(format!("Access denied: {}", path.display()));
                }
                if matches!(kind, Kind::Folders) {
                    // Only remember a folder with the recursive grant from its picker.
                    let escaped = glob::Pattern::escape(&path.to_string_lossy());
                    let recursive = Path::new(&escaped).join("**");
                    if !scope
                        .allowed_patterns()
                        .iter()
                        .any(|p| p.as_str() == recursive.to_string_lossy())
                    {
                        return Err(format!("Folder access denied: {}", path.display()));
                    }
                }
            }
            Ok(history.apply(change))
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use Kind::{Files, Folders};

    #[test]
    fn changes_persist_independently_across_reads() {
        let dir = tempfile::tempdir().unwrap();
        let apply = |change| access(dir.path(), |h| Ok(h.apply(change))).unwrap();
        let visit = |kind, name: &str| {
            apply(Change::Visit {
                kind,
                path: name.into(),
            })
        };
        visit(Folders, "notes");
        for name in ["a.md", "b.md", "c.md", "a.md"] {
            visit(Files, name);
        }
        let h = apply(Change::Limit {
            kind: Files,
            limit: 2,
        });
        assert_eq!(h.files.paths, [Path::new("a.md"), Path::new("c.md")]);
        apply(Change::Remove {
            kind: Files,
            path: "a.md".into(),
        });
        let h = apply(Change::Clear { kind: Folders });
        assert_eq!(h.files.paths, [Path::new("c.md")]);
        assert!(h.folders.paths.is_empty());
        apply(Change::Limit {
            kind: Files,
            limit: 0,
        });
        visit(Files, "disabled.md");
        visit(Folders, "other");
        let h = access(dir.path(), |_| Ok(false)).unwrap();
        assert!(h.files.paths.is_empty());
        assert_eq!(h.files.limit, 0);
        assert_eq!(h.folders.limit, 10);
        assert_eq!(h.folders.paths, [Path::new("other")]);
    }
}

#[tauri::command]
pub async fn restore_recent_access(
    app: AppHandle,
    kind: Kind,
    path: PathBuf,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = directory(&app).map_err(|e| e.to_string())?;
        access(&dir, |history| {
            if !history.list(kind).paths.contains(&path) || checked_path(&path, kind)? != path {
                return Err(format!("Not a recent location: {}", path.display()));
            }
            let scope = app.fs_scope();
            match kind {
                Kind::Files => scope.allow_file(&path),
                Kind::Folders => scope.allow_directory(&path, true),
            }
            .map_err(|e| e.to_string())?;
            Ok(false)
        })
        .map(|_| ())
    })
    .await
    .map_err(|e| e.to_string())?
}
