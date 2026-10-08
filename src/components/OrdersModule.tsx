import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  CheckCircle2,
  Truck,
  X,
  FileText,
  Printer,
  Download,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Wrench,
  Paperclip,
  Image as ImageIcon,
  Maximize2,
  Upload,
  Share2,
  Camera,
  Link2,
  Wallet,
  Landmark,
  Repeat,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  Building2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  cleanPhoneForWhatsApp,
  buildAndOpenWhatsAppVoucherLink,
} from '../lib/whatsappVoucherSender.ts';
import {
  SupplierItem,
  ExpenseCategoryType,
  ExpenseRecurrenceFrequency,
  TreasuryAccount,
  CashflowEntry,
} from '../types/ferreteria.ts';
import { StatusBadge } from './StatusBadge.tsx';

export const EXPENSE_CATEGORIES: ExpenseCategoryType[] = [
  'Compra a Proveedor / Mercadería',
  'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)',
  'Inmueble (Alquiler, Expensas, Tasas Municipales)',
  'Personal (Sueldos, Comisiones, Cargas Sociales)',
  'Vehículos / Logística (Patente, Seguro, Combustible, Cuota de Vehículo)',
  'Impuestos y Tasas (AFIP/ARCA, Ingresos Brutos)',
  'Gastos Varios / Operativos',
];

export const RECURRENCE_FREQUENCIES: ExpenseRecurrenceFrequency[] = [
  'Mensual',
  'Bimensual',
  'Anual',
];

export const COMMON_SERVICE_BENEFICIARIES: {
  name: string;
  category: ExpenseCategoryType;
}[] = [
  {
    name: 'Edenor / Edesur (Energía Eléctrica)',
    category: 'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)',
  },
  {
    name: 'AySA (Agua y Saneamientos)',
    category: 'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)',
  },
  {
    name: 'Metrogas S.A.',
    category: 'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)',
  },
  {
    name: 'Telecom / Fibertel Corporativo',
    category: 'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)',
  },
  {
    name: 'Administración Inmobiliaria San Martín (Alquiler Local)',
    category: 'Inmueble (Alquiler, Expensas, Tasas Municipales)',
  },
  {
    name: 'Municipalidad — Tasa de Seguridad e Higiene / ABL',
    category: 'Inmueble (Alquiler, Expensas, Tasas Municipales)',
  },
  {
    name: 'Nómina de Personal — Sueldos y Comisiones',
    category: 'Personal (Sueldos, Comisiones, Cargas Sociales)',
  },
  {
    name: 'Sindicato de Empleados de Comercio / Cargas Sociales',
    category: 'Personal (Sueldos, Comisiones, Cargas Sociales)',
  },
  {
    name: 'YPF Ruta / Flota Reparto Ferretería',
    category:
      'Vehículos / Logística (Patente, Seguro, Combustible, Cuota de Vehículo)',
  },
  {
    name: 'Federación Patronal Seguros (Utilitarios)',
    category:
      'Vehículos / Logística (Patente, Seguro, Combustible, Cuota de Vehículo)',
  },
  {
    name: 'ARCA / AFIP (IVA, Ganancias y Autónomos)',
    category: 'Impuestos y Tasas (AFIP/ARCA, Ingresos Brutos)',
  },
  {
    name: 'ARBA / AGIP — Ingresos Brutos',
    category: 'Impuestos y Tasas (AFIP/ARCA, Ingresos Brutos)',
  },
];

const TREASURY_STORAGE_KEY = 'ferreteria_del_puente_treasury_accounts_v1';
const CASHFLOW_STORAGE_KEY = 'ferreteria_del_puente_cashflow_entries_v1';

export const DEFAULT_TREASURY_ACCOUNTS: TreasuryAccount[] = [
  {
    id: 'CAJA-CHICA-01',
    name: 'Caja Chica Mostrador Central',
    type: 'Caja Chica',
    balance: 1850000,
    accountDetail: 'Efectivo disponible en sucursal central',
  },
  {
    id: 'CAJA-TESORERIA-02',
    name: 'Caja Tesorería Operativa',
    type: 'Caja Chica',
    balance: 2450000,
    accountDetail: 'Fondo fijo para pagos operativos y servicios',
  },
  {
    id: 'BANCO-NACION-01',
    name: 'Cuenta Corriente Banco Nación',
    type: 'Cuenta Bancaria',
    balance: 8950000,
    accountDetail: 'CBU 0110599520000048192014 · Pesos ARS',
  },
  {
    id: 'BANCO-GALICIA-02',
    name: 'Cuenta Galicia Empresas',
    type: 'Cuenta Bancaria',
    balance: 5620000,
    accountDetail: 'CBU 0070045020000091827361 · eCheq / Transferencias',
  },
];

export const DEFAULT_CASHFLOW_ENTRIES: CashflowEntry[] = [
  {
    id: 'CF-INIT-01',
    isoDate: addDaysToTodayIso(-4),
    formattedDate: formatIsoToAr(addDaysToTodayIso(-4)),
    type: 'Egreso',
    category: 'Compra a Proveedor / Mercadería',
    concept: 'Cancelación total Orden OC-2026-0039',
    beneficiary: 'Sanitarios y Termofusión Federal S.A.',
    accountId: 'BANCO-NACION-01',
    accountName: 'Cuenta Corriente Banco Nación',
    paymentMethod: 'Transferencia Bancaria',
    amount: 540000,
    docRef: 'OP-0001-0000419',
  },
  {
    id: 'CF-INIT-02',
    isoDate: addDaysToTodayIso(-3),
    formattedDate: formatIsoToAr(addDaysToTodayIso(-3)),
    type: 'Egreso',
    category: 'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)',
    concept: 'Luz Local Comercial y Depósito - Período Anterior',
    beneficiary: 'Edenor / Edesur (Energía Eléctrica)',
    accountId: 'CAJA-TESORERIA-02',
    accountName: 'Caja Tesorería Operativa',
    paymentMethod: 'Débito / Caja Tesorería',
    amount: 148500,
    docRef: 'SERV-LUZ-009',
  },
  {
    id: 'CF-INIT-03',
    isoDate: addDaysToTodayIso(-1),
    formattedDate: formatIsoToAr(addDaysToTodayIso(-1)),
    type: 'Egreso',
    category:
      'Vehículos / Logística (Patente, Seguro, Combustible, Cuota de Vehículo)',
    concept: 'Carga Combustible Flota Reparto Semanal',
    beneficiary: 'YPF Ruta / Flota Reparto Ferretería',
    accountId: 'CAJA-CHICA-01',
    accountName: 'Caja Chica Mostrador Central',
    paymentMethod: 'Efectivo Caja Chica',
    amount: 92000,
    docRef: 'TCK-YPF-4412',
  },
];

export function loadTreasuryAccounts(): TreasuryAccount[] {
  if (typeof window === 'undefined') return DEFAULT_TREASURY_ACCOUNTS;
  try {
    const raw = window.localStorage.getItem(TREASURY_STORAGE_KEY);
    if (!raw) return DEFAULT_TREASURY_ACCOUNTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_TREASURY_ACCOUNTS;
  } catch {
    return DEFAULT_TREASURY_ACCOUNTS;
  }
}

export function loadCashflowEntries(): CashflowEntry[] {
  if (typeof window === 'undefined') return DEFAULT_CASHFLOW_ENTRIES;
  try {
    const raw = window.localStorage.getItem(CASHFLOW_STORAGE_KEY);
    if (!raw) return DEFAULT_CASHFLOW_ENTRIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_CASHFLOW_ENTRIES;
  } catch {
    return DEFAULT_CASHFLOW_ENTRIES;
  }
}

export function recordExpensePaymentInTreasuryAndCashflow(params: {
  accountId: string;
  amount: number;
  category: ExpenseCategoryType | string;
  concept: string;
  beneficiary: string;
  docRef?: string;
  paymentMethod?: string;
  isoDate?: string;
}): { accounts: TreasuryAccount[]; entries: CashflowEntry[] } {
  const currentAccounts = loadTreasuryAccounts();
  const targetAcc =
    currentAccounts.find((a) => a.id === params.accountId) ||
    currentAccounts[0];
  const cleanAmount = Math.max(0, Number(params.amount) || 0);

  const nextAccounts = currentAccounts.map((acc) =>
    acc.id === targetAcc.id
      ? { ...acc, balance: acc.balance - cleanAmount }
      : acc
  );

  const iso = params.isoDate || getTodayIso();
  const newEntry: CashflowEntry = {
    id: `CF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    isoDate: iso,
    formattedDate: formatIsoToAr(iso),
    type: 'Egreso',
    category: params.category || 'Compra a Proveedor / Mercadería',
    concept: params.concept || 'Pago de compromiso operativo',
    beneficiary: params.beneficiary || 'Beneficiario General',
    accountId: targetAcc.id,
    accountName: targetAcc.name,
    paymentMethod:
      params.paymentMethod ||
      (targetAcc.type === 'Caja Chica'
        ? 'Efectivo Caja Chica'
        : 'Transferencia Bancaria'),
    amount: cleanAmount,
    docRef: params.docRef,
  };

  const currentEntries = loadCashflowEntries();
  const nextEntries = [newEntry, ...currentEntries];

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        TREASURY_STORAGE_KEY,
        JSON.stringify(nextAccounts)
      );
      window.localStorage.setItem(
        CASHFLOW_STORAGE_KEY,
        JSON.stringify(nextEntries)
      );
      window.dispatchEvent(new Event('ferreteria-cashflow-updated'));
    } catch {
      // ignore storage errors
    }
  }

  return { accounts: nextAccounts, entries: nextEntries };
}

export function computeNextRecurrenceIsoDate(
  dueDateIso: string,
  frequency: ExpenseRecurrenceFrequency = 'Mensual'
): string {
  const base = normalizeToIsoDate(dueDateIso);
  const d = new Date(base + 'T12:00:00');
  if (frequency === 'Mensual') {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'Bimensual') {
    d.setMonth(d.getMonth() + 2);
  } else if (frequency === 'Anual') {
    d.setFullYear(d.getFullYear() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface SupplierDueInstallment {
  id: string;
  supplierId: number;
  supplierName: string; // Entidad / Beneficiario
  expenseCategory?: ExpenseCategoryType;
  concept?: string;
  docRef: string;
  issueDate?: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  totalAmount: number;
  paidAmount: number;
  status: 'Pendiente' | 'Pagado' | 'Parcial' | 'Vencido' | 'Saldado';
  isRecurring?: boolean;
  recurrenceFrequency?: ExpenseRecurrenceFrequency;
  treasuryAccountId?: string;
  paidAccountId?: string;
  paidAccountName?: string;
  notes?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf';
}

export interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  supplierId: number;
  supplierName: string;
  createdAt: string; // YYYY-MM-DD
  paymentDueDate: string; // YYYY-MM-DD
  orderStatus: 'Pendiente' | 'En Tránsito' | 'Recibido' | 'Cancelado';
  paymentStatus: 'Pendiente' | 'Parcial' | 'Saldado';
  totalAmount: number;
  paidAmount: number;
  itemsCount: number;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
  }[];
  notes?: string;
}

export interface UnifiedReturnRecord {
  id: string;
  docNumber: string;
  date: string; // DD/MM/YYYY or YYYY-MM-DD
  isoDate?: string; // YYYY-MM-DD
  supplierId: number;
  supplierName: string;
  reason: string;
  notes: string;
  totalCredit: number;
  status?: string;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
  }[];
}

export interface UnifiedPaymentRecord {
  id: string;
  receiptNumber: string;
  date: string; // DD/MM/YYYY or YYYY-MM-DD
  isoDate?: string; // YYYY-MM-DD
  supplierId?: number;
  supplierName: string;
  paymentMethod: string;
  amount: number;
  status?: string;
  note: string;
}

export interface VoucherDocumentData {
  docType:
    | 'Pedido a Proveedor'
    | 'Devolución a Proveedor'
    | 'Presupuesto'
    | 'Orden de Pago'
    | 'Vencimiento / Deuda Registrada'
    | 'Factura A'
    | 'Factura B'
    | 'Remito'
    | string;
  docNumber: string;
  dateFormatted: string;
  dueDateFormatted?: string;
  issueDate?: string;
  validUntilDate?: string;
  validityText?: string;
  recipientRoleLabel?: string;
  partyLabel?: string;
  partyName?: string;
  partyCuit?: string;
  partyPhone?: string;
  branchName?: string;
  operatorName?: string;
  statusLabel?: string;
  supplierName: string;
  supplierCuit?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  status: string;
  secondaryStatus?: string;
  totalAmount: number;
  paidAmount?: number;
  paymentMethod?: string;
  reason?: string;
  notes?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf';
  subtotalBeforeGlobalDiscount?: number;
  globalDiscountPct?: number;
  globalDiscountAmount?: number;
  clientAccountPreviousBalance?: number;
  clientAccountTotalBalance?: number;
  items: {
    sku: string;
    name: string;
    description?: string;
    quantity: number;
    unitCost: number;
    unitPrice?: number;
    originalUnitPrice?: number;
    discountPct?: number;
    discountAmount?: number;
    subtotal?: number;
  }[];
}

export type VoucherAccentColorKey = 'orange' | 'blue' | 'slate';

export interface VoucherCustomizationOptions {
  documentFormat: 'Ticket' | 'A4';
  thermalWidth: '58mm' | '80mm';
  escPosSharp: boolean;
  includeLogo: boolean;
  includeCommercialData: boolean;
  customLogoDataUrl: string;
  includeFooterTerms: boolean;
  footerTermsText: string;
  additionalNotes: string;
  accentColorKey: VoucherAccentColorKey;
}

export function cleanWhatsAppPhoneClient(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && !digits.startsWith('54')) {
    digits = `549${digits}`;
  } else if (
    digits.length === 11 &&
    !digits.startsWith('54') &&
    digits.includes('15')
  ) {
    digits = `549${digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')}`;
  } else if (digits.startsWith('54') && !digits.startsWith('549')) {
    const rest = digits.slice(2).replace(/^0+/, '');
    digits = `549${rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')}`;
  } else if (digits.startsWith('549')) {
    const rest = digits.slice(3).replace(/^0+/, '');
    digits = `549${rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')}`;
  }
  return digits;
}

export const VOUCHER_ACCENT_PALETTES: Record<
  VoucherAccentColorKey,
  {
    label: string;
    primary: string;
    primarySoftBg: string;
    primaryBorder: string;
    headerDark: string;
    badgeText: string;
  }
> = {
  orange: {
    label: 'Naranja Corporativo',
    primary: '#FF6600',
    primarySoftBg: '#fff7ed',
    primaryBorder: '#fed7aa',
    headerDark: '#0f172a',
    badgeText: '#ffffff',
  },
  blue: {
    label: 'Azul Ejecutivo',
    primary: '#1E40AF',
    primarySoftBg: '#eff6ff',
    primaryBorder: '#bfdbfe',
    headerDark: '#0f172a',
    badgeText: '#ffffff',
  },
  slate: {
    label: 'Gris Oscuro',
    primary: '#334155',
    primarySoftBg: '#f1f5f9',
    primaryBorder: '#cbd5e1',
    headerDark: '#0f172a',
    badgeText: '#ffffff',
  },
};

const CUSTOM_LOGO_STORAGE_KEY = 'ferreteria_del_puente_corporate_logo_v1';
const CUSTOM_PREFS_STORAGE_KEY = 'ferreteria_del_puente_pdf_prefs_v2';

// Formatea el número de ticket a 8 dígitos divididos por un guion al medio (ej: 0000-0000 o 1234-5678)
export function formatTicketNumber8Digits(rawDocNumber?: string): string {
  if (!rawDocNumber) return '0001-0001';
  const trimmed = String(rawDocNumber).trim();
  if (/^\d{4}-\d{4}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '0001-0001';
  if (digits.length <= 4) {
    return `0001-${digits.padStart(4, '0')}`;
  }
  const last8 = digits.slice(-8).padStart(8, '0');
  return `${last8.slice(0, 4)}-${last8.slice(4, 8)}`;
}

export function getDefaultFooterTermsForDoc(docType: string): string {
  const lower = (docType || '').toLowerCase();
  if (lower.includes('presupuesto')) {
    return 'Presupuesto válido por 15 días corridos desde su fecha de emisión. Precios sujetos a variación sin previo aviso y a disponibilidad de stock en depósito.';
  }
  if (lower.includes('devolución') || lower.includes('devolucion')) {
    return 'Comprobante oficial de devolución de mercadería. El importe consignado queda sujeto a verificación física y acreditación en Cuenta Corriente comercial.';
  }
  if (lower.includes('pedido')) {
    return 'Orden de compra sujeta a confirmación de disponibilidad y plazos de entrega pactados. Favor de consignar el número de pedido en el remito y factura correspondiente.';
  }
  return 'Documento comercial emitido por FERRETERIA DEL PUENTE. Conserve este comprobante como respaldo administrativo de la operación.';
}

export function loadSavedVoucherCustomization(
  voucher?: VoucherDocumentData | null
): VoucherCustomizationOptions {
  let savedLogo = '';
  let savedDocumentFormat: 'Ticket' | 'A4' = 'Ticket';
  let savedThermalWidth: '58mm' | '80mm' = '58mm';
  let savedEscPosSharp = true;
  let savedIncludeLogo = true;
  let savedIncludeCommercialData = true;
  let savedIncludeTerms = true;
  let savedAccent: VoucherAccentColorKey = 'orange';

  if (typeof window !== 'undefined') {
    try {
      savedLogo = window.localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY) || '';
      const rawPrefs = window.localStorage.getItem(CUSTOM_PREFS_STORAGE_KEY);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (parsed.documentFormat === 'Ticket' || parsed.documentFormat === 'A4') {
          savedDocumentFormat = parsed.documentFormat;
        }
        if (parsed.thermalWidth === '58mm' || parsed.thermalWidth === '80mm') {
          savedThermalWidth = parsed.thermalWidth;
        }
        if (typeof parsed.escPosSharp === 'boolean') {
          savedEscPosSharp = parsed.escPosSharp;
        }
        if (typeof parsed.includeLogo === 'boolean') {
          savedIncludeLogo = parsed.includeLogo;
        }
        if (typeof parsed.includeCommercialData === 'boolean') {
          savedIncludeCommercialData = parsed.includeCommercialData;
        }
        if (typeof parsed.includeFooterTerms === 'boolean') {
          savedIncludeTerms = parsed.includeFooterTerms;
        }
        if (
          parsed.accentColorKey === 'orange' ||
          parsed.accentColorKey === 'blue' ||
          parsed.accentColorKey === 'slate'
        ) {
          savedAccent = parsed.accentColorKey;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  return {
    documentFormat: savedDocumentFormat,
    thermalWidth: savedThermalWidth,
    escPosSharp: savedEscPosSharp,
    includeLogo: savedIncludeLogo,
    includeCommercialData: savedIncludeCommercialData,
    customLogoDataUrl: savedLogo,
    includeFooterTerms: savedIncludeTerms,
    footerTermsText: getDefaultFooterTermsForDoc(voucher?.docType || ''),
    additionalNotes: voucher?.notes || '',
    accentColorKey: savedAccent,
  };
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToTodayIso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatIsoToAr(isoDate: string): string {
  if (!isoDate) return '-';
  if (isoDate.includes('/')) return isoDate;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function normalizeToIsoDate(dateStr: string): string {
  if (!dateStr) return getTodayIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return getTodayIso();
}

export function getDaysDiffFromToday(isoDate: string): number {
  const today = new Date(getTodayIso() + 'T00:00:00');
  const target = new Date(normalizeToIsoDate(isoDate) + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function computeNextRecurringDueDate(
  isoDate: string,
  frequency: ExpenseRecurrenceFrequency
): string {
  const base = new Date(normalizeToIsoDate(isoDate) + 'T12:00:00');
  if (frequency === 'Mensual') {
    base.setMonth(base.getMonth() + 1);
  } else if (frequency === 'Bimensual') {
    base.setMonth(base.getMonth() + 2);
  } else if (frequency === 'Anual') {
    base.setFullYear(base.getFullYear() + 1);
  }
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function evaluateInstallmentUrgency(inst: SupplierDueInstallment): {
  remaining: number;
  daysDiff: number;
  urgency: 'overdue' | 'soon' | 'future' | 'settled';
  colorClass: string;
  dotClass: string;
  labelText: string;
} {
  const remaining = Math.max(0, inst.totalAmount - inst.paidAmount);
  const daysDiff = getDaysDiffFromToday(inst.dueDate);

  if (
    inst.status === 'Pagado' ||
    inst.status === 'Saldado' ||
    remaining <= 0.009
  ) {
    return {
      remaining: 0,
      daysDiff,
      urgency: 'settled',
      colorClass: 'bg-emerald-50 border-emerald-300 text-emerald-800',
      dotClass: 'bg-emerald-500',
      labelText: 'Pagado',
    };
  }

  if (inst.status === 'Vencido' || daysDiff <= 0) {
    return {
      remaining,
      daysDiff,
      urgency: 'overdue',
      colorClass: 'bg-rose-50 border-rose-300 text-rose-800',
      dotClass: 'bg-rose-600',
      labelText:
        daysDiff === 0
          ? 'Vencido Hoy'
          : daysDiff < 0
          ? `Vencido (${Math.abs(daysDiff)} d.)`
          : 'Vencido',
    };
  }

  if (daysDiff <= 7) {
    return {
      remaining,
      daysDiff,
      urgency: 'soon',
      colorClass: 'bg-amber-50 border-amber-300 text-amber-900',
      dotClass: 'bg-amber-500',
      labelText: `Próximo (${daysDiff} d.)`,
    };
  }

  return {
    remaining,
    daysDiff,
    urgency: 'future',
    colorClass: 'bg-amber-50/60 border-amber-200 text-amber-900',
    dotClass: 'bg-amber-400',
    labelText: `En ${daysDiff} días`,
  };
}

// Sanitiza texto para stream PDF estándar (WinAnsi / Latin1 básico)
function toPdfSafeText(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/([()\\])/g, '\\$1');
}

// Construye un archivo PDF binario válido (%PDF-1.4) con membrete FERRETERIA DEL PUENTE para compartir con navigator.share({ files: [pdfFile] }) o descargar
export function buildVoucherPdfFile(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string
): File {
  const lines: { text: string; size: number; bold?: boolean; y: number }[] = [];
  let y = 790;

  lines.push({
    text: 'FERRETERIA DEL PUENTE - DOCUMENTO COMERCIAL OFICIAL',
    size: 14,
    bold: true,
    y,
  });
  y -= 16;
  lines.push({
    text: 'Ferreteria Industrial, Buloneria, Sanitarios y Materiales Electricos | CUIT: 30-71458920-9',
    size: 9,
    y,
  });
  y -= 18;
  lines.push({
    text: '------------------------------------------------------------------------------------------------',
    size: 9,
    y,
  });
  y -= 16;
  lines.push({
    text: `COMPROBANTE: ${voucher.docType.toUpperCase()}   |   NRO: ${voucher.docNumber}   |   FECHA: ${voucher.dateFormatted}`,
    size: 11,
    bold: true,
    y,
  });
  y -= 16;
  lines.push({
    text: `PROVEEDOR: ${voucher.supplierName} ${voucher.supplierCuit ? `(CUIT: ${voucher.supplierCuit})` : ''}`,
    size: 10,
    bold: true,
    y,
  });
  y -= 14;
  lines.push({
    text: `ESTADO: ${voucher.status}${voucher.secondaryStatus ? ` | ${voucher.secondaryStatus}` : ''}${voucher.reason ? ` | Motivo: ${voucher.reason}` : ''}`,
    size: 9,
    y,
  });
  y -= 16;
  lines.push({
    text: '------------------------------------------------------------------------------------------------',
    size: 9,
    y,
  });
  y -= 14;
  lines.push({
    text: 'CODIGO / SKU       DESCRIPCION DEL ARTICULO / CONCEPTO                 CANT.    SUBTOTAL',
    size: 9,
    bold: true,
    y,
  });
  y -= 12;
  lines.push({
    text: '------------------------------------------------------------------------------------------------',
    size: 9,
    y,
  });

  const itemList =
    voucher.items.length > 0
      ? voucher.items
      : [
          {
            sku: voucher.docNumber,
            name: `${voucher.docType} - ${voucher.paymentMethod || 'Cuenta Corriente'}`,
            quantity: 1,
            unitCost: voucher.totalAmount,
          },
        ];

  itemList.slice(0, 26).forEach((it) => {
    y -= 14;
    const skuCol = String(it.sku || '')
      .slice(0, 16)
      .padEnd(18, ' ');
    const nameCol = String(it.name || '')
      .slice(0, 44)
      .padEnd(46, ' ');
    const qtyCol = String(it.quantity).padStart(5, ' ');
    const subCol = formatCurrency(it.quantity * it.unitCost).padStart(14, ' ');
    lines.push({
      text: `${skuCol} ${nameCol} ${qtyCol} ${subCol}`,
      size: 8.5,
      y,
    });
  });

  y -= 18;
  lines.push({
    text: '------------------------------------------------------------------------------------------------',
    size: 9,
    y,
  });
  y -= 16;
  lines.push({
    text: `TOTAL DEL COMPROBANTE: ${formatCurrency(voucher.totalAmount)}`,
    size: 12,
    bold: true,
    y,
  });

  if (voucher.notes) {
    y -= 16;
    lines.push({
      text: `Observaciones: ${voucher.notes.slice(0, 90)}`,
      size: 9,
      y,
    });
  }

  const streamOps = [
    'BT',
    ...lines.map(
      (l) =>
        `/${l.bold ? 'F2' : 'F1'} ${l.size} Tf 1 0 0 1 36 ${l.y} Tm (${toPdfSafeText(l.text)}) Tj`
    ),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n'
  );
  objects.push(
    `4 0 obj\n<< /Length ${streamOps.length} >>\nstream\n${streamOps}\nendstream\nendobj\n`
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n'
  );
  objects.push(
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n'
  );

  let pdfBody = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj) => {
    offsets.push(pdfBody.length);
    pdfBody += obj;
  });
  const xrefStart = pdfBody.length;
  pdfBody += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdfBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfBody += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const encoder = new TextEncoder();
  const pdfBytes = encoder.encode(pdfBody);
  const safeDoc = voucher.docNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return new File([pdfBytes], `FERRETERIA_DEL_PUENTE_${safeDoc}.pdf`, {
    type: 'application/pdf',
  });
}

// ====================================================================
// MÓDULO 3: PLANTILLA PDF A4 LIMPIA EN HTML/CSS
// ====================================================================
export function buildVoucherHtmlContent(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string
): string {
  const rowsHtml =
    voucher.items.length > 0
      ? voucher.items
          .map(
            (item, idx) => `
          <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 12px;font-family:monospace;font-weight:700;color:#0f172a;">${item.sku}</td>
            <td style="padding:10px 12px;color:#1e293b;">${item.name}</td>
            <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;">${item.quantity}</td>
            <td style="padding:10px 12px;text-align:right;font-family:monospace;">${formatCurrency(item.unitCost)}</td>
            <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;color:#0f172a;">${formatCurrency(item.quantity * item.unitCost)}</td>
          </tr>`
          )
          .join('')
      : `
          <tr style="background:#ffffff;border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px;font-family:monospace;font-weight:700;">${voucher.docNumber}</td>
            <td style="padding:12px;">${voucher.docType} — ${voucher.paymentMethod || 'Contado'}</td>
            <td style="padding:12px;text-align:right;font-family:monospace;font-weight:700;">1</td>
            <td style="padding:12px;text-align:right;font-family:monospace;">${formatCurrency(voucher.totalAmount)}</td>
            <td style="padding:12px;text-align:right;font-family:monospace;font-weight:700;">${formatCurrency(voucher.totalAmount)}</td>
          </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${voucher.docType} - ${voucher.docNumber} - FERRETERIA DEL PUENTE</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
    .sheet { max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-top: 6px solid #FF6600; border-radius: 12px; padding: 28px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo-fp { width: 46px; height: 46px; border-radius: 10px; background: #FF6600; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; }
    .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 12px; }
    .card-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #FF6600; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .client-card { background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #FF6600; border-radius: 8px; padding: 12px 14px; font-size: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; }
    .obs-box { background: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #FF6600; border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 16px; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-box { width: 280px; background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 10px; border-bottom: 3px solid #FF6600; display: flex; justify-content: space-between; align-items: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <div class="logo-fp">FP</div>
        <div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;">FERRETERIA DEL PUENTE</div>
          <div style="font-size:12px;color:#475569;">División Industrial, Herramientas, Bulonería y Materiales</div>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="background:#FF6600;color:#fff;font-weight:800;font-size:11px;padding:4px 10px;border-radius:6px;text-transform:uppercase;">${voucher.docType}</span>
        <div style="font-family:monospace;font-size:16px;font-weight:800;margin-top:6px;color:#0f172a;">N° ${voucher.docNumber}</div>
      </div>
    </div>

    <div class="cards-grid">
      <div class="card">
        <div class="card-title">Emisor</div>
        <div><strong>FERRETERIA DEL PUENTE S.R.L.</strong></div>
        <div>Dirección: Av. San Martín 1450, CABA</div>
        <div>Tel: +54 11 4582-9100 · CUIT: 30-71458920-9</div>
        <div>IVA Responsable Inscripto</div>
      </div>
      <div class="card">
        <div class="card-title">Comprobante</div>
        <div><strong>N° Comprobante:</strong> ${voucher.docNumber}</div>
        <div><strong>Fecha de Emisión:</strong> ${voucher.dateFormatted}</div>
        <div><strong>Estado:</strong> ${voucher.status}</div>
      </div>
    </div>

    <div class="client-card">
      <div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;">Cliente Receptor</div>
        <div style="font-size:14px;font-weight:800;">${voucher.supplierName}</div>
        ${voucher.supplierCuit ? `<div style="font-family:monospace;color:#475569;">CUIT/DNI: ${voucher.supplierCuit}</div>` : ''}
      </div>
      <div style="text-align:right;color:#475569;">
        ${voucher.supplierPhone ? `<div><strong>Teléfono:</strong> ${voucher.supplierPhone}</div>` : ''}
        ${voucher.paymentMethod ? `<div><strong>Medio de Pago:</strong> ${voucher.paymentMethod}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th style="text-align:right;">Cantidad</th>
          <th style="text-align:right;">Precio Unitario</th>
          <th style="text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="obs-box">
      <strong>Observaciones:</strong> ${voucher.notes || 'Gracias por su compra en FERRETERIA DEL PUENTE.'}
    </div>

    <div class="totals">
      <div class="totals-box">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:#cbd5e1;">Importe Total:</span>
        <span style="font-family:monospace;font-size:18px;font-weight:800;color:#ffffff;">${formatCurrency(voucher.totalAmount)}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Convierte matemáticamente oklch(L C H / A) u oklab(L a b / A) a rgb()/rgba() y respalda con Canvas 2D para que html2canvas conserve el 100% de los colores de Tailwind CSS
function convertOklchOrOklabMatchToRgb(fnName: string, rawArgs: string): string | null {
  try {
    const [coordsPart, alphaPart] = rawArgs.split('/').map((s) => s.trim());
    const parts = coordsPart.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;

    const parseChannel = (val: string, isLightness = false): number => {
      if (val.endsWith('%')) {
        const pct = parseFloat(val) / 100;
        return isLightness ? pct : pct * 0.4;
      }
      if (val.endsWith('deg')) return parseFloat(val);
      if (val.endsWith('rad')) return (parseFloat(val) * 180) / Math.PI;
      if (val.endsWith('turn')) return parseFloat(val) * 360;
      if (val.endsWith('grad')) return parseFloat(val) * 0.9;
      return parseFloat(val);
    };

    const L = parseChannel(parts[0], true);
    let a = 0;
    let b = 0;
    if (fnName.toLowerCase() === 'oklch') {
      const C = parseChannel(parts[1], false);
      const H = parseChannel(parts[2], false);
      const hRad = (H * Math.PI) / 180;
      a = C * Math.cos(hRad);
      b = C * Math.sin(hRad);
    } else {
      a = parseChannel(parts[1], false);
      b = parseChannel(parts[2], false);
    }

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const toSrgb255 = (c: number) => {
      const clamped = Math.max(0, Math.min(1, c));
      const gamma =
        clamped <= 0.0031308
          ? 12.92 * clamped
          : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(255, gamma * 255)));
    };

    const r = toSrgb255(rLin);
    const g = toSrgb255(gLin);
    const bl = toSrgb255(bLin);

    if (alphaPart !== undefined && alphaPart !== '') {
      const alpha = alphaPart.endsWith('%')
        ? parseFloat(alphaPart) / 100
        : parseFloat(alphaPart);
      if (!isNaN(alpha) && alpha < 1) {
        return `rgba(${r}, ${g}, ${bl}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
      }
    }
    return `rgb(${r}, ${g}, ${bl})`;
  } catch {
    return null;
  }
}

let colorConvertCtx: CanvasRenderingContext2D | null = null;
function resolveModernCssColorsToRgb(cssText: string): string {
  if (
    !cssText ||
    (!cssText.includes('oklch') &&
      !cssText.includes('oklab') &&
      !cssText.includes('color-mix') &&
      !cssText.includes('color('))
  ) {
    return cssText;
  }

  let result = cssText.replace(
    /(oklch|oklab)\(([^()]+)\)/gi,
    (fullMatch, fnName, innerArgs) => {
      const converted = convertOklchOrOklabMatchToRgb(fnName, innerArgs);
      return converted || fullMatch;
    }
  );

  if (typeof document === 'undefined') return result;
  if (!colorConvertCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    colorConvertCtx = c.getContext('2d', { willReadFrequently: true });
  }
  const ctx = colorConvertCtx;
  if (!ctx) return result;

  const replaceFn = (match: string): string => {
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = match;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      if (a === 0) return 'rgba(0, 0, 0, 0)';
      if (a === 255) return `rgb(${r}, ${g}, ${b})`;
      return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    } catch {
      return match;
    }
  };

  result = result.replace(
    /color-mix\([^()]*(?:\([^()]*\)[^()]*)*\)/gi,
    replaceFn
  );
  result = result.replace(/(?:oklch|oklab|lch|lab|color)\([^)]+\)/gi, replaceFn);
  return result;
}

function getBadgeInlineColors(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  const normalized = (status || '').trim().toLowerCase();
  if (
    normalized === 'aceptado' ||
    normalized === 'activa' ||
    normalized === 'activo' ||
    normalized === 'controla stock' ||
    normalized === 'saldado' ||
    normalized === 'recibido' ||
    normalized === 'acreditado' ||
    normalized === 'al día' ||
    normalized === 'al dia'
  ) {
    return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
  }
  if (
    normalized === 'pedido' ||
    normalized.startsWith('pedido') ||
    normalized.includes('en pedido')
  ) {
    return { bg: '#eef2ff', text: '#4338ca', border: '#a5b4fc' };
  }
  if (
    normalized === 'emitido' ||
    normalized === 'saldo a favor' ||
    normalized === 'en tránsito' ||
    normalized === 'en transito'
  ) {
    return { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };
  }
  if (
    normalized === 'pendiente' ||
    normalized === 'parcial' ||
    normalized === 'pago parcial' ||
    normalized === 'saldo pendiente' ||
    normalized === 'stock bajo'
  ) {
    return { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' };
  }
  if (
    normalized === 'anulado' ||
    normalized === 'cancelado' ||
    normalized === 'crítico' ||
    normalized.includes('vencido')
  ) {
    return { bg: '#fff1f2', text: '#be123c', border: '#fda4af' };
  }
  return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
}

// Construye un nodo DOM idéntico a #comprobante-impresion cuando se exporta sin tener el modal abierto
function createOffscreenComprobanteNode(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string,
  customOptions?: VoucherCustomizationOptions
): HTMLDivElement {
  const opts = customOptions || loadSavedVoucherCustomization(voucher);
  const palette =
    VOUCHER_ACCENT_PALETTES[opts.accentColorKey] ||
    VOUCHER_ACCENT_PALETTES.orange;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '780px';
  wrapper.style.background = '#ffffff';
  wrapper.style.zIndex = '-1';

  const st1 = getBadgeInlineColors(voucher.status);
  const st2 = voucher.secondaryStatus
    ? getBadgeInlineColors(voucher.secondaryStatus)
    : null;

  const isClientDoc =
    voucher.docType.toLowerCase().includes('presupuesto') ||
    voucher.docType.toLowerCase().includes('factura') ||
    voucher.docType.toLowerCase().includes('remito');

  const recipientHeading =
    voucher.recipientRoleLabel ||
    (isClientDoc ? 'Cliente / Destinatario' : 'Proveedor Destinatario');

  const validityDisplay =
    voucher.dueDateFormatted ||
    voucher.validityText ||
    (voucher.docType.toLowerCase().includes('presupuesto')
      ? '15 días corridos'
      : '15 días / Según convenio');

  const combinedNotes = (opts.additionalNotes || voucher.notes || '').trim();

  const logoHtml = opts.includeLogo
    ? opts.customLogoDataUrl
      ? `<img src="${opts.customLogoDataUrl}" alt="Logo Corporativo" style="width: 50px; height: 50px; object-fit: contain; border-radius: 10px; border: 1px solid #e2e8f0; background-color: #ffffff; padding: 4px; flex-shrink: 0;" />`
      : `<div style="width: 48px; height: 48px; border-radius: 12px; background-color: ${palette.primary}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; letter-spacing: -0.03em; flex-shrink: 0;">FP</div>`
    : '';

  let grossOriginalTotal = 0;
  let afterItemDiscountsTotal = 0;
  voucher.items.forEach((it) => {
    const qty = Number(it.quantity || 1);
    const unitFinal = Number(it.unitPrice ?? it.unitCost ?? 0);
    const origUnit = Number(it.originalUnitPrice ?? unitFinal);
    const lineSub =
      it.subtotal !== undefined ? Number(it.subtotal) : qty * unitFinal;
    grossOriginalTotal += qty * Math.max(origUnit, unitFinal);
    afterItemDiscountsTotal += lineSub;
  });
  const totalItemDiscounts = Math.max(
    0,
    Number((grossOriginalTotal - afterItemDiscountsTotal).toFixed(2))
  );
  const globalDiscountVal = Math.max(
    0,
    Number(voucher.globalDiscountAmount || 0)
  );
  const effectiveOriginalSubtotal =
    totalItemDiscounts > 0
      ? grossOriginalTotal
      : Number(
          voucher.subtotalBeforeGlobalDiscount ??
            afterItemDiscountsTotal ??
            voucher.totalAmount + globalDiscountVal
        );
  const combinedDiscountsTotal = Number(
    (totalItemDiscounts + globalDiscountVal).toFixed(2)
  );

  const rowsHtml =
    voucher.items.length > 0
      ? voucher.items
          .map((it, idx) => {
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            const hasItemDiscount = Number(it.discountPct || 0) > 0;
            const unitFinal = Number(it.unitPrice ?? it.unitCost ?? 0);
            const origUnit = Number(it.originalUnitPrice || unitFinal);
            const lineSubtotal =
              it.subtotal !== undefined ? Number(it.subtotal) : it.quantity * unitFinal;
            return `
          <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #0f172a; font-size: 12px;">${it.sku}</td>
            <td style="padding: 10px 14px; color: #1e293b; font-size: 12px; font-weight: 500;">
              <div>${it.name}</div>
              ${
                hasItemDiscount
                  ? `<div style="font-size: 10.5px; font-weight: 700; color: #047857; margin-top: 2px;">Precio Orig.: ${formatCurrency(origUnit)} · Dto. Aplicado: -${it.discountPct}% (-${formatCurrency((origUnit - unitFinal) * it.quantity)})</div>`
                  : ''
              }
            </td>
            <td style="padding: 10px 14px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #0f172a; font-size: 12px;">${it.quantity}</td>
            <td style="padding: 10px 14px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #475569; font-size: 12px;">
              ${
                hasItemDiscount
                  ? `<div style="text-decoration: line-through; font-size: 10px; color: #94a3b8;">${formatCurrency(origUnit)}</div><div>${formatCurrency(unitFinal)}</div>`
                  : formatCurrency(unitFinal)
              }
            </td>
            <td style="padding: 10px 14px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #0f172a; font-size: 12px;">${formatCurrency(lineSubtotal)}</td>
          </tr>`;
          })
          .join('')
      : `
          <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #0f172a; font-size: 12px;">${voucher.docNumber}</td>
            <td style="padding: 12px 14px; color: #1e293b; font-size: 12px; font-weight: 500;">
              ${voucher.docType} — ${voucher.paymentMethod || 'Cuenta Corriente Comercial'}${combinedNotes ? ` (${combinedNotes})` : ''}
            </td>
            <td style="padding: 12px 14px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; font-size: 12px;">1</td>
            <td style="padding: 12px 14px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #475569; font-size: 12px;">${formatCurrency(voucher.totalAmount)}</td>
            <td style="padding: 12px 14px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #0f172a; font-size: 12px;">${formatCurrency(voucher.totalAmount)}</td>
          </tr>`;

  wrapper.innerHTML = `
    <div id="comprobante-impresion" data-doc-number="${voucher.docNumber}" style="font-family: 'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1px solid #cbd5e1; border-top: 6px solid ${palette.primary}; border-radius: 14px; padding: 26px; background-color: #ffffff; color: #0f172a; width: 780px; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${logoHtml}
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.03em; color: #0f172a;">FERRETERIA DEL PUENTE</span>
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; background-color: #0f172a; color: #ffffff;">DOCUMENTO OFICIAL</span>
            </div>
            <p style="font-size: 12px; color: #475569; margin: 3px 0 0 0; font-weight: 500;">División Industrial, Herramientas Profesionales, Bulonería y Materiales</p>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 5px 12px; border-radius: 6px; background-color: ${palette.primary}; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase;">${voucher.docType}</span>
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">N° ${voucher.docNumber}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div style="background-color: #f8fafc; padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 12px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: ${palette.primary}; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            Datos del Emisor / Empresa
          </div>
          <p style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">FERRETERIA DEL PUENTE S.R.L.</p>
          <p style="color: #334155; margin: 2px 0;"><strong>Dirección:</strong> Av. San Martín 1450, CABA</p>
          <p style="color: #334155; margin: 2px 0;"><strong>Teléfono:</strong> +54 11 4582-9100 / Atención Comercial</p>
          <p style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #334155; margin: 2px 0;"><strong>CUIT:</strong> 30-71458920-9 · IVA Resp. Inscripto</p>
          <p style="color: #334155; margin: 2px 0;"><strong>Email:</strong> administracion@ferreteriadelpuente.com.ar</p>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 12px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: ${palette.primary}; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            Datos del Comprobante
          </div>
          <div style="display: flex; justify-content: space-between; margin: 3px 0;">
            <span style="color: #64748b; font-weight: 600;">Nro. de Comprobante:</span>
            <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; color: #0f172a;">${voucher.docNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 3px 0;">
            <span style="color: #64748b; font-weight: 600;">Fecha de Emisión:</span>
            <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #0f172a;">${voucher.dateFormatted}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 3px 0;">
            <span style="color: #64748b; font-weight: 600;">Validez / Vencimiento:</span>
            <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #334155;">${validityDisplay}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
            <span style="color: #64748b; font-weight: 600;">Estado:</span>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;">
              <span style="display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; background-color: ${st1.bg}; color: ${st1.text}; border: 1px solid ${st1.border};">${voucher.status}</span>
              ${
                voucher.secondaryStatus && st2
                  ? `<span style="display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; background-color: ${st2.bg}; color: ${st2.text}; border: 1px solid ${st2.border};">${voucher.secondaryStatus}</span>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>

      <div style="background-color: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; border-left: 4px solid ${palette.primary}; font-size: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; display: block;">${recipientHeading}</span>
          <span style="font-size: 14px; font-weight: 800; color: #0f172a;">${voucher.supplierName}</span>
          ${voucher.supplierCuit ? `<span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #475569; margin-left: 10px;">· CUIT: ${voucher.supplierCuit}</span>` : ''}
        </div>
        <div style="text-align: right; color: #475569; font-size: 11px;">
          ${voucher.supplierPhone ? `<div><strong>Teléfono:</strong> ${voucher.supplierPhone}</div>` : ''}
          ${voucher.supplierEmail ? `<div><strong>Email:</strong> ${voucher.supplierEmail}</div>` : ''}
          ${voucher.paymentMethod ? `<div><strong>Condición / Medio:</strong> ${voucher.paymentMethod}</div>` : ''}
          ${voucher.reason ? `<div><strong>Motivo:</strong> ${voucher.reason}</div>` : ''}
        </div>
      </div>

      <div style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 18px;">
        <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
              <th style="padding: 11px 14px;">Código / SKU</th>
              <th style="padding: 11px 14px;">Descripción / Concepto</th>
              <th style="padding: 11px 14px; text-align: right;">Cant.</th>
              <th style="padding: 11px 14px; text-align: right;">Precio / Costo Unit.</th>
              <th style="padding: 11px 14px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${
        combinedNotes
          ? `<div style="padding: 12px 14px; border-radius: 8px; background-color: ${palette.primarySoftBg}; border: 1px solid ${palette.primaryBorder}; border-left: 4px solid ${palette.primary}; font-size: 12px; color: #1e293b; margin-bottom: 18px;">
              <strong style="color: #0f172a; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Observaciones / Notas Adicionales:</strong>
              <span>${combinedNotes}</span>
            </div>`
          : ''
      }

      ${
        voucher.attachmentUrl
          ? `<div style="padding: 14px; border-radius: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 18px;">
              <div style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Anexo: Boleta / Factura Adjunta (${voucher.attachmentName || 'Comprobante'})</div>
              ${
                voucher.attachmentType === 'pdf'
                  ? `<div style="padding: 10px; border-radius: 8px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 12px; font-family: monospace; color: #334155;">Archivo PDF adjunto: ${voucher.attachmentName}</div>`
                  : `<div style="text-align: center;"><img src="${voucher.attachmentUrl}" alt="Boleta Adjunta" style="max-height: 200px; border-radius: 8px; border: 1px solid #e2e8f0; background-color: #ffffff; padding: 4px; object-fit: contain;" /></div>`
              }
            </div>`
          : ''
      }

      <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 240px;">
          ${
            typeof voucher.clientAccountTotalBalance === 'number'
              ? `<div style="padding: 10px 14px; margin-bottom: 10px; border-radius: 10px; background-color: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #d97706; font-size: 12px; color: #78350f;">
                  <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #b45309;">Estado de Cuenta Corriente del Cliente</div>
                  ${
                    typeof voucher.clientAccountPreviousBalance === 'number'
                      ? `<div style="display: flex; justify-content: space-between; margin-top: 3px; font-size: 11px;"><span>Saldo Anterior:</span><strong style="font-family: monospace;">${formatCurrency(voucher.clientAccountPreviousBalance)}</strong></div>`
                      : ''
                  }
                  <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #fcd34d; font-size: 13px; font-weight: 900; color: #78350f;">
                    <span>SALDO TOTAL CTA. CTE.:</span>
                    <span style="font-family: monospace;">${formatCurrency(voucher.clientAccountTotalBalance)}</span>
                  </div>
                </div>`
              : ''
          }
          ${
            opts.includeFooterTerms && opts.footerTermsText.trim()
              ? `<div style="padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #64748b; line-height: 1.45;">
                  <strong style="color: #334155; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Términos, Condiciones y Notas al Pie:</strong>
                  ${opts.footerTermsText}
                </div>`
              : ''
          }
        </div>
        <div style="width: 320px; display: flex; flex-direction: column; gap: 6px;">
          <div style="padding: 10px 14px; border-radius: 8px; background-color: ${combinedDiscountsTotal > 0 ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${combinedDiscountsTotal > 0 ? '#a7f3d0' : '#e2e8f0'}; font-size: 11.5px; color: #0f172a;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #475569; font-weight: 600;">Subtotal Original:</span>
              <strong style="font-family: monospace;">${formatCurrency(effectiveOriginalSubtotal)}</strong>
            </div>
            ${
              totalItemDiscounts > 0
                ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #047857; font-weight: 700;">
                    <span>Bonificación por Ítems:</span>
                    <span style="font-family: monospace;">- ${formatCurrency(totalItemDiscounts)}</span>
                  </div>`
                : ''
            }
            ${
              globalDiscountVal > 0
                ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #047857; font-weight: 700;">
                    <span>Descuento Global${voucher.globalDiscountPct ? ` (${voucher.globalDiscountPct}%)` : ''}:</span>
                    <span style="font-family: monospace;">- ${formatCurrency(globalDiscountVal)}</span>
                  </div>`
                : ''
            }
            <div style="display: flex; justify-content: space-between; padding-top: 3px; border-top: 1px dashed ${combinedDiscountsTotal > 0 ? '#6ee7b7' : '#cbd5e1'}; font-weight: 800; color: ${combinedDiscountsTotal > 0 ? '#047857' : '#64748b'};">
              <span>Descuento Total Aplicado:</span>
              <span style="font-family: monospace;">-${formatCurrency(combinedDiscountsTotal)}</span>
            </div>
          </div>
          <div style="padding: 14px 18px; border-radius: 12px; background-color: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${palette.primary};">
            <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #cbd5e1;">Total Final a Pagar:</span>
            <span style="font-size: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; color: #ffffff;">${formatCurrency(voucher.totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
}

// Captura directamente el contenedor HTML #comprobante-impresion usando html2canvas (scale: 2) y genera un PDF A4 vertical con márgenes de 10mm
export async function generateVoucherPdfInstance(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string,
  customOptions?: VoucherCustomizationOptions
): Promise<{ pdf: jsPDF; fileName: string }> {
  const safeDoc = voucher.docNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `FERRETERIA_DEL_PUENTE_${safeDoc}.pdf`;

  let existingEl = document.getElementById(
    'comprobante-impresion'
  ) as HTMLElement | null;
  let tempWrapper: HTMLDivElement | null = null;

  if (
    !existingEl ||
    (existingEl.dataset.docNumber &&
      existingEl.dataset.docNumber !== voucher.docNumber)
  ) {
    tempWrapper = createOffscreenComprobanteNode(
      voucher,
      formatCurrency,
      customOptions
    );
    document.body.appendChild(tempWrapper);
    existingEl = tempWrapper.querySelector(
      '#comprobante-impresion'
    ) as HTMLElement;
  }

  try {
    // Pre-calcula los estilos RGB reales de cada nodo del comprobante antes de clonar
    const sourceNodes = [
      existingEl,
      ...Array.from(existingEl.querySelectorAll('*')),
    ] as HTMLElement[];
    const resolvedStyleSnapshots = sourceNodes.map((node) => {
      const cs = window.getComputedStyle(node);
      return {
        color: resolveModernCssColorsToRgb(cs.color),
        backgroundColor: resolveModernCssColorsToRgb(cs.backgroundColor),
        borderTopColor: resolveModernCssColorsToRgb(cs.borderTopColor),
        borderRightColor: resolveModernCssColorsToRgb(cs.borderRightColor),
        borderBottomColor: resolveModernCssColorsToRgb(cs.borderBottomColor),
        borderLeftColor: resolveModernCssColorsToRgb(cs.borderLeftColor),
        outlineColor: resolveModernCssColorsToRgb(cs.outlineColor),
        boxShadow: resolveModernCssColorsToRgb(cs.boxShadow),
      };
    });

    const canvas = await html2canvas(existingEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 920,
      onclone: (clonedDoc, clonedEl) => {
        // 1. Inyecta regla CSS global de preservación exacta de color en el documento clonado
        const printStyleEl = clonedDoc.createElement('style');
        printStyleEl.textContent = `
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .bg-slate-900 {
            background-color: #0f172a !important;
            color: #ffffff !important;
          }
          .bg-orange-500, .bg-\\[\\#FF6600\\] {
            background-color: #FF6600 !important;
            color: #ffffff !important;
          }
          .text-\\[\\#FF6600\\], .text-orange-500 {
            color: #FF6600 !important;
          }
          .border-\\[\\#FF6600\\] {
            border-color: #FF6600 !important;
          }
          .bg-slate-50 {
            background-color: #f8fafc !important;
          }
        `;
        clonedDoc.head.appendChild(printStyleEl);

        // 2. Convierte cualquier regla oklch/oklab en hojas <style> del documento clonado
        clonedDoc.querySelectorAll('style').forEach((styleTag) => {
          if (styleTag !== printStyleEl && styleTag.textContent) {
            styleTag.textContent = resolveModernCssColorsToRgb(
              styleTag.textContent
            );
          }
        });

        // 3. Aplica colores RGB resueltos y print-color-adjust: exact a cada elemento clonado
        const clonedNodes = [
          clonedEl,
          ...Array.from(clonedEl.querySelectorAll('*')),
        ] as HTMLElement[];
        clonedNodes.forEach((cNode, idx) => {
          const snap = resolvedStyleSnapshots[idx];
          if (!cNode.style) return;
          cNode.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
          cNode.style.setProperty('print-color-adjust', 'exact', 'important');
          cNode.style.setProperty('color-adjust', 'exact', 'important');

          if (snap) {
            cNode.style.color = snap.color;
            cNode.style.backgroundColor = snap.backgroundColor;
            cNode.style.borderTopColor = snap.borderTopColor;
            cNode.style.borderRightColor = snap.borderRightColor;
            cNode.style.borderBottomColor = snap.borderBottomColor;
            cNode.style.borderLeftColor = snap.borderLeftColor;
            cNode.style.outlineColor = snap.outlineColor;
            if (snap.boxShadow && snap.boxShadow !== 'none') {
              cNode.style.boxShadow = snap.boxShadow;
            }
          }

          if (cNode.dataset && cNode.dataset.badgeBg) {
            cNode.style.backgroundColor = cNode.dataset.badgeBg;
            if (cNode.dataset.badgeText) {
              cNode.style.color = cNode.dataset.badgeText;
            }
            if (cNode.dataset.badgeBorder) {
              cNode.style.borderColor = cNode.dataset.badgeBorder;
              cNode.style.borderTopColor = cNode.dataset.badgeBorder;
              cNode.style.borderRightColor = cNode.dataset.badgeBorder;
              cNode.style.borderBottomColor = cNode.dataset.badgeBorder;
              cNode.style.borderLeftColor = cNode.dataset.badgeBorder;
            }
          }
        });

        // 4. Garantiza que ningún contenedor ni tabla recorte filas ni columnas en formato A4 vertical
        clonedEl.style.backgroundColor = '#ffffff';
        clonedEl.style.width = '780px';
        clonedEl.style.maxWidth = '780px';
        clonedEl.style.overflow = 'visible';
        clonedEl.style.maxHeight = 'none';
        clonedEl.style.height = 'auto';
        clonedEl.querySelectorAll('.overflow-x-auto').forEach((tableWrap) => {
          (tableWrap as HTMLElement).style.overflow = 'visible';
        });
      },
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 10; // Márgenes de 10mm en los 4 lados
    const usableWidthMm = pageWidthMm - marginMm * 2; // 190mm
    const usableHeightMm = pageHeightMm - marginMm * 2; // 277mm

    const imgHeightMm = (canvas.height * usableWidthMm) / canvas.width;

    if (imgHeightMm <= usableHeightMm) {
      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(
        imgData,
        'PNG',
        marginMm,
        marginMm,
        usableWidthMm,
        imgHeightMm,
        undefined,
        'FAST'
      );
    } else if (imgHeightMm <= usableHeightMm * 1.28) {
      const imgData = canvas.toDataURL('image/png', 1.0);
      const ratio = usableHeightMm / imgHeightMm;
      const finalWidthMm = usableWidthMm * ratio;
      const offsetX = marginMm + (usableWidthMm - finalWidthMm) / 2;
      pdf.addImage(
        imgData,
        'PNG',
        offsetX,
        marginMm,
        finalWidthMm,
        usableHeightMm,
        undefined,
        'FAST'
      );
    } else {
      const pageHeightPx = Math.floor(
        (usableHeightMm * canvas.width) / usableWidthMm
      );
      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvas.height) {
        if (pageIndex > 0) {
          pdf.addPage('a4', 'portrait');
        }
        const sliceHeightPx = Math.min(
          pageHeightPx,
          canvas.height - renderedPx
        );
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const pageCtx = pageCanvas.getContext('2d');
        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0,
            renderedPx,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );
        }
        const sliceData = pageCanvas.toDataURL('image/png', 1.0);
        const sliceHeightMm = (sliceHeightPx * usableWidthMm) / canvas.width;
        pdf.addImage(
          sliceData,
          'PNG',
          marginMm,
          marginMm,
          usableWidthMm,
          sliceHeightMm,
          undefined,
          'FAST'
        );
        renderedPx += sliceHeightPx;
        pageIndex++;
      }
    }

    return { pdf, fileName };
  } finally {
    if (tempWrapper && tempWrapper.parentNode) {
      tempWrapper.parentNode.removeChild(tempWrapper);
    }
  }
}

// Genera el objeto File PDF renderizando #comprobante-impresion con html2canvas (scale: 2) + jsPDF
export async function buildVoucherPdfFileFromHtml(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string,
  customOptions?: VoucherCustomizationOptions
): Promise<File> {
  const { pdf, fileName } = await generateVoucherPdfInstance(
    voucher,
    formatCurrency,
    customOptions
  );
  const blob = pdf.output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}

// Descarga el archivo PDF (.pdf) idéntico a la vista previa en pantalla (#comprobante-impresion)
export async function downloadVoucherDocument(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string,
  customOptions?: VoucherCustomizationOptions
): Promise<void> {
  try {
    const { pdf, fileName } = await generateVoucherPdfInstance(
      voucher,
      formatCurrency,
      customOptions
    );
    pdf.save(fileName);
  } catch (err) {
    console.error('Fallback PDF download error:', err);
    const pdfFile = buildVoucherPdfFile(voucher, formatCurrency);
    const url = URL.createObjectURL(pdfFile);
    const link = document.createElement('a');
    link.href = url;
    link.download = pdfFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

// Genera el mensaje estructurado de texto con detalle del pedido/presupuesto, número de comprobante y monto total para envío directo por URL wa.me
export function buildWhatsAppMessage(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string,
  customNotes?: string
): string {
  const lines: string[] = [
    `*FERRETERIA DEL PUENTE*`,
    `📄 *${voucher.docType}:* ${voucher.docNumber}`,
    `📅 *Fecha:* ${voucher.dateFormatted}`,
    `👤 *Destinatario:* ${voucher.supplierName}`,
  ];

  if (voucher.dueDateFormatted || voucher.validityText) {
    lines.push(
      `⏳ *Validez / Vto:* ${voucher.dueDateFormatted || voucher.validityText}`
    );
  }

  lines.push(`📌 *Estado:* ${voucher.status}`);
  lines.push('');
  lines.push(`*DETALLE DEL COMPROBANTE:*`);

  let grossOrig = 0;
  let afterItemDisc = 0;
  if (voucher.items && voucher.items.length > 0) {
    voucher.items.forEach((it) => {
      const qty = Number(it.quantity || 1);
      const unitFinal = Number(it.unitPrice ?? it.unitCost ?? 0);
      const origUnit = Number(it.originalUnitPrice ?? unitFinal);
      const lineSub =
        it.subtotal !== undefined ? Number(it.subtotal) : qty * unitFinal;
      grossOrig += qty * Math.max(origUnit, unitFinal);
      afterItemDisc += lineSub;
      const discPct = Number(it.discountPct || 0);
      if (discPct > 0) {
        lines.push(
          `• ${qty}x [${it.sku}] ${it.name} — Orig: ${formatCurrency(origUnit)} | Dto -${discPct}% → *${formatCurrency(lineSub)}*`
        );
      } else {
        lines.push(
          `• ${qty}x [${it.sku}] ${it.name} (${formatCurrency(unitFinal)} c/u) — *${formatCurrency(lineSub)}*`
        );
      }
    });
  } else {
    lines.push(
      `• ${voucher.docType} (${
        voucher.paymentMethod || 'Cuenta Corriente Comercial'
      }) — ${formatCurrency(voucher.totalAmount)}`
    );
  }

  const itemDiscSum = Math.max(0, Number((grossOrig - afterItemDisc).toFixed(2)));
  const globalDisc = Math.max(0, Number(voucher.globalDiscountAmount || 0));
  const origSubtotal =
    itemDiscSum > 0
      ? grossOrig
      : Number(
          voucher.subtotalBeforeGlobalDiscount ??
            afterItemDisc ??
            voucher.totalAmount + globalDisc
        );
  const totalDiscount = Number((itemDiscSum + globalDisc).toFixed(2));

  lines.push('');
  lines.push(`💵 *Subtotal Original:* ${formatCurrency(origSubtotal)}`);
  if (totalDiscount > 0) {
    lines.push(
      `🏷️ *Descuento Aplicado${voucher.globalDiscountPct ? ` (${voucher.globalDiscountPct}%)` : ''}:* -${formatCurrency(totalDiscount)}`
    );
  }
  lines.push(`💰 *TOTAL FINAL A PAGAR: ${formatCurrency(voucher.totalAmount)}*`);

  const finalNotes = (customNotes ?? voucher.notes ?? '').trim();
  if (finalNotes) {
    lines.push(`📝 *Observaciones:* ${finalNotes}`);
  }

  return lines.join('\n');
}

export function buildDirectWhatsAppUrl(
  voucher: VoucherDocumentData,
  formatCurrency: (val: string | number) => string,
  phoneOverride?: string,
  customMessage?: string
): string {
  const rawPhone = phoneOverride || voucher.supplierPhone || '+54 9 11 4500-1200';
  const cleanDigits = rawPhone.replace(/[^0-9]/g, '') || '5491145001200';
  const text =
    customMessage !== undefined && customMessage.trim() !== ''
      ? customMessage.trim()
      : buildWhatsAppMessage(voucher, formatCurrency);
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;
}

interface VoucherModalProps {
  voucher: VoucherDocumentData | null;
  initialTab: 'pdf' | 'whatsapp';
  onClose: () => void;
  formatCurrency: (val: string | number) => string;
}

// ====================================================================
// MÓDULO 2: MODAL CONFIGURADOR DE TICKET / A4 (ESTÁNDAR PREDETERMINADO)
// ====================================================================
export const VoucherActionModal: React.FC<VoucherModalProps> = ({
  voucher,
  onClose,
  formatCurrency,
}) => {
  const [customOpts, setCustomOpts] = useState<VoucherCustomizationOptions>(
    () => loadSavedVoucherCustomization(voucher)
  );
  const [phoneInput, setPhoneInput] = useState<string>(
    voucher?.supplierPhone || voucher?.partyPhone || ''
  );
  const [showSharePanel, setShowSharePanel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (voucher) {
      setCustomOpts(loadSavedVoucherCustomization(voucher));
      setPhoneInput(voucher.supplierPhone || voucher.partyPhone || '');
      setFeedbackMsg(null);
      setShowSharePanel(false);
    }
  }, [voucher]);

  if (!voucher) return null;

  const updateCustomization = (
    partial: Partial<VoucherCustomizationOptions>
  ) => {
    setCustomOpts((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            CUSTOM_PREFS_STORAGE_KEY,
            JSON.stringify({
              documentFormat: next.documentFormat,
              thermalWidth: next.thermalWidth,
              escPosSharp: next.escPosSharp,
              includeLogo: next.includeLogo,
              includeCommercialData: next.includeCommercialData,
              includeFooterTerms: next.includeFooterTerms,
              accentColorKey: next.accentColorKey,
            })
          );
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  // Acción [Descargar]
  const handleDownloadClick = async () => {
    setIsExportingPdf(true);
    try {
      await downloadVoucherDocument(voucher, formatCurrency, customOpts);
      setFeedbackMsg('PDF descargado correctamente.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Cálculo de Subtotal Bruto y Descuentos Totales Aplicados (descuentos por ítem + descuento global)
  const computedTicketBreakdown = useMemo(() => {
    let grossBeforeItemDiscounts = 0;
    let afterItemDiscounts = 0;

    voucher.items.forEach((it) => {
      const qty = Number(it.quantity || 1);
      const unitFinal = Number(it.unitPrice ?? it.unitCost ?? 0);
      const origUnit = Number(it.originalUnitPrice ?? unitFinal);
      const lineSub =
        it.subtotal !== undefined ? Number(it.subtotal) : qty * unitFinal;

      grossBeforeItemDiscounts += qty * Math.max(origUnit, unitFinal);
      afterItemDiscounts += lineSub;
    });

    const itemDiscountsSum = Math.max(
      0,
      Number((grossBeforeItemDiscounts - afterItemDiscounts).toFixed(2))
    );
    const globalDisc = Math.max(0, Number(voucher.globalDiscountAmount || 0));
    const subtotalBeforeDiscounts =
      itemDiscountsSum > 0
        ? grossBeforeItemDiscounts
        : Number(
            voucher.subtotalBeforeGlobalDiscount ??
              afterItemDiscounts ??
              voucher.totalAmount + globalDisc
          );
    const totalDiscountsApplied = Number(
      (itemDiscountsSum + globalDisc).toFixed(2)
    );

    return {
      subtotalBeforeDiscounts,
      itemDiscountsSum,
      globalDisc,
      totalDiscountsApplied,
    };
  }, [voucher]);

  // Fecha y Hora formateadas para el ticket 58mm
  const formattedDateTimeTicket = useMemo(() => {
    const raw = (voucher.dateFormatted || '').trim();
    if (raw.includes(':')) return raw;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${raw || now.toLocaleDateString('es-AR')} ${hh}:${mm}`;
  }, [voucher.dateFormatted]);

  // Acción [Imprimir]: Plantilla rediseñada de Ticket Térmico 58mm en Blanco y Negro puro (Courier New / Monospace)
  const handlePrintClick = () => {
    const ticketNo = formatTicketNumber8Digits(voucher.docNumber);
    const widthMm = customOpts.thermalWidth === '80mm' ? '80mm' : '58mm';
    const bodyWidthMm = customOpts.thermalWidth === '80mm' ? '72mm' : '53mm';

    const itemsRowsHtml = voucher.items
      .map((it) => {
        const qty = Number(it.quantity || 1);
        const unitVal = Number(it.unitPrice ?? it.unitCost ?? 0);
        const hasDisc = Number(it.discountPct || 0) > 0;
        const origPrice = Number(it.originalUnitPrice || unitVal);
        const lineSub =
          it.subtotal !== undefined ? Number(it.subtotal) : qty * unitVal;
        const cleanDesc = (it.name || it.description || 'Artículo').trim();
        return `
        <tr>
          <td style="padding:3px 2px 3px 0;vertical-align:top;font-weight:900;text-align:left;width:12%;color:#000000;">${qty}</td>
          <td style="padding:3px 2px;vertical-align:top;text-align:left;width:42%;word-break:break-word;overflow-wrap:break-word;color:#000000;">
            <div style="font-weight:700;color:#000000;">${cleanDesc}</div>
            ${
              hasDisc
                ? `<div style="font-size:9px;font-weight:700;color:#000000;">Dto. -${it.discountPct}% (s/${formatCurrency(origPrice)})</div>`
                : ''
            }
          </td>
          <td style="padding:3px 2px;vertical-align:top;text-align:right;width:22%;white-space:nowrap;color:#000000;">${formatCurrency(unitVal)}</td>
          <td style="padding:3px 0 3px 2px;vertical-align:top;text-align:right;font-weight:900;width:24%;white-space:nowrap;color:#000000;">${formatCurrency(lineSub)}</td>
        </tr>`;
      })
      .join('');

    const ccFooterPrintHtml =
      typeof voucher.clientAccountTotalBalance === 'number'
        ? `
      <div style="text-align:center;font-weight:900;letter-spacing:0.5px;margin:4px 0 2px 0;color:#000000;">
        ********************************
      </div>
      <div style="padding:4px 2px;background:#ffffff;color:#000000;font-size:10px;">
        <div style="text-align:center;font-weight:900;text-transform:uppercase;margin-bottom:3px;">
          ESTADO DE CUENTA CORRIENTE
        </div>
        ${
          typeof voucher.clientAccountPreviousBalance === 'number'
            ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span>Saldo Anterior:</span>
                <span>${formatCurrency(voucher.clientAccountPreviousBalance)}</span>
              </div>`
            : ''
        }
        <div style="display:flex;justify-content:space-between;font-weight:900;font-size:11px;padding-top:3px;border-top:1px dashed #000000;">
          <span>SALDO TOTAL ACTUALIZADO:</span>
          <span>${formatCurrency(voucher.clientAccountTotalBalance)}</span>
        </div>
      </div>
      <div style="text-align:center;font-weight:900;letter-spacing:0.5px;margin:2px 0 4px 0;color:#000000;">
        ********************************
      </div>`
        : '';

    const htmlTicket = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${ticketNo}</title>
  <style>
    @page { size: ${widthMm} auto; margin: 1.5mm; }
    * {
      box-sizing: border-box;
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      line-height: 1.3;
      width: ${bodyWidthMm};
      max-width: ${bodyWidthMm};
      overflow-x: hidden;
    }
    .ticket-wrap {
      width: 100%;
      padding: 2px 1px;
      background: #ffffff !important;
    }
    .sep {
      text-align: center;
      font-weight: 700;
      overflow: hidden;
      white-space: nowrap;
      margin: 3px 0;
      font-size: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9.5px;
    }
  </style>
</head>
<body>
  <div class="ticket-wrap">
    <!-- ENCABEZADO CENTRADO (Nombre del negocio, CUIT, Dirección) -->
    <div style="text-align:center;">
      <div style="font-size:13px;font-weight:900;letter-spacing:0.3px;">FERRETERIA DEL PUENTE</div>
      <div style="font-size:9.5px;font-weight:700;">CUIT: 30-71458920-9</div>
      <div style="font-size:9.5px;">Av. San Martín 1450, CABA</div>
      <div style="font-size:9px;">Tel: (011) 4582-9100 · IVA Resp. Insc.</div>
    </div>

    <div class="sep">********************************</div>

    <!-- NÚMERO DE TICKET (NNNN-NNNN) Y FECHA/HORA DESTACADOS -->
    <div style="text-align:center;">
      <div style="font-size:10.5px;font-weight:900;text-transform:uppercase;">
        ${(voucher.docType || 'COMPROBANTE INTERNO').toUpperCase()}
      </div>
      <div style="font-size:12px;font-weight:900;margin-top:2px;">
        TICKET N°: ${ticketNo}
      </div>
      <div style="font-size:10px;font-weight:700;margin-top:1px;">
        FECHA/HORA: ${formattedDateTimeTicket}
      </div>
    </div>

    <div class="sep">--------------------------------</div>

    <!-- DATOS DEL CLIENTE -->
    <div style="font-size:9.5px;">
      <div><strong>CLIENTE:</strong> ${voucher.supplierName || voucher.partyName || 'Consumidor Final'}</div>
      <div><strong>CUIT/DNI:</strong> ${voucher.supplierCuit || voucher.partyCuit || '00-00000000-0'}</div>
    </div>

    <div class="sep">--------------------------------</div>

    <!-- DETALLE DE ÍTEMS CON COLUMNAS BIEN ALINEADAS -->
    <table>
      <thead>
        <tr style="border-bottom:1px dashed #000000;">
          <th style="text-align:left;padding:2px 2px 2px 0;font-weight:900;width:12%;">CANT</th>
          <th style="text-align:left;padding:2px;font-weight:900;width:42%;">DESCRIPCION</th>
          <th style="text-align:right;padding:2px;font-weight:900;width:22%;">P.UNIT</th>
          <th style="text-align:right;padding:2px 0 2px 2px;font-weight:900;width:24%;">SUBTOT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="sep">--------------------------------</div>

    <!-- DESGLOSE FINAL CLARO: SUBTOTAL, DESCUENTOS, TOTAL FINAL Y MEDIO DE PAGO -->
    <div style="font-size:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
        <span>SUBTOTAL:</span>
        <span style="font-weight:700;">${formatCurrency(computedTicketBreakdown.subtotalBeforeDiscounts)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
        <span>DESCUENTOS APLICADOS${voucher.globalDiscountPct ? ` (${voucher.globalDiscountPct}%)` : ''}:</span>
        <span style="font-weight:700;">-${formatCurrency(computedTicketBreakdown.totalDiscountsApplied)}</span>
      </div>
    </div>

    <div class="sep">********************************</div>

    <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;font-weight:900;padding:2px 0;">
      <span>TOTAL FINAL A COBRAR:</span>
      <span>${formatCurrency(voucher.totalAmount)}</span>
    </div>

    <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-top:2px;">
      <span>MEDIO DE PAGO:</span>
      <span>${voucher.paymentMethod || 'Efectivo'}</span>
    </div>

    ${ccFooterPrintHtml}

    <div class="sep">--------------------------------</div>

    <div style="text-align:center;font-size:9px;font-weight:700;margin-top:3px;">
      ¡GRACIAS POR SU COMPRA!
    </div>
  </div>
</body>
</html>`;

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlTicket);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }, 150);
        return;
      }
    } catch {
      // fallback
    }
    window.print();
  };

  // Acción [Compartir] -> 1) Guarda PDF y obtiene URL pública, 2) Limpia teléfono al formato internacional numérico, 3) Arma y abre https://wa.me/NUMERO?text=MENSAJE en nueva pestaña
  const handleShareClick = async () => {
    const cleanPhone = cleanPhoneForWhatsApp(phoneInput);
    if (!cleanPhone || cleanPhone.length < 10) {
      setShowSharePanel(true);
      setFeedbackMsg(
        'Ingrese un número de teléfono válido para enviar el comprobante por WhatsApp.'
      );
      return;
    }

    setIsSharingWhatsApp(true);
    setFeedbackMsg(null);
    try {
      const safeDoc = voucher.docNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fname = `Comprobante_${safeDoc}.pdf`;
      let publicPdfUrl = `${window.location.origin}/api/public-pdfs/${encodeURIComponent(
        fname
      )}`;

      try {
        const { pdf } = await generateVoucherPdfInstance(
          voucher,
          formatCurrency,
          { ...customOpts, documentFormat: 'A4' }
        );
        const dataUri = pdf.output('datauristring');
        const upRes = await fetch('/api/public-pdfs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: fname, pdfBase64: dataUri }),
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          if (upData.publicUrl) {
            publicPdfUrl = upData.publicUrl.startsWith('http')
              ? upData.publicUrl
              : `${window.location.origin}${upData.publicUrl}`;
          }
        }
      } catch {
        // Fallback to server-generated PDF
      }

      const recipientName =
        voucher.partyName || voucher.supplierName || 'Cliente';

      const itemsSummaryLines = voucher.items.map((it) => {
        const qty = Number(it.quantity || 1);
        const unitFinal = Number(it.unitPrice ?? it.unitCost ?? 0);
        const origUnit = Number(it.originalUnitPrice ?? unitFinal);
        const lineSub =
          it.subtotal !== undefined ? Number(it.subtotal) : qty * unitFinal;
        const discPct = Number(it.discountPct || 0);
        return discPct > 0
          ? `• ${qty}x ${it.name} (Orig: ${formatCurrency(origUnit)} | Dto. -${discPct}%): *${formatCurrency(lineSub)}*`
          : `• ${qty}x ${it.name} (${formatCurrency(unitFinal)} c/u): *${formatCurrency(lineSub)}*`;
      });

      // Abrir enlace público https://wa.me/NUMERO?text=MENSAJE en una nueva pestaña del navegador
      buildAndOpenWhatsAppVoucherLink({
        phone: cleanPhone,
        clientName: recipientName,
        pdfUrl: publicPdfUrl,
        docNumber: voucher.docNumber,
        docType: voucher.docType,
        subtotalOriginalFormatted: formatCurrency(
          computedTicketBreakdown.subtotalBeforeDiscounts
        ),
        discountAppliedFormatted:
          computedTicketBreakdown.totalDiscountsApplied > 0
            ? formatCurrency(computedTicketBreakdown.totalDiscountsApplied)
            : undefined,
        discountLabel: voucher.globalDiscountPct
          ? `${voucher.globalDiscountPct}%`
          : undefined,
        totalFormatted: formatCurrency(voucher.totalAmount),
        itemsSummaryLines,
        openInNewTab: true,
      });

      // Registrar también en segundo plano en el endpoint del servidor
      try {
        await fetch('/api/whatsapp/send-voucher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: recipientName,
            phone: cleanPhone,
            docNumber: voucher.docNumber,
            pdfUrl: publicPdfUrl,
            filename: fname,
          }),
        });
      } catch {
        // ignore background log error
      }

      setFeedbackMsg(
        `Enlace wa.me abierto en nueva pestaña con el PDF público para +${cleanPhone}.`
      );
    } catch {
      setFeedbackMsg('Error al compartir el comprobante.');
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const isTicket = customOpts.documentFormat === 'Ticket';
  const formattedTicket8Digits = formatTicketNumber8Digits(voucher.docNumber);
  const ticketWidthClass =
    customOpts.thermalWidth === '58mm'
      ? 'w-[280px] max-w-full mx-auto'
      : 'w-[360px] max-w-full mx-auto';

  const effectiveNotes = (
    customOpts.additionalNotes ||
    voucher.notes ||
    'Gracias por su compra en FERRETERIA DEL PUENTE.'
  ).trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-6">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF6600] flex items-center justify-center text-white font-black text-xs">
              FP
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                Configurador de Comprobante · Ticket N° {formattedTicket8Digits}
              </h3>
              <p className="text-xs text-slate-400">
                FERRETERIA DEL PUENTE — {voucher.docType} (Térmica 58mm Blanco y Negro)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Configuración del Ticket / A4 */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Opciones de Formato: [Ticket] / [A4] */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                Formato
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['Ticket', 'A4'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => updateCustomization({ documentFormat: fmt })}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                      customOpts.documentFormat === fmt
                        ? 'bg-[#FF6600] border-[#FF6600] text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Opciones de Impresora Térmica: [58mm] / [80mm] */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                Impresora Térmica
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['58mm', '80mm'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateCustomization({ thermalWidth: w })}
                    className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer ${
                      customOpts.thermalWidth === w
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Checkboxes: [Impresión nítida ESC/POS], [Logo], [Nombre] */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                Opciones Visuales
              </span>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customOpts.escPosSharp}
                    onChange={(e) =>
                      updateCustomization({ escPosSharp: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                  />
                  <span>Impresión nítida ESC/POS (B&amp;N)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customOpts.includeLogo}
                    onChange={(e) =>
                      updateCustomization({ includeLogo: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                  />
                  <span>Logo</span>
                </label>

                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customOpts.includeCommercialData}
                    onChange={(e) =>
                      updateCustomization({
                        includeCommercialData: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                  />
                  <span>Nombre</span>
                </label>
              </div>
            </div>
          </div>

          {/* Campo rápido de teléfono cuando se pulsa Compartir */}
          {showSharePanel && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700">
                Teléfono WhatsApp (E.164):
              </span>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="Ej: 5491122334455"
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="button"
                disabled={isSharingWhatsApp}
                onClick={handleShareClick}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                {isSharingWhatsApp ? 'Enviando...' : 'Enviar ahora'}
              </button>
            </div>
          )}

          {feedbackMsg && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
              {feedbackMsg}
            </div>
          )}
        </div>

        {/* Vista Previa: En modo Ticket 58mm usa la plantilla rediseñada 100% Blanco y Negro monoespaciada sin sombras ni colores */}
        <div className="p-6 max-h-[65vh] overflow-y-auto bg-slate-100/70">
          {isTicket ? (
            <div
              id="comprobante-impresion"
              data-doc-number={voucher.docNumber}
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: "'Courier New', Courier, monospace",
              }}
              className={`${ticketWidthClass} p-3 bg-white text-black border border-black rounded-none shadow-none space-y-1 text-[11px] leading-snug overflow-hidden`}
            >
              {/* Encabezado Centrado (Nombre del negocio, CUIT, Dirección) */}
              <div className="text-center space-y-0.5">
                {customOpts.includeCommercialData && (
                  <>
                    <div className="text-sm font-black tracking-tight text-black">
                      FERRETERIA DEL PUENTE
                    </div>
                    <div className="text-[10px] font-bold text-black">
                      CUIT: 30-71458920-9
                    </div>
                    <div className="text-[10px] text-black">
                      Av. San Martín 1450, CABA
                    </div>
                    <div className="text-[10px] text-black">
                      Tel: (011) 4582-9100 · IVA Resp. Insc.
                    </div>
                  </>
                )}
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                ********************************
              </div>

              {/* Número de Ticket (formato NNNN-NNNN) y Fecha/Hora destacados */}
              <div className="text-center space-y-0.5">
                <div className="text-[11px] font-black uppercase text-black">
                  {voucher.docType || 'COMPROBANTE INTERNO'}
                </div>
                <div className="text-xs font-black text-black">
                  TICKET N°: {formattedTicket8Digits}
                </div>
                <div className="text-[10px] font-bold text-black">
                  FECHA/HORA: {formattedDateTimeTicket}
                </div>
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                --------------------------------
              </div>

              {/* Datos del Cliente */}
              <div className="text-[10px] text-black space-y-0.5">
                <div className="break-words">
                  <span className="font-black">CLIENTE:</span>{' '}
                  {voucher.supplierName ||
                    voucher.partyName ||
                    'Consumidor Final'}
                </div>
                <div>
                  <span className="font-black">CUIT/DNI:</span>{' '}
                  {voucher.supplierCuit ||
                    voucher.partyCuit ||
                    '00-00000000-0'}
                </div>
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                --------------------------------
              </div>

              {/* Detalle de ítems con 4 columnas bien alineadas (Cantidad, Descripción, Precio Unitario, Subtotal) */}
              <table className="w-full table-fixed border-collapse text-[10px] text-black">
                <thead>
                  <tr className="border-b border-dashed border-black font-black">
                    <th className="py-1 pr-1 text-left w-[13%]">CANT</th>
                    <th className="py-1 px-1 text-left w-[41%]">DESCRIP.</th>
                    <th className="py-1 px-1 text-right w-[22%]">P.UNIT</th>
                    <th className="py-1 pl-1 text-right w-[24%]">SUBTOT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-black">
                  {voucher.items.map((it, idx) => {
                    const qty = Number(it.quantity || 1);
                    const unitVal = Number(it.unitPrice ?? it.unitCost ?? 0);
                    const hasItemDiscount = Number(it.discountPct || 0) > 0;
                    const origUnit = Number(it.originalUnitPrice || unitVal);
                    const lineSubtotal =
                      it.subtotal !== undefined
                        ? Number(it.subtotal)
                        : qty * unitVal;
                    return (
                      <tr key={idx} className="align-top text-black">
                        <td className="py-1 pr-1 font-black text-left">
                          {qty}
                        </td>
                        <td className="py-1 px-1 text-left break-words">
                          <div className="font-bold leading-tight">
                            {it.name || it.description}
                          </div>
                          {hasItemDiscount && (
                            <div className="text-[9px] font-bold">
                              Dto. -{it.discountPct}% (s/
                              {formatCurrency(origUnit)})
                            </div>
                          )}
                        </td>
                        <td className="py-1 px-1 text-right whitespace-nowrap">
                          {formatCurrency(unitVal)}
                        </td>
                        <td className="py-1 pl-1 text-right font-black whitespace-nowrap">
                          {formatCurrency(lineSubtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                --------------------------------
              </div>

              {/* Desglose final claro: Subtotal, Descuentos aplicados, Total Final a Cobrar y Medio de Pago */}
              <div className="text-[10px] text-black space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="font-bold">
                    {formatCurrency(
                      computedTicketBreakdown.subtotalBeforeDiscounts
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>
                    DESCUENTOS APLICADOS
                    {voucher.globalDiscountPct
                      ? ` (${voucher.globalDiscountPct}%)`
                      : ''}
                    :
                  </span>
                  <span className="font-bold">
                    -{formatCurrency(computedTicketBreakdown.totalDiscountsApplied)}
                  </span>
                </div>
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                ********************************
              </div>

              <div className="flex items-baseline justify-between py-0.5 text-xs font-black text-black">
                <span>TOTAL FINAL A COBRAR:</span>
                <span className="text-sm">
                  {formatCurrency(voucher.totalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold text-black">
                <span>MEDIO DE PAGO:</span>
                <span>{voucher.paymentMethod || 'Efectivo'}</span>
              </div>

              {/* Si el pago es en Cuenta Corriente, incluir al pie de forma bien visible el Saldo Total Actualizado */}
              {typeof voucher.clientAccountTotalBalance === 'number' && (
                <>
                  <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                    ********************************
                  </div>
                  <div className="py-1 text-[10px] text-black space-y-0.5">
                    <div className="text-center font-black uppercase">
                      ESTADO DE CUENTA CORRIENTE
                    </div>
                    {typeof voucher.clientAccountPreviousBalance ===
                      'number' && (
                      <div className="flex items-center justify-between">
                        <span>Saldo Anterior:</span>
                        <span className="font-bold">
                          {formatCurrency(voucher.clientAccountPreviousBalance)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-dashed border-black text-[11px] font-black">
                      <span>SALDO TOTAL ACTUALIZADO:</span>
                      <span>
                        {formatCurrency(voucher.clientAccountTotalBalance)}
                      </span>
                    </div>
                  </div>
                  <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                    ********************************
                  </div>
                </>
              )}

              <div className="text-center font-bold tracking-widest text-[10px] text-black select-none overflow-hidden whitespace-nowrap">
                --------------------------------
              </div>

              <div className="text-center text-[10px] font-bold text-black pt-0.5">
                ¡GRACIAS POR SU COMPRA!
              </div>
            </div>
          ) : (
            <div
              id="comprobante-impresion"
              data-doc-number={voucher.docNumber}
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                borderColor: '#000000',
                borderTopWidth: '6px',
                borderTopStyle: 'solid',
                borderTopColor: customOpts.escPosSharp ? '#000000' : '#FF6600',
              }}
              className="border bg-white p-6 space-y-4 rounded-xl shadow-xs"
            >
              {/* Encabezado A4 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  {customOpts.includeLogo && (
                    <div
                      style={{
                        backgroundColor: customOpts.escPosSharp
                          ? '#000000'
                          : '#FF6600',
                        color: '#ffffff',
                      }}
                      className="w-11 h-11 text-base rounded-xl flex items-center justify-center font-black shrink-0"
                    >
                      FP
                    </div>
                  )}
                  {customOpts.includeCommercialData && (
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">
                        FERRETERIA DEL PUENTE
                      </div>
                      <p className="text-xs text-slate-600">
                        Av. San Martín 1450, CABA · Tel: 4582-9100
                      </p>
                    </div>
                  )}
                </div>

                <div className="sm:text-right">
                  <span
                    style={{
                      backgroundColor: customOpts.escPosSharp
                        ? '#000000'
                        : '#FF6600',
                      color: '#ffffff',
                    }}
                    className="inline-block px-2.5 py-0.5 text-[10px] font-black uppercase"
                  >
                    {voucher.docType}
                  </span>
                  <div className="font-mono text-sm font-black text-black mt-1">
                    TICKET N° {formattedTicket8Digits}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {customOpts.includeCommercialData && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-[#FF6600] border-b border-slate-200 pb-1 mb-1">
                      Emisor
                    </div>
                    <p className="font-bold text-slate-900">
                      FERRETERIA DEL PUENTE S.R.L.
                    </p>
                    <p className="text-slate-700">
                      Dirección: Av. San Martín 1450, CABA
                    </p>
                    <p className="text-slate-700">
                      Tel: +54 11 4582-9100 · CUIT: 30-71458920-9
                    </p>
                    <p className="text-slate-700">
                      Condición IVA: Responsable Inscripto
                    </p>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-[#FF6600] border-b border-slate-200 pb-1 mb-1">
                    Comprobante
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">N° Ticket (8 díg.):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formattedTicket8Digits}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha de Emisión:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {voucher.dateFormatted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estado:</span>
                    <span className="font-bold text-slate-900">
                      {voucher.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200 border-l-4 border-l-[#FF6600] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                    Cliente Receptor
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {voucher.supplierName}
                  </span>
                  {voucher.supplierCuit && (
                    <span className="font-mono text-slate-600 ml-2">
                      · CUIT/DNI: {voucher.supplierCuit}
                    </span>
                  )}
                </div>
                <div className="sm:text-right text-slate-600">
                  {voucher.supplierPhone && (
                    <div>Teléfono: {voucher.supplierPhone}</div>
                  )}
                  {voucher.paymentMethod && (
                    <div>Medio de Pago: {voucher.paymentMethod}</div>
                  )}
                </div>
              </div>

              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] uppercase">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descripción</th>
                      <th className="py-2.5 px-3 text-right">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {voucher.items.map((it, idx) => {
                      const hasItemDiscount = Number(it.discountPct || 0) > 0;
                      const origUnit = Number(
                        it.originalUnitPrice || it.unitCost || 0
                      );
                      const lineSubtotal =
                        it.subtotal !== undefined
                          ? Number(it.subtotal)
                          : it.quantity * it.unitCost;
                      return (
                        <tr
                          key={idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {it.sku}
                          </td>
                          <td className="py-2 px-3 text-slate-800">
                            <div>{it.name}</div>
                            {hasItemDiscount && (
                              <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                Dto. -{it.discountPct}% (Base:{' '}
                                {formatCurrency(origUnit)})
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {it.quantity}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(it.unitCost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(lineSubtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-slate-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">
                    Subtotal Original (s/Dto.):
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(
                      computedTicketBreakdown.subtotalBeforeDiscounts
                    )}
                  </span>
                </div>
                {computedTicketBreakdown.itemDiscountsSum > 0 && (
                  <div className="flex items-center justify-between text-emerald-800 font-bold">
                    <span>Descuentos Individuales por Ítem:</span>
                    <span className="font-mono">
                      - {formatCurrency(computedTicketBreakdown.itemDiscountsSum)}
                    </span>
                  </div>
                )}
                {computedTicketBreakdown.globalDisc > 0 && (
                  <div className="flex items-center justify-between text-emerald-800 font-bold">
                    <span>
                      Descuento Global
                      {voucher.globalDiscountPct
                        ? ` (${voucher.globalDiscountPct}%)`
                        : ''}
                      :
                    </span>
                    <span className="font-mono">
                      - {formatCurrency(computedTicketBreakdown.globalDisc)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200 font-black text-emerald-900">
                  <span>Total Bonificación / Descuento Aplicado:</span>
                  <span className="font-mono">
                    - {formatCurrency(computedTicketBreakdown.totalDiscountsApplied)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200 border-l-4 border-l-[#FF6600] text-xs text-slate-800">
                <strong className="uppercase text-[10px] block">
                  Observaciones:
                </strong>
                <span>{effectiveNotes}</span>
              </div>

              <div className="flex justify-end pt-1">
                <div className="w-full sm:w-80 p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between border-b-4 border-b-[#FF6600]">
                  <span className="text-xs font-bold uppercase text-slate-300">
                    TOTAL FINAL A PAGAR:
                  </span>
                  <span className="text-lg font-mono font-extrabold text-white">
                    {formatCurrency(voucher.totalAmount)}
                  </span>
                </div>
              </div>

              {typeof voucher.clientAccountTotalBalance === 'number' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-xs text-amber-950 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider">
                    Estado de Cuenta Corriente
                  </div>
                  {typeof voucher.clientAccountPreviousBalance === 'number' && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span>Saldo Anterior Cta. Cte.:</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(voucher.clientAccountPreviousBalance)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-black text-xs font-black">
                    <span>SALDO TOTAL ACTUALIZADO:</span>
                    <span className="font-mono">
                      {formatCurrency(voucher.clientAccountTotalBalance)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botonera Inferior Estándar: [Cerrar], [Compartir], [Imprimir], [Descargar] */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSharingWhatsApp}
              onClick={() => {
                if (!phoneInput.trim()) {
                  setShowSharePanel(true);
                } else {
                  handleShareClick();
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{isSharingWhatsApp ? 'Compartiendo...' : 'Compartir'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Descargando...' : 'Descargar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OrdersModuleProps {
  mode: 'orders' | 'calendar' | 'history';
  suppliers: SupplierItem[];
  orders: PurchaseOrderRecord[];
  installments: SupplierDueInstallment[];
  returnsHistory?: UnifiedReturnRecord[];
  paymentHistory?: UnifiedPaymentRecord[];
  treasuryAccounts?: TreasuryAccount[];
  onUpdateTreasuryAccounts?: React.Dispatch<
    React.SetStateAction<TreasuryAccount[]>
  >;
  cashflowTransactions?: CashflowEntry[];
  onAddCashflowEntry?: (entry: CashflowEntry) => void;
  onUpdateOrderStatus: (
    orderId: string,
    newStatus: PurchaseOrderRecord['orderStatus']
  ) => void;
  onRegisterOrderPayment: (params: {
    orderId: string;
    supplierId: number;
    amount: number;
    paymentMethod: string;
    newPaymentStatus: 'Pendiente' | 'Parcial' | 'Saldado';
    note: string;
  }) => Promise<void>;
  onUpdateInstallmentStatusOrPayment: (params: {
    installmentId: string;
    supplierId: number;
    newStatus: 'Pendiente' | 'Pagado' | 'Parcial' | 'Vencido' | 'Saldado';
    paidAmountDelta: number;
    paymentMethod: string;
    treasuryAccountId?: string;
    accountId?: string;
    accountName?: string;
    expenseCategory?: ExpenseCategoryType;
    concept?: string;
    note: string;
  }) => Promise<void>;
  onAddInstallment: (newInst: Omit<SupplierDueInstallment, 'id'>) => void;
  onGoToCreateOrder: () => void;
  formatCurrency: (val: string | number) => string;
}

type OrderSortKey =
  | 'orderNumber'
  | 'supplierName'
  | 'createdAt'
  | 'paymentDueDate'
  | 'totalAmount'
  | 'orderStatus'
  | 'paymentStatus';

type HistorySortKey =
  | 'isoDate'
  | 'operationType'
  | 'supplierName'
  | 'totalAmount'
  | 'status';

interface UnifiedOperationItem {
  id: string;
  docNumber: string;
  isoDate: string;
  formattedDate: string;
  operationType: 'Pedido a Proveedor' | 'Devolución' | 'Pago Registrado';
  supplierName: string;
  detailSummary: string;
  totalAmount: number;
  status: string;
  voucher: VoucherDocumentData;
}

export const OrdersModule: React.FC<OrdersModuleProps> = ({
  mode,
  suppliers,
  orders,
  installments,
  returnsHistory = [],
  paymentHistory = [],
  onUpdateOrderStatus,
  onRegisterOrderPayment,
  onUpdateInstallmentStatusOrPayment,
  onAddInstallment,
  onGoToCreateOrder,
  formatCurrency,
}) => {
  // Modal de Comprobante PDF / WhatsApp
  const [activeVoucherModal, setActiveVoucherModal] = useState<{
    voucher: VoucherDocumentData;
    tab: 'pdf' | 'whatsapp';
  } | null>(null);

  const buildSupplierMeta = (supplierName: string, supplierId?: number) => {
    const found = suppliers.find(
      (s) =>
        (supplierId && s.id === supplierId) ||
        s.name.toLowerCase() === supplierName.toLowerCase()
    );
    return {
      cuit: found?.cuit || '30-71500912-3',
      phone: found?.contactPhone || '+54 9 11 4500-1200',
      email: found?.email || 'ventas@proveedorferretero.com.ar',
    };
  };

  const buildOrderVoucher = (ord: PurchaseOrderRecord): VoucherDocumentData => {
    const meta = buildSupplierMeta(ord.supplierName, ord.supplierId);
    return {
      docType: 'Pedido a Proveedor',
      docNumber: ord.orderNumber,
      dateFormatted: formatIsoToAr(ord.createdAt),
      supplierName: ord.supplierName,
      supplierCuit: meta.cuit,
      supplierPhone: meta.phone,
      supplierEmail: meta.email,
      status: ord.orderStatus,
      secondaryStatus: `Pago: ${ord.paymentStatus}`,
      totalAmount: ord.totalAmount,
      paidAmount: ord.paidAmount,
      notes: ord.notes,
      items: ord.items,
    };
  };

  // =========================================================================
  // ESTADO DE GESTIÓN GENERAL DE PEDIDOS (TODOS LOS PROVEEDORES)
  // =========================================================================
  const [orderSearch, setOrderSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [dateRangePreset, setDateRangePreset] = useState<
    'todos' | 'hoy' | 'semana' | 'mes' | 'personalizado'
  >('todos');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [dueDateFilter, setDueDateFilter] = useState('');

  const [orderSort, setOrderSort] = useState<{
    key: OrderSortKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'paymentDueDate',
    direction: 'asc',
  });

  // Modal para Acreditar / Registrar Pago directo sobre un Pedido
  const [activeOrderForPayment, setActiveOrderForPayment] =
    useState<PurchaseOrderRecord | null>(null);
  const [orderPayAmount, setOrderPayAmount] = useState('');
  const [orderPayMethod, setOrderPayMethod] = useState(
    'Transferencia Bancaria'
  );
  const [orderPayStatusChoice, setOrderPayStatusChoice] = useState<
    'Parcial' | 'Saldado'
  >('Saldado');
  const [orderPayNote, setOrderPayNote] = useState('');
  const [isSavingOrderPay, setIsSavingOrderPay] = useState(false);

  const handleSortOrderCol = (key: OrderSortKey) => {
    setOrderSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredAndSortedOrders = useMemo(() => {
    const todayIso = getTodayIso();
    const todayDate = new Date(todayIso + 'T00:00:00');

    const list = orders.filter((ord) => {
      if (supplierFilter !== 'Todos' && ord.supplierName !== supplierFilter) {
        return false;
      }
      if (statusFilter !== 'Todos' && ord.orderStatus !== statusFilter) {
        return false;
      }
      if (dueDateFilter && ord.paymentDueDate !== dueDateFilter) {
        return false;
      }

      if (dateRangePreset === 'hoy') {
        if (ord.createdAt !== todayIso) return false;
      } else if (dateRangePreset === 'semana') {
        const ordDate = new Date(ord.createdAt + 'T00:00:00');
        const diffDays =
          Math.abs(todayDate.getTime() - ordDate.getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (dateRangePreset === 'mes') {
        if (ord.createdAt.slice(0, 7) !== todayIso.slice(0, 7)) return false;
      } else if (dateRangePreset === 'personalizado') {
        if (customFromDate && ord.createdAt < customFromDate) return false;
        if (customToDate && ord.createdAt > customToDate) return false;
      }

      if (orderSearch.trim() !== '') {
        const q = orderSearch.toLowerCase();
        const matchesItems = ord.items.some(
          (i) =>
            i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
        );
        return (
          ord.orderNumber.toLowerCase().includes(q) ||
          ord.supplierName.toLowerCase().includes(q) ||
          (ord.notes || '').toLowerCase().includes(q) ||
          matchesItems
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const dir = orderSort.direction === 'asc' ? 1 : -1;
      const k = orderSort.key;
      if (k === 'totalAmount') {
        return (a.totalAmount - b.totalAmount) * dir;
      }
      return (
        String(a[k] || '').localeCompare(String(b[k] || ''), 'es', {
          numeric: true,
        }) * dir
      );
    });
  }, [
    orders,
    supplierFilter,
    statusFilter,
    dueDateFilter,
    dateRangePreset,
    customFromDate,
    customToDate,
    orderSearch,
    orderSort,
  ]);

  const openOrderPaymentModal = (ord: PurchaseOrderRecord) => {
    const remaining = Math.max(0, ord.totalAmount - ord.paidAmount);
    setActiveOrderForPayment(ord);
    setOrderPayAmount(remaining > 0 ? remaining.toFixed(2) : '0.00');
    setOrderPayStatusChoice('Saldado');
    setOrderPayNote(`Pago sobre pedido ${ord.orderNumber}`);
  };

  const handleConfirmOrderPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrderForPayment) return;
    const amt = Math.max(0, parseFloat(orderPayAmount) || 0);
    const remaining = Math.max(
      0,
      activeOrderForPayment.totalAmount - activeOrderForPayment.paidAmount
    );
    const computedStatus: 'Pendiente' | 'Parcial' | 'Saldado' =
      orderPayStatusChoice === 'Saldado' || amt >= remaining - 0.01
        ? 'Saldado'
        : amt > 0
        ? 'Parcial'
        : 'Pendiente';

    setIsSavingOrderPay(true);
    try {
      await onRegisterOrderPayment({
        orderId: activeOrderForPayment.id,
        supplierId: activeOrderForPayment.supplierId,
        amount: amt,
        paymentMethod: orderPayMethod,
        newPaymentStatus: computedStatus,
        note: orderPayNote,
      });
      setActiveOrderForPayment(null);
    } finally {
      setIsSavingOrderPay(false);
    }
  };

  // =========================================================================
  // ESTADO DEL HISTORIAL UNIFICADO DE OPERACIONES (PEDIDOS, DEVOLUCIONES Y PAGOS)
  // =========================================================================
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<
    'Todos' | 'Pedido a Proveedor' | 'Devolución' | 'Pago Registrado'
  >('Todos');
  const [historySupplierFilter, setHistorySupplierFilter] = useState('Todos');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('Todos');
  const [historyDatePreset, setHistoryDatePreset] = useState<
    'todos' | 'hoy' | 'semana' | 'mes' | 'personalizado'
  >('todos');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');

  // Ordenamiento interactivo de columnas del Historial ("Fecha", "Proveedor", "Tipo", "Monto", "Estado")
  const [historySort, setHistorySort] = useState<{
    key: HistorySortKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'isoDate',
    direction: 'desc',
  });

  const handleSortHistoryCol = (key: HistorySortKey) => {
    setHistorySort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const unifiedOperations = useMemo<UnifiedOperationItem[]>(() => {
    const list: UnifiedOperationItem[] = [];

    // 1. Pedidos a Proveedores
    orders.forEach((ord) => {
      const iso = normalizeToIsoDate(ord.createdAt);
      const itemSummary =
        ord.items
          .map((i) => `${i.quantity}x ${i.name}`)
          .slice(0, 2)
          .join(' · ') +
        (ord.items.length > 2 ? ` (+${ord.items.length - 2} más)` : '');

      list.push({
        id: `HIST-ORD-${ord.id}`,
        docNumber: ord.orderNumber,
        isoDate: iso,
        formattedDate: formatIsoToAr(iso),
        operationType: 'Pedido a Proveedor',
        supplierName: ord.supplierName,
        detailSummary: itemSummary || `${ord.itemsCount} artículos en orden`,
        totalAmount: ord.totalAmount,
        status: ord.orderStatus,
        voucher: buildOrderVoucher(ord),
      });
    });

    // 2. Devoluciones a Proveedores
    returnsHistory.forEach((ret) => {
      const iso = ret.isoDate || normalizeToIsoDate(ret.date);
      const meta = buildSupplierMeta(ret.supplierName, ret.supplierId);
      const itemSummary = ret.items
        .map((i) => `${i.quantity}x [${i.sku}] ${i.name}`)
        .join(' · ');

      list.push({
        id: `HIST-RET-${ret.id}`,
        docNumber: ret.docNumber,
        isoDate: iso,
        formattedDate: formatIsoToAr(iso),
        operationType: 'Devolución',
        supplierName: ret.supplierName,
        detailSummary: `${ret.reason} — ${itemSummary}`,
        totalAmount: ret.totalCredit,
        status: ret.status || 'Acreditado',
        voucher: {
          docType: 'Devolución a Proveedor',
          docNumber: ret.docNumber,
          dateFormatted: formatIsoToAr(iso),
          supplierName: ret.supplierName,
          supplierCuit: meta.cuit,
          supplierPhone: meta.phone,
          supplierEmail: meta.email,
          status: ret.status || 'Acreditado',
          totalAmount: ret.totalCredit,
          reason: ret.reason,
          notes: ret.notes,
          items: ret.items,
        },
      });
    });

    // 3. Pagos Registrados
    paymentHistory.forEach((pay) => {
      const iso = pay.isoDate || normalizeToIsoDate(pay.date);
      const meta = buildSupplierMeta(pay.supplierName, pay.supplierId);

      list.push({
        id: `HIST-PAY-${pay.id}`,
        docNumber: pay.receiptNumber,
        isoDate: iso,
        formattedDate: formatIsoToAr(iso),
        operationType: 'Pago Registrado',
        supplierName: pay.supplierName,
        detailSummary: `${pay.paymentMethod} · ${pay.note}`,
        totalAmount: pay.amount,
        status: pay.status || 'Acreditado',
        voucher: {
          docType: 'Orden de Pago',
          docNumber: pay.receiptNumber,
          dateFormatted: formatIsoToAr(iso),
          supplierName: pay.supplierName,
          supplierCuit: meta.cuit,
          supplierPhone: meta.phone,
          supplierEmail: meta.email,
          status: pay.status || 'Acreditado',
          totalAmount: pay.amount,
          paymentMethod: pay.paymentMethod,
          notes: pay.note,
          items: [],
        },
      });
    });

    return list;
  }, [orders, returnsHistory, paymentHistory, suppliers]);

  const filteredAndSortedHistory = useMemo(() => {
    const todayIso = getTodayIso();
    const todayDate = new Date(todayIso + 'T00:00:00');

    const filtered = unifiedOperations.filter((op) => {
      if (
        historyTypeFilter !== 'Todos' &&
        op.operationType !== historyTypeFilter
      ) {
        return false;
      }
      if (
        historySupplierFilter !== 'Todos' &&
        op.supplierName !== historySupplierFilter
      ) {
        return false;
      }
      if (
        historyStatusFilter !== 'Todos' &&
        op.status.toLowerCase() !== historyStatusFilter.toLowerCase()
      ) {
        return false;
      }

      if (historyDatePreset === 'hoy') {
        if (op.isoDate !== todayIso) return false;
      } else if (historyDatePreset === 'semana') {
        const opDate = new Date(op.isoDate + 'T00:00:00');
        const diffDays =
          Math.abs(todayDate.getTime() - opDate.getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (historyDatePreset === 'mes') {
        if (op.isoDate.slice(0, 7) !== todayIso.slice(0, 7)) return false;
      } else if (historyDatePreset === 'personalizado') {
        if (historyFromDate && op.isoDate < historyFromDate) return false;
        if (historyToDate && op.isoDate > historyToDate) return false;
      }

      if (historySearch.trim() !== '') {
        const q = historySearch.toLowerCase();
        return (
          op.docNumber.toLowerCase().includes(q) ||
          op.supplierName.toLowerCase().includes(q) ||
          op.detailSummary.toLowerCase().includes(q) ||
          op.operationType.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const dir = historySort.direction === 'asc' ? 1 : -1;
      if (historySort.key === 'totalAmount') {
        return (a.totalAmount - b.totalAmount) * dir;
      }
      const valA = String(a[historySort.key] || '');
      const valB = String(b[historySort.key] || '');
      return (
        valA.localeCompare(valB, 'es', {
          numeric: true,
          sensitivity: 'base',
        }) * dir
      );
    });
  }, [
    unifiedOperations,
    historyTypeFilter,
    historySupplierFilter,
    historyStatusFilter,
    historyDatePreset,
    historyFromDate,
    historyToDate,
    historySearch,
    historySort,
  ]);

  // =========================================================================
  // ESTADO DEL CALENDARIO VISUAL DE VENCIMIENTOS, GASTOS GENERALES Y EGRESOS OPERATIVOS
  // =========================================================================
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>(
    'month'
  );
  const [calendarCursorDate, setCalendarCursorDate] = useState<Date>(
    () => new Date()
  );
  const [calendarSupplierFilter, setCalendarSupplierFilter] =
    useState<string>('Todos');
  const [calendarCategoryFilter, setCalendarCategoryFilter] =
    useState<string>('Todas');
  const [alertPeriodView, setAlertPeriodView] = useState<'semana' | 'mes'>(
    'semana'
  );
  const [showCashflowReportPanel, setShowCashflowReportPanel] =
    useState<boolean>(true);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>(
    () => loadTreasuryAccounts()
  );
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntry[]>(() =>
    loadCashflowEntries()
  );
  const [expenseBannerFeedback, setExpenseBannerFeedback] = useState<
    string | null
  >(null);

  useEffect(() => {
    const syncTreasury = () => {
      setTreasuryAccounts(loadTreasuryAccounts());
      setCashflowEntries(loadCashflowEntries());
    };
    window.addEventListener('ferreteria-cashflow-updated', syncTreasury);
    return () =>
      window.removeEventListener('ferreteria-cashflow-updated', syncTreasury);
  }, []);

  const [selectedInstallment, setSelectedInstallment] =
    useState<SupplierDueInstallment | null>(null);
  const [fullScreenAttachment, setFullScreenAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'pdf';
  } | null>(null);
  const [instStatusChoice, setInstStatusChoice] = useState<
    'Pendiente' | 'Pagado' | 'Parcial' | 'Vencido'
  >('Pagado');
  const [instPayAmount, setInstPayAmount] = useState<string>('');
  const [instPayMethod, setInstPayMethod] = useState<string>(
    'Transferencia Bancaria'
  );
  const [instTreasuryAccountId, setInstTreasuryAccountId] =
    useState<string>('BANCO-NACION-01');
  const [instPayNote, setInstPayNote] = useState<string>('');
  const [isSavingInst, setIsSavingInst] = useState(false);

  const [newInstModalOpen, setNewInstModalOpen] = useState(false);
  const [beneficiaryMode, setBeneficiaryMode] = useState<'selector' | 'libre'>(
    'selector'
  );
  const [newInstForm, setNewInstForm] = useState<{
    expenseCategory: ExpenseCategoryType;
    concept: string;
    beneficiaryName: string;
    supplierId: string;
    docRef: string;
    issueDate: string;
    dueDate: string;
    totalAmount: string;
    status: 'Pendiente' | 'Pagado' | 'Parcial' | 'Vencido';
    paidAmount: string;
    treasuryAccountId: string;
    isRecurring: boolean;
    recurrenceFrequency: ExpenseRecurrenceFrequency;
    notes: string;
    attachmentUrl: string;
    attachmentName: string;
    attachmentType: 'image' | 'pdf';
  }>({
    expenseCategory: 'Compra a Proveedor / Mercadería',
    concept: '',
    beneficiaryName: suppliers[0]?.name || '',
    supplierId: suppliers[0]?.id ? String(suppliers[0].id) : '',
    docRef: 'FC-A 0002-0009140',
    issueDate: getTodayIso(),
    dueDate: getTodayIso(),
    totalAmount: '',
    status: 'Pendiente',
    paidAmount: '',
    treasuryAccountId: 'CAJA-CHICA-01',
    isRecurring: false,
    recurrenceFrequency: 'Mensual',
    notes: '',
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: 'image',
  });

  const openNewInstallmentModalForDate = (
    isoDate: string,
    supplierId?: number
  ) => {
    const sup = supplierId
      ? suppliers.find((s) => s.id === supplierId)
      : suppliers[0];
    const daysDiff = getDaysDiffFromToday(isoDate);
    setBeneficiaryMode('selector');
    setNewInstForm({
      expenseCategory: 'Compra a Proveedor / Mercadería',
      concept: '',
      beneficiaryName: sup?.name || '',
      supplierId: sup?.id ? String(sup.id) : '',
      docRef: `COMP-0001-${Math.floor(4910 + Math.random() * 800)}`,
      issueDate: isoDate <= getTodayIso() ? isoDate : getTodayIso(),
      dueDate: isoDate,
      totalAmount: '',
      status: daysDiff < 0 ? 'Vencido' : 'Pendiente',
      paidAmount: '',
      treasuryAccountId: 'CAJA-CHICA-01',
      isRecurring: false,
      recurrenceFrequency: 'Mensual',
      notes: '',
      attachmentUrl: '',
      attachmentName: '',
      attachmentType: 'image',
    });
    setNewInstModalOpen(true);
  };

  const handleAttachmentFileChange = (
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
      setNewInstForm((prev) => ({
        ...prev,
        attachmentUrl: result,
        attachmentName: file.name,
        attachmentType: isPdf ? 'pdf' : 'image',
      }));
    };
    reader.readAsDataURL(file);
  };

  const buildInstallmentVoucher = (
    inst: SupplierDueInstallment
  ): VoucherDocumentData => {
    const meta = buildSupplierMeta(inst.supplierName, inst.supplierId);
    const catLabel = inst.expenseCategory || 'Compra a Proveedor / Mercadería';
    const conceptTitle = inst.concept || inst.notes || inst.docRef;
    return {
      docType: 'Vencimiento / Deuda Registrada',
      docNumber: inst.docRef,
      dateFormatted: formatIsoToAr(inst.issueDate || inst.dueDate),
      dueDateFormatted: formatIsoToAr(inst.dueDate),
      recipientRoleLabel: 'Entidad / Beneficiario',
      supplierName: inst.supplierName,
      supplierCuit: meta.cuit,
      supplierPhone: meta.phone,
      supplierEmail: meta.email,
      status: inst.status === 'Saldado' ? 'Pagado' : inst.status,
      secondaryStatus: `${catLabel} · Vto: ${formatIsoToAr(inst.dueDate)}`,
      totalAmount: inst.totalAmount,
      paidAmount: inst.paidAmount,
      notes: `${conceptTitle}${inst.notes ? ` — ${inst.notes}` : ''}${
        inst.isRecurring
          ? ` (Gasto Recurrente: ${inst.recurrenceFrequency || 'Mensual'})`
          : ''
      }`,
      attachmentUrl: inst.attachmentUrl,
      attachmentName: inst.attachmentName,
      attachmentType: inst.attachmentType,
      items: [
        {
          sku: inst.docRef,
          name: `[${catLabel}] ${conceptTitle} — Vto: ${formatIsoToAr(
            inst.dueDate
          )}`,
          quantity: 1,
          unitCost: inst.totalAmount,
        },
      ],
    };
  };

  const openInstallmentModal = (inst: SupplierDueInstallment) => {
    const remaining = Math.max(0, inst.totalAmount - inst.paidAmount);
    setSelectedInstallment(inst);
    setInstStatusChoice('Pagado');
    setInstPayAmount(remaining > 0 ? remaining.toFixed(2) : '0.00');
    setInstTreasuryAccountId(inst.treasuryAccountId || 'CAJA-CHICA-01');
    setInstPayNote(
      `Pago ${inst.concept || inst.docRef} (${
        inst.expenseCategory || 'Gasto Operativo'
      })`
    );
  };

  const handleQuickMarkInstallmentAsPaid = async (
    inst: SupplierDueInstallment,
    accountIdOverride?: string
  ) => {
    const remaining = Math.max(0, inst.totalAmount - inst.paidAmount);
    const chosenAccountId =
      accountIdOverride || inst.treasuryAccountId || 'CAJA-CHICA-01';
    const accObj =
      treasuryAccounts.find((a) => a.id === chosenAccountId) ||
      treasuryAccounts[0];

    await onUpdateInstallmentStatusOrPayment({
      installmentId: inst.id,
      supplierId: inst.supplierId,
      newStatus: 'Pagado',
      paidAmountDelta: remaining > 0 ? remaining : inst.totalAmount,
      paymentMethod:
        accObj.type === 'Caja Chica'
          ? `Efectivo (${accObj.name})`
          : `Transferencia (${accObj.name})`,
      treasuryAccountId: accObj.id,
      note: `Pago de ${inst.concept || inst.docRef} descontado de ${
        accObj.name
      }`,
    });

    const updated = recordExpensePaymentInTreasuryAndCashflow({
      accountId: accObj.id,
      amount: remaining > 0 ? remaining : inst.totalAmount,
      category: inst.expenseCategory || 'Compra a Proveedor / Mercadería',
      concept: inst.concept || inst.notes || `Pago comprobante ${inst.docRef}`,
      beneficiary: inst.supplierName,
      docRef: inst.docRef,
      paymentMethod:
        accObj.type === 'Caja Chica'
          ? `Efectivo (${accObj.name})`
          : `Transferencia (${accObj.name})`,
    });
    setTreasuryAccounts(updated.accounts);
    setCashflowEntries(updated.entries);

    if (inst.isRecurring) {
      const nextDue = computeNextRecurrenceIsoDate(
        inst.dueDate,
        inst.recurrenceFrequency || 'Mensual'
      );
      const alreadyExists = installments.some(
        (existing) =>
          existing.dueDate === nextDue &&
          existing.supplierName === inst.supplierName &&
          (existing.concept || '') === (inst.concept || '')
      );
      if (!alreadyExists) {
        onAddInstallment({
          supplierId: inst.supplierId,
          supplierName: inst.supplierName,
          expenseCategory: inst.expenseCategory,
          concept: inst.concept,
          docRef: `${inst.docRef}-REC`,
          issueDate: getTodayIso(),
          dueDate: nextDue,
          totalAmount: inst.totalAmount,
          paidAmount: 0,
          status: 'Pendiente',
          isRecurring: true,
          recurrenceFrequency: inst.recurrenceFrequency || 'Mensual',
          treasuryAccountId: accObj.id,
          notes: `Alerta recurrente (${
            inst.recurrenceFrequency || 'Mensual'
          }) autogenerada al abonar período anterior`,
        });
      }
      setExpenseBannerFeedback(
        `Egreso "${
          inst.concept || inst.docRef
        }" marcado como PAGADO: se descontaron ${formatCurrency(
          remaining > 0 ? remaining : inst.totalAmount
        )} de "${
          accObj.name
        }", se registró en el Cashflow y se autogeneró la próxima alerta recurrente para el ${formatIsoToAr(
          nextDue
        )}.`
      );
    } else {
      setExpenseBannerFeedback(
        `Egreso "${
          inst.concept || inst.docRef
        }" marcado como PAGADO: se descontaron ${formatCurrency(
          remaining > 0 ? remaining : inst.totalAmount
        )} de "${
          accObj.name
        }" y se registró en el Reporte de Flujo de Caja (Cashflow) en la categoría "${
          inst.expenseCategory || 'Compra a Proveedor / Mercadería'
        }".`
      );
    }
  };

  const handleSaveInstallmentAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;
    const delta = Math.max(0, parseFloat(instPayAmount) || 0);
    const accObj =
      treasuryAccounts.find((a) => a.id === instTreasuryAccountId) ||
      treasuryAccounts[0];

    setIsSavingInst(true);
    try {
      await onUpdateInstallmentStatusOrPayment({
        installmentId: selectedInstallment.id,
        supplierId: selectedInstallment.supplierId,
        newStatus: instStatusChoice,
        paidAmountDelta: delta,
        paymentMethod: `${instPayMethod} (${accObj.name})`,
        treasuryAccountId: accObj.id,
        note: instPayNote,
      });

      if (
        (instStatusChoice === 'Pagado' || instStatusChoice === 'Parcial') &&
        delta > 0
      ) {
        const updated = recordExpensePaymentInTreasuryAndCashflow({
          accountId: accObj.id,
          amount: delta,
          category:
            selectedInstallment.expenseCategory ||
            'Compra a Proveedor / Mercadería',
          concept:
            selectedInstallment.concept ||
            selectedInstallment.notes ||
            `Pago ${selectedInstallment.docRef}`,
          beneficiary: selectedInstallment.supplierName,
          docRef: selectedInstallment.docRef,
          paymentMethod: `${instPayMethod} (${accObj.name})`,
        });
        setTreasuryAccounts(updated.accounts);
        setCashflowEntries(updated.entries);
      }

      if (instStatusChoice === 'Pagado' && selectedInstallment.isRecurring) {
        const nextDue = computeNextRecurrenceIsoDate(
          selectedInstallment.dueDate,
          selectedInstallment.recurrenceFrequency || 'Mensual'
        );
        const alreadyExists = installments.some(
          (existing) =>
            existing.dueDate === nextDue &&
            existing.supplierName === selectedInstallment.supplierName &&
            (existing.concept || '') === (selectedInstallment.concept || '')
        );
        if (!alreadyExists) {
          onAddInstallment({
            supplierId: selectedInstallment.supplierId,
            supplierName: selectedInstallment.supplierName,
            expenseCategory: selectedInstallment.expenseCategory,
            concept: selectedInstallment.concept,
            docRef: `${selectedInstallment.docRef}-REC`,
            issueDate: getTodayIso(),
            dueDate: nextDue,
            totalAmount: selectedInstallment.totalAmount,
            paidAmount: 0,
            status: 'Pendiente',
            isRecurring: true,
            recurrenceFrequency:
              selectedInstallment.recurrenceFrequency || 'Mensual',
            treasuryAccountId: accObj.id,
            notes: `Alerta recurrente (${
              selectedInstallment.recurrenceFrequency || 'Mensual'
            }) autogenerada`,
          });
        }
        setExpenseBannerFeedback(
          `Pago registrado y descontado de "${
            accObj.name
          }". Se actualizó el Reporte de Flujo de Caja (Cashflow) y se autogeneró el próximo vencimiento recurrente para el ${formatIsoToAr(
            nextDue
          )}.`
        );
      } else if (delta > 0) {
        setExpenseBannerFeedback(
          `Pago de ${formatCurrency(delta)} descontado de "${
            accObj.name
          }" y registrado en el Reporte de Flujo de Caja (Cashflow) bajo "${
            selectedInstallment.expenseCategory ||
            'Compra a Proveedor / Mercadería'
          }".`
        );
      }

      setSelectedInstallment(null);
    } finally {
      setIsSavingInst(false);
    }
  };

  const handleCreateNewInstallment = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Math.max(0, parseFloat(newInstForm.totalAmount) || 0);
    if (total <= 0) return;

    const matchedSup = suppliers.find(
      (s) =>
        String(s.id) === newInstForm.supplierId ||
        s.name.toLowerCase() === newInstForm.beneficiaryName.trim().toLowerCase()
    );
    const resolvedBeneficiary =
      newInstForm.beneficiaryName.trim() ||
      matchedSup?.name ||
      'Beneficiario Operativo';
    const resolvedSupplierId =
      newInstForm.expenseCategory === 'Compra a Proveedor / Mercadería' &&
      matchedSup
        ? matchedSup.id
        : 0;

    const initialPaid =
      newInstForm.status === 'Pagado'
        ? total
        : newInstForm.status === 'Parcial'
        ? Math.min(
            total,
            Math.max(0, parseFloat(newInstForm.paidAmount) || total / 2)
          )
        : 0;

    const conceptClean =
      newInstForm.concept.trim() ||
      `${newInstForm.expenseCategory} - ${resolvedBeneficiary}`;
    const docRefClean =
      newInstForm.docRef.trim() ||
      `EGR-${Math.floor(1000 + Math.random() * 9000)}`;

    onAddInstallment({
      supplierId: resolvedSupplierId,
      supplierName: resolvedBeneficiary,
      expenseCategory: newInstForm.expenseCategory,
      concept: conceptClean,
      docRef: docRefClean,
      issueDate: newInstForm.issueDate || newInstForm.dueDate,
      dueDate: newInstForm.dueDate,
      totalAmount: total,
      paidAmount: initialPaid,
      status: newInstForm.status,
      isRecurring: newInstForm.isRecurring,
      recurrenceFrequency: newInstForm.isRecurring
        ? newInstForm.recurrenceFrequency
        : undefined,
      treasuryAccountId: newInstForm.treasuryAccountId,
      notes: newInstForm.notes.trim() || conceptClean,
      attachmentUrl: newInstForm.attachmentUrl || undefined,
      attachmentName: newInstForm.attachmentName || undefined,
      attachmentType: newInstForm.attachmentUrl
        ? newInstForm.attachmentType
        : undefined,
    });

    const accObj =
      treasuryAccounts.find((a) => a.id === newInstForm.treasuryAccountId) ||
      treasuryAccounts[0];

    if (initialPaid > 0) {
      const updated = recordExpensePaymentInTreasuryAndCashflow({
        accountId: accObj.id,
        amount: initialPaid,
        category: newInstForm.expenseCategory,
        concept: conceptClean,
        beneficiary: resolvedBeneficiary,
        docRef: docRefClean,
        isoDate: getTodayIso(),
      });
      setTreasuryAccounts(updated.accounts);
      setCashflowEntries(updated.entries);
    }

    if (newInstForm.isRecurring) {
      const nextDue = computeNextRecurrenceIsoDate(
        newInstForm.dueDate,
        newInstForm.recurrenceFrequency
      );
      onAddInstallment({
        supplierId: resolvedSupplierId,
        supplierName: resolvedBeneficiary,
        expenseCategory: newInstForm.expenseCategory,
        concept: `${conceptClean} (Próximo período ${newInstForm.recurrenceFrequency})`,
        docRef: `${docRefClean}-PROX`,
        issueDate: newInstForm.dueDate,
        dueDate: nextDue,
        totalAmount: total,
        paidAmount: 0,
        status: 'Pendiente',
        isRecurring: true,
        recurrenceFrequency: newInstForm.recurrenceFrequency,
        treasuryAccountId: newInstForm.treasuryAccountId,
        notes: `Alerta recurrente (${newInstForm.recurrenceFrequency}) autogenerada para el próximo período`,
      });
      setExpenseBannerFeedback(
        `Vencimiento "${conceptClean}" agendado (${newInstForm.status})${
          initialPaid > 0
            ? ` con descuento de ${formatCurrency(initialPaid)} en "${
                accObj.name
              }"`
            : ''
        }. Alerta recurrente (${
          newInstForm.recurrenceFrequency
        }) autogenerada para el ${formatIsoToAr(nextDue)}.`
      );
    } else if (initialPaid > 0) {
      setExpenseBannerFeedback(
        `Egreso "${conceptClean}" registrado como ${
          newInstForm.status
        }: se descontaron ${formatCurrency(initialPaid)} de "${
          accObj.name
        }" y se impactó en el Reporte de Flujo de Caja (Cashflow).`
      );
    } else {
      setExpenseBannerFeedback(
        `Vencimiento / Egreso "${conceptClean}" (${
          newInstForm.expenseCategory
        }) agendado para el ${formatIsoToAr(newInstForm.dueDate)}.`
      );
    }

    setNewInstModalOpen(false);
  };

  const calendarDaysGrid = useMemo(() => {
    const year = calendarCursorDate.getFullYear();
    const month = calendarCursorDate.getMonth();

    if (calendarViewMode === 'week') {
      const current = new Date(calendarCursorDate);
      const dayOfWeek = current.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(current);
      monday.setDate(current.getDate() + diffToMonday);

      const days: { date: Date; iso: string; isCurrentMonth: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(d.getDate()).padStart(2, '0')}`;
        days.push({
          date: d,
          iso,
          isCurrentMonth: true,
        });
      }
      return days;
    }

    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const startDate = new Date(year, month, 1 - offset);

    const days: { date: Date; iso: string; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        iso,
        isCurrentMonth: d.getMonth() === month,
      });
    }
    return days;
  }, [calendarCursorDate, calendarViewMode]);

  const filteredInstallments = useMemo(() => {
    return installments.filter((inst) => {
      if (
        calendarSupplierFilter !== 'Todos' &&
        inst.supplierName !== calendarSupplierFilter
      ) {
        return false;
      }
      if (
        calendarCategoryFilter !== 'Todas' &&
        (inst.expenseCategory || 'Compra a Proveedor / Mercadería') !==
          calendarCategoryFilter
      ) {
        return false;
      }
      return true;
    });
  }, [installments, calendarSupplierFilter, calendarCategoryFilter]);

  const navigateCalendar = (dir: -1 | 1) => {
    const next = new Date(calendarCursorDate);
    if (calendarViewMode === 'month') {
      next.setMonth(next.getMonth() + dir);
    } else {
      next.setDate(next.getDate() + dir * 7);
    }
    setCalendarCursorDate(next);
  };

  // =========================================================================
  // RENDERIZADO MODO 3: HISTORIAL UNIFICADO DE OPERACIONES (PEDIDOS, DEVOLUCIONES Y PAGOS)
  // =========================================================================
  if (mode === 'history') {
    return (
      <div className="space-y-5">
        {activeVoucherModal && (
          <VoucherActionModal
            voucher={activeVoucherModal.voucher}
            initialTab={activeVoucherModal.tab}
            onClose={() => setActiveVoucherModal(null)}
            formatCurrency={formatCurrency}
          />
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Historial de Movimientos (Pedidos, Devoluciones y Pagos)
              </h3>
              <p className="text-xs text-slate-500">
                Registro cronológico completo con generación de PDF membretado de
                FERRETERIA DEL PUENTE, envío directo por WhatsApp y ordenamiento
                dinámico.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                Total operaciones: {filteredAndSortedHistory.length}
              </span>
            </div>
          </div>

          {/* Filtros Avanzados del Historial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar comprobante, proveedor, detalle..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="Todos">Tipo de Operación: Todos</option>
                <option value="Pedido a Proveedor">Pedidos a Proveedores</option>
                <option value="Devolución">Devoluciones</option>
                <option value="Pago Registrado">Pagos Registrados</option>
              </select>
            </div>

            <div>
              <select
                value={historySupplierFilter}
                onChange={(e) => setHistorySupplierFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="Todos">Proveedor: Todos</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="Todos">Estado: Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Tránsito">En Tránsito</option>
                <option value="Recibido">Recibido</option>
                <option value="Acreditado">Acreditado</option>
                <option value="Saldado">Saldado</option>
                <option value="Parcial">Parcial</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            <div>
              <select
                value={historyDatePreset}
                onChange={(e) => setHistoryDatePreset(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="todos">Rango de Fechas: Todos</option>
                <option value="hoy">Hoy</option>
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mes</option>
                <option value="personalizado">Personalizado...</option>
              </select>
            </div>
          </div>

          {historyDatePreset === 'personalizado' && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="text-xs font-semibold text-slate-600">
                Desde:
              </span>
              <input
                type="date"
                value={historyFromDate}
                onChange={(e) => setHistoryFromDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono border border-slate-200 rounded-lg"
              />
              <span className="text-xs font-semibold text-slate-600">
                Hasta:
              </span>
              <input
                type="date"
                value={historyToDate}
                onChange={(e) => setHistoryToDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono border border-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Tabla del Historial de Operaciones con Ordenamiento Interactivo (Sort) */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 select-none">
                  {[
                    { key: 'isoDate', label: 'Fecha' },
                    { key: 'operationType', label: 'Tipo' },
                    { key: 'supplierName', label: 'Proveedor' },
                  ].map((col) => {
                    const isSorted = historySort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() =>
                          handleSortHistoryCol(col.key as HistorySortKey)
                        }
                        className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={
                              isSorted ? 'text-slate-900 font-bold' : ''
                            }
                          >
                            {col.label}
                          </span>
                          {isSorted ? (
                            historySort.direction === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                    );
                  })}

                  <th className="py-3 px-4">
                    Detalle de Artículos / Operación
                  </th>

                  {[
                    {
                      key: 'totalAmount',
                      label: 'Monto',
                      align: 'right' as const,
                    },
                    { key: 'status', label: 'Estado', align: 'left' as const },
                  ].map((col) => {
                    const isSorted = historySort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() =>
                          handleSortHistoryCol(col.key as HistorySortKey)
                        }
                        className={`py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors ${
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
                            historySort.direction === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                    );
                  })}

                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    Comprobante PDF / WhatsApp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {filteredAndSortedHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-slate-500"
                    >
                      No se encontraron operaciones para los filtros
                      seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedHistory.map((op) => {
                    const isOrder = op.operationType === 'Pedido a Proveedor';
                    const isReturn = op.operationType === 'Devolución';

                    return (
                      <tr
                        key={op.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {op.formattedDate}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {op.docNumber}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                              isOrder
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : isReturn
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {isOrder ? (
                              <Truck className="w-3.5 h-3.5" />
                            ) : isReturn ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5" />
                            )}
                            <span>{op.operationType}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {op.supplierName}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600 max-w-md">
                          {op.detailSummary}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(op.totalAmount)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={op.status} />
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveVoucherModal({
                                  voucher: op.voucher,
                                  tab: 'pdf',
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                              title="Descargar PDF / Imprimir Comprobante con membrete FERRETERIA DEL PUENTE"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Descargar PDF / Imprimir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveVoucherModal({
                                  voucher: op.voucher,
                                  tab: 'whatsapp',
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                              title="Enviar resumen y comprobante por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Enviar por WhatsApp</span>
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
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDERIZADO MODO 1: CALENDARIO VISUAL DE VENCIMIENTOS, GASTOS GENERALES Y EGRESOS OPERATIVOS
  // =========================================================================
  if (mode === 'calendar') {
    const monthLabel = calendarCursorDate.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });

    const todayIso = getTodayIso();
    const currentYearMonth = todayIso.slice(0, 7);

    // Filtrado de vencimientos según el período de alertas seleccionado (Semana vs Mes)
    const periodInstallments = filteredInstallments.filter((inst) => {
      const diff = getDaysDiffFromToday(inst.dueDate);
      if (alertPeriodView === 'semana') {
        return diff >= -7 && diff <= 7;
      }
      return (
        inst.dueDate.slice(0, 7) === currentYearMonth ||
        (diff >= -30 && diff <= 30)
      );
    });

    const overdueOrTodayAlerts = periodInstallments.filter((inst) => {
      const ev = evaluateInstallmentUrgency(inst);
      return ev.urgency === 'overdue';
    });

    const upcomingSoonAlerts = periodInstallments.filter((inst) => {
      const ev = evaluateInstallmentUrgency(inst);
      return ev.urgency === 'soon' || ev.urgency === 'future';
    });

    const paidAlerts = periodInstallments.filter((inst) => {
      const ev = evaluateInstallmentUrgency(inst);
      return ev.urgency === 'settled';
    });

    const cashflowByCategory = EXPENSE_CATEGORIES.map((cat) => {
      const entriesForCat = cashflowEntries.filter((e) => e.category === cat);
      const totalPaidCat = entriesForCat.reduce((acc, e) => acc + e.amount, 0);
      return {
        category: cat,
        count: entriesForCat.length,
        totalPaid: totalPaidCat,
      };
    });

    const totalCashflowOut = cashflowEntries.reduce(
      (acc, e) => acc + e.amount,
      0
    );

    const beneficiarySuggestions =
      newInstForm.expenseCategory === 'Compra a Proveedor / Mercadería'
        ? suppliers.map((s) => s.name)
        : [
            ...COMMON_SERVICE_BENEFICIARIES.filter(
              (b) => b.category === newInstForm.expenseCategory
            ).map((b) => b.name),
            ...COMMON_SERVICE_BENEFICIARIES.filter(
              (b) => b.category !== newInstForm.expenseCategory
            ).map((b) => b.name),
            ...suppliers.map((s) => s.name),
          ];

    return (
      <div className="space-y-5">
        {expenseBannerFeedback && (
          <div className="p-4 rounded-xl bg-emerald-950 text-white border border-emerald-700 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{expenseBannerFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setExpenseBannerFeedback(null)}
              className="p-1 text-emerald-300 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PANEL SUPERIOR: SALDOS DE CAJA CHICA / CUENTAS BANCARIAS E IMPACTO EN FLUJO DE CAJA (CASHFLOW) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#FF6600]" />
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Tesorería Operativa: Caja Chica, Cuentas Bancarias y Flujo de Caja (Cashflow)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Al marcar cualquier vencimiento o gasto operativo como{' '}
                <strong>Pagado</strong>, el monto se descuenta automáticamente de
                la cuenta seleccionada y se imputa en el Reporte de Cashflow por
                categoría.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowCashflowReportPanel((prev) => !prev)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                <TrendingDown className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>
                  {showCashflowReportPanel
                    ? 'Ocultar Reporte de Cashflow'
                    : 'Ver Reporte de Cashflow por Categoría'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openNewInstallmentModalForDate(getTodayIso())}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agendar Vencimiento / Registrar Gasto o Deuda</span>
              </button>
            </div>
          </div>

          {/* Tarjetas de Caja Chica y Cuentas Bancarias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {treasuryAccounts.map((acc) => {
              const isCash = acc.type === 'Caja Chica';
              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                          isCash
                            ? 'bg-orange-100 text-orange-900'
                            : 'bg-sky-100 text-sky-900'
                        }`}
                      >
                        {isCash ? (
                          <Wallet className="w-3 h-3" />
                        ) : (
                          <Landmark className="w-3 h-3" />
                        )}
                        {acc.type}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 mt-1.5">
                        {acc.name}
                      </h4>
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-mono font-extrabold text-slate-900">
                      {formatCurrency(acc.balance)}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {acc.accountDetail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reporte Desplegable de Flujo de Caja (Cashflow) por Categoría de Egreso */}
          {showCashflowReportPanel && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-5 bg-slate-900 text-white rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block">
                      Reporte de Flujo de Caja (Cashflow)
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold">
                      Egresos Imputados por Categoría Operativa
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">
                      Total Egresos Pagados
                    </span>
                    <span className="font-mono text-sm font-extrabold text-[#FF6600]">
                      {formatCurrency(totalCashflowOut)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {cashflowByCategory.map((item) => {
                    const pct =
                      totalCashflowOut > 0
                        ? Math.round((item.totalPaid / totalCashflowOut) * 100)
                        : 0;
                    return (
                      <div
                        key={item.category}
                        className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-200 truncate">
                            {item.category}
                          </span>
                          <span className="font-mono font-bold text-white shrink-0">
                            {formatCurrency(item.totalPaid)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{item.count} mov. registrados</span>
                          <span>{pct}% del flujo</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="xl:col-span-7 border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Últimos Egresos Descontados de Caja Chica / Banco (Cashflow)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {cashflowEntries.length} registros
                  </span>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase text-slate-500">
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Categoría / Concepto</th>
                        <th className="py-2 px-3">Entidad / Beneficiario</th>
                        <th className="py-2 px-3">Cuenta Descontada</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cashflowEntries.slice(0, 12).map((cf) => (
                        <tr key={cf.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {cf.formattedDate}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold mb-0.5">
                              {cf.category}
                            </span>
                            <div className="font-semibold text-slate-900">
                              {cf.concept}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-700 font-medium">
                            {cf.beneficiary}
                          </td>
                          <td className="py-2 px-3 text-[11px] font-semibold text-slate-700">
                            {cf.accountName}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                            - {formatCurrency(cf.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANEL DE ALERTAS VISUALES: VENCIMIENTOS DE LA SEMANA Y DEL MES DIFERENCIADOS POR COLOR */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FF6600]" />
                <span>
                  Panel de Alertas Visuales de Vencimientos y Gastos Operativos
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Seguimiento diferenciado por color para compromisos{' '}
                <strong>Vencidos hoy / Vencidos</strong>,{' '}
                <strong>Próximos a vencer</strong> y <strong>Pagados</strong>.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setAlertPeriodView('semana')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  alertPeriodView === 'semana'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vencimientos de la Semana
              </button>
              <button
                type="button"
                onClick={() => setAlertPeriodView('mes')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  alertPeriodView === 'mes'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vencimientos del Mes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. VENCIDOS HOY / VENCIDOS (ROJO) */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-rose-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  Vencidos Hoy / Vencidos ({overdueOrTodayAlerts.length})
                </span>
                <span className="font-mono text-xs font-extrabold text-rose-800">
                  {formatCurrency(
                    overdueOrTodayAlerts.reduce(
                      (acc, i) => acc + Math.max(0, i.totalAmount - i.paidAmount),
                      0
                    )
                  )}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {overdueOrTodayAlerts.length === 0 ? (
                  <p className="text-xs text-rose-700/80 py-3 text-center">
                    Sin compromisos vencidos en este período.
                  </p>
                ) : (
                  overdueOrTodayAlerts.map((inst) => {
                    const evalInfo = evaluateInstallmentUrgency(inst);
                    return (
                      <div
                        key={inst.id}
                        className="p-2.5 rounded-lg bg-white border border-rose-200 shadow-2xs space-y-1.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                              {inst.expenseCategory ||
                                'Compra a Proveedor / Mercadería'}
                            </span>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {inst.concept || inst.notes || inst.docRef}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {inst.supplierName} · Vto:{' '}
                              <strong>{formatIsoToAr(inst.dueDate)}</strong>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold shrink-0">
                            {evalInfo.labelText}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-rose-100">
                          <span className="font-mono font-extrabold text-rose-700">
                            {formatCurrency(evalInfo.remaining)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openInstallmentModal(inst)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                            >
                              Detalle
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickMarkInstallmentAsPaid(inst)
                              }
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Marcar Pagado
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. PRÓXIMOS A VENCER (AMARILLO / ÁMBAR) */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-950">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Próximos a Vencer ({upcomingSoonAlerts.length})
                </span>
                <span className="font-mono text-xs font-extrabold text-amber-900">
                  {formatCurrency(
                    upcomingSoonAlerts.reduce(
                      (acc, i) => acc + Math.max(0, i.totalAmount - i.paidAmount),
                      0
                    )
                  )}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {upcomingSoonAlerts.length === 0 ? (
                  <p className="text-xs text-amber-800/80 py-3 text-center">
                    No hay vencimientos próximos en este período.
                  </p>
                ) : (
                  upcomingSoonAlerts.map((inst) => {
                    const evalInfo = evaluateInstallmentUrgency(inst);
                    return (
                      <div
                        key={inst.id}
                        className="p-2.5 rounded-lg bg-white border border-amber-200 shadow-2xs space-y-1.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                {inst.expenseCategory ||
                                  'Compra a Proveedor / Mercadería'}
                              </span>
                              {inst.isRecurring && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-bold">
                                  <Repeat className="w-2.5 h-2.5" />
                                  {inst.recurrenceFrequency || 'Mensual'}
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {inst.concept || inst.notes || inst.docRef}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {inst.supplierName} · Vto:{' '}
                              <strong>{formatIsoToAr(inst.dueDate)}</strong>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-extrabold shrink-0">
                            {evalInfo.labelText}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-amber-100">
                          <span className="font-mono font-extrabold text-amber-900">
                            {formatCurrency(evalInfo.remaining)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openInstallmentModal(inst)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                            >
                              Detalle
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickMarkInstallmentAsPaid(inst)
                              }
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Marcar Pagado
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. PAGADOS (VERDE / ESMERALDA) */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  Pagados en el Período ({paidAlerts.length})
                </span>
                <span className="font-mono text-xs font-extrabold text-emerald-800">
                  {formatCurrency(
                    paidAlerts.reduce((acc, i) => acc + i.totalAmount, 0)
                  )}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {paidAlerts.length === 0 ? (
                  <p className="text-xs text-emerald-800/80 py-3 text-center">
                    Aún no hay egresos marcados como Pagados en este período.
                  </p>
                ) : (
                  paidAlerts.map((inst) => (
                    <div
                      key={inst.id}
                      onClick={() => openInstallmentModal(inst)}
                      className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-2xs space-y-1 text-xs cursor-pointer hover:bg-emerald-50/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                            {inst.expenseCategory ||
                              'Compra a Proveedor / Mercadería'}
                          </span>
                          <div className="font-bold text-slate-900 mt-0.5">
                            {inst.concept || inst.notes || inst.docRef}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {inst.supplierName} · Vto:{' '}
                            {formatIsoToAr(inst.dueDate)}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold shrink-0">
                          PAGADO ✓
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-100">
                        <span className="text-[10px] text-slate-500">
                          Comprobante: {inst.docRef}
                        </span>
                        <span className="font-mono font-bold text-emerald-800">
                          {formatCurrency(inst.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN Y FILTROS DEL ALMANAQUE */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => navigateCalendar(-1)}
                className="p-1.5 rounded-md hover:bg-white text-slate-700 cursor-pointer"
                title="Período anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarCursorDate(new Date())}
                className="px-2.5 py-1 rounded-md bg-white text-xs font-bold text-slate-900 shadow-xs cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => navigateCalendar(1)}
                className="p-1.5 rounded-md hover:bg-white text-slate-700 cursor-pointer"
                title="Período siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base sm:text-lg font-bold capitalize text-slate-900">
              {monthLabel}
            </h3>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setCalendarViewMode('month')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  calendarViewMode === 'month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vista Mensual
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode('week')}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  calendarViewMode === 'week'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vista Semanal
              </button>
            </div>

            <select
              value={calendarCategoryFilter}
              onChange={(e) => setCalendarCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Todas">Tipo de Egreso: Todas las categorías</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={calendarSupplierFilter}
              onChange={(e) => setCalendarSupplierFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Todos">Entidad / Beneficiario: Todos</option>
              {Array.from(
                new Set([
                  ...suppliers.map((s) => s.name),
                  ...installments.map((i) => i.supplierName),
                ])
              ).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                Vencidos Hoy / Vencidos
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Próximos a vencer
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Pagados
              </span>
            </div>
          </div>
        </div>

        {activeVoucherModal && (
          <VoucherActionModal
            voucher={activeVoucherModal.voucher}
            initialTab={activeVoucherModal.tab}
            onClose={() => setActiveVoucherModal(null)}
            formatCurrency={formatCurrency}
          />
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-slate-900 text-white text-xs flex items-center justify-between">
            <span>
              Haga clic sobre <strong>cualquier día del almanaque</strong> para
              agendar un Vencimiento, Deuda o Gasto Operativo con esa fecha
              precompletada.
            </span>
            <span className="hidden sm:inline text-slate-300 font-mono text-[11px]">
              Clic en evento = Ver detalle, descontar de Caja Chica/Banco y PDF
            </span>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="py-2.5 px-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
            {calendarDaysGrid.map((cell) => {
              const isToday = cell.iso === getTodayIso();
              const dayEvents = filteredInstallments.filter(
                (inst) => inst.dueDate === cell.iso
              );

              return (
                <div
                  key={cell.iso}
                  onClick={() => openNewInstallmentModalForDate(cell.iso)}
                  title={`Haga clic para agendar vencimiento o gasto operativo el ${formatIsoToAr(
                    cell.iso
                  )}`}
                  className={`group ${
                    calendarViewMode === 'week'
                      ? 'min-h-[240px]'
                      : 'min-h-[135px]'
                  } p-2 transition-colors cursor-pointer ${
                    cell.isCurrentMonth
                      ? 'bg-white hover:bg-orange-50/40'
                      : 'bg-slate-50/60 hover:bg-orange-50/30'
                  } ${isToday ? 'ring-2 ring-inset ring-[#FF6600]' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-mono font-bold ${
                        isToday
                          ? 'px-1.5 py-0.5 rounded bg-[#FF6600] text-white'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-mono font-semibold text-slate-400">
                          {dayEvents.length}{' '}
                          {dayEvents.length === 1 ? 'vto.' : 'vtos.'}
                        </span>
                      )}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-[#FF6600]/10 text-[#FF6600] text-[10px] font-bold">
                        + Agendar
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {dayEvents.map((inst) => {
                      const evalInfo = evaluateInstallmentUrgency(inst);
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInstallmentModal(inst);
                          }}
                          title="Haga clic para ver detalles, imputar pago desde Caja/Banco o descargar PDF"
                          className={`w-full text-left p-1.5 rounded-lg border text-[11px] transition-transform hover:scale-[1.01] cursor-pointer shadow-2xs ${evalInfo.colorClass}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold truncate">
                              {inst.concept || inst.supplierName}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {inst.isRecurring && (
                                <Repeat className="w-2.5 h-2.5 text-indigo-700" />
                              )}
                              {inst.attachmentUrl && (
                                <Paperclip className="w-3 h-3 text-slate-700" />
                              )}
                              <span
                                className={`w-2 h-2 rounded-full ${evalInfo.dotClass}`}
                              />
                            </div>
                          </div>
                          <div className="text-[10px] opacity-85 truncate">
                            {inst.supplierName}
                          </div>
                          <div className="font-mono font-bold text-xs mt-0.5">
                            {formatCurrency(
                              evalInfo.remaining > 0
                                ? evalInfo.remaining
                                : inst.totalAmount
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] opacity-90 mt-0.5">
                            <span className="truncate">
                              {inst.expenseCategory
                                ? inst.expenseCategory.split(' ')[0]
                                : inst.docRef}
                            </span>
                            <span className="font-bold uppercase">
                              {inst.status === 'Saldado'
                                ? 'Pagado'
                                : inst.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL: DETALLES DEL VENCIMIENTO, DESCUENTO EN CAJA CHICA / BANCO, BOLETA ADJUNTA Y PDF */}
        {selectedInstallment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">
                      Detalle del Vencimiento / Egreso Operativo
                    </h4>
                    <StatusBadge
                      status={
                        selectedInstallment.status === 'Saldado'
                          ? 'Pagado'
                          : selectedInstallment.status
                      }
                    />
                    {selectedInstallment.isRecurring && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                        <Repeat className="w-3 h-3" />
                        Recurrente ({selectedInstallment.recurrenceFrequency || 'Mensual'})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedInstallment.expenseCategory ||
                      'Compra a Proveedor / Mercadería'}{' '}
                    · Beneficiario:{' '}
                    <strong className="text-slate-800">
                      {selectedInstallment.supplierName}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const v = buildInstallmentVoucher(selectedInstallment);
                      setSelectedInstallment(null);
                      setActiveVoucherModal({ voucher: v, tab: 'pdf' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <Printer className="w-3.5 h-3.5" />
                    <span>Descargar PDF / Imprimir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const v = buildInstallmentVoucher(selectedInstallment);
                      setSelectedInstallment(null);
                      setActiveVoucherModal({ voucher: v, tab: 'whatsapp' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInstallment(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Columna 1: Datos Generales */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Información del Egreso / Compromiso
                  </span>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Tipo de Egreso:</span>
                    <span className="font-bold text-slate-900 text-right">
                      {selectedInstallment.expenseCategory ||
                        'Compra a Proveedor / Mercadería'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Concepto / Descripción:</span>
                    <span className="font-bold text-slate-900 text-right">
                      {selectedInstallment.concept ||
                        selectedInstallment.notes ||
                        selectedInstallment.docRef}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Entidad / Beneficiario:</span>
                    <span className="font-bold text-slate-900 text-right">
                      {selectedInstallment.supplierName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Comprobante / Ref.:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedInstallment.docRef}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Fecha de Vencimiento:
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatIsoToAr(selectedInstallment.dueDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estado de Pago:</span>
                    <span className="font-bold text-slate-900">
                      {selectedInstallment.status === 'Saldado'
                        ? 'Pagado'
                        : selectedInstallment.status}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200">
                    <span className="text-slate-500">Monto a Pagar:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrency(selectedInstallment.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Abonado previamente:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {formatCurrency(selectedInstallment.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200">
                    <span className="font-bold text-slate-800">
                      Saldo Pendiente:
                    </span>
                    <span className="font-mono font-bold text-rose-700 text-sm">
                      {formatCurrency(
                        Math.max(
                          0,
                          selectedInstallment.totalAmount -
                            selectedInstallment.paidAmount
                        )
                      )}
                    </span>
                  </div>
                </div>

                {/* Columna 2: Vista Previa Interactiva de la Foto / Boleta Adjunta */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-[#FF6600]" />
                      <span>Boleta / Comprobante Adjunto</span>
                    </span>
                    {selectedInstallment.attachmentUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setFullScreenAttachment({
                            url: selectedInstallment.attachmentUrl!,
                            name:
                              selectedInstallment.attachmentName ||
                              selectedInstallment.docRef,
                            type:
                              selectedInstallment.attachmentType || 'image',
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Abrir en Tamaño Completo</span>
                      </button>
                    )}
                  </div>

                  {selectedInstallment.attachmentUrl ? (
                    <div className="space-y-2">
                      {selectedInstallment.attachmentType === 'pdf' ? (
                        <div className="p-4 rounded-lg bg-white border border-slate-200 text-center space-y-2">
                          <FileText className="w-8 h-8 text-[#FF6600] mx-auto" />
                          <p className="text-xs font-mono font-bold text-slate-800 truncate">
                            {selectedInstallment.attachmentName ||
                              'Comprobante.pdf'}
                          </p>
                          <a
                            href={selectedInstallment.attachmentUrl}
                            download={
                              selectedInstallment.attachmentName ||
                              'boleta_adjunta.pdf'
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar PDF Original</span>
                          </a>
                        </div>
                      ) : (
                        <div
                          onClick={() =>
                            setFullScreenAttachment({
                              url: selectedInstallment.attachmentUrl!,
                              name:
                                selectedInstallment.attachmentName ||
                                selectedInstallment.docRef,
                              type: 'image',
                            })
                          }
                          title="Haga clic para ver en tamaño completo"
                          className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white cursor-pointer flex items-center justify-center h-44"
                        >
                          <img
                            src={selectedInstallment.attachmentUrl}
                            alt="Vista previa de boleta"
                            className="max-h-full max-w-full object-contain"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold shadow-md flex items-center gap-1.5">
                              <Maximize2 className="w-3.5 h-3.5" />
                              Ver en Tamaño Completo
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-300 hover:border-[#FF6600] rounded-lg bg-white hover:bg-orange-50/30 transition-colors cursor-pointer">
                      <Camera className="w-7 h-7 text-[#FF6600] mb-1" />
                      <p className="text-xs font-bold text-slate-700">
                        Tomar foto de la boleta o subir archivo
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Permite adjuntar imagen o PDF de respaldo del gasto
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const isPdf =
                            file.type === 'application/pdf' ||
                            file.name.toLowerCase().endsWith('.pdf');
                          const reader = new FileReader();
                          reader.onload = () => {
                            const resStr =
                              typeof reader.result === 'string'
                                ? reader.result
                                : '';
                            setSelectedInstallment((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    attachmentUrl: resStr,
                                    attachmentName: file.name,
                                    attachmentType: isPdf ? 'pdf' : 'image',
                                  }
                                : null
                            );
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleSaveInstallmentAction}
                className="space-y-3.5 pt-2 border-t border-slate-200"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado de Pago *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      ['Pagado', 'Parcial', 'Pendiente', 'Vencido'] as const
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setInstStatusChoice(st);
                          const rem = Math.max(
                            0,
                            selectedInstallment.totalAmount -
                              selectedInstallment.paidAmount
                          );
                          if (st === 'Pagado') {
                            setInstPayAmount(
                              (rem > 0
                                ? rem
                                : selectedInstallment.totalAmount
                              ).toFixed(2)
                            );
                          } else if (st === 'Pendiente' || st === 'Vencido') {
                            setInstPayAmount('0.00');
                          } else if (st === 'Parcial' && rem > 0) {
                            setInstPayAmount((rem / 2).toFixed(2));
                          }
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          instStatusChoice === st
                            ? st === 'Pagado'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : st === 'Parcial'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : st === 'Vencido'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Monto a Pagar Ahora (ARS)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={instPayAmount}
                      onChange={(e) => setInstPayAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Descontar de Caja Chica / Cuenta Bancaria *
                    </label>
                    <select
                      value={instTreasuryAccountId}
                      onChange={(e) => setInstTreasuryAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-orange-50/50 border border-[#FF6600] rounded-lg text-slate-900"
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
                      Medio de Pago / Referencia
                    </label>
                    <input
                      type="text"
                      value={instPayNote}
                      onChange={(e) => setInstPayNote(e.target.value)}
                      placeholder="Ej. Transferencia / Efectivo Caja Chica"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedInstallment(null)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingInst}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                  >
                    {isSavingInst
                      ? 'Procesando...'
                      : 'Confirmar Estado, Descontar de Caja y Registrar en Cashflow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL VISTA EN TAMAÑO COMPLETO DE LA FOTO / BOLETA ADJUNTA */}
        {fullScreenAttachment && (
          <div
            onClick={() => setFullScreenAttachment(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#FF6600]" />
                  <span className="text-sm font-bold">
                    Boleta / Factura Adjunta — {fullScreenAttachment.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFullScreenAttachment(null)}
                  className="p-1 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-auto flex-1 flex items-center justify-center bg-slate-100">
                <img
                  src={fullScreenAttachment.url}
                  alt={fullScreenAttachment.name}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md bg-white p-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* MODAL AMPLIADO: AGENDAR VENCIMIENTO / DEUDAS Y GESTIÓN DE GASTOS GENERALES / EGRESOS OPERATIVOS */}
        {newInstModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Agendar Vencimiento / Deuda o Gasto Operativo
                  </h4>
                  <p className="text-xs text-slate-500">
                    Gestione compras a proveedores, servicios básicos, alquiler,
                    sueldos, logística e impuestos con impacto directo en Caja y
                    Cashflow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewInstModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewInstallment} className="space-y-4">
                {/* 1. Categorización de Egresos: Tipo de Egreso */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tipo de Egreso *
                  </label>
                  <select
                    required
                    value={newInstForm.expenseCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as ExpenseCategoryType;
                      const defaultBen =
                        nextCat === 'Compra a Proveedor / Mercadería'
                          ? suppliers[0]?.name || ''
                          : COMMON_SERVICE_BENEFICIARIES.find(
                              (b) => b.category === nextCat
                            )?.name || '';
                      setNewInstForm((prev) => ({
                        ...prev,
                        expenseCategory: nextCat,
                        beneficiaryName: defaultBen || prev.beneficiaryName,
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-orange-50/50 border border-[#FF6600] rounded-lg text-slate-900 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Concepto / Descripción y Monto a Pagar */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Concepto / Descripción *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Luz Local Comercial - Período Septiembre"
                      value={newInstForm.concept}
                      onChange={(e) =>
                        setNewInstForm({
                          ...newInstForm,
                          concept: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Monto a Pagar (ARS) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      step="0.01"
                      placeholder="Ej. 185000.00"
                      value={newInstForm.totalAmount}
                      onChange={(e) =>
                        setNewInstForm({
                          ...newInstForm,
                          totalAmount: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                </div>

                {/* 3. Entidad / Beneficiario (selector de proveedor/empleado/empresa de servicio o texto libre) */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#FF6600]" />
                      <span>
                        Entidad / Beneficiario (Proveedor, Empresa de Servicio o Empleado) *
                      </span>
                    </label>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBeneficiaryMode('selector')}
                        className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                          beneficiaryMode === 'selector'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Selector Rápido
                      </button>
                      <button
                        type="button"
                        onClick={() => setBeneficiaryMode('libre')}
                        className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                          beneficiaryMode === 'libre'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Texto Libre
                      </button>
                    </div>
                  </div>

                  {beneficiaryMode === 'selector' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <select
                        value={newInstForm.beneficiaryName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = suppliers.find(
                            (s) => s.name === val
                          );
                          setNewInstForm((prev) => ({
                            ...prev,
                            beneficiaryName: val,
                            supplierId: matched
                              ? String(matched.id)
                              : prev.supplierId,
                          }));
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      >
                        {beneficiarySuggestions.map((bName, idx) => (
                          <option key={`${bName}-${idx}`} value={bName}>
                            {bName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        value={newInstForm.beneficiaryName}
                        onChange={(e) =>
                          setNewInstForm({
                            ...newInstForm,
                            beneficiaryName: e.target.value,
                          })
                        }
                        placeholder="O escriba aquí el beneficiario..."
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      value={newInstForm.beneficiaryName}
                      onChange={(e) =>
                        setNewInstForm({
                          ...newInstForm,
                          beneficiaryName: e.target.value,
                        })
                      }
                      placeholder="Escriba el nombre del proveedor, empleado, organismo o empresa de servicio..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  )}
                </div>

                {/* 4. Fecha de Vencimiento, N° Comprobante y Estado de Pago */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fecha de Vencimiento *
                    </label>
                    <input
                      type="date"
                      required
                      value={newInstForm.dueDate}
                      onChange={(e) =>
                        setNewInstForm({
                          ...newInstForm,
                          dueDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-orange-50/60 border border-[#FF6600] rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Estado de Pago *
                    </label>
                    <select
                      value={newInstForm.status}
                      onChange={(e) =>
                        setNewInstForm({
                          ...newInstForm,
                          status: e.target.value as
                            | 'Pendiente'
                            | 'Pagado'
                            | 'Parcial'
                            | 'Vencido',
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Pagado">Pagado (Descontar de Caja)</option>
                      <option value="Parcial">Parcial</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      N° Comprobante / Referencia
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. FC-A 0001-0004810"
                      value={newInstForm.docRef}
                      onChange={(e) =>
                        setNewInstForm({
                          ...newInstForm,
                          docRef: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                </div>

                {/* Si el estado es Pagado o Parcial, elegir de qué Caja Chica / Cuenta Bancaria descontar */}
                {(newInstForm.status === 'Pagado' ||
                  newInstForm.status === 'Parcial') && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-emerald-950 mb-1">
                        Caja Chica / Cuenta Bancaria a Descontar *
                      </label>
                      <select
                        value={newInstForm.treasuryAccountId}
                        onChange={(e) =>
                          setNewInstForm({
                            ...newInstForm,
                            treasuryAccountId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-emerald-300 rounded-lg text-slate-900"
                      >
                        {treasuryAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                    {newInstForm.status === 'Parcial' ? (
                      <div>
                        <label className="block text-xs font-bold text-emerald-950 mb-1">
                          Monto Abonado Parcialmente (ARS) *
                        </label>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={newInstForm.paidAmount}
                          onChange={(e) =>
                            setNewInstForm({
                              ...newInstForm,
                              paidAmount: e.target.value,
                            })
                          }
                          placeholder="Ej. 50000.00"
                          className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-emerald-300 rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center text-xs text-emerald-900 font-medium">
                        Se descontará automáticamente el total de la cuenta seleccionada y se registrará en el Reporte de Cashflow.
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Switch / Checkbox: ¿Es un gasto recurrente? (Frecuencia: Mensual, Bimensual, Anual) */}
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newInstForm.isRecurring}
                        onChange={(e) =>
                          setNewInstForm({
                            ...newInstForm,
                            isRecurring: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                      />
                      <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                        <Repeat className="w-3.5 h-3.5 text-indigo-700" />
                        <span>
                          ¿Es un gasto recurrente? (Autoregenerar alerta el próximo período)
                        </span>
                      </span>
                    </label>

                    {newInstForm.isRecurring && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-900">
                          Frecuencia:
                        </span>
                        <select
                          value={newInstForm.recurrenceFrequency}
                          onChange={(e) =>
                            setNewInstForm({
                              ...newInstForm,
                              recurrenceFrequency: e.target
                                .value as ExpenseRecurrenceFrequency,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-bold bg-white border border-indigo-300 rounded-lg text-indigo-950"
                        >
                          {RECURRENCE_FREQUENCIES.map((freq) => (
                            <option key={freq} value={freq}>
                              {freq}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {newInstForm.isRecurring && (
                    <p className="text-[11px] text-indigo-800">
                      Próxima alerta programada automáticamente para el{' '}
                      <strong>
                        {formatIsoToAr(
                          computeNextRecurrenceIsoDate(
                            newInstForm.dueDate,
                            newInstForm.recurrenceFrequency
                          )
                        )}
                      </strong>{' '}
                      ({newInstForm.recurrenceFrequency}).
                    </p>
                  )}
                </div>

                {/* Adjuntar Foto/Imagen de la Boleta o Factura */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adjuntar Boleta / Comprobante de Respaldo (Opcional)
                  </label>
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-[#FF6600] rounded-xl bg-slate-50 hover:bg-orange-50/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Camera className="w-4 h-4 text-[#FF6600]" />
                      <Upload className="w-4 h-4 text-[#FF6600]" />
                      <span>
                        {newInstForm.attachmentName
                          ? `Archivo cargado: ${newInstForm.attachmentName}`
                          : 'Tomar foto de la boleta o subir imagen / PDF'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={handleAttachmentFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setNewInstModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white bg-[#FF6600] hover:bg-[#E65C00] shadow-xs cursor-pointer"
                  >
                    Guardar Vencimiento / Egreso Operativo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDERIZADO MODO 2: MÓDULO / VISTA GENERAL DE PEDIDOS DE TODOS LOS PROVEEDORES
  // =========================================================================
  return (
    <div className="space-y-5">
      {activeVoucherModal && (
        <VoucherActionModal
          voucher={activeVoucherModal.voucher}
          initialTab={activeVoucherModal.tab}
          onClose={() => setActiveVoucherModal(null)}
          formatCurrency={formatCurrency}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Gestión General de Pedidos a Proveedores
            </h3>
            <p className="text-xs text-slate-500">
              Listado unificado de órdenes de compra con descarga de PDF
              membretado, envío por WhatsApp y acreditación rápida de pagos.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToCreateOrder}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Pedido a Proveedor</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Nro. orden, proveedor, SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
            />
          </div>

          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Todos">Proveedor: Todos</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Todos">Estado del Pedido: Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Tránsito">En Tránsito</option>
              <option value="Recibido">Recibido</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="todos">Rango de Fechas: Todos</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Esta Semana</option>
              <option value="mes">Este Mes</option>
              <option value="personalizado">Rango Personalizado...</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
              title="Filtrar por Fecha de Vencimiento de Pago"
              className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            />
            {dueDateFilter && (
              <button
                type="button"
                onClick={() => setDueDateFilter('')}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpiar fecha de vencimiento"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {dateRangePreset === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-xs font-semibold text-slate-600">Desde:</span>
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono border border-slate-200 rounded-lg"
            />
            <span className="text-xs font-semibold text-slate-600">Hasta:</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono border border-slate-200 rounded-lg"
            />
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 select-none">
                {[
                  { key: 'orderNumber', label: 'Nro. Pedido' },
                  { key: 'supplierName', label: 'Proveedor' },
                  { key: 'createdAt', label: 'Fecha Emisión' },
                  { key: 'paymentDueDate', label: 'Vencimiento de Pago' },
                  { key: 'orderStatus', label: 'Estado del Pedido' },
                  { key: 'paymentStatus', label: 'Estado de Pago' },
                  {
                    key: 'totalAmount',
                    label: 'Total / Saldo',
                    align: 'right' as const,
                  },
                ].map((col) => {
                  const isSorted = orderSort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() =>
                        handleSortOrderCol(col.key as OrderSortKey)
                      }
                      className={`py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors ${
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
                        <span>{col.label}</span>
                        {isSorted ? (
                          orderSort.direction === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-4 text-right whitespace-nowrap">
                  Comprobantes y Pagos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {filteredAndSortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No se encontraron pedidos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredAndSortedOrders.map((ord) => {
                  const remaining = Math.max(
                    0,
                    ord.totalAmount - ord.paidAmount
                  );
                  const daysToDue = getDaysDiffFromToday(ord.paymentDueDate);
                  const isOverdue =
                    ord.paymentStatus !== 'Saldado' &&
                    ord.orderStatus !== 'Cancelado' &&
                    daysToDue < 0;

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isOverdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div>{ord.orderNumber}</div>
                        <div className="text-[11px] font-sans font-normal text-slate-500">
                          {ord.itemsCount} art.
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {ord.supplierName}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {formatIsoToAr(ord.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {formatIsoToAr(ord.paymentDueDate)}
                          </span>
                          {isOverdue && <StatusBadge status="SALDO VENCIDO" />}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={ord.orderStatus}
                          onChange={(e) =>
                            onUpdateOrderStatus(
                              ord.id,
                              e.target.value as PurchaseOrderRecord['orderStatus']
                            )
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#FF6600] cursor-pointer"
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Tránsito">En Tránsito</option>
                          <option value="Recibido">Recibido</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={ord.paymentStatus} />
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {formatCurrency(ord.totalAmount)}
                        </div>
                        {remaining > 0 && ord.paymentStatus !== 'Saldado' && (
                          <div className="text-[11px] text-rose-700 font-semibold">
                            Resta: {formatCurrency(remaining)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveVoucherModal({
                                voucher: buildOrderVoucher(ord),
                                tab: 'pdf',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                            title="Descargar PDF / Imprimir Pedido con membrete FERRETERIA DEL PUENTE"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Descargar PDF / Imprimir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveVoucherModal({
                                voucher: buildOrderVoucher(ord),
                                tab: 'whatsapp',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                            title="Enviar Pedido por WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Enviar por WhatsApp</span>
                          </button>

                          {ord.paymentStatus === 'Saldado' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Pagado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openOrderPaymentModal(ord)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-[#FF6600] text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Acreditar / Registrar Pago</span>
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

      {activeOrderForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Acreditar / Registrar Pago de Pedido
                </h4>
                <p className="text-xs text-slate-500">
                  {activeOrderForPayment.orderNumber} —{' '}
                  {activeOrderForPayment.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrderForPayment(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOrderPayment} className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total del Pedido:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(activeOrderForPayment.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo Pendiente:</span>
                  <span className="font-mono font-bold text-rose-700">
                    {formatCurrency(
                      Math.max(
                        0,
                        activeOrderForPayment.totalAmount -
                          activeOrderForPayment.paidAmount
                      )
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Modalidad de Cancelación
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Saldado', 'Parcial'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setOrderPayStatusChoice(st);
                        const rem = Math.max(
                          0,
                          activeOrderForPayment.totalAmount -
                            activeOrderForPayment.paidAmount
                        );
                        setOrderPayAmount(
                          st === 'Saldado'
                            ? rem.toFixed(2)
                            : (rem / 2).toFixed(2)
                        );
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                        orderPayStatusChoice === st
                          ? 'bg-[#FF6600] text-white border-[#FF6600]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {st === 'Saldado' ? 'Pago Total (Saldado)' : 'Pago Parcial'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto a Abonar (ARS) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="0.01"
                    value={orderPayAmount}
                    onChange={(e) => setOrderPayAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Medio de Pago
                  </label>
                  <select
                    value={orderPayMethod}
                    onChange={(e) => setOrderPayMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nota / Referencia
                </label>
                <input
                  type="text"
                  value={orderPayNote}
                  onChange={(e) => setOrderPayNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveOrderForPayment(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingOrderPay}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  {isSavingOrderPay
                    ? 'Acreditando Pago...'
                    : 'Confirmar y Acreditar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
