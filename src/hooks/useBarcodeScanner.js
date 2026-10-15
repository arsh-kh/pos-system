import { useEffect, useRef } from 'react';

const useBarcodeScanner = (onScan) => {
    const buffer = useRef('');
    const lastKeyTime = useRef(null);

    useEffect(() => {
        // Initialize if empty
        if (!lastKeyTime.current) {
            lastKeyTime.current = Date.now();
        }
        
        const handleKeyDown = (e) => {
            const currentTime = Date.now();
            
            // Barcode scanners act like fast keyboards.
            // If the time between keystrokes is more than 50ms, it's likely a human typing, so we reset.
            if (currentTime - lastKeyTime.current > 50) {
                buffer.current = '';
            }

            // Ignore modifier keys
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') {
                return;
            }

            if (e.key === 'Enter') {
                if (buffer.current.length > 3) { // Arbitrary minimum length for a valid barcode
                    onScan(buffer.current);
                }
                buffer.current = '';
            } else if (e.key.length === 1) { // Only capture printable characters
                buffer.current += e.key;
            }

            lastKeyTime.current = currentTime;
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onScan]);
};

export default useBarcodeScanner;
