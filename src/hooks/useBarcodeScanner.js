import { useEffect, useRef } from 'react';
import { getCharFromBarcodeKeyEvent, normalizeBarcode } from '../utils/barcodeNormalizer';

const useBarcodeScanner = (onScan) => {
    const buffer = useRef('');
    const lastKeyTime = useRef(null);
    const burstTimer = useRef(null);

    useEffect(() => {
        const flushBuffer = () => {
            if (buffer.current.length >= 2) {
                const cleaned = normalizeBarcode(buffer.current).trim();
                buffer.current = '';
                if (cleaned.length >= 2) {
                    onScan(cleaned);
                }
            } else {
                buffer.current = '';
            }
        };

        const handleKeyDown = (e) => {
            // If the key event originated directly inside the dedicated barcode input,
            // let that input's direct onChange/onKeyDown handle it to avoid duplicate triggers.
            if (e.target && e.target.classList && e.target.classList.contains('barcode-scanner-input')) {
                return;
            }

            const currentTime = Date.now();
            
            // If more than 100ms elapsed since last key, start a new buffer
            if (lastKeyTime.current && (currentTime - lastKeyTime.current > 100)) {
                buffer.current = '';
            }

            // Ignore modifier keys
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
                return;
            }

            if (e.key === 'Enter' || e.key === 'Tab') {
                if (burstTimer.current) clearTimeout(burstTimer.current);
                if (buffer.current.length >= 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    flushBuffer();
                }
            } else {
                const char = getCharFromBarcodeKeyEvent(e);
                if (char) {
                    buffer.current += char;

                    // Auto-flush timer: Hardware scanners emit characters in rapid bursts (<35ms per character).
                    // If no new character arrives within 85ms and we have >= 3 chars, automatically trigger scan!
                    if (burstTimer.current) clearTimeout(burstTimer.current);
                    if (buffer.current.length >= 3) {
                        burstTimer.current = setTimeout(() => {
                            flushBuffer();
                        }, 85);
                    }
                }
            }

            lastKeyTime.current = currentTime;
        };

        // Use capture phase so scanner is caught before anything else
        window.addEventListener('keydown', handleKeyDown, true);

        return () => {
            if (burstTimer.current) clearTimeout(burstTimer.current);
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [onScan]);
};

export default useBarcodeScanner;
