// keygen.rs – .nxkey file generator using OS entropy

use anyhow::{Context, Result};
use rand::rngs::OsRng;
use rand::RngCore;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use zeroize::Zeroize;

/// Number of entropy bytes in a generated key file (512 bits)
pub const KEY_FILE_SIZE: usize = 64;
/// Maximum accepted user-entropy bytes (prevents DoS via oversized payload)
const MAX_USER_ENTROPY: usize = 4096;

/// Generate a new key file with `KEY_FILE_SIZE` bytes of OS entropy.
/// If `user_entropy` is provided, it is mixed with the OS entropy using BLAKE3 XOF.
/// Written atomically: temp file → rename.
pub fn generate_key_file(output_path: &str, user_entropy: Option<Vec<u8>>) -> Result<()> {
    let path = Path::new(output_path);
    let tmp_path = path.with_extension("nxkey.tmp");

    let mut os_bytes = [0u8; KEY_FILE_SIZE];
    OsRng.fill_bytes(&mut os_bytes);

    let mut final_bytes = os_bytes;
    if let Some(ent) = user_entropy {
        if !ent.is_empty() {
            if ent.len() > MAX_USER_ENTROPY {
                return Err(anyhow::anyhow!(
                    "User entropy too large ({} bytes, max {})",
                    ent.len(),
                    MAX_USER_ENTROPY
                ));
            }
            let mut hasher = blake3::Hasher::new();
            hasher.update(&os_bytes);
            hasher.update(&ent);
            let mut reader = hasher.finalize_xof();
            reader.fill(&mut final_bytes);
        }
    }

    // Zeroize OS entropy immediately – no longer needed
    os_bytes.zeroize();

    // Write to temp file with exclusive create and restrictive permissions (0o600).
    // This prevents both TOCTOU races and world-readable key material exposure.
    let mut tmp_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp_path)
        .with_context(|| format!("Failed to create tmp key file: {}", tmp_path.display()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&tmp_path, perms).ok();
    }

    tmp_file
        .write_all(&final_bytes)
        .with_context(|| format!("Failed to write tmp key file: {}", tmp_path.display()))?;

    // Zeroize final key material from RAM
    final_bytes.zeroize();

    std::fs::rename(&tmp_path, path)
        .with_context(|| format!("Failed to rename tmp key file to: {}", path.display()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_correct_size() {
        let tmp = std::env::temp_dir().join("test.nxkey");
        generate_key_file(tmp.to_str().unwrap(), None).unwrap();
        let bytes = std::fs::read(&tmp).unwrap();
        assert_eq!(bytes.len(), KEY_FILE_SIZE);
        std::fs::remove_file(&tmp).ok();
    }

    #[test]
    fn two_keys_differ() {
        let tmp1 = std::env::temp_dir().join("test1.nxkey");
        let tmp2 = std::env::temp_dir().join("test2.nxkey");
        generate_key_file(tmp1.to_str().unwrap(), None).unwrap();
        generate_key_file(tmp2.to_str().unwrap(), Some(vec![1, 2, 3])).unwrap();
        let b1 = std::fs::read(&tmp1).unwrap();
        let b2 = std::fs::read(&tmp2).unwrap();
        assert_ne!(b1, b2);
        std::fs::remove_file(&tmp1).ok();
        std::fs::remove_file(&tmp2).ok();
    }
}
