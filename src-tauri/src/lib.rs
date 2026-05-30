// lib.rs – NexusCrypt Tauri app library entry point

pub mod commands;
pub mod crypto;
pub mod file_ops;
pub mod kdf;
pub mod keygen;

use std::sync::Arc;
use tokio::sync::Semaphore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Limit concurrent KDF operations to prevent memory exhaustion.
    // Argon2id allocates 64-256 MB per run; multiple parallel runs could OOM.
    let kdf_semaphore = Arc::new(Semaphore::new(1));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(kdf_semaphore)
        .invoke_handler(tauri::generate_handler![
            commands::encrypt_file,
            commands::decrypt_file,
            commands::generate_key_file,
            commands::get_file_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NexusCrypt");
}
