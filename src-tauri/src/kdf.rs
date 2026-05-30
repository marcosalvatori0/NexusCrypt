// kdf.rs – Dual-Key Derivation: BLAKE3 combination → Argon2id
// Zero-knowledge: all intermediate secrets are zeroized on drop.

use anyhow::{anyhow, Result};
use argon2::{Algorithm, Argon2, Params, Version};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Argon2id parameters – configurable memory
/// Default Memory: 256 MB, Iterations: 3, Parallelism: 4
pub const ARGON2_DEFAULT_MEM_KIB: u32 = 262_144; // 256 MB
pub const ARGON2_ITERS: u32 = 3;
pub const ARGON2_LANES: u32 = 4;
pub const ARGON2_OUTPUT_LEN: usize = 32;

/// All key material zeroed automatically when dropped
#[derive(ZeroizeOnDrop)]
pub struct DerivedKey(pub [u8; 32]);

/// Derive a 32-byte key from:
///   - `password`     : master password (UTF-8)
///   - `key_file`     : raw bytes of the .nxkey file
///   - `salt`         : 32-byte random salt (stored alongside ciphertext)
///
/// Process:
///   1. BLAKE3(len(pw) || pw || len(kf) || kf) → 32-byte pre-key
///   2. Argon2id(pre-key, salt)                → 32-byte final key
///
/// # SEC-07 – Input encoding is injective
/// Each field is prefixed with its 4-byte little-endian length so that
/// different (password, key_file) splits can never produce the same hash.
/// E.g. ("ab", "c") → 02 00 00 00 'a' 'b' 01 00 00 00 'c'
///      ("a", "bc") → 01 00 00 00 'a' 02 00 00 00 'b' 'c'
pub fn derive_key(
    password: &str,
    key_file: &[u8],
    salt: &[u8; 32],
    mem_kib: u32,
) -> Result<DerivedKey> {
    // Step 1 – Combine secrets via BLAKE3 with unambiguous length-prefixed encoding
    let pw_bytes = password.as_bytes();
    let mut hasher = blake3::Hasher::new();
    // Length-prefix password field (4-byte LE)
    hasher.update(&(pw_bytes.len() as u32).to_le_bytes());
    hasher.update(pw_bytes);
    // Length-prefix key_file field (4-byte LE)
    hasher.update(&(key_file.len() as u32).to_le_bytes());
    hasher.update(key_file);
    let pre_key_hash = hasher.finalize();
    let mut pre_key = *pre_key_hash.as_bytes(); // 32 bytes

    // Step 2 – Argon2id stretch
    let params = Params::new(mem_kib, ARGON2_ITERS, ARGON2_LANES, Some(ARGON2_OUTPUT_LEN))
        .map_err(|e| anyhow!("Argon2 params error: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut output = [0u8; ARGON2_OUTPUT_LEN];
    argon2
        .hash_password_into(&pre_key, salt, &mut output)
        .map_err(|e| anyhow!("Argon2id hashing failed: {e}"))?;

    // Zeroize intermediates
    pre_key.zeroize();

    Ok(DerivedKey(output))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_output() {
        let salt = [0xABu8; 32];
        let k1 = derive_key("password", b"keyfile", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        let k2 = derive_key("password", b"keyfile", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        assert_eq!(k1.0, k2.0);
    }

    #[test]
    fn different_password_different_key() {
        let salt = [0x01u8; 32];
        let k1 = derive_key("password1", b"keyfile", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        let k2 = derive_key("password2", b"keyfile", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        assert_ne!(k1.0, k2.0);
    }

    #[test]
    fn different_keyfile_different_key() {
        let salt = [0x02u8; 32];
        let k1 = derive_key("password", b"keyfile_a", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        let k2 = derive_key("password", b"keyfile_b", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        assert_ne!(k1.0, k2.0);
    }

    /// SEC-07 regression: different (password, key_file) splits must NEVER produce
    /// the same pre-key, even if their raw concatenation looks identical.
    /// Old code: BLAKE3("ab" || \x00 || "c") == BLAKE3("ab\x00c") which could
    /// accidentally equal BLAKE3("a" || \x00 || "bc") if password contained null.
    /// New code: length-prefix encoding makes every split unique.
    #[test]
    fn no_ambiguity_different_splits() {
        let salt = [0x03u8; 32];
        // Same raw bytes "abc" but split differently
        let k1 = derive_key("ab", b"c", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        let k2 = derive_key("a", b"bc", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        assert_ne!(
            k1.0, k2.0,
            "different (pw, kf) splits must yield different keys"
        );

        // Null-byte boundary: password ending in \x00
        let k3 = derive_key("a\x00", b"b", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        let k4 = derive_key("a", b"\x00b", &salt, ARGON2_DEFAULT_MEM_KIB).unwrap();
        assert_ne!(
            k3.0, k4.0,
            "null-byte boundary split must yield different keys"
        );
    }
}
