import { useEffect, useRef, type MutableRefObject } from 'react';

interface EscapeHandlerItem {
    id: number;
    callbackRef: MutableRefObject<() => void>;
}

const escapeHandlers: EscapeHandlerItem[] = [];
let listenerAttached = false;
let listenerId = 0;

const onGlobalKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;

    const topHandler = escapeHandlers[escapeHandlers.length - 1];
    if (!topHandler) return;

    event.preventDefault();
    topHandler.callbackRef.current();
};

const attachListener = () => {
    if (listenerAttached || typeof document === 'undefined') return;
    // Capture phase keeps Esc reliable even if a child stops propagation.
    document.addEventListener('keydown', onGlobalKeyDown, true);
    listenerAttached = true;
};

const detachListenerIfEmpty = () => {
    if (!listenerAttached || escapeHandlers.length > 0 || typeof document === 'undefined') return;
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    listenerAttached = false;
};

export const useEscapeKey = (callback: () => void, enabled = true) => {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return;

        const item: EscapeHandlerItem = {
            id: ++listenerId,
            callbackRef,
        };

        escapeHandlers.push(item);
        attachListener();

        return () => {
            const index = escapeHandlers.findIndex((entry) => entry.id === item.id);
            if (index >= 0) {
                escapeHandlers.splice(index, 1);
            }
            detachListenerIfEmpty();
        };
    }, [enabled]);
};
