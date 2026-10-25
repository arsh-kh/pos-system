import { useEffect, useRef } from 'react';
import { getCharFromBarcodeKeyEvent, normalizeBarcode } from '../utils/barcodeNormalizer';

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
                if (buffer.current.length >= 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Normalize any Eastern Arabic / Kurdish digits or localized keys (e.g. ث -> P)
                    const cleaned = normalizeBarcode(buffer.current).trim();
                    if (cleaned.length >= 2) {
                        onScan(cleaned);
                    }
                }
                buffer.current = '';
            } else {
                // Extract true physical key character (immune to OS Arabic/Kurdish keyboard layouts)
                const char = getCharFromBarcodeKeyEvent(e);
                if (char) {
                    buffer.current += char;
                }
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
