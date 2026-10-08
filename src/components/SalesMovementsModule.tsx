import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Filter,
  TrendingUp,
  RotateCcw,
  Wallet,
  Calculator,
  Download,
  Printer,
  MessageCircle,
  Users,
  X,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import {
  ClientItem,
  CommercialDocument,
  ProductItem,
  SupplierItem,
} from '../types/ferreteria.ts';
import { StatusBadge } from './StatusBadge.tsx';
import {
  TablePaginationBar,
  PageSizeOption,
  paginateArray,
} from './TablePaginationBar.tsx';

export type MovementCategoryType =
  | 'Todos'
  | 'Venta'
  | 'Presupuesto'
  | 'Devolución/Nota de Crédito'
  | 'Pago Cta. Cte.'
  | 'Factura de Compra';

export type MovementStatusOrDocFilter =
  | 'Todos'
  | 'Factura A'
  | 'Factura B'
  | 'Factura C'
  | 'Remito'
  | 'Ticket'
  | 'Cobrado'
  | 'Pendiente';

export type QuickDateRangeType = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface UnifiedSalesMovementRecord {
  id: string;
  rawDoc?: CommercialDocument;
  isoDate: string; // YYYY-MM-DD
  formattedDate: string;
  docNumber: string;
  movementType: Exclude<MovementCategoryType, 'Todos'>;
  voucherSubType: string; // Factura A, Factura B, Factura C, Remito, Ticket, Recibo Cta. Cte., etc.
  clientName: string;
  clientCuit: string;
  concept: string;
  sellerName: string;
  paymentStatus: 'Cobrado' | 'Pendiente' | 'Emitido' | 'Aceptado' | 'Borrador' | 'Anulado';
  statusBadgeLabel: string;
  amount: number;
  itemsCount: number;
}

interface SalesMovementsModuleProps {
  documents: CommercialDocument[];
  clients: ClientItem[];
  suppliers: SupplierItem[];
  products: ProductItem[];
  branchName: string;
  sellerName: string;
  formatCurrency: (val: string | number) => string;
  onOpenDocVoucherModal: (
    doc: CommercialDocument,
    tab: 'pdf' | 'whatsapp'
  ) => void;
  onCycleDocStatus?: (doc: CommercialDocument) => void;
  onNavigateSection?: (
    section:
      | 'punto-de-venta'
      | 'nuevo-presupuesto'
      | 'ventas-devoluciones'
      | 'pago-cuenta-corriente'
      | 'facturar-compra'
  ) => void;
}

function toIsoDateString(dateInput?: string | Date): string {
  if (!dateInput) {
    return new Date().toISOString().slice(0, 10);
  }
  if (dateInput instanceof Date) {
    return dateInput.toISOString().slice(0, 10);
  }
  const str = String(dateInput).trim();
  // Si viene DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function formatIsoToArDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export const SalesMovementsModule: React.FC<SalesMovementsModuleProps> = ({
  documents,
  clients,
  suppliers,
  branchName,
  sellerName,
  formatCurrency,
  onOpenDocVoucherModal,
  onCycleDocStatus,
  onNavigateSection,
}) => {
  // Filtros principales superiores
  const [globalSearch, setGlobalSearch] = useState('');
  const [clientFilterQuery, setClientFilterQuery] = useState('');
  const [selectedClientKey, setSelectedClientKey] = useState<string>('ALL');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const [quickDateRange, setQuickDateRange] =
    useState<QuickDateRangeType>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [movementTypeFilter, setMovementTypeFilter] =
    useState<MovementCategoryType>('Todos');
  const [statusOrVoucherFilter, setStatusOrVoucherFilter] =
    useState<MovementStatusOrDocFilter>('Todos');

  // Paginación y ordenamiento
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Aplicación de botones rápidos de fecha (Hoy, Esta semana, Este mes, Todos)
  const handleSelectQuickDate = (range: QuickDateRangeType) => {
    setQuickDateRange(range);
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

    if (range === 'all') {
      setDateFrom('');
      setDateTo('');
      setCurrentPage(1);
      return;
    }
    if (range === 'today') {
      setDateFrom(todayIso);
      setDateTo(todayIso);
      setCurrentPage(1);
      return;
    }
    if (range === 'week') {
      const dayOfWeek = now.getDay(); // 0 domingo .. 6 sabado
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      setDateFrom(monday.toISOString().slice(0, 10));
      setDateTo(todayIso);
      setCurrentPage(1);
      return;
    }
    if (range === 'month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(firstOfMonth.toISOString().slice(0, 10));
      setDateTo(todayIso);
      setCurrentPage(1);
    }
  };

  // Construcción del historial unificado (Ventas, Presupuestos, Devoluciones, Cobros de Cta. Cte. y Facturas de Compra)
  const allMovements = useMemo<UnifiedSalesMovementRecord[]>(() => {
    const records: UnifiedSalesMovementRecord[] = [];
    const todayIso = new Date().toISOString().slice(0, 10);

    // 1. Mapear documentos comerciales de la BD (Ventas/Facturas, Presupuestos, Devoluciones/Notas de Crédito, Remitos, Tickets)
    documents.forEach((doc, idx) => {
      const rawType = String(doc.docType || 'Factura B').trim();
      const rawTypeLower = rawType.toLowerCase();
      const amountNum = Math.abs(parseFloat(String(doc.totalAmount || '0')) || 0);

      // Si el documento no tiene createdAt, distribuir en días recientes para permitir probar filtros de fecha
      let docIso = todayIso;
      if (doc.createdAt) {
        docIso = toIsoDateString(doc.createdAt);
      } else {
        const d = new Date();
        d.setDate(d.getDate() - (idx % 12));
        docIso = d.toISOString().slice(0, 10);
      }

      let movementType: Exclude<MovementCategoryType, 'Todos'> = 'Venta';
      if (rawTypeLower.includes('presupuesto')) {
        movementType = 'Presupuesto';
      } else if (
        rawTypeLower.includes('devolución') ||
        rawTypeLower.includes('devolucion') ||
        rawTypeLower.includes('nota de crédito') ||
        rawTypeLower.includes('nota de credito') ||
        rawTypeLower.includes('nc ')
      ) {
        movementType = 'Devolución/Nota de Crédito';
      } else if (
        rawTypeLower.includes('recibo') ||
        rawTypeLower.includes('pago cta') ||
        rawTypeLower.includes('cobro cta')
      ) {
        movementType = 'Pago Cta. Cte.';
      } else if (rawTypeLower.includes('compra')) {
        movementType = 'Factura de Compra';
      }

      const isPaidStatus =
        doc.status === 'Emitido' ||
        doc.status === 'Entregado' ||
        doc.status === 'Aceptado' ||
        doc.status === 'Cobrado';

      const paymentStatus: UnifiedSalesMovementRecord['paymentStatus'] =
        doc.status === 'Pendiente'
          ? 'Pendiente'
          : isPaidStatus
          ? 'Cobrado'
          : (doc.status as any) || 'Emitido';

      const conceptText =
        movementType === 'Presupuesto'
          ? `Cotización comercial (${doc.itemsCount} ítems)`
          : movementType === 'Devolución/Nota de Crédito'
          ? `Devolución / Nota de Crédito (${doc.itemsCount} ítems)`
          : movementType === 'Pago Cta. Cte.'
          ? `Cobro imputado en Cuenta Corriente`
          : `Venta en mostrador · ${rawType} (${doc.itemsCount} ítems)`;

      records.push({
        id: `DOC-${doc.id}`,
        rawDoc: doc,
        isoDate: docIso,
        formattedDate: formatIsoToArDate(docIso),
        docNumber: doc.docNumber,
        movementType,
        voucherSubType: rawType,
        clientName: doc.clientName || 'Consumidor Final',
        clientCuit: doc.clientCuit || '00-00000000-0',
        concept: conceptText,
        sellerName: doc.sellerName || sellerName,
        paymentStatus,
        statusBadgeLabel: doc.status || 'Emitido',
        amount: amountNum,
        itemsCount: doc.itemsCount || 1,
      });
    });

    // 2. Incorporar Facturas de Compra reales registradas en localStorage
    try {
      const rawPurchases =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('ferreteria_del_puente_purchase_invoices_v2_clean')
          : null;
      const parsedPurchases = rawPurchases ? JSON.parse(rawPurchases) : [];
      if (Array.isArray(parsedPurchases) && parsedPurchases.length > 0) {
        parsedPurchases.forEach((p: any, idx: number) => {
          const iso = toIsoDateString(p.date);
          const totalNum = Math.abs(Number(p.totalAmount || 0));
          const supMatch = suppliers.find((s) => s.name === p.supplierName);
          const syntheticDoc: CommercialDocument = {
            id: 95000 + idx,
            docType: p.invoiceType || 'Factura A Proveedor',
            docNumber: p.invoiceNumber || `FC-A-0005-000${890 + idx}`,
            clientName: p.supplierName || 'Proveedor Ferretero',
            clientCuit: supMatch?.cuit || '30-71009988-1',
            branchName,
            sellerName,
            totalAmount: totalNum.toFixed(2),
            itemsCount: Number(p.itemsCount || 1),
            status: 'Emitido',
            createdAt: iso,
          };
          records.push({
            id: `PUR-${p.id || idx}`,
            rawDoc: syntheticDoc,
            isoDate: iso,
            formattedDate: formatIsoToArDate(iso),
            docNumber: syntheticDoc.docNumber,
            movementType: 'Factura de Compra',
            voucherSubType: p.invoiceType || 'Factura A',
            clientName: syntheticDoc.clientName,
            clientCuit: syntheticDoc.clientCuit,
            concept: `Recepción de Factura de Compra e Ingreso de Stock (${syntheticDoc.itemsCount} ítems)`,
            sellerName,
            paymentStatus: 'Cobrado',
            statusBadgeLabel: 'Registrada',
            amount: totalNum,
            itemsCount: syntheticDoc.itemsCount,
          });
        });
      }
    } catch {
      // ignore
    }

    return records;
  }, [documents, clients, suppliers, branchName, sellerName]);

  // Opciones únicas de Clientes / Entidades para el buscador desplegable
  const clientFilterOptions = useMemo(() => {
    const map = new Map<string, { name: string; cuit: string }>();
    clients.forEach((c) => {
      map.set(c.name.toLowerCase(), { name: c.name, cuit: c.cuit });
    });
    allMovements.forEach((m) => {
      const k = m.clientName.toLowerCase();
      if (!map.has(k)) {
        map.set(k, { name: m.clientName, cuit: m.clientCuit });
      }
    });
    const list = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
    const q = clientFilterQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.cuit.toLowerCase().includes(q)
    );
  }, [clients, allMovements, clientFilterQuery]);

  // Filtrado completo de movimientos
  const filteredMovements = useMemo(() => {
    const filtered = allMovements.filter((rec) => {
      // 1. Filtro por Cliente (por selector o texto de búsqueda CUIT/Nombre)
      if (selectedClientKey !== 'ALL') {
        if (rec.clientName.toLowerCase() !== selectedClientKey.toLowerCase()) {
          return false;
        }
      } else if (clientFilterQuery.trim() !== '') {
        const cq = clientFilterQuery.trim().toLowerCase();
        const matchClient =
          rec.clientName.toLowerCase().includes(cq) ||
          rec.clientCuit.toLowerCase().includes(cq);
        if (!matchClient) return false;
      }

      // 2. Filtro por Rango de Fechas (Desde / Hasta)
      if (dateFrom && rec.isoDate < dateFrom) {
        return false;
      }
      if (dateTo && rec.isoDate > dateTo) {
        return false;
      }

      // 3. Filtro por Tipo de Movimiento
      if (movementTypeFilter !== 'Todos') {
        if (rec.movementType !== movementTypeFilter) {
          return false;
        }
      }

      // 4. Filtro por Estado de Pago / Comprobante
      if (statusOrVoucherFilter !== 'Todos') {
        const subLower = rec.voucherSubType.toLowerCase();
        const badgeLower = rec.statusBadgeLabel.toLowerCase();
        if (statusOrVoucherFilter === 'Factura A') {
          if (!subLower.includes('factura a')) return false;
        } else if (statusOrVoucherFilter === 'Factura B') {
          if (!subLower.includes('factura b')) return false;
        } else if (statusOrVoucherFilter === 'Factura C') {
          if (!subLower.includes('factura c')) return false;
        } else if (statusOrVoucherFilter === 'Remito') {
          if (!subLower.includes('remito')) return false;
        } else if (statusOrVoucherFilter === 'Ticket') {
          if (
            !subLower.includes('ticket') &&
            !subLower.includes('comprobante interno')
          ) {
            return false;
          }
        } else if (statusOrVoucherFilter === 'Cobrado') {
          if (rec.paymentStatus !== 'Cobrado' && badgeLower !== 'emitido') {
            return false;
          }
        } else if (statusOrVoucherFilter === 'Pendiente') {
          if (rec.paymentStatus !== 'Pendiente' && badgeLower !== 'borrador') {
            return false;
          }
        }
      }

      // 5. Buscador global (N° de comprobante, concepto, cliente, CUIT o vendedor)
      if (globalSearch.trim() !== '') {
        const q = globalSearch.trim().toLowerCase();
        const matches =
          rec.docNumber.toLowerCase().includes(q) ||
          rec.concept.toLowerCase().includes(q) ||
          rec.clientName.toLowerCase().includes(q) ||
          rec.clientCuit.toLowerCase().includes(q) ||
          rec.voucherSubType.toLowerCase().includes(q) ||
          rec.sellerName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const cmp = a.isoDate.localeCompare(b.isoDate);
      if (cmp !== 0) {
        return sortDirection === 'desc' ? -cmp : cmp;
      }
      return sortDirection === 'desc'
        ? b.docNumber.localeCompare(a.docNumber)
        : a.docNumber.localeCompare(b.docNumber);
    });
  }, [
    allMovements,
    selectedClientKey,
    clientFilterQuery,
    dateFrom,
    dateTo,
    movementTypeFilter,
    statusOrVoucherFilter,
    globalSearch,
    sortDirection,
  ]);

  // Resumen / Totales Superiores:
  // Suma las ventas/facturas y resta las devoluciones
  const summaryTotals = useMemo(() => {
    let salesTotal = 0;
    let salesCount = 0;
    let returnsTotal = 0;
    let returnsCount = 0;
    let accountPaymentsTotal = 0;
    let accountPaymentsCount = 0;
    let budgetsTotal = 0;
    let budgetsCount = 0;

    filteredMovements.forEach((m) => {
      if (m.movementType === 'Venta') {
        salesTotal += m.amount;
        salesCount += 1;
      } else if (m.movementType === 'Devolución/Nota de Crédito') {
        returnsTotal += m.amount;
        returnsCount += 1;
      } else if (m.movementType === 'Pago Cta. Cte.') {
        accountPaymentsTotal += m.amount;
        accountPaymentsCount += 1;
      } else if (m.movementType === 'Presupuesto') {
        budgetsTotal += m.amount;
        budgetsCount += 1;
      }
    });

    const netFilteredTotal = salesTotal - returnsTotal;

    return {
      netFilteredTotal,
      salesTotal,
      salesCount,
      returnsTotal,
      returnsCount,
      accountPaymentsTotal,
      accountPaymentsCount,
      budgetsTotal,
      budgetsCount,
    };
  }, [filteredMovements]);

  const {
    paginatedItems: paginatedMovements,
    safePage,
  } = useMemo(
    () => paginateArray(filteredMovements, currentPage, pageSize),
    [filteredMovements, currentPage, pageSize]
  );

  const handleClearAllFilters = () => {
    setGlobalSearch('');
    setClientFilterQuery('');
    setSelectedClientKey('ALL');
    setQuickDateRange('all');
    setDateFrom('');
    setDateTo('');
    setMovementTypeFilter('Todos');
    setStatusOrVoucherFilter('Todos');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* TARJETAS SUPERIORES DE RESUMEN / TOTALES FILTRADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* 1. Total Neto Filtrado (Ventas - Devoluciones) */}
        <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
              Total Neto Filtrado (Ventas − Devoluciones)
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FF6600] text-white flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-mono font-black tracking-tight text-white tabular-nums">
              {formatCurrency(summaryTotals.netFilteredTotal)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{filteredMovements.length} movimientos en vista</span>
              <span className="font-mono text-emerald-400">Neto real</span>
            </div>
          </div>
        </div>

        {/* 2. Total Ventas / Facturas (+) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Ventas y Facturas Emitidas (+)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-extrabold text-emerald-700 tabular-nums">
              + {formatCurrency(summaryTotals.salesTotal)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summaryTotals.salesCount} comprobantes de venta
            </div>
          </div>
        </div>

        {/* 3. Total Devoluciones / Notas de Crédito (-) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Devoluciones / Notas de Crédito (−)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-extrabold text-rose-600 tabular-nums">
              − {formatCurrency(summaryTotals.returnsTotal)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summaryTotals.returnsCount} devoluciones descontadas
            </div>
          </div>
        </div>

        {/* 4. Cobros Cuenta Corriente & Presupuestos */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Cobros Cta. Cte. / Presupuestos
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-extrabold text-slate-900 tabular-nums">
              {formatCurrency(summaryTotals.accountPaymentsTotal)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{summaryTotals.accountPaymentsCount} cobros Cta. Cte.</span>
              <span>
                Presup.: {formatCurrency(summaryTotals.budgetsTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE FILTROS PRINCIPALES SUPERIORES */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#FF6600]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Filtros de Movimientos y Comprobantes
            </h3>
          </div>

          {/* Botones de acción rápida hacia las operaciones de Ventas */}
          <div className="flex flex-wrap items-center gap-1.5">
            {onNavigateSection && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateSection('punto-de-venta')}
                  className="px-2.5 py-1 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-[11px] font-bold cursor-pointer"
                >
                  + Nueva Venta
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateSection('nuevo-presupuesto')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  + Nuevo Presupuesto
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateSection('ventas-devoluciones')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  + Nueva Devolución
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
          {/* 1. Buscador Global (N° comprobante o concepto) */}
          <div className="xl:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Buscador Global (Comprobante o Concepto)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ej: FAC-0004, PRE-0004, mostrador..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white"
              />
            </div>
          </div>

          {/* 2. Filtro por Cliente (buscador desplegable o por CUIT/Nombre) */}
          <div className="xl:col-span-3 relative">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filtro por Cliente (CUIT o Nombre)
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={
                  selectedClientKey !== 'ALL'
                    ? selectedClientKey
                    : clientFilterQuery
                }
                onFocus={() => setClientDropdownOpen(true)}
                onChange={(e) => {
                  setSelectedClientKey('ALL');
                  setClientFilterQuery(e.target.value);
                  setClientDropdownOpen(true);
                  setCurrentPage(1);
                }}
                placeholder="Todos los clientes o escribir CUIT/Nombre..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white"
              />
              {(selectedClientKey !== 'ALL' || clientFilterQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientKey('ALL');
                    setClientFilterQuery('');
                    setClientDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Quitar filtro de cliente"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {clientDropdownOpen && (
              <div
                onMouseLeave={() => setClientDropdownOpen(false)}
                className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientKey('ALL');
                    setClientFilterQuery('');
                    setClientDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-3 py-2 font-bold hover:bg-orange-50 cursor-pointer ${
                    selectedClientKey === 'ALL' && !clientFilterQuery
                      ? 'bg-orange-50 text-[#FF6600]'
                      : 'text-slate-700'
                  }`}
                >
                  Todos los Clientes y Entidades
                </button>
                {clientFilterOptions.map((c) => (
                  <button
                    key={`${c.name}-${c.cuit}`}
                    type="button"
                    onClick={() => {
                      setSelectedClientKey(c.name);
                      setClientFilterQuery('');
                      setClientDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer ${
                      selectedClientKey === c.name
                        ? 'bg-orange-50/70 font-bold text-[#FF6600]'
                        : 'text-slate-800'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {c.cuit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Filtro por Tipo de Movimiento */}
          <div className="xl:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Tipo de Movimiento
            </label>
            <select
              value={movementTypeFilter}
              onChange={(e) => {
                setMovementTypeFilter(e.target.value as MovementCategoryType);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#FF6600] cursor-pointer"
            >
              <option value="Todos">Todos los Movimientos</option>
              <option value="Venta">Venta</option>
              <option value="Presupuesto">Presupuesto</option>
              <option value="Devolución/Nota de Crédito">
                Devolución / Nota de Crédito
              </option>
              <option value="Pago Cta. Cte.">Pago Cta. Cte.</option>
              <option value="Factura de Compra">Factura de Compra</option>
            </select>
          </div>

          {/* 4. Filtro por Estado de Pago / Comprobante */}
          <div className="xl:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Estado de Pago / Comprobante
            </label>
            <select
              value={statusOrVoucherFilter}
              onChange={(e) => {
                setStatusOrVoucherFilter(
                  e.target.value as MovementStatusOrDocFilter
                );
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#FF6600] cursor-pointer"
            >
              <option value="Todos">Todos (Comprobantes y Estados)</option>
              <option value="Factura A">Factura A</option>
              <option value="Factura B">Factura B</option>
              <option value="Factura C">Factura C</option>
              <option value="Remito">Remito</option>
              <option value="Ticket">Ticket</option>
              <option value="Cobrado">Cobrado / Emitido</option>
              <option value="Pendiente">Pendiente / Borrador</option>
            </select>
          </div>
        </div>

        {/* 5. Fila de Filtro por Rango de Fechas (Desde / Hasta + Botones Rápidos: Hoy, Esta semana, Este mes) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-[#FF6600]" />
              <span>Rango de Fechas:</span>
            </span>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(
                [
                  { id: 'all' as QuickDateRangeType, label: 'Todos' },
                  { id: 'today' as QuickDateRangeType, label: 'Hoy' },
                  { id: 'week' as QuickDateRangeType, label: 'Esta semana' },
                  { id: 'month' as QuickDateRangeType, label: 'Este mes' },
                ]
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectQuickDate(btn.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    quickDateRange === btn.id
                      ? 'bg-[#FF6600] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">
                Desde:
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setQuickDateRange('custom');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">
                Hasta:
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setQuickDateRange('custom');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLA DE REGISTROS DE MOVIMIENTOS */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#FF6600]" />
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
              Historial de Movimientos Comerciales ({filteredMovements.length})
            </h4>
          </div>

          <button
            type="button"
            onClick={() =>
              setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#FF6600]" />
            <span>
              Orden: {sortDirection === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
            </span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">N° Comprobante</th>
                <th className="py-3 px-4">Tipo de Movimiento</th>
                <th className="py-3 px-4">Comprobante</th>
                <th className="py-3 px-4">Cliente / Entidad</th>
                <th className="py-3 px-4">Concepto / Detalle</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {paginatedMovements.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-slate-500 font-medium"
                  >
                    No se encontraron movimientos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedMovements.map((rec) => {
                  const isReturn =
                    rec.movementType === 'Devolución/Nota de Crédito';
                  const isQuote = rec.movementType === 'Presupuesto';
                  const isAccountPay = rec.movementType === 'Pago Cta. Cte.';
                  const isPurchase = rec.movementType === 'Factura de Compra';

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {rec.formattedDate}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {rec.docNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isReturn
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isQuote
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : isAccountPay
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : isPurchase
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {rec.movementType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {rec.voucherSubType}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {rec.clientName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          CUIT {rec.clientCuit}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px]">
                        <div className="truncate" title={rec.concept}>
                          {rec.concept}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Operador: {rec.sellerName}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge
                          status={rec.statusBadgeLabel}
                          onClick={
                            rec.rawDoc &&
                            onCycleDocStatus &&
                            rec.id.startsWith('DOC-')
                              ? () => onCycleDocStatus(rec.rawDoc!)
                              : undefined
                          }
                          title={
                            rec.id.startsWith('DOC-')
                              ? 'Haga clic para alternar el estado del comprobante'
                              : undefined
                          }
                        />
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-extrabold whitespace-nowrap ${
                          isReturn
                            ? 'text-rose-600'
                            : isQuote
                            ? 'text-indigo-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {isReturn ? '− ' : ''}
                        {formatCurrency(rec.amount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {rec.rawDoc && (
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDocVoucherModal(rec.rawDoc!, 'pdf')
                              }
                              className="p-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white transition-colors cursor-pointer"
                              title="Descargar / Ver PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDocVoucherModal(rec.rawDoc!, 'pdf')
                              }
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white transition-colors cursor-pointer"
                              title="Imprimir Comprobante"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDocVoucherModal(rec.rawDoc!, 'whatsapp')
                              }
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-colors cursor-pointer"
                              title="Enviar por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePaginationBar
          totalItems={filteredMovements.length}
          currentPage={safePage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setCurrentPage(1);
          }}
          itemLabel="movimientos"
        />
      </div>
    </div>
  );
};
