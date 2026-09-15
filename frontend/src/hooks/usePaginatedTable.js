import { useState, useEffect, useCallback, useRef } from 'react';
import { getPaginatedRecords } from '../lib/api';

/**
 * Hook pagination server-side — FIX #1 & #2.
 * Search / filter / range dikerjakan di Supabase, browser hanya terima 1 halaman.
 *
 * @param {string} table - nama tabel Supabase
 * @param {object} opts
 * @param {number} opts.limit - row per halaman
 * @param {function} opts.transform - (row) => uiRow, opsional
 * @param {object} opts.initialFilters - filter eq awal, opsional
 * @param {string[]} opts.searchColumns - kolom ilike, opsional (default per tabel di api.js)
 */
export const usePaginatedTable = (table, { limit = 10, transform = null, initialFilters = {}, searchColumns = null } = {}) => {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(0);

  // Stabilkan transform & searchColumns via ref agar callback yang tidak
  // di-memo (mis. getVendorById dari context) tidak memicu refetch berulang.
  // Fetch hanya dipicu oleh page / search / filters / table / limit.
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const searchColumnsRef = useRef(searchColumns);
  searchColumnsRef.current = searchColumns;

  // Debounce search 400ms agar tidak spam request tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (targetPage = page, targetSearch = debouncedSearch, targetFilters = filters) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, count } = await getPaginatedRecords(table, {
        page: targetPage,
        limit,
        filters: targetFilters,
        search: targetSearch,
        searchColumns: searchColumnsRef.current,
      });
      if (abortRef.current !== reqId) return; // request basi, abaikan
      const fn = transformRef.current;
      const mapped = fn ? data.map(fn) : data;
      setItems(mapped);
      setTotalCount(count);
    } catch (err) {
      if (abortRef.current !== reqId) return;
      console.error(`Error fetching paginated ${table}:`, err);
      setError(err);
    } finally {
      if (abortRef.current === reqId) setLoading(false);
    }
  }, [table, page, debouncedSearch, filters, limit]);

  useEffect(() => {
    fetchPage(page, debouncedSearch, filters);
  }, [fetchPage]);

  const refresh = useCallback(() => fetchPage(page, debouncedSearch, filters), [fetchPage, page, debouncedSearch, filters]);

  // Helper realtime: tanpa refetch full, cukup update halaman aktif
  const applyInsert = useCallback((uiRow) => {
    if (page !== 1) {
      // Data baru ada di halaman 1 — cukup naikkan count, user bisa navigasi
      setTotalCount((c) => c + 1);
      return;
    }
    setItems((prev) => [uiRow, ...prev].slice(0, limit));
    setTotalCount((c) => c + 1);
  }, [page, limit]);

  const applyUpdate = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Mirror items untuk pengecekan eksistensi di luar updater (aman StrictMode)
  const itemsRef = useRef([]);
  itemsRef.current = items;

  const applyDelete = useCallback((id) => {
    const existsOnPage = itemsRef.current.some((it) => it.id === id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (existsOnPage) setTotalCount((c) => Math.max(0, c - 1));
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    items, setItems,
    totalCount, totalPages,
    page, setPage,
    search, setSearch,
    filters, setFilters,
    loading, error, refresh,
    applyInsert, applyUpdate, applyDelete,
  };
};

export default usePaginatedTable;
