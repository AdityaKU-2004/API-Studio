use crate::git::git_manager;
use crate::models::{
    AppError, GitBranchInfo, GitCommitEntry, GitDiffResult, GitSecretFinding, GitStatusEntry,
};

#[tauri::command]
pub fn git_init_repo(repo_path: String) -> Result<String, AppError> {
    git_manager::init_repository(&repo_path)
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<Vec<GitStatusEntry>, AppError> {
    git_manager::get_status(&repo_path)
}

#[tauri::command]
pub fn git_stage_paths(repo_path: String, paths: Vec<String>) -> Result<(), AppError> {
    git_manager::stage_paths(&repo_path, paths)
}

#[tauri::command]
pub fn git_unstage_paths(repo_path: String, paths: Vec<String>) -> Result<(), AppError> {
    git_manager::unstage_paths(&repo_path, paths)
}

#[tauri::command]
pub fn git_scan_staged_secrets(repo_path: String) -> Result<Vec<GitSecretFinding>, AppError> {
    git_manager::scan_staged_secrets(&repo_path)
}

#[tauri::command]
pub fn git_commit_changes(
    repo_path: String,
    message: String,
    author_name: String,
    author_email: String,
) -> Result<String, AppError> {
    git_manager::commit_changes(&repo_path, &message, &author_name, &author_email)
}

#[tauri::command]
pub fn git_list_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<GitCommitEntry>, AppError> {
    git_manager::list_commits(&repo_path, limit.unwrap_or(30))
}

#[tauri::command]
pub fn git_list_branches(repo_path: String) -> Result<Vec<GitBranchInfo>, AppError> {
    git_manager::list_branches(&repo_path)
}

#[tauri::command]
pub fn git_create_branch(repo_path: String, name: String) -> Result<(), AppError> {
    git_manager::create_branch(&repo_path, &name)
}

#[tauri::command]
pub fn git_switch_branch(repo_path: String, name: String) -> Result<(), AppError> {
    git_manager::switch_branch(&repo_path, &name)
}

#[tauri::command]
pub fn git_diff_file(
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<GitDiffResult, AppError> {
    git_manager::get_diff(&repo_path, &file_path, staged)
}

#[tauri::command]
pub fn git_discard_changes(repo_path: String, paths: Vec<String>) -> Result<(), AppError> {
    git_manager::discard_worktree_changes(&repo_path, paths)
}
