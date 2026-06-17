/**
 * useDebounce — Hook generico per il ritardo della propagazione di un valore
 *
 * Ritarda l'aggiornamento di `value` di `delay` millisecondi.
 * Ogni volta che `value` o `delay` cambiano, il timer viene resettato.
 * Al cleanup (unmount o nuovo valore) il timer viene cancellato per evitare
 * aggiornamenti di stato su componenti smontati.
 *
 * Usato da `useInvoiceFilters` per il debounce della SearchBar (300ms).
 *
 * @see Requisiti 4.2, 6.5
 * @see design.md § 2.5 Hook `useDebounce`
 */

import { useState, useEffect } from 'react';

/**
 * Ritarda la propagazione di `value` fino a `delay` ms dopo l'ultima modifica.
 *
 * @template T - Il tipo del valore da ritardare
 * @param value - Il valore da debounce
 * @param delay - Il ritardo in millisecondi
 * @returns Il valore debounced (aggiornato solo dopo il periodo di silenzio)
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
