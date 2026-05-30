export type Language = 'en' | 'it';

export const translations = {
    en: {
        // Header & Nav
        nav_encrypt: 'Encrypt',
        nav_decrypt: 'Decrypt',
        nav_vault: 'Vault',
        nav_keygen: 'Key Generator',
        nav_settings: 'Settings',
        subtitle: 'Military-grade encryption',
        status_secure: 'Secure Environment Active',

        // DropZone
        drop_title: 'Drop files or folders here',
        drop_subtitle: 'or click to browse',
        drop_format: 'any format',
        drop_size: 'any size',
        drop_selected: 'Selected files',
        drop_change: 'Click to change selection',

        // Encrypt Panel
        enc_title: 'Encrypt Files',
        enc_algo_subtitle: 'XChaCha20-Poly1305 · Argon2id · BLAKE3',
        enc_pass_label: 'Master Password',
        enc_pass_placeholder: 'Enter secure password…',
        enc_key_label: 'Key File (.nxkey) — Optional',
        enc_key_placeholder: 'No key file selected (password-only mode)…',
        enc_hint_drop: 'Hint: You can drop the .nxkey file anywhere in this window',
        enc_key_optional: '(optional)',
        btn_browse: 'Browse',
        enc_strip_title: 'Strip File Metadata',
        enc_strip_desc: 'Remove timestamps and permissions from encrypted payload',
        btn_encrypt: 'Encrypt Files',
        btn_encrypting: 'Encrypting…',
        msg_err_no_file: 'No files selected',
        msg_err_no_pass: 'Password required',
        msg_err_no_key: 'Key file required',
        msg_enc_success: 'Encryption complete!',
        msg_enc_success_desc: (n: number) => `${n} file(s) encrypted`,
        msg_enc_fail: 'Encryption failed',

        // Decrypt Panel
        dec_title: 'Decrypt Files',
        dec_subtitle: 'Requires matching password + key file',
        dec_pass_placeholder: 'Enter password used during encryption…',
        dec_warn: 'Authentication will fail if the password or key file is incorrect. No data will be decrypted.',
        dec_legacy_title: 'Legacy format detected',
        dec_legacy_desc: 'This file uses an older format where the header is not authenticated. Re-encrypt it to V3 for full integrity protection.',
        btn_decrypt: 'Decrypt Files',
        btn_decrypting: 'Decrypting…',
        msg_dec_success: 'Decryption complete!',
        msg_dec_success_desc: (n: number) => `${n} file(s) decrypted`,
        msg_dec_fail: 'Decryption failed',

        // Vault
        vault_title: 'Vault',
        vault_subtitle_empty: 'Recent encryption activity',
        vault_subtitle: (n: number) => `${n} file(s) processed`,
        vault_empty_1: 'No files encrypted yet',
        vault_empty_2: 'Encrypted files will appear here',
        vault_protected: 'Protected',
        vault_decrypted: 'Decrypted',
        time_just_now: 'just now',
        time_min_ago: (m: number) => `${m}m ago`,
        time_hours_ago: (h: number) => `${h}h ago`,

        // Key Generator
        key_title: 'Key Generator',
        key_subtitle: 'Generate a cryptographically secure .nxkey file',
        key_sys_entropy: '512-bit System Entropy',
        key_sys_entropy_desc: 'Generated from OS cryptographic random source',
        key_interactive_prompt: 'Move mouse here to mix extra entropy!',
        key_visual: 'Entropy Visualization',
        key_spec: 'Key Specification',
        spec_size: 'Size',
        spec_source: 'Source',
        spec_write: 'Write',
        spec_format: 'Format',
        spec_usage: 'Usage',
        key_warn_1: 'Store this file securely.',
        key_warn_2: ' Without it, your encrypted files ',
        key_warn_3: 'cannot be recovered',
        key_warn_4: '. Consider keeping a backup on an offline USB drive.',
        key_last: 'Last generated key',
        btn_gen_key: 'Generate Key File',
        btn_generating: 'Generating…',
        msg_key_success: 'Key file generated!',
        msg_key_success_desc: (path: string) => `Saved to: ${path}`,
        msg_key_fail: 'Key generation failed',

        // Progress
        prog_processing: 'Processing…',
        prog_done: 'Done',

        // Settings
        set_title: 'Settings',
        set_subtitle: 'Application configuration',
        set_lang_title: 'Language',
        set_lang_desc: 'Change the application display language',
        set_lang_en: 'English',
        set_lang_it: 'Italiano',
        set_profile_title: 'Security Profile (Argon2id)',
        set_profile_desc: 'Adjust memory cost. Higher is safer but slower on older devices.',
        set_profile_low: 'Low (64 MB)',
        set_profile_std: 'Standard (128 MB)',
        set_profile_high: 'Paranoid (256 MB)',

        // Settings Info
        set_info_title: 'Technical Information',
        set_info_desc: 'Technologies and algorithms used by NexusCrypt',
        set_info_algo_title: 'Encryption Algorithm',
        set_info_kdf_title: 'Key Derivation',
        set_info_hash_title: 'Hashing',
        set_info_arch_title: 'Architecture',

        // Dialogs
        dialog_select_files: 'Select files',
        dialog_select_enc_files: 'Select .nxenc files',
        dialog_select_key: 'Select .nxkey file',
        dialog_save_key: 'Save key file as…',
    },
    it: {
        // Header & Nav
        nav_encrypt: 'Cifra',
        nav_decrypt: 'Decifra',
        nav_vault: 'Criptavo',
        nav_keygen: 'Generatore Chiavi',
        nav_settings: 'Impostazioni',
        subtitle: 'Crittografia di livello militare',
        status_secure: 'Ambiente Sicuro Attivo',

        // DropZone
        drop_title: 'Trascina qui file o cartelle',
        drop_subtitle: 'oppure clicca per sfogliare',
        drop_format: 'qualsiasi formato',
        drop_size: 'qualsiasi dimensione',
        drop_selected: 'File selezionati',
        drop_change: 'Clicca per modificare la selezione',

        // Encrypt Panel
        enc_title: 'Cifratura File',
        enc_algo_subtitle: 'XChaCha20-Poly1305 · Argon2id · BLAKE3',
        enc_pass_label: 'Master Password',
        enc_pass_placeholder: 'Inserisci una password sicura…',
        enc_key_label: 'File Chiave (.nxkey) — Opzionale',
        enc_key_placeholder: 'Nessun file chiave (modalità solo password)…',
        enc_hint_drop: 'Suggerimento: Puoi trascinare il file .nxkey in qualsiasi punto di questa finestra',
        enc_key_optional: '(opzionale)',
        btn_browse: 'Sfoglia',
        enc_strip_title: 'Rimuovi Metadati',
        enc_strip_desc: 'Rimuovi timestamp e permessi dal payload crittografato',
        btn_encrypt: 'Cifra File',
        btn_encrypting: 'Cifratura in corso…',
        msg_err_no_file: 'Nessun file selezionato',
        msg_err_no_pass: 'Password richiesta',
        msg_err_no_key: 'File chiave richiesto',
        msg_enc_success: 'Cifratura completata!',
        msg_enc_success_desc: (n: number) => `${n} file cifrato/i`,
        msg_enc_fail: 'Cifratura fallita',

        // Decrypt Panel
        dec_title: 'Decifratura File',
        dec_subtitle: 'Richiede la password e il file chiave corrispondenti',
        dec_pass_placeholder: 'Inserisci la password usata per la cifratura…',
        dec_warn: 'È fondamentale utilizzare l\'esatta password e l\'eventuale file chiave impiegati in fase di cifratura. In caso di credenziali errate, l\'accesso sarà negato e nessun dato verrà decifrato.',
        dec_legacy_title: 'Formato legacy rilevato',
        dec_legacy_desc: 'Questo file usa un vecchio formato in cui l\'header non è autenticato. Ri-cifralo in V3 per una protezione completa dell\'integrità.',
        btn_decrypt: 'Decifra File',
        btn_decrypting: 'Decifratura in corso…',
        msg_dec_success: 'Decifratura completata!',
        msg_dec_success_desc: (n: number) => `${n} file decifrato/i`,
        msg_dec_fail: 'Decifratura fallita',

        // Vault
        vault_title: 'Criptavo',
        vault_subtitle_empty: 'Attività di crittografia recenti',
        vault_subtitle: (n: number) => `${n} file processato/i`,
        vault_empty_1: 'Nessun file ancora cifrato',
        vault_empty_2: 'I file cifrati appariranno qui',
        vault_protected: 'Protetto',
        vault_decrypted: 'Decifrato',
        time_just_now: 'proprio ora',
        time_min_ago: (m: number) => `${m}m fa`,
        time_hours_ago: (h: number) => `${h}h fa`,

        // Key Generator
        key_title: 'Generatore Chiavi',
        key_subtitle: 'Genera un file .nxkey crittograficamente sicuro',
        key_sys_entropy: 'Entropia di Sistema a 512-bit',
        key_sys_entropy_desc: 'Generata dalla sorgente casuale crittografica del sistema operativo',
        key_interactive_prompt: 'Muovi il mouse qui per mescolare entropia extra!',
        key_visual: 'Visualizzazione Entropia',
        key_spec: 'Specifiche Chiave',
        spec_size: 'Dimensione',
        spec_source: 'Sorgente',
        spec_write: 'Scrittura',
        spec_format: 'Formato',
        spec_usage: 'Utilizzo',
        key_warn_1: 'Conserva questo file al sicuro.',
        key_warn_2: ' Senza di esso, i tuoi file cifrati ',
        key_warn_3: 'non possono essere recuperati',
        key_warn_4: '. Valuta di conservare un backup su un\'unità USB offline.',
        key_last: 'Ultima chiave generata',
        btn_gen_key: 'Genera File Chiave',
        btn_generating: 'Generazione in corso…',
        msg_key_success: 'File chiave generato!',
        msg_key_success_desc: (path: string) => `Salvato in: ${path}`,
        msg_key_fail: 'Generazione chiave fallita',

        // Progress
        prog_processing: 'Elaborazione…',
        prog_done: 'Fatto',

        // Settings
        set_title: 'Impostazioni',
        set_subtitle: 'Configurazione dell\'applicazione',
        set_lang_title: 'Lingua d\'interfaccia',
        set_lang_desc: 'Modifica la lingua dell\'interfaccia utente',
        set_lang_en: 'Inglese (English)',
        set_lang_it: 'Italiano',
        set_profile_title: 'Profilo Sicurezza (Argon2id)',
        set_profile_desc: 'Configura il calcolo in memoria. Valori alti aumentano la resistenza, ma rallentano i dispositivi datati.',
        set_profile_low: 'Basso (64 MB)',
        set_profile_std: 'Standard (128 MB)',
        set_profile_high: 'Paranoico (256 MB)',

        // Settings Info
        set_info_title: 'Informazioni Tecniche',
        set_info_desc: 'Tecnologie e algoritmi utilizzati da NexusCrypt',
        set_info_algo_title: 'Algoritmo di Cifratura',
        set_info_kdf_title: 'Derivazione Chiave',
        set_info_hash_title: 'Hashing',
        set_info_arch_title: 'Architettura',

        // Dialogs
        dialog_select_files: 'Seleziona file',
        dialog_select_enc_files: 'Seleziona file .nxenc',
        dialog_select_key: 'Seleziona file .nxkey',
        dialog_save_key: 'Salva file chiave come…',
    }
};

type TDict = typeof translations['en'];

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type I18nContextType = {
    lang: Language;
    setLang: (l: Language) => void;
    t: TDict;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>('en');

    useEffect(() => {
        const saved = localStorage.getItem('nx_lang') as Language;
        if (saved && (saved === 'en' || saved === 'it')) {
            setLangState(saved);
        } else {
            const browserLang = navigator.language.startsWith('it') ? 'it' : 'en';
            setLangState(browserLang);
        }
    }, []);

    const setLang = (l: Language) => {
        setLangState(l);
        localStorage.setItem('nx_lang', l);
    };

    return (
        <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within I18nProvider');
    return ctx;
}
