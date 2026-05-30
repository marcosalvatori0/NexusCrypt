import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { DropZone } from './DropZone';
import { ProgressBar } from './ProgressBar';
import { NotificationData } from './Notification';
import { useTauriProgress } from '../hooks/useTauriProgress';
import { useTauriDragDrop } from '../hooks/useTauriDragDrop';
import { useI18n } from '../i18n';

interface DecryptPanelProps {
    notify: (n: NotificationData) => void;
}

export function DecryptPanel({ notify }: DecryptPanelProps) {
    const { t } = useI18n();
    const [files, setFiles] = useState<string[]>([]);
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [keyFile, setKeyFile] = useState('');
    const [progress, setProgress] = useState(0);
    const [progLabel, setProgLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [legacyWarning, setLegacyWarning] = useState(false);

    useTauriProgress('decrypt_progress', ({ progress: p, label }) => {
        setProgress(p);
        setProgLabel(label);
    });

    const handleGlobalDrop = (paths: string[]) => {
        const keyPaths = paths.filter(p => p.toLowerCase().endsWith('.nxkey'));
        const otherPaths = paths.filter(p => !p.toLowerCase().endsWith('.nxkey'));

        if (keyPaths.length > 0) setKeyFile(keyPaths[0]);
        if (otherPaths.length > 0) {
            setFiles(prev => Array.from(new Set([...prev, ...otherPaths])));
        }
    };

    const { isHovering } = useTauriDragDrop(handleGlobalDrop);

    const pickFiles = async () => {
        const result = await open({
            multiple: true,
            filters: [{ name: 'NexusCrypt Encrypted', extensions: ['nxenc'] }],
            title: t.dialog_select_enc_files,
        });
        if (result) setFiles(Array.isArray(result) ? result : [result]);
    };

    const pickKeyFile = async () => {
        const result = await open({
            multiple: false,
            filters: [{ name: 'NexusCrypt Key', extensions: ['nxkey'] }],
            title: t.dialog_select_key,
        });
        if (result) setKeyFile(typeof result === 'string' ? result : result[0]);
    };

    const handleDecrypt = async () => {
        if (!files.length) return notify({ type: 'error', title: t.msg_err_no_file });
        if (!password) return notify({ type: 'error', title: t.msg_err_no_pass });

        setBusy(true);
        setProgress(0);
        setLegacyWarning(false);

        try {
            let anyLegacy = false;
            for (const path of files) {
                const result: any = await invoke('decrypt_file', {
                    path,
                    password,
                    keyFilePath: keyFile,
                });
                if (result.file_version && result.file_version < 3) {
                    anyLegacy = true;
                }
            }
            if (anyLegacy) setLegacyWarning(true);
            notify({ type: 'success', title: t.msg_dec_success, message: t.msg_dec_success_desc(files.length) });
            setFiles([]);
        } catch (err: any) {
            notify({ type: 'error', title: t.msg_dec_fail, message: String(err) });
        } finally {
            setPassword('');
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-slide-up">
            <div>
                <h2 className="text-xl font-bold text-nx-text flex items-center gap-2">
                    <span>🔓</span> {t.dec_title}
                </h2>
            </div>

            <DropZone files={files} isHovering={isHovering} onPickFiles={pickFiles} />

            <div className="space-y-4">
                <label className="text-xs font-medium text-nx-muted uppercase tracking-wider">{t.enc_pass_label}</label>
                <div className="relative">
                    <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t.dec_pass_placeholder}
                        className="input-field pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-nx-muted hover:text-nx-cyan transition-colors text-sm"
                    >
                        {showPass ? '🙈' : '👁'}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
            <label className="text-xs font-medium text-nx-muted uppercase tracking-wider">{t.enc_key_label}</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={keyFile}
                    readOnly
                    placeholder={t.enc_key_placeholder}
                    className="input-field flex-1 cursor-pointer"
                    onClick={pickKeyFile}
                />
                <button onClick={pickKeyFile} className="btn-secondary shrink-0">{t.btn_browse}</button>
            </div>
            <p className="text-[10px] text-nx-muted flex justify-between mt-1">
                <span>{t.enc_hint_drop}</span>
                <span>{t.enc_key_optional}</span>
            </p>
        </div>

        <div className="glass p-4 flex items-start gap-3 border-nx-amber/30">
            <span className="text-nx-amber text-lg shrink-0">⚠</span>
            <p className="text-xs text-nx-muted leading-relaxed">
                {t.dec_warn}
            </p>
        </div>

        {busy && <ProgressBar progress={progress} label={progLabel} visible={true} />}

        {legacyWarning && (
          <div className="glass p-4 flex items-start gap-3 border-l-2 border-nx-amber/50">
            <span className="text-nx-amber text-lg shrink-0">⚠</span>
            <div>
              <p className="text-sm font-semibold text-nx-amber">{t.dec_legacy_title}</p>
              <p className="text-xs text-nx-muted mt-0.5">{t.dec_legacy_desc}</p>
            </div>
          </div>
        )}

        <button
            onClick={handleDecrypt}
            disabled={busy || !files.length || !password}
                className="btn-primary w-full py-3.5 !bg-[#22c55e] hover:!shadow-glow-green"
                style={{ background: undefined }}
            >
                {busy ? <span className="animate-spin">⟳</span> : '🔓'}
                {busy ? t.btn_decrypting : t.btn_decrypt}
            </button>
        </div>
    );
}
