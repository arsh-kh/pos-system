import { useEffect, useRef } from 'react';
import { normalizeDigits } from '../utils/kurdishSearch';

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
            // Using 90ms timeout ensures Bluetooth, 2D, and wireless scanners never drop characters.
            if (currentTime - lastKeyTime.current > 90) {
                buffer.current = '';
            }

            // Ignore modifier keys
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
                return;
            }

            if (e.key === 'Enter') {
                if (buffer.current.length >= 3) {
                    // Normalize any Eastern Arabic / Kurdish digits to standard digits
                    const cleaned = normalizeDigits(buffer.current).trim();
                    if (cleaned.length >= 3) {
                        onScan(cleaned);
                    }
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
