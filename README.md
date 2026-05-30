# NexusCrypt

**Military-grade file encryption — simple, secure, and fully offline.**

NexusCrypt is a desktop application that protects your files using authenticated encryption (XChaCha20-Poly1305) and brute-force-resistant key derivation (Argon2id + BLAKE3). It operates entirely offline: no data ever leaves your computer.

---

## Features

- File encryption and decryption with password and optional `.nxkey` key file.
- 512-bit key file generator.
- Two-factor protection (password + key file).
- Streaming encryption for files of any size.
- Tamper detection through authenticated headers (V3).
- Write-after-auth decryption.
- Memory zeroization of sensitive material.
- English and Italian interface.
- Fully offline operation.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Tauri v2 |
| Frontend | React 19 + TypeScript + Tailwind CSS 3 |
| Cryptographic Backend | Rust |
| Encryption | XChaCha20-Poly1305 (AEAD) |
| Key Derivation | Argon2id |
| Hashing | BLAKE3 |
| Entropy Source | OsRng |

---

## Encryption Process

1. Validate input paths and files.
2. Generate a 32-byte cryptographic salt.
3. Derive a key using BLAKE3 + Argon2id.
4. Encrypt data in 64 KB chunks using XChaCha20-Poly1305 streaming mode.
5. Atomically write the encrypted output to disk.

### V3 File Format

```text
[NXC3][mem_kib][salt][nonce][ciphertext + Poly1305 tags]
```

The header is authenticated using AEAD Additional Authenticated Data (AAD).

---

## Decryption Process

1. Validate and parse the file header.
2. Re-derive the encryption key.
3. Verify Poly1305 authentication.
4. Write plaintext to disk only after successful authentication.

If authentication fails, no plaintext is written.

---

## Key Generator

- Generates 64-byte (512-bit) key files.
- Uses OS entropy via OsRng.
- Can mix additional user entropy.
- Stores files with restricted permissions.
- Uses atomic writes.

---

## Security Profiles

| Profile | Memory |
|---|---|
| Low | 64 MB |
| Standard | 128 MB |
| Paranoid (Default) | 256 MB |

---

## System Requirements

- macOS 10.15+
- Windows 10+ (64-bit)
- Linux (glibc 2.31+)
- Node.js 18+
- Rust 1.70+

---

## Usage

### Encrypting Files

1. Open **Encrypt**.
2. Select or drag files.
3. Enter a strong password.
4. Optionally select a `.nxkey` file.
5. Click **Encrypt Files**.

### Decrypting Files

1. Open **Decrypt**.
2. Select encrypted `.nxenc` files.
3. Enter the correct password.
4. Select the same `.nxkey` file if used.
5. Click **Decrypt Files**.

### Generating a Key File

1. Open **Key Generator**.
2. Move the mouse to provide entropy.
3. Click **Generate Key File**.
4. Store the generated key file securely.

**Warning:** If the key file is lost, encrypted files protected with it cannot be recovered.

---

## License

NexusCrypt is an open-source project. All rights reserved.
