import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Komponen Tabel Data Desktop-First:
 * - Mendukung sorting kolom (klik header kolom yang memiliki sortable: true)
 * - Pada layar >= 768px tampil sebagai TABEL penuh
 * - Pada layar < 768px otomatis berubah menjadi daftar kartu bila renderMobileCard diberikan
 */
export default function DataTable({
  columns = [],
  data = [],
  keyExtractor,
  emptyContent,
  renderMobileCard,
  defaultSortKey = null,
  defaultSortDir = 'asc'
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  const handleSort = (col) => {
    if (!col.sortable) return;
    const key = col.sortKey || col.key;
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const activeCol = columns.find((c) => (c.sortKey || c.key) === sortKey);

    return [...data].sort((a, b) => {
      const valA = activeCol?.sortValue ? activeCol.sortValue(a) : a[sortKey];
      const valB = activeCol?.sortValue ? activeCol.sortValue(b) : b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns]);

  if (!data || data.length === 0) {
    return emptyContent || null;
  }

  return (
    <div>
      {/* Tampilan TABEL untuk layar >= 768px */}
      <div
        className={`${
          renderMobileCard ? 'hidden md:block' : 'block'
        } w-full overflow-x-auto rounded-card border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-darkCard shadow-soft`}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-800/60">
              {columns.map((col) => {
                const colSortKey = col.sortKey || col.key;
                const isSorted = sortKey === colSortKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={`inline-flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-1 -mx-1 ${
                          isSorted ? 'text-primary-700 dark:text-primary-400' : ''
                        }`}
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            {sortedData.map((row, rowIndex) => (
              <tr
                key={keyExtractor ? keyExtractor(row) : row.id || rowIndex}
                className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 align-middle text-gray-900 dark:text-gray-100 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.cellClassName || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tampilan Kartu Responsif untuk layar < 768px */}
      {renderMobileCard && (
        <div className="md:hidden space-y-3">
          {sortedData.map((row, idx) => (
            <React.Fragment
              key={keyExtractor ? keyExtractor(row) : row.id || idx}
            >
              {renderMobileCard(row)}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
