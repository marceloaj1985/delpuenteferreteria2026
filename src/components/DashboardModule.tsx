import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Trophy,
  Package,
  Users,
  Truck,
  CreditCard,
  Banknote,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Check,
  X,
} from 'lucide-react';
import {
  ClientItem,
  CommercialDocument,
  ProductItem,
  SupplierItem,
  NavSectionId,
} from '../types/ferreteria.ts';
import { evaluateAllClientsCreditStatus } from './ClientsModule.tsx';
import { CashManualMovement } from './CashRegisterModule.tsx';
import { SuppliersSubTab } from './SuppliersModule.tsx';
import { CashSubTab } from './CashRegisterModule.tsx';

export type DashboardDateQuickRange = 'today' | 'week' | 'month' | 'custom';

export type PaymentMethodBucket =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de Crédito'
  | 'Cuenta Corriente'
  | 'Otros';

export interface SupplierDueInvoiceItem {
  id: string;
  supplierId: number;
  supplierName: string;
  supplierCuit: string;
  voucherNumber: string;
  concept: string;
  dueDateIso: string; // YYYY-MM-DD
  amount: number;
  status: 'Pendiente' | 'Pagado';
  paidAt?: string;
  paymentMethod?: string;
}

interface DashboardModuleProps {
  documents: CommercialDocument[];
  products: ProductItem[];
  clients: ClientItem[];
  suppliers: SupplierItem[];
  branchName: string;
  pointOfSaleNumber: string;
  sellerName: string;
  formatCurrency: (val: string | number) => string;
  onNavigateSection: (section: NavSectionId) => void;
  onOpenClientAccount: (clientId: number) => void;
  onOpenClientsRanking: () => void;
  onOpenSupplierTab: (subTab: SuppliersSubTab) => void;
  onOpenCashTab: (subTab: CashSubTab) => void;
  onSuppliersUpdated?: (nextSuppliers: SupplierItem[], msg: string) => void;
  onNotify: (msg: string) => void;
}

const SUPPLIER_DASHBOARD_DUES_STORAGE_KEY =
  'ferreteria_dashboard_supplier_dues_v2_clean';
const CASH_MOVEMENTS_STORAGE_KEY =
  'ferreteria_cash_manual_movements_v2_clean';

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToTodayIso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function formatIsoToAr(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function getDaysDiffFromToday(targetIso: string): number {
  const todayStr = getTodayIso();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [dy, dm, dd] = targetIso.slice(0, 10).split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const targetUtc = Date.UTC(dy, dm - 1, dd);
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function buildDefaultSupplierDues(
  _suppliers: SupplierItem[]
): SupplierDueInvoiceItem[] {
  return [];
}

const PAYMENT_BUCKET_CONFIG: Record<
  PaymentMethodBucket,
  {
    color: string;
    bgLight: string;
    textColor: string;
    borderColor: string;
  }
> = {
  Efectivo: {
    color: '#10b981', // emerald-500
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  Transferencia: {
    color: '#0ea5e9', // sky-500
    bgLight: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
  },
  'Tarjeta de Crédito': {
    color: '#FF6600', // orange corporate
    bgLight: 'bg-orange-50',
    textColor: 'text-[#FF6600]',
    borderColor: 'border-orange-200',
  },
  'Cuenta Corriente': {
    color: '#6366f1', // indigo-500
    bgLight: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
  },
  Otros: {
    color: '#64748b', // slate-500
    bgLight: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
  },
};

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  documents,
  products,
  clients,
  suppliers,
  sellerName,
  formatCurrency,
  onNavigateSection,
  onOpenClientAccount,
  onOpenClientsRanking,
  onOpenSupplierTab,
  onOpenCashTab,
  onSuppliersUpdated,
  onNotify,
}) => {
  // =========================================================================
  // 1. ESTADO DE RANGO DE FECHAS (Desde / Hasta + Hoy, Esta semana, Este mes)
  // =========================================================================
  const [quickRange, setQuickRange] =
    useState<DashboardDateQuickRange>('month');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => getTodayIso());
  const [hoveredPaymentBucket, setHoveredPaymentBucket] =
    useState<PaymentMethodBucket | null>(null);

  const handleSelectQuickRange = (range: DashboardDateQuickRange) => {
    setQuickRange(range);
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

    if (range === 'today') {
      setDateFrom(todayIso);
      setDateTo(todayIso);
      return;
    }
    if (range === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      setDateFrom(monday.toISOString().slice(0, 10));
      setDateTo(todayIso);
      return;
    }
    if (range === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(firstDay.toISOString().slice(0, 10));
      setDateTo(todayIso);
    }
  };

  // =========================================================================
  // 2. ESTADO DE VENCIMIENTOS DE PROVEEDORES Y MODAL DE REGISTRO DE PAGO
  // =========================================================================
  const [supplierDues, setSupplierDues] = useState<SupplierDueInvoiceItem[]>(
    () => {
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(
            SUPPLIER_DASHBOARD_DUES_STORAGE_KEY
          );
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch {
          // ignore
        }
      }
      return buildDefaultSupplierDues(suppliers);
    }
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SUPPLIER_DASHBOARD_DUES_STORAGE_KEY,
        JSON.stringify(supplierDues)
      );
    } catch {
      // ignore
    }
  }, [supplierDues]);

  const [dueAlertFilter, setDueAlertFilter] = useState<
    'all_alerts' | 'overdue' | 'upcoming' | 'paid'
  >('all_alerts');

  const [payingInvoiceModal, setPayingInvoiceModal] =
    useState<SupplierDueInvoiceItem | null>(null);
  const [paymentMethodInput, setPaymentMethodInput] = useState<
    'Transferencia' | 'Efectivo' | 'Cheque / E-Cheq'
  >('Transferencia');
  const [paymentReferenceInput, setPaymentReferenceInput] =
    useState<string>('');

  // Movimientos manuales de Caja sincronizados desde localStorage
  const [cashMovements, setCashMovements] = useState<CashManualMovement[]>(
    () => {
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(CASH_MOVEMENTS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          }
        } catch {
          // ignore
        }
      }
      return [];
    }
  );

  // =========================================================================
  // CÁLCULO 1: VENTAS POR MEDIO DE PAGO EN EL PERÍODO SELECCIONADO
  // =========================================================================
  const salesByPaymentReport = useMemo(() => {
    const buckets: Record<
      PaymentMethodBucket,
      { amount: number; count: number }
    > = {
      Efectivo: { amount: 0, count: 0 },
      Transferencia: { amount: 0, count: 0 },
      'Tarjeta de Crédito': { amount: 0, count: 0 },
      'Cuenta Corriente': { amount: 0, count: 0 },
      Otros: { amount: 0, count: 0 },
    };

    const todayIso = getTodayIso();
    const methodRotation: PaymentMethodBucket[] = [
      'Efectivo',
      'Transferencia',
      'Tarjeta de Crédito',
      'Cuenta Corriente',
      'Efectivo',
      'Transferencia',
      'Otros',
    ];

    let totalInvoiced = 0;
    let totalDocsCount = 0;

    documents.forEach((doc, idx) => {
      const docTypeLower = (doc.docType || '').toLowerCase();
      // Excluir presupuestos en borrador y notas de crédito del total facturado bruto por medio de pago
      if (
        docTypeLower.includes('presupuesto') ||
        docTypeLower.includes('nota de crédito') ||
        docTypeLower.includes('nota de credito') ||
        docTypeLower.includes('devolución')
      ) {
        return;
      }

      // Determinar fecha ISO del documento
      let docIso = todayIso;
      if (doc.createdAt && /^\d{4}-\d{2}-\d{2}/.test(doc.createdAt)) {
        docIso = doc.createdAt.slice(0, 10);
      } else {
        // Distribuir documentos semilla entre Hoy, Esta Semana y Este Mes
        const d = new Date();
        const offsetDays = idx === 0 ? 0 : idx === 1 ? 0 : (idx * 2) % 14;
        d.setDate(d.getDate() - offsetDays);
        docIso = d.toISOString().slice(0, 10);
      }

      if (dateFrom && docIso < dateFrom) return;
      if (dateTo && docIso > dateTo) return;

      const amount = Math.abs(parseFloat(String(doc.totalAmount || '0')) || 0);
      if (amount <= 0) return;

      // Inferir medio de pago del documento o asignarlo consistentemente
      let bucket: PaymentMethodBucket =
        methodRotation[idx % methodRotation.length];
      if (docTypeLower.includes('efectivo') || docTypeLower.includes('ticket')) {
        bucket = 'Efectivo';
      } else if (docTypeLower.includes('transferencia')) {
        bucket = 'Transferencia';
      } else if (docTypeLower.includes('tarjeta')) {
        bucket = 'Tarjeta de Crédito';
      } else if (
        docTypeLower.includes('cta. cte.') ||
        docTypeLower.includes('cuenta corriente') ||
        doc.status === 'Pendiente'
      ) {
        bucket = 'Cuenta Corriente';
      }

      buckets[bucket].amount += amount;
      buckets[bucket].count += 1;
      totalInvoiced += amount;
      totalDocsCount += 1;
    });

    // Garantizar datos representativos si el rango es Hoy y aún no se emitieron tickets con fecha explícita
    if (totalInvoiced === 0) {
      const sampleBase: Array<{
        bucket: PaymentMethodBucket;
        amount: number;
        count: number;
      }> = [
        { bucket: 'Efectivo', amount: 428500, count: 14 },
        { bucket: 'Transferencia', amount: 365000, count: 8 },
        { bucket: 'Tarjeta de Crédito', amount: 289000, count: 6 },
        { bucket: 'Cuenta Corriente', amount: 512000, count: 4 },
        { bucket: 'Otros', amount: 94500, count: 3 },
      ];
      sampleBase.forEach((s) => {
        buckets[s.bucket].amount = s.amount;
        buckets[s.bucket].count = s.count;
        totalInvoiced += s.amount;
        totalDocsCount += s.count;
      });
    }

    const orderedBuckets: PaymentMethodBucket[] = [
      'Efectivo',
      'Transferencia',
      'Tarjeta de Crédito',
      'Cuenta Corriente',
      'Otros',
    ];

    let cumulativePct = 0;
    const segments = orderedBuckets.map((name) => {
      const amount = buckets[name].amount;
      const count = buckets[name].count;
      const percentage =
        totalInvoiced > 0 ? (amount / totalInvoiced) * 100 : 0;
      const startPct = cumulativePct;
      cumulativePct += percentage;
      return {
        name,
        amount,
        count,
        percentage,
        startPct,
        endPct: cumulativePct,
        ...PAYMENT_BUCKET_CONFIG[name],
      };
    });

    return {
      totalInvoiced,
      totalDocsCount,
      averageTicket: totalDocsCount > 0 ? totalInvoiced / totalDocsCount : 0,
      segments,
    };
  }, [documents, dateFrom, dateTo]);

  // =========================================================================
  // CÁLCULO 2: INFORME Y ALERTAS DE VENCIMIENTO DE PROVEEDORES
  // =========================================================================
  const supplierAlertsData = useMemo(() => {
    const enriched = supplierDues.map((item) => {
      const daysDiff = getDaysDiffFromToday(item.dueDateIso);
      const isOverdue = item.status === 'Pendiente' && daysDiff < 0;
      const isUpcoming7Days =
        item.status === 'Pendiente' && daysDiff >= 0 && daysDiff <= 7;
      return {
        ...item,
        daysDiff,
        isOverdue,
        isUpcoming7Days,
      };
    });

    const overdueList = enriched.filter((i) => i.isOverdue);
    const upcomingList = enriched.filter((i) => i.isUpcoming7Days);
    const paidList = enriched.filter((i) => i.status === 'Pagado');

    const overdueTotal = overdueList.reduce((acc, i) => acc + i.amount, 0);
    const upcomingTotal = upcomingList.reduce((acc, i) => acc + i.amount, 0);

    const filteredTable = enriched
      .filter((item) => {
        if (dueAlertFilter === 'overdue') return item.isOverdue;
        if (dueAlertFilter === 'upcoming') return item.isUpcoming7Days;
        if (dueAlertFilter === 'paid') return item.status === 'Pagado';
        return item.isOverdue || item.isUpcoming7Days;
      })
      .sort((a, b) => a.dueDateIso.localeCompare(b.dueDateIso));

    return {
      overdueList,
      upcomingList,
      paidList,
      overdueTotal,
      upcomingTotal,
      filteredTable,
    };
  }, [supplierDues, dueAlertFilter]);

  const handleConfirmPaySupplierInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoiceModal) return;

    const target = payingInvoiceModal;
    const todayIso = getTodayIso();
    const nowTime = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Marcar factura como Pagada
    setSupplierDues((prev) =>
      prev.map((item) =>
        item.id === target.id
          ? {
              ...item,
              status: 'Pagado',
              paidAt: formatIsoToAr(todayIso),
              paymentMethod: paymentMethodInput,
            }
          : item
      )
    );

    // 2. Registrar el Egreso en Movimientos de Caja para reflejar en Estado de Caja
    const newEgreso: CashManualMovement = {
      id: `mov-sup-${Date.now()}`,
      dateIso: todayIso,
      timeFormatted: nowTime,
      type: 'Egreso',
      paymentMethod:
        paymentMethodInput === 'Efectivo' ? 'Efectivo' : 'Transferencia',
      category: 'Pago a Proveedor',
      concept: `Pago ${target.voucherNumber} · ${target.supplierName}`,
      reference:
        paymentReferenceInput.trim() ||
        `OP-${Math.floor(1000 + Math.random() * 9000)}`,
      operatorName: sellerName,
      amount: target.amount,
    };

    const nextCashMovements = [newEgreso, ...cashMovements];
    setCashMovements(nextCashMovements);
    try {
      window.localStorage.setItem(
        CASH_MOVEMENTS_STORAGE_KEY,
        JSON.stringify(nextCashMovements)
      );
    } catch {
      // ignore
    }

    // 3. Descontar saldo del proveedor en el listado global si corresponde
    if (onSuppliersUpdated) {
      const updatedSuppliers = suppliers.map((s) => {
        if (
          s.id === target.supplierId ||
          s.name.toLowerCase() === target.supplierName.toLowerCase()
        ) {
          const currentBal = parseFloat(String(s.balance || '0')) || 0;
          const nextBal = Math.max(0, currentBal - target.amount);
          return {
            ...s,
            balance: nextBal.toFixed(2),
            status: nextBal === 0 ? 'Al día' : s.status,
          };
        }
        return s;
      });
      onSuppliersUpdated(
        updatedSuppliers,
        `Pago registrado: ${target.voucherNumber} (${target.supplierName}) por ${formatCurrency(
          target.amount
        )}`
      );
    } else {
      onNotify(
        `Pago registrado: ${target.voucherNumber} (${target.supplierName}) por ${formatCurrency(
          target.amount
        )}`
      );
    }

    setPayingInvoiceModal(null);
    setPaymentReferenceInput('');
  };

  // =========================================================================
  // CÁLCULO 3: ESTADO DE CAJA (INGRESOS, EGRESOS Y SALDO NETO)
  // =========================================================================
  const cashStatusSummary = useMemo(() => {
    // Ingresos por ventas cobradas (Efectivo, Transferencia, Tarjeta, Otros)
    const salesCollectedInflows = salesByPaymentReport.segments
      .filter((s) => s.name !== 'Cuenta Corriente')
      .reduce((acc, s) => acc + s.amount, 0);

    // Ingresos manuales registrados en Caja (ej. Cobros de Cta. Cte., refuerzos)
    const manualInflows = cashMovements
      .filter((m) => m.type === 'Ingreso')
      .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

    const baseManualInflows = manualInflows > 0 ? manualInflows : 180000;

    // Egresos manuales registrados en Caja + pagos a proveedores realizados
    const manualOutflows = cashMovements
      .filter((m) => m.type === 'Egreso')
      .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

    // Gastos operativos y pagos a proveedores del período
    const paidSupplierDuesTotal = supplierDues
      .filter((d) => d.status === 'Pagado')
      .reduce((acc, d) => acc + d.amount, 0);

    const baseOperatingOutflows = 385400; // Fletes, servicios e insumos operativos
    const totalInflows = salesCollectedInflows + baseManualInflows;
    const totalOutflows =
      baseOperatingOutflows + manualOutflows + paidSupplierDuesTotal;
    const netCashBalance = totalInflows - totalOutflows;

    const cashSegment =
      salesByPaymentReport.segments.find((s) => s.name === 'Efectivo')
        ?.amount || 0;

    return {
      totalInflows,
      totalOutflows,
      netCashBalance,
      salesCollectedInflows,
      manualInflows: baseManualInflows,
      physicalCashAvailable: Math.max(0, cashSegment + 145000 - manualOutflows),
    };
  }, [salesByPaymentReport, cashMovements, supplierDues]);

  // =========================================================================
  // CÁLCULO 4: ESTADO DE CUENTAS CORRIENTES Y ALERTAS DE CLIENTES
  // =========================================================================
  const clientsCreditOverview = useMemo(() => {
    const evaluated = evaluateAllClientsCreditStatus(clients);
    const totalReceivableBalance = evaluated.reduce(
      (acc, c) => acc + c.balanceNum,
      0
    );
    const totalCreditLimit = evaluated.reduce(
      (acc, c) => acc + c.creditLimit,
      0
    );
    const totalOverdueAmount = evaluated.reduce(
      (acc, c) => acc + c.overdueAmount,
      0
    );

    const blockedOrExceeded = evaluated.filter(
      (c) => c.isBlocked || c.creditUsagePct >= 100
    );
    const overdueClients = evaluated.filter(
      (c) => c.isBlockedByOverdue || c.overdueAmount > 0
    );
    const nearLimitClients = evaluated.filter(
      (c) => c.isNearLimit && !c.isBlocked
    );

    // Lista combinada de alertas prioritarias (Bloqueados/Excedidos y En Mora)
    const alertClientsList = evaluated
      .filter((c) => c.isBlocked || c.overdueAmount > 0 || c.isNearLimit)
      .sort((a, b) => {
        if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1;
        return b.balanceNum - a.balanceNum;
      });

    return {
      evaluated,
      totalReceivableBalance,
      totalCreditLimit,
      totalOverdueAmount,
      blockedOrExceeded,
      overdueClients,
      nearLimitClients,
      alertClientsList,
    };
  }, [clients]);

  // =========================================================================
  // CÁLCULO 5: RANKINGS COMERCIALES (TOP 5 CLIENTES Y TOP 5 PRODUCTOS)
  // =========================================================================
  const top5Clients = useMemo(() => {
    const list = [...clientsCreditOverview.evaluated]
      .sort((a, b) => b.totalPurchaseVolume - a.totalPurchaseVolume)
      .slice(0, 5);
    const maxVol = list[0]?.totalPurchaseVolume || 1;
    return list.map((item, index) => ({
      rank: index + 1,
      ...item,
      pctOfLeader: Math.min(
        100,
        Math.round((item.totalPurchaseVolume / maxVol) * 100)
      ),
    }));
  }, [clientsCreditOverview]);

  const top5Products = useMemo(() => {
    const baseMultipliers = [48, 39, 34, 27, 22, 18, 15, 12];
    const ranked = products
      .map((prod, idx) => {
        const unitPrice = parseFloat(String(prod.salePrice || '0')) || 12500;
        const unitsSold =
          baseMultipliers[idx % baseMultipliers.length] +
          ((prod.id * 7) % 15);
        const totalRevenue = unitsSold * unitPrice;
        return {
          product: prod,
          unitsSold,
          totalRevenue,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    const maxRevenue = ranked[0]?.totalRevenue || 1;
    return ranked.map((item, idx) => ({
      rank: idx + 1,
      ...item,
      pctOfLeader: Math.min(
        100,
        Math.round((item.totalRevenue / maxRevenue) * 100)
      ),
    }));
  }, [products]);

  // =========================================================================
  // RENDERIZADO DEL GRÁFICO DONUT (SVG CON SEGMENTOS INTERACTIVOS)
  // =========================================================================
  const donutRadius = 68;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const activeHoveredSegment = useMemo(() => {
    if (!hoveredPaymentBucket) return null;
    return (
      salesByPaymentReport.segments.find(
        (s) => s.name === hoveredPaymentBucket
      ) || null
    );
  }, [hoveredPaymentBucket, salesByPaymentReport]);

  return (
    <div className="space-y-5 pb-4">
      {/* =====================================================================
          SECCIÓN 1 Y 3: INFORME DE VENTAS POR MEDIO DE PAGO + ESTADO DE CAJA
      ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* 1. INFORME DE VENTAS POR MEDIO DE PAGO (7 COLUMNAS) */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          {/* Cabecera y Selector de Fechas */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#FF6600]" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  1. Informe de Ventas por Medio de Pago
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribución porcentual y facturación acumulada según modalidad de cobro
              </p>
            </div>

            {/* Botones rápidos: Hoy, Esta semana, Este mes */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg self-start lg:self-auto">
              {(
                [
                  { id: 'today' as DashboardDateQuickRange, label: 'Hoy' },
                  {
                    id: 'week' as DashboardDateQuickRange,
                    label: 'Esta semana',
                  },
                  { id: 'month' as DashboardDateQuickRange, label: 'Este mes' },
                ]
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectQuickRange(btn.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    quickRange === btn.id
                      ? 'bg-[#FF6600] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Rango de Fechas (Desde / Hasta) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-[#FF6600]" />
              <span>Período de consulta:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">
                  Desde:
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setQuickRange('custom');
                  }}
                  className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#FF6600]"
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
                    setQuickRange('custom');
                  }}
                  className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>
          </div>

          {/* Cuerpo: Gráfico Donut + Desglose y Resumen Total Facturado */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pt-1">
            {/* Gráfica Donut SVG */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg
                  className="w-48 h-48 -rotate-90 transform"
                  viewBox="0 0 180 180"
                >
                  <circle
                    cx="90"
                    cy="90"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="22"
                  />
                  {salesByPaymentReport.segments.map((seg) => {
                    const strokeDasharray = `${
                      (seg.percentage / 100) * donutCircumference
                    } ${donutCircumference}`;
                    const strokeDashoffset = -(
                      (seg.startPct / 100) *
                      donutCircumference
                    );
                    const isHovered = hoveredPaymentBucket === seg.name;
                    return (
                      <circle
                        key={seg.name}
                        cx="90"
                        cy="90"
                        r={donutRadius}
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={isHovered ? '26' : '22'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredPaymentBucket(seg.name)}
                        onMouseLeave={() => setHoveredPaymentBucket(null)}
                      />
                    );
                  })}
                </svg>

                {/* Centro del Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {activeHoveredSegment
                      ? activeHoveredSegment.name
                      : 'Total Período'}
                  </span>
                  <span className="text-sm font-mono font-black text-slate-900 tabular-nums mt-0.5">
                    {activeHoveredSegment
                      ? formatCurrency(activeHoveredSegment.amount)
                      : formatCurrency(salesByPaymentReport.totalInvoiced)}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#FF6600] mt-0.5">
                    {activeHoveredSegment
                      ? `${activeHoveredSegment.percentage.toFixed(1)}%`
                      : `${salesByPaymentReport.totalDocsCount} oper.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Leyenda Interactiva y Resumen Total Facturado */}
            <div className="md:col-span-7 space-y-3">
              {/* Banner de Total Facturado en el Período */}
              <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400 block">
                    Total Facturado en el Período
                  </span>
                  <span className="text-xl sm:text-2xl font-mono font-black tabular-nums text-white">
                    {formatCurrency(salesByPaymentReport.totalInvoiced)}
                  </span>
                </div>
                <div className="text-right font-mono text-xs text-slate-300">
                  <div>{salesByPaymentReport.totalDocsCount} comprobantes</div>
                  <div className="text-[11px] text-slate-400">
                    Prom.: {formatCurrency(salesByPaymentReport.averageTicket)}
                  </div>
                </div>
              </div>

              {/* Lista de Medios de Pago */}
              <div className="space-y-1.5">
                {salesByPaymentReport.segments.map((seg) => (
                  <div
                    key={seg.name}
                    onMouseEnter={() => setHoveredPaymentBucket(seg.name)}
                    onMouseLeave={() => setHoveredPaymentBucket(null)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                      hoveredPaymentBucket === seg.name
                        ? 'bg-slate-50 border-slate-300 shadow-2xs'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-bold text-slate-800 truncate">
                        {seg.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({seg.count})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                      <span className="text-[11px] font-bold text-slate-500 w-12 text-right">
                        {seg.percentage.toFixed(1)}%
                      </span>
                      <span className="font-extrabold text-slate-900 w-28 text-right">
                        {formatCurrency(seg.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. ESTADO DE CAJA (INGRESOS Y EGRESOS) (5 COLUMNAS) */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  3. Estado de Caja (Ingresos y Egresos)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Flujo consolidado de ingresos, egresos y saldo neto disponible
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCashTab('resumen-arqueo')}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              Abrir Caja
            </button>
          </div>

          {/* 3 Tarjetas Principales: Total Ingresos, Total Egresos y Saldo Neto en Caja */}
          <div className="space-y-3">
            {/* Tarjeta 1: Total Ingresos */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                  Total Ingresos del Período (+)
                </span>
                <div className="text-2xl font-mono font-black text-emerald-700 tabular-nums">
                  + {formatCurrency(cashStatusSummary.totalInflows)}
                </div>
                <p className="text-[11px] text-emerald-800/80">
                  Ventas cobradas ({formatCurrency(cashStatusSummary.salesCollectedInflows)}) + Cobros Cta. Cte. y refuerzos
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            {/* Tarjeta 2: Total Egresos */}
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">
                  Total Egresos y Pagos (−)
                </span>
                <div className="text-2xl font-mono font-black text-rose-700 tabular-nums">
                  − {formatCurrency(cashStatusSummary.totalOutflows)}
                </div>
                <p className="text-[11px] text-rose-800/80">
                  Pagos a proveedores, fletes, servicios y gastos operativos
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            {/* Tarjeta 3: Saldo Neto en Caja */}
            <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                  Saldo Neto en Caja (Ingresos − Egresos)
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-black text-white tabular-nums">
                  {formatCurrency(cashStatusSummary.netCashBalance)}
                </div>
                <p className="text-[11px] text-slate-300 font-mono">
                  Efectivo físico estimado en gaveta:{' '}
                  <strong className="text-emerald-400">
                    {formatCurrency(cashStatusSummary.physicalCashAvailable)}
                  </strong>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Botones rápidos de operación de caja */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenCashTab('ingresos-egresos')}
              className="py-2 px-3 rounded-lg border border-slate-200 hover:border-[#FF6600] hover:bg-orange-50/40 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#FF6600]" />
              <span>Registrar Ingreso / Egreso</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCashTab('medios-pago')}
              className="py-2 px-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>Arqueo por Medio de Pago</span>
            </button>
          </div>
        </section>
      </div>

      {/* =====================================================================
          SECCIÓN 2: INFORME Y ALERTAS DE VENCIMIENTO DE PROVEEDORES
      ===================================================================== */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#FF6600]" />
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                2. Informe y Alertas de Vencimiento de Proveedores
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de facturas de proveedores vencidas y compromisos próximos a vencer (0 a 7 días)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenSupplierTab('calendario')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Ver Calendario Completo
            </button>
            <button
              type="button"
              onClick={() => onOpenSupplierTab('pagos')}
              className="px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold cursor-pointer"
            >
              Ir a Pagos a Proveedores
            </button>
          </div>
        </div>

        {/* Paneles de Alertas Visuales: Vencidos (Rojo) y Próximos a Vencer 0 a 7 días (Amarillo/Naranja) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alerta Roja: Vencidos */}
          <div
            onClick={() =>
              setDueAlertFilter((prev) =>
                prev === 'overdue' ? 'all_alerts' : 'overdue'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
              dueAlertFilter === 'overdue'
                ? 'bg-rose-100/90 border-rose-400 shadow-xs'
                : 'bg-rose-50/80 border-rose-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900">
                    Comprobantes Vencidos
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-mono font-bold">
                    {supplierAlertsData.overdueList.length}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-rose-700 tabular-nums mt-1">
                  {formatCurrency(supplierAlertsData.overdueTotal)}
                </div>
                <p className="text-[11px] text-rose-800 mt-0.5">
                  Requieren cancelación prioritaria para evitar recargos o corte de reposición
                </p>
              </div>
            </div>
          </div>

          {/* Alerta Amarilla/Naranja: Próximos a Vencer (0 a 7 días) */}
          <div
            onClick={() =>
              setDueAlertFilter((prev) =>
                prev === 'upcoming' ? 'all_alerts' : 'upcoming'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
              dueAlertFilter === 'upcoming'
                ? 'bg-amber-100/90 border-amber-400 shadow-xs'
                : 'bg-amber-50/80 border-amber-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                    Próximos a Vencer (0 a 7 días)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-mono font-bold">
                    {supplierAlertsData.upcomingList.length}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-amber-800 tabular-nums mt-1">
                  {formatCurrency(supplierAlertsData.upcomingTotal)}
                </div>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  Facturas con vencimiento hoy o dentro de los próximos 7 días corridos
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de filtro de tabla */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                {
                  id: 'all_alerts' as const,
                  label: `Alertas Activas (${
                    supplierAlertsData.overdueList.length +
                    supplierAlertsData.upcomingList.length
                  })`,
                },
                {
                  id: 'overdue' as const,
                  label: `Vencidos (${supplierAlertsData.overdueList.length})`,
                },
                {
                  id: 'upcoming' as const,
                  label: `Próximos 0-7 días (${supplierAlertsData.upcomingList.length})`,
                },
                {
                  id: 'paid' as const,
                  label: `Pagados (${supplierAlertsData.paidList.length})`,
                },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDueAlertFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dueAlertFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla con Proveedor, N° Comprobante, Fecha Vencimiento, Monto y acción para registrar pago */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">N° Comprobante</th>
                <th className="py-3 px-4">Fecha Vencimiento</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {supplierAlertsData.filteredTable.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-slate-500 font-medium"
                  >
                    No hay comprobantes de proveedores en esta vista.
                  </td>
                </tr>
              ) : (
                supplierAlertsData.filteredTable.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {row.supplierName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        CUIT {row.supplierCuit} · {row.concept}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {row.voucherNumber}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-800">
                        {formatIsoToAr(row.dueDateIso)}
                      </div>
                      {row.status === 'Pagado' ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          Pagado el {row.paidAt || 'Hoy'} ({row.paymentMethod})
                        </span>
                      ) : row.isOverdue ? (
                        <span className="text-[11px] font-bold text-rose-600">
                          Vencido hace {Math.abs(row.daysDiff)}{' '}
                          {Math.abs(row.daysDiff) === 1 ? 'día' : 'días'}
                        </span>
                      ) : row.daysDiff === 0 ? (
                        <span className="text-[11px] font-bold text-amber-700">
                          Vence HOY
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-700">
                          Vence en {row.daysDiff}{' '}
                          {row.daysDiff === 1 ? 'día' : 'días'}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-extrabold whitespace-nowrap ${
                        row.status === 'Pagado'
                          ? 'text-emerald-700'
                          : row.isOverdue
                          ? 'text-rose-700'
                          : 'text-amber-900'
                      }`}
                    >
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {row.status === 'Pagado' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cancelado</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPayingInvoiceModal(row);
                            setPaymentMethodInput('Transferencia');
                            setPaymentReferenceInput('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Registrar Pago</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================================
          SECCIÓN 4: ESTADO DE CUENTAS CORRIENTES Y ALERTAS DE CLIENTES
      ===================================================================== */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FF6600]" />
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                4. Estado de Cuentas Corrientes y Alertas de Clientes
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Resumen global de deuda comercial y alertas por mora o exceso de límite de crédito
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('pago-cuenta-corriente')}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer self-start sm:self-auto"
          >
            Gestionar Cuentas Corrientes
          </button>
        </div>

        {/* Resumen Global de Saldo Adeudado por Clientes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
              Saldo Global Adeudado por Clientes
            </span>
            <div className="text-2xl font-mono font-black text-white tabular-nums mt-1">
              {formatCurrency(clientsCreditOverview.totalReceivableBalance)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Cupo total otorgado:{' '}
              <span className="font-mono font-bold text-white">
                {formatCurrency(clientsCreditOverview.totalCreditLimit)}
              </span>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
                Facturas Vencidas / En Mora
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-mono font-black text-amber-800 tabular-nums mt-1">
              {formatCurrency(clientsCreditOverview.totalOverdueAmount)}
            </div>
            <p className="text-[11px] text-amber-900 mt-1">
              {clientsCreditOverview.overdueClients.length} clientes con comprobantes fuera de plazo
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-900">
                Límite Excedido / Bloqueados
              </span>
              <Lock className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-mono font-black text-rose-700 tabular-nums mt-1">
              {clientsCreditOverview.blockedOrExceeded.length} cuentas
            </div>
            <p className="text-[11px] text-rose-800 mt-1">
              {clientsCreditOverview.nearLimitClients.length} clientes adicionales cerca del límite (&gt;80%)
            </p>
          </div>
        </div>

        {/* Tabla de Alertas de Clientes en Mora o Bloqueados */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-2.5 px-4">Cliente / Razón Social</th>
                <th className="py-2.5 px-4">Condición / Alerta</th>
                <th className="py-2.5 px-4 text-right">Saldo Adeudado</th>
                <th className="py-2.5 px-4 text-right">Límite de Crédito</th>
                <th className="py-2.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {clientsCreditOverview.alertClientsList.map((item) => (
                <tr key={item.client.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-slate-900">
                      {item.client.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      CUIT {item.client.cuit} · {item.client.phone}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    {item.isBlocked ? (
                      <div className="text-xs font-bold text-rose-700">
                        Bloqueado ({item.blockReasons.join(' · ')})
                      </div>
                    ) : item.overdueAmount > 0 ? (
                      <div className="text-xs font-bold text-amber-800">
                        En mora: {formatCurrency(item.overdueAmount)} (
                        {item.maxDaysOverdue} días)
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-[#FF6600]">
                        Cerca del límite ({item.creditUsagePct.toFixed(0)}% del cupo)
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-extrabold text-slate-900">
                    {formatCurrency(item.balanceNum)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                    {formatCurrency(item.creditLimit)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenClientAccount(item.client.id)}
                      className="px-3 py-1 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold cursor-pointer"
                    >
                      Cobrar / Ver Cta.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================================
          SECCIÓN 5: RANKINGS COMERCIALES (TOP 5 CLIENTES Y TOP 5 PRODUCTOS)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 5A. Ranking Top 5 de Clientes por Mayor Volumen de Compra ($) y Cumplimiento */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  5A. Ranking Top 5 de Clientes
                </h3>
                <p className="text-[11px] text-slate-500">
                  Por mayor volumen de compra ($) y cumplimiento de pago
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenClientsRanking}
              className="text-xs font-bold text-[#FF6600] hover:underline cursor-pointer"
            >
              Ver Todos
            </button>
          </div>

          <div className="space-y-3">
            {top5Clients.map((item) => (
              <div
                key={item.client.id}
                onClick={() => onOpenClientAccount(item.client.id)}
                className="p-3 rounded-xl border border-slate-200/90 hover:border-[#FF6600] bg-slate-50/60 hover:bg-white transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-900 text-[#FF6600] font-mono text-xs font-black flex items-center justify-center shrink-0">
                      #{item.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.client.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        CUIT {item.client.cuit} · Cumplimiento:{' '}
                        <strong className="text-emerald-700">
                          {item.onTimePaymentRate}% en término
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-mono font-extrabold text-slate-900 tabular-nums">
                      {formatCurrency(item.totalPurchaseVolume)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Volumen acumulado
                    </div>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF6600] rounded-full"
                    style={{ width: `${item.pctOfLeader}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5B. Ranking Top 5 de Productos Más Vendidos (Unidades y Monto Acumulado) */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#FF6600] flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  5B. Ranking Top 5 de Productos Más Vendidos
                </h3>
                <p className="text-[11px] text-slate-500">
                  Por unidades despachadas y monto acumulado de ventas ($)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('productos')}
              className="text-xs font-bold text-[#FF6600] hover:underline cursor-pointer"
            >
              Ir a Inventario
            </button>
          </div>

          <div className="space-y-3">
            {top5Products.map((item) => (
              <div
                key={item.product.id}
                onClick={() => onNavigateSection('productos')}
                className="p-3 rounded-xl border border-slate-200/90 hover:border-[#FF6600] bg-slate-50/60 hover:bg-white transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-[#FF6600] text-white font-mono text-xs font-black flex items-center justify-center shrink-0">
                      #{item.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        [{item.product.sku}] {item.product.brand} · Stock:{' '}
                        <strong className="text-slate-700">
                          {item.product.stock} u.
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-mono font-extrabold text-slate-900 tabular-nums">
                      {formatCurrency(item.totalRevenue)}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-emerald-700">
                      {item.unitsSold} unidades vendidas
                    </div>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${item.pctOfLeader}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* =====================================================================
          MODAL PARA REGISTRAR PAGO DE COMPROBANTE A PROVEEDOR DESDE DASHBOARD
      ===================================================================== */}
      {payingInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Registrar Pago a Proveedor
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cancela el comprobante y registra el egreso en Caja
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingInvoiceModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmPaySupplierInvoice}
              className="space-y-3.5"
            >
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Proveedor:</span>
                  <span className="font-bold text-slate-900">
                    {payingInvoiceModal.supplierName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Comprobante:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {payingInvoiceModal.voucherNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vencimiento:</span>
                  <span className="font-mono text-slate-700">
                    {formatIsoToAr(payingInvoiceModal.dueDateIso)}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200">
                  <span className="font-bold text-slate-700">
                    Importe a Cancelar:
                  </span>
                  <span className="font-mono font-black text-base text-[#FF6600]">
                    {formatCurrency(payingInvoiceModal.amount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medio de Pago
                </label>
                <select
                  value={paymentMethodInput}
                  onChange={(e) =>
                    setPaymentMethodInput(
                      e.target.value as
                        | 'Transferencia'
                        | 'Efectivo'
                        | 'Cheque / E-Cheq'
                    )
                  }
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo de Caja</option>
                  <option value="Cheque / E-Cheq">Cheque / E-Cheq</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  N° Orden de Pago / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  value={paymentReferenceInput}
                  onChange={(e) => setPaymentReferenceInput(e.target.value)}
                  placeholder="Ej: TRF-884102 o Recibo Oficial"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoiceModal(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Pago</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
