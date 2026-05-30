import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { NotificationData } from './Notification';
import { useI18n } from '../i18n';

interface KeyGeneratorProps {
    notify: (n: NotificationData) => void;
}

export function KeyGenerator({ notify }: KeyGeneratorProps) {
    const { t } = useI18n();
    const [generating, setGenerating] = useState(false);
    const [lastPath, setLastPath] = useState<string | null>(null);
    const [entropyLevel, setEntropyLevel] = useState(0); // 0 to 100
    const [userEntropy, setUserEntropy] = useState<number[]>([]);
    const [entropyBars, setEntropyBars] = useState(() =>
        Array.from({ length: 32 }, () => Math.random())
    );

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        // Add coordinates to entropy pool (up to 2048 bytes)
        setUserEntropy(prev => {
            const next = [...prev, e.clientX % 256, e.clientY % 256];
            return next.length > 2048 ? next.slice(-2048) : next;
        });

        // Increase percentage (needs 200 events)
        setEntropyLevel(prev => Math.min(100, prev + 0.5));

        // Visually scatter a bar
        setEntropyBars(prev => {
            const next = [...prev];
            const idx = Math.floor(Math.random() * 32);
            next[idx] = Math.random();
            return next;
        });
    }, []);

    const handleGenerate = async () => {
        const savePath = await save({
            defaultPath: 'nexuscrypt.nxkey',
            filters: [{ name: 'NexusCrypt Key', extensions: ['nxkey'] }],
            title: t.dialog_save_key,
        });

        if (!savePath) return;

        setGenerating(true);
        try {
            await invoke('generate_key_file', {
                outputPath: savePath,
                userEntropy: userEntropy.length > 0 ? userEntropy : null
            });
            setLastPath(savePath);
            notify({
                type: 'success',
                title: t.msg_key_success,
                message: t.msg_key_success_desc(savePath.split('/').pop() || ''),
            });
        } catch (err: any) {
            notify({ type: 'error', title: t.msg_key_fail, message: String(err) });
        } finally {
            setGenerating(false);
            setEntropyLevel(0);
            setUserEntropy([]);
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-slide-up">
            <div>
                <h2 className="text-xl font-bold text-nx-text flex items-center gap-2">
                    <span>🗝️</span> {t.key_title}
                </h2>
                <p className="text-sm text-nx-muted mt-1">{t.key_subtitle}</p>
            </div>

            <div className="glass p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[rgba(0,245,212,0.1)] flex items-center justify-center text-lg">🎲</div>
                    <div>
                        <p className="text-sm font-semibold text-nx-text">{t.key_sys_entropy}</p>
                        <p className="text-xs text-nx-muted">{t.key_sys_entropy_desc}</p>
                    </div>
                </div>

                {/* Mouse Drag Entropy Area */}
                <div
                    className="relative w-full h-32 rounded-xl bg-nx-surface/50 border border-dashed border-nx-border flex flex-col items-center justify-center overflow-hidden group cursor-crosshair select-none"
                    onMouseMove={handleMouseMove}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-nx-surface to-transparent z-0"></div>

                    <div className="z-10 flex flex-col items-center gap-2">
                        <span className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-300">🖱️</span>
                        <p className="text-xs font-medium text-nx-text">{t.key_interactive_prompt}</p>
                        <div className="w-48 h-2 bg-nx-border rounded-full overflow-hidden mt-1">
                            <div
                                className="h-full bg-nx-cyan transition-all duration-75 shadow-glow-cyan"
                                style={{ width: `${entropyLevel}%` }}
                            />
                        </div>
                    </div>

                    {/* Bars visual */}
                    <div className="absolute bottom-0 w-full flex gap-[2px] items-end h-16 px-1 opacity-20 group-hover:opacity-40 transition-opacity">
                        {entropyBars.map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-sm bg-nx-cyan transition-all duration-75"
                                style={{ height: `${Math.max(10, h * 100)}%` }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass p-4">
                <p className="text-[11px] font-semibold text-nx-muted uppercase tracking-wider mb-2">{t.key_spec}</p>
                <div className="space-y-1.5">
                    {[
                        { label: t.spec_size, value: '512 bits (64 bytes)' },
                        { label: t.spec_source, value: 'OS RNG + Mouse Mix' },
                        { label: t.spec_write, value: 'Atomic (tmp → rename)' },
                        { label: t.spec_format, value: 'Raw binary (.nxkey)' },
                        { label: t.spec_usage, value: 'BLAKE3 + Argon2id' },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                            <span className="text-nx-muted">{label}</span>
                            <span className="font-mono text-nx-text text-xs">{value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass p-3.5 flex items-start gap-2.5 border-l-2 border-nx-red/50">
                <span className="text-nx-red shrink-0 text-sm mt-0.5">🔴</span>
                <p className="text-[11px] text-nx-muted leading-relaxed">
                    <strong className="text-nx-text">{t.key_warn_1}</strong>
                    {t.key_warn_2}
                    <strong className="text-nx-red">{t.key_warn_3}</strong>
                    {t.key_warn_4}
                </p>
            </div>

            {lastPath && (
                <div className="glass p-3.5 flex items-center gap-2.5 border-nx-green/30 animate-fade-in">
                    <span className="text-nx-green text-sm">✓</span>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-nx-green">{t.key_last}</p>
                        <p className="text-[10px] text-nx-muted font-mono truncate">{lastPath}</p>
                    </div>
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full py-3.5"
            >
                {generating ? <span className="animate-spin">⟳</span> : '🎲'}
                {generating ? t.btn_generating : t.btn_gen_key}
            </button>
        </div>
    );
}
