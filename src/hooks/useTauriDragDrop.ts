import { useEffect, useState, useRef } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export function useTauriDragDrop(onDrop: (paths: string[]) => void) {
    const [isHovering, setIsHovering] = useState(false);
    const onDropRef = useRef(onDrop);

    useEffect(() => {
        onDropRef.current = onDrop;
    }, [onDrop]);

    useEffect(() => {
        let unlisten: (() => void) | undefined;

        getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === 'over' || event.payload.type === 'enter') {
                setIsHovering(true);
            } else if (event.payload.type === 'leave') {
                setIsHovering(false);
            } else if (event.payload.type === 'drop') {
                setIsHovering(false);
                if (event.payload.paths && event.payload.paths.length > 0) {
                    onDropRef.current(event.payload.paths);
                }
            }
        }).then((fn) => {
            unlisten = fn;
        });

        return () => {
            if (unlisten) unlisten();
        };
    }, []); // Empty dependency array ensures we only subscribe ONCE

    return { isHovering };
}
