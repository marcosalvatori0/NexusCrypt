import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

export interface ProgressEvent {
    progress: number;
    label: string;
}

/**
 * Subscribe to a Tauri progress event (e.g. "encrypt_progress").
 * Calls `onProgress` on every event update.
 * Automatically unsubscribes on unmount.
 */
export function useTauriProgress(
    eventName: string,
    onProgress: (e: ProgressEvent) => void
) {
    const cbRef = useRef(onProgress);
    cbRef.current = onProgress;

    useEffect(() => {
        let unlisten: (() => void) | null = null;

        listen<ProgressEvent>(eventName, event => {
            cbRef.current(event.payload);
        }).then(fn => {
            unlisten = fn;
        });

        return () => {
            unlisten?.();
        };
    }, [eventName]);
}
