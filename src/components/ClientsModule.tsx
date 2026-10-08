import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Plus,
  Search,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  CreditCard,
  FileText,
  Printer,
  Download,
  MessageCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trophy,
  Clock,
  Lock,
  Unlock,
  Pencil,
  Trash2,
  X,
  Wallet,
  Calendar,
  Tag,
  Receipt,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';
import { ClientItem, SystemRoleType } from '../types/ferreteria.ts';
import {
  VoucherActionModal,
  VoucherDocumentData,
  addDaysToTodayIso,
  formatIsoToAr,
  getDaysDiffFromToday,
  getTodayIso,
} from './OrdersModule.tsx';
import { loadPriceListsFromStorage } from './PriceListsModule.tsx';

export interface ClientInvoiceEntry {
  id: string;
  docNumber: string;
  docType: 'Factura A' | 'Factura B' | 'Nota de Débito' | 'Remito Cta. Cte.';
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  totalAmount: number;
  paidAmount: number;
  notes?: string;
}

export interface ClientPaymentReceiptEntry {
  id: string;
  receiptNumber: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: string;
  reference?: string;
  operatorName: string;
}

export interface ClientCreditExtendedMeta {
  creditLimit: number;
  limiteCredito?: number;
  paymentTermsDays?: number;
  paymentTermDays?: number;
  plazoDiasPago?: number;
  manualCreditBlocked?: boolean;
  estadoCredito?: 'Habilitado' | 'Excedido' | 'Bloqueado';
  razonSocial?: string;
  cuitCuil?: string;
  condicionIva?: string;
  direccion?: string;
  direccionFiscal?: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  listaPreciosId?: string;
  habilitaCuentaCorriente?: boolean;
  saldoActual?: number;
  notas?: string;
  observaciones?: string;
  totalPurchaseVolume?: number;
  historicalVolumeBonus?: number;
  onTimePaymentRate?: number; // 0 to 100
  invoices: ClientInvoiceEntry[];
  payments?: ClientPaymentReceiptEntry[];
  receipts?: ClientPaymentReceiptEntry[];
}

export interface EnrichedClientCreditStatus {
  client: ClientItem;
  balanceNum: number;
  creditLimit: number;
  paymentTermsDays: number;
  creditUsagePct: number;
  availableCredit: number;
  oldestUnpaidDate: string | null;
  oldestUnpaidDaysAgo: number;
  overdueInvoicesCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
  isBlockedByLimit: boolean;
  isBlockedByOverdue: boolean;
  isBlocked: boolean;
  isNearLimit: boolean; // >= 80% and <= 100%
  blockReasons: string[];
  totalPurchaseVolume: number;
  onTimePaymentRate: number;
  invoices: ClientInvoiceEntry[];
  payments: ClientPaymentReceiptEntry[];
}

const CLIENT_CREDIT_META_STORAGE_KEY = 'ferreteria_clients_credit_meta_v1';

export function buildDefaultClientCreditMetaMap(
  clients: ClientItem[]
): Record<number, ClientCreditExtendedMeta> {
  const defaults: Record<number, ClientCreditExtendedMeta> = {};

  clients.forEach((cli, index) => {
    const bal = Math.max(0, parseFloat(String(cli.balance || '0')) || 0);

    if (index === 0) {
      // Cliente 1: Constructora San Martín S.A. -> Bloqueado por Factura Vencida y Cerca del límite
      const limit = Math.max(1500000, bal > 0 ? Math.round(bal * 1.1) : 1800000);
      const effectiveBal = bal > 0 ? bal : 1420000;
      defaults[cli.id] = {
        creditLimit: limit,
        paymentTermsDays: 30,
        totalPurchaseVolume: 8450000,
        onTimePaymentRate: 88,
        invoices:
          effectiveBal > 0
            ? [
                {
                  id: `INV-${cli.id}-1`,
                  docNumber: 'FA-0004-00018102',
                  docType: 'Factura A',
                  issueDate: addDaysToTodayIso(-42), // Emitida hace 42 días (Plazo 30d -> 12 días vencida)
                  dueDate: addDaysToTodayIso(-12),
                  totalAmount: Math.round(effectiveBal * 0.6),
                  paidAmount: 0,
                  notes: 'Acopio materiales obra Av. Libertador — Vencida fuera de plazo',
                },
                {
                  id: `INV-${cli.id}-2`,
                  docNumber: 'FA-0004-00018390',
                  docType: 'Factura A',
                  issueDate: addDaysToTodayIso(-10),
                  dueDate: addDaysToTodayIso(20),
                  totalAmount: Math.round(effectiveBal * 0.4),
                  paidAmount: 0,
                  notes: 'Fijaciones estructurales y discos diamantados',
                },
              ]
            : [],
        payments: [
          {
            id: `REC-${cli.id}-1`,
            receiptNumber: 'REC-0004-0000412',
            date: addDaysToTodayIso(-20),
            amount: 950000,
            paymentMethod: 'Transferencia Bancaria',
            reference: 'CBU Banco Nación #8841',
            operatorName: 'Martín Gómez',
          },
        ],
      };
    } else if (index === 1) {
      // Cliente 2: Estudio Arquitectura Modular -> Límite de Crédito Excedido (Bloqueado)
      const effectiveBal = bal > 0 ? bal : 980000;
      const limit = Math.max(500000, Math.round(effectiveBal * 0.85)); // Excede el límite
      defaults[cli.id] = {
        creditLimit: limit,
        paymentTermsDays: 15,
        totalPurchaseVolume: 5920000,
        onTimePaymentRate: 92,
        invoices:
          effectiveBal > 0
            ? [
                {
                  id: `INV-${cli.id}-1`,
                  docNumber: 'FA-0004-00018255',
                  docType: 'Factura A',
                  issueDate: addDaysToTodayIso(-12),
                  dueDate: addDaysToTodayIso(3),
                  totalAmount: effectiveBal,
                  paidAmount: 0,
                  notes: 'Lote pinturas impermeabilizantes y herramientas',
                },
              ]
            : [],
        payments: [
          {
            id: `REC-${cli.id}-1`,
            receiptNumber: 'REC-0004-0000419',
            date: addDaysToTodayIso(-14),
            amount: 620000,
            paymentMethod: 'eCheq / Cheque',
            reference: 'eCheq Galicia 30 días',
            operatorName: 'Lucía Fernández',
          },
        ],
      };
    } else if (index === 2) {
      // Cliente 3: Cerca del límite (>80% utilizado) pero dentro de plazo
      const effectiveBal = bal > 0 ? bal : 690000;
      const limit = Math.round(effectiveBal / 0.86); // ~86% utilizado
      defaults[cli.id] = {
        creditLimit: limit,
        paymentTermsDays: 30,
        totalPurchaseVolume: 6340000,
        onTimePaymentRate: 98,
        invoices:
          effectiveBal > 0
            ? [
                {
                  id: `INV-${cli.id}-1`,
                  docNumber: 'FB-0004-00029104',
                  docType: 'Factura B',
                  issueDate: addDaysToTodayIso(-8),
                  dueDate: addDaysToTodayIso(22),
                  totalAmount: effectiveBal,
                  paidAmount: 0,
                  notes: 'Instalación sanitaria y termofusión completa',
                },
              ]
            : [],
        payments: [
          {
            id: `REC-${cli.id}-1`,
            receiptNumber: 'REC-0004-0000425',
            date: addDaysToTodayIso(-5),
            amount: 1120000,
            paymentMethod: 'Efectivo / Contado',
            reference: 'Cobro en Caja Central',
            operatorName: 'Diego Torres',
          },
        ],
      };
    } else {
      // Resto de clientes: Al día / Excelente cumplimiento
      const limit = Math.max(1200000, bal * 2);
      defaults[cli.id] = {
        creditLimit: limit,
        paymentTermsDays: 30,
        totalPurchaseVolume: 4780000 + index * 650000,
        onTimePaymentRate: 100,
        invoices:
          bal > 0
            ? [
                {
                  id: `INV-${cli.id}-1`,
                  docNumber: `FA-0004-000184${index}0`,
                  docType: 'Factura A',
                  issueDate: addDaysToTodayIso(-5),
                  dueDate: addDaysToTodayIso(25),
                  totalAmount: bal,
                  paidAmount: 0,
                  notes: 'Compra corriente en cuenta comercial',
                },
              ]
            : [],
        payments: [
          {
            id: `REC-${cli.id}-1`,
            receiptNumber: `REC-0004-000043${index}`,
            date: addDaysToTodayIso(-3),
            amount: 740000,
            paymentMethod: 'Transferencia Bancaria',
            reference: 'Pago puntual acreditado',
            operatorName: 'Martín Gómez',
          },
        ],
      };
    }
  });

  return defaults;
}

export function loadClientCreditMetaMap(
  clients: ClientItem[]
): Record<number, ClientCreditExtendedMeta> {
  const defaults = buildDefaultClientCreditMetaMap(clients);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(CLIENT_CREDIT_META_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        CLIENT_CREDIT_META_STORAGE_KEY,
        JSON.stringify(defaults)
      );
      return defaults;
    }
    const parsed = JSON.parse(raw) || {};
    const merged: Record<number, ClientCreditExtendedMeta> = { ...defaults };
    Object.keys(parsed).forEach((k) => {
      const id = Number(k);
      if (id) {
        merged[id] = {
          ...(defaults[id] || {
            creditLimit: 1200000,
            paymentTermsDays: 30,
            totalPurchaseVolume: 1500000,
            onTimePaymentRate: 95,
            invoices: [],
            payments: [],
          }),
          ...parsed[id],
        };
      }
    });
    return merged;
  } catch {
    return defaults;
  }
}

export function saveClientCreditMetaMap(
  map: Record<number, ClientCreditExtendedMeta>
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CLIENT_CREDIT_META_STORAGE_KEY,
      JSON.stringify(map)
    );
  } catch {
    // ignore storage errors
  }
}

export function evaluateAllClientsCreditStatus(
  clients: ClientItem[],
  metaMap?: Record<number, ClientCreditExtendedMeta>
): EnrichedClientCreditStatus[] {
  const activeMetaMap = metaMap || loadClientCreditMetaMap(clients);

  return clients.map((cli) => {
    const meta = activeMetaMap[cli.id] || {
      creditLimit: 1200000,
      paymentTermsDays: 30,
      totalPurchaseVolume: 1850000,
      onTimePaymentRate: 95,
      invoices: [],
      payments: [],
    };

    const unpaidInvoices = (meta.invoices || []).filter(
      (inv) => inv.totalAmount - inv.paidAmount > 0.01
    );

    const invoicesPendingSum = unpaidInvoices.reduce(
      (acc, inv) => acc + Math.max(0, inv.totalAmount - inv.paidAmount),
      0
    );

    const rawDbBalance = parseFloat(String(cli.balance || '0')) || 0;
    const balanceNum =
      unpaidInvoices.length > 0
        ? Math.max(rawDbBalance, invoicesPendingSum)
        : rawDbBalance;

    const creditLimit = Math.max(0, Number(meta.creditLimit) || 0);
    const paymentTermsDays = Math.max(1, Number(meta.paymentTermsDays) || 30);

    const creditUsagePct =
      creditLimit > 0 ? (balanceNum / creditLimit) * 100 : 0;
    const availableCredit = Math.max(0, creditLimit - balanceNum);

    // Calcular comprobante impago más antiguo y facturas vencidas
    let oldestUnpaidDate: string | null = null;
    let oldestUnpaidDaysAgo = 0;
    let overdueInvoicesCount = 0;
    let overdueAmount = 0;
    let maxDaysOverdue = 0;

    unpaidInvoices.forEach((inv) => {
      const pending = Math.max(0, inv.totalAmount - inv.paidAmount);
      if (pending <= 0.01) return;

      if (!oldestUnpaidDate || inv.issueDate < oldestUnpaidDate) {
        oldestUnpaidDate = inv.issueDate;
      }

      const daysSinceIssue = Math.max(0, -getDaysDiffFromToday(inv.issueDate));
      if (daysSinceIssue > oldestUnpaidDaysAgo) {
        oldestUnpaidDaysAgo = daysSinceIssue;
      }

      const daysUntilDue = getDaysDiffFromToday(inv.dueDate);
      if (daysUntilDue < 0) {
        overdueInvoicesCount += 1;
        overdueAmount += pending;
        const overdueDays = Math.abs(daysUntilDue);
        if (overdueDays > maxDaysOverdue) {
          maxDaysOverdue = overdueDays;
        }
      }
    });

    // Reglas de Bloqueo Automático a Crédito:
    // 1. Por Límite de Crédito Excedido (balance > creditLimit) o cliente nuevo bloqueado por defecto
    const isManuallyBlocked =
      Boolean(meta.manualCreditBlocked) || creditLimit <= 0;
    const isBlockedByLimit =
      isManuallyBlocked || (creditLimit > 0 && balanceNum > creditLimit + 0.01);
    // 2. Por Vencimiento de Plazo (Facturas impagas fuera de término)
    const isBlockedByOverdue = overdueInvoicesCount > 0 && balanceNum > 0.01;
    const isBlocked = isBlockedByLimit || isBlockedByOverdue;

    // Alerta de cliente cerca del límite de crédito (>= 80% utilizado)
    const isNearLimit =
      !isBlockedByLimit && creditLimit > 0 && creditUsagePct >= 80;

    const blockReasons: string[] = [];
    if (isManuallyBlocked) {
      blockReasons.push(
        'Cuenta Corriente bloqueada por defecto (requiere autorización de Administrador)'
      );
    } else if (isBlockedByLimit) {
      blockReasons.push(
        `Límite de crédito excedido (${creditUsagePct.toFixed(0)}% utilizado)`
      );
    }
    if (isBlockedByOverdue) {
      blockReasons.push(
        `Plazo vencido (${overdueInvoicesCount} comp. impago hace ${maxDaysOverdue} días)`
      );
    }

    return {
      client: cli,
      balanceNum,
      creditLimit,
      paymentTermsDays,
      creditUsagePct,
      availableCredit,
      oldestUnpaidDate,
      oldestUnpaidDaysAgo,
      overdueInvoicesCount,
      overdueAmount,
      maxDaysOverdue,
      isBlockedByLimit,
      isBlockedByOverdue,
      isBlocked,
      isNearLimit,
      blockReasons,
      totalPurchaseVolume: meta.totalPurchaseVolume || balanceNum * 3.5,
      onTimePaymentRate: isBlockedByOverdue
        ? Math.min(meta.onTimePaymentRate || 78, 78)
        : meta.onTimePaymentRate || 96,
      invoices: meta.invoices || [],
      payments: meta.payments || [],
    };
  });
}

export function evaluateClientCreditStatus(
  client: ClientItem,
  meta?: ClientCreditExtendedMeta
): EnrichedClientCreditStatus {
  const map: Record<number, ClientCreditExtendedMeta> | undefined = meta
    ? { [client.id]: meta }
    : undefined;
  return evaluateAllClientsCreditStatus([client], map)[0];
}

export function appendInvoiceToClientLedger(
  clientId: number,
  docNumber: string,
  docType: 'Factura A' | 'Factura B',
  totalAmount: number,
  clients: ClientItem[]
) {
  const metaMap = loadClientCreditMetaMap(clients);
  const existing = metaMap[clientId] || {
    creditLimit: 1200000,
    paymentTermsDays: 30,
    totalPurchaseVolume: 0,
    onTimePaymentRate: 100,
    invoices: [],
    payments: [],
  };
  const terms = existing.paymentTermsDays || existing.paymentTermDays || 30;
  const newInv: ClientInvoiceEntry = {
    id: `INV-${clientId}-${Date.now()}`,
    docNumber,
    docType,
    issueDate: getTodayIso(),
    dueDate: addDaysToTodayIso(terms),
    totalAmount,
    paidAmount: 0,
    notes: 'Venta en Cuenta Corriente desde Punto de Venta (POS)',
  };
  metaMap[clientId] = {
    ...existing,
    totalPurchaseVolume: (existing.totalPurchaseVolume || 0) + totalAmount,
    invoices: [newInv, ...(existing.invoices || [])],
  };
  saveClientCreditMetaMap(metaMap);
}

interface ClientsModuleProps {
  clients: ClientItem[];
  onClientsUpdated: (updatedClients: ClientItem[], message?: string) => void;
  formatCurrency: (val: string | number) => string;
  activeOperatorName: string;
  activeSystemRole: SystemRoleType;
  initialSubTab?: 'padron' | 'cuenta-corriente' | 'ranking';
  initialSelectedClientId?: number | null;
}

type ClientSortMode =
  | 'name-asc'
  | 'name-desc'
  | 'debt-desc'
  | 'debt-asc'
  | 'oldest-debt-asc'
  | 'oldest-debt-desc';

const IVA_CONDITIONS = [
  'Responsable Inscripto',
  'Monotributista',
  'Consumidor Final',
  'IVA Exento',
];

export const ClientsModule: React.FC<ClientsModuleProps> = ({
  clients,
  onClientsUpdated,
  formatCurrency,
  activeOperatorName,
  activeSystemRole,
  initialSubTab = 'padron',
  initialSelectedClientId = null,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'padron' | 'cuenta-corriente' | 'ranking'
  >(initialSubTab);

  const [creditMetaMap, setCreditMetaMap] = useState<
    Record<number, ClientCreditExtendedMeta>
  >(() => loadClientCreditMetaMap(clients));

  useEffect(() => {
    setCreditMetaMap((prev) => {
      const defaults = buildDefaultClientCreditMetaMap(clients);
      const next = { ...defaults, ...prev };
      saveClientCreditMetaMap(next);
      return next;
    });
  }, [clients]);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialSelectedClientId) {
      setSelectedAccountClientId(initialSelectedClientId);
    }
  }, [initialSelectedClientId]);

  const availablePriceLists = useMemo(() => {
    const savedLists = loadPriceListsFromStorage();
    const names = new Set<string>([
      'Efectivo / Contado',
      'Cuenta Corriente 30 Días',
      'Lista Mayorista / Gremio',
      'Tarjeta de Crédito 3 Cuotas',
      'Cliente VIP',
    ]);
    savedLists.forEach((l) => {
      if (l.name?.trim()) names.add(l.name.trim());
    });
    clients.forEach((c) => {
      if (c.priceList?.trim()) names.add(c.priceList.trim());
    });
    return Array.from(names);
  }, [clients]);

  // Estado de búsqueda, filtros y ordenamiento avanzado
  const [searchQuery, setSearchQuery] = useState('');
  const [creditFilter, setCreditFilter] = useState<
    'todos' | 'bloqueados' | 'vencidos' | 'cerca-limite' | 'al-dia'
  >('todos');
  const [sortMode, setSortMode] = useState<ClientSortMode>('debt-desc');

  // Enriquecer clientes con motor de riesgo crediticio
  const enrichedClients = useMemo(
    () => evaluateAllClientsCreditStatus(clients, creditMetaMap),
    [clients, creditMetaMap]
  );

  // Filtrado y Ordenamiento Avanzado (Nombre A-Z/Z-A, Deuda más grande, Deuda más vieja)
  const filteredAndSortedClients = useMemo(() => {
    const filtered = enrichedClients.filter((item) => {
      if (creditFilter === 'bloqueados' && !item.isBlocked) return false;
      if (creditFilter === 'vencidos' && !item.isBlockedByOverdue) return false;
      if (
        creditFilter === 'cerca-limite' &&
        !(item.isNearLimit || item.isBlockedByLimit)
      )
        return false;
      if (creditFilter === 'al-dia' && (item.isBlocked || item.isNearLimit))
        return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          item.client.name.toLowerCase().includes(q) ||
          item.client.cuit.toLowerCase().includes(q) ||
          item.client.email.toLowerCase().includes(q) ||
          item.client.phone.toLowerCase().includes(q) ||
          item.client.priceList.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name-asc':
          return a.client.name.localeCompare(b.client.name, 'es', {
            sensitivity: 'base',
          });
        case 'name-desc':
          return b.client.name.localeCompare(a.client.name, 'es', {
            sensitivity: 'base',
          });
        case 'debt-desc':
          return b.balanceNum - a.balanceNum;
        case 'debt-asc':
          return a.balanceNum - b.balanceNum;
        case 'oldest-debt-asc': {
          // Deuda más vieja primero (fecha de comprobante impago más antiguo primero)
          const dateA = a.oldestUnpaidDate || '9999-12-31';
          const dateB = b.oldestUnpaidDate || '9999-12-31';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return b.balanceNum - a.balanceNum;
        }
        case 'oldest-debt-desc': {
          const dateA = a.oldestUnpaidDate || '0000-01-01';
          const dateB = b.oldestUnpaidDate || '0000-01-01';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return b.balanceNum - a.balanceNum;
        }
        default:
          return 0;
      }
    });
  }, [enrichedClients, creditFilter, searchQuery, sortMode]);

  // Cliente seleccionado en el Panel de Cuenta Corriente
  const [selectedAccountClientId, setSelectedAccountClientId] = useState<
    number | null
  >(() => initialSelectedClientId || clients[0]?.id || null);

  const selectedEnrichedClient = useMemo(() => {
    return (
      enrichedClients.find((c) => c.client.id === selectedAccountClientId) ||
      enrichedClients[0] ||
      null
    );
  }, [enrichedClients, selectedAccountClientId]);

  // Modal CRUD de Cliente (Crear / Editar)
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    cuit: '',
    taxCondition: 'Responsable Inscripto',
    phone: '+54 11 4500-1000',
    email: 'administracion@empresa.com.ar',
    priceList: 'Cuenta Corriente 30 Días',
    creditLimit: '1500000',
    paymentTermsDays: '30',
    initialBalance: '0',
    accountStatus: 'Activa' as 'Activa' | 'Bloqueada',
  });

  const handleOpenCreateClient = () => {
    setEditingClient(null);
    setClientFormError(null);
    setClientForm({
      name: '',
      cuit: '30-71540921-8',
      taxCondition: 'Responsable Inscripto',
      phone: '+54 11 4800-2200',
      email: 'compras@clientecomercial.com.ar',
      priceList: availablePriceLists[0] || 'Efectivo / Contado',
      creditLimit: '1800000',
      paymentTermsDays: '30',
      initialBalance: '0',
      accountStatus: 'Activa',
    });
    setClientModalOpen(true);
  };

  const handleOpenEditClient = (enriched: EnrichedClientCreditStatus) => {
    setEditingClient(enriched.client);
    setClientFormError(null);
    setClientForm({
      name: enriched.client.name,
      cuit: enriched.client.cuit,
      taxCondition: enriched.client.taxCondition || 'Responsable Inscripto',
      phone: enriched.client.phone || '',
      email: enriched.client.email || '',
      priceList: enriched.client.priceList || 'Efectivo / Contado',
      creditLimit: String(enriched.creditLimit || 1500000),
      paymentTermsDays: String(enriched.paymentTermsDays || 30),
      initialBalance: String(enriched.balanceNum.toFixed(2)),
      accountStatus: enriched.isBlocked ? 'Bloqueada' : 'Activa',
    });
    setClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim() || !clientForm.cuit.trim()) {
      setClientFormError(
        'El Nombre / Razón Social y el CUIT / DNI son obligatorios.'
      );
      return;
    }

    setIsSavingClient(true);
    setClientFormError(null);

    try {
      const creditLimitNum = Math.max(
        0,
        parseFloat(clientForm.creditLimit) || 0
      );
      const paymentTermsNum = Math.max(
        1,
        parseInt(clientForm.paymentTermsDays, 10) || 30
      );
      const balanceNum = Math.max(
        0,
        parseFloat(clientForm.initialBalance) || 0
      );

      if (editingClient) {
        const res = await fetch(`/api/clients/${editingClient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: clientForm.name.trim(),
            cuit: clientForm.cuit.trim(),
            taxCondition: clientForm.taxCondition,
            phone: clientForm.phone.trim(),
            email: clientForm.email.trim(),
            priceList: clientForm.priceList,
            balance: balanceNum.toFixed(2),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Error al actualizar el cliente.');
        }

        const nextMeta: Record<number, ClientCreditExtendedMeta> = {
          ...creditMetaMap,
          [editingClient.id]: {
            ...(creditMetaMap[editingClient.id] || {
              totalPurchaseVolume: 1500000,
              onTimePaymentRate: 95,
              invoices: [],
              payments: [],
            }),
            creditLimit: creditLimitNum,
            paymentTermsDays: paymentTermsNum,
            manualCreditBlocked: clientForm.accountStatus === 'Bloqueada',
          },
        };
        setCreditMetaMap(nextMeta);
        saveClientCreditMetaMap(nextMeta);

        if (data.clients) {
          onClientsUpdated(
            data.clients,
            `Cliente "${clientForm.name.trim()}" actualizado (Estado: ${
              clientForm.accountStatus
            } · Límite: ${formatCurrency(creditLimitNum)} · Plazo: ${paymentTermsNum} días).`
          );
        }
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: clientForm.name.trim(),
            cuit: clientForm.cuit.trim(),
            taxCondition: clientForm.taxCondition,
            phone: clientForm.phone.trim(),
            email: clientForm.email.trim(),
            priceList: clientForm.priceList,
            balance: balanceNum.toFixed(2),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Error al crear el cliente.');
        }

        const createdId = data.created?.id;
        if (createdId) {
          const initialInvoices: ClientInvoiceEntry[] =
            balanceNum > 0
              ? [
                  {
                    id: `INV-${createdId}-${Date.now()}`,
                    docNumber: `FA-0004-000${Math.floor(18500 + Math.random() * 900)}`,
                    docType: 'Factura A',
                    issueDate: getTodayIso(),
                    dueDate: addDaysToTodayIso(paymentTermsNum),
                    totalAmount: balanceNum,
                    paidAmount: 0,
                    notes: 'Saldo inicial de apertura de Cuenta Corriente',
                  },
                ]
              : [];

          const nextMeta: Record<number, ClientCreditExtendedMeta> = {
            ...creditMetaMap,
            [createdId]: {
              creditLimit: creditLimitNum,
              paymentTermsDays: paymentTermsNum,
              manualCreditBlocked: clientForm.accountStatus === 'Bloqueada',
              totalPurchaseVolume: balanceNum > 0 ? balanceNum * 2 : 0,
              onTimePaymentRate: 100,
              invoices: initialInvoices,
              payments: [],
            },
          };
          setCreditMetaMap(nextMeta);
          saveClientCreditMetaMap(nextMeta);
          setSelectedAccountClientId(createdId);
        }

        if (data.clients) {
          onClientsUpdated(
            data.clients,
            `Cliente "${clientForm.name.trim()}" dado de alta con Lista "${
              clientForm.priceList
            }" y Límite de Crédito de ${formatCurrency(creditLimitNum)}.`
          );
        }
      }

      setClientModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setClientFormError(err.message || 'No se pudo guardar el cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async (enriched: EnrichedClientCreditStatus) => {
    if (activeSystemRole !== 'Administrador') return;
    try {
      const res = await fetch(`/api/clients/${enriched.client.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.clients) {
        onClientsUpdated(
          data.clients,
          `Cliente "${enriched.client.name}" eliminado del padrón.`
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // =========================================================================
  // MODAL DE COBRO EN CUENTA CORRIENTE + EMISIÓN DE RECIBO OFICIAL
  // =========================================================================
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Modal de Nueva Factura / Cargo en Cuenta Corriente (con validación de Bloqueo Automático)
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [chargeDocType, setChargeDocType] = useState<
    'Factura A' | 'Factura B' | 'Remito Cta. Cte.'
  >('Factura A');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNotes, setChargeNotes] = useState('');
  const [chargeOverrideBlock, setChargeOverrideBlock] = useState(false);
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);

  // Modal de Impresión / PDF / WhatsApp para Recibos y Estado de Cuenta
  const [activeVoucherModal, setActiveVoucherModal] = useState<{
    voucher: VoucherDocumentData;
    tab: 'pdf' | 'whatsapp';
  } | null>(null);

  const handleOpenPaymentModal = (target: EnrichedClientCreditStatus) => {
    setSelectedAccountClientId(target.client.id);
    setPaymentAmount(
      target.balanceNum > 0 ? target.balanceNum.toFixed(2) : '50000'
    );
    setPaymentMethod('Transferencia Bancaria');
    setPaymentReference('');
    setPaymentModalOpen(true);
  };

  const handleConfirmClientPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrichedClient) return;
    const amountNum = parseFloat(paymentAmount) || 0;
    if (amountNum <= 0) return;

    setIsSubmittingPayment(true);
    try {
      const clientId = selectedEnrichedClient.client.id;
      const receiptNum = `REC-0004-0000${Math.floor(450 + Math.random() * 500)}`;

      // Imputar el pago a los comprobantes pendientes más antiguos primero
      let remainingPayment = amountNum;
      const currentMeta = creditMetaMap[clientId] || {
        creditLimit: selectedEnrichedClient.creditLimit,
        paymentTermsDays: selectedEnrichedClient.paymentTermsDays,
        totalPurchaseVolume: selectedEnrichedClient.totalPurchaseVolume,
        onTimePaymentRate: selectedEnrichedClient.onTimePaymentRate,
        invoices: [],
        payments: [],
      };

      const sortedInvoices = [...currentMeta.invoices].sort((a, b) =>
        a.issueDate.localeCompare(b.issueDate)
      );

      const updatedInvoices = sortedInvoices.map((inv) => {
        const pending = Math.max(0, inv.totalAmount - inv.paidAmount);
        if (pending <= 0 || remainingPayment <= 0) return inv;
        const applied = Math.min(pending, remainingPayment);
        remainingPayment -= applied;
        return {
          ...inv,
          paidAmount: Number((inv.paidAmount + applied).toFixed(2)),
        };
      });

      const newReceipt: ClientPaymentReceiptEntry = {
        id: `REC-${Date.now()}`,
        receiptNumber: receiptNum,
        date: getTodayIso(),
        amount: amountNum,
        paymentMethod,
        reference: paymentReference || 'Cobro imputado en Cuenta Corriente',
        operatorName: activeOperatorName,
      };

      const nextMetaMap: Record<number, ClientCreditExtendedMeta> = {
        ...creditMetaMap,
        [clientId]: {
          ...currentMeta,
          onTimePaymentRate: Math.min(
            100,
            (currentMeta.onTimePaymentRate || 90) + 4
          ),
          invoices: updatedInvoices,
          payments: [newReceipt, ...(currentMeta.payments || [])],
        },
      };

      setCreditMetaMap(nextMetaMap);
      saveClientCreditMetaMap(nextMetaMap);

      const res = await fetch(`/api/clients/${clientId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deltaAmount: -amountNum,
        }),
      });
      const data = await res.json();
      if (res.ok && data.clients) {
        onClientsUpdated(
          data.clients,
          `Cobro registrado (${receiptNum}) por ${formatCurrency(
            amountNum
          )} para "${selectedEnrichedClient.client.name}". Saldo actualizado en tiempo real.`
        );
      }

      setPaymentModalOpen(false);

      // Abrir automáticamente el Recibo Oficial emitido listo para imprimir / descargar PDF
      setActiveVoucherModal({
        tab: 'pdf',
        voucher: {
          docType: 'Orden de Pago',
          docNumber: receiptNum,
          dateFormatted: formatIsoToAr(getTodayIso()),
          supplierName: selectedEnrichedClient.client.name,
          supplierCuit: selectedEnrichedClient.client.cuit,
          supplierPhone: selectedEnrichedClient.client.phone,
          supplierEmail: selectedEnrichedClient.client.email,
          status: 'Cobrado / Acreditado',
          paymentMethod,
          totalAmount: amountNum,
          paidAmount: amountNum,
          notes:
            paymentReference ||
            `Recibo de Cobro de Cuenta Corriente — Operador: ${activeOperatorName}`,
          items: [
            {
              sku: receiptNum,
              name: `Cobro en Cuenta Corriente (${paymentMethod}) — Saldo posterior: ${formatCurrency(
                Math.max(0, selectedEnrichedClient.balanceNum - amountNum)
              )}`,
              quantity: 1,
              unitCost: amountNum,
            },
          ],
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Registrar nuevo comprobante / cargo a crédito en la Cuenta Corriente del Cliente
  const handleConfirmClientCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrichedClient) return;
    const amountNum = parseFloat(chargeAmount) || 0;
    if (amountNum <= 0) return;

    // Verificar bloqueo automático si no está autorizado el override
    const wouldExceedLimit =
      selectedEnrichedClient.creditLimit > 0 &&
      selectedEnrichedClient.balanceNum + amountNum >
        selectedEnrichedClient.creditLimit;

    if (
      (selectedEnrichedClient.isBlocked || wouldExceedLimit) &&
      !chargeOverrideBlock
    ) {
      return;
    }

    setIsSubmittingCharge(true);
    try {
      const clientId = selectedEnrichedClient.client.id;
      const docNum = `FA-0004-000${Math.floor(18600 + Math.random() * 900)}`;
      const issueIso = getTodayIso();
      const dueIso = addDaysToTodayIso(selectedEnrichedClient.paymentTermsDays);

      const currentMeta = creditMetaMap[clientId] || {
        creditLimit: selectedEnrichedClient.creditLimit,
        paymentTermsDays: selectedEnrichedClient.paymentTermsDays,
        totalPurchaseVolume: selectedEnrichedClient.totalPurchaseVolume,
        onTimePaymentRate: selectedEnrichedClient.onTimePaymentRate,
        invoices: [],
        payments: [],
      };

      const newInvoice: ClientInvoiceEntry = {
        id: `INV-${Date.now()}`,
        docNumber: docNum,
        docType: chargeDocType,
        issueDate: issueIso,
        dueDate: dueIso,
        totalAmount: amountNum,
        paidAmount: 0,
        notes:
          chargeNotes ||
          `Venta en Cuenta Corriente (${selectedEnrichedClient.client.priceList})`,
      };

      const nextMetaMap: Record<number, ClientCreditExtendedMeta> = {
        ...creditMetaMap,
        [clientId]: {
          ...currentMeta,
          totalPurchaseVolume:
            (currentMeta.totalPurchaseVolume || 0) + amountNum,
          invoices: [newInvoice, ...(currentMeta.invoices || [])],
        },
      };

      setCreditMetaMap(nextMetaMap);
      saveClientCreditMetaMap(nextMetaMap);

      const res = await fetch(`/api/clients/${clientId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deltaAmount: amountNum,
        }),
      });
      const data = await res.json();
      if (res.ok && data.clients) {
        onClientsUpdated(
          data.clients,
          `Comprobante ${docNum} por ${formatCurrency(
            amountNum
          )} cargado en la Cuenta Corriente de "${
            selectedEnrichedClient.client.name
          }" (Vence: ${formatIsoToAr(dueIso)}).`
        );
      }

      setChargeModalOpen(false);
      setChargeAmount('');
      setChargeNotes('');
      setChargeOverrideBlock(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCharge(false);
    }
  };

  // Imprimir / Exportar Estado de Cuenta Corriente en PDF o WhatsApp
  const handleOpenAccountStatementVoucher = (
    enriched: EnrichedClientCreditStatus,
    tab: 'pdf' | 'whatsapp'
  ) => {
    const unpaid = enriched.invoices.filter(
      (i) => i.totalAmount - i.paidAmount > 0.01
    );
    const items =
      unpaid.length > 0
        ? unpaid.map((inv) => ({
            sku: inv.docNumber,
            name: `${inv.docType} · Emitida ${formatIsoToAr(
              inv.issueDate
            )} · Vto: ${formatIsoToAr(inv.dueDate)} (${
              inv.notes || 'Cuenta Corriente'
            })`,
            quantity: 1,
            unitCost: Math.max(0, inv.totalAmount - inv.paidAmount),
          }))
        : [
            {
              sku: 'ESTADO-CTA',
              name: 'Cuenta Corriente al día — Sin comprobantes pendientes de pago',
              quantity: 1,
              unitCost: enriched.balanceNum,
            },
          ];

    setActiveVoucherModal({
      tab,
      voucher: {
        docType: 'Pedido a Proveedor',
        docNumber: `EST-CTA-${String(enriched.client.id).padStart(4, '0')}`,
        dateFormatted: formatIsoToAr(getTodayIso()),
        supplierName: enriched.client.name,
        supplierCuit: enriched.client.cuit,
        supplierPhone: enriched.client.phone,
        supplierEmail: enriched.client.email,
        status: enriched.isBlocked
          ? 'CRÉDITO BLOQUEADO'
          : enriched.isNearLimit
          ? 'ALERTA >80% LÍMITE'
          : 'CUENTA HABILITADA',
        secondaryStatus: `Límite: ${formatCurrency(
          enriched.creditLimit
        )} · Plazo: ${enriched.paymentTermsDays} días`,
        totalAmount: enriched.balanceNum,
        paidAmount: 0,
        notes: `Estado de Cuenta Corriente Comercial — Lista Asignada: ${
          enriched.client.priceList
        }${
          enriched.blockReasons.length > 0
            ? ` · Motivo Bloqueo: ${enriched.blockReasons.join(' / ')}`
            : ''
        }`,
        items,
      },
    });
  };

  // Exportar Estado de Cuenta en Excel (.XLSX)
  const handleExportAccountStatementExcel = (
    enriched: EnrichedClientCreditStatus
  ) => {
    const rows = enriched.invoices.map((inv) => {
      const pending = Math.max(0, inv.totalAmount - inv.paidAmount);
      const daysDiff = getDaysDiffFromToday(inv.dueDate);
      return {
        Comprobante: inv.docNumber,
        Tipo: inv.docType,
        'Fecha Emisión': formatIsoToAr(inv.issueDate),
        'Fecha Vencimiento': formatIsoToAr(inv.dueDate),
        'Importe Original': inv.totalAmount,
        'Importe Abonado': inv.paidAmount,
        'Saldo Pendiente': pending,
        Estado:
          pending <= 0.01
            ? 'Saldado'
            : daysDiff < 0
            ? `Vencido (${Math.abs(daysDiff)} días)`
            : 'En Plazo',
        Detalle: inv.notes || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [
            {
              Comprobante: 'SIN DEUDA',
              Tipo: '-',
              'Fecha Emisión': formatIsoToAr(getTodayIso()),
              'Fecha Vencimiento': '-',
              'Importe Original': 0,
              'Importe Abonado': 0,
              'Saldo Pendiente': 0,
              Estado: 'Al día',
              Detalle: 'Sin comprobantes pendientes',
            },
          ]
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estado Cuenta Corriente');
    const safeName = enriched.client.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 25);
    XLSX.writeFile(wb, `estado_cuenta_${safeName}.xlsx`);
  };

  // Ranking de Mejores Clientes (por Volumen Total de Compra y Cumplimiento de Pago)
  const rankedClients = useMemo(() => {
    return [...enrichedClients].sort((a, b) => {
      const scoreA =
        a.totalPurchaseVolume * (0.65 + (a.onTimePaymentRate / 100) * 0.35);
      const scoreB =
        b.totalPurchaseVolume * (0.65 + (b.onTimePaymentRate / 100) * 0.35);
      return scoreB - scoreA;
    });
  }, [enrichedClients]);

  // Indicadores globales
  const summaryStats = useMemo(() => {
    const totalReceivable = enrichedClients.reduce(
      (acc, c) => acc + c.balanceNum,
      0
    );
    const blockedCount = enrichedClients.filter((c) => c.isBlocked).length;
    const overdueCount = enrichedClients.filter(
      (c) => c.isBlockedByOverdue
    ).length;
    const nearLimitCount = enrichedClients.filter((c) => c.isNearLimit).length;
    return {
      totalReceivable,
      blockedCount,
      overdueCount,
      nearLimitCount,
    };
  }, [enrichedClients]);

  return (
    <div className="space-y-6">
      {/* KPI Strip de Clientes y Riesgo Crediticio */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Total a Cobrar en Cuentas Corrientes
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatCurrency(summaryStats.totalReceivable)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {clients.length} clientes registrados en padrón
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6600] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Cuentas Bloqueadas Automáticamente
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-rose-700 mt-1">
              {summaryStats.blockedCount}
            </p>
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              Por exceso de límite o facturas vencidas
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Clientes con Facturas Vencidas
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
              {summaryStats.overdueCount}
            </p>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              Plazo de pago autorizado superado
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Clientes Cerca del Límite (&gt;80%)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {summaryStats.nearLimitCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Alerta preventiva de cupo crediticio
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* =====================================================================
          SUB-VISTA 1: PADRÓN DE CLIENTES, ORDENAMIENTO AVANZADO Y BLOQUEOS
         ===================================================================== */}
      {activeSubTab === 'padron' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Barra de Herramientas: Búsqueda, Filtros de Riesgo y Ordenamiento Avanzado */}
          <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              {/* Buscador */}
              <div className="relative w-full xl:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, CUIT/DNI, teléfono, lista..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white"
                />
              </div>

              {/* Botones rápidos de Ordenamiento Avanzado + Nuevo Cliente */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCreateClient}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Cliente</span>
                </button>

                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 ml-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Ordenar por:</span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSortMode((prev) =>
                      prev === 'name-asc' ? 'name-desc' : 'name-asc'
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    sortMode === 'name-asc' || sortMode === 'name-desc'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>
                    Nombre ({sortMode === 'name-desc' ? 'Z-A' : 'A-Z'})
                  </span>
                  {sortMode === 'name-desc' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSortMode('debt-desc')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    sortMode === 'debt-desc'
                      ? 'bg-[#FF6600] text-white border-[#FF6600]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Deuda Más Grande (Mayor a Menor)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortMode('oldest-debt-asc')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    sortMode === 'oldest-debt-asc'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Deuda Más Vieja (Más Antigua)</span>
                </button>
              </div>
            </div>

            {/* Filtros de Estado Crediticio */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'todos', label: 'Todos los Clientes' },
                {
                  id: 'bloqueados',
                  label: `Bloqueados a Crédito (${summaryStats.blockedCount})`,
                },
                {
                  id: 'vencidos',
                  label: `Con Plazo Vencido (${summaryStats.overdueCount})`,
                },
                {
                  id: 'cerca-limite',
                  label: `Cerca o Sobre Límite >80% (${summaryStats.nearLimitCount})`,
                },
                { id: 'al-dia', label: 'Crédito Habilitado / Al Día' },
              ].map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => setCreditFilter(flt.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    creditFilter === flt.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla Principal de Clientes */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 select-none">
                  <th
                    onClick={() =>
                      setSortMode((prev) =>
                        prev === 'name-asc' ? 'name-desc' : 'name-asc'
                      )
                    }
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Cliente / Razón Social</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">CUIT / DNI · IVA</th>
                  <th className="py-3 px-4">Lista de Precios Asignada</th>
                  <th className="py-3 px-4 text-right">
                    Límite Crédito / Plazo
                  </th>
                  <th
                    onClick={() =>
                      setSortMode((prev) =>
                        prev === 'debt-desc' ? 'debt-asc' : 'debt-desc'
                      )
                    }
                    className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100"
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Deuda Actual ($)</span>
                      <ArrowUpDown className="w-3 h-3 text-[#FF6600]" />
                    </div>
                  </th>
                  <th
                    onClick={() =>
                      setSortMode((prev) =>
                        prev === 'oldest-debt-asc'
                          ? 'oldest-debt-desc'
                          : 'oldest-debt-asc'
                      )
                    }
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Deuda Más Vieja</span>
                      <ArrowUpDown className="w-3 h-3 text-rose-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Estado de Crédito / Reglas</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {filteredAndSortedClients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-slate-500"
                    >
                      No se encontraron clientes para el criterio seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedClients.map((item) => {
                    const { client } = item;
                    return (
                      <tr
                        key={client.id}
                        className={`hover:bg-slate-50/90 transition-colors ${
                          item.isBlocked
                            ? 'bg-rose-50/35'
                            : item.isNearLimit
                            ? 'bg-amber-50/25'
                            : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {client.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {client.phone} · {client.email}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-800">
                            {client.cuit}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {client.taxCondition}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-[#FF6600] border border-orange-200 text-xs font-bold">
                            <Tag className="w-3 h-3 shrink-0" />
                            <span>{client.priceList}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-900">
                            {formatCurrency(item.creditLimit)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Plazo: {item.paymentTermsDays} días (
                            {item.creditUsagePct.toFixed(0)}% uso)
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div
                            className={`font-mono text-sm font-bold ${
                              item.isBlocked
                                ? 'text-rose-700'
                                : item.balanceNum > 0
                                ? 'text-slate-900'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatCurrency(item.balanceNum)}
                          </div>
                          <div className="w-24 ml-auto h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                item.isBlockedByLimit
                                  ? 'bg-rose-600'
                                  : item.isNearLimit
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(4, item.creditUsagePct)
                                )}%`,
                              }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.oldestUnpaidDate && item.balanceNum > 0 ? (
                            <div>
                              <div className="font-mono text-xs font-bold text-slate-900">
                                {formatIsoToAr(item.oldestUnpaidDate)}
                              </div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  item.isBlockedByOverdue
                                    ? 'text-rose-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                Hace {item.oldestUnpaidDaysAgo} días
                                {item.isBlockedByOverdue
                                  ? ` (${item.maxDaysOverdue}d vencida)`
                                  : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-700 font-medium">
                              Sin deuda impaga
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            {item.isBlockedByLimit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 w-fit">
                                <Lock className="w-3 h-3 shrink-0" />
                                <span>BLOQUEADO: LÍMITE EXCEDIDO</span>
                              </span>
                            )}
                            {item.isBlockedByOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 w-fit">
                                <ShieldAlert className="w-3 h-3 shrink-0" />
                                <span>
                                  BLOQUEADO: PLAZO VENCIDO ({item.maxDaysOverdue}
                                  d)
                                </span>
                              </span>
                            )}
                            {!item.isBlocked && item.isNearLimit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 w-fit">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  CERCA DEL LÍMITE (
                                  {item.creditUsagePct.toFixed(0)}%)
                                </span>
                              </span>
                            )}
                            {!item.isBlocked && !item.isNearLimit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                                <Unlock className="w-3 h-3 shrink-0" />
                                <span>CRÉDITO HABILITADO</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAccountClientId(client.id);
                                setActiveSubTab('cuenta-corriente');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Cuenta Corriente
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              Registrar Cobro
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditClient(item)}
                              title="Editar Cliente, Lista de Precios, Límite y Plazo"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {activeSystemRole === 'Administrador' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClient(item)}
                                title="Eliminar Cliente"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VISTA 2: PANEL DE CUENTA CORRIENTE DE CLIENTE
         ===================================================================== */}
      {activeSubTab === 'cuenta-corriente' && selectedEnrichedClient && (
        <div className="space-y-6">
          {/* Selector de Cliente y Acciones de Estado de Cuenta */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Cuenta Corriente del Cliente
                </label>
                <select
                  value={selectedEnrichedClient.client.id}
                  onChange={(e) =>
                    setSelectedAccountClientId(Number(e.target.value))
                  }
                  className="px-3.5 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#FF6600]"
                >
                  {enrichedClients.map((ec) => (
                    <option key={ec.client.id} value={ec.client.id}>
                      {ec.client.name} — Saldo: {formatCurrency(ec.balanceNum)}{' '}
                      {ec.isBlocked ? ' (BLOQUEADO)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-600 space-y-0.5 pt-1 sm:pt-4">
                <div>
                  CUIT:{' '}
                  <strong className="font-mono">
                    {selectedEnrichedClient.client.cuit}
                  </strong>{' '}
                  · {selectedEnrichedClient.client.taxCondition}
                </div>
                <div>
                  Lista por defecto:{' '}
                  <strong className="text-[#FF6600]">
                    {selectedEnrichedClient.client.priceList}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenPaymentModal(selectedEnrichedClient)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Registrar Cobro / Emitir Recibo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setChargeAmount('');
                  setChargeNotes('');
                  setChargeOverrideBlock(false);
                  setChargeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FF6600]" />
                <span>Cargar Factura a Crédito</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleOpenAccountStatementVoucher(
                    selectedEnrichedClient,
                    'pdf'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>Imprimir / PDF Estado de Cuenta</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenEditClient(selectedEnrichedClient)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>Estado (Activa/Bloq.) y Límite</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleExportAccountStatementExcel(selectedEnrichedClient)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Banner de Bloqueo Automático a Crédito (si aplica) */}
          {selectedEnrichedClient.isBlocked && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-950">
                    Cuenta Bloqueada Automáticamente para Nuevas Ventas a Crédito
                  </h4>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Motivos detectados:{' '}
                    <strong>
                      {selectedEnrichedClient.blockReasons.join(' · ')}
                    </strong>
                    . Registre un cobro o amplíe el cupo/plazo autorizado para
                    rehabilitar la cuenta corriente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenPaymentModal(selectedEnrichedClient)}
                className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shrink-0 cursor-pointer"
              >
                Regularizar Saldo Ahora
              </button>
            </div>
          )}

          {/* Tarjetas de Resumen de Cuenta Corriente en Tiempo Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-xs text-slate-500 font-medium">
                Saldo Deudor en Tiempo Real
              </span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(selectedEnrichedClient.balanceNum)}
              </p>
              <span className="text-[11px] text-slate-500">
                Deuda más antigua:{' '}
                {selectedEnrichedClient.oldestUnpaidDate
                  ? formatIsoToAr(selectedEnrichedClient.oldestUnpaidDate)
                  : 'Sin deuda'}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-xs text-slate-500 font-medium">
                Límite de Crédito Autorizado
              </span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(selectedEnrichedClient.creditLimit)}
              </p>
              <span className="text-[11px] text-emerald-700 font-semibold">
                Disponible: {formatCurrency(selectedEnrichedClient.availableCredit)} (
                {selectedEnrichedClient.creditUsagePct.toFixed(0)}% usado)
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-xs text-slate-500 font-medium">
                Plazo de Pago Autorizado
              </span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {selectedEnrichedClient.paymentTermsDays} días
              </p>
              <span className="text-[11px] text-slate-500">
                Facturas vencidas: {selectedEnrichedClient.overdueInvoicesCount}{' '}
                ({formatCurrency(selectedEnrichedClient.overdueAmount)})
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-xs text-slate-500 font-medium">
                Volumen Histórico y Cumplimiento
              </span>
              <p className="text-2xl font-bold font-mono text-[#FF6600] mt-1">
                {formatCurrency(selectedEnrichedClient.totalPurchaseVolume)}
              </p>
              <span className="text-[11px] text-slate-600 font-semibold">
                Cumplimiento de pago: {selectedEnrichedClient.onTimePaymentRate}%
              </span>
            </div>
          </div>

          {/* Dos Columnas: Desglose de Comprobantes Pendientes + Historial de Recibos y Cobros */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Comprobantes y Deudas */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Desglose de Comprobantes y Deudas en Cuenta Corriente
                  </h3>
                  <p className="text-xs text-slate-500">
                    Control de vencimientos según plazo autorizado de{' '}
                    {selectedEnrichedClient.paymentTermsDays} días
                  </p>
                </div>
                <FileText className="w-4 h-4 text-[#FF6600]" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-3.5">Comprobante</th>
                      <th className="py-2.5 px-3.5">Emisión / Vto.</th>
                      <th className="py-2.5 px-3.5 text-right">Total</th>
                      <th className="py-2.5 px-3.5 text-right">Pendiente</th>
                      <th className="py-2.5 px-3.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {selectedEnrichedClient.invoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-slate-500"
                        >
                          No hay comprobantes registrados en la cuenta corriente.
                        </td>
                      </tr>
                    ) : (
                      selectedEnrichedClient.invoices.map((inv) => {
                        const pending = Math.max(
                          0,
                          inv.totalAmount - inv.paidAmount
                        );
                        const daysUntilDue = getDaysDiffFromToday(inv.dueDate);
                        const isOverdue = pending > 0.01 && daysUntilDue < 0;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3.5">
                              <div className="font-mono font-bold text-slate-900">
                                {inv.docNumber}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {inv.docType} · {inv.notes}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                              <div className="text-slate-800">
                                Em: {formatIsoToAr(inv.issueDate)}
                              </div>
                              <div
                                className={
                                  isOverdue
                                    ? 'text-rose-700 font-bold'
                                    : 'text-slate-500'
                                }
                              >
                                Vto: {formatIsoToAr(inv.dueDate)}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-slate-700 whitespace-nowrap">
                              {formatCurrency(inv.totalAmount)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(pending)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {pending <= 0.01 ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  SALDADA
                                </span>
                              ) : isOverdue ? (
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                                  VENCIDA ({Math.abs(daysUntilDue)}d)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  EN PLAZO ({daysUntilDue}d)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historial de Cobros y Emisión de Recibos */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Historial de Cobros y Recibos Emitidos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Reimprima o envíe por WhatsApp cualquier recibo oficial
                  </p>
                </div>
                <Receipt className="w-4 h-4 text-emerald-600" />
              </div>

              <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                {selectedEnrichedClient.payments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Sin recibos de cobro registrados aún.
                  </div>
                ) : (
                  selectedEnrichedClient.payments.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-700">
                            {pay.receiptNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {formatIsoToAr(pay.date)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5">
                          {pay.paymentMethod} —{' '}
                          <span className="font-mono font-bold">
                            {formatCurrency(pay.amount)}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {pay.reference} · Cajeado por {pay.operatorName}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVoucherModal({
                              tab: 'pdf',
                              voucher: {
                                docType: 'Orden de Pago',
                                docNumber: pay.receiptNumber,
                                dateFormatted: formatIsoToAr(pay.date),
                                supplierName: selectedEnrichedClient.client.name,
                                supplierCuit: selectedEnrichedClient.client.cuit,
                                supplierPhone:
                                  selectedEnrichedClient.client.phone,
                                supplierEmail:
                                  selectedEnrichedClient.client.email,
                                status: 'Cobrado / Acreditado',
                                paymentMethod: pay.paymentMethod,
                                totalAmount: pay.amount,
                                paidAmount: pay.amount,
                                notes: pay.reference,
                                items: [
                                  {
                                    sku: pay.receiptNumber,
                                    name: `Recibo Oficial de Cobro en Cuenta Corriente (${pay.paymentMethod})`,
                                    quantity: 1,
                                    unitCost: pay.amount,
                                  },
                                ],
                              },
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Recibo PDF
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VISTA 3: RANKING DE MEJORES CLIENTES (VOLUMEN Y CUMPLIMIENTO)
         ===================================================================== */}
      {activeSubTab === 'ranking' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ranking Dinámico de Mejores Clientes
                </h3>
                <p className="text-xs text-slate-500">
                  Clasificación ponderada por Volumen Total de Compra ($ ARS) y
                  Cumplimiento de Pago en Término (%)
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Posición</th>
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Lista de Precios</th>
                  <th className="py-3 px-4 text-right">
                    Volumen Total de Compra
                  </th>
                  <th className="py-3 px-4 text-right">Cumplimiento de Pago</th>
                  <th className="py-3 px-4 text-right">Saldo Actual</th>
                  <th className="py-3 px-4">Categoría / Calificación</th>
                  <th className="py-3 px-4 text-right">Cuenta Corriente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {rankedClients.map((item, idx) => {
                  const rank = idx + 1;
                  const tier =
                    item.onTimePaymentRate >= 95 &&
                    item.totalPurchaseVolume >= 5000000
                      ? 'Platino VIP'
                      : item.onTimePaymentRate >= 88
                      ? 'Oro Comercial'
                      : item.isBlocked
                      ? 'En Observación (Mora/Límite)'
                      : 'Plata Activo';

                  return (
                    <tr key={item.client.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                            rank === 1
                              ? 'bg-amber-400 text-slate-950'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-900'
                              : rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {item.client.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          CUIT {item.client.cuit}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-orange-50 text-[#FF6600] border border-orange-200 text-xs font-semibold">
                          {item.client.priceList}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalPurchaseVolume)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-emerald-700">
                          {item.onTimePaymentRate}% puntualidad
                        </div>
                        <div className="w-24 ml-auto h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              item.onTimePaymentRate >= 90
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.onTimePaymentRate}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-800">
                        {formatCurrency(item.balanceNum)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            tier === 'Platino VIP'
                              ? 'bg-slate-900 text-amber-300'
                              : tier === 'Oro Comercial'
                              ? 'bg-amber-100 text-amber-900'
                              : tier.startsWith('En Observación')
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>{tier}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccountClientId(item.client.id);
                            setActiveSubTab('cuenta-corriente');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 text-slate-800 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Ver Ficha Cta. Cte.
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREAR / EDITAR CLIENTE (CON LÍMITE, PLAZO Y LISTA DE PRECIOS)
         ===================================================================== */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingClient
                    ? `Editar Cliente — ${editingClient.name}`
                    : 'Alta de Nuevo Cliente y Parámetros de Crédito'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure datos fiscales, lista de precios por defecto, límite
                  de crédito ($) y plazo de pago autorizado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClientModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clientFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {clientFormError}
              </div>
            )}

            <form onSubmit={handleSaveClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={clientForm.name}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, name: e.target.value })
                  }
                  placeholder="Ej. Constructora San Martín S.A."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CUIT / DNI *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientForm.cuit}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, cuit: e.target.value })
                    }
                    placeholder="30-71009281-4"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Condición ante el IVA *
                  </label>
                  <select
                    value={clientForm.taxCondition}
                    onChange={(e) =>
                      setClientForm({
                        ...clientForm,
                        taxCondition: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  >
                    {IVA_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={clientForm.phone}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, phone: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, email: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              {/* Asignación de Lista de Precios por defecto */}
              <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200 space-y-2">
                <label className="block text-xs font-bold text-slate-900">
                  Lista de Precios Asignada por Defecto *
                </label>
                <select
                  value={clientForm.priceList}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, priceList: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm font-bold bg-white border border-orange-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                >
                  {availablePriceLists.map((listName) => (
                    <option key={listName} value={listName}>
                      {listName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Parámetros de Cuenta Corriente: Estado (Activa / Bloqueada), Límite de Crédito ($) y Días / Plazo Autorizado */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    Estado de Cuenta Corriente:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setClientForm({
                          ...clientForm,
                          accountStatus: 'Activa',
                        })
                      }
                      className={`py-1.5 px-3 rounded-lg border text-xs font-extrabold cursor-pointer transition-colors ${
                        clientForm.accountStatus === 'Activa'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Activa
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setClientForm({
                          ...clientForm,
                          accountStatus: 'Bloqueada',
                        })
                      }
                      className={`py-1.5 px-3 rounded-lg border text-xs font-extrabold cursor-pointer transition-colors ${
                        clientForm.accountStatus === 'Bloqueada'
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Bloqueada
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Límite de Crédito ($) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1000"
                      required
                      value={clientForm.creditLimit}
                      onChange={(e) =>
                        setClientForm({
                          ...clientForm,
                          creditLimit: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Días / Plazo Autorizado *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={clientForm.paymentTermsDays}
                      onChange={(e) =>
                        setClientForm({
                          ...clientForm,
                          paymentTermsDays: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Saldo Deudor Actual ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={clientForm.initialBalance}
                      onChange={(e) =>
                        setClientForm({
                          ...clientForm,
                          initialBalance: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClientModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  {isSavingClient
                    ? 'Guardando...'
                    : editingClient
                    ? 'Guardar Cambios'
                    : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: REGISTRAR COBRO DE CUENTA CORRIENTE Y EMITIR RECIBO
         ===================================================================== */}
      {paymentModalOpen && selectedEnrichedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Registrar Cobro de Cuenta Corriente
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: <strong>{selectedEnrichedClient.client.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClientPayment} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  Saldo Deudor Actual:
                </span>
                <span className="font-mono text-sm font-bold text-slate-900">
                  {formatCurrency(selectedEnrichedClient.balanceNum)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto Recibido (ARS) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medio de Cobro *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Efectivo / Contado">Efectivo / Contado</option>
                  <option value="Transferencia Bancaria">
                    Transferencia Bancaria
                  </option>
                  <option value="eCheq / Cheque">eCheq / Cheque</option>
                  <option value="Tarjeta de Débito / Crédito">
                    Tarjeta de Débito / Crédito
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nro. Comprobante / Referencia de Pago
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej. Transferencia CBU #9012 / Cancelación FA-0004"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                >
                  {isSubmittingPayment
                    ? 'Imputando Cobro...'
                    : 'Confirmar Cobro y Emitir Recibo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CARGAR NUEVA FACTURA A CRÉDITO (CON CONTROL DE BLOQUEO)
         ===================================================================== */}
      {chargeModalOpen && selectedEnrichedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cargar Comprobante en Cuenta Corriente
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: <strong>{selectedEnrichedClient.client.name}</strong>{' '}
                  · Plazo: {selectedEnrichedClient.paymentTermsDays} días
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChargeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClientCharge} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Comprobante
                </label>
                <select
                  value={chargeDocType}
                  onChange={(e) => setChargeDocType(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="Factura A">Factura A (Cta. Cte.)</option>
                  <option value="Factura B">Factura B (Cta. Cte.)</option>
                  <option value="Remito Cta. Cte.">
                    Remito Conformado en Cta. Cte.
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Importe a Cargar a Crédito (ARS) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder="Ej. 240000"
                  className="w-full px-3.5 py-2 text-base font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detalle / Obra / Observación
                </label>
                <input
                  type="text"
                  value={chargeNotes}
                  onChange={(e) => setChargeNotes(e.target.value)}
                  placeholder="Ej. Retiro materiales Obra Centro"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              {(selectedEnrichedClient.isBlocked ||
                (selectedEnrichedClient.creditLimit > 0 &&
                  selectedEnrichedClient.balanceNum +
                    (parseFloat(chargeAmount) || 0) >
                    selectedEnrichedClient.creditLimit)) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Regla de Bloqueo Automático a Crédito Activa</span>
                  </div>
                  <p className="text-[11px] text-rose-800">
                    Esta cuenta supera el límite autorizado de{' '}
                    {formatCurrency(selectedEnrichedClient.creditLimit)} o
                    posee comprobantes con plazo vencido.
                  </p>
                  {activeSystemRole === 'Administrador' && (
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-950 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chargeOverrideBlock}
                        onChange={(e) =>
                          setChargeOverrideBlock(e.target.checked)
                        }
                        className="w-4 h-4 accent-rose-600 rounded"
                      />
                      <span>
                        Autorizar excepción como Administrador para esta venta
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChargeModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingCharge ||
                    ((selectedEnrichedClient.isBlocked ||
                      (selectedEnrichedClient.creditLimit > 0 &&
                        selectedEnrichedClient.balanceNum +
                          (parseFloat(chargeAmount) || 0) >
                          selectedEnrichedClient.creditLimit)) &&
                      !chargeOverrideBlock)
                  }
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 cursor-pointer"
                >
                  {isSubmittingCharge
                    ? 'Registrando...'
                    : 'Confirmar Cargo en Cta. Cte.'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Impresión / PDF / WhatsApp para Recibos y Estado de Cuenta */}
      {activeVoucherModal && (
        <VoucherActionModal
          voucher={activeVoucherModal.voucher}
          initialTab={activeVoucherModal.tab}
          onClose={() => setActiveVoucherModal(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};
