*🌍 [Read this document in English](README.md)*

# NexusCrypt

**Crittografia di livello militare per file — semplice, sicura, offline.**

NexusCrypt è un'applicazione desktop che protegge i tuoi file con cifratura autenticata
(XChaCha20-Poly1305) e derivazione della chiave resistente a forza bruta (Argon2id + BLAKE3).
Funziona completamente offline: nessun dato lascia il tuo computer.

---

## Caratteristiche

- **Cifratura e decifratura file** — trascina i file nell'interfaccia, imposta una password e (opzionalmente) un file chiave `.nxkey`.
- **Generatore di chiavi** — crea file `.nxkey` da 512 bit usando l'entropia del sistema operativo, con possibilità di mescolare entropia aggiuntiva tramite mouse.
- **Doppio fattore** — combina password + file chiave per un'autenticazione a due fattori. Il file chiave funge da secondo segreto indipendente.
- **Cifratura a stream** — elabora file di qualsiasi dimensione senza caricarli interamente in memoria.
- **Protezione anti-manomissione** — il formato V3 autentica l'header del file tramite AEAD (AAD). Qualsiasi modifica al file cifrato viene rilevata e il file viene rifiutato.
- **Write-after-auth** — in decifratura, il plaintext viene scritto su disco solo dopo che l'intero stream è stato autenticato con successo. Nessun dato parziale viene mai scritto in caso di password errata.
- **Zeroizzazione della memoria** — tutte le chiavi, password e segreti intermedi vengono azzerati esplicitamente dalla RAM dopo l'uso.
- **Interfaccia multilingua** — italiano e inglese, rilevamento automatico della lingua del browser.
- **Offline-first** — nessuna connessione di rete richiesta.

---

## Architettura tecnica

### Stack

| Livello | Tecnologia |
|---|---|
| Desktop framework | Tauri v2 |
| Frontend | React 19 + TypeScript + Tailwind CSS 3 |
| Backend crittografico | Rust |
| Cifratura | XChaCha20-Poly1305 (AEAD) |
| Derivazione chiave | Argon2id (default 256 MB RAM) |
| Hashing | BLAKE3 |
| Entropia | OsRng (gettrandom su macOS, /dev/urandom su Linux) |

### Processo di cifratura

1. **Preparazione input** — il file viene letto dal filesystem; i percorsi vengono validati contro
   attacchi path-traversal (solo percorsi assoluti, solo file regolari).

2. **Salt casuale** — vengono generati 32 byte di salt crittografico (`OsRng`).

3. **Derivazione della chiave (KDF)**:
   ```
   BLAKE3(len(pw) || pw || len(key_file) || key_file) → pre-key (32 byte)
   Argon2id(pre-key, salt, mem=configurabile, iter=3, lanes=4) → derived key (32 byte)
   ```
   L'encoding con prefisso di lunghezza garantisce che diverse combinazioni
   (password, key_file) non producano mai la stessa pre-key, eliminando
   ogni ambiguità (SEC-07).

4. **Cifratura a stream** — XChaCha20-Poly1305 in modalità stream (LE31):
   - Nonce unico da 20 byte generato per ogni operazione.
   - Il file viene letto a chunk da 64 KB.
   - Ogni chunk viene cifrato e scritto immediatamente su un file temporaneo.
   - L'header del file (magic, parametri Argon2, salt) viene passato come AAD
     (Additional Authenticated Data) al chunk finale, autenticando così l'intero
     header insieme al ciphertext.

5. **Scrittura finale** — il file temporaneo viene sincronizzato su disco (`fsync`),
   poi rinominato atomicamente al percorso di destinazione.

### Formato file (V3)

```
[4 byte magic "NXC3"] [4 byte mem_kib LE] [32 byte salt] [20 byte nonce] [ciphertext + Poly1305 tags]
                    ↑                                              ↑
            Autenticato via AEAD AAD                   Cifrato + autenticato
```

Compatibilità backward: NexusCrypt decifra anche file nei formati V1 e V2,
ma visualizza un avviso nel pannello di decifratura suggerendo di ri-cifrarli in V3.

### Processo di decifratura

1. Lettura e validazione dell'header (magic bytes, parametri Argon2, salt).
2. Derivazione della chiave con gli stessi parametri usati in cifratura.
3. Decifratura a stream con **write-after-auth**:
   - Tutti i chunk di plaintext vengono accumulati in RAM.
   - Solo quando `decrypt_last` verifica con successo l'autenticazione Poly1305
     finale (incluso l'AAD), l'intero plaintext viene scritto su disco in
     un'unica operazione.
   - Se l'autenticazione fallisce (password/file chiave errati, file manomesso),
     **nessun byte di plaintext** viene scritto su disco.

### Generatore di chiavi (`.nxkey`)

- 64 byte (512 bit) generati da `OsRng`.
- Se l'utente fornisce entropia aggiuntiva (es. movimenti del mouse), questa
  viene mescolata con l'entropia di sistema tramite BLAKE3 XOF.
- Il file viene scritto con permessi `0o600` (leggibile solo dal proprietario su Unix).
- Scrittura atomica: file temporaneo → rename.

### Profili di sicurezza Argon2id

| Profilo | Memoria | Uso consigliato |
|---|---|---|
| Basso | 64 MB | Dispositivi datati, VM con poca RAM |
| Standard | 128 MB | Uso quotidiano |
| Paranoico | 256 MB (default) | Massima sicurezza, macchine moderne |

---

## Requisiti di sistema

- **macOS** 10.15+ (Intel o Apple Silicon)
- **Windows** 10+ (64-bit)
- **Linux** (glibc 2.31+, AppImage o .deb)
- Node.js 18+ e Rust 1.70+ (solo per compilazione)

---

## Installazione e avvio

### Prerequisiti

```bash
# Installa Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Installa Node.js (via nvm o download diretto)
# https://nodejs.org

# Installa le dipendenze di sistema per Tauri (macOS)
# (Windows/Linux: vedi https://tauri.app/v2/guides/prerequisites)
```

### Modalità sviluppo

```bash
cd SecureFileX
npm install
npm run tauri dev
```

### Build di produzione

```bash
npm run tauri build
```

L'eseguibile verrà creato in:
- **macOS**: `src-tauri/target/release/bundle/macos/NexusCrypt.app`
- **Windows**: `src-tauri/target/release/bundle/nsis/`
- **Linux**: `src-tauri/target/release/bundle/deb/`

### Test

```bash
cd src-tauri
cargo test
```

---

## Struttura del progetto

```
SecureFileX/
├── src/                        # Frontend React
│   ├── App.tsx                 # Componente principale e navigazione
│   ├── main.tsx                # Entry point
│   ├── i18n.tsx                # Sistema di traduzione EN/IT
│   ├── types.ts                # Tipi TypeScript
│   └── components/
│       ├── EncryptPanel.tsx    # Pannello di cifratura
│       ├── DecryptPanel.tsx    # Pannello di decifratura
│       ├── KeyGenerator.tsx    # Generatore file chiave
│       ├── DropZone.tsx        # Area drag & drop file
│       ├── ProgressBar.tsx     # Barra di avanzamento
│       ├── VaultList.tsx       # Storico file processati
│       ├── Notification.tsx    # Toast di notifica
│       └── Settings.tsx        # Impostazioni
├── src-tauri/                  # Backend Rust
│   ├── Cargo.toml              # Dipendenze Rust
│   ├── tauri.conf.json         # Configurazione Tauri
│   └── src/
│       ├── main.rs             # Entry point bin
│       ├── lib.rs              # Setup Tauri e plugin
│       ├── commands.rs         # Comandi IPC (encrypt/decrypt/keygen)
│       ├── crypto.rs           # XChaCha20-Poly1305 stream cipher
│       ├── kdf.rs              # Derivazione chiave Argon2id + BLAKE3
│       ├── keygen.rs           # Generatore file .nxkey
│       └── file_ops.rs         # Eventi di progresso verso la GUI
└── UTILITY.md                  # Guida rapida per sviluppatori (IT)
```

---

## Dettagli di sicurezza

- **Nessuna chiave hardcoded** — ogni operazione genera chiavi fresche derivate da password e salt.
- **OsRng** — tutto il materiale crittografico proviene dal generatore di numeri casuali del sistema operativo.
- **Zeroize** — password, chiavi derivate, salt e buffer vengono azzerati esplicitamente dalla memoria tramite la crate `zeroize` (con supporto `ZeroizeOnDrop`).
- **Semaphore KDF** — un semaforo limita le operazioni Argon2id concorrenti a 1, prevenendo esaurimento della memoria (ogni Argon2id alloca 64-256 MB).
- **Write-after-auth** — in decifratura, il plaintext viene bufferizzato in RAM e scritto su disco solo dopo la verifica positiva dell'autenticazione Poly1305. Nessun file parzialmente decifrato può rimanere su disco in caso di errore.
- **AAD (V3)** — l'header del file è autenticato assieme al ciphertext, rendendo rilevabile qualsiasi tentativo di modifica dei metadati (magic bytes, parametri Argon2, salt).
- **Percorsi assoluti** — solo percorsi assoluti sono accettati, prevenendo attacchi di path-traversal.
- **File regolari** — vengono accettati solo file regolari (no symlink, device, directory), prevenendo attacchi di tipo symlink.
- **Permessi ristretti** — i file sensibili (`.nxkey`, file temporanei) vengono creati con permessi `0o600`.
- **Scrittura atomica** — i file di output passano attraverso un file temporaneo rinominato atomicamente, con prenotazione TOCTOU-safe del percorso di destinazione.
- **Limite dimensione input** — massimo 128 GiB per prevenire attacchi DoS.

---

## Come usare NexusCrypt

### Cifrare un file

1. Apri la scheda **Encrypt**.
2. Trascina i file da cifrare nell'area di drop, oppure clicca per sfogliare.
3. Inserisci una password robusta.
4. (Opzionale) Seleziona un file `.nxkey` come secondo fattore.
   Il file chiave puoi anche trascinarlo direttamente nella finestra.
5. Clicca **Encrypt Files**.
6. Il file cifrato verrà salvato nella stessa cartella dell'originale con suffisso `.nxenc`.

### Decifrare un file

1. Apri la scheda **Decrypt**.
2. Trascina o seleziona i file `.nxenc` da decifrare.
3. Inserisci la password usata durante la cifratura.
4. Se hai usato un file chiave, selezionalo (deve essere lo stesso file `.nxkey`).
5. Clicca **Decrypt Files**.
6. Il file decifrato verrà salvato nella stessa cartella senza il suffisso `.nxenc`.

### Generare un file chiave

1. Apri la scheda **Key Generator**.
2. Muovi il mouse nell'area indicata per aggiungere entropia.
3. Clicca **Generate Key File** e scegli dove salvarlo.
4. **Importante**: conserva questo file in un luogo sicuro e separato.
   Se perdi il file chiave, i file cifrati con esso **non potranno più essere recuperati**.

---

## Licenza

NexusCrypt è un progetto open source. Tutti i diritti riservati.
