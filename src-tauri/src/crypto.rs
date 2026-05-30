// crypto.rs – XChaCha20-Poly1305 AEAD streaming encryption/decryption
// Uses a unique 20-byte random nonce per stream operation.
// Nonce size = XChaCha20Poly1305::NonceSize(24) − EncryptorLE31 overhead(4) = 20 bytes.

use anyhow::{anyhow, Result};
use chacha20poly1305::{
    aead::{
        stream::{DecryptorLE31, EncryptorLE31},
        KeyInit, OsRng, Payload,
    },
    XChaCha20Poly1305,
};
use rand::RngCore;
use std::io::{Read, Write};
use zeroize::Zeroize;

// EncryptorLE31<XChaCha20Poly1305>: nonce = 24 (XChaCha20) - 4 (LE31 counter) = 20 bytes.
pub const NONCE_SIZE: usize = 20;
pub const CHUNK_SIZE: usize = 65_536;

/// Stream encrypts `source` to `dest` with a 32-byte `key`.
/// `aad` is passed as Additional Authenticated Data to the final AEAD chunk,
/// authenticating both the ciphertext and the caller-supplied header bytes.
/// Returns: `nonce (20 bytes) || ciphertext_chunks` written to `dest`.
pub fn encrypt_stream<R: Read, W: Write>(
    key: &[u8; 32],
    mut source: R,
    mut dest: W,
    aad: &[u8],
    mut on_progress: impl FnMut(usize),
) -> Result<usize> {
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);

    let aead =
        XChaCha20Poly1305::new_from_slice(key).map_err(|e| anyhow!("Cipher init failed: {e}"))?;

    let stream_nonce =
        chacha20poly1305::aead::generic_array::GenericArray::from_slice(&nonce_bytes);
    let mut encryptor = EncryptorLE31::from_aead(aead, stream_nonce);

    // Write nonce first
    dest.write_all(&nonce_bytes)
        .map_err(|e| anyhow!("Failed to write nonce: {e}"))?;
    let mut total_written = NONCE_SIZE;

    // Zeroize nonce from stack – written to dest and absorbed into encryptor, no longer needed
    nonce_bytes.zeroize();

    let mut buffer = [0u8; CHUNK_SIZE];
    loop {
        let mut bytes_read = 0;
        // Ensure we read a full chunk or reach EOF
        while bytes_read < CHUNK_SIZE {
            let count = source
                .read(&mut buffer[bytes_read..])
                .map_err(|e| anyhow!("Read error: {e}"))?;
            if count == 0 {
                break; // EOF
            }
            bytes_read += count;
        }

        if bytes_read < CHUNK_SIZE {
            // Last chunk — include header bytes as AAD so the AEAD tag authenticates them
            let ciphertext = encryptor
                .encrypt_last(Payload {
                    msg: &buffer[..bytes_read],
                    aad,
                })
                .map_err(|e| anyhow!("Stream finalization failed: {e}"))?;

            dest.write_all(&ciphertext)
                .map_err(|e| anyhow!("Write error: {e}"))?;
            total_written += ciphertext.len();
            on_progress(bytes_read);
            break;
        } else {
            // Full chunk
            let ciphertext = encryptor
                .encrypt_next(&buffer[..bytes_read])
                .map_err(|e| anyhow!("Stream encryption failed: {e}"))?;

            dest.write_all(&ciphertext)
                .map_err(|e| anyhow!("Write error: {e}"))?;
            total_written += ciphertext.len();
            on_progress(bytes_read);
        }
    }

    buffer.zeroize();

    Ok(total_written)
}

/// Stream decrypts `source` to `dest` with a 32-byte `key`.
/// `aad` must match the value used during encryption; mismatch causes auth failure.
/// Expects: `nonce (20 bytes) || ciphertext_chunks` from `source`.
///
/// # Security: write-after-auth guarantee
/// All plaintext chunks are buffered in RAM until `decrypt_last` succeeds.
/// Only then is the full plaintext flushed to `dest` in a single write.
/// This ensures that if authentication of the final chunk fails (truncation,
/// tampering) **no plaintext is written to disk at all**, preventing data
/// remanence from partially-written decrypted files.
pub fn decrypt_stream<R: Read, W: Write>(
    key: &[u8; 32],
    mut source: R,
    mut dest: W,
    aad: &[u8],
    mut on_progress: impl FnMut(usize),
) -> Result<usize> {
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    source
        .read_exact(&mut nonce_bytes)
        .map_err(|_| anyhow!("Ciphertext too short – possibly corrupted"))?;

    let aead =
        XChaCha20Poly1305::new_from_slice(key).map_err(|e| anyhow!("Cipher init failed: {e}"))?;

    let stream_nonce =
        chacha20poly1305::aead::generic_array::GenericArray::from_slice(&nonce_bytes);
    let mut decryptor = DecryptorLE31::from_aead(aead, stream_nonce);

    // Zeroize nonce from stack – absorbed into decryptor, no longer needed
    nonce_bytes.zeroize();

    let chunk_len = CHUNK_SIZE + 16;
    let mut buffer = vec![0u8; chunk_len];

    // SEC-NEW: Accumulate ALL plaintext in RAM; flush to dest only after
    // decrypt_last succeeds.  This prevents any plaintext from being written
    // to disk if the stream is truncated or its final auth tag is invalid.
    let mut plaintext_buf: Vec<u8> = Vec::new();

    loop {
        let mut bytes_read = 0;
        // Ensure we read a full chunk (CHUNK_SIZE + 16) or reach EOF
        while bytes_read < chunk_len {
            let count = source
                .read(&mut buffer[bytes_read..])
                .map_err(|e| anyhow!("Read error: {e}"))?;
            if count == 0 {
                break; // EOF
            }
            bytes_read += count;
        }

        if bytes_read == 0 {
            // If bytes_read == 0, we shouldn't reach here normally unless the last block was completely empty, which is handled in bytes_read < chunk_len.
            // But wait, what if the ciphertext ends EXACTLY on a chunk boundary? That means the file is truncated because encrypt_last would have added a < chunk_len block.
            buffer.zeroize();
            plaintext_buf.zeroize();
            return Err(anyhow!(
                "File corrupted or download interrupted (missing final block)."
            ));
        }

        if bytes_read < chunk_len {
            // Last block — must match AAD used during encryption
            let plaintext = decryptor
                .decrypt_last(Payload { msg: &buffer[..bytes_read], aad })
                .map_err(|_| {
                    // Zeroize any buffered plaintext before returning the error
                    plaintext_buf.zeroize();
                    anyhow!("Decryption failed: wrong password / key-file, corrupted data, or tampered header")
                })?;

            // Stream fully authenticated — now safe to accumulate and flush
            plaintext_buf.extend_from_slice(&plaintext);
            on_progress(plaintext.len());
            buffer.zeroize();
            break;
        } else {
            // Full chunk
            let plaintext = decryptor.decrypt_next(&buffer[..bytes_read]).map_err(|_| {
                plaintext_buf.zeroize();
                anyhow!("Decryption failed: wrong password / key-file or corrupted data")
            })?;

            // Accumulate in RAM; do NOT write to dest yet
            plaintext_buf.extend_from_slice(&plaintext);
            on_progress(plaintext.len());
        }
    }

    // Write-after-auth: flush the entire plaintext to dest in one operation
    let total_written = plaintext_buf.len();
    dest.write_all(&plaintext_buf)
        .map_err(|e| anyhow!("Write error: {e}"))?;

    // Zeroize plaintext from RAM before returning
    plaintext_buf.zeroize();

    Ok(total_written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn make_key() -> [u8; 32] {
        let mut k = [0u8; 32];
        k[0] = 0xDE;
        k[31] = 0xAD;
        k
    }

    /// Encrypt then decrypt – plaintext must survive the round-trip.
    fn round_trip(plaintext: &[u8]) {
        let key = make_key();
        let mut ciphertext = Vec::new();

        // Encrypt (empty AAD for unit tests — format-agnostic)
        let enc_written =
            encrypt_stream(&key, Cursor::new(plaintext), &mut ciphertext, b"", |_| {}).unwrap();
        assert_eq!(
            enc_written,
            ciphertext.len(),
            "enc_written must equal ciphertext length"
        );
        // Ciphertext must be different from plaintext (basic sanity)
        assert_ne!(
            &ciphertext, plaintext,
            "ciphertext must differ from plaintext"
        );

        // Decrypt
        let mut recovered = Vec::new();
        let dec_written =
            decrypt_stream(&key, Cursor::new(&ciphertext), &mut recovered, b"", |_| {}).unwrap();
        assert_eq!(dec_written, recovered.len());
        assert_eq!(
            recovered, plaintext,
            "decrypted output must equal original plaintext"
        );
    }

    #[test]
    fn round_trip_empty() {
        round_trip(b"");
    }

    #[test]
    fn round_trip_small() {
        round_trip(b"Hello, NexusCrypt!");
    }

    #[test]
    fn round_trip_exact_chunk() {
        // Exactly one full chunk (65536 bytes)
        round_trip(&vec![0xABu8; CHUNK_SIZE]);
    }

    #[test]
    fn round_trip_multi_chunk() {
        // 2.5 chunks to exercise both encrypt_next and encrypt_last paths
        round_trip(&vec![0x42u8; CHUNK_SIZE * 2 + 1000]);
    }

    #[test]
    fn wrong_key_fails() {
        let key = make_key();
        let plaintext = b"secret data";
        let mut ciphertext = Vec::new();
        encrypt_stream(&key, Cursor::new(plaintext), &mut ciphertext, b"", |_| {}).unwrap();

        let mut bad_key = make_key();
        bad_key[0] ^= 0xFF; // flip one byte
        let mut out = Vec::new();
        let result = decrypt_stream(&bad_key, Cursor::new(&ciphertext), &mut out, b"", |_| {});
        assert!(result.is_err(), "decrypting with wrong key must fail");
    }

    #[test]
    fn tampered_aad_fails() {
        // Encrypt with real header bytes as AAD
        let key = make_key();
        let plaintext = b"authenticated payload";
        let aad_enc = b"NXC3\x00\x00\x04\x00" as &[u8]; // fake header
        let mut ciphertext = Vec::new();
        encrypt_stream(
            &key,
            Cursor::new(plaintext),
            &mut ciphertext,
            aad_enc,
            |_| {},
        )
        .unwrap();

        // Decryption with wrong AAD (simulating header tampering) must fail
        let aad_tampered = b"NXC3\xFF\xFF\xFF\xFF" as &[u8];
        let mut out = Vec::new();
        let result = decrypt_stream(
            &key,
            Cursor::new(&ciphertext),
            &mut out,
            aad_tampered,
            |_| {},
        );
        assert!(result.is_err(), "tampered AAD must cause auth failure");

        // Decryption with correct AAD must succeed
        out.clear();
        decrypt_stream(&key, Cursor::new(&ciphertext), &mut out, aad_enc, |_| {}).unwrap();
        assert_eq!(out, plaintext);
    }
}
