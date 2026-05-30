// commands.rs – Tauri IPC commands for NexusCrypt
// All commands are async and return serializable results.

use anyhow::Result;
use rand::RngCore;
use rand::rngs::OsRng;
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::{ErrorKind, Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Semaphore;
use zeroize::Zeroize;

use crate::crypto;
use crate::file_ops;
use crate::kdf;
use crate::keygen;

// ─── Result types ────────────────────────────────────────────────────────────

#[derive(Serialize, Debug)]
pub struct EncryptResult {
    pub output_path: String,
    pub bytes_written: usize,
}

#[derive(Serialize, Debug)]
pub struct DecryptResult {
    pub output_path: String,
    pub bytes_written: usize,
    /// File format version (1, 2, or 3). V1/V2 headers are not authenticated.
    pub file_version: u8,
}

// ─── File Header ─────────────────────────────────────────────────────────────
// Encrypted file layout:
//   [4 bytes magic] [32 bytes Argon2 salt] [ciphertext (including 20-byte nonce)]
// Magic: b"NXCR" (NexusCrypt)

const MAGIC_V1: &[u8; 4] = b"NXCR";
const MAGIC_V2: &[u8; 4] = b"NXC2";
const MAGIC_V3: &[u8; 4] = b"NXC3"; // V3: header authenticated via AEAD AAD

/// Maximum counter for create_unique_output retry loop
const MAX_UNIQUE_COUNTER: i32 = 9999;

/// Valid range for Argon2 memory parameter (in KiB)
const ARGON2_MEM_MIN_KIB: u32 = 8_192;     // 8 MB minimum
const ARGON2_MEM_MAX_KIB: u32 = 4_194_304; // 4 GB maximum

/// Maximum supported input file size (128 GiB).
/// Prevents OOM / infinite-read DoS attacks via oversized or synthetic files.
const MAX_INPUT_FILE_SIZE: u64 = 137_438_953_472; // 128 GiB

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Atomically reserves a unique output path using `create_new` (TOCTOU-safe).
/// Returns `(final_path, placeholder_file)` where the placeholder is an empty
/// 0-byte file that holds the path until the caller renames a temp file over it.
/// No other process can claim the same path between the check and the rename.
fn create_unique_output(base: PathBuf) -> Result<(PathBuf, std::fs::File)> {
    // Derive dir, stem and ext from an owned copy so base remains usable
    let dir = base.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    let file_name = base.file_name().unwrap_or_default().to_string_lossy().into_owned();

    // Split on the first dot to keep compound extensions (e.g., ".pdf.nxenc")
    let (stem, ext) = match file_name.find('.') {
        Some(idx) => {
            let (s, e) = file_name.split_at(idx);
            (s.to_string(), e.to_string())
        }
        None => (file_name, String::new()),
    };

    for counter in 0..=MAX_UNIQUE_COUNTER {
        let candidate = if counter == 0 {
            base.clone()
        } else {
            dir.join(format!("{} ({}){}", stem, counter, ext))
        };

        match OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(f) => {
                // M1 — restrict permissions on placeholder immediately
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let perms = std::fs::Permissions::from_mode(0o600);
                    std::fs::set_permissions(&candidate, perms).ok();
                }
                return Ok((candidate, f));
            }
            Err(e) if e.kind() == ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(anyhow::anyhow!("Failed to reserve output path: {e}")),
        }
    }

    Err(anyhow::anyhow!(
        "Could not find a unique output path after {} attempts",
        MAX_UNIQUE_COUNTER
    ))
}

// ─── Input Validation ────────────────────────────────────────────────────────

/// SEC-03 / SEC-04 – Validate the caller-supplied paths before any I/O.
///
/// Checks enforced:
///  1. `input_path` must be absolute (prevents relative-path confusion).
///  2. `input_path` must resolve to a regular file (no symlinks to /dev/zero,
///     directories, or devices).
///  3. `key_file_path` is optional — if empty, authentication is password-only.
///     If non-empty, the path must be absolute and point to a regular file.
fn validate_inputs(input_path: &PathBuf, key_file_path: &str) -> Result<()> {
    // SEC-03 – Absolute path check for the input file
    if !input_path.is_absolute() {
        return Err(anyhow::anyhow!(
            "Input path must be absolute (got a relative path). \
             Possible path-traversal attempt rejected."
        ));
    }
    // SEC-03 – Must be a regular file (catches /dev/zero, symlinks to devices, dirs)
    if !input_path.is_file() {
        return Err(anyhow::anyhow!("Input path does not point to a regular file"));
    }

    // Key file path is now optional — skip validation if empty
    if !key_file_path.is_empty() {
        let kf_path = PathBuf::from(key_file_path);
        // SEC-03 – Absolute path check for the key file
        if !kf_path.is_absolute() {
            return Err(anyhow::anyhow!(
                "Key file path must be absolute (got a relative path). \
                 Possible path-traversal attempt rejected."
            ));
        }
        // SEC-03 – Must be a regular file
        if !kf_path.is_file() {
            return Err(anyhow::anyhow!(
                "Key file path does not point to a regular file"
            ));
        }
    }

    Ok(())
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Encrypt a file.
/// Output is written to `<input>.nxenc` in the same directory.
#[tauri::command]
pub async fn encrypt_file(
    app: AppHandle,
    path: String,
    password: String,
    key_file_path: String,
    argon2_mem_kib: u32,
    kdf_lock: tauri::State<'_, Arc<Semaphore>>,
) -> Result<EncryptResult, String> {
    // Limit concurrent KDF operations — Argon2id allocates 64–256 MB each.
    let _permit = kdf_lock.acquire().await.map_err(|e| e.to_string())?;

    // Offload ALL blocking work (KDF + crypto + file I/O) to a dedicated OS
    // thread so the tokio executor thread is never stalled. Running Argon2id
    // (256 MB RAM) or the encryption loop synchronously on an async thread
    // prevents Tauri's event loop from delivering progress events to the UI,
    // causing the progress bar to freeze at 20%.
    tauri::async_runtime::spawn_blocking(move || {
        encrypt_blocking(app, path, password, key_file_path, argon2_mem_kib)
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
    .map_err(|e| e.to_string())
}

fn encrypt_blocking(
    app: AppHandle,
    path: String,
    mut password: String,
    key_file_path: String,
    mem_kib: u32,
) -> Result<EncryptResult> {
    // M2 — Validate Argon2 memory parameter
    if !(ARGON2_MEM_MIN_KIB..=ARGON2_MEM_MAX_KIB).contains(&mem_kib) {
        return Err(anyhow::anyhow!(
            "Invalid Argon2 memory parameter: {}. Must be between {} and {} KiB",
            mem_kib, ARGON2_MEM_MIN_KIB, ARGON2_MEM_MAX_KIB
        ));
    }
    let input_path = PathBuf::from(&path);

    // SEC-03 / SEC-04 – Validate paths before any I/O
    // Key file is optional — empty string means password-only authentication
    validate_inputs(&input_path, &key_file_path)?;

    // SEC-02 – Reject files exceeding the maximum supported size to prevent OOM.
    let input_file_size = input_path
        .metadata()
        .map_err(|e| anyhow::anyhow!("Cannot read input file metadata: {e}"))?
        .len();
    if input_file_size > MAX_INPUT_FILE_SIZE {
        return Err(anyhow::anyhow!(
            "Input file is too large ({} bytes). Maximum supported size is 128 GiB.",
            input_file_size
        ));
    }

    // Read key file only if provided — otherwise use empty bytes (password-only auth)
    let progress_label = if key_file_path.is_empty() { "Deriving key…" } else { "Loading key file…" };
    file_ops::emit_progress(&app, "encrypt_progress", 0.0, progress_label);
    let mut key_file_bytes = if key_file_path.is_empty() {
        Vec::new()
    } else {
        std::fs::read(&key_file_path)
            .map_err(|e| anyhow::anyhow!("Failed to read key file: {e}"))?
    };

    // Generate random salt
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);

    // Derive key (Argon2id – heavy blocking, runs safely on this OS thread)
    file_ops::emit_progress(&app, "encrypt_progress", 0.1, "Deriving key (Argon2id)…");
    let derived = kdf::derive_key(&password, &key_file_bytes, &salt, mem_kib)?;

    // Zeroize plaintext secrets
    password.zeroize();
    key_file_bytes.zeroize();

    // Append ".nxenc" to the full filename.
    // Do NOT use with_extension – it replaces the last extension, e.g.
    // "report.pdf" → "report.nxenc" instead of "report.pdf.nxenc".
    let file_name = input_path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("Cannot determine filename of input"))?;
    let mut enc_name = file_name.to_os_string();
    enc_name.push(".nxenc");
    let output_path_base = input_path.with_file_name(&enc_name);

    // Atomically reserve a unique output path — eliminates TOCTOU race
    // Atomically reserve output path; placeholder file prevents TOCTOU races
    let (output_path, _placeholder) = create_unique_output(output_path_base)?;

    let mut tmp_name = output_path
        .file_name()
        .unwrap()
        .to_os_string();
    tmp_name.push(".nxtmp");
    let temp_path = input_path.with_file_name(&tmp_name);

    let mut input_file = std::fs::File::open(&input_path)
        .map_err(|e| anyhow::anyhow!("Failed to open input file: {e}"))?;
    let mut temp_file = std::fs::File::create(&temp_path)
        .map_err(|e| anyhow::anyhow!("Failed to create temp output file: {e}"))?;

    // M1 — Set restrictive permissions on temp file (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&temp_path, perms).ok();
    }

    // Write V3 header: magic || mem_kib || salt
    // V3 authenticates this header via AEAD AAD (tamper-evident)
    temp_file.write_all(MAGIC_V3)?;
    temp_file.write_all(&mem_kib.to_le_bytes())?;
    temp_file.write_all(&salt)?;

    // Build AAD = header bytes (bound into the final AEAD auth tag)
    let mut aad = Vec::with_capacity(40);
    aad.extend_from_slice(MAGIC_V3);
    aad.extend_from_slice(&mem_kib.to_le_bytes());
    aad.extend_from_slice(&salt);

    file_ops::emit_progress(&app, "encrypt_progress", 0.2, "Encrypting…");

    // Reuse pre-validated file size instead of another metadata syscall
    let file_size = input_file_size.max(1) as f64;
    let mut encrypted_bytes_tracker = 0f64;

    let bytes_written = crypto::encrypt_stream(
        &derived.0,
        &mut input_file,
        &mut temp_file,
        &aad,
        |bytes_processed| {
            encrypted_bytes_tracker += bytes_processed as f64;
            let progress = 0.2 + (0.7 * (encrypted_bytes_tracker / file_size).min(1.0));
            file_ops::emit_progress(&app, "encrypt_progress", progress, "Encrypting…");
        },
    )
    .map_err(|e| {
        // Cleanup: remove both temp file and output placeholder on failure
        std::fs::remove_file(&temp_path).ok();
        std::fs::remove_file(&output_path).ok();
        e
    })?;

    // C3 — Explicitly drop derived key to minimize exposure window
    drop(derived);
    // Zeroize salt — no longer needed
    salt.zeroize();

    file_ops::emit_progress(&app, "encrypt_progress", 0.95, "Finalizing file…");

    // Sync temp file to disk before renaming
    // C4 — Propagate sync error instead of silently ignoring
    temp_file.sync_all()
        .map_err(|e| anyhow::anyhow!("Failed to sync encrypted file to disk: {e}"))?;

    // Atomic rename
    std::fs::rename(&temp_path, &output_path).map_err(|e| {
        std::fs::remove_file(&temp_path).ok();
        anyhow::anyhow!("Failed to save encrypted file: {e}")
    })?;

    file_ops::emit_progress(&app, "encrypt_progress", 1.0, "Done");

    Ok(EncryptResult {
        output_path: output_path.to_string_lossy().to_string(),
        bytes_written: bytes_written + 4 + 4 + 32, // stream bytes + MAGIC_V3 + mem_kib + salt
    })
}

/// Decrypt a `.nxenc` file.
/// Output is written to the original filename (without `.nxenc` extension).
#[tauri::command]
pub async fn decrypt_file(
    app: AppHandle,
    path: String,
    password: String,
    key_file_path: String,
    kdf_lock: tauri::State<'_, Arc<Semaphore>>,
) -> Result<DecryptResult, String> {
    // Limit concurrent KDF operations — Argon2id allocates 64–256 MB each.
    let _permit = kdf_lock.acquire().await.map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        decrypt_blocking(app, path, password, key_file_path)
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
    .map_err(|e| e.to_string())
}

fn decrypt_blocking(
    app: AppHandle,
    path: String,
    mut password: String,
    key_file_path: String,
) -> Result<DecryptResult> {
    let input_path = PathBuf::from(&path);

    // SEC-03 / SEC-04 – Validate paths before any I/O
    validate_inputs(&input_path, &key_file_path)?;

    // SEC-02 – Reject files exceeding the maximum supported size to prevent OOM.
    let input_file_size = input_path
        .metadata()
        .map_err(|e| anyhow::anyhow!("Cannot read input file metadata: {e}"))?
        .len();
    if input_file_size > MAX_INPUT_FILE_SIZE {
        return Err(anyhow::anyhow!(
            "Encrypted file is too large ({} bytes). Maximum supported size is 128 GiB.",
            input_file_size
        ));
    }

    file_ops::emit_progress(&app, "decrypt_progress", 0.0, "Reading file…");
    let mut input_file = std::fs::File::open(&input_path)
        .map_err(|e| anyhow::anyhow!("Failed to open encrypted file: {e}"))?;

    let mut magic = [0u8; 4];
    input_file
        .read_exact(&mut magic)
        .map_err(|_| anyhow::anyhow!("File too short to be a valid NexusCrypt file"))?;
    // V1: no mem_kib field, use default. V2/V3: read 4-byte mem_kib field.
    let mem_kib: u32;
    let file_version: u8;
    if &magic == MAGIC_V1 {
        file_version = 1;
        mem_kib = kdf::ARGON2_DEFAULT_MEM_KIB;
    } else if &magic == MAGIC_V2 || &magic == MAGIC_V3 {
        let mut mem_buf = [0u8; 4];
        input_file
            .read_exact(&mut mem_buf)
            .map_err(|_| anyhow::anyhow!("Corrupted memory profile block"))?;
        mem_kib = u32::from_le_bytes(mem_buf);
        file_version = if &magic == MAGIC_V3 { 3 } else { 2 };
        // SEC-01 – Validate mem_kib from the untrusted file header.
        // An attacker-crafted file with mem_kib = u32::MAX would cause Argon2id
        // to attempt a ~4 TB allocation, crashing the process.
        if !(ARGON2_MEM_MIN_KIB..=ARGON2_MEM_MAX_KIB).contains(&mem_kib) {
            return Err(anyhow::anyhow!(
                "Invalid Argon2 memory parameter in file header: {} KiB. \
                 File may be corrupted or tampered.",
                mem_kib
            ));
        }
    } else {
        return Err(anyhow::anyhow!(
            "Not a valid NexusCrypt file (wrong magic bytes)"
        ));
    }

    let mut salt = [0u8; 32];
    input_file
        .read_exact(&mut salt)
        .map_err(|_| anyhow::anyhow!("Corrupted salt block"))?;

    // Build AAD: V3 files authenticate the header; V1/V2 pass empty (backward compat)
    let aad: Vec<u8> = if &magic == MAGIC_V3 {
        let mut v = Vec::with_capacity(40);
        v.extend_from_slice(&magic);
        v.extend_from_slice(&mem_kib.to_le_bytes());
        v.extend_from_slice(&salt);
        v
    } else {
        Vec::new()
    };

    // Read key file only if provided — otherwise use empty bytes (password-only auth)
    let progress_label = if key_file_path.is_empty() { "Deriving key…" } else { "Loading key file…" };
    file_ops::emit_progress(&app, "decrypt_progress", 0.1, progress_label);
    let mut key_file_bytes = if key_file_path.is_empty() {
        Vec::new()
    } else {
        std::fs::read(&key_file_path)
            .map_err(|e| anyhow::anyhow!("Failed to read key file: {e}"))?
    };

    // Derive key (heavy blocking – runs safely on this OS thread)
    file_ops::emit_progress(&app, "decrypt_progress", 0.2, "Deriving key (Argon2id)…");
    let derived = kdf::derive_key(&password, &key_file_bytes, &salt, mem_kib)?;

    // Zeroize plaintext secrets
    password.zeroize();
    key_file_bytes.zeroize();

    // Determine output path: strip the last extension (".nxenc").
    // file_stem() strips only the LAST extension, so:
    //   "report.pdf.nxenc" → "report.pdf"  ✓
    //   "report.nxenc"     → "report"       ✓
    let output_path = if let Some(stem) = input_path.file_stem() {
        input_path.with_file_name(stem)
    } else {
        input_path.with_extension("decrypted")
    };

    // Atomically reserve a unique output path — eliminates TOCTOU race
    let (output_path, _placeholder) = create_unique_output(output_path)?;

    // Build temp path by appending ".nxtmp" to the recovered filename so the
    // real extension (e.g. ".pdf") is never stripped by with_extension.
    let out_name = output_path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("Cannot determine output filename"))?;
    let mut tmp_name = out_name.to_os_string();
    tmp_name.push(".nxtmp");
    let temp_path = output_path.with_file_name(&tmp_name);

    let mut temp_file = std::fs::File::create(&temp_path)
        .map_err(|e| anyhow::anyhow!("Failed to create temp output file: {e}"))?;

    // M1 — Set restrictive permissions on temp file (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&temp_path, perms).ok();
    }

    file_ops::emit_progress(&app, "decrypt_progress", 0.3, "Decrypting…");

    // H6 — Use ciphertext size (minus header) for progress calculation, not total file size
    let total_file_size = input_path.metadata().map(|m| m.len()).unwrap_or(1);
    let header_size: u64 = if magic == *MAGIC_V1 { 4 + 32 } else { 4 + 4 + 32 }; // V2/V3 have mem_kib field
    let ciphertext_size = total_file_size.saturating_sub(header_size).max(1) as f64;
    let mut decrypted_bytes_tracker = 0f64;

    let bytes_written = crypto::decrypt_stream(
        &derived.0,
        &mut input_file,
        &mut temp_file,
        &aad,
        |bytes_processed| {
            decrypted_bytes_tracker += bytes_processed as f64;
            let progress = 0.3 + (0.6 * (decrypted_bytes_tracker / ciphertext_size).min(1.0));
            file_ops::emit_progress(&app, "decrypt_progress", progress, "Decrypting…");
        },
    )
    .map_err(|e| {
        // Cleanup: remove both temp file and output placeholder on auth failure
        // (e.g. wrong password/key). The placeholder was created atomically
        // by create_unique_output and must be cleaned up on error.
        std::fs::remove_file(&temp_path).ok();
        std::fs::remove_file(&output_path).ok();
        e
    })?;

    // C3 — Explicitly drop derived key to minimize exposure window
    drop(derived);
    // Zeroize salt — no longer needed
    salt.zeroize();

    file_ops::emit_progress(&app, "decrypt_progress", 0.95, "Finalizing file…");

    // C4 — Propagate sync error instead of silently ignoring
    temp_file.sync_all()
        .map_err(|e| anyhow::anyhow!("Failed to sync decrypted file to disk: {e}"))?;

    std::fs::rename(&temp_path, &output_path).map_err(|e| {
        std::fs::remove_file(&temp_path).ok();
        anyhow::anyhow!("Failed to save decrypted file: {e}")
    })?;

    file_ops::emit_progress(&app, "decrypt_progress", 1.0, "Done");

    Ok(DecryptResult {
        output_path: output_path.to_string_lossy().to_string(),
        bytes_written,
        file_version,
    })
}

/// Generate a new .nxkey file at the given path using OS entropy.
#[tauri::command]
pub async fn generate_key_file(output_path: String, user_entropy: Option<Vec<u8>>) -> Result<(), String> {
    let p = PathBuf::from(&output_path);
    if !p.is_absolute() {
        return Err("Output path must be absolute".into());
    }
    keygen::generate_key_file(&output_path, user_entropy).map_err(|e| e.to_string())
}

/// Get the size of a file in bytes (for UI display).
#[tauri::command]
pub async fn get_file_size(path: String) -> Result<u64, String> {
    let p = PathBuf::from(&path);
    if !p.is_absolute() {
        return Err("Path must be absolute".into());
    }
    if !p.is_file() {
        return Err("Path does not point to a regular file".into());
    }
    std::fs::metadata(&p)
        .map(|m| m.len())
        .map_err(|e| e.to_string())
}
