use crate::models::{
    AppError, GitBranchInfo, GitCommitEntry, GitDiffResult, GitSecretFinding, GitStatusEntry,
};
use git2::{BranchType, DiffOptions, IndexAddOption, Repository, Signature, StatusOptions};
use std::path::Path;

pub fn init_repository(repo_path: &str) -> Result<String, AppError> {
    let path = Path::new(repo_path);
    std::fs::create_dir_all(path)?;
    let repo = Repository::init(path)
        .map_err(|e| AppError::new("GIT_INIT_ERROR", e.message().to_string(), true))?;
    Ok(repo
        .workdir()
        .unwrap_or(path)
        .to_string_lossy()
        .to_string())
}

fn open_repo(repo_path: &str) -> Result<Repository, AppError> {
    Repository::open(repo_path)
        .map_err(|e| AppError::new("GIT_OPEN_ERROR", format!("Failed to open repository: {}", e.message()), true))
}

pub fn get_status(repo_path: &str) -> Result<Vec<GitStatusEntry>, AppError> {
    let repo = open_repo(repo_path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| AppError::new("GIT_STATUS_ERROR", e.message().to_string(), true))?;

    let mut entries = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let st = entry.status();

        let staged = st.is_index_new()
            || st.is_index_modified()
            || st.is_index_deleted()
            || st.is_index_renamed()
            || st.is_index_typechange();
        let untracked = st.is_wt_new();
        let modified = st.is_wt_modified() || st.is_index_modified();
        let deleted = st.is_wt_deleted() || st.is_index_deleted();

        let index_status = if st.is_index_new() {
            "A"
        } else if st.is_index_modified() {
            "M"
        } else if st.is_index_deleted() {
            "D"
        } else {
            ""
        }
        .to_string();

        let worktree_status = if st.is_wt_new() {
            "?"
        } else if st.is_wt_modified() {
            "M"
        } else if st.is_wt_deleted() {
            "D"
        } else {
            ""
        }
        .to_string();

        entries.push(GitStatusEntry {
            path,
            index_status,
            worktree_status,
            staged,
            untracked,
            modified,
            deleted,
        });
    }
    Ok(entries)
}

pub fn stage_paths(repo_path: &str, paths: Vec<String>) -> Result<(), AppError> {
    let repo = open_repo(repo_path)?;
    let mut index = repo
        .index()
        .map_err(|e| AppError::new("GIT_INDEX_ERROR", e.message().to_string(), true))?;

    if paths.is_empty() {
        index
            .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
            .map_err(|e| AppError::new("GIT_STAGE_ERROR", e.message().to_string(), true))?;
    } else {
        for p in paths {
            let rel = Path::new(&p);
            if Path::new(repo_path).join(rel).exists() {
                index
                    .add_path(rel)
                    .map_err(|e| AppError::new("GIT_STAGE_ERROR", e.message().to_string(), true))?;
            } else {
                index
                    .remove_path(rel)
                    .map_err(|e| AppError::new("GIT_STAGE_ERROR", e.message().to_string(), true))?;
            }
        }
    }

    index
        .write()
        .map_err(|e| AppError::new("GIT_STAGE_ERROR", e.message().to_string(), true))?;
    Ok(())
}

pub fn unstage_paths(repo_path: &str, paths: Vec<String>) -> Result<(), AppError> {
    let repo = open_repo(repo_path)?;
    if let Ok(head) = repo.head() {
        let obj = head
            .peel(git2::ObjectType::Commit)
            .map_err(|e| AppError::new("GIT_UNSTAGE_ERROR", e.message().to_string(), true))?;
        repo.reset_default(Some(&obj), paths.iter().map(|s| s.as_str()))
            .map_err(|e| AppError::new("GIT_UNSTAGE_ERROR", e.message().to_string(), true))?;
    } else {
        let mut index = repo
            .index()
            .map_err(|e| AppError::new("GIT_INDEX_ERROR", e.message().to_string(), true))?;
        for p in paths {
            let _ = index.remove_path(Path::new(&p));
        }
        index
            .write()
            .map_err(|e| AppError::new("GIT_UNSTAGE_ERROR", e.message().to_string(), true))?;
    }
    Ok(())
}

pub fn scan_staged_secrets(repo_path: &str) -> Result<Vec<GitSecretFinding>, AppError> {
    let statuses = get_status(repo_path)?;
    let mut findings = Vec::new();
    let root = Path::new(repo_path);

    let patterns: [(&str, &str); 5] = [
        ("Private Key Block", "BEGIN RSA PRIVATE KEY"),
        ("OpenSSH Private Key", "BEGIN OPENSSH PRIVATE KEY"),
        ("AWS Access Key Prefix", "AKIA"),
        ("Bearer Token Literal", "Bearer eyJ"),
        ("GitHub Personal Token", "ghp_"),
    ];

    for entry in statuses {
        if !entry.staged {
            continue;
        }
        let full = root.join(&entry.path);
        if let Ok(text) = std::fs::read_to_string(&full) {
            for (idx, line) in text.lines().enumerate() {
                for (name, needle) in patterns {
                    if line.contains(needle) {
                        findings.push(GitSecretFinding {
                            path: entry.path.clone(),
                            line: idx + 1,
                            pattern_name: name.to_string(),
                            snippet: "[REDACTED SECRET MATCH]".to_string(),
                        });
                    }
                }
            }
        }
    }
    Ok(findings)
}

pub fn commit_changes(
    repo_path: &str,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> Result<String, AppError> {
    if message.trim().is_empty() {
        return Err(AppError::new(
            "VALIDATION_ERROR",
            "Commit message cannot be empty",
            true,
        ));
    }

    let repo = open_repo(repo_path)?;
    let mut index = repo
        .index()
        .map_err(|e| AppError::new("GIT_COMMIT_ERROR", e.message().to_string(), true))?;
    let tree_id = index
        .write_tree()
        .map_err(|e| AppError::new("GIT_COMMIT_ERROR", e.message().to_string(), true))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| AppError::new("GIT_COMMIT_ERROR", e.message().to_string(), true))?;

    let sig = Signature::now(
        if author_name.trim().is_empty() {
            "API Studio User"
        } else {
            author_name.trim()
        },
        if author_email.trim().is_empty() {
            "developer@local.studio"
        } else {
            author_email.trim()
        },
    )
    .map_err(|e| AppError::new("GIT_COMMIT_ERROR", e.message().to_string(), true))?;

    let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let oid = match parent_commit {
        Some(ref parent) => repo.commit(Some("HEAD"), &sig, &sig, message.trim(), &tree, &[parent]),
        None => repo.commit(Some("HEAD"), &sig, &sig, message.trim(), &tree, &[]),
    }
    .map_err(|e| AppError::new("GIT_COMMIT_ERROR", e.message().to_string(), true))?;

    Ok(oid.to_string())
}

pub fn list_commits(repo_path: &str, limit: usize) -> Result<Vec<GitCommitEntry>, AppError> {
    let repo = open_repo(repo_path)?;
    let mut revwalk = match repo.revwalk() {
        Ok(rw) => rw,
        Err(_) => return Ok(Vec::new()),
    };
    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }

    let mut commits = Vec::new();
    for oid_res in revwalk.take(limit) {
        if let Ok(oid) = oid_res {
            if let Ok(c) = repo.find_commit(oid) {
                let hash = oid.to_string();
                let short_hash = hash.chars().take(7).collect();
                let author = c.author().name().unwrap_or("Unknown").to_string();
                let email = c.author().email().unwrap_or("").to_string();
                let timestamp = c.time().seconds() * 1000;
                let message = c.message().unwrap_or("").trim().to_string();
                commits.push(GitCommitEntry {
                    hash,
                    short_hash,
                    author,
                    email,
                    timestamp,
                    message,
                });
            }
        }
    }
    Ok(commits)
}

pub fn list_branches(repo_path: &str) -> Result<Vec<GitBranchInfo>, AppError> {
    let repo = open_repo(repo_path)?;
    let mut out = Vec::new();
    let branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| AppError::new("GIT_BRANCH_ERROR", e.message().to_string(), true))?;

    for b_res in branches {
        if let Ok((branch, _)) = b_res {
            let name = branch
                .name()
                .ok()
                .flatten()
                .unwrap_or("unnamed")
                .to_string();
            let is_current = branch.is_head();
            let last_commit_hash = branch.get().target().map(|o| o.to_string());
            out.push(GitBranchInfo {
                name,
                is_current,
                is_remote: false,
                last_commit_hash,
            });
        }
    }
    Ok(out)
}

pub fn create_branch(repo_path: &str, name: &str) -> Result<(), AppError> {
    let repo = open_repo(repo_path)?;
    let head_commit = repo
        .head()
        .and_then(|h| h.peel_to_commit())
        .map_err(|e| AppError::new("GIT_BRANCH_ERROR", e.message().to_string(), true))?;
    repo.branch(name.trim(), &head_commit, false)
        .map_err(|e| AppError::new("GIT_BRANCH_ERROR", e.message().to_string(), true))?;
    Ok(())
}

pub fn switch_branch(repo_path: &str, name: &str) -> Result<(), AppError> {
    let repo = open_repo(repo_path)?;
    let refname = format!("refs/heads/{}", name.trim());
    let obj = repo
        .revparse_single(&refname)
        .map_err(|e| AppError::new("GIT_SWITCH_ERROR", e.message().to_string(), true))?;
    repo.checkout_tree(&obj, None)
        .map_err(|e| AppError::new("GIT_SWITCH_ERROR", e.message().to_string(), true))?;
    repo.set_head(&refname)
        .map_err(|e| AppError::new("GIT_SWITCH_ERROR", e.message().to_string(), true))?;
    Ok(())
}

pub fn get_diff(repo_path: &str, file_path: &str, staged: bool) -> Result<GitDiffResult, AppError> {
    let repo = open_repo(repo_path)?;
    let mut opts = DiffOptions::new();
    if !file_path.is_empty() {
        opts.pathspec(file_path);
    }

    let diff = if staged {
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))
    }
    .map_err(|e| AppError::new("GIT_DIFF_ERROR", e.message().to_string(), true))?;

    let mut patch_buf = String::new();
    let mut additions = 0usize;
    let mut deletions = 0usize;

    let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        if origin == '+' {
            additions += 1;
            patch_buf.push('+');
        } else if origin == '-' {
            deletions += 1;
            patch_buf.push('-');
        } else if origin == ' ' {
            patch_buf.push(' ');
        }
        if let Ok(s) = std::str::from_utf8(line.content()) {
            patch_buf.push_str(s);
        }
        true
    });

    Ok(GitDiffResult {
        path: file_path.to_string(),
        staged,
        patch: patch_buf,
        additions,
        deletions,
    })
}

pub fn discard_worktree_changes(repo_path: &str, paths: Vec<String>) -> Result<(), AppError> {
    let repo = open_repo(repo_path)?;
    let mut cb = git2::build::CheckoutBuilder::new();
    cb.force();
    for p in &paths {
        cb.path(p);
    }
    repo.checkout_head(Some(&mut cb))
        .map_err(|e| AppError::new("GIT_DISCARD_ERROR", e.message().to_string(), true))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initializes_stages_commits_and_branches_safely() {
        let temp_dir = std::env::temp_dir().join(format!("api_studio_git_{}", uuid::Uuid::new_v4()));
        let path_str = temp_dir.to_string_lossy().to_string();

        init_repository(&path_str).unwrap();
        std::fs::write(temp_dir.join("openapi.yaml"), "openapi: 3.0.3\n").unwrap();

        let status = get_status(&path_str).unwrap();
        assert_eq!(status.len(), 1);
        assert!(status[0].untracked);

        stage_paths(&path_str, vec!["openapi.yaml".to_string()]).unwrap();
        let findings = scan_staged_secrets(&path_str).unwrap();
        assert!(findings.is_empty());

        let oid = commit_changes(&path_str, "Initial API spec", "Tester", "tester@example.com").unwrap();
        assert!(!oid.is_empty());

        let commits = list_commits(&path_str, 10).unwrap();
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, "Initial API spec");

        create_branch(&path_str, "feature/v2").unwrap();
        switch_branch(&path_str, "feature/v2").unwrap();
        let branches = list_branches(&path_str).unwrap();
        assert!(branches.iter().any(|b| b.name == "feature/v2" && b.is_current));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
