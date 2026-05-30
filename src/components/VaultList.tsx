import { VaultEntry } from '../types';
import { useI18n } from '../i18n';

interface VaultListProps {
    entries: VaultEntry[];
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function VaultList({ entries }: VaultListProps) {
    const { t } = useI18n();

    const timeAgo = (date: Date): string => {
        const sec = Math.floor((Date.now() - date.getTime()) / 1000);
        if (sec < 60) return t.time_just_now;
        if (sec < 3600) return t.time_min_ago(Math.floor(sec / 60));
        if (sec < 86400) return t.time_hours_ago(Math.floor(sec / 3600));
        return date.toLocaleDateString();
    };

    if (entries.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-slide-up">
                <div>
                    <h2 className="text-xl font-bold text-nx-text flex items-center gap-2">
                        <span>🗄️</span> {t.vault_title}
                    </h2>
                    <p className="text-sm text-nx-muted mt-1">{t.vault_subtitle_empty}</p>
                </div>
                <div className="glass flex flex-col items-center justify-center py-20 gap-4">
                    <div className="text-5xl opacity-30">🔒</div>
                    <p className="text-nx-muted text-sm">{t.vault_empty_1}</p>
                    <p className="text-nx-muted text-xs">{t.vault_empty_2}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-nx-text flex items-center gap-2">
                        <span>🗄️</span> {t.vault_title}
                    </h2>
                    <p className="text-sm text-nx-muted mt-1">{t.vault_subtitle(entries.length)}</p>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {entries.map(entry => (
                    <div key={entry.id} className="glass p-3 flex items-center gap-3 hover:border-nx-border/80 transition-all duration-200 animate-fade-in">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${entry.status === 'protected'
                            ? 'bg-[rgba(34,197,94,0.1)]'
                            : 'bg-[rgba(245,158,11,0.1)]'
                            }`}>
                            {entry.status === 'protected' ? '🔒' : '🔓'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-nx-text truncate">{entry.name}</p>
                            <p className="text-[10px] text-nx-muted font-mono truncate mt-0.5">{entry.path}</p>
                        </div>

                        {/* Meta */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            {entry.status === 'protected' ? (
                                <span className="badge-protected">{t.vault_protected}</span>
                            ) : (
                                <span className="badge-unlocked">{t.vault_decrypted}</span>
                            )}
                            <span className="text-[10px] text-nx-muted">{formatBytes(entry.size)} · {timeAgo(entry.timestamp)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
