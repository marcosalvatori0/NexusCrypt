import { useI18n } from '../i18n';

interface ProgressBarProps {
    progress: number; // 0.0 – 1.0
    label?: string;
    visible: boolean;
}

export function ProgressBar({ progress, label, visible }: ProgressBarProps) {
    const { t } = useI18n();
    if (!visible) return null;
    const pct = Math.round(progress * 100);

    // Since label comes from Rust backend in English ("Reading file...", "Encrypting..."),
    // ideally we would localize it here by translating the event label.
    // For simplicity, we just use local translation for the fallback processing state.
    const displayLabel = label ?? t.prog_processing;

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-nx-muted">{displayLabel}</span>
                <span className="text-xs font-mono text-nx-cyan">{pct}%</span>
            </div>
            <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
