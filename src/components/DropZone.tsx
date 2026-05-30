
import { useI18n } from '../i18n';

interface DropZoneProps {
    files: string[];
    isHovering?: boolean;
    onPickFiles: () => void;
    accept?: string;
}

export function DropZone({ files, isHovering, onPickFiles }: DropZoneProps) {
    const { t } = useI18n();

    return (
        <div
            className={`dropzone ${isHovering ? 'drag-over' : ''}`}
            onClick={onPickFiles}
        >
            {files.length === 0 ? (
                <div className="flex flex-col items-center gap-2 pointer-events-none select-none">
                    <div className="w-10 h-10 rounded-xl bg-nx-surface flex items-center justify-center text-2xl text-nx-cyan">
                        📂
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-nx-text">{t.drop_title}</p>
                        <p className="text-xs text-nx-muted mt-1">{t.drop_subtitle}</p>
                    </div>
                    <div className="flex gap-2 text-xs text-nx-muted">
                        <span className="px-2 py-0.5 rounded bg-nx-border">{t.drop_format}</span>
                        <span className="px-2 py-0.5 rounded bg-nx-border">{t.drop_size}</span>
                    </div>
                </div>
            ) : (
                <div className="w-full p-3 pointer-events-none">
                    <p className="text-[11px] text-nx-muted mb-1.5">{t.drop_selected} ({files.length})</p>
                    <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
                        {files.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs font-mono text-nx-text">
                                <span className="text-nx-cyan">›</span>
                                <span className="truncate">{f}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-nx-muted mt-2">{t.drop_change}</p>
                </div>
            )}
        </div>
    );
}
