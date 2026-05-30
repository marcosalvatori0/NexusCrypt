import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import zxcvbn from 'zxcvbn';
import { DropZone } from './DropZone';
import { ProgressBar } from './ProgressBar';
import { NotificationData } from './Notification';
import { useTauriProgress } from '../hooks/useTauriProgress';
import { useTauriDragDrop } from '../hooks/useTauriDragDrop';
import { useI18n } from '../i18n';

interface EncryptPanelProps {
    notify: (n: NotificationData) => void;
}

export function EncryptPanel({ notify }: EncryptPanelProps) {
    const { t } = useI18n();
    const [files, setFiles] = useState<string[]>([]);
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [keyFile, setKeyFile] = useState('');
    const [progress, setProgress] = useState(0);
    const [progLabel, setProgLabel] = useState('');
    const [busy, setBusy] = useState(false);

    useTauriProgress('encrypt_progress', ({ progress: p, label }) => {
        setProgress(p);
        setProgLabel(label);
    });

    const pwScore = password ? zxcvbn(password).score : -1;
    const getStrengthClass = (score: number) => {
        if (score === -1) return 'w-0 opacity-0';
        if (score === 0) return 'w-1/5 bg-nx-red shadow-glow-red';
        if (score === 1) return 'w-2/5 bg-nx-amber';
        if (score === 2) return 'w-3/5 bg-nx-amber';
        if (score === 3) return 'w-4/5 bg-nx-green shadow-glow-green';
        return 'w-full bg-nx-cyan shadow-glow-cyan';
    };

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
        const result = await open({ multiple: true, title: t.dialog_select_files });
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

    const handleEncrypt = async () => {
        if (!files.length) return notify({ type: 'error', title: t.msg_err_no_file });
        if (!password) return notify({ type: 'error', title: t.msg_err_no_pass });

        setBusy(true);
        setProgress(0);

        const memKib = parseInt(localStorage.getItem('nx_memProfile') || '256', 10) * 1024;

        try {
            for (const path of files) {
                await invoke('encrypt_file', {
                    path,
                    password,
                    keyFilePath: keyFile,
                    argon2MemKib: memKib,
                });
            }
            notify({ type: 'success', title: t.msg_enc_success, message: t.msg_enc_success_desc(files.length) });
            setFiles([]);
        } catch (err: any) {
            notify({ type: 'error', title: t.msg_enc_fail, message: String(err) });
        } finally {
            setPassword('');
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-slide-up">
            <div>
                <h2 className="text-xl font-bold text-nx-text flex items-center gap-2">
                    <span>🔒</span> {t.enc_title}
                </h2>
            </div>

            <DropZone files={files} isHovering={isHovering} onPickFiles={pickFiles} />

            <div className="space-y-2">
                <label className="text-xs font-medium text-nx-muted uppercase tracking-wider">{t.enc_pass_label}</label>
                <div className="relative">
                    <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t.enc_pass_placeholder}
                        className="input-field pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-nx-muted hover:text-nx-cyan transition-colors text-sm"
                    >
                        {showPass ? '🙈' : '👁'}
                    </button>
                    {/* Password Strength Meter */}
                    <div className="absolute left-0 -bottom-2 w-full h-[3px] bg-nx-surface2 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 rounded-full ${getStrengthClass(pwScore)}`} />
                    </div>
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

      {busy && <ProgressBar progress={progress} label={progLabel} visible={true} />}

      <button
        onClick={handleEncrypt}
        disabled={busy || !files.length || !password}
                className="btn-primary w-full py-3.5"
            >
                {busy ? <span className="animate-spin">⟳</span> : '🔒'}
                {busy ? t.btn_encrypting : t.btn_encrypt}
            </button>
        </div>
    );
}
