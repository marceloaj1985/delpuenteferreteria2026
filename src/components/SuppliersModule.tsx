import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  X,
  ShoppingCart,
  AlertTriangle,
  AlertCircle,
  Columns3,
  Check,
  CreditCard,
  RotateCcw,
  History,
  Trash2,
  CalendarClock,
  FileText,
  Receipt,
  Minus,
  Calendar,
  ClipboardList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  Download,
  MessageCircle,
  Upload,
  Paperclip,
  Image as ImageIcon,
  Share2,
  Camera,
  Link2,
  Copy,
  Repeat,
  Wallet,
  Calculator,
  Percent,
  Tag,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ProductItem,
  SupplierItem,
  ExpenseCategoryType,
  ExpenseRecurrenceFrequency,
  TreasuryAccount,
  CashflowEntry,
} from '../types/ferreteria.ts';
import {
  loadProductExtendedMetaMap,
  saveProductExtendedMeta,
} from './ProductsModule.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import {
  OrdersModule,
  PurchaseOrderRecord,
  SupplierDueInstallment,
  VoucherDocumentData,
  VoucherActionModal,
  addDaysToTodayIso,
  formatIsoToAr,
  getDaysDiffFromToday,
  getTodayIso,
  downloadVoucherDocument,
  buildDirectWhatsAppUrl,
  buildVoucherHtmlContent,
  EXPENSE_CATEGORIES,
  DEFAULT_TREASURY_ACCOUNTS,
  computeNextRecurringDueDate,
} from './OrdersModule.tsx';
import {
  TablePaginationBar,
  PageSizeOption,
  paginateArray,
} from './TablePaginationBar.tsx';

const SUPPLIER_CARTS_BY_ID_STORAGE_KEY =
  'ferreteria_supplier_persistent_carts_by_id_v1';
const SUPPLIER_NOTES_BY_ID_STORAGE_KEY =
  'ferreteria_supplier_persistent_notes_by_id_v1';
const SCANNER_SUPPLIER_CARTS_STORAGE_KEY =
  'ferreteria_scanner_supplier_carts_v1';

export type SuppliersSubTab =
  | 'listado'
  | 'calendario'
  | 'gestion-pedidos'
  | 'historial-operaciones'
  | 'pedidos'
  | 'pagos'
  | 'devoluciones';

interface SuppliersModuleProps {
  suppliers: SupplierItem[];
  products: ProductItem[];
  onOpenBulkImport: () => void;
  onSuppliersUpdated: (newSuppliers: SupplierItem[], message: string) => void;
  onProductsUpdated: (newProducts: ProductItem[], message: string) => void;
  formatCurrency: (val: string | number) => string;
  initialSubTab?: SuppliersSubTab;
}

type SupplierColumnKey =
  | 'name'
  | 'balance'
  | 'nextDueDate'
  | 'cuit'
  | 'contactPhone'
  | 'email'
  | 'status';

interface SupplierColDef {
  key: SupplierColumnKey;
  label: string;
  align?: 'left' | 'right' | 'center';
}

const ALL_SUPPLIER_COLUMNS: SupplierColDef[] = [
  { key: 'name', label: 'Proveedor', align: 'left' },
  { key: 'balance', label: 'Saldo Cuenta Corriente', align: 'right' },
  { key: 'nextDueDate', label: 'Próximo Vencimiento', align: 'left' },
  { key: 'cuit', label: 'CUIT', align: 'left' },
  { key: 'contactPhone', label: 'Teléfono', align: 'left' },
  { key: 'email', label: 'Email', align: 'left' },
  { key: 'status', label: 'Estado Cuenta Corriente', align: 'left' },
];

type OrderProductColumnKey =
  | 'sku'
  | 'name'
  | 'stock'
  | 'minStock'
  | 'costPrice'
  | 'category';

const ALL_ORDER_PRODUCT_COLUMNS: {
  key: OrderProductColumnKey;
  label: string;
  align?: 'left' | 'right';
}[] = [
  { key: 'sku', label: 'Código', align: 'left' },
  { key: 'name', label: 'Descripción', align: 'left' },
  { key: 'stock', label: 'Stock', align: 'right' },
  { key: 'minStock', label: 'Stock Mínimo', align: 'right' },
  { key: 'costPrice', label: 'Costo Unit.', align: 'right' },
  { key: 'category', label: 'Categoría', align: 'left' },
];

type ReturnProductColumnKey =
  | 'sku'
  | 'name'
  | 'stock'
  | 'costPrice'
  | 'category';

const ALL_RETURN_PRODUCT_COLUMNS: {
  key: ReturnProductColumnKey;
  label: string;
  align?: 'left' | 'right';
}[] = [
  { key: 'sku', label: 'Código', align: 'left' },
  { key: 'name', label: 'Descripción', align: 'left' },
  { key: 'stock', label: 'Stock Actual', align: 'right' },
  { key: 'costPrice', label: 'Precio Costo', align: 'right' },
  { key: 'category', label: 'Categoría', align: 'left' },
];

interface OrderCartItem {
  productId: number;
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  quantity: number;
  unitCost: number;
}

interface ReturnCartItem {
  productId: number;
  sku: string;
  name: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
}

export interface SupplierReturnHistoryEntry {
  id: string;
  docNumber: string;
  date: string;
  isoDate: string;
  supplierId: number;
  supplierName: string;
  reason: string;
  notes: string;
  totalCredit: number;
  status: string;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
  }[];
}

export interface SupplierPaymentHistoryEntry {
  id: string;
  receiptNumber: string;
  date: string;
  isoDate: string;
  supplierId?: number;
  supplierName: string;
  paymentMethod: string;
  amount: number;
  status: string;
  note: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf';
}

const RETURN_REASONS = [
  'Producto Defectuoso / Fallado',
  'Envío Incorrecto',
  'Mercadería Rompida / Dañada',
  'Vencimiento',
  'Ajuste de Stock / Sobrante',
];

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({
  suppliers,
  products,
  onOpenBulkImport,
  onSuppliersUpdated,
  onProductsUpdated,
  formatCurrency,
  initialSubTab = 'listado',
}) => {
  const [activeSubTab, setActiveSubTab] =
    useState<SuppliersSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // =========================================================================
  // 1. ESTADO DEL LISTADO DE PROVEEDORES Y ALERTAS DE VENCIMIENTO
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierQuickFilter, setSelectedSupplierQuickFilter] =
    useState('Todos');
  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Columnas visibles por defecto en la tabla de proveedores:
  // 1) "Proveedor", 2) "Saldo Cuenta Corriente", 3) "Próximo Vencimiento"
  const [visibleSupplierCols, setVisibleSupplierCols] = useState<
    Record<SupplierColumnKey, boolean>
  >({
    name: true,
    balance: true,
    nextDueDate: true,
    cuit: false,
    contactPhone: false,
    email: false,
    status: false,
  });
  const [supplierColsOpen, setSupplierColsOpen] = useState(false);
  const supplierColsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        supplierColsRef.current &&
        !supplierColsRef.current.contains(e.target as Node)
      ) {
        setSupplierColsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    cuit: '30-71500912-3',
    contactPhone: '+54 11 4500-1200',
    email: 'ventas@distribuidoraferretera.com.ar',
    category: 'Herramientas y Bulonería',
    balance: '0.00',
    status: 'Al día',
  });

  // Ordenamiento interactivo y paginación configurable en tabla de Proveedores (Sort A-Z / 0-9)
  const [supplierSort, setSupplierSort] = useState<{
    key: SupplierColumnKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'name',
    direction: 'asc',
  });
  const [supplierPage, setSupplierPage] = useState<number>(1);
  const [supplierPageSize, setSupplierPageSize] = useState<PageSizeOption>(20);

  const handleSortSupplierCol = (key: SupplierColumnKey) => {
    setSupplierSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  useEffect(() => {
    setSupplierPage(1);
  }, [searchQuery, selectedSupplierQuickFilter]);

  // Generador de imagen SVG de ejemplo para boletas adjuntas iniciales
  const buildSampleInvoiceSvgDataUrl = (
    docRef: string,
    supplierName: string,
    amountFormatted: string,
    dueStr: string
  ) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460" viewBox="0 0 720 460">
      <rect width="720" height="460" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="12"/>
      <rect x="24" y="24" width="672" height="84" fill="#0f172a" rx="8"/>
      <text x="44" y="58" fill="#FF6600" font-family="monospace" font-size="18" font-weight="bold">FACTURA ORIGINAL · ${docRef}</text>
      <text x="44" y="84" fill="#e2e8f0" font-family="sans-serif" font-size="14">${supplierName}</text>
      <rect x="570" y="38" width="106" height="54" fill="#1e293b" stroke="#FF6600" stroke-width="1.5" rx="6"/>
      <text x="623" y="62" fill="#ffffff" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">FC-A</text>
      <text x="623" y="80" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">IVA RESP. INSC.</text>
      <text x="44" y="142" fill="#475569" font-family="sans-serif" font-size="13" font-weight="bold">CLIENTE: FERRETERIA DEL PUENTE (CUIT: 30-71649208-9)</text>
      <text x="44" y="166" fill="#64748b" font-family="monospace" font-size="12">CONDICIÓN DE VENTA: CUENTA CORRIENTE · VENCIMIENTO: ${dueStr}</text>
      <line x1="44" y1="186" x2="676" y2="186" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="44" y="214" fill="#0f172a" font-family="monospace" font-size="12" font-weight="bold">CANT.   DESCRIPCIÓN DE MERCADERÍA / LOTE FERRETERO                      SUBTOTAL</text>
      <line x1="44" y1="226" x2="676" y2="226" stroke="#e2e8f0" stroke-width="1"/>
      <text x="44" y="254" fill="#334155" font-family="monospace" font-size="12">1 LOTE  Provisión según remito conformado en depósito central        ${amountFormatted}</text>
      <text x="44" y="282" fill="#64748b" font-family="monospace" font-size="11">        Comprobante digitalizado y auditado por Administración</text>
      <rect x="400" y="340" width="276" height="76" fill="#0f172a" rx="8"/>
      <text x="420" y="368" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="bold">TOTAL COMPROBANTE (ARS)</text>
      <text x="420" y="398" fill="#FF6600" font-family="monospace" font-size="22" font-weight="bold">${amountFormatted}</text>
      <text x="44" y="390" fill="#64748b" font-family="monospace" font-size="11">CAE AFIP: 74192038471920 · Boleta Adjunta Verificada</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  // Estado de Cajas Chicas / Cuentas Bancarias y Reporte de Flujo de Caja (Cashflow)
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>(
    () => DEFAULT_TREASURY_ACCOUNTS
  );
  const [cashflowTransactions, setCashflowTransactions] = useState<
    CashflowEntry[]
  >(() => []);

  // Estado del Calendario de Vencimientos (compromisos, proveedores y gastos generales/operativos)
  const [installments, setInstallments] = useState<SupplierDueInstallment[]>(
    () => []
  );

  // Estado de Gestión General de Pedidos de Todos los Proveedores
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>(
    () => []
  );

  // Cálculo de Próximo Vencimiento y alertas sincronizado con los compromisos del calendario y el saldo del proveedor
  const getSupplierDueInfo = (sup: SupplierItem) => {
    const bal = parseFloat(String(sup.balance || '0')) || 0;
    const activeInsts = installments
      .filter(
        (i) =>
          (i.supplierId === sup.id || i.supplierName === sup.name) &&
          i.status !== 'Saldado' &&
          i.totalAmount - i.paidAmount > 0.01
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (activeInsts.length > 0) {
      const nextInst = activeInsts[0];
      const daysRemaining = getDaysDiffFromToday(nextInst.dueDate);
      const formattedDate = formatIsoToAr(nextInst.dueDate);
      const invoiceRef = nextInst.docRef;

      if (daysRemaining < 0) {
        return {
          hasDue: true,
          daysRemaining,
          isoDate: nextInst.dueDate,
          formattedDate,
          invoiceRef,
          urgency: 'overdue' as const,
          badgeText: `VENCIDO (${Math.abs(daysRemaining)} d.)`,
        };
      }
      if (daysRemaining <= 7) {
        return {
          hasDue: true,
          daysRemaining,
          isoDate: nextInst.dueDate,
          formattedDate,
          invoiceRef,
          urgency: 'soon' as const,
          badgeText:
            daysRemaining === 0
              ? 'VENCE HOY'
              : `VENCE EN ${daysRemaining} DÍAS`,
        };
      }
      return {
        hasDue: true,
        daysRemaining,
        isoDate: nextInst.dueDate,
        formattedDate,
        invoiceRef,
        urgency: 'normal' as const,
        badgeText: `Vence el ${formattedDate}`,
      };
    }

    if (bal <= 0) {
      return {
        hasDue: false,
        daysRemaining: null as number | null,
        isoDate: '9999-12-31',
        formattedDate: 'Sin vencimientos pendientes',
        invoiceRef: null as string | null,
        urgency: 'none' as 'overdue' | 'soon' | 'normal' | 'none',
        badgeText: null as string | null,
      };
    }

    const offsetMap: Record<number, number> = {
      1: -2,
      2: 3,
      3: 5,
    };
    const daysRemaining =
      offsetMap[sup.id] !== undefined ? offsetMap[sup.id] : (sup.id % 6) + 1;

    const isoDate = addDaysToTodayIso(daysRemaining);
    const formattedDate = formatIsoToAr(isoDate);
    const invoiceRef = `FC-A 000${sup.id}-00048${sup.id}2`;

    if (daysRemaining < 0) {
      return {
        hasDue: true,
        daysRemaining,
        isoDate,
        formattedDate,
        invoiceRef,
        urgency: 'overdue' as const,
        badgeText: `VENCIDO (${Math.abs(daysRemaining)} d.)`,
      };
    }
    if (daysRemaining <= 7) {
      return {
        hasDue: true,
        daysRemaining,
        isoDate,
        formattedDate,
        invoiceRef,
        urgency: 'soon' as const,
        badgeText:
          daysRemaining === 0
            ? 'VENCE HOY'
            : `VENCE EN ${daysRemaining} DÍAS`,
      };
    }
    return {
      hasDue: true,
      daysRemaining,
      isoDate,
      formattedDate,
      invoiceRef,
      urgency: 'normal' as const,
      badgeText: `Vence el ${formattedDate}`,
    };
  };

  // Proveedores con alerta de vencimiento próximo (<= 7 días o vencido)
  const urgentDueSuppliers = useMemo(() => {
    return suppliers
      .map((s) => ({ supplier: s, due: getSupplierDueInfo(s) }))
      .filter(
        (item) => item.due.urgency === 'overdue' || item.due.urgency === 'soon'
      );
  }, [suppliers, installments]);

  const filteredSuppliers = useMemo(() => {
    const list = suppliers.filter((s) => {
      if (
        selectedSupplierQuickFilter !== 'Todos' &&
        s.name !== selectedSupplierQuickFilter
      ) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.cuit.toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          s.contactPhone.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Ordenamiento interactivo por columna seleccionada (A-Z / 0-9 / Fecha)
    return [...list].sort((a, b) => {
      const dir = supplierSort.direction === 'asc' ? 1 : -1;
      if (supplierSort.key === 'name') {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) * dir;
      }
      if (supplierSort.key === 'balance') {
        const balA = parseFloat(String(a.balance || '0')) || 0;
        const balB = parseFloat(String(b.balance || '0')) || 0;
        return (balA - balB) * dir;
      }
      if (supplierSort.key === 'nextDueDate') {
        const dueA = getSupplierDueInfo(a);
        const dueB = getSupplierDueInfo(b);
        return dueA.isoDate.localeCompare(dueB.isoDate) * dir;
      }
      const valA = String(a[supplierSort.key as keyof SupplierItem] || '');
      const valB = String(b[supplierSort.key as keyof SupplierItem] || '');
      return valA.localeCompare(valB, 'es', { numeric: true }) * dir;
    });
  }, [
    suppliers,
    selectedSupplierQuickFilter,
    searchQuery,
    supplierSort,
    installments,
  ]);

  const { paginatedItems: paginatedSuppliers } = useMemo(
    () => paginateArray(filteredSuppliers, supplierPage, supplierPageSize),
    [filteredSuppliers, supplierPage, supplierPageSize]
  );

  // =========================================================================
  // 2. ESTADO DEL GENERADOR DE PEDIDOS / CARRITO DE COMPRAS PERSISTENTE POR PROVEEDOR (ID)
  // =========================================================================
  const [orderSupplierName, setOrderSupplierName] = useState<string>('');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderCategoryFilter, setOrderCategoryFilter] =
    useState<string>('Todas');
  // Filtro de stock en el generador de pedidos
  const [orderStockFilter, setOrderStockFilter] = useState<
    'reposicion' | 'sin-stock' | 'stock-bajo' | 'todos'
  >('todos');
  // Columnas visibles por defecto en lista de selección: "Código", "Descripción", "Stock" y "Stock Mínimo"
  const [visibleOrderCols, setVisibleOrderCols] = useState<
    Record<OrderProductColumnKey, boolean>
  >({
    sku: true,
    name: true,
    stock: true,
    minStock: true,
    costPrice: false,
    category: false,
  });
  const [orderSort, setOrderSort] = useState<{
    key: OrderProductColumnKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'name',
    direction: 'asc',
  });
  const [orderPage, setOrderPage] = useState<number>(1);
  const [orderPageSize, setOrderPageSize] = useState<PageSizeOption>(20);

  // Modal de Carrito / Pedido Rápido de un Proveedor específico desde "Acciones Rápidas"
  const [supplierCartModalSupplier, setSupplierCartModalSupplier] =
    useState<SupplierItem | null>(null);
  const [modalProductSearch, setModalProductSearch] = useState<string>('');
  const [modalProductPage, setModalProductPage] = useState<number>(1);
  const [modalProductPageSize, setModalProductPageSize] =
    useState<PageSizeOption>(20);
  const [modalProductSort, setModalProductSort] = useState<{
    key: 'sku' | 'name' | 'stock' | 'minStock' | 'costPrice';
    direction: 'asc' | 'desc';
  }>({
    key: 'name',
    direction: 'asc',
  });

  // Mapa persistente de Carritos por ID de Proveedor (NO se borra al cambiar de proveedor, navegar o refrescar)
  const [supplierCartsById, setSupplierCartsById] = useState<
    Record<number, OrderCartItem[]>
  >(() => {
    if (typeof window === 'undefined') return {};
    try {
      const rawById = window.localStorage.getItem(
        SUPPLIER_CARTS_BY_ID_STORAGE_KEY
      );
      const parsedById: Record<number, OrderCartItem[]> = rawById
        ? JSON.parse(rawById)
        : {};

      // Sincronizar también cualquier ítem guardado desde el escáner móvil por nombre de proveedor
      const rawScanner = window.localStorage.getItem(
        SCANNER_SUPPLIER_CARTS_STORAGE_KEY
      );
      if (rawScanner) {
        const parsedScanner = JSON.parse(rawScanner);
        if (parsedScanner && typeof parsedScanner === 'object') {
          Object.entries(parsedScanner).forEach(([supName, scannerItems]) => {
            if (!Array.isArray(scannerItems) || scannerItems.length === 0)
              return;
            const matchedSup = suppliers.find(
              (s) =>
                s.name.trim().toLowerCase() === supName.trim().toLowerCase()
            );
            if (matchedSup && (!parsedById[matchedSup.id] || parsedById[matchedSup.id].length === 0)) {
              parsedById[matchedSup.id] = scannerItems.map((it: any) => ({
                productId: Number(it.productId),
                sku: String(it.sku || ''),
                name: String(it.name || ''),
                currentStock: Number(it.currentStock ?? 0),
                minStock: Number(it.minStock ?? 0),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unitCost: Math.max(0, Number(it.costPrice ?? it.unitCost) || 0),
              }));
            }
          });
        }
      }
      return parsedById && typeof parsedById === 'object' ? parsedById : {};
    } catch {
      return {};
    }
  });

  // Notas de pedido persistentes por ID de Proveedor
  const [supplierOrderNotesById, setSupplierOrderNotesById] = useState<
    Record<number, string>
  >(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(SUPPLIER_NOTES_BY_ID_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Persistir automáticamente los carritos por ID de proveedor en LocalStorage y sincronizar con el escáner móvil
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        SUPPLIER_CARTS_BY_ID_STORAGE_KEY,
        JSON.stringify(supplierCartsById)
      );

      // Mantener sincronizado el mapa por nombre usado en el módulo móvil
      const byNameMap: Record<string, any[]> = {};
      Object.entries(supplierCartsById).forEach(([idStr, cartList]) => {
        const supId = Number(idStr);
        const supObj = suppliers.find((s) => s.id === supId);
        if (supObj && Array.isArray(cartList) && cartList.length > 0) {
          byNameMap[supObj.name] = cartList.map((c) => ({
            productId: c.productId,
            sku: c.sku,
            name: c.name,
            supplierName: supObj.name,
            costPrice: c.unitCost,
            currentStock: c.currentStock,
            minStock: c.minStock,
            quantity: c.quantity,
            addedAt: 'Guardado',
          }));
        }
      });
      window.localStorage.setItem(
        SCANNER_SUPPLIER_CARTS_STORAGE_KEY,
        JSON.stringify(byNameMap)
      );
      window.dispatchEvent(new CustomEvent('supplier-carts-updated'));
    } catch {
      // ignore storage error
    }
  }, [supplierCartsById, suppliers]);

  // Escuchar actualizaciones de carritos realizadas desde Pedido Rápido Móvil (/pedido-rapido-movil)
  useEffect(() => {
    const handleSyncFromScanner = () => {
      try {
        const rawScanner = window.localStorage.getItem(
          SCANNER_SUPPLIER_CARTS_STORAGE_KEY
        );
        if (!rawScanner) return;
        const parsedScanner = JSON.parse(rawScanner);
        if (!parsedScanner || typeof parsedScanner !== 'object') return;

        setSupplierCartsById((prev) => {
          const next: Record<number, OrderCartItem[]> = {};
          Object.entries(parsedScanner).forEach(([supName, scannerItems]) => {
            if (!Array.isArray(scannerItems) || scannerItems.length === 0)
              return;
            const supId = resolveSupplierIdByName(supName);
            if (supId) {
              next[supId] = scannerItems.map((it: any) => ({
                productId: Number(it.productId),
                sku: String(it.sku || ''),
                name: String(it.name || ''),
                currentStock: Number(it.currentStock ?? 0),
                minStock: Number(it.minStock ?? 0),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unitCost: Math.max(
                  0,
                  Number(it.costPrice ?? it.unitCost) || 0
                ),
              }));
            }
          });
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handleSyncFromScanner);
    return () => window.removeEventListener('storage', handleSyncFromScanner);
  }, [suppliers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        SUPPLIER_NOTES_BY_ID_STORAGE_KEY,
        JSON.stringify(supplierOrderNotesById)
      );
    } catch {
      // ignore
    }
  }, [supplierOrderNotesById]);

  // Resolver el ID de proveedor para un nombre de proveedor dado
  const resolveSupplierIdByName = (supName: string): number => {
    if (!supName) return 0;
    const found = suppliers.find(
      (s) => s.name.trim().toLowerCase() === supName.trim().toLowerCase()
    );
    if (found) return found.id;
    // Hash estable negativo si es un proveedor derivado de productos sin registro en tabla suppliers
    let hash = 0;
    const clean = supName.trim().toLowerCase();
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i);
      hash |= 0;
    }
    return -Math.abs(hash || 999);
  };

  const activeOrderSupplierId = useMemo(
    () => resolveSupplierIdByName(orderSupplierName),
    [orderSupplierName, suppliers]
  );

  // Carrito actual del proveedor seleccionado en la vista de Pedidos
  const orderCart = useMemo<OrderCartItem[]>(() => {
    if (!activeOrderSupplierId) return [];
    return supplierCartsById[activeOrderSupplierId] || [];
  }, [supplierCartsById, activeOrderSupplierId]);

  const setOrderCart = (
    updater: OrderCartItem[] | ((prev: OrderCartItem[]) => OrderCartItem[])
  ) => {
    if (!activeOrderSupplierId) return;
    setSupplierCartsById((prevMap) => {
      const currentList = prevMap[activeOrderSupplierId] || [];
      const nextList =
        typeof updater === 'function' ? updater(currentList) : updater;
      const nextMap = { ...prevMap };
      if (nextList.length > 0) {
        nextMap[activeOrderSupplierId] = nextList;
      } else {
        delete nextMap[activeOrderSupplierId];
      }
      return nextMap;
    });
  };

  // Helper para actualizar el carrito de cualquier proveedor por su ID (usado tanto en el Modal como en la vista de Pedidos)
  const updateSupplierCartById = (
    supplierId: number,
    updater: OrderCartItem[] | ((prev: OrderCartItem[]) => OrderCartItem[])
  ) => {
    if (!supplierId) return;
    setSupplierCartsById((prevMap) => {
      const currentList = prevMap[supplierId] || [];
      const nextList =
        typeof updater === 'function' ? updater(currentList) : updater;
      const nextMap = { ...prevMap };
      if (nextList.length > 0) {
        nextMap[supplierId] = nextList;
      } else {
        delete nextMap[supplierId];
      }
      return nextMap;
    });
  };

  const orderNotes = useMemo(
    () =>
      activeOrderSupplierId
        ? supplierOrderNotesById[activeOrderSupplierId] || ''
        : '',
    [supplierOrderNotesById, activeOrderSupplierId]
  );

  const setOrderNotes = (val: string) => {
    if (!activeOrderSupplierId) return;
    setSupplierOrderNotesById((prev) => ({
      ...prev,
      [activeOrderSupplierId]: val,
    }));
  };

  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Al cambiar de proveedor en el generador de pedidos, NO se borra ningún carrito:
  // simplemente cambia el proveedor activo y muestra su carrito persistente guardado
  const handleSelectOrderSupplier = (supName: string) => {
    setOrderSupplierName(supName);
    setOrderPage(1);
  };

  // Abrir el Carrito / Pedido pre-cargado de un proveedor desde la columna "Acciones Rápidas"
  const handleOpenSupplierCartFromTable = (sup: SupplierItem) => {
    setOrderSupplierName(sup.name);
    setSupplierCartModalSupplier(sup);
    setModalProductSearch('');
    setModalProductPage(1);
  };

  // Cantidad total de ítems pendientes sumando todos los carritos de proveedores
  const totalPendingCartItemsAllSuppliers = useMemo(() => {
    return Object.values(supplierCartsById).reduce(
      (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
      0
    );
  }, [supplierCartsById]);

  useEffect(() => {
    setOrderPage(1);
  }, [
    orderSupplierName,
    orderCategoryFilter,
    orderStockFilter,
    orderSearchQuery,
  ]);

  const handleSortOrderCol = (key: OrderProductColumnKey) => {
    setOrderSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const supplierOrderProducts = useMemo(() => {
    if (!orderSupplierName) return [];
    const filtered = products.filter((p) => {
      // SOLO productos del mismo proveedor seleccionado
      if (
        (p.supplierName || '').trim().toLowerCase() !==
        orderSupplierName.trim().toLowerCase()
      ) {
        return false;
      }
      if (
        orderCategoryFilter !== 'Todas' &&
        p.category !== orderCategoryFilter
      ) {
        return false;
      }

      const tracks = p.trackStock !== false;
      const isOutOfStock = tracks && p.stock <= 0;
      const isLowStock = tracks && p.stock > 0 && p.stock <= p.minStock;

      if (orderStockFilter === 'reposicion') {
        if (!(tracks && (isOutOfStock || isLowStock))) {
          return false;
        }
      } else if (orderStockFilter === 'sin-stock') {
        if (!isOutOfStock) return false;
      } else if (orderStockFilter === 'stock-bajo') {
        if (!isLowStock) return false;
      }

      if (orderSearchQuery.trim() !== '') {
        const q = orderSearchQuery.toLowerCase();
        return (
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const dir = orderSort.direction === 'asc' ? 1 : -1;
      const key = orderSort.key;
      if (key === 'stock' || key === 'minStock') {
        return ((a[key] ?? 0) - (b[key] ?? 0)) * dir;
      }
      if (key === 'costPrice') {
        const cA = parseFloat(String(a.costPrice || '0')) || 0;
        const cB = parseFloat(String(b.costPrice || '0')) || 0;
        return (cA - cB) * dir;
      }
      const strA = String((a as any)[key] || '');
      const strB = String((b as any)[key] || '');
      return (
        strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' }) *
        dir
      );
    });
  }, [
    products,
    orderSupplierName,
    orderCategoryFilter,
    orderStockFilter,
    orderSearchQuery,
    orderSort,
  ]);

  const { paginatedItems: paginatedOrderProducts } = useMemo(
    () => paginateArray(supplierOrderProducts, orderPage, orderPageSize),
    [supplierOrderProducts, orderPage, orderPageSize]
  );

  // 1 solo clic en un producto lo agrega automáticamente al Carrito Persistente del proveedor
  const handleAddProductToOrderCart = (
    prod: ProductItem,
    explicitSupplierId?: number
  ) => {
    const cleanName = prod.name.replace(/\s*\[Costo Neto[^\]]*\]/gi, '').trim();
    const unitCost = parseFloat(String(prod.costPrice || '0')) || 0;
    const suggestedQty = Math.max(
      1,
      prod.minStock > prod.stock ? prod.minStock - prod.stock + 2 : 4
    );

    const targetSupId =
      explicitSupplierId ||
      activeOrderSupplierId ||
      resolveSupplierIdByName(prod.supplierName);

    updateSupplierCartById(targetSupId, (prev) => {
      const existing = prev.find((item) => item.productId === prod.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === prod.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: cleanName,
          currentStock: prod.stock,
          minStock: prod.minStock,
          quantity: suggestedQty,
          unitCost,
        },
      ];
    });
  };

  const orderTotalAmount = useMemo(() => {
    return orderCart.reduce(
      (acc, item) => acc + item.quantity * item.unitCost,
      0
    );
  }, [orderCart]);

  // Modal de Comprobante PDF / WhatsApp compartido para Pedidos, Devoluciones y Pagos
  const [activeVoucherModal, setActiveVoucherModal] = useState<{
    data: VoucherDocumentData;
    initialTab: 'pdf' | 'whatsapp';
  } | null>(null);

  // Último comprobante generado en Hacer un Nuevo Pedido y en Devolución a Proveedor para envío directo con navigator.share o respaldos
  const [lastOrderVoucher, setLastOrderVoucher] =
    useState<VoucherDocumentData | null>(null);
  const [lastReturnVoucher, setLastReturnVoucher] =
    useState<VoucherDocumentData | null>(null);
  const [copiedBannerDoc, setCopiedBannerDoc] = useState<string | null>(null);

  const handleCopyVoucherPreviewLink = async (v: VoucherDocumentData) => {
    try {
      const html = buildVoucherHtmlContent(v, formatCurrency);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(blobUrl);
      }
      setCopiedBannerDoc(v.docNumber);
      setTimeout(() => setCopiedBannerDoc(null), 3000);
    } catch (err) {
      console.error('Error copying voucher link:', err);
    }
  };

  const buildOrderVoucherData = (
    order: PurchaseOrderRecord
  ): VoucherDocumentData => {
    const sup = suppliers.find(
      (s) => s.id === order.supplierId || s.name === order.supplierName
    );
    return {
      docType: 'Pedido a Proveedor',
      docNumber: order.orderNumber,
      dateFormatted: formatIsoToAr(order.createdAt),
      supplierName: order.supplierName,
      supplierCuit: sup?.cuit || '30-71500912-3',
      supplierPhone: sup?.contactPhone || '+54 11 4500-1200',
      supplierEmail: sup?.email || 'ventas@proveedorferretero.com.ar',
      status: order.orderStatus,
      secondaryStatus: `Pago: ${order.paymentStatus}`,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      notes: order.notes,
      items: order.items.map((it) => ({
        sku: it.sku,
        name: it.name,
        quantity: it.quantity,
        unitCost: it.unitCost,
      })),
    };
  };

  const buildReturnVoucherData = (
    ret: SupplierReturnHistoryEntry
  ): VoucherDocumentData => {
    const sup = suppliers.find(
      (s) => s.id === ret.supplierId || s.name === ret.supplierName
    );
    return {
      docType: 'Devolución a Proveedor',
      docNumber: ret.docNumber,
      dateFormatted: ret.date || formatIsoToAr(ret.isoDate),
      supplierName: ret.supplierName,
      supplierCuit: sup?.cuit || '30-71500912-3',
      supplierPhone: sup?.contactPhone || '+54 11 4500-1200',
      supplierEmail: sup?.email || 'reclamos@proveedorferretero.com.ar',
      status: ret.status || 'Acreditado',
      reason: ret.reason,
      totalAmount: ret.totalCredit,
      notes: ret.notes,
      items: ret.items.map((it) => ({
        sku: it.sku,
        name: it.name,
        quantity: it.quantity,
        unitCost: it.unitCost,
      })),
    };
  };

  const openOrderVoucherModal = (
    order: PurchaseOrderRecord,
    tab: 'pdf' | 'whatsapp'
  ) => {
    const vData = buildOrderVoucherData(order);
    setLastOrderVoucher(vData);
    setActiveVoucherModal({
      initialTab: tab,
      data: vData,
    });
  };

  const openReturnVoucherModal = (
    ret: SupplierReturnHistoryEntry,
    tab: 'pdf' | 'whatsapp'
  ) => {
    const vData = buildReturnVoucherData(ret);
    setLastReturnVoucher(vData);
    setActiveVoucherModal({
      initialTab: tab,
      data: vData,
    });
  };

  const openPaymentVoucherModal = (
    pay: SupplierPaymentHistoryEntry,
    tab: 'pdf' | 'whatsapp'
  ) => {
    const sup = suppliers.find(
      (s) => s.id === pay.supplierId || s.name === pay.supplierName
    );
    setActiveVoucherModal({
      initialTab: tab,
      data: {
        docType: 'Orden de Pago',
        docNumber: pay.receiptNumber,
        dateFormatted: pay.date || formatIsoToAr(pay.isoDate),
        supplierName: pay.supplierName,
        supplierCuit: sup?.cuit || '30-71500912-3',
        supplierPhone: sup?.contactPhone || '+54 11 4500-1200',
        supplierEmail: sup?.email || 'administracion@proveedorferretero.com.ar',
        status: pay.status || 'Saldado',
        paymentMethod: pay.paymentMethod,
        totalAmount: pay.amount,
        paidAmount: pay.amount,
        notes: pay.note,
        attachmentUrl: pay.attachmentUrl,
        attachmentName: pay.attachmentName,
        attachmentType: pay.attachmentType,
        items: [
          {
            sku: pay.receiptNumber,
            name: `Imputación de Pago en Cuenta Corriente (${pay.paymentMethod}) — ${
              pay.note || 'Cancelación de saldo'
            }`,
            quantity: 1,
            unitCost: pay.amount,
          },
        ],
      },
    });
  };

  const handleConfirmPurchaseOrderForSupplier = async (
    targetSupplierObj?: SupplierItem
  ) => {
    const targetName = targetSupplierObj?.name || orderSupplierName;
    if (!targetName) return;
    const supObj =
      targetSupplierObj ||
      suppliers.find(
        (s) => s.name.trim().toLowerCase() === targetName.trim().toLowerCase()
      );
    const targetId = supObj?.id || resolveSupplierIdByName(targetName);
    const targetCart = supplierCartsById[targetId] || [];
    if (targetCart.length === 0) return;

    const targetNotes = supplierOrderNotesById[targetId] || '';
    const targetTotalAmount = targetCart.reduce(
      (acc, item) => acc + item.quantity * item.unitCost,
      0
    );

    setIsSubmittingOrder(true);
    try {
      const orderNum = `OC-2026-00${Math.floor(44 + purchaseOrders.length)}`;
      const dueIso = addDaysToTodayIso(15);
      const newOrder: PurchaseOrderRecord = {
        id: `ORD-${Date.now()}`,
        orderNumber: orderNum,
        supplierId: supObj?.id || 1,
        supplierName: targetName,
        createdAt: getTodayIso(),
        paymentDueDate: dueIso,
        orderStatus: 'Pendiente',
        paymentStatus: 'Pendiente',
        totalAmount: targetTotalAmount,
        paidAmount: 0,
        itemsCount: targetCart.length,
        items: targetCart.map((c) => ({
          sku: c.sku,
          name: c.name,
          quantity: c.quantity,
          unitCost: c.unitCost,
        })),
        notes: targetNotes || 'Pedido generado desde Carrito Persistente de Proveedor',
      };
      setPurchaseOrders((prev) => [newOrder, ...prev]);

      // Agendar automáticamente el vencimiento en el Calendario de Vencimientos
      setInstallments((prev) => [
        ...prev,
        {
          id: `INST-${Date.now()}`,
          supplierId: supObj?.id || 1,
          supplierName: targetName,
          docRef: orderNum,
          dueDate: dueIso,
          totalAmount: targetTotalAmount,
          paidAmount: 0,
          status: 'Pendiente',
          notes: targetNotes || 'Vencimiento de Orden de Compra',
        },
      ]);

      const res = await fetch('/api/suppliers/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supObj?.id || 1,
          totalAmount: targetTotalAmount,
          items: targetCart.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.products) {
          onProductsUpdated(
            data.products,
            `Orden de Compra ${orderNum} confirmada: ${targetCart.length} artículos marcados como "PEDIDO" en el inventario.`
          );
        }
        if (data.suppliers) {
          onSuppliersUpdated(
            data.suppliers,
            `Orden de Compra ${orderNum} enviada a "${targetName}" por ${formatCurrency(
              targetTotalAmount
            )}. Carrito del proveedor vaciado.`
          );
        }
      }

      // ÚNICAMENTE al confirmar explícitamente el pedido se vacía el carrito de este proveedor
      updateSupplierCartById(targetId, []);
      setSupplierOrderNotesById((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setSupplierCartModalSupplier(null);
      openOrderVoucherModal(newOrder, 'pdf');
    } catch (err) {
      console.error('Error confirming purchase order:', err);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleConfirmPurchaseOrder = async () => {
    await handleConfirmPurchaseOrderForSupplier();
  };

  // Handlers para Gestión de Pedidos y Calendario de Vencimientos
  const handleUpdateOrderStatus = (
    orderId: string,
    newStatus: PurchaseOrderRecord['orderStatus']
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus } : o))
    );
  };

  const handleRegisterOrderPayment = async (params: {
    orderId: string;
    supplierId: number;
    amount: number;
    paymentMethod: string;
    newPaymentStatus: 'Pendiente' | 'Parcial' | 'Saldado';
    note: string;
  }) => {
    const targetOrder = purchaseOrders.find((o) => o.id === params.orderId);
    setPurchaseOrders((prev) =>
      prev.map((o) => {
        if (o.id !== params.orderId) return o;
        const nextPaid = Math.min(o.totalAmount, o.paidAmount + params.amount);
        return {
          ...o,
          paidAmount:
            params.newPaymentStatus === 'Saldado' ? o.totalAmount : nextPaid,
          paymentStatus: params.newPaymentStatus,
        };
      })
    );

    if (params.amount > 0) {
      const supObj = suppliers.find((s) => s.id === params.supplierId);
      const newPayEntry: SupplierPaymentHistoryEntry = {
        id: `PAY-${Date.now()}`,
        receiptNumber: `OP-0001-0000${Math.floor(420 + Math.random() * 500)}`,
        date: new Date().toLocaleDateString('es-AR'),
        isoDate: getTodayIso(),
        supplierId: supObj?.id || params.supplierId,
        supplierName:
          supObj?.name || targetOrder?.supplierName || 'Proveedor Ferretero',
        paymentMethod: params.paymentMethod,
        amount: params.amount,
        status: params.newPaymentStatus,
        note: params.note || `Pago sobre pedido ${targetOrder?.orderNumber || ''}`,
      };
      setPaymentHistory((prev) => [newPayEntry, ...prev]);

      if (supObj) {
        const res = await fetch('/api/suppliers/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: supObj.id,
            amount: params.amount,
            paymentMethod: params.paymentMethod,
            note: params.note,
          }),
        });
        const data = await res.json();
        if (res.ok && data.suppliers) {
          onSuppliersUpdated(
            data.suppliers,
            `Pago de ${formatCurrency(params.amount)} acreditado sobre el pedido ${
              targetOrder?.orderNumber || ''
            } (${params.newPaymentStatus}).`
          );
        }
      }
    }
  };

  const handleUpdateInstallmentStatusOrPayment = async (params: {
    installmentId: string;
    supplierId: number;
    newStatus: 'Pendiente' | 'Pagado' | 'Parcial' | 'Vencido' | 'Saldado';
    paidAmountDelta: number;
    paymentMethod: string;
    note: string;
    accountId?: string;
    accountName?: string;
    expenseCategory?: ExpenseCategoryType;
    concept?: string;
  }) => {
    const targetInst = installments.find((i) => i.id === params.installmentId);
    const isMarkingPaid =
      params.newStatus === 'Pagado' || params.newStatus === 'Saldado';

    setInstallments((prev) => {
      const updatedList = prev.map((inst) => {
        if (inst.id !== params.installmentId) return inst;
        const nextPaid = isMarkingPaid
          ? inst.totalAmount
          : (params.newStatus === 'Pendiente' ||
              params.newStatus === 'Vencido') &&
            params.paidAmountDelta === 0
          ? 0
          : Math.min(inst.totalAmount, inst.paidAmount + params.paidAmountDelta);
        const resolvedStatus:
          | 'Pendiente'
          | 'Pagado'
          | 'Parcial'
          | 'Vencido'
          | 'Saldado' =
          nextPaid >= inst.totalAmount - 0.01
            ? params.newStatus === 'Saldado'
              ? 'Saldado'
              : 'Pagado'
            : nextPaid > 0
            ? 'Parcial'
            : params.newStatus;
        return {
          ...inst,
          paidAmount: nextPaid,
          status: resolvedStatus,
          paidAccountId: params.accountId || inst.paidAccountId,
          paidAccountName: params.accountName || inst.paidAccountName,
        };
      });

      // Si es un gasto recurrente y se marca como Pagado, autoregenera la alerta para el próximo período
      if (
        targetInst &&
        targetInst.isRecurring &&
        isMarkingPaid &&
        targetInst.status !== 'Pagado' &&
        targetInst.status !== 'Saldado'
      ) {
        const freq = targetInst.recurrenceFrequency || 'Mensual';
        const nextDueIso = computeNextRecurringDueDate(targetInst.dueDate, freq);
        const alreadyExists = updatedList.some(
          (item) =>
            item.supplierName === targetInst.supplierName &&
            item.concept === targetInst.concept &&
            item.dueDate === nextDueIso
        );
        if (!alreadyExists) {
          updatedList.push({
            ...targetInst,
            id: `INST-REC-${Date.now()}`,
            docRef: `${targetInst.docRef}-R`,
            issueDate: getTodayIso(),
            dueDate: nextDueIso,
            paidAmount: 0,
            status: 'Pendiente',
            paidAccountId: undefined,
            paidAccountName: undefined,
            notes: `Alerta recurrente (${freq}) autogenerada al abonar ${targetInst.docRef}`,
          });
        }
      }

      return updatedList;
    });

    if (params.paidAmountDelta > 0) {
      const supObj = suppliers.find((s) => s.id === params.supplierId);
      const newPayEntry: SupplierPaymentHistoryEntry = {
        id: `PAY-${Date.now()}`,
        receiptNumber: `OP-0001-0000${Math.floor(420 + Math.random() * 500)}`,
        date: new Date().toLocaleDateString('es-AR'),
        isoDate: getTodayIso(),
        supplierId: supObj?.id || params.supplierId,
        supplierName:
          supObj?.name || targetInst?.supplierName || 'Entidad / Beneficiario',
        paymentMethod: params.accountName
          ? `${params.paymentMethod} (${params.accountName})`
          : params.paymentMethod,
        amount: params.paidAmountDelta,
        status: params.newStatus === 'Pagado' ? 'Saldado' : params.newStatus,
        note:
          params.note ||
          `${params.concept || targetInst?.concept || 'Egreso'} (${
            targetInst?.docRef || ''
          })`,
      };
      setPaymentHistory((prev) => [newPayEntry, ...prev]);

      if (supObj) {
        const res = await fetch('/api/suppliers/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: supObj.id,
            amount: params.paidAmountDelta,
            paymentMethod: params.paymentMethod,
            note: params.note,
          }),
        });
        const data = await res.json();
        if (res.ok && data.suppliers) {
          onSuppliersUpdated(
            data.suppliers,
            `Vencimiento ${targetInst?.docRef || ''} actualizado a "${
              params.newStatus
            }" y pago de ${formatCurrency(
              params.paidAmountDelta
            )} descontado en Caja y registrado en Flujo de Caja.`
          );
        }
      }
    }
  };

  // Estado del Modal "Agendar Vencimiento / Registrar Deuda y Gastos Operativos"
  const [supplierDebtModalOpen, setSupplierDebtModalOpen] = useState(false);
  const [supplierDebtForm, setSupplierDebtForm] = useState<{
    expenseCategory: ExpenseCategoryType;
    concept: string;
    beneficiaryMode: 'supplier' | 'custom';
    supplierId: string;
    customBeneficiary: string;
    docRef: string;
    issueDate: string;
    dueDate: string;
    totalAmount: string;
    status: 'Pendiente' | 'Pagado' | 'Parcial' | 'Vencido';
    partialPaidAmount: string;
    accountId: string;
    paymentMethod: string;
    isRecurring: boolean;
    recurrenceFrequency: ExpenseRecurrenceFrequency;
    notes: string;
    attachmentUrl: string;
    attachmentName: string;
    attachmentType: 'image' | 'pdf';
  }>({
    expenseCategory: 'Compra a Proveedor / Mercadería',
    concept: '',
    beneficiaryMode: 'supplier',
    supplierId: suppliers[0]?.id ? String(suppliers[0].id) : '',
    customBeneficiary: '',
    docRef: `FC-A 0001-000${Math.floor(4910 + Math.random() * 80)}`,
    issueDate: getTodayIso(),
    dueDate: getTodayIso(),
    totalAmount: '',
    status: 'Pendiente',
    partialPaidAmount: '',
    accountId: DEFAULT_TREASURY_ACCOUNTS[0].id,
    paymentMethod: 'Efectivo / Caja Chica',
    isRecurring: false,
    recurrenceFrequency: 'Mensual',
    notes: '',
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: 'image',
  });
  const [isSubmittingSupplierDebt, setIsSubmittingSupplierDebt] =
    useState(false);

  const handleOpenRegisterDebtForSupplier = (sup?: SupplierItem) => {
    const targetSup = sup || suppliers[0];
    setSupplierDebtForm({
      expenseCategory: 'Compra a Proveedor / Mercadería',
      concept: '',
      beneficiaryMode: 'supplier',
      supplierId: targetSup?.id ? String(targetSup.id) : '',
      customBeneficiary: '',
      docRef: `FC-A 000${targetSup?.id || 1}-000${Math.floor(
        4910 + Math.random() * 89
      )}`,
      issueDate: getTodayIso(),
      dueDate: getTodayIso(),
      totalAmount: '',
      status: 'Pendiente',
      partialPaidAmount: '',
      accountId: treasuryAccounts[0]?.id || DEFAULT_TREASURY_ACCOUNTS[0].id,
      paymentMethod: 'Transferencia Bancaria',
      isRecurring: false,
      recurrenceFrequency: 'Mensual',
      notes: '',
      attachmentUrl: '',
      attachmentName: '',
      attachmentType: 'image',
    });
    setSupplierDebtModalOpen(true);
  };

  const handleSupplierDebtAttachmentChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setSupplierDebtForm((prev) => ({
        ...prev,
        attachmentUrl: result,
        attachmentName: file.name,
        attachmentType: isPdf ? 'pdf' : 'image',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddInstallment = async (
    newInst: Omit<SupplierDueInstallment, 'id'>
  ) => {
    const createdInst: SupplierDueInstallment = {
      ...newInst,
      id: `INST-${Date.now()}`,
    };
    setInstallments((prev) => {
      const next = [...prev, createdInst];
      // Si nace como Pagado y es recurrente, programa automáticamente el próximo vencimiento
      if (
        createdInst.isRecurring &&
        (createdInst.status === 'Pagado' || createdInst.status === 'Saldado')
      ) {
        const freq = createdInst.recurrenceFrequency || 'Mensual';
        const nextDueIso = computeNextRecurringDueDate(
          createdInst.dueDate,
          freq
        );
        next.push({
          ...createdInst,
          id: `INST-REC-${Date.now() + 1}`,
          docRef: `${createdInst.docRef}-R`,
          issueDate: getTodayIso(),
          dueDate: nextDueIso,
          paidAmount: 0,
          status: 'Pendiente',
          paidAccountId: undefined,
          paidAccountName: undefined,
          notes: `Alerta recurrente (${freq}) autogenerada para el próximo período`,
        });
      }
      return next;
    });

    const netDebt = Math.max(
      0,
      (newInst.totalAmount || 0) - (newInst.paidAmount || 0)
    );
    if (netDebt > 0 && newInst.supplierId && newInst.supplierId > 0) {
      try {
        const res = await fetch('/api/suppliers/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: newInst.supplierId,
            totalAmount: netDebt,
            items: [],
          }),
        });
        const data = await res.json();
        if (res.ok && data.suppliers) {
          onSuppliersUpdated(
            data.suppliers,
            `Vencimiento (${newInst.docRef}) por ${formatCurrency(
              netDebt
            )} vinculado a "${newInst.supplierName}" (Vence: ${formatIsoToAr(
              newInst.dueDate
            )}).`
          );
        }
      } catch (err) {
        console.error(
          'Error updating supplier balance for new installment:',
          err
        );
      }
    }
  };

  const handleConfirmSupplierDebtForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt =
      parseFloat(String(supplierDebtForm.totalAmount).replace(',', '.')) || 0;
    if (amt <= 0 || !supplierDebtForm.dueDate) return;

    const matchedSup =
      supplierDebtForm.beneficiaryMode === 'supplier'
        ? suppliers.find((s) => String(s.id) === supplierDebtForm.supplierId)
        : undefined;

    const beneficiaryName =
      supplierDebtForm.beneficiaryMode === 'supplier' && matchedSup
        ? matchedSup.name
        : supplierDebtForm.customBeneficiary.trim() ||
          matchedSup?.name ||
          'Entidad / Servicio Operativo';

    const resolvedConcept =
      supplierDebtForm.concept.trim() ||
      supplierDebtForm.notes.trim() ||
      `${supplierDebtForm.expenseCategory} — ${beneficiaryName}`;

    const isPaidNow = supplierDebtForm.status === 'Pagado';
    const isPartialNow = supplierDebtForm.status === 'Parcial';
    const initialPaid = isPaidNow
      ? amt
      : isPartialNow
      ? Math.min(
          amt,
          Math.max(
            0,
            parseFloat(
              String(supplierDebtForm.partialPaidAmount).replace(',', '.')
            ) || 0
          )
        )
      : 0;

    const selectedAcc =
      treasuryAccounts.find((a) => a.id === supplierDebtForm.accountId) ||
      treasuryAccounts[0];

    setIsSubmittingSupplierDebt(true);
    try {
      await handleAddInstallment({
        supplierId: matchedSup?.id || 0,
        supplierName: beneficiaryName,
        expenseCategory: supplierDebtForm.expenseCategory,
        concept: resolvedConcept,
        docRef:
          supplierDebtForm.docRef.trim() ||
          `EGR-0001-000${Math.floor(4910 + Math.random() * 89)}`,
        issueDate: supplierDebtForm.issueDate || supplierDebtForm.dueDate,
        dueDate: supplierDebtForm.dueDate,
        totalAmount: amt,
        paidAmount: initialPaid,
        status: supplierDebtForm.status,
        isRecurring: supplierDebtForm.isRecurring,
        recurrenceFrequency: supplierDebtForm.isRecurring
          ? supplierDebtForm.recurrenceFrequency
          : undefined,
        paidAccountId: initialPaid > 0 ? selectedAcc?.id : undefined,
        paidAccountName: initialPaid > 0 ? selectedAcc?.name : undefined,
        notes:
          supplierDebtForm.notes.trim() ||
          `${resolvedConcept} (${supplierDebtForm.expenseCategory})`,
        attachmentUrl: supplierDebtForm.attachmentUrl || undefined,
        attachmentName: supplierDebtForm.attachmentName || undefined,
        attachmentType: supplierDebtForm.attachmentUrl
          ? supplierDebtForm.attachmentType
          : undefined,
      });

      if (initialPaid > 0 && selectedAcc) {
        setTreasuryAccounts((prev) =>
          prev.map((acc) =>
            acc.id === selectedAcc.id
              ? { ...acc, balance: acc.balance - initialPaid }
              : acc
          )
        );
        const cfEntry: CashflowEntry = {
          id: `CF-${Date.now()}`,
          isoDate: getTodayIso(),
          formattedDate: formatIsoToAr(getTodayIso()),
          type: 'Egreso',
          category: supplierDebtForm.expenseCategory,
          concept: resolvedConcept,
          beneficiary: beneficiaryName,
          accountId: selectedAcc.id,
          accountName: selectedAcc.name,
          paymentMethod: supplierDebtForm.paymentMethod,
          amount: initialPaid,
          docRef: supplierDebtForm.docRef,
        };
        setCashflowTransactions((prev) => [cfEntry, ...prev]);
      }

      setSupplierDebtModalOpen(false);
    } finally {
      setIsSubmittingSupplierDebt(false);
    }
  };

  // =========================================================================
  // 3. ESTADO DEL MÓDULO DE INGRESO DE PAGOS A PROVEEDORES
  // =========================================================================
  const [paymentSupplierId, setPaymentSupplierId] = useState<string>(
    suppliers[0]?.id ? String(suppliers[0].id) : ''
  );
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(
    'Transferencia Bancaria'
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentAttachment, setPaymentAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'pdf';
  } | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] =
    useState<boolean>(false);

  const handlePaymentAttachmentChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setPaymentAttachment({
        url: result,
        name: file.name,
        type: isPdf ? 'pdf' : 'image',
      });
    };
    reader.readAsDataURL(file);
  };

  const [paymentHistory, setPaymentHistory] = useState<
    SupplierPaymentHistoryEntry[]
  >([]);

  const selectedPaymentSupplier = useMemo(() => {
    return suppliers.find((s) => String(s.id) === paymentSupplierId) || null;
  }, [suppliers, paymentSupplierId]);

  const handleOpenQuickPaymentForSupplier = (sup: SupplierItem) => {
    setPaymentSupplierId(String(sup.id));
    const bal = parseFloat(String(sup.balance || '0')) || 0;
    setPaymentAmount(bal > 0 ? bal.toFixed(2) : '');
    setActiveSubTab('pagos');
  };

  const handleConfirmSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentSupplier) return;
    const amt = parseFloat(paymentAmount.replace(',', '.')) || 0;
    if (amt <= 0) return;

    setIsSubmittingPayment(true);
    try {
      const res = await fetch('/api/suppliers/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedPaymentSupplier.id,
          amount: amt,
          paymentMethod,
          note: paymentNote,
          date: paymentDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el pago');
      }

      const prevBal =
        parseFloat(String(selectedPaymentSupplier.balance || '0')) || 0;
      const newEntry: SupplierPaymentHistoryEntry = {
        id: `PAY-${Date.now()}`,
        receiptNumber: `OP-0001-0000${Math.floor(420 + Math.random() * 500)}`,
        date: new Date(paymentDate + 'T12:00:00').toLocaleDateString('es-AR'),
        isoDate: paymentDate || getTodayIso(),
        supplierId: selectedPaymentSupplier.id,
        supplierName: selectedPaymentSupplier.name,
        paymentMethod,
        amount: amt,
        status: amt >= prevBal - 0.01 ? 'Saldado' : 'Parcial',
        note: paymentNote || 'Pago a cuenta corriente',
        attachmentUrl: paymentAttachment?.url,
        attachmentName: paymentAttachment?.name,
        attachmentType: paymentAttachment?.type,
      };
      setPaymentHistory((prev) => [newEntry, ...prev]);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentAttachment(null);

      if (data.suppliers) {
        onSuppliersUpdated(
          data.suppliers,
          `Pago de ${formatCurrency(amt)} registrado a "${
            selectedPaymentSupplier.name
          }" (${paymentMethod}). Cuenta corriente actualizada.`
        );
      }
      openPaymentVoucherModal(newEntry, 'pdf');
    } catch (err) {
      console.error('Error recording supplier payment:', err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // =========================================================================
  // 4. ESTADO DEL MÓDULO DE DEVOLUCIONES A PROVEEDORES + HISTORIAL
  // =========================================================================
  const [returnSupplierName, setReturnSupplierName] = useState<string>('');
  const [returnSearchQuery, setReturnSearchQuery] = useState<string>('');
  const [returnStockFilter, setReturnStockFilter] = useState<
    'todos' | 'con-stock' | 'controla-stock'
  >('todos');
  // Columnas visibles por defecto en Devoluciones: "Código", "Descripción", "Stock Actual" y "Precio Costo"
  const [visibleReturnCols] = useState<Record<ReturnProductColumnKey, boolean>>({
    sku: true,
    name: true,
    stock: true,
    costPrice: true,
    category: false,
  });
  const [returnCart, setReturnCart] = useState<ReturnCartItem[]>([]);
  const [returnReason, setReturnReason] = useState<string>(RETURN_REASONS[0]);
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);

  const [returnsHistory, setReturnsHistory] = useState<
    SupplierReturnHistoryEntry[]
  >([]);

  const [returnSort, setReturnSort] = useState<{
    key: ReturnProductColumnKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'name',
    direction: 'asc',
  });
  const [returnPage, setReturnPage] = useState<number>(1);
  const [returnPageSize, setReturnPageSize] = useState<PageSizeOption>(20);

  const handleSelectReturnSupplier = (supName: string) => {
    setReturnSupplierName(supName);
    setReturnCart([]);
    setReturnPage(1);
  };

  useEffect(() => {
    setReturnPage(1);
  }, [returnSupplierName, returnStockFilter, returnSearchQuery]);

  const handleSortReturnCol = (key: ReturnProductColumnKey) => {
    setReturnSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const supplierReturnProducts = useMemo(() => {
    if (!returnSupplierName) return [];
    const filtered = products.filter((p) => {
      if ((p.supplierName || '').trim() !== returnSupplierName.trim()) {
        return false;
      }
      if (returnStockFilter === 'con-stock' && p.stock <= 0) {
        return false;
      }
      if (returnStockFilter === 'controla-stock' && p.trackStock === false) {
        return false;
      }
      if (returnSearchQuery.trim() !== '') {
        const q = returnSearchQuery.toLowerCase();
        return (
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const dir = returnSort.direction === 'asc' ? 1 : -1;
      const key = returnSort.key;
      if (key === 'stock') {
        return ((a.stock ?? 0) - (b.stock ?? 0)) * dir;
      }
      if (key === 'costPrice') {
        const cA = parseFloat(String(a.costPrice || '0')) || 0;
        const cB = parseFloat(String(b.costPrice || '0')) || 0;
        return (cA - cB) * dir;
      }
      const strA = String((a as any)[key] || '');
      const strB = String((b as any)[key] || '');
      return (
        strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' }) *
        dir
      );
    });
  }, [
    products,
    returnSupplierName,
    returnStockFilter,
    returnSearchQuery,
    returnSort,
  ]);

  const { paginatedItems: paginatedReturnProducts } = useMemo(
    () => paginateArray(supplierReturnProducts, returnPage, returnPageSize),
    [supplierReturnProducts, returnPage, returnPageSize]
  );

  // Con 1 solo clic en un artículo, se agrega a la "Lista / Carrito de Devolución"
  const handleAddProductToReturnCart = (prod: ProductItem) => {
    const cleanName = prod.name.replace(/\s*\[Costo Neto[^\]]*\]/gi, '').trim();
    const unitCost = parseFloat(String(prod.costPrice || '0')) || 0;

    setReturnCart((prev) => {
      const existing = prev.find((item) => item.productId === prod.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === prod.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: cleanName,
          currentStock: prod.stock,
          quantity: 1,
          unitCost,
        },
      ];
    });
  };

  const returnTotalCredit = useMemo(() => {
    return returnCart.reduce(
      (acc, item) => acc + item.quantity * item.unitCost,
      0
    );
  }, [returnCart]);

  const handleConfirmSupplierReturn = async () => {
    if (!returnSupplierName || returnCart.length === 0) return;
    const supObj = suppliers.find((s) => s.name === returnSupplierName);
    if (!supObj) return;

    setIsSubmittingReturn(true);
    try {
      const res = await fetch('/api/suppliers/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supObj.id,
          reason: returnReason,
          items: returnCart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar devolución');
      }

      const newReturnRecord: SupplierReturnHistoryEntry = {
        id: `RET-${Date.now()}`,
        docNumber: `NC-PROV-0001-00${Math.floor(215 + Math.random() * 700)}`,
        date: new Date().toLocaleDateString('es-AR'),
        isoDate: getTodayIso(),
        supplierId: supObj.id,
        supplierName: supObj.name,
        reason: returnReason,
        notes: returnNotes || 'Nota de Crédito por devolución de mercadería',
        totalCredit: returnTotalCredit,
        status: 'Acreditado',
        items: returnCart.map((c) => ({
          sku: c.sku,
          name: c.name,
          quantity: c.quantity,
          unitCost: c.unitCost,
        })),
      };

      setReturnsHistory((prev) => [newReturnRecord, ...prev]);
      setReturnCart([]);
      setReturnNotes('');

      if (data.products) {
        onProductsUpdated(
          data.products,
          `Devolución registrada: Stock descontado y ${formatCurrency(
            returnTotalCredit
          )} acreditados en la cuenta corriente de "${supObj.name}".`
        );
      }
      if (data.suppliers) {
        onSuppliersUpdated(
          data.suppliers,
          `Devolución (${newReturnRecord.docNumber}) acreditada en "${
            supObj.name
          }" por ${formatCurrency(returnTotalCredit)}.`
        );
      }
      openReturnVoucherModal(newReturnRecord, 'pdf');
    } catch (err) {
      console.error('Error registering supplier return:', err);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Crear proveedor individual
  const handleCreateSingleSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierForm.name || !newSupplierForm.cuit) return;
    setIsSavingSupplier(true);
    try {
      const res = await fetch('/api/suppliers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [newSupplierForm] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar proveedor');
      onSuppliersUpdated(
        data.suppliers || [],
        `Proveedor "${newSupplierForm.name}" registrado en el padrón.`
      );
      setNewSupplierModalOpen(false);
      setNewSupplierForm({
        name: '',
        cuit: '30-71992011-4',
        contactPhone: '+54 11 4700-9900',
        email: 'contacto@proveedor.com.ar',
        category: 'Ferretería Industrial',
        balance: '0.00',
        status: 'Al día',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // =========================================================================
  // FLUJO DE ACTUALIZACIÓN EXCLUSIVA DE PRECIOS / COSTOS POR PROVEEDOR (3 COLUMNAS)
  // =========================================================================
  const [costOnlyModalSupplier, setCostOnlyModalSupplier] =
    useState<SupplierItem | null>(null);
  const [costOnlyIncludesIva, setCostOnlyIncludesIva] = useState<boolean>(false);
  const [costOnlySupplierDiscountPct, setCostOnlySupplierDiscountPct] =
    useState<string>('0');
  const [costOnlyFileName, setCostOnlyFileName] = useState<string>('');
  const [costOnlyRawRows, setCostOnlyRawRows] = useState<
    {
      code: string;
      rawCost: number;
      ivaRate: number;
    }[]
  >([]);
  const [costOnlyPreImportDialogOpen, setCostOnlyPreImportDialogOpen] =
    useState<boolean>(false);
  const [costOnlyError, setCostOnlyError] = useState<string | null>(null);
  const [isApplyingCostOnly, setIsApplyingCostOnly] = useState<boolean>(false);
  const costOnlyFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenSupplierCostOnlyModal = (sup: SupplierItem) => {
    setCostOnlyModalSupplier(sup);
    setCostOnlyIncludesIva(false);
    setCostOnlySupplierDiscountPct('0');
    setCostOnlyFileName('');
    setCostOnlyRawRows([]);
    setCostOnlyPreImportDialogOpen(false);
    setCostOnlyError(null);
  };

  // Plantilla de Importación de Costos (ÚNICAMENTE 3 Columnas: "Código", "Costo", "IVA")
  const handleDownloadSupplierCostTemplate = (format: 'xlsx' | 'csv') => {
    if (!costOnlyModalSupplier) return;
    const extMeta = loadProductExtendedMetaMap();

    const supplierProds = products.filter(
      (p) =>
        (p.supplierName || '').trim().toLowerCase() ===
        costOnlyModalSupplier.name.trim().toLowerCase()
    );
    const sampleSource =
      supplierProds.length > 0 ? supplierProds.slice(0, 8) : products.slice(0, 5);

    const templateRows =
      sampleSource.length > 0
        ? sampleSource.map((p) => {
            const meta = extMeta[p.id];
            const baseCost = parseFloat(String(p.costPrice || '0')) || 10000;
            const bulkMult =
              meta?.unitsPerPackage && meta.unitsPerPackage > 1
                ? meta.unitsPerPackage
                : 1;
            return {
              Código: p.sku,
              Costo: Number((baseCost * bulkMult).toFixed(2)),
              IVA: parseFloat(String(p.ivaRate || '21')) || 21,
            };
          })
        : [
            { Código: 'DEW-DWE4020', Costo: 96500, IVA: 21 },
            { Código: 'BOS-GSB13RE', Costo: 97000, IVA: 21 },
            { Código: 'BUL-HEX-38', Costo: 34025, IVA: 10.5 },
          ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows, {
      header: ['Código', 'Costo', 'IVA'],
    });
    worksheet['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 12 }];

    const safeSupName = costOnlyModalSupplier.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 25);

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plantilla_costos_3_columnas_${safeSupName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Costos Proveedor');
    XLSX.writeFile(
      workbook,
      `plantilla_costos_3_columnas_${safeSupName}.xlsx`
    );
  };

  // Lectura del archivo Excel/CSV de 3 columnas ("Código", "Costo", "IVA") y apertura del Diálogo de Configuración Pre-Importación
  const handleSelectCostOnlyFile = (file: File) => {
    setCostOnlyError(null);
    setCostOnlyFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[wsName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(
          worksheet,
          { defval: '' }
        );

        if (jsonRows.length === 0) {
          setCostOnlyError('El archivo seleccionado está vacío.');
          setCostOnlyRawRows([]);
          return;
        }

        const normalizeVal = (
          row: Record<string, any>,
          candidates: string[]
        ): string => {
          const keys = Object.keys(row);
          for (const cand of candidates) {
            const found = keys.find(
              (k) => k.trim().toLowerCase() === cand.toLowerCase()
            );
            if (found && row[found] !== undefined && row[found] !== '') {
              return String(row[found]).trim();
            }
          }
          return '';
        };

        const parseNum = (val: string, fallback: number): number => {
          if (!val) return fallback;
          const cleaned = val.replace(/[^0-9.,-]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return Number.isFinite(num) ? num : fallback;
        };

        const parsed: { code: string; rawCost: number; ivaRate: number }[] = [];

        jsonRows.forEach((r) => {
          const code = normalizeVal(r, [
            'Código',
            'Codigo',
            'Código de Barras',
            'Codigo de Barras',
            'Código de Proveedor',
            'Codigo de Proveedor',
            'SKU',
            'Barcode',
            'Articulo',
            'Artículo',
          ]);
          const costRawStr = normalizeVal(r, [
            'Costo',
            'Precio Costo',
            'Precio de Costo',
            'Costo Lista',
            'Precio',
            'CostPrice',
          ]);
          const ivaStr = normalizeVal(r, [
            'IVA',
            '% IVA',
            'Alicuota IVA',
            'Alícuota IVA',
            'IvaRate',
          ]);

          const rawCost = parseNum(costRawStr, 0);
          const ivaRate = ivaStr !== '' ? parseNum(ivaStr, 21) : 21;

          if (code && rawCost > 0) {
            parsed.push({
              code: code.trim().toUpperCase(),
              rawCost,
              ivaRate: Math.max(0, ivaRate),
            });
          }
        });

        if (parsed.length === 0) {
          setCostOnlyError(
            'No se encontraron filas válidas. Verifique que el archivo tenga las 3 columnas: "Código", "Costo" e "IVA".'
          );
          setCostOnlyRawRows([]);
          return;
        }

        setCostOnlyRawRows(parsed);
        // Al seleccionar la lista de costos a cargar, abrir automáticamente el Cuadro de Diálogo de Configuración Pre-Importación
        setCostOnlyPreImportDialogOpen(true);
      } catch (err) {
        console.error(err);
        setCostOnlyError(
          'No se pudo leer el archivo. Verifique que sea un archivo Excel (.xlsx, .xls) o CSV válido.'
        );
      }
    };
    reader.readAsBinaryString(file);
  };

  // Cálculo reactivo de costos y precios de venta derivados solo para productos coincidentes
  const costOnlyCalculatedPreview = useMemo(() => {
    if (costOnlyRawRows.length === 0) return [];
    const extMeta = loadProductExtendedMetaMap();
    const discountNum = Math.min(
      99,
      Math.max(0, parseFloat(costOnlySupplierDiscountPct) || 0)
    );
    const discountFactor = discountNum / 100;

    return costOnlyRawRows.map((row) => {
      const codeUpper = row.code.trim().toUpperCase();

      // Buscar producto coincidente por SKU o por Código de Barras (priorizando el proveedor seleccionado)
      const matchedProduct =
        products.find((p) => {
          const skuMatch = p.sku.trim().toUpperCase() === codeUpper;
          const meta = extMeta[p.id];
          const barcodeMatch =
            (p.barcode || meta?.barcode || '').trim().toUpperCase() ===
            codeUpper;
          const sameSupplier =
            costOnlyModalSupplier &&
            (p.supplierName || '').trim().toLowerCase() ===
              costOnlyModalSupplier.name.trim().toLowerCase();
          return sameSupplier && (skuMatch || barcodeMatch);
        }) ||
        products.find((p) => {
          const skuMatch = p.sku.trim().toUpperCase() === codeUpper;
          const meta = extMeta[p.id];
          const barcodeMatch =
            (p.barcode || meta?.barcode || '').trim().toUpperCase() ===
            codeUpper;
          return skuMatch || barcodeMatch;
        });

      // 1. Aplicar Descuento del Proveedor (%) sobre el costo de lista
      const costAfterDiscount = row.rawCost * (1 - discountFactor);

      // 2. Aplicar IVA según el Switch "¿La lista incluye IVA?"
      // Si NO incluye IVA, se suma el porcentaje de la columna IVA (ej. 21%, 10.5%, 0%)
      const calculatedListCost = costOnlyIncludesIva
        ? costAfterDiscount
        : costAfterDiscount * (1 + row.ivaRate / 100);

      if (!matchedProduct) {
        return {
          code: row.code,
          rawCost: row.rawCost,
          ivaRate: row.ivaRate,
          matchedProduct: null,
          previousCost: 0,
          newUnitCost: Number(calculatedListCost.toFixed(2)),
          previousSalePrice: 0,
          newSalePrice: 0,
          bulkContentQty: 1,
          newBulkCost: Number(calculatedListCost.toFixed(2)),
        };
      }

      const prodMeta = extMeta[matchedProduct.id];
      const bulkQty =
        prodMeta?.unitsPerPackage && prodMeta.unitsPerPackage > 1
          ? prodMeta.unitsPerPackage
          : 1;

      const finalUnitCost =
        bulkQty > 1 ? calculatedListCost / bulkQty : calculatedListCost;

      const prevCost =
        parseFloat(String(matchedProduct.costPrice || '0')) || 0;
      const prevSale =
        parseFloat(String(matchedProduct.salePrice || '0')) || 0;
      const marginRatio =
        prevCost > 0 && prevSale > 0 ? prevSale / prevCost : 1.45;

      const newDerivedSalePrice = finalUnitCost * marginRatio;

      return {
        code: row.code,
        rawCost: row.rawCost,
        ivaRate: row.ivaRate,
        matchedProduct,
        previousCost: prevCost,
        newUnitCost: Number(finalUnitCost.toFixed(2)),
        previousSalePrice: prevSale,
        newSalePrice: Number(newDerivedSalePrice.toFixed(2)),
        bulkContentQty: bulkQty,
        newBulkCost: Number(calculatedListCost.toFixed(2)),
      };
    });
  }, [
    costOnlyRawRows,
    costOnlyIncludesIva,
    costOnlySupplierDiscountPct,
    products,
    costOnlyModalSupplier,
  ]);

  const matchedCostOnlyItems = useMemo(
    () =>
      costOnlyCalculatedPreview.filter((item) => item.matchedProduct !== null),
    [costOnlyCalculatedPreview]
  );

  const handleConfirmCostOnlyUpdate = async () => {
    if (!costOnlyModalSupplier) return;
    if (matchedCostOnlyItems.length === 0) {
      setCostOnlyError(
        'Ningún código del archivo coincide con productos existentes en el inventario.'
      );
      return;
    }

    setIsApplyingCostOnly(true);
    setCostOnlyError(null);

    try {
      const discountNum = Math.min(
        99,
        Math.max(0, parseFloat(costOnlySupplierDiscountPct) || 0)
      );

      // Si algún producto coincidente tiene configuración de bulto/fraccionado, actualizamos solo su costo unitario/fraccionado en metadata sin tocar el resto
      matchedCostOnlyItems.forEach((it) => {
        if (it.matchedProduct && it.bulkContentQty > 1) {
          saveProductExtendedMeta(it.matchedProduct.id, {
            unitFractionalCost: it.newUnitCost,
          });
        }
      });

      const labelParts = [
        `Costos actualizados hoy (${matchedCostOnlyItems.length} art.`,
        costOnlyIncludesIva ? 'IVA incl.' : '+IVA',
        discountNum > 0 ? `Dto. ${discountNum}%` : 'Sin dto.',
      ];
      const lastPriceUpdateLabel = `${labelParts.join(' · ')})`;

      const res = await fetch('/api/products/costs-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: costOnlyModalSupplier.id,
          lastPriceUpdateLabel,
          items: matchedCostOnlyItems.map((it) => ({
            id: it.matchedProduct!.id,
            sku: it.matchedProduct!.sku,
            costPrice: it.newUnitCost.toFixed(2),
            ivaRate: it.ivaRate.toFixed(2),
            salePrice: it.newSalePrice.toFixed(2),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'Error al actualizar costos de productos.'
        );
      }

      if (data.products) {
        onProductsUpdated(
          data.products,
          `Actualización exclusiva de costos completada para "${costOnlyModalSupplier.name}": ${matchedCostOnlyItems.length} productos actualizados (${
            costOnlyIncludesIva ? 'Lista con IVA' : 'Lista + IVA'
          }${
            discountNum > 0 ? `, Dto. ${discountNum}%` : ''
          }). Descripciones y categorías intactas.`
        );
      }
      if (data.suppliers) {
        onSuppliersUpdated(
          data.suppliers,
          `Lista de costos de "${costOnlyModalSupplier.name}" aplicada (${matchedCostOnlyItems.length} artículos coincidentes).`
        );
      }

      setCostOnlyPreImportDialogOpen(false);
      setCostOnlyModalSupplier(null);
    } catch (err: any) {
      console.error(err);
      setCostOnlyError(
        err.message || 'No se pudieron actualizar los costos.'
      );
    } finally {
      setIsApplyingCostOnly(false);
    }
  };


  // Combinar nombres de proveedores registrados y de productos para que ningún proveedor quede fuera de los selectores
  const allSupplierNames = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name?.trim()) set.add(s.name.trim());
    });
    products.forEach((p) => {
      if (p.supplierName?.trim()) set.add(p.supplierName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [suppliers, products]);

  const orderCategories = useMemo(() => {
    const set = new Set<string>();
    products
      .filter((p) => !orderSupplierName || p.supplierName === orderSupplierName)
      .forEach((p) => {
        if (p.category) set.add(p.category);
      });
    return ['Todas', ...Array.from(set)];
  }, [products, orderSupplierName]);

  const totalDebt = suppliers.reduce(
    (acc, s) => acc + (parseFloat(s.balance) || 0),
    0
  );

  const activeSupplierColsList = ALL_SUPPLIER_COLUMNS.filter(
    (c) => visibleSupplierCols[c.key]
  );

  const toggleSupplierCol = (key: SupplierColumnKey) => {
    const count = Object.values(visibleSupplierCols).filter(Boolean).length;
    if (visibleSupplierCols[key] && count <= 2) return;
    setVisibleSupplierCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* BANNER SUPERIOR DE ALERTA DE VENCIMIENTOS PRÓXIMOS O VENCIDOS */}
      {urgentDueSuppliers.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Alerta de Vencimientos de Proveedores ({urgentDueSuppliers.length}{' '}
                  {urgentDueSuppliers.length === 1
                    ? 'cuenta requiere atención'
                    : 'cuentas requieren atención'}
                  )
                </h4>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white">
                  ATENCIÓN DE TESORERÍA
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-700">
                {urgentDueSuppliers.map(({ supplier, due }) => (
                  <span
                    key={supplier.id}
                    className="inline-flex items-center gap-1.5 font-medium"
                  >
                    <strong className="text-slate-900">{supplier.name}:</strong>
                    <span className="font-mono font-semibold text-rose-700">
                      {formatCurrency(supplier.balance)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        due.urgency === 'overdue'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {due.badgeText} ({due.formattedDate})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleOpenQuickPaymentForSupplier(urgentDueSuppliers[0].supplier)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#FF6600]" />
            <span>Registrar Pago Ahora</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          VISTA 1: LISTADO PRINCIPAL DE PROVEEDORES
         ===================================================================== */}
      {activeSubTab === 'listado' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Proveedores Activos
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {suppliers.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Saldo Total Cuenta Corriente
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {formatCurrency(totalDebt)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Vencimientos Próximos (≤ 7 días / Vencidos)
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-rose-700 mt-1">
                  {urgentDueSuppliers.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Tabla de Proveedores */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-visible">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Barra de búsqueda */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar proveedor, CUIT..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white transition-colors"
                  />
                </div>

                {/* Filtro rápido por Proveedor */}
                <select
                  value={selectedSupplierQuickFilter}
                  onChange={(e) =>
                    setSelectedSupplierQuickFilter(e.target.value)
                  }
                  aria-label="Filtrar por Proveedor"
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Todos">Todos los proveedores</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Columnas + Acciones Rápidas */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative" ref={supplierColsRef}>
                  <button
                    type="button"
                    onClick={() => setSupplierColsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Columns3 className="w-4 h-4 text-slate-500" />
                    <span>
                      Columnas ({activeSupplierColsList.length}/
                      {ALL_SUPPLIER_COLUMNS.length})
                    </span>
                  </button>

                  {supplierColsOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-40">
                      <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Columnas Visibles
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleSupplierCols({
                              name: true,
                              balance: true,
                              nextDueDate: true,
                              cuit: true,
                              contactPhone: true,
                              email: true,
                              status: true,
                            })
                          }
                          className="text-[11px] font-semibold text-[#FF6600] hover:underline cursor-pointer"
                        >
                          Mostrar todas
                        </button>
                      </div>
                      <div className="py-1">
                        {ALL_SUPPLIER_COLUMNS.map((col) => {
                          const checked = visibleSupplierCols[col.key];
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => toggleSupplierCol(col.key)}
                              className="w-full px-3.5 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-50 cursor-pointer"
                            >
                              <span
                                className={
                                  checked
                                    ? 'font-semibold text-slate-900'
                                    : 'text-slate-500'
                                }
                              >
                                {col.label}
                              </span>
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border ${
                                  checked
                                    ? 'bg-[#FF6600] border-[#FF6600] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {checked && (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onOpenBulkImport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Importar Proveedores</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSupplierModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Nuevo Proveedor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenRegisterDebtForSupplier()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>+ Registrar Deuda / Vencimiento</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('pedidos')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Armar Pedido</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 select-none">
                    {activeSupplierColsList.map((col) => {
                      const isSorted = supplierSort.key === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleSortSupplierCol(col.key)}
                          title={`Haga clic para ordenar por ${col.label} (${
                            isSorted && supplierSort.direction === 'asc'
                              ? 'Descendente'
                              : 'Ascendente'
                          })`}
                          className={`py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100/90 transition-colors ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          <div
                            className={`inline-flex items-center gap-1.5 ${
                              col.align === 'right'
                                ? 'justify-end'
                                : 'justify-start'
                            }`}
                          >
                            <span
                              className={
                                isSorted ? 'text-slate-900 font-bold' : ''
                              }
                            >
                              {col.label}
                            </span>
                            {isSorted ? (
                              supplierSort.direction === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      Acciones Rápidas
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {paginatedSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeSupplierColsList.length + 1}
                        className="py-10 text-center text-slate-500"
                      >
                        No se encontraron proveedores para el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    paginatedSuppliers.map((sup) => {
                      const due = getSupplierDueInfo(sup);
                      const balNum = parseFloat(String(sup.balance || '0')) || 0;
                      const accountStatus =
                        sup.status ||
                        (balNum > 0
                          ? 'Saldo Pendiente'
                          : balNum < 0
                          ? 'Saldo a Favor'
                          : 'Al día');

                      const supCartItems = supplierCartsById[sup.id] || [];
                      const supCartItemsCount = supCartItems.length;
                      const supCartTotalUnits = supCartItems.reduce(
                        (acc, it) => acc + it.quantity,
                        0
                      );

                      return (
                        <tr
                          key={sup.id}
                          className={`hover:bg-slate-50/90 transition-colors ${
                            due.urgency === 'overdue'
                              ? 'bg-rose-50/30'
                              : due.urgency === 'soon'
                              ? 'bg-amber-50/20'
                              : ''
                          }`}
                        >
                          {visibleSupplierCols.name && (
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900">
                                {sup.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {sup.category} · {sup.lastPriceUpdate}
                              </div>
                            </td>
                          )}

                          {visibleSupplierCols.balance && (
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              <span
                                className={
                                  balNum > 0
                                    ? 'text-slate-900'
                                    : balNum < 0
                                    ? 'text-sky-700'
                                    : 'text-emerald-700'
                                }
                              >
                                {formatCurrency(sup.balance)}
                              </span>
                            </td>
                          )}

                          {visibleSupplierCols.nextDueDate && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {due.hasDue ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-800">
                                    {due.formattedDate}
                                  </span>
                                  {due.urgency === 'overdue' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                      <AlertCircle className="w-3 h-3 shrink-0" />
                                      <span>{due.badgeText}</span>
                                    </span>
                                  )}
                                  {due.urgency === 'soon' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span>{due.badgeText}</span>
                                    </span>
                                  )}
                                  {due.invoiceRef && (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      ({due.invoiceRef})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-emerald-700 font-medium">
                                  Al día (Sin vencimientos)
                                </span>
                              )}
                            </td>
                          )}

                          {visibleSupplierCols.cuit && (
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {sup.cuit}
                            </td>
                          )}

                          {visibleSupplierCols.contactPhone && (
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {sup.contactPhone}
                            </td>
                          )}

                          {visibleSupplierCols.email && (
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {sup.email}
                            </td>
                          )}

                          {visibleSupplierCols.status && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <StatusBadge status={accountStatus} />
                            </td>
                          )}

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {/* 1. BOTÓN DE CARRITO POR PROVEEDOR ("Carrito Actual" / "Ver Carrito") CON BADGE CONTADOR PERSISTENTE */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenSupplierCartFromTable(sup)
                                }
                                title={`Abrir Carrito Actual de ${sup.name} (${supCartItemsCount} ítems / ${supCartTotalUnits} u. guardadas)`}
                                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                                  supCartItemsCount > 0
                                    ? 'bg-[#FF6600] hover:bg-[#E65C00] text-white border-[#FF6600] shadow-xs ring-2 ring-[#FF6600]/20'
                                    : 'bg-orange-50/80 hover:bg-[#FF6600] text-slate-800 hover:text-white border-orange-300'
                                }`}
                              >
                                <span className="relative inline-flex items-center">
                                  <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                                  {supCartItemsCount > 0 && (
                                    <span className=" -top-2 -right-2 ml-1 px-1.5 py-0.2 rounded-full bg-slate-900 text-white font-mono text-[10px] font-extrabold leading-tight">
                                      {supCartItemsCount}
                                    </span>
                                  )}
                                </span>
                                <span>
                                  {supCartItemsCount > 0
                                    ? `Ver Carrito (${supCartItemsCount})`
                                    : 'Carrito Actual (0)'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenSupplierCostOnlyModal(sup)
                                }
                                title="Importar plantilla simplificada de 3 columnas (Código, Costo, IVA) para actualizar exclusivamente costos y precios derivados de este proveedor"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                              >
                                <Calculator className="w-3.5 h-3.5 shrink-0" />
                                <span>Actualizar Solo Precios / Costos</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenRegisterDebtForSupplier(sup)
                                }
                                title="Registrar factura o deuda pasada, actual o futura en la cuenta corriente del proveedor"
                                className="px-2.5 py-1 rounded-md bg-orange-50 hover:bg-[#FF6600] text-[#FF6600] hover:text-white border border-orange-200 text-xs font-bold transition-colors cursor-pointer"
                              >
                                + Registrar Deuda / Vencimiento
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectOrderSupplier(sup.name);
                                  setActiveSubTab('pedidos');
                                }}
                                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-[#FF6600] text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Hacer Pedido
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenQuickPaymentForSupplier(sup)
                                }
                                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Registrar Pago
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectReturnSupplier(sup.name);
                                  setActiveSubTab('devoluciones');
                                }}
                                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-rose-600 text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Devolver
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePaginationBar
              totalItems={filteredSuppliers.length}
              currentPage={supplierPage}
              pageSize={supplierPageSize}
              onPageChange={setSupplierPage}
              onPageSizeChange={(size) => {
                setSupplierPageSize(size);
                setSupplierPage(1);
              }}
              itemLabel="proveedores"
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 1B: CALENDARIO VISUAL DE VENCIMIENTOS, GASTOS GENERALES Y EGRESOS OPERATIVOS
         ===================================================================== */}
      {activeSubTab === 'calendario' && (
        <OrdersModule
          mode="calendar"
          suppliers={suppliers}
          orders={purchaseOrders}
          installments={installments}
          returnsHistory={returnsHistory}
          paymentHistory={paymentHistory}
          treasuryAccounts={treasuryAccounts}
          onUpdateTreasuryAccounts={setTreasuryAccounts}
          cashflowTransactions={cashflowTransactions}
          onAddCashflowEntry={(entry) =>
            setCashflowTransactions((prev) => [entry, ...prev])
          }
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onRegisterOrderPayment={handleRegisterOrderPayment}
          onUpdateInstallmentStatusOrPayment={
            handleUpdateInstallmentStatusOrPayment
          }
          onAddInstallment={handleAddInstallment}
          onGoToCreateOrder={() => setActiveSubTab('pedidos')}
          formatCurrency={formatCurrency}
        />
      )}

      {/* =====================================================================
          VISTA 1C: GESTIÓN GENERAL DE PEDIDOS DE TODOS LOS PROVEEDORES
         ===================================================================== */}
      {activeSubTab === 'gestion-pedidos' && (
        <OrdersModule
          mode="orders"
          suppliers={suppliers}
          orders={purchaseOrders}
          installments={installments}
          returnsHistory={returnsHistory}
          paymentHistory={paymentHistory}
          treasuryAccounts={treasuryAccounts}
          onUpdateTreasuryAccounts={setTreasuryAccounts}
          cashflowTransactions={cashflowTransactions}
          onAddCashflowEntry={(entry) =>
            setCashflowTransactions((prev) => [entry, ...prev])
          }
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onRegisterOrderPayment={handleRegisterOrderPayment}
          onUpdateInstallmentStatusOrPayment={
            handleUpdateInstallmentStatusOrPayment
          }
          onAddInstallment={handleAddInstallment}
          onGoToCreateOrder={() => setActiveSubTab('pedidos')}
          formatCurrency={formatCurrency}
        />
      )}

      {/* =====================================================================
          VISTA 1D: HISTORIAL UNIFICADO DE OPERACIONES (PEDIDOS, DEVOLUCIONES Y PAGOS)
         ===================================================================== */}
      {activeSubTab === 'historial-operaciones' && (
        <OrdersModule
          mode="history"
          suppliers={suppliers}
          orders={purchaseOrders}
          installments={installments}
          returnsHistory={returnsHistory}
          paymentHistory={paymentHistory}
          treasuryAccounts={treasuryAccounts}
          onUpdateTreasuryAccounts={setTreasuryAccounts}
          cashflowTransactions={cashflowTransactions}
          onAddCashflowEntry={(entry) =>
            setCashflowTransactions((prev) => [entry, ...prev])
          }
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onRegisterOrderPayment={handleRegisterOrderPayment}
          onUpdateInstallmentStatusOrPayment={
            handleUpdateInstallmentStatusOrPayment
          }
          onAddInstallment={handleAddInstallment}
          onGoToCreateOrder={() => setActiveSubTab('pedidos')}
          formatCurrency={formatCurrency}
        />
      )}

      {/* =====================================================================
          VISTA 2: CARRITO DE COMPRAS / GENERADOR DE PEDIDOS A PROVEEDORES
         ===================================================================== */}
      {activeSubTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Banner de Comprobante Recién Generado con Enlace Directo wa.me + Vista Previa PDF */}
          {lastOrderVoucher && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-emerald-950">
                    Pedido Confirmado: {lastOrderVoucher.docNumber} —{' '}
                    {lastOrderVoucher.supplierName} (
                    {formatCurrency(lastOrderVoucher.totalAmount)})
                  </span>
                </div>
                <p className="text-xs text-emerald-800">
                  Acciones rápidas del comprobante generado:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={buildDirectWhatsAppUrl(lastOrderVoucher, formatCurrency)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp (wa.me Directo)</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVoucherModal({
                      data: lastOrderVoucher,
                      initialTab: 'whatsapp',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Personalizar Mensaje WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVoucherModal({
                      data: lastOrderVoucher,
                      initialTab: 'pdf',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVoucherModal({
                      data: lastOrderVoucher,
                      initialTab: 'pdf',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* Paso 1: Selector Obligatorio de Proveedor */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#FF6600]">
                1. Seleccione Proveedor Obligatorio para Iniciar el Pedido *
              </label>
              <p className="text-xs text-slate-500">
                El catálogo filtrará exclusivamente los artículos asignados al
                proveedor seleccionado. Haga 1 clic en cualquier fila para
                agregarla al carrito.
              </p>
            </div>

            <div className="w-full md:w-96">
              <select
                value={orderSupplierName}
                onChange={(e) => handleSelectOrderSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 border-2 border-slate-300 focus:border-[#FF6600] rounded-xl text-slate-900 focus:outline-none"
              >
                <option value="">
                  -- Seleccione un Proveedor para ver sus productos --
                </option>
                {allSupplierNames.map((supName) => {
                  const sId = resolveSupplierIdByName(supName);
                  const savedCount = (supplierCartsById[sId] || []).length;
                  return (
                    <option key={supName} value={supName}>
                      {supName}
                      {savedCount > 0 ? ` (🛒 ${savedCount} ítems guardados)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {!orderSupplierName ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center space-y-2">
              <Truck className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                Seleccione un Proveedor arriba para comenzar el pedido
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Al elegir un proveedor se listarán únicamente sus productos con
                control de stock activo en estado Sin Stock (≤ 0) o Stock Bajo
                (≤ Stock Mínimo).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LADO IZQUIERDO: Catálogo del Proveedor (Columnas por defecto: Código, Descripción, Stock, Stock Mínimo) */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Artículos de {orderSupplierName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Haga clic en cualquier artículo para agregarlo
                        directamente al Carrito de Compras
                      </p>
                    </div>

                    {/* Selector rápido de columnas opcionales */}
                    <div className="flex items-center gap-1.5">
                      {ALL_ORDER_PRODUCT_COLUMNS.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() =>
                            setVisibleOrderCols((prev) => ({
                              ...prev,
                              [col.key]: !prev[col.key],
                            }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            visibleOrderCols[col.key]
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Barra de filtros estándar del Maestro de Productos */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        placeholder="Buscar por código o descripción..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>

                    <select
                      value={orderCategoryFilter}
                      onChange={(e) => setOrderCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      {orderCategories.map((c) => (
                        <option key={c} value={c}>
                          {c === 'Todas' ? 'Todas las categorías' : c}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      {[
                        {
                          id: 'reposicion',
                          label: 'Para Reponer (Sin Stock + Stock Bajo)',
                        },
                        { id: 'sin-stock', label: 'Sin Stock (≤ 0)' },
                        { id: 'stock-bajo', label: 'Stock Bajo (≤ Mín.)' },
                        { id: 'todos', label: 'Todos del Proveedor' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setOrderStockFilter(f.id as any)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            orderStockFilter === f.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 z-10 select-none">
                      <tr>
                        {ALL_ORDER_PRODUCT_COLUMNS.filter(
                          (col) => visibleOrderCols[col.key]
                        ).map((col) => {
                          const isSorted = orderSort.key === col.key;
                          return (
                            <th
                              key={col.key}
                              onClick={() => handleSortOrderCol(col.key)}
                              className={`py-2.5 px-3.5 cursor-pointer hover:bg-slate-100/90 transition-colors whitespace-nowrap ${
                                col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                            >
                              <div
                                className={`inline-flex items-center gap-1 ${
                                  col.align === 'right'
                                    ? 'justify-end'
                                    : 'justify-start'
                                }`}
                              >
                                <span>{col.label}</span>
                                {isSorted ? (
                                  orderSort.direction === 'asc' ? (
                                    <ArrowUp className="w-3 h-3 text-[#FF6600]" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 text-[#FF6600]" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {paginatedOrderProducts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-10 text-center text-slate-500"
                          >
                            No hay productos en este filtro para{' '}
                            <strong>{orderSupplierName}</strong>. Puede cambiar
                            a la pestaña "Todos del Proveedor" para ver el
                            catálogo completo.
                          </td>
                        </tr>
                      ) : (
                        paginatedOrderProducts.map((prod) => {
                          const cleanName = prod.name
                            .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
                            .trim();
                          const inCart = orderCart.find(
                            (c) => c.productId === prod.id
                          );
                          const isOut =
                            prod.trackStock !== false && prod.stock <= 0;
                          const isLow =
                            prod.trackStock !== false &&
                            prod.stock > 0 &&
                            prod.stock <= prod.minStock;

                          return (
                            <tr
                              key={prod.id}
                              onClick={() => handleAddProductToOrderCart(prod)}
                              title="Haga clic para agregar al Carrito Persistente del Proveedor"
                              className={`cursor-pointer transition-colors ${
                                inCart
                                  ? 'bg-orange-50/70 hover:bg-orange-100/70'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {visibleOrderCols.sku && (
                                <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span>{prod.sku}</span>
                                    {inCart && (
                                      <span className="px-1.5 py-0.2 rounded bg-[#FF6600] text-white text-[10px] font-bold">
                                        En carrito ({inCart.quantity})
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}

                              {visibleOrderCols.name && (
                                <td className="py-2.5 px-3.5 font-medium text-slate-900">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span>{cleanName}</span>
                                    {isOut && (
                                      <StatusBadge status="SIN STOCK" />
                                    )}
                                    {isLow && (
                                      <StatusBadge status="STOCK BAJO" />
                                    )}
                                    {inCart && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-[#FF6600] border border-orange-200">
                                        <ShoppingCart className="w-3 h-3 shrink-0" />
                                        <span>En Carrito ({inCart.quantity} u.)</span>
                                      </span>
                                    )}
                                    {(prod.orderedQty ?? 0) > 0 && (
                                      <StatusBadge
                                        status={`PEDIDO (${prod.orderedQty} u.)`}
                                      />
                                    )}
                                  </div>
                                </td>
                              )}

                              {visibleOrderCols.stock && (
                                <td
                                  className={`py-2.5 px-3.5 text-right font-mono font-bold whitespace-nowrap ${
                                    isOut
                                      ? 'text-rose-700'
                                      : isLow
                                      ? 'text-amber-800'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {prod.trackStock !== false ? prod.stock : '-'}
                                </td>
                              )}

                              {visibleOrderCols.minStock && (
                                <td className="py-2.5 px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                                  {prod.trackStock !== false
                                    ? prod.minStock
                                    : '-'}
                                </td>
                              )}

                              {visibleOrderCols.costPrice && (
                                <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 whitespace-nowrap">
                                  {formatCurrency(prod.costPrice)}
                                </td>
                              )}

                              {visibleOrderCols.category && (
                                <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                                  {prod.category}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <TablePaginationBar
                  totalItems={supplierOrderProducts.length}
                  currentPage={orderPage}
                  pageSize={orderPageSize}
                  onPageChange={setOrderPage}
                  onPageSizeChange={(size) => {
                    setOrderPageSize(size);
                    setOrderPage(1);
                  }}
                  itemLabel="productos"
                />
              </div>

              {/* LADO DERECHO: Panel del Carrito Fijo */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 sticky top-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Carrito de Pedido
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Proveedor: <strong>{orderSupplierName}</strong>
                      </p>
                    </div>
                  </div>
                  {orderCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOrderCart([])}
                      className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {orderCart.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <ShoppingCart className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      El carrito está vacío
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Haga un clic sobre cualquier producto de la tabla
                      izquierda para sumarlo al pedido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {orderCart.map((item) => (
                      <div
                        key={item.productId}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[11px] font-bold text-[#FF6600]">
                              {item.sku}
                            </span>
                            <p className="text-xs font-semibold text-slate-900 leading-snug">
                              {item.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setOrderCart((prev) =>
                                prev.filter(
                                  (c) => c.productId !== item.productId
                                )
                              )
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Cantidad a pedir
                            </label>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setOrderCart((prev) =>
                                    prev.map((c) =>
                                      c.productId === item.productId
                                        ? {
                                            ...c,
                                            quantity: Math.max(
                                              1,
                                              c.quantity - 1
                                            ),
                                          }
                                        : c
                                    )
                                  )
                                }
                                className="px-2 py-1 bg-white border border-slate-200 rounded-l text-xs font-bold cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1
                                  );
                                  setOrderCart((prev) =>
                                    prev.map((c) =>
                                      c.productId === item.productId
                                        ? { ...c, quantity: val }
                                        : c
                                    )
                                  );
                                }}
                                className="w-14 py-1 text-center font-mono text-xs font-bold bg-white border-y border-slate-200 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setOrderCart((prev) =>
                                    prev.map((c) =>
                                      c.productId === item.productId
                                        ? { ...c, quantity: c.quantity + 1 }
                                        : c
                                    )
                                  )
                                }
                                className="px-2 py-1 bg-white border border-slate-200 rounded-r text-xs font-bold cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Costo Unit. (ARS)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  parseFloat(e.target.value) || 0
                                );
                                setOrderCart((prev) =>
                                  prev.map((c) =>
                                    c.productId === item.productId
                                      ? { ...c, unitCost: val }
                                      : c
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 text-right font-mono text-xs font-semibold bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                          <span className="text-slate-500">
                            Stock actual: {item.currentStock} / Mín:{' '}
                            {item.minStock}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            Subtotal:{' '}
                            {formatCurrency(item.quantity * item.unitCost)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observaciones / Condición de Entrega
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ej. Entrega en depósito central..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900 text-white">
                    <span className="text-xs font-semibold">
                      Total Estimado Orden
                    </span>
                    <span className="text-base font-mono font-bold text-[#FF6600]">
                      {formatCurrency(orderTotalAmount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={orderCart.length === 0 || isSubmittingOrder}
                    onClick={handleConfirmPurchaseOrder}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {isSubmittingOrder
                      ? 'Confirmando Pedido...'
                      : 'Confirmar Pedido / Confirmar Carrito'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VISTA 3: MÓDULO DE INGRESO DE PAGOS A PROVEEDORES
         ===================================================================== */}
      {activeSubTab === 'pagos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulario de Nuevo Pago a Proveedor */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Registrar Nuevo Pago a Proveedor
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccione el proveedor, verifique sus comprobantes pendientes
                  e impute el pago en su Cuenta Corriente.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmSupplierPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proveedor *
                </label>
                <select
                  required
                  value={paymentSupplierId}
                  onChange={(e) => setPaymentSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="">-- Seleccione un Proveedor --</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={String(sup.id)}>
                      {sup.name} — Saldo: {formatCurrency(sup.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPaymentSupplier && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Saldo Actual en Cuenta Corriente:
                    </span>
                    <span className="text-base font-mono font-bold text-slate-900">
                      {formatCurrency(selectedPaymentSupplier.balance)}
                    </span>
                  </div>

                  {(() => {
                    const due = getSupplierDueInfo(selectedPaymentSupplier);
                    return due.hasDue ? (
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                        <span className="text-slate-600 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>Comprobante Pendiente: {due.invoiceRef}</span>
                        </span>
                        <span className="font-mono font-semibold text-rose-700">
                          Vto: {due.formattedDate} ({due.badgeText})
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 font-medium">
                        Proveedor sin facturas vencidas pendientes.
                      </p>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto Abonado (ARS) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="0.01"
                    placeholder="Ej. 450000.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Medio de Pago *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Transferencia Bancaria">
                      Transferencia Bancaria
                    </option>
                    <option value="Efectivo Caja Central">
                      Efectivo Caja Central
                    </option>
                    <option value="Cheque Propio / Terceros">
                      Cheque Propio / Terceros
                    </option>
                    <option value="eCheq Bancario">eCheq Bancario</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Pago
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nro. Comprobante / Nota Adjunta
                  </label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Ej. Comprobante CBU #98211 / Cheque #4012"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              {/* Captura desde cámara del celular o adjunto de foto/PDF del comprobante de pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Foto / Comprobante de Pago (Cámara del Celular, Imagen o PDF)
                </label>
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-[#FF6600] rounded-xl bg-slate-50 hover:bg-orange-50/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Camera className="w-4 h-4 text-[#FF6600]" />
                    <Upload className="w-4 h-4 text-[#FF6600]" />
                    <span>
                      {paymentAttachment
                        ? `Comprobante cargado: ${paymentAttachment.name}`
                        : 'Tomar foto del comprobante / boleta o elegir imagen / PDF'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    En celulares abre directamente la cámara o permite elegir de galería / PDF
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={handlePaymentAttachmentChange}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={!selectedPaymentSupplier || isSubmittingPayment}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isSubmittingPayment
                  ? 'Imputando Pago en Cuenta Corriente...'
                  : 'Confirmar Orden de Pago y Actualizar Saldo'}
              </button>
            </form>
          </div>

          {/* Historial Reciente de Órdenes de Pago Emitidas con Descargar PDF y Enviar por WhatsApp */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#FF6600]" />
                <h4 className="text-sm font-bold text-slate-900">
                  Órdenes de Pago Registradas (Comprobantes PDF / WhatsApp)
                </h4>
              </div>
              <span className="text-xs text-slate-500">
                {paymentHistory.length} pagos
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {paymentHistory.map((pay) => (
                <div
                  key={pay.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#FF6600]">
                        {pay.receiptNumber}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-mono text-slate-500">
                        {pay.date}
                      </span>
                      <StatusBadge status={pay.status || 'Saldado'} />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5">
                      {pay.supplierName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {pay.paymentMethod} — {pay.note}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center sm:justify-end gap-2">
                    <span className="font-mono font-bold text-emerald-700 text-sm whitespace-nowrap mr-1">
                      - {formatCurrency(pay.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPaymentVoucherModal(pay, 'pdf')}
                      title="Descargar PDF / Imprimir Comprobante de Pago"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Descargar PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openPaymentVoucherModal(pay, 'whatsapp')}
                      title="Enviar Comprobante de Pago por WhatsApp"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 4: MÓDULO / GESTIÓN DE DEVOLUCIONES A PROVEEDORES
         ===================================================================== */}
      {activeSubTab === 'devoluciones' && (
        <div className="space-y-4">
          {/* Banner de Comprobante de Devolución Recién Generado con Enlace Directo wa.me + Vista Previa PDF */}
          {lastReturnVoucher && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-rose-950">
                    Devolución Registrada: {lastReturnVoucher.docNumber} —{' '}
                    {lastReturnVoucher.supplierName} (
                    {formatCurrency(lastReturnVoucher.totalAmount)})
                  </span>
                </div>
                <p className="text-xs text-rose-800">
                  Acciones rápidas del comprobante generado:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={buildDirectWhatsAppUrl(
                    lastReturnVoucher,
                    formatCurrency
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp (wa.me Directo)</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVoucherModal({
                      data: lastReturnVoucher,
                      initialTab: 'whatsapp',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Personalizar Mensaje WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVoucherModal({
                      data: lastReturnVoucher,
                      initialTab: 'pdf',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVoucherModal({
                      data: lastReturnVoucher,
                      initialTab: 'pdf',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* 1. Selector de Proveedor Obligatorio */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-600">
                1. Seleccione el Proveedor para Iniciar la Devolución *
              </label>
              <p className="text-xs text-slate-500">
                Al confirmar la devolución, se descontarán las unidades del
                Stock Actual y se acreditará el monto en el Saldo de Cuenta
                Corriente del proveedor.
              </p>
            </div>

            <div className="w-full md:w-96">
              <select
                value={returnSupplierName}
                onChange={(e) => handleSelectReturnSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 border-2 border-slate-300 focus:border-[#FF6600] rounded-xl text-slate-900 focus:outline-none"
              >
                <option value="">
                  -- Seleccione Proveedor al cual reintegrar artículos --
                </option>
                {allSupplierNames.map((supName) => (
                  <option key={supName} value={supName}>
                    {supName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!returnSupplierName ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center space-y-2">
              <RotateCcw className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                Seleccione un Proveedor para ver sus productos y cargar la
                devolución
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Con un solo clic en cualquier artículo de la lista se agregará
                al panel derecho de devolución.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 2. Lista de Selección de Artículos (Columnas por defecto: Código, Descripción, Stock Actual y Precio Costo) */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Catálogo de Artículos — {returnSupplierName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Haga 1 clic en un artículo para sumarlo a la Lista /
                        Carrito de Devolución
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={returnSearchQuery}
                        onChange={(e) => setReturnSearchQuery(e.target.value)}
                        placeholder="Buscar por código o descripción..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      {[
                        { id: 'todos', label: 'Todos del Proveedor' },
                        { id: 'con-stock', label: 'Con Stock (> 0)' },
                        { id: 'controla-stock', label: 'Con Control de Stock' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setReturnStockFilter(f.id as any)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            returnStockFilter === f.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 z-10 select-none">
                      <tr>
                        {ALL_RETURN_PRODUCT_COLUMNS.filter(
                          (c) => visibleReturnCols[c.key]
                        ).map((col) => {
                          const isSorted = returnSort.key === col.key;
                          return (
                            <th
                              key={col.key}
                              onClick={() => handleSortReturnCol(col.key)}
                              className={`py-2.5 px-3.5 cursor-pointer hover:bg-slate-100/90 transition-colors whitespace-nowrap ${
                                col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                            >
                              <div
                                className={`inline-flex items-center gap-1 ${
                                  col.align === 'right'
                                    ? 'justify-end'
                                    : 'justify-start'
                                }`}
                              >
                                <span>{col.label}</span>
                                {isSorted ? (
                                  returnSort.direction === 'asc' ? (
                                    <ArrowUp className="w-3 h-3 text-[#FF6600]" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 text-[#FF6600]" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {paginatedReturnProducts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-10 text-center text-slate-500"
                          >
                            No se encontraron productos asignados a{' '}
                            <strong>{returnSupplierName}</strong> con el filtro
                            actual.
                          </td>
                        </tr>
                      ) : (
                        paginatedReturnProducts.map((prod) => {
                          const cleanName = prod.name
                            .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
                            .trim();
                          const inReturnCart = returnCart.find(
                            (c) => c.productId === prod.id
                          );

                          return (
                            <tr
                              key={prod.id}
                              onClick={() =>
                                handleAddProductToReturnCart(prod)
                              }
                              title="Haga clic para agregar al Carrito de Devolución"
                              className={`cursor-pointer transition-colors ${
                                inReturnCart
                                  ? 'bg-rose-50/70 hover:bg-rose-100/70'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {visibleReturnCols.sku && (
                                <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span>{prod.sku}</span>
                                    {inReturnCart && (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-bold">
                                        A devolver ({inReturnCart.quantity})
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}

                              {visibleReturnCols.name && (
                                <td className="py-2.5 px-3.5 font-medium text-slate-900">
                                  {cleanName}
                                </td>
                              )}

                              {visibleReturnCols.stock && (
                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {prod.trackStock !== false ? prod.stock : '-'}
                                </td>
                              )}

                              {visibleReturnCols.costPrice && (
                                <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                                  {formatCurrency(prod.costPrice)}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <TablePaginationBar
                  totalItems={supplierReturnProducts.length}
                  currentPage={returnPage}
                  pageSize={returnPageSize}
                  onPageChange={setReturnPage}
                  onPageSizeChange={(size) => {
                    setReturnPageSize(size);
                    setReturnPage(1);
                  }}
                  itemLabel="productos"
                />
              </div>

              {/* 3. Panel de Devolución (Lado Derecho) */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 sticky top-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Lista / Carrito de Devolución
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Proveedor: <strong>{returnSupplierName}</strong>
                      </p>
                    </div>
                  </div>
                  {returnCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setReturnCart([])}
                      className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {returnCart.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <RotateCcw className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      Sin artículos seleccionados para devolver
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Haga clic sobre cualquier artículo del catálogo izquierdo
                      para agregarlo a la devolución.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {returnCart.map((item) => (
                      <div
                        key={item.productId}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[11px] font-bold text-rose-600">
                              {item.sku}
                            </span>
                            <p className="text-xs font-semibold text-slate-900 leading-snug">
                              {item.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setReturnCart((prev) =>
                                prev.filter(
                                  (c) => c.productId !== item.productId
                                )
                              )
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Cantidad a devolver
                            </label>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setReturnCart((prev) =>
                                    prev.map((c) =>
                                      c.productId === item.productId
                                        ? {
                                            ...c,
                                            quantity: Math.max(
                                              1,
                                              c.quantity - 1
                                            ),
                                          }
                                        : c
                                    )
                                  )
                                }
                                className="px-2 py-1 bg-white border border-slate-200 rounded-l text-xs font-bold cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1
                                  );
                                  setReturnCart((prev) =>
                                    prev.map((c) =>
                                      c.productId === item.productId
                                        ? { ...c, quantity: val }
                                        : c
                                    )
                                  );
                                }}
                                className="w-14 py-1 text-center font-mono text-xs font-bold bg-white border-y border-slate-200 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setReturnCart((prev) =>
                                    prev.map((c) =>
                                      c.productId === item.productId
                                        ? { ...c, quantity: c.quantity + 1 }
                                        : c
                                    )
                                  )
                                }
                                className="px-2 py-1 bg-white border border-slate-200 rounded-r text-xs font-bold cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="block text-[10px] text-slate-500">
                              Stock post-devolución:{' '}
                              <strong>
                                {item.currentStock - item.quantity} u.
                              </strong>
                            </span>
                            <span className="font-mono text-xs font-bold text-rose-700">
                              {formatCurrency(item.quantity * item.unitCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Motivo de Devolución *
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    >
                      {RETURN_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Detalle / Nro. Remito Asociado
                    </label>
                    <input
                      type="text"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Ej. Reclamo por falla de lote..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-rose-950 text-white">
                    <span className="text-xs font-semibold">
                      Total a Acreditar / Descontar
                    </span>
                    <span className="text-base font-mono font-bold text-rose-300">
                      {formatCurrency(returnTotalCredit)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={returnCart.length === 0 || isSubmittingReturn}
                    onClick={handleConfirmSupplierReturn}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {isSubmittingReturn
                      ? 'Registrando Devolución...'
                      : 'Registrar Devolución (Descontar Stock y Cta. Cte.)'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Comprobante PDF / Impresión y Envío por WhatsApp */}
      {activeVoucherModal && (
        <VoucherActionModal
          voucher={activeVoucherModal.data}
          initialTab={activeVoucherModal.initialTab}
          onClose={() => setActiveVoucherModal(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Modal: Agendar Vencimiento / Deudas y Gastos Operativos */}
      {supplierDebtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Agendar Vencimiento / Deudas y Egresos Operativos
                </h3>
                <p className="text-xs text-slate-500">
                  Categorice gastos generales, compras a proveedores, servicios,
                  alquileres, sueldos, impuestos o gastos recurrentes e impacte en
                  Caja / Cashflow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierDebtModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmSupplierDebtForm}
              className="space-y-3.5"
            >
              {/* 1. Categorización de Egresos: Tipo de Egreso */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Egreso *
                </label>
                <select
                  value={supplierDebtForm.expenseCategory}
                  onChange={(e) => {
                    const nextCat = e.target.value as ExpenseCategoryType;
                    const isSup =
                      nextCat === 'Compra a Proveedor / Mercadería';
                    setSupplierDebtForm((prev) => ({
                      ...prev,
                      expenseCategory: nextCat,
                      beneficiaryMode: isSup ? 'supplier' : 'custom',
                    }));
                  }}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Concepto / Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Concepto / Descripción *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Luz Local Comercial - Período Septiembre"
                  value={supplierDebtForm.concept}
                  onChange={(e) =>
                    setSupplierDebtForm({
                      ...supplierDebtForm,
                      concept: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              {/* 3. Entidad / Beneficiario */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Entidad / Beneficiario *
                  </label>
                  <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() =>
                        setSupplierDebtForm((prev) => ({
                          ...prev,
                          beneficiaryMode: 'supplier',
                        }))
                      }
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        supplierDebtForm.beneficiaryMode === 'supplier'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      Selector de Proveedor
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupplierDebtForm((prev) => ({
                          ...prev,
                          beneficiaryMode: 'custom',
                        }))
                      }
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        supplierDebtForm.beneficiaryMode === 'custom'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      Empresa de Servicio / Empleado / Libre
                    </button>
                  </div>
                </div>

                {supplierDebtForm.beneficiaryMode === 'supplier' ? (
                  <select
                    required
                    value={supplierDebtForm.supplierId}
                    onChange={(e) =>
                      setSupplierDebtForm({
                        ...supplierDebtForm,
                        supplierId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} (Saldo actual: {formatCurrency(s.balance)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Ej. Edenor S.A., Metrogas, Telecom, AFIP/ARCA, Empleado..."
                    value={supplierDebtForm.customBeneficiary}
                    onChange={(e) =>
                      setSupplierDebtForm({
                        ...supplierDebtForm,
                        customBeneficiary: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                )}
              </div>

              {/* 4. Monto a Pagar, Fecha de Vencimiento y Comprobante */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto a Pagar (ARS) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="0.01"
                    placeholder="Ej. 195000.00"
                    value={supplierDebtForm.totalAmount}
                    onChange={(e) =>
                      setSupplierDebtForm({
                        ...supplierDebtForm,
                        totalAmount: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Vencimiento *
                  </label>
                  <input
                    type="date"
                    required
                    value={supplierDebtForm.dueDate}
                    onChange={(e) =>
                      setSupplierDebtForm({
                        ...supplierDebtForm,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-orange-50/60 border border-[#FF6600] rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nro. Comprobante / Ref.
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. FC-A 0001-0004810"
                    value={supplierDebtForm.docRef}
                    onChange={(e) =>
                      setSupplierDebtForm({
                        ...supplierDebtForm,
                        docRef: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              {/* 5. Estado de Pago: Pendiente, Pagado, Parcial, Vencido */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Estado de Pago *
                    </label>
                    <select
                      value={supplierDebtForm.status}
                      onChange={(e) =>
                        setSupplierDebtForm({
                          ...supplierDebtForm,
                          status: e.target.value as
                            | 'Pendiente'
                            | 'Pagado'
                            | 'Parcial'
                            | 'Vencido',
                        })
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Pagado">
                        Pagado (Descontar de Caja / Banco)
                      </option>
                      <option value="Parcial">Parcial (Entrega a cuenta)</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>

                  {supplierDebtForm.status === 'Parcial' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Monto Abonado Ahora (ARS)
                      </label>
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        placeholder="Ej. 50000"
                        value={supplierDebtForm.partialPaidAmount}
                        onChange={(e) =>
                          setSupplierDebtForm({
                            ...supplierDebtForm,
                            partialPaidAmount: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  )}
                </div>

                {(supplierDebtForm.status === 'Pagado' ||
                  supplierDebtForm.status === 'Parcial') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-emerald-900 mb-1">
                        Descontar de Caja Chica / Cuenta Bancaria *
                      </label>
                      <select
                        value={supplierDebtForm.accountId}
                        onChange={(e) =>
                          setSupplierDebtForm({
                            ...supplierDebtForm,
                            accountId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-lg focus:outline-none"
                      >
                        {treasuryAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Medio de Pago
                      </label>
                      <select
                        value={supplierDebtForm.paymentMethod}
                        onChange={(e) =>
                          setSupplierDebtForm({
                            ...supplierDebtForm,
                            paymentMethod: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none"
                      >
                        <option value="Efectivo / Caja Chica">
                          Efectivo / Caja Chica
                        </option>
                        <option value="Transferencia Bancaria">
                          Transferencia Bancaria
                        </option>
                        <option value="Débito Automático / VEP">
                          Débito Automático / VEP
                        </option>
                        <option value="eCheq / Cheque">eCheq / Cheque</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Switch / Checkbox: ¿Es un gasto recurrente? (Mensual, Bimensual, Anual) */}
              <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supplierDebtForm.isRecurring}
                    onChange={(e) =>
                      setSupplierDebtForm({
                        ...supplierDebtForm,
                        isRecurring: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-[#FF6600]" />
                      <span>¿Es un gasto recurrente?</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Autoregenera la alerta automáticamente en el próximo período
                    </p>
                  </div>
                </label>

                {supplierDebtForm.isRecurring && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      Frecuencia:
                    </span>
                    <select
                      value={supplierDebtForm.recurrenceFrequency}
                      onChange={(e) =>
                        setSupplierDebtForm({
                          ...supplierDebtForm,
                          recurrenceFrequency: e.target
                            .value as ExpenseRecurrenceFrequency,
                        })
                      }
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-orange-300 rounded-lg text-slate-900 focus:outline-none"
                    >
                      <option value="Mensual">Mensual</option>
                      <option value="Bimensual">Bimensual</option>
                      <option value="Anual">Anual</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones Adicionales
                </label>
                <input
                  type="text"
                  placeholder="Ej. Medidor comercial / Nro. de cliente / Detalle interno..."
                  value={supplierDebtForm.notes}
                  onChange={(e) =>
                    setSupplierDebtForm({
                      ...supplierDebtForm,
                      notes: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adjuntar / Tomar Foto de la Boleta o Factura (Cámara, Galería o PDF)
                </label>
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-[#FF6600] rounded-xl bg-slate-50 hover:bg-orange-50/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Camera className="w-4 h-4 text-[#FF6600]" />
                    <Upload className="w-4 h-4 text-[#FF6600]" />
                    <span>
                      {supplierDebtForm.attachmentName
                        ? `Archivo adjunto: ${supplierDebtForm.attachmentName}`
                        : 'Tomar foto con cámara del celular o subir imagen / PDF'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={handleSupplierDebtAttachmentChange}
                    className="hidden"
                  />
                </label>

                {supplierDebtForm.attachmentUrl && (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between gap-3">
                    {supplierDebtForm.attachmentType === 'image' ? (
                      <img
                        src={supplierDebtForm.attachmentUrl}
                        alt="Vista previa boleta"
                        className="h-14 w-20 object-cover rounded border border-slate-300 bg-white"
                      />
                    ) : (
                      <div className="h-12 px-3 rounded bg-white border border-slate-300 flex items-center gap-2 text-xs font-mono font-bold text-slate-700">
                        <FileText className="w-4 h-4 text-[#FF6600]" />
                        <span>PDF Adjunto</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {supplierDebtForm.attachmentName}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Boleta vinculada al vencimiento y al comprobante PDF
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSupplierDebtForm((prev) => ({
                          ...prev,
                          attachmentUrl: '',
                          attachmentName: '',
                        }))
                      }
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Quitar adjunto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSupplierDebtModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplierDebt}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  {isSubmittingSupplierDebt
                    ? 'Guardando Vencimiento...'
                    : 'Guardar Vencimiento / Egreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Proveedor Individual */}
      {newSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Alta de Proveedor
              </h3>
              <button
                type="button"
                onClick={() => setNewSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor (Razón Social)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora Ferretera Sur S.A."
                  value={newSupplierForm.name}
                  onChange={(e) =>
                    setNewSupplierForm({
                      ...newSupplierForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CUIT
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplierForm.cuit}
                    onChange={(e) =>
                      setNewSupplierForm({
                        ...newSupplierForm,
                        cuit: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplierForm.contactPhone}
                    onChange={(e) =>
                      setNewSupplierForm({
                        ...newSupplierForm,
                        contactPhone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Comercial
                </label>
                <input
                  type="email"
                  required
                  value={newSupplierForm.email}
                  onChange={(e) =>
                    setNewSupplierForm({
                      ...newSupplierForm,
                      email: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Saldo Cuenta Corriente (ARS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSupplierForm.balance}
                    onChange={(e) =>
                      setNewSupplierForm({
                        ...newSupplierForm,
                        balance: e.target.value,
                        status:
                          parseFloat(e.target.value) > 0
                            ? 'Saldo Pendiente'
                            : 'Al día',
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado Cuenta Corriente
                  </label>
                  <select
                    value={newSupplierForm.status}
                    onChange={(e) =>
                      setNewSupplierForm({
                        ...newSupplierForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Al día">Al día</option>
                    <option value="Saldo Pendiente">Saldo Pendiente</option>
                    <option value="Saldo a Favor">Saldo a Favor</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  {isSavingSupplier ? 'Guardando...' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ACTUALIZAR SOLO PRECIOS / COSTOS POR PROVEEDOR (PLANTILLA 3 COLUMNAS)
         ===================================================================== */}
      {costOnlyModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Encabezado */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shadow-xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">
                      Actualizar Solo Precios / Costos —{' '}
                      {costOnlyModalSupplier.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      PROCESAMIENTO RESTRINGIDO (3 COLUMNAS)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Actualiza únicamente el Costo, IVA y Precio de Venta derivado
                    de los artículos coincidentes sin modificar descripciones,
                    categorías ni stock.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCostOnlyPreImportDialogOpen(false);
                  setCostOnlyModalSupplier(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Paso 1: Plantilla Simplificada de 3 Columnas ("Código", "Costo", "IVA") */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#FF6600]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Plantilla de Importación de Costos (3 Columnas Exclusivas)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    El archivo Excel o CSV debe contener únicamente estas 3
                    columnas:{' '}
                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      Código
                    </span>{' '}
                    (Código de barras o artículo del proveedor),{' '}
                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      Costo
                    </span>{' '}
                    e{' '}
                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      IVA
                    </span>{' '}
                    (ej. <code className="font-mono">21</code>,{' '}
                    <code className="font-mono">10.5</code>,{' '}
                    <code className="font-mono">0</code>).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadSupplierCostTemplate('xlsx')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>Descargar Plantilla .XLSX (3 Col.)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSupplierCostTemplate('csv')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Plantilla .CSV</span>
                  </button>
                </div>
              </div>

              {/* Zona de Selección del Archivo de Costos */}
              <div
                onClick={() => costOnlyFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#FF6600] bg-slate-50/70 hover:bg-orange-50/20 rounded-xl p-6 text-center transition-all cursor-pointer"
              >
                <input
                  ref={costOnlyFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectCostOnlyFile(f);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 text-[#FF6600] flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {costOnlyFileName
                    ? `Archivo cargado: ${costOnlyFileName}`
                    : `Seleccionar lista de costos de ${costOnlyModalSupplier.name} (.XLSX / .CSV)`}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Al seleccionar el archivo se abrirá el cuadro de diálogo de
                  configuración pre-importación (IVA y Descuento del Proveedor).
                </p>
              </div>

              {/* Resumen de Configuración Activa + Botón para abrir Diálogo Pre-Importación */}
              <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      ¿La lista incluye IVA?:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCostOnlyIncludesIva((prev) => !prev)
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                        costOnlyIncludesIva
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-800 border-slate-300'
                      }`}
                    >
                      <span>
                        {costOnlyIncludesIva
                          ? 'Sí (IVA Incluido)'
                          : 'No (Sumar % IVA de la lista)'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">
                      Descuento del Proveedor (%):
                    </label>
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        step="0.5"
                        value={costOnlySupplierDiscountPct}
                        onChange={(e) =>
                          setCostOnlySupplierDiscountPct(e.target.value)
                        }
                        className="w-full pl-2.5 pr-6 py-1 text-xs font-mono font-bold bg-white border border-orange-300 rounded-md focus:outline-none focus:border-[#FF6600]"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {costOnlyRawRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCostOnlyPreImportDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-orange-100 text-[#FF6600] border border-orange-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Configuración Pre-Importación</span>
                  </button>
                )}
              </div>

              {costOnlyError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs font-semibold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{costOnlyError}</span>
                </div>
              )}

              {/* Vista Previa de Productos Coincidentes (Procesamiento Restringido) */}
              {costOnlyCalculatedPreview.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Vista Previa de Actualización Exclusiva de Costos
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold">
                        {matchedCostOnlyItems.length} coincidentes de{' '}
                        {costOnlyCalculatedPreview.length} filas
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Descripciones, categorías, marcas y stock permanecen 100%
                      intactos
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                          <th className="py-2.5 px-3">Código</th>
                          <th className="py-2.5 px-3">
                            Producto Coincidente (Sin cambios de texto)
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            Costo Lista
                          </th>
                          <th className="py-2.5 px-3 text-right">IVA</th>
                          <th className="py-2.5 px-3 text-right">
                            Costo Actual
                          </th>
                          <th className="py-2.5 px-3 text-right text-amber-300">
                            Nuevo Costo
                          </th>
                          <th className="py-2.5 px-3 text-right text-emerald-300">
                            Nuevo Venta Derivado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {costOnlyCalculatedPreview.map((row, idx) => (
                          <tr
                            key={`${row.code}-${idx}`}
                            className={
                              row.matchedProduct
                                ? 'bg-white hover:bg-slate-50'
                                : 'bg-slate-50/70 text-slate-400'
                            }
                          >
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {row.code}
                            </td>
                            <td className="py-2 px-3">
                              {row.matchedProduct ? (
                                <div>
                                  <span className="font-semibold text-slate-900">
                                    {row.matchedProduct.name}
                                  </span>
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                    {row.matchedProduct.category}
                                  </span>
                                  {row.bulkContentQty > 1 && (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-[#FF6600] font-mono font-bold">
                                      Bulto ÷ {row.bulkContentQty} u.
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="italic text-slate-400">
                                  Sin coincidencia en catálogo (se ignora)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {formatCurrency(row.rawCost)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {row.ivaRate}%
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {row.matchedProduct
                                ? formatCurrency(row.previousCost)
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#FF6600]">
                              {row.matchedProduct
                                ? formatCurrency(row.newUnitCost)
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              {row.matchedProduct
                                ? formatCurrency(row.newSalePrice)
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500">
                Proveedor seleccionado:{' '}
                <strong className="text-slate-900">
                  {costOnlyModalSupplier.name}
                </strong>
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCostOnlyPreImportDialogOpen(false);
                    setCostOnlyModalSupplier(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    matchedCostOnlyItems.length === 0 || isApplyingCostOnly
                  }
                  onClick={handleConfirmCostOnlyUpdate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isApplyingCostOnly
                      ? 'Actualizando Costos...'
                      : `Aplicar Actualización de Costos (${matchedCostOnlyItems.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* =================================================================
              CUADRO DE DIÁLOGO DE CONFIGURACIÓN PRE-IMPORTACIÓN
              (Aparece automáticamente al seleccionar el archivo de costos)
             ================================================================= */}
          {costOnlyPreImportDialogOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6600] flex items-center justify-center shrink-0">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900">
                        Configuración Pre-Importación de Costos
                      </h4>
                      <p className="text-xs text-slate-500">
                        Archivo: <strong>{costOnlyFileName}</strong> (
                        {matchedCostOnlyItems.length} coincidencias)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCostOnlyPreImportDialogOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Opción 1: Switch / Checkbox "¿La lista incluye IVA?" (Sí / No) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <label
                        htmlFor="switch-lista-incluye-iva"
                        className="text-xs sm:text-sm font-bold text-slate-900 block cursor-pointer"
                      >
                        ¿La lista incluye IVA?
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {costOnlyIncludesIva
                          ? 'Sí: El costo del archivo ya tiene el IVA incluido.'
                          : 'No: Se sumará el % de la columna IVA al costo neto.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        id="switch-lista-incluye-iva"
                        type="checkbox"
                        checked={costOnlyIncludesIva}
                        onChange={(e) =>
                          setCostOnlyIncludesIva(e.target.checked)
                        }
                        className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCostOnlyIncludesIva((prev) => !prev)
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          costOnlyIncludesIva
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {costOnlyIncludesIva ? 'SÍ' : 'NO'}
                      </button>
                    </div>
                  </div>

                  {/* Opción 2: Campo de entrada "Descuento del Proveedor (%)" */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <label
                      htmlFor="input-descuento-proveedor-pct"
                      className="block text-xs sm:text-sm font-bold text-slate-900"
                    >
                      Descuento del Proveedor (%)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Porcentaje general de descuento comercial sobre el costo
                      de la lista cargada.
                    </p>
                    <div className="relative">
                      <input
                        id="input-descuento-proveedor-pct"
                        type="number"
                        min={0}
                        max={99}
                        step="0.5"
                        value={costOnlySupplierDiscountPct}
                        onChange={(e) =>
                          setCostOnlySupplierDiscountPct(e.target.value)
                        }
                        placeholder="Ej. 10"
                        className="w-full pl-3.5 pr-9 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      />
                      <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-medium">
                    <strong>Procesamiento restringido activo:</strong> Solo se
                    actualizarán los costos y precios de venta derivados de los{' '}
                    <strong>{matchedCostOnlyItems.length}</strong> productos
                    coincidentes. No se modificarán descripciones ni categorías.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCostOnlyPreImportDialogOpen(false)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Ver Vista Previa Detallada
                  </button>
                  <button
                    type="button"
                    disabled={
                      matchedCostOnlyItems.length === 0 || isApplyingCostOnly
                    }
                    onClick={handleConfirmCostOnlyUpdate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isApplyingCostOnly
                        ? 'Actualizando...'
                        : 'Confirmar y Actualizar Solo Costos'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL DE CARRITO PERSISTENTE POR PROVEEDOR ("CARRITO ACTUAL / VER CARRITO")
          Se abre al hacer clic en el botón de Carrito de un proveedor en "Acciones Rápidas"
         ===================================================================== */}
      {supplierCartModalSupplier &&
        (() => {
          const modalSup = supplierCartModalSupplier;
          const modalCart = supplierCartsById[modalSup.id] || [];
          const modalNotes = supplierOrderNotesById[modalSup.id] || '';
          const modalTotalAmount = modalCart.reduce(
            (acc, it) => acc + it.quantity * it.unitCost,
            0
          );

          const modalExclusiveProducts = products
            .filter(
              (p) =>
                (p.supplierName || '').trim().toLowerCase() ===
                modalSup.name.trim().toLowerCase()
            )
            .filter((p) => {
              if (!modalProductSearch.trim()) return true;
              const q = modalProductSearch.toLowerCase();
              return (
                p.sku.toLowerCase().includes(q) ||
                p.name.toLowerCase().includes(q) ||
                p.brand.toLowerCase().includes(q)
              );
            })
            .sort((a, b) => {
              const dir = modalProductSort.direction === 'asc' ? 1 : -1;
              const k = modalProductSort.key;
              if (k === 'stock' || k === 'minStock') {
                return ((a[k] ?? 0) - (b[k] ?? 0)) * dir;
              }
              if (k === 'costPrice') {
                const cA = parseFloat(String(a.costPrice || '0')) || 0;
                const cB = parseFloat(String(b.costPrice || '0')) || 0;
                return (cA - cB) * dir;
              }
              return (
                String((a as any)[k] || '').localeCompare(
                  String((b as any)[k] || ''),
                  'es',
                  { numeric: true, sensitivity: 'base' }
                ) * dir
              );
            });

          const { paginatedItems: paginatedModalProducts } = paginateArray(
            modalExclusiveProducts,
            modalProductPage,
            modalProductPageSize
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-4">
                {/* Cabecera del Modal del Carrito del Proveedor */}
                <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-white">
                          Carrito Actual / Pedido a Proveedor — {modalSup.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-white/15 text-orange-300 font-mono text-xs font-bold">
                          ID Proveedor #{modalSup.id} · {modalCart.length} ítems
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Los productos de este carrito persisten automáticamente y
                        no se borran al salir o cambiar de pantalla hasta
                        presionar &ldquo;Confirmar Pedido / Confirmar
                        Carrito&rdquo;.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectOrderSupplier(modalSup.name);
                        setSupplierCartModalSupplier(null);
                        setActiveSubTab('pedidos');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Abrir en Pantalla Completa de Pedido
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierCartModalSupplier(null)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                      title="Cerrar ventana (el carrito queda guardado)"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Cuerpo en 2 columnas: Catálogo exclusivo del proveedor (Izquierda) + Carrito Persistente del proveedor (Derecha) */}
                <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Lado Izquierdo: Productos que pertenecen únicamente a este proveedor */}
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          Catálogo Exclusivo de {modalSup.name} (
                          {modalExclusiveProducts.length} art.)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Haga clic en cualquier artículo para sumarlo al carrito
                          persistente de este proveedor
                        </p>
                      </div>

                      <div className="relative w-full sm:w-60">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={modalProductSearch}
                          onChange={(e) => {
                            setModalProductSearch(e.target.value);
                            setModalProductPage(1);
                          }}
                          placeholder="Buscar SKU o producto..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-semibold text-slate-600 z-10 select-none">
                          <tr>
                            {(
                              [
                                { key: 'sku', label: 'Código', align: 'left' },
                                {
                                  key: 'name',
                                  label: 'Producto',
                                  align: 'left',
                                },
                                {
                                  key: 'stock',
                                  label: 'Stock',
                                  align: 'right',
                                },
                                {
                                  key: 'minStock',
                                  label: 'Mín.',
                                  align: 'right',
                                },
                                {
                                  key: 'costPrice',
                                  label: 'Costo Unit.',
                                  align: 'right',
                                },
                              ] as const
                            ).map((col) => {
                              const isSorted = modalProductSort.key === col.key;
                              return (
                                <th
                                  key={col.key}
                                  onClick={() =>
                                    setModalProductSort((prev) => ({
                                      key: col.key,
                                      direction:
                                        prev.key === col.key &&
                                        prev.direction === 'asc'
                                          ? 'desc'
                                          : 'asc',
                                    }))
                                  }
                                  className={`py-2 px-3 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap ${
                                    col.align === 'right'
                                      ? 'text-right'
                                      : 'text-left'
                                  }`}
                                >
                                  <div
                                    className={`inline-flex items-center gap-1 ${
                                      col.align === 'right'
                                        ? 'justify-end'
                                        : 'justify-start'
                                    }`}
                                  >
                                    <span>{col.label}</span>
                                    {isSorted ? (
                                      modalProductSort.direction === 'asc' ? (
                                        <ArrowUp className="w-3 h-3 text-[#FF6600]" />
                                      ) : (
                                        <ArrowDown className="w-3 h-3 text-[#FF6600]" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {paginatedModalProducts.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-8 text-center text-slate-500"
                              >
                                No se encontraron productos asociados a{' '}
                                <strong>{modalSup.name}</strong>.
                              </td>
                            </tr>
                          ) : (
                            paginatedModalProducts.map((prod) => {
                              const cleanName = prod.name
                                .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
                                .trim();
                              const inCart = modalCart.find(
                                (c) => c.productId === prod.id
                              );
                              return (
                                <tr
                                  key={prod.id}
                                  onClick={() =>
                                    handleAddProductToOrderCart(
                                      prod,
                                      modalSup.id
                                    )
                                  }
                                  className={`cursor-pointer transition-colors ${
                                    inCart
                                      ? 'bg-orange-50/80 hover:bg-orange-100/80'
                                      : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <span>{prod.sku}</span>
                                      {inCart && (
                                        <span className="px-1.5 py-0.2 rounded bg-[#FF6600] text-white text-[10px] font-bold">
                                          +{inCart.quantity}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 font-medium text-slate-900">
                                    {cleanName}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                    {prod.trackStock !== false
                                      ? prod.stock
                                      : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-500">
                                    {prod.trackStock !== false
                                      ? prod.minStock
                                      : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                    {formatCurrency(prod.costPrice)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <TablePaginationBar
                      totalItems={modalExclusiveProducts.length}
                      currentPage={modalProductPage}
                      pageSize={modalProductPageSize}
                      onPageChange={setModalProductPage}
                      onPageSizeChange={(size) => {
                        setModalProductPageSize(size);
                        setModalProductPage(1);
                      }}
                      itemLabel="productos"
                      compact
                    />
                  </div>

                  {/* Lado Derecho: Ítems guardados en el Carrito Persistente del proveedor */}
                  <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Ítems Guardados en el Carrito ({modalCart.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Persistencia activa para {modalSup.name}
                        </p>
                      </div>
                      {modalCart.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateSupplierCartById(modalSup.id, [])
                          }
                          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Vaciar carrito
                        </button>
                      )}
                    </div>

                    {modalCart.length === 0 ? (
                      <div className="py-10 text-center space-y-2 bg-white rounded-xl border border-dashed border-slate-300 p-4">
                        <ShoppingCart className="w-7 h-7 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">
                          No hay artículos pendientes en el carrito de este
                          proveedor
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Seleccione productos de la tabla izquierda para
                          dejarlos guardados en el carrito de{' '}
                          <strong>{modalSup.name}</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                        {modalCart.map((item) => (
                          <div
                            key={item.productId}
                            className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-[11px] font-bold text-[#FF6600]">
                                  {item.sku}
                                </span>
                                <p className="text-xs font-bold text-slate-900 leading-snug">
                                  {item.name}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSupplierCartById(modalSup.id, (prev) =>
                                    prev.filter(
                                      (c) => c.productId !== item.productId
                                    )
                                  )
                                }
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Quitar del carrito"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSupplierCartById(
                                      modalSup.id,
                                      (prev) =>
                                        prev.map((c) =>
                                          c.productId === item.productId
                                            ? {
                                                ...c,
                                                quantity: Math.max(
                                                  1,
                                                  c.quantity - 1
                                                ),
                                              }
                                            : c
                                        )
                                    )
                                  }
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-l text-xs font-bold cursor-pointer"
                                >
                                  -1
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = Math.max(
                                      1,
                                      parseInt(e.target.value, 10) || 1
                                    );
                                    updateSupplierCartById(
                                      modalSup.id,
                                      (prev) =>
                                        prev.map((c) =>
                                          c.productId === item.productId
                                            ? { ...c, quantity: val }
                                            : c
                                        )
                                    );
                                  }}
                                  className="w-14 py-1 text-center font-mono text-xs font-bold bg-white border-y border-slate-300 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSupplierCartById(
                                      modalSup.id,
                                      (prev) =>
                                        prev.map((c) =>
                                          c.productId === item.productId
                                            ? {
                                                ...c,
                                                quantity: c.quantity + 1,
                                              }
                                            : c
                                        )
                                    )
                                  }
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-r text-xs font-bold cursor-pointer"
                                >
                                  +1
                                </button>
                              </div>

                              <div className="text-right font-mono">
                                <div className="text-[10px] text-slate-500">
                                  Unit: {formatCurrency(item.unitCost)}
                                </div>
                                <div className="text-xs font-extrabold text-slate-900">
                                  {formatCurrency(
                                    item.quantity * item.unitCost
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Observaciones del Pedido
                        </label>
                        <input
                          type="text"
                          value={modalNotes}
                          onChange={(e) =>
                            setSupplierOrderNotesById((prev) => ({
                              ...prev,
                              [modalSup.id]: e.target.value,
                            }))
                          }
                          placeholder="Notas de entrega o condición comercial..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-900 text-white">
                        <span className="text-xs font-semibold">
                          Total Carrito {modalSup.name}
                        </span>
                        <span className="text-base font-mono font-bold text-[#FF6600]">
                          {formatCurrency(modalTotalAmount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSupplierCartModalSupplier(null)}
                          className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer"
                        >
                          Seguir Guardando
                        </button>
                        <button
                          type="button"
                          disabled={
                            modalCart.length === 0 || isSubmittingOrder
                          }
                          onClick={() =>
                            handleConfirmPurchaseOrderForSupplier(modalSup)
                          }
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          {isSubmittingOrder
                            ? 'Confirmando...'
                            : 'Confirmar Pedido / Confirmar Carrito'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
