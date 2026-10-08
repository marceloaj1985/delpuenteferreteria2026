import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PageSizeOption = 20 | 50 | 100 | 200 | 500 | 'ALL';

export const PAGE_SIZE_OPTIONS: { value: PageSizeOption; label: string }[] = [
  { value: 20, label: '20 (Predeterminado)' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 500, label: '500' },
  { value: 'ALL', label: 'Todos' },
];

interface TablePaginationBarProps {
  totalItems: number;
  currentPage: number;
  pageSize: PageSizeOption;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
  itemLabel?: string;
  compact?: boolean;
}

export function paginateArray<T>(
  items: T[],
  currentPage: number,
  pageSize: PageSizeOption
): {
  paginatedItems: T[];
  totalPages: number;
  safeCurrentPage: number;
  safePage: number;
  startIndex: number;
  endIndex: number;
} {
  const totalItems = items.length;
  if (pageSize === 'ALL' || totalItems === 0) {
    return {
      paginatedItems: items,
      totalPages: 1,
      safeCurrentPage: 1,
      safePage: 1,
      startIndex: totalItems > 0 ? 1 : 0,
      endIndex: totalItems,
    };
  }

  const numericSize = Number(pageSize) || 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / numericSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startOffset = (safeCurrentPage - 1) * numericSize;
  const paginatedItems = items.slice(startOffset, startOffset + numericSize);

  return {
    paginatedItems,
    totalPages,
    safeCurrentPage,
    safePage: safeCurrentPage,
    startIndex: totalItems > 0 ? startOffset + 1 : 0,
    endIndex: Math.min(startOffset + numericSize, totalItems),
  };
}

export const TablePaginationBar: React.FC<TablePaginationBarProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'productos',
  compact = false,
}) => {
  const totalPages =
    pageSize === 'ALL'
      ? 1
      : Math.max(1, Math.ceil(totalItems / (Number(pageSize) || 20)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIdx =
    totalItems === 0
      ? 0
      : pageSize === 'ALL'
      ? 1
      : (safePage - 1) * Number(pageSize) + 1;
  const endIdx =
    totalItems === 0
      ? 0
      : pageSize === 'ALL'
      ? totalItems
      : Math.min(safePage * Number(pageSize), totalItems);

  return (
    <div
      className={`border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2 ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-4 py-3 text-xs'
      }`}
    >
      {/* Selector Mostrar por página */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="font-semibold text-slate-600 whitespace-nowrap">
          Mostrar por página:
        </label>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const val = e.target.value;
            onPageSizeChange(
              val === 'ALL' ? 'ALL' : (Number(val) as PageSizeOption)
            );
          }}
          className={`font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600] cursor-pointer ${
            compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>

        <span className="text-slate-500 font-medium">
          Mostrando{' '}
          <strong className="font-mono text-slate-900">
            {startIdx}-{endIdx}
          </strong>{' '}
          de <strong className="font-mono text-slate-900">{totalItems}</strong>{' '}
          {itemLabel}
        </span>
      </div>

      {/* Controles Anterior / Página X de Y / Siguiente */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className={`inline-flex items-center gap-1 rounded-lg border font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            compact
              ? 'px-2 py-0.5 text-[11px] bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              : 'px-3 py-1.5 text-xs bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Anterior</span>
        </button>

        <span
          className={`font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg whitespace-nowrap ${
            compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs'
          }`}
        >
          Página {safePage} de {totalPages}
        </span>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className={`inline-flex items-center gap-1 rounded-lg border font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            compact
              ? 'px-2 py-0.5 text-[11px] bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              : 'px-3 py-1.5 text-xs bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
          }`}
        >
          <span>Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
