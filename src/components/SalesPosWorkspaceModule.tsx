import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  FileText,
  Plus,
  X,
  Search,
  Barcode,
  Eye,
  EyeOff,
  UserPlus,
  Building2,
  Lock,
  Unlock,
  KeyRound,
  CreditCard,
  Banknote,
  Landmark,
  Wallet,
  Printer,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Percent,
  Tag,
  Receipt,
  Truck,
  QrCode,
  FileX,
  Split,
} from 'lucide-react';
import {
  ClientItem,
  CommercialDocument,
  ProductItem,
  SupplierItem,
  SystemRoleType,
} from '../types/ferreteria.ts';
import {
  CustomPriceListRule,
  loadCustomPriceLists,
  calculateProductPriceForRule,
} from './PriceListsModule.tsx';
import {
  evaluateClientCreditStatus,
  loadClientCreditMetaMap,
  saveClientCreditMetaMap,
  appendInvoiceToClientLedger,
} from './ClientsModule.tsx';
import {
  VoucherActionModal,
  VoucherDocumentData,
  generateVoucherPdfInstance,
  addDaysToTodayIso,
  formatIsoToAr,
  getTodayIso,
  formatTicketNumber8Digits,
} from './OrdersModule.tsx';
import { PurchasesInvoicesSubView } from './PurchasesInvoicesSubView.tsx';
import {
  TablePaginationBar,
  PageSizeOption,
  paginateArray,
} from './TablePaginationBar.tsx';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PackageCheck,
  Save,
} from 'lucide-react';
import { loadSystemAdminConfig } from './UsersRolesModule.tsx';
import { appendStockMovement } from './ProductsModule.tsx';

export type WorkspaceTabType = 'venta' | 'presupuesto';
export type PaymentMethodType =
  | 'Efectivo'
  | 'Tarjeta de Débito'
  | 'Tarjeta de Crédito'
  | 'Transferencia'
  | 'QR'
  | 'Cuenta Corriente'
  | 'Tarjeta';

export type VoucherOutputModeType =
  | 'Sin ticket'
  | 'Ticket'
  | 'WhatsApp'
  | 'QR';

export type BillingDocType =
  | 'Comprobante Interno'
  | 'Ticket Interno'
  | 'Factura A'
  | 'Factura B'
  | 'Factura C'
  | 'Remito'
  | 'Ticket Fiscal';

export interface CombinedPaymentRow {
  method: PaymentMethodType;
  amount: number;
}

export interface CartItemEntry {
  productId: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  quantity: number;
  finalCostPrice?: number;
  normalPrice?: number; // Precio Normal = Costo Final * 1.60 (editable)
  cardPrice?: number; // Precio Tarjeta = Precio Normal * 1.09
  discountPercent?: number; // Descuento individual (%) por artículo
  baseUnitPrice: number;
  unitPrice: number;
}

export interface ParallelSessionTab {
  id: string;
  title: string; // ej. "Venta #1", "Venta #2", "Presupuesto #1"
  tabType: WorkspaceTabType;
  clientId: number | null; // null = Consumidor Final
  clientName: string;
  clientCuit: string;
  clientPhone: string;
  priceListId: string;
  paymentMethod: PaymentMethodType;
  isCombinedPayment?: boolean;
  combinedPayments?: CombinedPaymentRow[];
  voucherOutputType?: VoucherOutputModeType;
  billingType?: BillingDocType;
  observation?: string;
  discountMode: 'percent' | 'amount';
  discountValue: number;
  validityDays: number;
  adminUnlockedCredit: boolean;
  items: CartItemEntry[];
}

export interface SavedBudgetRecord {
  id: string;
  docNumber: string;
  dateIso: string;
  validUntilIso: string;
  clientId: number | null;
  clientName: string;
  clientCuit: string;
  clientPhone: string;
  priceListId: string;
  priceListName: string;
  discountMode: 'percent' | 'amount';
  discountValue: number;
  totalAmount: number;
  status: 'Borrador' | 'Aceptado' | 'Vencido';
  items: CartItemEntry[];
}

const PARALLEL_TABS_STORAGE_KEY = 'ferreteria_parallel_pos_tabs_v2';
const SAVED_BUDGETS_STORAGE_KEY = 'ferreteria_saved_budgets_list_v1';

function getProductFinalCost(p: ProductItem): number {
  const rawCost = parseFloat(String(p.costPrice || '0')) || 0;
  if (rawCost > 0) return rawCost;
  const rawSale = parseFloat(String(p.salePrice || '0')) || 0;
  return rawSale > 0 ? Number((rawSale / 1.6).toFixed(2)) : 0;
}

function createInitialParallelTabs(
  products: ProductItem[],
  priceLists: CustomPriceListRule[],
  clients: ClientItem[]
): ParallelSessionTab[] {
  const defaultListId =
    priceLists.find((l) => l.id === 'lista-normal')?.id ||
    priceLists[0]?.id ||
    'lista-normal';

  const sampleItems: CartItemEntry[] = products.slice(0, 2).map((p, idx) => {
    const finalCost = getProductFinalCost(p);
    const normalPrice = Number((finalCost * 1.6).toFixed(2));
    const cardPrice = Number((normalPrice * 1.09).toFixed(2));
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      quantity: idx === 0 ? 2 : 1,
      finalCostPrice: finalCost,
      normalPrice,
      cardPrice,
      discountPercent: 0,
      baseUnitPrice: normalPrice,
      unitPrice: normalPrice,
    };
  });

  const secondClient = clients[0];

  return [
    {
      id: 'tab-venta-1',
      title: 'Venta #1',
      tabType: 'venta',
      clientId: null,
      clientName: 'Consumidor Final',
      clientCuit: '00-00000000-0',
      clientPhone: '',
      priceListId: defaultListId,
      paymentMethod: 'Efectivo',
      discountMode: 'percent',
      discountValue: 0,
      validityDays: 15,
      adminUnlockedCredit: false,
      items: sampleItems,
    },
    {
      id: 'tab-venta-2',
      title: 'Venta #2',
      tabType: 'venta',
      clientId: secondClient ? secondClient.id : null,
      clientName: secondClient ? secondClient.name : 'Consumidor Final',
      clientCuit: secondClient ? secondClient.cuit : '00-00000000-0',
      clientPhone: secondClient ? secondClient.phone : '',
      priceListId: defaultListId,
      paymentMethod: 'Transferencia',
      discountMode: 'percent',
      discountValue: 0,
      validityDays: 15,
      adminUnlockedCredit: false,
      items: products.slice(2, 3).map((p) => {
        const finalCost = getProductFinalCost(p);
        const normalPrice = Number((finalCost * 1.6).toFixed(2));
        const cardPrice = Number((normalPrice * 1.09).toFixed(2));
        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          category: p.category,
          quantity: 1,
          finalCostPrice: finalCost,
          normalPrice,
          cardPrice,
          discountPercent: 0,
          baseUnitPrice: normalPrice,
          unitPrice: normalPrice,
        };
      }),
    },
    {
      id: 'tab-presupuesto-1',
      title: 'Presupuesto #1',
      tabType: 'presupuesto',
      clientId: secondClient ? secondClient.id : null,
      clientName: secondClient
        ? secondClient.name
        : 'Constructora del Litoral S.A.',
      clientCuit: secondClient ? secondClient.cuit : '30-71458921-4',
      clientPhone: secondClient ? secondClient.phone : '+54 9 11 4582-9910',
      priceListId: defaultListId,
      paymentMethod: 'Efectivo',
      discountMode: 'percent',
      discountValue: 5,
      validityDays: 15,
      adminUnlockedCredit: false,
      items: products.slice(0, 3).map((p, idx) => {
        const finalCost = getProductFinalCost(p);
        const normalPrice = Number((finalCost * 1.6).toFixed(2));
        const cardPrice = Number((normalPrice * 1.09).toFixed(2));
        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          category: p.category,
          quantity: idx + 1,
          finalCostPrice: finalCost,
          normalPrice,
          cardPrice,
          discountPercent: 0,
          baseUnitPrice: normalPrice,
          unitPrice: normalPrice,
        };
      }),
    },
  ];
}

function loadSavedBudgets(products: ProductItem[]): SavedBudgetRecord[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SAVED_BUDGETS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
  }
  const p1 = products[0];
  const p2 = products[1];
  const baseItems: CartItemEntry[] = [p1, p2].filter(Boolean).map((p, i) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: p.category,
    quantity: i === 0 ? 4 : 2,
    baseUnitPrice: parseFloat(p.salePrice) || 25000,
    unitPrice: parseFloat(p.salePrice) || 25000,
  }));
  const sub = baseItems.reduce((a, b) => a + b.quantity * b.unitPrice, 0);

  return [
    {
      id: 'PRE-0004-000912',
      docNumber: 'PRE-0004-000912',
      dateIso: getTodayIso(),
      validUntilIso: addDaysToTodayIso(15),
      clientId: 1,
      clientName: 'Constructora del Litoral S.A.',
      clientCuit: '30-71234567-9',
      clientPhone: '+54 9 11 5544-3322',
      priceListId: 'lista-mayorista',
      priceListName: 'Lista Mayorista / Gremio',
      discountMode: 'percent',
      discountValue: 5,
      totalAmount: sub * 0.95,
      status: 'Aceptado',
      items: baseItems,
    },
    {
      id: 'PRE-0004-000911',
      docNumber: 'PRE-0004-000911',
      dateIso: addDaysToTodayIso(-3),
      validUntilIso: addDaysToTodayIso(12),
      clientId: null,
      clientName: 'Metalúrgica San Martín S.R.L.',
      clientCuit: '30-68912345-1',
      clientPhone: '+54 9 11 4123-9876',
      priceListId: 'lista-contado',
      priceListName: 'Efectivo / Contado Mostrador',
      discountMode: 'amount',
      discountValue: 10000,
      totalAmount: Math.max(15000, sub - 10000),
      status: 'Borrador',
      items: baseItems,
    },
    {
      id: 'PRE-0004-000895',
      docNumber: 'PRE-0004-000895',
      dateIso: addDaysToTodayIso(-22),
      validUntilIso: addDaysToTodayIso(-7),
      clientId: null,
      clientName: 'Obras Civiles del Sur S.A.',
      clientCuit: '30-70998877-2',
      clientPhone: '+54 9 11 6789-1234',
      priceListId: 'lista-contado',
      priceListName: 'Efectivo / Contado Mostrador',
      discountMode: 'percent',
      discountValue: 0,
      totalAmount: sub,
      status: 'Vencido',
      items: baseItems,
    },
  ];
}

interface SalesPosWorkspaceModuleProps {
  initialViewMode?: 'pos' | 'presupuestos' | 'facturacion' | 'compras';
  initialOperationMode?: 'venta' | 'presupuesto';
  products: ProductItem[];
  clients: ClientItem[];
  suppliers: SupplierItem[];
  documents: CommercialDocument[];
  branchName: string;
  sellerName: string;
  activeSystemRole: SystemRoleType;
  formatCurrency: (val: string | number) => string;
  onDataUpdated: (payload: {
    products?: ProductItem[];
    clients?: ClientItem[];
    suppliers?: SupplierItem[];
    documents?: CommercialDocument[];
    toastMessage?: string;
  }) => void;
  onCycleDocStatus?: (doc: CommercialDocument) => void;
}

export const SalesPosWorkspaceModule: React.FC<SalesPosWorkspaceModuleProps> = ({
  initialViewMode = 'pos',
  initialOperationMode = 'venta',
  products,
  clients,
  suppliers,
  documents,
  branchName,
  sellerName,
  activeSystemRole,
  formatCurrency,
  onDataUpdated,
  onCycleDocStatus,
}) => {
  const priceLists = useMemo(() => loadCustomPriceLists(), []);

  // Sub-module view mode
  const [viewMode, setViewMode] = useState<
    'pos' | 'presupuestos' | 'facturacion' | 'compras'
  >(initialViewMode);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  // Parallel tabs state (Sales & Budgets)
  const [tabs, setTabs] = useState<ParallelSessionTab[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(PARALLEL_TABS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    return createInitialParallelTabs(products, priceLists, clients);
  });

  const [activeTabId, setActiveTabId] = useState<string>(
    () => tabs[0]?.id || 'tab-venta-1'
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PARALLEL_TABS_STORAGE_KEY,
        JSON.stringify(tabs)
      );
    } catch {
      // ignore
    }
  }, [tabs]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  useEffect(() => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              tabType: initialOperationMode,
              operationMode: initialOperationMode,
            }
          : t
      )
    );
  }, [initialOperationMode, activeTabId]);

  // POS Product Search & Filters (Proveedor + Estado de Stock)
  const [barcodeOrTextQuery, setBarcodeOrTextQuery] = useState('');
  const [showFullInventory, setShowFullInventory] = useState(true);
  const [selectedSupplierFilter, setSelectedSupplierFilter] =
    useState<string>('TODOS');
  const [catalogStockFilter, setCatalogStockFilter] = useState<
    'TODOS' | 'CONTROLA_STOCK' | 'SIN_STOCK' | 'EN_CARRITO'
  >('TODOS');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Client selector & Alta Rápida de Cliente por CUIT/CUIL (AFIP / ARCA)
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [quickClientModalOpen, setQuickClientModalOpen] = useState(false);
  const [quickClientCuit, setQuickClientCuit] = useState('');
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientTaxCondition, setQuickClientTaxCondition] = useState<
    'Responsable Inscripto' | 'Monotributista' | 'Exento' | 'Consumidor Final'
  >('Consumidor Final');
  const [quickClientAddress, setQuickClientAddress] = useState('');
  const [quickClientCity, setQuickClientCity] = useState('');
  const [quickClientProvince, setQuickClientProvince] =
    useState('Buenos Aires');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPriceListId, setQuickClientPriceListId] =
    useState<string>('lista-normal');
  const [quickClientHasCredit, setQuickClientHasCredit] =
    useState<boolean>(false);
  const [quickClientCreditLimit, setQuickClientCreditLimit] =
    useState<string>('350000');
  const [quickClientPaymentTermsDays, setQuickClientPaymentTermsDays] =
    useState<number>(30);
  const [quickClientNotes, setQuickClientNotes] = useState<string>('');
  const [isLookingUpAfipCuit, setIsLookingUpAfipCuit] =
    useState<boolean>(false);
  const [afipLookupFeedback, setAfipLookupFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [lastLookedUpCuitDigits, setLastLookedUpCuitDigits] =
    useState<string>('');
  const [isCreatingQuickClient, setIsCreatingQuickClient] = useState(false);
  const clientDropdownContainerRef = useRef<HTMLDivElement | null>(null);

  // Admin Password Authorization & Cuenta Corriente Management Modal
  const [adminPasswordModalOpen, setAdminPasswordModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [adminAccountStatusInput, setAdminAccountStatusInput] = useState<
    'Activa' | 'Bloqueada'
  >('Activa');
  const [adminCreditLimitInput, setAdminCreditLimitInput] =
    useState<string>('1500000');
  const [creditMetaVersion, setCreditMetaVersion] = useState(0);

  // Saved Budgets Table state
  const [savedBudgets, setSavedBudgets] = useState<SavedBudgetRecord[]>(() =>
    loadSavedBudgets(products)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVED_BUDGETS_STORAGE_KEY,
        JSON.stringify(savedBudgets)
      );
    } catch {
      // ignore
    }
  }, [savedBudgets]);

  // Estado para modal QR cuando el comprobante de salida seleccionado es [QR]
  const [completedSalePrompt, setCompletedSalePrompt] = useState<{
    voucher: VoucherDocumentData;
    qrImageUrl?: string;
    publicPdfUrl?: string;
  } | null>(null);
  const [posValidationError, setPosValidationError] = useState<string | null>(
    null
  );
  const [clientAutocompleteOpen, setClientAutocompleteOpen] =
    useState<boolean>(false);

  // Full Voucher PDF / WhatsApp Preview Modal
  const [activeVoucherModal, setActiveVoucherModal] = useState<{
    voucher: VoucherDocumentData;
    tab: 'pdf' | 'whatsapp';
  } | null>(null);

  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Configuración interna de Lista de Precio Normal (Costo Final * 1.60) y Lista Tarjeta (Precio Normal * 1.09)
  const [normalUtilityPct] = useState<number>(60);
  const [cardInterestPct] = useState<number>(9);

  // Estados para ingresar un "Producto No Registrado" (Venta Varia / Venta Libre) directamente al carrito
  const [unregisteredPanelOpen, setUnregisteredPanelOpen] =
    useState<boolean>(false);
  const [unregisteredDescription, setUnregisteredDescription] =
    useState<string>('');
  const [unregisteredFinalPrice, setUnregisteredFinalPrice] =
    useState<string>('');
  const [unregisteredQuantity, setUnregisteredQuantity] = useState<number>(1);

  // Estados para el Modal de Cobro Completo [F8] y Cobro Rápido [F4]
  const [paymentSelectionModalOpen, setPaymentSelectionModalOpen] =
    useState<boolean>(false);
  const [pendingOrderDocNumber, setPendingOrderDocNumber] =
    useState<string>('');
  const [f12RegisteredVoucher, setF12RegisteredVoucher] =
    useState<VoucherDocumentData | null>(null);
  const [customerTenderedAmount, setCustomerTenderedAmount] =
    useState<string>('');
  const [deliverableMode, setDeliverableMode] = useState<
    'Sin comprobante' | 'Ticket 58mm' | 'Factura / Remito' | 'WhatsApp'
  >('Sin comprobante');

  // Estado para el Cuadro de Diálogo Post-Venta (Modal de Ajuste Manual de Stock)
  const [postSaleStockPrompt, setPostSaleStockPrompt] = useState<{
    docNumber: string;
    items: Array<{
      productId: number;
      sku: string;
      name: string;
      supplierName: string;
      soldQuantity: number;
      calculatedSystemStock: number;
      newRealStockInput: string;
    }>;
  } | null>(null);
  const [isSavingPostSaleStock, setIsSavingPostSaleStock] =
    useState<boolean>(false);

  // Helper to update the active tab
  const updateActiveTab = (
    updater: (prevTab: ParallelSessionTab) => ParallelSessionTab
  ) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? updater(t) : t))
    );
  };

  // Calcula Precio Normal (Costo Final * 1.60 editable) y Precio Tarjeta (Precio Normal * 1.09)
  const computeProductNormalAndCardPrices = (
    prod: ProductItem,
    customNormalPrice?: number
  ) => {
    const finalCost = getProductFinalCost(prod);
    const normalPrice =
      customNormalPrice !== undefined && Number.isFinite(customNormalPrice)
        ? customNormalPrice
        : Number((finalCost * (1 + normalUtilityPct / 100)).toFixed(2));
    const cardPrice = Number(
      (normalPrice * (1 + cardInterestPct / 100)).toFixed(2)
    );
    return { finalCost, normalPrice, cardPrice };
  };

  // Listas de precios disponibles en el POS (Normal, Gremio/Mayorista, Tarjeta + personalizadas)
  const posAvailablePriceLists = useMemo(() => {
    const baseLists = [
      { id: 'lista-normal', name: 'Lista Normal (Efectivo)' },
      { id: 'lista-gremio', name: 'Lista Gremio / Mayorista' },
      { id: 'lista-tarjeta', name: `Lista Tarjeta (+${cardInterestPct}%)` },
    ];
    const extraLists = priceLists
      .filter(
        (pl) =>
          pl.id !== 'lista-normal' &&
          pl.id !== 'lista-contado' &&
          pl.id !== 'lista-gremio' &&
          pl.id !== 'lista-mayorista' &&
          pl.id !== 'lista-tarjeta' &&
          pl.id !== 'lista-tarjeta-3c'
      )
      .map((pl) => ({ id: pl.id, name: pl.name }));
    return [...baseLists, ...extraLists];
  }, [priceLists, cardInterestPct]);

  // Helper to compute unit price for a product according to the tab's selected priceListId
  const computePriceForProduct = (
    prod: ProductItem,
    priceListId: string,
    customNormalPrice?: number
  ): number => {
    const { normalPrice, cardPrice } = computeProductNormalAndCardPrices(
      prod,
      customNormalPrice
    );
    if (priceListId === 'lista-normal' || priceListId === 'lista-contado') {
      return normalPrice;
    }
    if (priceListId === 'lista-tarjeta' || priceListId === 'lista-tarjeta-3c') {
      return cardPrice;
    }
    if (priceListId === 'lista-gremio' || priceListId === 'lista-mayorista') {
      const gremioRule = priceLists.find(
        (r) =>
          r.id === priceListId ||
          r.name.toLowerCase().includes('gremio') ||
          r.name.toLowerCase().includes('mayorista')
      );
      if (gremioRule) {
        return calculateProductPriceForRule(prod, gremioRule).finalPrice;
      }
      // 12% descuento gremio/mayorista sobre Lista Normal por defecto
      return Number((normalPrice * 0.88).toFixed(2));
    }
    const rule = priceLists.find((r) => r.id === priceListId);
    if (!rule) return normalPrice;
    const calc = calculateProductPriceForRule(prod, rule);
    return calc.finalPrice;
  };

  // Agregar un "Producto No Registrado" (Venta Varia / Venta Libre) al carrito
  const handleAddUnregisteredProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = unregisteredDescription.trim();
    const priceNum = Number(unregisteredFinalPrice);
    const qtyNum = Math.max(1, Math.trunc(Number(unregisteredQuantity) || 1));

    if (!cleanName) {
      setPosValidationError(
        'Ingrese una descripción o nombre para el Producto No Registrado.'
      );
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setPosValidationError(
        'Ingrese un Precio Final válido mayor a $0 para el Producto No Registrado.'
      );
      return;
    }

    setPosValidationError(null);
    const normalP = Number(priceNum.toFixed(2));
    const cardP = Number((normalP * (1 + cardInterestPct / 100)).toFixed(2));
    const isCardList = activeTab.priceListId === 'lista-tarjeta';
    const activeBase = isCardList ? cardP : normalP;
    const customProductId = -(Date.now() + Math.floor(Math.random() * 1000));

    updateActiveTab((tab) => ({
      ...tab,
      items: [
        ...tab.items,
        {
          productId: customProductId,
          sku: 'LIBRE',
          name: cleanName,
          brand: 'Venta Libre',
          category: 'Varios',
          quantity: qtyNum,
          finalCostPrice: normalP,
          normalPrice: normalP,
          cardPrice: cardP,
          discountPercent: 0,
          baseUnitPrice: activeBase,
          unitPrice: activeBase,
        },
      ],
    }));

    setUnregisteredDescription('');
    setUnregisteredFinalPrice('');
    setUnregisteredQuantity(1);
    setUnregisteredPanelOpen(false);
  };

  // Add a new parallel tab ("Venta #N" or "Presupuesto #N")
  const handleOpenNewParallelTab = (type: WorkspaceTabType) => {
    const countOfType = tabs.filter((t) => t.tabType === type).length + 1;
    const newId = `tab-${type}-${Date.now()}`;
    const newTitle =
      type === 'venta'
        ? `Venta #${countOfType}`
        : `Presupuesto #${countOfType}`;
    const defaultListId =
      priceLists.find((l) => l.id === 'lista-normal')?.id ||
      priceLists[0]?.id ||
      'lista-normal';

    const newTab: ParallelSessionTab = {
      id: newId,
      title: newTitle,
      tabType: type,
      clientId: null,
      clientName: 'Consumidor Final',
      clientCuit: '00-00000000-0',
      clientPhone: '',
      priceListId: defaultListId,
      paymentMethod: 'Efectivo',
      discountMode: 'percent',
      discountValue: 0,
      validityDays: 15,
      adminUnlockedCredit: false,
      items: [],
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setViewMode('pos');
  };

  const handleCloseParallelTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      updateActiveTab((t) => ({
        ...t,
        items: [],
        clientId: null,
        clientName: 'Consumidor Final',
        clientCuit: '00-00000000-0',
        discountValue: 0,
        adminUnlockedCredit: false,
      }));
      return;
    }
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Add product to active tab cart
  const handleAddProductToCart = (prod: ProductItem) => {
    const { finalCost, normalPrice, cardPrice } =
      computeProductNormalAndCardPrices(prod);
    const baseListPrice =
      activeTab.priceListId === 'lista-tarjeta'
        ? cardPrice
        : activeTab.priceListId === 'lista-normal'
        ? normalPrice
        : computePriceForProduct(prod, activeTab.priceListId);

    updateActiveTab((tab) => {
      const existing = tab.items.find((i) => i.productId === prod.id);
      if (existing) {
        const disc = Math.min(100, Math.max(0, existing.discountPercent || 0));
        return {
          ...tab,
          items: tab.items.map((i) =>
            i.productId === prod.id
              ? {
                  ...i,
                  quantity: i.quantity + 1,
                  unitPrice: Number(
                    (baseListPrice * (1 - disc / 100)).toFixed(2)
                  ),
                }
              : i
          ),
        };
      }
      return {
        ...tab,
        items: [
          ...tab.items,
          {
            productId: prod.id,
            sku: prod.sku,
            name: prod.name,
            brand: prod.brand,
            category: prod.category,
            quantity: 1,
            finalCostPrice: finalCost,
            normalPrice,
            cardPrice,
            discountPercent: 0,
            baseUnitPrice: baseListPrice,
            unitPrice: baseListPrice,
          },
        ],
      };
    });
  };

  // Barcode / Quick Search Enter handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeOrTextQuery.trim()) {
      e.preventDefault();
      const q = barcodeOrTextQuery.trim().toLowerCase();
      const exactMatch =
        products.find((p) => p.sku.toLowerCase() === q) ||
        products.find(
          (p) =>
            p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
        );
      if (exactMatch) {
        handleAddProductToCart(exactMatch);
        setBarcodeOrTextQuery('');
      }
    }
  };

  // Paginación y ordenamiento para el Catálogo Rápido del POS
  const [posCatalogSort, setPosCatalogSort] = useState<{
    key: 'sku' | 'name' | 'stock' | 'price' | null;
    direction: 'asc' | 'desc';
  }>({
    key: null,
    direction: 'asc',
  });
  const [posCatalogPage, setPosCatalogPage] = useState<number>(1);
  const [posCatalogPageSize, setPosCatalogPageSize] =
    useState<PageSizeOption>(20);

  // Paginación y ordenamiento para la tabla de Presupuestos
  const [budgetsSort, setBudgetsSort] = useState<{
    key: 'docNumber' | 'dateIso' | 'clientName' | 'totalAmount' | 'status' | null;
    direction: 'asc' | 'desc';
  }>({
    key: null,
    direction: 'asc',
  });
  const [budgetsPage, setBudgetsPage] = useState<number>(1);
  const [budgetsPageSize, setBudgetsPageSize] = useState<PageSizeOption>(20);

  useEffect(() => {
    setPosCatalogPage(1);
  }, [barcodeOrTextQuery]);

  const handleSortPosCatalog = (
    key: 'sku' | 'name' | 'stock' | 'price'
  ) => {
    setPosCatalogSort((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSortBudgets = (
    key: 'docNumber' | 'dateIso' | 'clientName' | 'totalAmount' | 'status'
  ) => {
    setBudgetsSort((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    });
    products.forEach((p) => {
      if (p.supplierName && p.supplierName.trim()) {
        set.add(p.supplierName.trim());
      }
      if (Array.isArray(p.associatedSuppliers)) {
        p.associatedSuppliers.forEach((sup) => {
          if (sup && sup.trim()) set.add(sup.trim());
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [suppliers, products]);

  useEffect(() => {
    setPosCatalogPage(1);
  }, [selectedSupplierFilter, catalogStockFilter]);

  const quickSearchProducts = useMemo(() => {
    const q = barcodeOrTextQuery.trim().toLowerCase();
    const cartProductIds = new Set(activeTab.items.map((i) => i.productId));

    const filtered = products.filter((p) => {
      // 1. Filtro por Proveedor
      if (selectedSupplierFilter !== 'TODOS') {
        const mainSup = (p.supplierName || '').trim();
        const assocSups = Array.isArray(p.associatedSuppliers)
          ? p.associatedSuppliers.map((s) => s.trim())
          : [];
        if (
          mainSup !== selectedSupplierFilter &&
          !assocSups.includes(selectedSupplierFilter)
        ) {
          return false;
        }
      }

      // 2. Filtro por Estado de Stock ("Todos", "Controla Stock", "No controla stock / Sin stock", "En carrito")
      const stockVal = Number(p.stock ?? 0);
      const tracksStock = p.trackStock !== false;
      if (catalogStockFilter === 'CONTROLA_STOCK') {
        if (!tracksStock || stockVal <= 0) return false;
      } else if (catalogStockFilter === 'SIN_STOCK') {
        if (tracksStock && stockVal > 0) return false;
      } else if (catalogStockFilter === 'EN_CARRITO') {
        if (!cartProductIds.has(p.id)) return false;
      }

      // 3. Búsqueda por texto / código de barras / SKU / marca / proveedor
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q))
      );
    });

    if (!posCatalogSort.key) return filtered;

    return [...filtered].sort((a, b) => {
      const dir = posCatalogSort.direction === 'asc' ? 1 : -1;
      const key = posCatalogSort.key!;
      if (key === 'stock') {
        return ((a.stock ?? 0) - (b.stock ?? 0)) * dir;
      }
      if (key === 'price') {
        const pA = computeProductNormalAndCardPrices(a).normalPrice;
        const pB = computeProductNormalAndCardPrices(b).normalPrice;
        return (pA - pB) * dir;
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
    barcodeOrTextQuery,
    selectedSupplierFilter,
    catalogStockFilter,
    activeTab.items,
    posCatalogSort,
    normalUtilityPct,
    cardInterestPct,
  ]);

  const {
    paginatedItems: paginatedQuickSearchProducts,
    safePage: safePosCatalogPage,
  } = useMemo(
    () =>
      paginateArray(quickSearchProducts, posCatalogPage, posCatalogPageSize),
    [quickSearchProducts, posCatalogPage, posCatalogPageSize]
  );

  const sortedSavedBudgets = useMemo(() => {
    if (!budgetsSort.key) return savedBudgets;
    return [...savedBudgets].sort((a, b) => {
      const dir = budgetsSort.direction === 'asc' ? 1 : -1;
      const key = budgetsSort.key!;
      if (key === 'totalAmount') {
        return (a.totalAmount - b.totalAmount) * dir;
      }
      const strA = String((a as any)[key] || '');
      const strB = String((b as any)[key] || '');
      return (
        strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' }) *
        dir
      );
    });
  }, [savedBudgets, budgetsSort]);

  const { paginatedItems: paginatedSavedBudgets, safePage: safeBudgetsPage } =
    useMemo(
      () => paginateArray(sortedSavedBudgets, budgetsPage, budgetsPageSize),
      [sortedSavedBudgets, budgetsPage, budgetsPageSize]
    );

  // Handle changing Price List on the active tab (recalculates prices of cart items and syncs paymentMethod)
  const handleSelectPriceList = (newPriceListId: string) => {
    const nextPaymentMethod: PaymentMethodType =
      newPriceListId === 'lista-tarjeta' ||
      newPriceListId === 'lista-tarjeta-3c'
        ? 'Tarjeta'
        : newPriceListId === 'lista-cta-cte'
        ? 'Cuenta Corriente'
        : 'Efectivo';

    updateActiveTab((tab) => ({
      ...tab,
      priceListId: newPriceListId,
      paymentMethod: nextPaymentMethod,
      items: tab.items.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const normalP =
          item.normalPrice ??
          (prod
            ? computeProductNormalAndCardPrices(prod).normalPrice
            : item.baseUnitPrice);
        const cardP = Number(
          (normalP * (1 + cardInterestPct / 100)).toFixed(2)
        );
        const baseListPrice =
          newPriceListId === 'lista-tarjeta'
            ? cardP
            : newPriceListId === 'lista-normal'
            ? normalP
            : prod
            ? computePriceForProduct(prod, newPriceListId, normalP)
            : normalP;
        const disc = Math.min(100, Math.max(0, item.discountPercent || 0));
        return {
          ...item,
          normalPrice: normalP,
          cardPrice: cardP,
          baseUnitPrice: baseListPrice,
          unitPrice: Number((baseListPrice * (1 - disc / 100)).toFixed(2)),
        };
      }),
    }));
  };

  // Close client dropdown when clicking outside
  useEffect(() => {
    const handleClickOutsideClientDropdown = (event: MouseEvent) => {
      if (
        clientDropdownContainerRef.current &&
        !clientDropdownContainerRef.current.contains(event.target as Node)
      ) {
        setClientAutocompleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideClientDropdown);
    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutsideClientDropdown
      );
  }, []);

  // Lista completa de clientes ordenada alfabéticamente (A-Z) y filtrada si hay búsqueda
  const sortedFilteredClients = useMemo(() => {
    const sorted = [...clients].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cuit.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [clients, clientSearchQuery]);

  // Evaluate selected client's Cuenta Corriente status
  const selectedClientObj = useMemo(
    () =>
      activeTab.clientId
        ? clients.find((c) => c.id === activeTab.clientId) || null
        : null,
    [clients, activeTab.clientId]
  );

  const selectedClientCreditEvaluation = useMemo(() => {
    if (!selectedClientObj) return null;
    const metaMap = loadClientCreditMetaMap(clients);
    return evaluateClientCreditStatus(
      selectedClientObj,
      metaMap[selectedClientObj.id]
    );
  }, [selectedClientObj, clients, creditMetaVersion]);

  // Saldo actual y estado de Cuenta Corriente del cliente seleccionado
  const selectedClientCurrentBalance = useMemo(() => {
    if (!selectedClientObj) return 0;
    const evalBal = selectedClientCreditEvaluation?.balanceNum;
    if (typeof evalBal === 'number' && evalBal > 0) return evalBal;
    return Math.max(
      0,
      parseFloat(String(selectedClientObj.balance || '0')) || 0
    );
  }, [selectedClientObj, selectedClientCreditEvaluation]);

  const isCuentaCorrienteBlocked = useMemo(() => {
    if (activeTab.adminUnlockedCredit) return false;
    if (!selectedClientObj) return true;
    if (!selectedClientCreditEvaluation) return true;
    return selectedClientCreditEvaluation.isBlocked;
  }, [
    activeTab.adminUnlockedCredit,
    selectedClientObj,
    selectedClientCreditEvaluation,
  ]);

  // Color y etiqueta del Estado de Cuenta Corriente:
  // Verde: Al día / Sin deuda
  // Amarillo: Saldo pendiente
  // Rojo: Cuenta morosa / Bloqueada / Límite superado
  const selectedClientAccountColorTier = useMemo<
    'emerald' | 'amber' | 'rose'
  >(() => {
    if (isCuentaCorrienteBlocked) return 'rose';
    if (
      selectedClientCurrentBalance > 0 ||
      selectedClientCreditEvaluation?.isNearLimit
    ) {
      return 'amber';
    }
    return 'emerald';
  }, [
    isCuentaCorrienteBlocked,
    selectedClientCurrentBalance,
    selectedClientCreditEvaluation,
  ]);

  const selectedClientAccountStatusLabel = useMemo(() => {
    if (!selectedClientCreditEvaluation) return 'Al día · Sin deuda';
    if (isCuentaCorrienteBlocked) {
      return (
        selectedClientCreditEvaluation.blockReasons[0] ||
        'Cuenta Bloqueada / Límite Superado'
      );
    }
    if (selectedClientCurrentBalance > 0) {
      return selectedClientCreditEvaluation.isNearLimit
        ? 'Saldo Pendiente (Próximo al Límite)'
        : 'Activa · Saldo Pendiente';
    }
    return 'Activa · Al Día (Sin Deuda)';
  }, [
    selectedClientCreditEvaluation,
    isCuentaCorrienteBlocked,
    selectedClientCurrentBalance,
  ]);

  const selectedClientHasCuentaCorriente = useMemo(() => {
    if (!selectedClientObj) return false;
    return Boolean(
      selectedClientObj.id ||
        selectedClientCurrentBalance > 0 ||
        (selectedClientCreditEvaluation &&
          selectedClientCreditEvaluation.creditLimit > 0) ||
        activeTab.paymentMethod === 'Cuenta Corriente'
    );
  }, [
    selectedClientObj,
    selectedClientCurrentBalance,
    selectedClientCreditEvaluation,
    activeTab.paymentMethod,
  ]);

  // Abrir modal de Gestión / Desbloqueo de Cuenta Corriente (Administrador)
  const handleOpenAdminCreditModal = () => {
    const currentBlocked = Boolean(
      selectedClientCreditEvaluation?.isBlocked &&
        !activeTab.adminUnlockedCredit
    );
    const currentLimit =
      selectedClientCreditEvaluation?.creditLimit &&
      selectedClientCreditEvaluation.creditLimit > 0
        ? selectedClientCreditEvaluation.creditLimit
        : 1500000;
    setAdminAccountStatusInput(currentBlocked ? 'Activa' : 'Activa');
    setAdminCreditLimitInput(String(currentLimit));
    setAdminPasswordError('');
    setAdminPasswordModalOpen(true);
  };

  // Acción rápida: "Imprimir el Total de Cuenta Corriente" en formato Térmica 58mm Blanco y Negro de alto contraste
  const handlePrintClientAccountTotalBalance = () => {
    if (!selectedClientObj) return;
    const nowStr = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const balanceVal = selectedClientCurrentBalance;
    const statusLabel = selectedClientAccountStatusLabel;
    const ticketNum8 = formatTicketNumber8Digits(
      `${String(selectedClientObj.id).padStart(4, '0')}-${Date.now()
        .toString()
        .slice(-4)}`
    );

    const htmlTicket = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket Cuenta Corriente ${ticketNum8}</title>
  <style>
    @page { size: 58mm auto; margin: 1.5mm; }
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
      font-family: 'Courier New', Courier, monospace;
      width: 53mm;
      max-width: 53mm;
      color: #000000 !important;
      background: #ffffff !important;
      font-size: 10px;
      line-height: 1.3;
      overflow-x: hidden;
    }
    .sep {
      text-align: center;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <div style="padding:2px 1px;">
    <div style="text-align:center;">
      <div style="font-weight:900;font-size:12px;">FERRETERIA DEL PUENTE</div>
      <div style="font-size:9.5px;">Av. San Martín 1450 · Tel: 4582-9100</div>
      <div style="font-weight:900;font-size:10px;margin-top:2px;">RESUMEN CUENTA CORRIENTE</div>
      <div style="font-weight:900;font-size:11px;margin-top:2px;">TICKET N°: ${ticketNum8}</div>
      <div style="font-size:9.5px;">Fecha/Hora: ${nowStr}</div>
    </div>
    <div class="sep">--------------------------------</div>
    <div style="font-size:9.5px;line-height:1.35;">
      <div><strong>Cliente:</strong> ${selectedClientObj.name}</div>
      <div><strong>CUIT/DNI:</strong> ${selectedClientObj.cuit || '00-00000000-0'}</div>
      ${selectedClientObj.phone && selectedClientObj.phone !== '-' ? `<div><strong>Teléfono:</strong> ${selectedClientObj.phone}</div>` : ''}
      <div><strong>Estado:</strong> ${statusLabel}</div>
    </div>
    <div class="sep">********************************</div>
    <div style="padding:4px 2px;text-align:center;">
      <div style="font-size:9.5px;font-weight:900;text-transform:uppercase;">
        SALDO TOTAL ACTUALIZADO CTA. CTE.
      </div>
      <div style="font-size:14px;font-weight:900;margin-top:3px;">
        ${formatCurrency(balanceVal)}
      </div>
    </div>
    <div class="sep">********************************</div>
    <div style="text-align:center;font-size:9px;font-weight:700;">
      Comprobante Térmico 58mm
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
      }
    } catch {
      // ignore iframe print fallback
    }

    const accountSummaryVoucher: VoucherDocumentData = {
      docNumber: ticketNum8,
      docType: 'Resumen de Cuenta Corriente',
      dateFormatted: nowStr,
      issueDate: formatIsoToAr(getTodayIso()),
      recipientRoleLabel: 'Titular de Cuenta Corriente',
      partyLabel: 'Titular de Cuenta Corriente',
      partyName: selectedClientObj.name,
      partyCuit: selectedClientObj.cuit || '00-00000000-0',
      partyPhone:
        selectedClientObj.phone && selectedClientObj.phone !== '-'
          ? selectedClientObj.phone
          : '',
      supplierName: selectedClientObj.name,
      supplierCuit: selectedClientObj.cuit || '00-00000000-0',
      supplierPhone:
        selectedClientObj.phone && selectedClientObj.phone !== '-'
          ? selectedClientObj.phone
          : '',
      branchName,
      operatorName: sellerName,
      status: statusLabel,
      paymentMethod: 'Cuenta Corriente Comercial',
      notes:
        'Comprobante oficial que informa exclusivamente el Saldo Adeudado Total Acumulado en Cuenta Corriente a la fecha.',
      clientAccountTotalBalance: balanceVal,
      items: [
        {
          sku: 'SALDO-CTA-CTE',
          name: 'SALDO TOTAL ADEUDADO ACUMULADO EN CUENTA CORRIENTE',
          description: 'Saldo total acumulado adeudado a la fecha',
          quantity: 1,
          unitCost: balanceVal,
          unitPrice: balanceVal,
          subtotal: balanceVal,
        },
      ],
      totalAmount: balanceVal,
    };

    setActiveVoucherModal({
      voucher: accountSummaryVoucher,
      tab: 'pdf',
    });
  };

  // Totals calculation for active tab (incluyendo descuentos % individuales de cada artículo y Descuento Total global)
  const cartNormalTotal = useMemo(
    () =>
      activeTab.items.reduce((acc, item) => {
        const normalP = item.normalPrice ?? item.baseUnitPrice;
        const disc = Math.min(100, Math.max(0, item.discountPercent || 0));
        return acc + item.quantity * normalP * (1 - disc / 100);
      }, 0),
    [activeTab.items]
  );

  const cartCardTotal = useMemo(
    () =>
      activeTab.items.reduce((acc, item) => {
        const normalP = item.normalPrice ?? item.baseUnitPrice;
        const cardP =
          item.cardPrice ??
          Number((normalP * (1 + cardInterestPct / 100)).toFixed(2));
        const disc = Math.min(100, Math.max(0, item.discountPercent || 0));
        return acc + item.quantity * cardP * (1 - disc / 100);
      }, 0),
    [activeTab.items, cardInterestPct]
  );

  const cartSubtotal = useMemo(
    () =>
      activeTab.items.reduce(
        (acc, item) => acc + item.quantity * item.unitPrice,
        0
      ),
    [activeTab.items]
  );

  const cartDiscountAmount = useMemo(() => {
    if (activeTab.discountValue <= 0) return 0;
    if (activeTab.discountMode === 'percent') {
      const pct = Math.min(100, Math.max(0, activeTab.discountValue));
      return Number((cartSubtotal * (pct / 100)).toFixed(2));
    }
    return Math.min(cartSubtotal, Math.max(0, activeTab.discountValue));
  }, [cartSubtotal, activeTab.discountMode, activeTab.discountValue]);

  const cartFinalTotal = Math.max(
    0,
    Number((cartSubtotal - cartDiscountAmount).toFixed(2))
  );

  // Abrir modal de "Alta Rápida de Cliente por CUIT/CUIL" (F9 o botón "+")
  const handleOpenClientCreationModal = (prefillInput?: string) => {
    const cleanInput = (prefillInput || '').trim();
    const digitsOnly = cleanInput.replace(/\D/g, '');
    setAfipLookupFeedback(null);
    setLastLookedUpCuitDigits('');
    setQuickClientPriceListId(activeTab.priceListId || 'lista-normal');
    setQuickClientHasCredit(false);
    setQuickClientCreditLimit('350000');
    setQuickClientPaymentTermsDays(30);
    setQuickClientNotes('');

    if (digitsOnly.length >= 7 && digitsOnly.length <= 11) {
      setQuickClientCuit(cleanInput);
      setQuickClientName('');
      setTimeout(() => {
        void handleLookupAfipCuit(cleanInput);
      }, 60);
    } else if (cleanInput) {
      setQuickClientName(cleanInput);
      setQuickClientCuit('');
    } else {
      setQuickClientCuit('');
      setQuickClientName('');
    }
    setClientAutocompleteOpen(false);
    setQuickClientModalOpen(true);
  };

  // Consulta automática al padrón público de AFIP / ARCA por CUIT / CUIL / DNI
  const handleLookupAfipCuit = async (rawCuitInput?: string) => {
    const targetInput =
      rawCuitInput !== undefined ? rawCuitInput : quickClientCuit;
    const digits = String(targetInput || '').replace(/\D/g, '');
    if (digits.length < 7) {
      setAfipLookupFeedback({
        type: 'error',
        message:
          'Ingrese un CUIT/CUIL válido de 11 dígitos (o DNI de 7-8 dígitos) para consultar en AFIP / ARCA.',
      });
      return;
    }

    setIsLookingUpAfipCuit(true);
    setAfipLookupFeedback(null);
    try {
      const res = await fetch(
        `/api/afip/cuit-lookup?cuit=${encodeURIComponent(digits)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudo consultar el padrón de AFIP / ARCA'
        );
      }

      const formattedCuit = data.cuitCuil || targetInput;
      const razonSocial = data.razonSocial || '';
      const rawIva = String(data.condicionIva || 'Consumidor Final');
      const normalizedIva:
        | 'Responsable Inscripto'
        | 'Monotributista'
        | 'Exento'
        | 'Consumidor Final' = rawIva
        .toLowerCase()
        .includes('inscripto')
        ? 'Responsable Inscripto'
        : rawIva.toLowerCase().includes('monotrib')
        ? 'Monotributista'
        : rawIva.toLowerCase().includes('exento')
        ? 'Exento'
        : 'Consumidor Final';

      setQuickClientCuit(formattedCuit);
      setLastLookedUpCuitDigits(digits);
      if (razonSocial) setQuickClientName(razonSocial);
      setQuickClientTaxCondition(normalizedIva);
      if (data.direccion) setQuickClientAddress(data.direccion);
      if (data.localidad) setQuickClientCity(data.localidad);
      if (data.provincia) setQuickClientProvince(data.provincia);
      if (data.telefono && data.telefono !== '-') {
        setQuickClientPhone(data.telefono);
      }
      if (data.email && data.email !== '-') {
        setQuickClientEmail(data.email);
      }

      setAfipLookupFeedback({
        type: 'success',
        message: `Padrón AFIP / ARCA verificado: ${razonSocial} · ${normalizedIva} (${
          data.localidad || 'Argentina'
        })`,
      });
    } catch (err: any) {
      setAfipLookupFeedback({
        type: 'error',
        message:
          err.message ||
          'No se encontró información en el padrón AFIP / ARCA para ese CUIT.',
      });
    } finally {
      setIsLookingUpAfipCuit(false);
    }
  };

  // Guardar y Asignar Cliente a la Venta Actual del POS
  const handleCreateQuickClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientName.trim()) return;

    setIsCreatingQuickClient(true);
    try {
      const selectedListObj =
        posAvailablePriceLists.find((p) => p.id === quickClientPriceListId) ||
        posAvailablePriceLists[0];
      const enableCredit = Boolean(quickClientHasCredit);
      const creditLimitNum = enableCredit
        ? Math.max(0, Number(quickClientCreditLimit) || 350000)
        : 0;
      const paymentTermsNum = enableCredit
        ? Math.max(1, Number(quickClientPaymentTermsDays) || 30)
        : 0;
      const estadoCreditoVal: 'Habilitado' | 'Excedido' | 'Bloqueado' =
        enableCredit ? 'Habilitado' : 'Bloqueado';

      const payload = {
        name: quickClientName.trim(),
        razonSocial: quickClientName.trim(),
        cuit: quickClientCuit.trim() || '00-00000000-0',
        cuitCuil: quickClientCuit.trim() || '00-00000000-0',
        taxCondition: quickClientTaxCondition,
        condicionIva: quickClientTaxCondition,
        direccion: quickClientAddress.trim(),
        localidad: quickClientCity.trim(),
        provincia: quickClientProvince.trim(),
        phone: quickClientPhone.trim() || '-',
        telefono: quickClientPhone.trim() || '-',
        email: quickClientEmail.trim() || '-',
        balance: '0.00',
        saldoActual: 0,
        priceList: selectedListObj.name,
        listaPreciosId: quickClientPriceListId,
        habilitaCuentaCorriente: enableCredit,
        limiteCredito: creditLimitNum,
        plazoDiasPago: paymentTermsNum,
        estadoCredito: estadoCreditoVal,
        notas: quickClientNotes.trim(),
      };

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear cliente');

      const createdClient: ClientItem = {
        ...data.created,
        razonSocial: payload.razonSocial,
        cuitCuil: payload.cuitCuil,
        condicionIva: payload.condicionIva,
        direccion: payload.direccion,
        localidad: payload.localidad,
        provincia: payload.provincia,
        telefono: payload.telefono,
        listaPreciosId: payload.listaPreciosId,
        habilitaCuentaCorriente: payload.habilitaCuentaCorriente,
        limiteCredito: payload.limiteCredito,
        plazoDiasPago: payload.plazoDiasPago,
        saldoActual: 0,
        estadoCredito: payload.estadoCredito,
        notas: payload.notas,
      };

      const updatedClientsList: ClientItem[] = (data.clients || clients).map(
        (c: ClientItem) => (c.id === createdClient.id ? createdClient : c)
      );

      const metaMap = loadClientCreditMetaMap(updatedClientsList);
      metaMap[createdClient.id] = {
        creditLimit: creditLimitNum,
        limiteCredito: creditLimitNum,
        paymentTermsDays: paymentTermsNum,
        paymentTermDays: paymentTermsNum,
        plazoDiasPago: paymentTermsNum,
        manualCreditBlocked: !enableCredit,
        estadoCredito: estadoCreditoVal,
        razonSocial: createdClient.razonSocial,
        cuitCuil: createdClient.cuitCuil,
        condicionIva: createdClient.condicionIva,
        direccion: createdClient.direccion,
        localidad: createdClient.localidad,
        provincia: createdClient.provincia,
        telefono: createdClient.telefono,
        email: createdClient.email,
        listaPreciosId: createdClient.listaPreciosId,
        habilitaCuentaCorriente: enableCredit,
        saldoActual: 0,
        notas: createdClient.notas,
        invoices: [],
        receipts: [],
        historicalVolumeBonus: 0,
      };
      saveClientCreditMetaMap(metaMap);

      const suggestedBillingType =
        quickClientTaxCondition === 'Responsable Inscripto'
          ? 'Factura A'
          : 'Factura B';

      // Seleccionar cliente en la venta actual, ajustar comprobante sugerido y aplicar su Lista de Precios asignada
      updateActiveTab((tab) => ({
        ...tab,
        clientId: createdClient.id,
        clientName: createdClient.name,
        clientCuit: createdClient.cuit,
        clientPhone: createdClient.phone !== '-' ? createdClient.phone : '',
        billingType: suggestedBillingType,
        priceListId: quickClientPriceListId,
        paymentMethod: enableCredit
          ? 'Cuenta Corriente'
          : quickClientPriceListId === 'lista-tarjeta'
          ? 'Tarjeta'
          : tab.paymentMethod === 'Cuenta Corriente'
          ? 'Efectivo'
          : tab.paymentMethod,
        adminUnlockedCredit: enableCredit,
        items: tab.items.map((item) => {
          const prod = products.find((p) => p.id === item.productId);
          const normalP =
            item.normalPrice ??
            (prod
              ? computeProductNormalAndCardPrices(prod).normalPrice
              : item.baseUnitPrice);
          const cardP = Number(
            (normalP * (1 + cardInterestPct / 100)).toFixed(2)
          );
          const baseListPrice =
            quickClientPriceListId === 'lista-tarjeta'
              ? cardP
              : quickClientPriceListId === 'lista-normal'
              ? normalP
              : prod
              ? computePriceForProduct(prod, quickClientPriceListId, normalP)
              : normalP;
          const disc = Math.min(100, Math.max(0, item.discountPercent || 0));
          return {
            ...item,
            normalPrice: normalP,
            cardPrice: cardP,
            baseUnitPrice: baseListPrice,
            unitPrice: Number((baseListPrice * (1 - disc / 100)).toFixed(2)),
          };
        }),
      }));

      onDataUpdated({
        clients: updatedClientsList,
        toastMessage: `Cliente "${createdClient.name}" (${createdClient.cuit}) guardado y asignado a la venta (${suggestedBillingType} · ${selectedListObj.name}).`,
      });

      setQuickClientName('');
      setQuickClientPhone('');
      setQuickClientCuit('');
      setQuickClientEmail('');
      setQuickClientAddress('');
      setQuickClientCity('');
      setQuickClientProvince('Buenos Aires');
      setQuickClientHasCredit(false);
      setQuickClientNotes('');
      setAfipLookupFeedback(null);
      setQuickClientModalOpen(false);
    } catch (err: any) {
      onDataUpdated({
        toastMessage: err.message || 'No se pudo crear el cliente',
      });
    } finally {
      setIsCreatingQuickClient(false);
    }
  };

  // Gestionar / Desbloquear Cuenta Corriente con Contraseña de Administrador (Estado Activa/Bloqueada y Límite de Crédito)
  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = adminPasswordInput.trim();
    if (!clean) {
      setAdminPasswordError('Ingrese la contraseña de Administrador.');
      return;
    }
    if (
      clean === 'admin123' ||
      clean === 'admin' ||
      clean === '1234' ||
      clean.toLowerCase() === 'ferreteria'
    ) {
      const nextStatusIsActive = adminAccountStatusInput === 'Activa';
      const parsedLimit = Math.max(0, Number(adminCreditLimitInput) || 0);
      const effectiveLimit = nextStatusIsActive
        ? Math.max(parsedLimit, selectedClientCurrentBalance + 100000, 350000)
        : parsedLimit;

      if (selectedClientObj) {
        const metaMap = loadClientCreditMetaMap(clients);
        const existingMeta = metaMap[selectedClientObj.id];
        metaMap[selectedClientObj.id] = {
          ...(existingMeta || {
            invoices: [],
            receipts: [],
            historicalVolumeBonus: 0,
          }),
          creditLimit: effectiveLimit,
          paymentTermDays: Math.max(existingMeta?.paymentTermDays || 0, 30),
          manualCreditBlocked: !nextStatusIsActive,
        };
        saveClientCreditMetaMap(metaMap);
        setCreditMetaVersion((v) => v + 1);
      }

      updateActiveTab((tab) => ({
        ...tab,
        adminUnlockedCredit: nextStatusIsActive,
        paymentMethod: nextStatusIsActive
          ? 'Cuenta Corriente'
          : tab.paymentMethod === 'Cuenta Corriente'
          ? 'Efectivo'
          : tab.paymentMethod,
      }));
      setAdminPasswordInput('');
      setAdminPasswordError('');
      setAdminPasswordModalOpen(false);
      onDataUpdated({
        toastMessage: nextStatusIsActive
          ? `Cuenta Corriente configurada como ACTIVA (Límite disponible: ${formatCurrency(
              effectiveLimit
            )}).`
          : `Cuenta Corriente configurada como BLOQUEADA por el Administrador.`,
      });
    } else {
      setAdminPasswordError(
        'Contraseña incorrecta. (Clave autorizada de demostración: admin123)'
      );
    }
  };

  // Emit Budget / Quote (Presupuesto)
  const handleEmitBudget = async (openWhatsAppDirectly: boolean) => {
    if (activeTab.items.length === 0) return;

    const docNumber = `PRE-0004-${Math.floor(100000 + Math.random() * 899999)}`;
    const todayIso = getTodayIso();
    const validUntilIso = addDaysToTodayIso(activeTab.validityDays || 15);
    const listObj = priceLists.find((l) => l.id === activeTab.priceListId);

    const newBudget: SavedBudgetRecord = {
      id: docNumber,
      docNumber,
      dateIso: todayIso,
      validUntilIso,
      clientId: activeTab.clientId,
      clientName: activeTab.clientName || 'Consumidor Final',
      clientCuit: activeTab.clientCuit || '00-00000000-0',
      clientPhone: activeTab.clientPhone || '',
      priceListId: activeTab.priceListId,
      priceListName: listObj?.name || 'Lista de Precio Normal',
      discountMode: activeTab.discountMode,
      discountValue: activeTab.discountValue,
      totalAmount: cartFinalTotal,
      status: 'Borrador',
      items: activeTab.items,
    };

    setSavedBudgets((prev) => [newBudget, ...prev]);

    try {
      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNumber,
          docType: 'Presupuesto',
          clientId: activeTab.clientId,
          clientName: newBudget.clientName,
          clientCuit: newBudget.clientCuit,
          branchName,
          sellerName,
          paymentMethod: activeTab.paymentMethod,
          totalAmount: cartFinalTotal,
          status: 'Borrador',
          items: activeTab.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onDataUpdated({
          documents: data.documents,
          toastMessage: `Presupuesto ${docNumber} emitido y registrado correctamente.`,
        });
      }
    } catch {
      // ignore network error
    }

    const voucherData: VoucherDocumentData = {
      docNumber,
      docType: 'Presupuesto Oficial',
      dateFormatted: formatIsoToAr(todayIso),
      dueDateFormatted: formatIsoToAr(validUntilIso),
      issueDate: formatIsoToAr(todayIso),
      validUntilDate: formatIsoToAr(validUntilIso),
      recipientRoleLabel: 'Cliente / Solicitante',
      partyLabel: 'Cliente / Solicitante',
      partyName: newBudget.clientName,
      partyCuit: newBudget.clientCuit,
      partyPhone: newBudget.clientPhone,
      supplierName: newBudget.clientName,
      supplierCuit: newBudget.clientCuit,
      supplierPhone: newBudget.clientPhone,
      branchName,
      operatorName: sellerName,
      status: 'Borrador',
      statusLabel: `Validez ${activeTab.validityDays} días · Lista: ${newBudget.priceListName}`,
      subtotalBeforeGlobalDiscount: cartSubtotal,
      globalDiscountPct:
        activeTab.discountMode === 'percent' && activeTab.discountValue > 0
          ? activeTab.discountValue
          : undefined,
      globalDiscountAmount: cartDiscountAmount,
      notes:
        cartDiscountAmount > 0
          ? `Incluye descuento general aplicado de ${formatCurrency(
              cartDiscountAmount
            )}.`
          : 'Precios sujetos a validez del presupuesto.',
      items: activeTab.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        description: i.name,
        quantity: i.quantity,
        unitCost: i.unitPrice,
        unitPrice: i.unitPrice,
        originalUnitPrice: i.baseUnitPrice,
        discountPct: i.discountPercent,
        subtotal: i.quantity * i.unitPrice,
      })),
      totalAmount: cartFinalTotal,
    };

    if (openWhatsAppDirectly) {
      setActiveVoucherModal({ voucher: voucherData, tab: 'whatsapp' });
    } else {
      setCompletedSalePrompt({ voucher: voucherData });
    }
  };

  // Convert a Budget from the Budgets Table directly into a POS Sale Tab for immediate invoicing
  const handleConvertBudgetToPosSale = (budget: SavedBudgetRecord) => {
    setSavedBudgets((prev) =>
      prev.map((b) => (b.id === budget.id ? { ...b, status: 'Aceptado' } : b))
    );

    const saleCount = tabs.filter((t) => t.tabType === 'venta').length + 1;
    const newTabId = `tab-venta-conv-${Date.now()}`;

    const convertedTab: ParallelSessionTab = {
      id: newTabId,
      title: `Venta #${saleCount} (${budget.docNumber})`,
      tabType: 'venta',
      clientId: budget.clientId,
      clientName: budget.clientName,
      clientCuit: budget.clientCuit,
      clientPhone: budget.clientPhone,
      priceListId: budget.priceListId,
      paymentMethod: 'Efectivo',
      discountMode: budget.discountMode,
      discountValue: budget.discountValue,
      validityDays: 15,
      adminUnlockedCredit: false,
      items: budget.items,
    };

    setTabs((prev) => [...prev, convertedTab]);
    setActiveTabId(newTabId);
    setViewMode('pos');
    onDataUpdated({
      toastMessage: `Presupuesto ${budget.docNumber} convertido a Venta en el POS para su cobro y facturación inmediata.`,
    });
  };

  // ====================================================================
  // IMPRESIÓN TÉRMICA 58MM REDISEÑADA (BLANCO Y NEGRO PURO · MONOSPACE)
  // Garantiza máxima legibilidad en papel térmico de 58mm sin cortes
  // ====================================================================
  const printDefaultInternalCashReceipt = (
    sourceVoucher: VoucherDocumentData,
    openPreviewModal = true
  ) => {
    const formatted8Ticket = formatTicketNumber8Digits(sourceVoucher.docNumber);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const rawDate = (sourceVoucher.dateFormatted || '').trim();
    const fullDateTimeStr = rawDate.includes(':')
      ? rawDate
      : `${rawDate || now.toLocaleDateString('es-AR')} ${hh}:${mm}`;

    const internalCashVoucher: VoucherDocumentData = {
      ...sourceVoucher,
      docNumber: formatted8Ticket,
      dateFormatted: fullDateTimeStr,
      docType: sourceVoucher.docType || 'Comprobante Interno (Efectivo)',
      partyName: sourceVoucher.partyName || 'Consumidor Final',
      partyCuit: sourceVoucher.partyCuit || '00-00000000-0',
      supplierName: sourceVoucher.supplierName || 'Consumidor Final',
      supplierCuit: sourceVoucher.supplierCuit || '00-00000000-0',
      statusLabel:
        sourceVoucher.statusLabel || 'Comprobante Interno · Efectivo',
    };

    // Calcular Subtotal Bruto y Descuento Total (descuentos por ítem + descuento general)
    let grossBeforeItemDiscounts = 0;
    let afterItemDiscounts = 0;
    internalCashVoucher.items.forEach((it) => {
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
    const globalDisc = Math.max(
      0,
      Number(internalCashVoucher.globalDiscountAmount || 0)
    );
    const subtotalBeforeDiscounts =
      itemDiscountsSum > 0
        ? grossBeforeItemDiscounts
        : Number(
            internalCashVoucher.subtotalBeforeGlobalDiscount ??
              afterItemDiscounts ??
              internalCashVoucher.totalAmount + globalDisc
          );
    const totalDiscountsApplied = Number(
      (itemDiscountsSum + globalDisc).toFixed(2)
    );

    const itemsRowsHtml = internalCashVoucher.items
      .map((item) => {
        const qty = Number(item.quantity || 1);
        const unitVal = Number(item.unitPrice ?? item.unitCost ?? 0);
        const hasDisc = Number(item.discountPct || 0) > 0;
        const origPrice = Number(item.originalUnitPrice ?? unitVal);
        const lineSub =
          item.subtotal !== undefined ? Number(item.subtotal) : qty * unitVal;
        const cleanDesc = (item.description || item.name || 'Artículo').trim();
        return `
        <tr>
          <td style="padding:3px 2px 3px 0;vertical-align:top;font-weight:900;text-align:left;width:12%;color:#000000;">${qty}</td>
          <td style="padding:3px 2px;vertical-align:top;text-align:left;width:42%;word-break:break-word;overflow-wrap:break-word;color:#000000;">
            <div style="font-weight:700;color:#000000;">${cleanDesc}</div>
            ${
              hasDisc
                ? `<div style="font-size:9px;font-weight:700;color:#000000;">Dto. -${item.discountPct}% (s/${formatCurrency(origPrice)})</div>`
                : ''
            }
          </td>
          <td style="padding:3px 2px;vertical-align:top;text-align:right;width:22%;white-space:nowrap;color:#000000;">${formatCurrency(unitVal)}</td>
          <td style="padding:3px 0 3px 2px;vertical-align:top;text-align:right;font-weight:900;width:24%;white-space:nowrap;color:#000000;">${formatCurrency(lineSub)}</td>
        </tr>`;
      })
      .join('');

    const cuentaCorrienteFooterBlock =
      typeof internalCashVoucher.clientAccountTotalBalance === 'number'
        ? `
    <div class="sep">********************************</div>
    <div style="padding:4px 2px;font-size:10px;color:#000000;background:#ffffff;">
      <div style="text-align:center;font-weight:900;text-transform:uppercase;margin-bottom:3px;">
        ESTADO DE CUENTA CORRIENTE
      </div>
      ${
        typeof internalCashVoucher.clientAccountPreviousBalance === 'number'
          ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>Saldo Anterior:</span>
              <span>${formatCurrency(internalCashVoucher.clientAccountPreviousBalance)}</span>
            </div>`
          : ''
      }
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:11px;padding-top:3px;border-top:1px dashed #000000;">
        <span>SALDO TOTAL ACTUALIZADO:</span>
        <span>${formatCurrency(internalCashVoucher.clientAccountTotalBalance)}</span>
      </div>
    </div>
    <div class="sep">********************************</div>`
        : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${formatted8Ticket}</title>
  <style>
    @page { size: 58mm auto; margin: 1.5mm; }
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
      font-family: 'Courier New', Courier, monospace;
      width: 53mm;
      max-width: 53mm;
      color: #000000 !important;
      background: #ffffff !important;
      font-size: 10px;
      line-height: 1.3;
      overflow-x: hidden;
    }
    .ticket-wrap {
      width: 100%;
      padding: 2px 1px;
    }
    .sep {
      text-align: center;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
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
    <!-- ENCABEZADO CENTRADO -->
    <div style="text-align:center;">
      <div style="font-weight:900;font-size:12px;text-transform:uppercase;">FERRETERIA DEL PUENTE</div>
      <div style="font-size:9.5px;">Av. San Martín 1450 · Tel: 4582-9100</div>
      <div style="font-weight:900;font-size:10px;margin-top:2px;text-transform:uppercase;">${internalCashVoucher.docType}</div>
      <div style="font-weight:900;font-size:11px;margin-top:2px;">TICKET N°: ${formatted8Ticket}</div>
      <div style="font-size:9.5px;">Fecha/Hora: ${fullDateTimeStr}</div>
    </div>

    <div class="sep">--------------------------------</div>

    <!-- DATOS DEL CLIENTE -->
    <div style="font-size:9.5px;line-height:1.35;">
      <div><strong>Cliente:</strong> ${internalCashVoucher.partyName || 'Consumidor Final'}</div>
      <div><strong>CUIT/DNI:</strong> ${internalCashVoucher.partyCuit || '00-00000000-0'}</div>
      ${
        internalCashVoucher.partyPhone && internalCashVoucher.partyPhone !== '-'
          ? `<div><strong>Tel:</strong> ${internalCashVoucher.partyPhone}</div>`
          : ''
      }
      <div><strong>Vendedor:</strong> ${internalCashVoucher.operatorName || sellerName}</div>
    </div>

    <div class="sep">--------------------------------</div>

    <!-- DETALLE DE PRODUCTOS ALINEADO -->
    <table>
      <thead>
        <tr style="border-bottom:1px dashed #000000;">
          <th style="text-align:left;padding:2px 2px 3px 0;width:12%;font-weight:900;">Cant</th>
          <th style="text-align:left;padding:2px 2px 3px 2px;width:42%;font-weight:900;">Descripción</th>
          <th style="text-align:right;padding:2px 2px 3px 2px;width:22%;font-weight:900;">P.Unit</th>
          <th style="text-align:right;padding:2px 0 3px 2px;width:24%;font-weight:900;">Subtot</th>
        </tr>
      </thead>
      <tbody>${itemsRowsHtml}</tbody>
    </table>

    <div class="sep">--------------------------------</div>

    <!-- RESUMEN FINAL CLARO CON TRANSPARENCIA DE DESCUENTOS -->
    <div style="font-size:10px;line-height:1.4;">
      <div style="display:flex;justify-content:space-between;">
        <span>Subtotal Original (s/Dto.):</span>
        <span style="font-weight:700;">${formatCurrency(subtotalBeforeDiscounts)}</span>
      </div>
      ${
        itemDiscountsSum > 0
          ? `<div style="display:flex;justify-content:space-between;font-weight:700;">
              <span>Descuento por Ítems:</span>
              <span>-${formatCurrency(itemDiscountsSum)}</span>
            </div>`
          : ''
      }
      ${
        globalDisc > 0
          ? `<div style="display:flex;justify-content:space-between;font-weight:700;">
              <span>Descuento Global${internalCashVoucher.globalDiscountPct ? ` (${internalCashVoucher.globalDiscountPct}%)` : ''}:</span>
              <span>-${formatCurrency(globalDisc)}</span>
            </div>`
          : ''
      }
      ${
        totalDiscountsApplied > 0
          ? `<div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px dotted #000000;padding-top:2px;margin-top:2px;">
              <span>Total Descuento Aplicado:</span>
              <span>-${formatCurrency(totalDiscountsApplied)}</span>
            </div>`
          : ''
      }
    </div>

    <div class="sep">********************************</div>

    <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:900;padding:2px 0;">
      <span>TOTAL FINAL A PAGAR:</span>
      <span>${formatCurrency(internalCashVoucher.totalAmount)}</span>
    </div>

    <div style="font-size:10px;margin-top:2px;">
      <strong>Medio de Pago:</strong> ${internalCashVoucher.paymentMethod || 'Efectivo'}
    </div>

    ${cuentaCorrienteFooterBlock}

    <div class="sep">--------------------------------</div>
    <div style="text-align:center;font-size:9.5px;font-weight:700;margin-top:3px;">
      ¡Gracias por su compra!
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
        doc.write(htmlContent);
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
      }
    } catch {
      // Fallback en caso de restricción de impresión del navegador
    }

    if (openPreviewModal) {
      setActiveVoucherModal({
        voucher: internalCashVoucher,
        tab: 'pdf',
      });
    }
  };

  // ====================================================================
  // ABRIR MODAL DE COBRO COMPLETO [F8]:
  // ====================================================================
  const handleInitiateOrderAndOpenPaymentModal = () => {
    if (activeTab.items.length === 0 || isProcessingCheckout) return;
    setPosValidationError(null);

    const generatedOrderNo = formatTicketNumber8Digits(
      `0001-${String(Math.floor(1000 + Math.random() * 8999)).padStart(4, '0')}`
    );
    setPendingOrderDocNumber(generatedOrderNo);
    setCustomerTenderedAmount(String(cartFinalTotal));
    setDeliverableMode('Sin comprobante');
    if (!activeTab.billingType) {
      updateActiveTab((t) => ({
        ...t,
        billingType: 'Comprobante Interno',
      }));
    }
    setPaymentSelectionModalOpen(true);
  };

  // ====================================================================
  // FINALIZACIÓN DE VENTA:
  // - forceQuickCashFinalConsumer = true ("COBRO RÁPIDO" [F4]):
  //   Finaliza e ingresa la venta de forma directa e inmediata cobrando en
  //   Efectivo la cantidad exacta sin emitir/imprimir ticket físico y sin abrir modal.
  // - forceQuickCashFinalConsumer = false ("COBRAR" [F8] desde el Modal Completo):
  //   Finaliza con el medio de pago elegido y ejecuta el entregable seleccionado.
  // ====================================================================
  const handleFinalizeSaleCheckout = async (
    forceQuickCashFinalConsumer = false
  ) => {
    if (activeTab.items.length === 0 || isProcessingCheckout) return;
    setPosValidationError(null);

    // En Cobro Rápido [F4], siempre aseguramos precio Efectivo (Lista Normal) y salida sin ticket físico
    const effectiveDeliverable = forceQuickCashFinalConsumer
      ? 'Sin comprobante'
      : deliverableMode;

    const outputMode: VoucherOutputModeType =
      effectiveDeliverable === 'Ticket 58mm'
        ? 'Ticket'
        : effectiveDeliverable === 'WhatsApp'
        ? 'WhatsApp'
        : 'Sin ticket';

    const billingType: BillingDocType = forceQuickCashFinalConsumer
      ? 'Comprobante Interno'
      : effectiveDeliverable === 'Factura / Remito'
      ? activeTab.billingType &&
        activeTab.billingType !== 'Comprobante Interno' &&
        activeTab.billingType !== 'Ticket Interno'
        ? activeTab.billingType
        : 'Factura B'
      : activeTab.billingType || 'Comprobante Interno';

    const chosenPaymentMethod: PaymentMethodType = forceQuickCashFinalConsumer
      ? 'Efectivo'
      : activeTab.paymentMethod || 'Efectivo';

    // Si es Cobro Rápido [F4], el total se calcula siempre sobre Precio Efectivo
    const effectiveTotalAmount = forceQuickCashFinalConsumer
      ? Math.max(
          0,
          Number(
            (
              cartNormalTotal -
              (activeTab.discountValue > 0
                ? activeTab.discountMode === 'percent'
                  ? cartNormalTotal *
                    (Math.min(100, Math.max(0, activeTab.discountValue)) / 100)
                  : Math.min(cartNormalTotal, activeTab.discountValue)
                : 0)
            ).toFixed(2)
          )
        )
      : cartFinalTotal;

    const effectiveSubtotalBeforeGlobal = forceQuickCashFinalConsumer
      ? cartNormalTotal
      : cartSubtotal;

    const effectiveGlobalDiscountAmount = forceQuickCashFinalConsumer
      ? Math.max(
          0,
          Number((cartNormalTotal - effectiveTotalAmount).toFixed(2))
        )
      : cartDiscountAmount;

    const usesCuentaCorriente =
      !forceQuickCashFinalConsumer &&
      (chosenPaymentMethod === 'Cuenta Corriente' ||
        (activeTab.isCombinedPayment &&
          (activeTab.combinedPayments || []).some(
            (cp) => cp.method === 'Cuenta Corriente' && cp.amount > 0
          )));

    if (usesCuentaCorriente && isCuentaCorrienteBlocked) {
      setAdminPasswordModalOpen(true);
      return;
    }

    const rawClientPhone = (activeTab.clientPhone || '').trim();
    const cleanDigits = rawClientPhone.replace(/\D/g, '');
    if (effectiveDeliverable === 'WhatsApp' && cleanDigits.length < 10) {
      setPosValidationError(
        'Ingrese o confirme un número de teléfono válido del cliente para enviar por WhatsApp (ej: 5491122334455).'
      );
      return;
    }

    // Saldo de Cuenta Corriente para imprimir al pie del comprobante
    const previousClientBalance = selectedClientCurrentBalance;
    const ccPortionAmount = usesCuentaCorriente
      ? activeTab.isCombinedPayment
        ? (activeTab.combinedPayments || [])
            .filter((cp) => cp.method === 'Cuenta Corriente')
            .reduce((a, b) => a + (Number(b.amount) || 0), 0)
        : effectiveTotalAmount
      : 0;
    const shouldIncludeClientAccountFooter = Boolean(
      !forceQuickCashFinalConsumer &&
        selectedClientObj &&
        (usesCuentaCorriente || selectedClientHasCuentaCorriente)
    );
    const updatedClientAccountTotalBalance = shouldIncludeClientAccountFooter
      ? Number((previousClientBalance + ccPortionAmount).toFixed(2))
      : undefined;

    setIsProcessingCheckout(true);

    try {
      const effectivePaymentMethod = forceQuickCashFinalConsumer
        ? 'Efectivo'
        : chosenPaymentMethod;

      const requestedTicketNumber =
        pendingOrderDocNumber ||
        formatTicketNumber8Digits(
          `0001-${String(Math.floor(1000 + Math.random() * 8999)).padStart(4, '0')}`
        );

      const res = await fetch('/api/sales/register-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNumber: requestedTicketNumber,
          billingType,
          voucherOutputType: outputMode,
          paymentMethod: effectivePaymentMethod,
          combinedPayments:
            !forceQuickCashFinalConsumer && activeTab.isCombinedPayment
              ? activeTab.combinedPayments
              : [],
          clientId: activeTab.clientId,
          clientName: activeTab.clientName || 'Consumidor Final',
          clientCuit: activeTab.clientCuit || '00-00000000-0',
          clientPhone: rawClientPhone,
          branchName,
          sellerName,
          totalAmount: effectiveTotalAmount,
          observation: (activeTab.observation || '').slice(0, 1000),
          items: activeTab.items.map((i) => {
            const cashBase = i.normalPrice ?? i.baseUnitPrice;
            const disc = Math.min(100, Math.max(0, i.discountPercent || 0));
            const uPrice = forceQuickCashFinalConsumer
              ? Number((cashBase * (1 - disc / 100)).toFixed(2))
              : i.unitPrice;
            return {
              productId: i.productId,
              sku: i.sku,
              name: i.name,
              quantity: i.quantity,
              unitPrice: uPrice,
            };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPosValidationError(data.error || 'Error al registrar la venta');
        return;
      }

      const docNumber = formatTicketNumber8Digits(
        data.docNumber || requestedTicketNumber
      );
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const issueDateFormatted = `${formatIsoToAr(getTodayIso())} ${timeStr}`;

      if (usesCuentaCorriente && activeTab.clientId) {
        appendInvoiceToClientLedger(
          activeTab.clientId,
          docNumber,
          billingType === 'Factura A' ? 'Factura A' : 'Factura B',
          effectiveTotalAmount,
          data.clients || clients
        );
      }

      const voucherData: VoucherDocumentData = {
        docNumber,
        docType: `${billingType} (${
          forceQuickCashFinalConsumer
            ? 'Efectivo'
            : data.effectivePaymentLabel || effectivePaymentMethod
        })`,
        dateFormatted: issueDateFormatted,
        dueDateFormatted: formatIsoToAr(addDaysToTodayIso(15)),
        issueDate: formatIsoToAr(getTodayIso()),
        validUntilDate: formatIsoToAr(addDaysToTodayIso(15)),
        paymentMethod: forceQuickCashFinalConsumer
          ? 'Efectivo'
          : data.effectivePaymentLabel || effectivePaymentMethod,
        recipientRoleLabel: 'Cliente Receptor',
        partyLabel: 'Cliente Receptor',
        partyName: activeTab.clientName || 'Consumidor Final',
        partyCuit: activeTab.clientCuit || '00-00000000-0',
        partyPhone: rawClientPhone,
        supplierName: activeTab.clientName || 'Consumidor Final',
        supplierCuit: activeTab.clientCuit || '00-00000000-0',
        supplierPhone: rawClientPhone,
        branchName,
        operatorName: sellerName,
        status: usesCuentaCorriente ? 'Pendiente' : 'Emitido',
        statusLabel: `${billingType} · ${
          forceQuickCashFinalConsumer
            ? 'Efectivo'
            : data.effectivePaymentLabel || effectivePaymentMethod
        }`,
        notes: (activeTab.observation || '').trim(),
        subtotalBeforeGlobalDiscount: effectiveSubtotalBeforeGlobal,
        globalDiscountPct:
          activeTab.discountMode === 'percent' && activeTab.discountValue > 0
            ? activeTab.discountValue
            : undefined,
        globalDiscountAmount: effectiveGlobalDiscountAmount,
        clientAccountPreviousBalance: shouldIncludeClientAccountFooter
          ? previousClientBalance
          : undefined,
        clientAccountTotalBalance: updatedClientAccountTotalBalance,
        items: activeTab.items.map((i) => {
          const origPrice = forceQuickCashFinalConsumer
            ? i.normalPrice ?? i.baseUnitPrice
            : i.baseUnitPrice;
          const disc = Math.min(100, Math.max(0, i.discountPercent || 0));
          const finalUPrice = forceQuickCashFinalConsumer
            ? Number((origPrice * (1 - disc / 100)).toFixed(2))
            : i.unitPrice;
          return {
            sku: i.sku,
            name: i.name,
            description: i.name,
            quantity: i.quantity,
            unitCost: finalUPrice,
            unitPrice: finalUPrice,
            originalUnitPrice: origPrice,
            discountPct: disc,
            subtotal: Number((i.quantity * finalUPrice).toFixed(2)),
          };
        }),
        totalAmount: effectiveTotalAmount,
      };

      // Cerrar modal de Cobro Completo y guardar comprobante interno
      setPaymentSelectionModalOpen(false);
      setPendingOrderDocNumber('');
      setF12RegisteredVoucher(voucherData);

      onDataUpdated({
        products: data.products,
        clients: data.clients,
        documents: data.documents,
        toastMessage: forceQuickCashFinalConsumer
          ? `Cobro Rápido [F4]: Venta ${docNumber} registrada en Efectivo (${formatCurrency(
              effectiveTotalAmount
            )}) · Comprobante Interno generado sin impresión.`
          : effectiveDeliverable === 'Sin comprobante'
          ? `Venta ${docNumber} registrada (${voucherData.paymentMethod}) · Comprobante Interno generado.`
          : effectiveDeliverable === 'WhatsApp'
          ? `Venta ${docNumber} registrada (${voucherData.paymentMethod}) · Enviando comprobante por WhatsApp.`
          : effectiveDeliverable === 'Factura / Remito'
          ? `Venta ${docNumber} registrada (${billingType}) · Abriendo comprobante para descargar/imprimir.`
          : `Venta ${docNumber} registrada (${voucherData.paymentMethod}) · Imprimiendo Ticket Térmico 58mm.`,
      });

      // Capturar snapshot de los productos vendidos antes de limpiar el carrito para el Ajuste Post-Venta
      const soldCartSnapshot = [...activeTab.items];
      const updatedProductsList: ProductItem[] = Array.isArray(data.products)
        ? data.products
        : products;

      // Verificar si el botón de Ajuste Post-Venta en el TopBar está visible y ACTIVO
      const currentAdminCfg = loadSystemAdminConfig();
      if (
        currentAdminCfg.showPostSaleStockButtonInTopBar &&
        currentAdminCfg.postSaleStockAdjustmentActive
      ) {
        const promptItems = soldCartSnapshot
          .filter((item) => item.productId > 0)
          .map((item) => {
            const updatedProd = updatedProductsList.find(
              (p) => p.id === item.productId
            );
            const fallbackProd = products.find((p) => p.id === item.productId);
            const systemStockAfterSale = updatedProd
              ? Number(updatedProd.stock ?? 0)
              : Math.max(
                  0,
                  Number(fallbackProd?.stock ?? 0) - Number(item.quantity || 0)
                );
            return {
              productId: item.productId,
              sku: item.sku || updatedProd?.sku || 'S/C',
              name: item.name || updatedProd?.name || 'Producto',
              supplierName:
                updatedProd?.supplierName ||
                fallbackProd?.supplierName ||
                'Sin asignar',
              soldQuantity: Number(item.quantity || 1),
              calculatedSystemStock: systemStockAfterSale,
              newRealStockInput: String(systemStockAfterSale),
            };
          });

        if (promptItems.length > 0) {
          setPostSaleStockPrompt({
            docNumber,
            items: promptItems,
          });
        }
      }

      // Limpiar carrito de la pestaña actual
      updateActiveTab((t) => ({
        ...t,
        items: [],
        discountValue: 0,
        observation: '',
        priceListId: 'lista-normal',
        paymentMethod: 'Efectivo',
        isCombinedPayment: false,
      }));

      // Publicar PDF A4 de alta resolución en segundo plano
      void (async () => {
        try {
          const { pdf } = await generateVoucherPdfInstance(
            voucherData,
            formatCurrency
          );
          const dataUri = pdf.output('datauristring');
          const safeFilename = `Comprobante_${String(docNumber).replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          )}.pdf`;
          await fetch('/api/public-pdfs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: safeFilename,
              pdfBase64: dataUri,
            }),
          });
        } catch {
          // El backend ya cuenta con el PDF generado en segundo plano
        }
      })();

      // Si fue Cobro Rápido [F4] o "No emitir comprobante", no abrimos modal ni imprimimos ticket físico
      if (
        forceQuickCashFinalConsumer ||
        effectiveDeliverable === 'Sin comprobante'
      ) {
        setCompletedSalePrompt(null);
        return;
      }

      if (effectiveDeliverable === 'Ticket 58mm') {
        printDefaultInternalCashReceipt(voucherData, true);
      } else if (effectiveDeliverable === 'Factura / Remito') {
        try {
          window.localStorage.setItem(
            'ferreteria_del_puente_pdf_prefs_v2',
            JSON.stringify({
              documentFormat: 'A4',
              thermalWidth: '58mm',
              escPosSharp: false,
              includeLogo: true,
              includeCommercialData: true,
              includeFooterTerms: true,
              accentColorKey: 'orange',
            })
          );
        } catch {
          // ignore
        }
        setActiveVoucherModal({ voucher: voucherData, tab: 'pdf' });
      } else if (effectiveDeliverable === 'WhatsApp') {
        setActiveVoucherModal({ voucher: voucherData, tab: 'whatsapp' });
      }
    } catch (err: any) {
      setPosValidationError(err.message || 'Error al finalizar la venta');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Guardar y Actualizar Stock desde el Cuadro de Diálogo Post-Venta
  const handleConfirmPostSaleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postSaleStockPrompt || isSavingPostSaleStock) return;

    setIsSavingPostSaleStock(true);
    try {
      const batchPayload = postSaleStockPrompt.items.map((item) => {
        const parsedStock = Math.max(
          0,
          Math.round(Number(item.newRealStockInput) || 0)
        );
        return {
          id: item.productId,
          stock: parsedStock,
        };
      });

      const res = await fetch('/api/products/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchPayload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudo actualizar el stock post-venta'
        );
      }

      // Registrar en el historial de movimientos de inventario
      const nowStr = new Date().toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      postSaleStockPrompt.items.forEach((item) => {
        const finalStock = Math.max(
          0,
          Math.round(Number(item.newRealStockInput) || 0)
        );
        const diff = finalStock - item.calculatedSystemStock;
        appendStockMovement({
          id: `post-sale-${postSaleStockPrompt.docNumber}-${item.productId}-${Date.now()}`,
          productId: item.productId,
          sku: item.sku,
          productName: item.name,
          supplierName: item.supplierName,
          createdAt: nowStr,
          movementType: 'AJUSTE POST-VENTA',
          detail: `Ajuste de stock post-venta (Comprobante #${postSaleStockPrompt.docNumber} · Vendidos: ${item.soldQuantity} u.)`,
          orderStatus: 'Ajuste Manual Post-Venta',
          requestedQty: item.soldQuantity,
          receivedQty: diff,
          remainingPendingQty: 0,
          previousStock: item.calculatedSystemStock,
          newStock: finalStock,
        });
      });

      onDataUpdated({
        products: data.products,
        toastMessage: `Stock actualizado correctamente para ${postSaleStockPrompt.items.length} producto(s) vendido(s) y registrado en el historial de inventario.`,
      });
      setPostSaleStockPrompt(null);
    } catch (err: any) {
      onDataUpdated({
        toastMessage:
          err.message || 'Error al guardar el ajuste de stock post-venta',
      });
    } finally {
      setIsSavingPostSaleStock(false);
    }
  };

  // ====================================================================
  // ATAJOS DE TECLADO DEL POS:
  // F2: Buscar | F3: Producto no registrado | F4: Cobro rápido | F8: Cobrar/Registrar | +: Sumar cant | Esc: Cerrar/Limpiar
  // ====================================================================
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'pos' || isProcessingCheckout) return;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'F3') {
        e.preventDefault();
        setUnregisteredPanelOpen((prev) => !prev);
        return;
      }

      if (e.key === 'F4') {
        e.preventDefault();
        if (activeTab.items.length > 0) {
          void handleFinalizeSaleCheckout(true);
        }
        return;
      }

      if (e.key === 'F8' || e.key === 'F12') {
        e.preventDefault();
        if (activeTab.items.length > 0) {
          if (activeTab.tabType === 'presupuesto') {
            void handleEmitBudget(false);
          } else if (paymentSelectionModalOpen) {
            void handleFinalizeSaleCheckout(false);
          } else {
            handleInitiateOrderAndOpenPaymentModal();
          }
        }
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        handleOpenClientCreationModal(clientSearchQuery.trim());
        return;
      }

      if (e.key === 'Escape') {
        if (quickClientModalOpen) {
          setQuickClientModalOpen(false);
        } else if (paymentSelectionModalOpen) {
          setPaymentSelectionModalOpen(false);
        } else if (unregisteredPanelOpen) {
          setUnregisteredPanelOpen(false);
        } else if (barcodeOrTextQuery) {
          setBarcodeOrTextQuery('');
        }
        return;
      }

      if (e.key === '+' && !isInputFocused && activeTab.items.length > 0) {
        e.preventDefault();
        const lastItem = activeTab.items[activeTab.items.length - 1];
        if (lastItem) {
          updateActiveTab((tab) => ({
            ...tab,
            items: tab.items.map((i) =>
              i.productId === lastItem.productId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          }));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    viewMode,
    activeTab,
    isProcessingCheckout,
    paymentSelectionModalOpen,
    quickClientModalOpen,
    unregisteredPanelOpen,
    barcodeOrTextQuery,
    clientSearchQuery,
    cartFinalTotal,
    cartNormalTotal,
    deliverableMode,
  ]);

  const cartIvaAmount = useMemo(
    () => Number((cartFinalTotal - cartFinalTotal / 1.21).toFixed(2)),
    [cartFinalTotal]
  );

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5 overflow-hidden">
      {/* BARRA SUPERIOR LIMPIA: ÚNICAMENTE PESTAÑAS DE CARRITOS / PUESTOS DE TRABAJO ACTIVOS */}
      {viewMode === 'pos' && (
        <div className="shrink-0 bg-white border border-slate-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              const tabUnits = tab.items.reduce((a, b) => a + b.quantity, 0);
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all shrink-0 ${
                    isActive
                      ? tab.tabType === 'presupuesto'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold shadow-2xs'
                        : 'border-[#FF6600] bg-orange-50/80 text-slate-900 font-bold shadow-2xs'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      tab.tabType === 'venta' ? 'bg-[#FF6600]' : 'bg-indigo-600'
                    }`}
                  />
                  <span>{tab.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono tabular-nums text-[10px] text-slate-700">
                    {tabUnits} u.
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCloseParallelTab(tab.id, e)}
                    className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Cerrar o vaciar carrito"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => handleOpenNewParallelTab('venta')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors shrink-0"
              title="Abrir nuevo puesto de venta paralelo"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF6600]" />
              <span>Nueva Venta</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenNewParallelTab('presupuesto')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-xs font-bold cursor-pointer transition-colors shrink-0"
              title="Abrir nuevo presupuesto paralelo"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Presupuesto</span>
            </button>
          </div>

          {f12RegisteredVoucher && (
            <button
              type="button"
              onClick={() =>
                printDefaultInternalCashReceipt(f12RegisteredVoucher, true)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors"
              title="Reimprimir último comprobante emitido"
            >
              <Printer className="w-3.5 h-3.5 text-[#FF6600]" />
              <span>Último Ticket ({f12RegisteredVoucher.docNumber})</span>
            </button>
          )}
        </div>
      )}

      {/* ====================================================================
          VISTA 1: PUNTO DE VENTA (POS) REESTRUCTURADO (CATÁLOGO + TICKET ACTUAL)
         ==================================================================== */}
      {viewMode === 'pos' && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          {/* ====================================================================
              COLUMNA IZQUIERDA (7 cols): CATÁLOGO DE PRODUCTOS + FILTROS + ATAJOS
             ==================================================================== */}
          <div className="lg:col-span-7 h-full min-h-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-2xs">
            {/* Barra Superior: Buscador Rápido (F2) + Prod. No Registrado (F3) + Filtros Proveedores y Estado de Stock */}
            <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Buscador Rápido por Nombre, SKU o Lector de Código de Barras */}
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-[#FF6600] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={barcodeOrTextQuery}
                    onChange={(e) => setBarcodeOrTextQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Buscar por Nombre, SKU o lector de código de barras... (F2)"
                    className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600] shadow-2xs"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {barcodeOrTextQuery && (
                      <button
                        type="button"
                        onClick={() => setBarcodeOrTextQuery('')}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Limpiar búsqueda (Esc)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-500">
                      F2
                    </span>
                  </div>
                </div>

                {/* Botón Producto No Registrado (F3) */}
                <button
                  type="button"
                  onClick={() => setUnregisteredPanelOpen((prev) => !prev)}
                  className={`px-3 py-2 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    unregisteredPanelOpen
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-orange-50 text-slate-700 border-slate-300'
                  }`}
                  title="Agregar producto no registrado o concepto libre (F3)"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Prod. No Registrado</span>
                  <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                    F3
                  </span>
                </button>
              </div>

              {/* Segunda fila de controles: Filtro Proveedores + Filtro Estado de Stock + Selector Modo Venta/Presupuesto */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  {/* Filtro por Proveedores */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      Proveedores:
                    </span>
                    <select
                      value={selectedSupplierFilter}
                      onChange={(e) =>
                        setSelectedSupplierFilter(e.target.value)
                      }
                      className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate"
                    >
                      <option value="TODOS">
                        Todos los proveedores ({availableSuppliers.length})
                      </option>
                      {availableSuppliers.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Filtro por Estado de Stock */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      Stock / Vista:
                    </span>
                    <select
                      value={catalogStockFilter}
                      onChange={(e) =>
                        setCatalogStockFilter(
                          e.target.value as
                            | 'TODOS'
                            | 'CONTROLA_STOCK'
                            | 'SIN_STOCK'
                            | 'EN_CARRITO'
                        )
                      }
                      className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="TODOS">Todos</option>
                      <option value="CONTROLA_STOCK">Controla Stock</option>
                      <option value="SIN_STOCK">
                        No controla stock / Sin stock
                      </option>
                      <option value="EN_CARRITO">
                        En carrito ({activeTab.items.length})
                      </option>
                    </select>
                  </div>
                </div>

                {/* Selector MODO VENTA / MODO PRESUPUESTO */}
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200/90 border border-slate-300 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveTab((t) => ({
                        ...t,
                        tabType: 'venta',
                        title: t.title.replace('Presupuesto', 'Venta'),
                      }))
                    }
                    className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                      activeTab.tabType === 'venta'
                        ? 'bg-[#FF6600] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MODO VENTA
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveTab((t) => ({
                        ...t,
                        tabType: 'presupuesto',
                        title: t.title.replace('Venta', 'Presupuesto'),
                      }))
                    }
                    className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                      activeTab.tabType === 'presupuesto'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    PRESUPUESTO
                  </button>
                </div>
              </div>

              {/* Panel desplegable de Producto No Registrado (F3) */}
              {unregisteredPanelOpen && (
                <form
                  onSubmit={handleAddUnregisteredProduct}
                  className="p-2.5 rounded-lg bg-orange-50/90 border border-orange-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                >
                  <input
                    type="text"
                    autoFocus
                    value={unregisteredDescription}
                    onChange={(e) => setUnregisteredDescription(e.target.value)}
                    placeholder="Descripción del producto no registrado o concepto libre..."
                    className="sm:col-span-6 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={unregisteredFinalPrice}
                    onChange={(e) => setUnregisteredFinalPrice(e.target.value)}
                    placeholder="Precio Efectivo $"
                    className="sm:col-span-3 px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={unregisteredQuantity}
                    onChange={(e) =>
                      setUnregisteredQuantity(
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    }
                    className="sm:col-span-1 px-2 py-1.5 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 py-1.5 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold cursor-pointer"
                  >
                    + Agregar
                  </button>
                </form>
              )}
            </div>

            {/* TABLA DE PRODUCTOS / CATÁLOGO PRINCIPAL */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider select-none">
                  <tr>
                    <th
                      onClick={() => handleSortPosCatalog('name')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>PRODUCTO</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSortPosCatalog('price')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200/60 w-36"
                    >
                      <div className="inline-flex items-center justify-end gap-1 text-emerald-800">
                        <span>PRECIO EFECTIVO</span>
                        <ArrowUpDown className="w-3 h-3 text-emerald-600" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right w-40 text-amber-900">
                      PRECIO TARJETA / LISTA
                    </th>
                    <th
                      onClick={() => handleSortPosCatalog('stock')}
                      className="py-2.5 px-2.5 text-center cursor-pointer hover:bg-slate-200/60 w-24"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>STOCK</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right w-28">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {quickSearchProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-16 text-center text-slate-500 text-xs"
                      >
                        <div className="max-w-sm mx-auto space-y-1.5">
                          <div className="font-bold text-slate-700 text-sm">
                            No se encontraron productos para el filtro actual
                          </div>
                          <p>
                            Intente con otro término/proveedor o presione{' '}
                            <strong className="font-mono text-slate-800">
                              F3
                            </strong>{' '}
                            para cargar un Producto No Registrado.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedQuickSearchProducts.map((prod) => {
                      const { normalPrice, cardPrice } =
                        computeProductNormalAndCardPrices(prod);
                      const stockVal = Number(prod.stock ?? 0);
                      const minStockVal = Number(prod.minStock ?? 5);
                      const isOutOfStock = stockVal <= 0;
                      const isLowStock =
                        !isOutOfStock && stockVal <= minStockVal;
                      const inCartItem = activeTab.items.find(
                        (i) => i.productId === prod.id
                      );

                      return (
                        <tr
                          key={prod.id}
                          onClick={() => handleAddProductToCart(prod)}
                          className={`hover:bg-orange-50/50 transition-colors cursor-pointer align-middle ${
                            inCartItem ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          {/* 1. PRODUCTO (Nombre, SKU, Marca, Proveedor y Badge Stock Bajo / Sin Stock) */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug">
                                {prod.name}
                              </span>
                              {isOutOfStock && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-extrabold uppercase tracking-wide">
                                  Sin Stock
                                </span>
                              )}
                              {isLowStock && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold uppercase tracking-wide">
                                  Stock Bajo
                                </span>
                              )}
                              {inCartItem && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                                  En carrito: {inCartItem.quantity} u.
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono font-bold text-slate-700">
                                {prod.sku}
                              </span>
                              <span>·</span>
                              <span>{prod.brand}</span>
                              {prod.supplierName && (
                                <>
                                  <span>·</span>
                                  <span className="font-semibold text-slate-600">
                                    Prov: {prod.supplierName}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* 2. PRECIO EFECTIVO (Destacado en color verde) */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-mono tabular-nums font-extrabold text-emerald-700 text-xs sm:text-sm">
                              {formatCurrency(normalPrice)}
                            </span>
                          </td>

                          {/* 3. PRECIO TARJETA / LISTA (Destacado en color naranja/marrón) */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 font-mono tabular-nums font-extrabold text-amber-900 text-xs sm:text-sm">
                              {formatCurrency(cardPrice)}
                            </span>
                          </td>

                          {/* 4. STOCK (Valor numérico o badge Sin Stock) */}
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            {isOutOfStock ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] uppercase">
                                Sin Stock
                              </span>
                            ) : (
                              <span
                                className={`font-mono tabular-nums font-extrabold text-xs px-2 py-0.5 rounded-md ${
                                  isLowStock
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {stockVal}
                              </span>
                            )}
                          </td>

                          {/* 5. ACCIONES (Botón "+ Agregar" a la venta) */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddProductToCart(prod);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white font-extrabold text-xs inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            >
                              <span>+ Agregar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación del Catálogo */}
            <TablePaginationBar
              totalItems={quickSearchProducts.length}
              currentPage={safePosCatalogPage}
              pageSize={posCatalogPageSize}
              onPageChange={setPosCatalogPage}
              onPageSizeChange={(nextSize) => {
                setPosCatalogPageSize(nextSize);
                setPosCatalogPage(1);
              }}
              itemLabel="productos"
              compact
            />

            {/* BARRA INFORMATIVA INFERIOR CON ATAJOS DE TECLADO */}
            <div className="shrink-0 px-3 py-2 bg-slate-900 text-slate-200 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-orange-400">
                    F2
                  </kbd>
                  <span>Buscar</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-orange-400">
                    F3
                  </kbd>
                  <span>Prod. no registrado</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-emerald-400">
                    F4
                  </kbd>
                  <span>Cobro rápido</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-orange-400">
                    F8
                  </kbd>
                  <span>Cobrar/Registrar</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-orange-400">
                    F9
                  </kbd>
                  <span>Nuevo Cliente</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-slate-300">
                    +
                  </kbd>
                  <span>Sumar cant.</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-slate-300">
                    Enter
                  </kbd>
                  <span>Agregar</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] font-bold text-slate-300">
                    Esc
                  </kbd>
                  <span>Limpiar/Cerrar</span>
                </span>
              </div>
            </div>
          </div>

          {/* ====================================================================
              COLUMNA DERECHA (5 cols): CARRITO / TICKET ACTUAL + TOTALES DUALES + F4 / F8
             ==================================================================== */}
          <div className="lg:col-span-5 h-full min-h-0 bg-white border border-slate-200 rounded-xl flex flex-col justify-between overflow-hidden shadow-2xs">
            {/* 1. Cabecera del Ticket Actual + Selector de Tipo de Lista (arriba) + Selector de Cliente con botón "+" */}
            <div
              ref={clientDropdownContainerRef}
              className="shrink-0 p-3 border-b border-slate-200 bg-slate-50/70 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    {activeTab.tabType === 'presupuesto'
                      ? 'Presupuesto Actual'
                      : 'Ticket / Venta Actual'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[11px] font-bold">
                    {activeTab.items.reduce((a, b) => a + b.quantity, 0)} u.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeTab.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveTab((t) => ({
                          ...t,
                          items: [],
                          discountValue: 0,
                        }))
                      }
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      Vaciar carrito
                    </button>
                  )}
                </div>
              </div>

              {/* FILA SUPERIOR: SELECTOR DE "TIPO DE LISTA" (Arriba del selector de clientes) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Tipo de Lista:
                  </span>
                  <select
                    value={activeTab.priceListId}
                    onChange={(e) => handleSelectPriceList(e.target.value)}
                    className="text-xs font-extrabold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {posAvailablePriceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botones rápidos de alternancia de Tipo de Lista */}
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectPriceList('lista-normal')}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors cursor-pointer ${
                      activeTab.priceListId === 'lista-normal'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPriceList('lista-gremio')}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors cursor-pointer ${
                      activeTab.priceListId === 'lista-gremio'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Gremio/Mayorista
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPriceList('lista-tarjeta')}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors cursor-pointer ${
                      activeTab.priceListId === 'lista-tarjeta'
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tarjeta
                  </button>
                </div>
              </div>

              {/* FILA INFERIOR: BUSCADOR / SELECTOR DE CLIENTE + BOTÓN "+" ("Nuevo Cliente Rápido" / F9) */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onClick={() => setClientAutocompleteOpen(true)}
                    onFocus={() => setClientAutocompleteOpen(true)}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      setClientAutocompleteOpen(true);
                    }}
                    placeholder={`${
                      activeTab.clientName || 'Consumidor Final'
                    } (${activeTab.clientCuit || '00-00000000-0'})`}
                    className="w-full pl-8 pr-7 py-1.5 text-xs font-bold text-slate-900 placeholder:text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                  {clientAutocompleteOpen && (
                    <button
                      type="button"
                      onClick={() => setClientAutocompleteOpen(false)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {clientAutocompleteOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          updateActiveTab((t) => ({
                            ...t,
                            clientId: null,
                            clientName: 'Consumidor Final',
                            clientCuit: '00-00000000-0',
                            clientPhone: '',
                            paymentMethod:
                              t.paymentMethod === 'Cuenta Corriente'
                                ? 'Efectivo'
                                : t.paymentMethod,
                            adminUnlockedCredit: false,
                          }));
                          setClientSearchQuery('');
                          setClientAutocompleteOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-orange-50/60 flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="font-bold text-slate-900">
                          Consumidor Final (Por defecto)
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          00-00000000-0
                        </span>
                      </button>

                      {sortedFilteredClients.map((c) => {
                        const bal = parseFloat(String(c.balance || '0')) || 0;
                        const assignedListId =
                          c.listaPreciosId ||
                          (c.priceList?.toLowerCase().includes('gremio') ||
                          c.priceList?.toLowerCase().includes('mayorista')
                            ? 'lista-gremio'
                            : c.priceList?.toLowerCase().includes('tarjeta')
                            ? 'lista-tarjeta'
                            : 'lista-normal');
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              handleSelectPriceList(assignedListId);
                              updateActiveTab((t) => ({
                                ...t,
                                clientId: c.id,
                                clientName: c.name,
                                clientCuit: c.cuit,
                                clientPhone: c.phone !== '-' ? c.phone : '',
                                billingType:
                                  c.taxCondition === 'Responsable Inscripto'
                                    ? 'Factura A'
                                    : 'Factura B',
                                adminUnlockedCredit: false,
                              }));
                              setClientSearchQuery('');
                              setClientAutocompleteOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-orange-50/50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">
                                {c.name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 truncate">
                                CUIT: {c.cuit} · {c.taxCondition}
                              </div>
                            </div>
                            {bal > 0 && (
                              <span className="font-mono tabular-nums text-[10px] font-bold text-amber-800 shrink-0">
                                {formatCurrency(bal)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Botón "+" ("Nuevo Cliente Rápido" por CUIT/CUIL · F9) */}
                <button
                  type="button"
                  onClick={() =>
                    handleOpenClientCreationModal(clientSearchQuery.trim())
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="Nuevo Cliente Rápido por CUIT/CUIL (F9)"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Nuevo Cliente</span>
                  <span className="px-1 py-0.2 rounded bg-orange-700/80 text-orange-100 font-mono text-[9px] font-bold">
                    F9
                  </span>
                </button>
              </div>

              {selectedClientObj && selectedClientHasCuentaCorriente && (
                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                  <span>
                    Saldo Cta. Cte.:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatCurrency(selectedClientCurrentBalance)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenAdminCreditModal}
                    className="text-[11px] font-bold text-[#FF6600] hover:underline cursor-pointer"
                  >
                    Límite / Autorizar
                  </button>
                </div>
              )}
            </div>

            {/* 2. Lista de Productos Agregados a la Venta Actual (con Precio Lista/Efectivo y Precio con Tarjeta) */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-200">
              {activeTab.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <Barcode className="w-8 h-8 text-slate-300 mb-2" />
                  <div className="font-bold text-slate-600 text-xs sm:text-sm">
                    El carrito de venta está vacío
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Haga clic en <strong>+ Agregar</strong> en la tabla de
                    productos o escanee un código de barras.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase select-none">
                    <tr>
                      <th className="py-2 px-2">Producto</th>
                      <th className="py-2 px-1 text-center w-20">Cant.</th>
                      <th className="py-2 px-1 text-right w-20 text-emerald-800">
                        P. Lista/Efec.
                      </th>
                      <th className="py-2 px-1 text-right w-20 text-amber-900">
                        P. Tarjeta
                      </th>
                      <th className="py-2 px-1 text-center w-12">Dto%</th>
                      <th className="py-2 px-2 text-right w-22">Subtotal</th>
                      <th className="py-2 px-1 text-center w-7"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {activeTab.items.map((item) => {
                      const prod = products.find(
                        (p) => p.id === item.productId
                      );
                      const fallbackPrices = prod
                        ? computeProductNormalAndCardPrices(prod)
                        : {
                            finalCost: item.finalCostPrice || 0,
                            normalPrice: item.baseUnitPrice,
                            cardPrice: Number(
                              (
                                item.baseUnitPrice *
                                (1 + cardInterestPct / 100)
                              ).toFixed(2)
                            ),
                          };

                      const itemNormalPrice =
                        item.normalPrice ?? fallbackPrices.normalPrice;
                      const itemCardPrice =
                        item.cardPrice ??
                        Number(
                          (
                            itemNormalPrice *
                            (1 + cardInterestPct / 100)
                          ).toFixed(2)
                        );
                      const itemDiscountPct = item.discountPercent ?? 0;
                      const isCardListSelected =
                        activeTab.priceListId === 'lista-tarjeta';
                      const activeBasePrice = isCardListSelected
                        ? itemCardPrice
                        : activeTab.priceListId === 'lista-normal'
                        ? itemNormalPrice
                        : item.baseUnitPrice || itemNormalPrice;
                      const effectiveUnitPrice = Number(
                        (
                          activeBasePrice *
                          (1 - itemDiscountPct / 100)
                        ).toFixed(2)
                      );
                      const effectiveCardUnitPrice = Number(
                        (
                          itemCardPrice *
                          (1 - itemDiscountPct / 100)
                        ).toFixed(2)
                      );
                      const rowOriginalSubtotal =
                        item.quantity * activeBasePrice;
                      const rowSubtotal = item.quantity * effectiveUnitPrice;

                      return (
                        <tr
                          key={item.productId}
                          className="hover:bg-slate-50/90 align-middle"
                        >
                          {/* Producto */}
                          <td className="py-2 px-2">
                            <div className="font-bold text-slate-900 text-xs leading-tight line-clamp-1">
                              {item.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {item.sku}
                            </div>
                          </td>

                          {/* Cantidad +/- */}
                          <td className="py-2 px-1 text-center">
                            <div className="inline-flex items-center border border-slate-300 rounded-md bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextQty = Math.max(
                                    1,
                                    item.quantity - 1
                                  );
                                  updateActiveTab((tab) => ({
                                    ...tab,
                                    items: tab.items.map((i) =>
                                      i.productId === item.productId
                                        ? { ...i, quantity: nextQty }
                                        : i
                                    ),
                                  }));
                                }}
                                className="w-5 h-6 flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const q = Math.max(
                                    1,
                                    Number(e.target.value) || 1
                                  );
                                  updateActiveTab((tab) => ({
                                    ...tab,
                                    items: tab.items.map((i) =>
                                      i.productId === item.productId
                                        ? { ...i, quantity: q }
                                        : i
                                    ),
                                  }));
                                }}
                                className="w-8 h-6 text-center font-mono tabular-nums font-bold text-xs text-slate-900 border-x border-slate-200 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const nextQty = item.quantity + 1;
                                  updateActiveTab((tab) => ({
                                    ...tab,
                                    items: tab.items.map((i) =>
                                      i.productId === item.productId
                                        ? { ...i, quantity: nextQty }
                                        : i
                                    ),
                                  }));
                                }}
                                className="w-5 h-6 flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Precio Unitario Lista / Efectivo editable */}
                          <td className="py-2 px-1 text-right">
                            <input
                              type="number"
                              min={0}
                              step={10}
                              value={activeBasePrice}
                              onChange={(e) => {
                                const enteredVal = Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                );
                                const nextNormal = isCardListSelected
                                  ? Number(
                                      (
                                        enteredVal /
                                        (1 + cardInterestPct / 100)
                                      ).toFixed(2)
                                    )
                                  : enteredVal;
                                const nextCard = isCardListSelected
                                  ? enteredVal
                                  : Number(
                                      (
                                        enteredVal *
                                        (1 + cardInterestPct / 100)
                                      ).toFixed(2)
                                    );
                                updateActiveTab((tab) => ({
                                  ...tab,
                                  items: tab.items.map((i) => {
                                    if (i.productId !== item.productId)
                                      return i;
                                    const disc = Math.min(
                                      100,
                                      Math.max(0, i.discountPercent || 0)
                                    );
                                    const base =
                                      tab.priceListId === 'lista-tarjeta'
                                        ? nextCard
                                        : nextNormal;
                                    return {
                                      ...i,
                                      normalPrice: nextNormal,
                                      cardPrice: nextCard,
                                      baseUnitPrice: base,
                                      unitPrice: Number(
                                        (base * (1 - disc / 100)).toFixed(2)
                                      ),
                                    };
                                  }),
                                }));
                              }}
                              className="w-18 px-1 py-1 text-right font-mono tabular-nums font-bold text-xs border border-emerald-300 rounded bg-emerald-50/40 text-emerald-900 focus:outline-none focus:border-[#FF6600]"
                              title="Precio de Lista / Efectivo unitario"
                            />
                          </td>

                          {/* Precio con Tarjeta unitario (Visualización directa junto al precio efectivo/lista) */}
                          <td className="py-2 px-1 text-right whitespace-nowrap">
                            <span
                              className="inline-block px-1.5 py-1 rounded bg-amber-50 border border-amber-200 font-mono tabular-nums font-bold text-[11px] text-amber-900"
                              title="Precio con Tarjeta unitario"
                            >
                              {formatCurrency(effectiveCardUnitPrice)}
                            </span>
                          </td>

                          {/* Descuento % individual */}
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={itemDiscountPct}
                              onChange={(e) => {
                                const disc = Math.min(
                                  100,
                                  Math.max(0, Number(e.target.value) || 0)
                                );
                                updateActiveTab((tab) => ({
                                  ...tab,
                                  items: tab.items.map((i) => {
                                    if (i.productId !== item.productId)
                                      return i;
                                    const base =
                                      tab.priceListId === 'lista-tarjeta'
                                        ? itemCardPrice
                                        : itemNormalPrice;
                                    return {
                                      ...i,
                                      discountPercent: disc,
                                      baseUnitPrice: base,
                                      unitPrice: Number(
                                        (base * (1 - disc / 100)).toFixed(2)
                                      ),
                                    };
                                  }),
                                }));
                              }}
                              className="w-11 px-1 py-1 text-center font-mono tabular-nums font-bold text-xs border border-slate-300 rounded bg-white text-emerald-700 focus:outline-none focus:border-[#FF6600]"
                              title="Descuento % en este ítem"
                            />
                          </td>

                          {/* Subtotal (con precio original tachado si hay descuento) */}
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            {itemDiscountPct > 0 && (
                              <div className="text-[10px] font-mono text-slate-400 line-through">
                                {formatCurrency(rowOriginalSubtotal)}
                              </div>
                            )}
                            <div className="font-mono tabular-nums font-extrabold text-slate-900 text-xs">
                              {formatCurrency(rowSubtotal)}
                            </div>
                          </td>

                          {/* Eliminar */}
                          <td className="py-2 px-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveTab((tab) => ({
                                  ...tab,
                                  items: tab.items.filter(
                                    (i) => i.productId !== item.productId
                                  ),
                                }))
                              }
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Quitar ítem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 3. Panel Inferior de Descuentos, Totales Duales (Efectivo vs Tarjeta) y Botones F4 / F8 */}
            <div className="shrink-0 p-3 border-t border-slate-200 bg-slate-50/90 space-y-2.5">
              {/* Descuento Global + Subtotal */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">
                    Descuento Global:
                  </span>
                  <div className="inline-flex rounded border border-slate-300 overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveTab((t) => ({
                          ...t,
                          discountMode: 'percent',
                        }))
                      }
                      className={`px-2 py-0.5 text-[10px] font-extrabold cursor-pointer ${
                        activeTab.discountMode === 'percent'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveTab((t) => ({
                          ...t,
                          discountMode: 'amount',
                        }))
                      }
                      className={`px-2 py-0.5 text-[10px] font-extrabold cursor-pointer ${
                        activeTab.discountMode === 'amount'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      $
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={
                      activeTab.discountMode === 'percent' ? 100 : undefined
                    }
                    step="any"
                    value={activeTab.discountValue || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const rawVal = Math.max(0, Number(e.target.value) || 0);
                      const val =
                        activeTab.discountMode === 'percent'
                          ? Math.min(100, rawVal)
                          : rawVal;
                      updateActiveTab((t) => ({
                        ...t,
                        discountValue: val,
                      }));
                    }}
                    className="w-20 px-2 py-1 text-right font-mono tabular-nums font-bold text-xs border border-slate-300 rounded-md bg-white text-emerald-700 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Subtotal:{' '}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-800">
                    {formatCurrency(cartSubtotal)}
                  </span>
                  {cartDiscountAmount > 0 && (
                    <span className="ml-2 font-mono tabular-nums font-bold text-emerald-700 text-[11px]">
                      (Dto: −{formatCurrency(cartDiscountAmount)})
                    </span>
                  )}
                </div>
              </div>

              {/* TARJETAS COMPARATIVAS DE TOTAL EFECTIVO (VERDE) Y TOTAL TARJETA / LISTA (NARANJA/MARRÓN) */}
              {(() => {
                const cashFinalWithGlobalDisc = Math.max(
                  0,
                  Number(
                    (
                      cartNormalTotal -
                      (activeTab.discountValue > 0
                        ? activeTab.discountMode === 'percent'
                          ? cartNormalTotal *
                            (Math.min(100, Math.max(0, activeTab.discountValue)) /
                              100)
                          : Math.min(cartNormalTotal, activeTab.discountValue)
                        : 0)
                    ).toFixed(2)
                  )
                );
                const cardFinalWithGlobalDisc = Math.max(
                  0,
                  Number(
                    (
                      cartCardTotal -
                      (activeTab.discountValue > 0
                        ? activeTab.discountMode === 'percent'
                          ? cartCardTotal *
                            (Math.min(100, Math.max(0, activeTab.discountValue)) /
                              100)
                          : Math.min(cartCardTotal, activeTab.discountValue)
                        : 0)
                    ).toFixed(2)
                  )
                );
                const isCardSelected =
                  activeTab.priceListId === 'lista-tarjeta';

                return (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* TOTAL EFECTIVO (Verde) */}
                    <div
                      onClick={() => handleSelectPriceList('lista-normal')}
                      className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                        !isCardSelected
                          ? 'bg-emerald-50 border-emerald-600 shadow-2xs'
                          : 'bg-emerald-50/50 border-emerald-200 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          TOTAL EFECTIVO
                        </span>
                        {!isCardSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="text-lg sm:text-xl font-mono tabular-nums font-black text-emerald-700 mt-0.5">
                        {formatCurrency(cashFinalWithGlobalDisc)}
                      </div>
                      <div className="text-[10px] text-emerald-700/80 font-medium">
                        Contado / Transferencia / Débito
                      </div>
                    </div>

                    {/* TOTAL TARJETA / LISTA (Naranja / Marrón) */}
                    <div
                      onClick={() => handleSelectPriceList('lista-tarjeta')}
                      className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                        isCardSelected
                          ? 'bg-amber-50 border-amber-700 shadow-2xs'
                          : 'bg-amber-50/50 border-amber-200 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                          TOTAL TARJETA / LISTA
                        </span>
                        {isCardSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-800 text-white text-[9px] font-extrabold uppercase">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="text-lg sm:text-xl font-mono tabular-nums font-black text-amber-900 mt-0.5">
                        {formatCurrency(cardFinalWithGlobalDisc)}
                      </div>
                      <div className="text-[10px] text-amber-900/80 font-medium">
                        Lista Tarjeta (+{cardInterestPct}%)
                      </div>
                    </div>
                  </div>
                );
              })()}

              {posValidationError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-800">
                  {posValidationError}
                </div>
              )}

              {/* 4. BOTONES DE ACCIÓN PRINCIPALES: COBRO RÁPIDO (F4) Y COBRAR / REGISTRAR (F8) */}
              {activeTab.tabType === 'venta' ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-0.5">
                  {/* Botón Cobro Rápido (F4) */}
                  <button
                    type="button"
                    disabled={
                      activeTab.items.length === 0 || isProcessingCheckout
                    }
                    onClick={() => void handleFinalizeSaleCheckout(true)}
                    className="sm:col-span-5 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer shadow-sm"
                    title="Registra la venta inmediatamente en Efectivo sin emitir ticket físico y limpia el carrito (F4)"
                  >
                    <div className="flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 shrink-0" />
                      <span>COBRO RÁPIDO (F4)</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-100 normal-case">
                      Efectivo directo · Sin ticket
                    </span>
                  </button>

                  {/* Botón Cobrar / Registrar (F8) */}
                  <button
                    type="button"
                    disabled={
                      activeTab.items.length === 0 || isProcessingCheckout
                    }
                    onClick={handleInitiateOrderAndOpenPaymentModal}
                    className="sm:col-span-7 py-3 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 text-white font-black text-xs sm:text-sm uppercase tracking-wide flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer shadow-md"
                    title="Abre el modal de cobro completo: Medio de Pago, Calculadora de Vuelto y Comprobante/WhatsApp (F8)"
                  >
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {isProcessingCheckout
                          ? 'PROCESANDO...'
                          : 'COBRAR / REGISTRAR (F8)'}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-orange-100 normal-case">
                      Medios de pago, vuelto y comprobantes
                    </span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={activeTab.items.length === 0}
                    onClick={() => void handleEmitBudget(false)}
                    className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>EMITIR PRESUPUESTO (F8)</span>
                  </button>
                  <button
                    type="button"
                    disabled={
                      activeTab.items.length === 0 || isProcessingCheckout
                    }
                    onClick={handleInitiateOrderAndOpenPaymentModal}
                    className="py-3 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>COBRAR COMO VENTA</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: TABLA DE PRESUPUESTOS / COTIZACIONES Y CONVERSIÓN DIRECTA A VENTA */}
      {viewMode === 'presupuestos' && (
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="shrink-0 p-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Módulo de Presupuestos y Cotizaciones Emitidas
              </h2>
              <p className="text-[11px] text-slate-500">
                Convierta cualquier presupuesto en Factura / Venta transfiriendo sus ítems al POS con un clic
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenNewParallelTab('presupuesto')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Presupuesto en Pestaña</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 z-10 select-none">
                <tr>
                  <th
                    onClick={() => handleSortBudgets('docNumber')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Nro. Comprobante</span>
                      {budgetsSort.key === 'docNumber' ? (
                        budgetsSort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortBudgets('dateIso')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Fecha</span>
                      {budgetsSort.key === 'dateIso' ? (
                        budgetsSort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortBudgets('clientName')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Cliente</span>
                      {budgetsSort.key === 'clientName' ? (
                        budgetsSort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortBudgets('totalAmount')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Total</span>
                      {budgetsSort.key === 'totalAmount' ? (
                        budgetsSort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Validez</th>
                  <th
                    onClick={() => handleSortBudgets('status')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Estado</span>
                      {budgetsSort.key === 'status' ? (
                        budgetsSort.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right">Acciones / Conversión POS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {paginatedSavedBudgets.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {b.docNumber}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {formatIsoToAr(b.dateIso)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">
                        {b.clientName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        CUIT {b.clientCuit} · {b.priceListName}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      Hasta {formatIsoToAr(b.validUntilIso)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <select
                        value={b.status}
                        onChange={(e) => {
                          const nextSt = e.target.value as
                            | 'Borrador'
                            | 'Aceptado'
                            | 'Vencido';
                          setSavedBudgets((prev) =>
                            prev.map((item) =>
                              item.id === b.id
                                ? { ...item, status: nextSt }
                                : item
                            )
                          );
                        }}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer ${
                          b.status === 'Aceptado'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : b.status === 'Vencido'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="Borrador">Borrador</option>
                        <option value="Aceptado">Aceptado</option>
                        <option value="Vencido">Vencido</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleConvertBudgetToPosSale(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-[11px] font-bold cursor-pointer shadow-2xs"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Convertir en Venta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVoucherModal({
                              voucher: {
                                docNumber: b.docNumber,
                                docType: 'Presupuesto Oficial',
                                dateFormatted: formatIsoToAr(b.dateIso),
                                dueDateFormatted: formatIsoToAr(b.validUntilIso),
                                issueDate: formatIsoToAr(b.dateIso),
                                validUntilDate: formatIsoToAr(b.validUntilIso),
                                recipientRoleLabel: 'Cliente',
                                partyLabel: 'Cliente',
                                partyName: b.clientName,
                                partyCuit: b.clientCuit,
                                partyPhone: b.clientPhone,
                                supplierName: b.clientName,
                                supplierCuit: b.clientCuit,
                                supplierPhone: b.clientPhone,
                                branchName,
                                operatorName: sellerName,
                                status: b.status,
                                statusLabel: b.status,
                                notes: `Lista: ${b.priceListName}`,
                                items: b.items.map((i) => ({
                                  sku: i.sku,
                                  name: i.name,
                                  description: i.name,
                                  quantity: i.quantity,
                                  unitCost: i.unitPrice,
                                  unitPrice: i.unitPrice,
                                  subtotal: i.quantity * i.unitPrice,
                                })),
                                totalAmount: b.totalAmount,
                              },
                              tab: 'whatsapp',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePaginationBar
            totalItems={sortedSavedBudgets.length}
            currentPage={safeBudgetsPage}
            pageSize={budgetsPageSize}
            onPageChange={setBudgetsPage}
            onPageSizeChange={(nextSize) => {
              setBudgetsPageSize(nextSize);
              setBudgetsPage(1);
            }}
            itemLabel="presupuestos"
          />
        </div>
      )}

      {/* VISTA 3 Y 4: FACTURACIÓN Y RECEPCIÓN DE COMPRAS A PROVEEDORES */}
      {(viewMode === 'facturacion' || viewMode === 'compras') && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PurchasesInvoicesSubView
            mode={viewMode}
            documents={documents}
            products={products}
            suppliers={suppliers}
            branchName={branchName}
            sellerName={sellerName}
            activeSystemRole={activeSystemRole}
            formatCurrency={formatCurrency}
            onCycleDocStatus={onCycleDocStatus}
            onProductsAndSuppliersUpdated={(nextProds, nextSups, msg) =>
              onDataUpdated({
                products: nextProds,
                suppliers: nextSups,
                toastMessage: msg,
              })
            }
          />
        </div>
      )}

      {/* MODAL 1: ALTA RÁPIDA DE CLIENTE POR CUIT/CUIL (PADRÓN AFIP / ARCA) [F9] */}
      {quickClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[#FF6600]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Alta Rápida de Cliente por CUIT / CUIL
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Autocompletado directo desde padrón AFIP / ARCA · Sin salir de la venta actual (F9)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickClientModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickClient} className="space-y-4">
              {/* 1. CAMPO DESTACADO CUIT / CUIL / DNI + BOTÓN "BUSCAR CUIT" */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-orange-400">
                    1. Consulta automática por CUIT / CUIL / DNI (AFIP / ARCA)
                  </label>
                  <span className="text-[10px] font-mono text-slate-300">
                    11 dígitos CUIT/CUIL o DNI
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={quickClientCuit}
                    onChange={(e) => setQuickClientCuit(e.target.value)}
                    onBlur={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      if (
                        (digits.length === 11 ||
                          digits.length === 7 ||
                          digits.length === 8) &&
                        digits !== lastLookedUpCuitDigits &&
                        !isLookingUpAfipCuit
                      ) {
                        void handleLookupAfipCuit(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const digits = quickClientCuit.replace(/\D/g, '');
                        if (digits.length >= 7) {
                          e.preventDefault();
                          void handleLookupAfipCuit(quickClientCuit);
                        }
                      }
                    }}
                    placeholder="Ingrese CUIT/CUIL (ej: 30-71234567-9) o DNI..."
                    className="flex-1 px-3.5 py-2.5 text-sm font-mono font-bold bg-white text-slate-900 border-2 border-orange-400 rounded-xl focus:outline-none focus:border-[#FF6600]"
                  />
                  <button
                    type="button"
                    disabled={isLookingUpAfipCuit}
                    onClick={() => void handleLookupAfipCuit(quickClientCuit)}
                    className="px-4 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-60 text-white text-xs font-black uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  >
                    <Search className="w-4 h-4" />
                    <span>
                      {isLookingUpAfipCuit ? 'Consultando AFIP...' : 'Buscar CUIT'}
                    </span>
                  </button>
                </div>

                {afipLookupFeedback && (
                  <div
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                      afipLookupFeedback.type === 'success'
                        ? 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-300'
                        : afipLookupFeedback.type === 'error'
                        ? 'bg-rose-950/90 border border-rose-500/60 text-rose-300'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{afipLookupFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* 2. DATOS FISCALES AUTOCOMPLETADOS (RAZÓN SOCIAL, CONDICIÓN DE IVA, DOMICILIO FISCAL) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Razón Social / Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickClientName}
                    onChange={(e) => setQuickClientName(e.target.value)}
                    placeholder="Ej: Constructora El Puente S.R.L. / Juan Pérez"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Condición de IVA *
                  </label>
                  <select
                    value={quickClientTaxCondition}
                    onChange={(e) =>
                      setQuickClientTaxCondition(
                        e.target.value as
                          | 'Responsable Inscripto'
                          | 'Monotributista'
                          | 'Exento'
                          | 'Consumidor Final'
                      )
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600] cursor-pointer"
                  >
                    <option value="Responsable Inscripto">
                      Responsable Inscripto (Factura A)
                    </option>
                    <option value="Monotributista">
                      Monotributista (Factura B)
                    </option>
                    <option value="Exento">Exento (Factura B)</option>
                    <option value="Consumidor Final">
                      Consumidor Final (Factura B)
                    </option>
                  </select>
                </div>
              </div>

              {/* Domicilio Fiscal (Dirección, Localidad, Provincia) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Domicilio Fiscal (Dirección)
                  </label>
                  <input
                    type="text"
                    value={quickClientAddress}
                    onChange={(e) => setQuickClientAddress(e.target.value)}
                    placeholder="Ej: Av. Mitre 1450"
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Localidad
                  </label>
                  <input
                    type="text"
                    value={quickClientCity}
                    onChange={(e) => setQuickClientCity(e.target.value)}
                    placeholder="Ej: Avellaneda"
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={quickClientProvince}
                    onChange={(e) => setQuickClientProvince(e.target.value)}
                    placeholder="Ej: Buenos Aires"
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              {/* 3. CAMPOS OPCIONALES: TELÉFONO/WHATSAPP, EMAIL Y LISTA DE PRECIOS ASIGNADA POR DEFECTO */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-200">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={quickClientPhone}
                    onChange={(e) => setQuickClientPhone(e.target.value)}
                    placeholder="+54 9 11 4567-8901"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correo Electrónico (Email)
                  </label>
                  <input
                    type="email"
                    value={quickClientEmail}
                    onChange={(e) => setQuickClientEmail(e.target.value)}
                    placeholder="administracion@empresa.com.ar"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Lista de Precios por Defecto
                  </label>
                  <select
                    value={quickClientPriceListId}
                    onChange={(e) => setQuickClientPriceListId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-extrabold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600] cursor-pointer"
                  >
                    {posAvailablePriceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. HABILITAR CUENTA CORRIENTE (CHECKBOX/SWITCH -> LÍMITE DE CRÉDITO Y PLAZO DE PAGO) */}
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs font-extrabold text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickClientHasCredit}
                      onChange={(e) =>
                        setQuickClientHasCredit(e.target.checked)
                      }
                      className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                    />
                    <span>Habilitar Cuenta Corriente Comercial</span>
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      quickClientHasCredit
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {quickClientHasCredit ? 'Crédito Habilitado' : 'Contado'}
                  </span>
                </div>

                {quickClientHasCredit && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-extrabold text-amber-950 mb-1">
                        Límite de Crédito ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={quickClientCreditLimit}
                        onChange={(e) =>
                          setQuickClientCreditLimit(e.target.value)
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-amber-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold text-amber-950 mb-1">
                        Plazo de Pago (Días)
                      </label>
                      <select
                        value={quickClientPaymentTermsDays}
                        onChange={(e) =>
                          setQuickClientPaymentTermsDays(
                            Number(e.target.value) || 30
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs font-bold border border-amber-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600] cursor-pointer"
                      >
                        <option value={15}>15 días</option>
                        <option value={30}>30 días</option>
                        <option value={60}>60 días</option>
                        <option value={90}>90 días</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. NOTAS / OBSERVACIONES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas / Observaciones del Cliente
                </label>
                <input
                  type="text"
                  value={quickClientNotes}
                  onChange={(e) => setQuickClientNotes(e.target.value)}
                  placeholder="Ej: Autorizado retiro por capataz de obra, horario de entrega, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              {/* RESUMEN AUTOMÁTICO DE COMPROBANTE SUGERIDO + BOTÓN "GUARDAR Y ASIGNAR A LA VENTA" */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="text-[11px] text-slate-600">
                  Comprobante sugerido:{' '}
                  <strong className="font-extrabold text-slate-900">
                    {quickClientTaxCondition === 'Responsable Inscripto'
                      ? 'Factura A'
                      : 'Factura B'}
                  </strong>{' '}
                  · Lista:{' '}
                  <strong className="font-extrabold text-[#FF6600]">
                    {posAvailablePriceLists.find(
                      (p) => p.id === quickClientPriceListId
                    )?.name || 'Lista Normal'}
                  </strong>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickClientModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingQuickClient}
                    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide text-white bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {isCreatingQuickClient
                      ? 'Guardando...'
                      : 'Guardar y Asignar a la Venta'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GESTIÓN Y AUTORIZACIÓN DE CUENTA CORRIENTE (ESTADO ACTIVA/BLOQUEADA + LÍMITE DE CRÉDITO) */}
      {adminPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#FF6600]" />
                <h3 className="text-base font-bold text-slate-900">
                  Gestión de Cuenta Corriente (Administrador)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminPasswordModalOpen(false);
                  setAdminPasswordError('');
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Configure el estado de la Cuenta Corriente para{' '}
              <strong className="text-slate-900">{activeTab.clientName}</strong>{' '}
              entre <strong>Activa</strong> y <strong>Bloqueada</strong>, y
              ajuste el límite de crédito disponible con autorización de
              Administrador.
            </p>

            <form onSubmit={handleVerifyAdminPassword} className="space-y-3.5">
              {/* Estado de la Cuenta Corriente: Activa vs Bloqueada */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Estado de la Cuenta Corriente
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminAccountStatusInput('Activa')}
                    className={`py-2 px-3 rounded-lg border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      adminAccountStatusInput === 'Activa'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Activa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminAccountStatusInput('Bloqueada')}
                    className={`py-2 px-3 rounded-lg border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      adminAccountStatusInput === 'Bloqueada'
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Bloqueada</span>
                  </button>
                </div>
              </div>

              {/* Límite de Crédito Disponible */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Límite de Crédito Disponible ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={adminCreditLimitInput}
                  onChange={(e) => setAdminCreditLimitInput(e.target.value)}
                  placeholder="Ej: 1500000"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Saldo actual adeudado:{' '}
                  <strong className="font-mono">
                    {formatCurrency(selectedClientCurrentBalance)}
                  </strong>
                </p>
              </div>

              {/* Contraseña de Administrador */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contraseña de Administrador
                </label>
                <input
                  type="password"
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminPasswordError('');
                  }}
                  placeholder="Ingrese clave (ej: admin123)"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Clave de supervisor habilitada:{' '}
                  <code className="font-mono font-bold text-slate-600">
                    admin123
                  </code>
                </p>
                {adminPasswordError && (
                  <p className="text-xs font-semibold text-rose-600 mt-1">
                    {adminPasswordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdminPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  Guardar Estado y Límite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CÓDIGO QR PARA DESCARGA DE COMPROBANTE */}
      {completedSalePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-mono text-xs font-bold text-slate-900">
                {completedSalePrompt.voucher.docNumber}
              </span>
              <button
                type="button"
                onClick={() => setCompletedSalePrompt(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {completedSalePrompt.qrImageUrl && (
              <div className="flex flex-col items-center gap-3 py-2">
                <img
                  src={completedSalePrompt.qrImageUrl}
                  alt="Código QR Comprobante"
                  className="w-44 h-44 object-contain border border-slate-200 rounded-xl p-2"
                />
                <p className="text-xs font-semibold text-slate-700">
                  Escaneá el código QR para descargar el comprobante PDF
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletedSalePrompt(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = completedSalePrompt.voucher;
                  setCompletedSalePrompt(null);
                  setActiveVoucherModal({ voucher: v, tab: 'pdf' });
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white font-bold text-xs cursor-pointer"
              >
                Configurar Ticket / A4
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COBRO COMPLETO Y REGISTRO DE VENTA [F8] */}
      {paymentSelectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-slate-900 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6">
            {/* Encabezado del Modal de Cobro */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-orange-100 text-[#FF6600] text-[11px] font-black uppercase tracking-wider mb-1">
                  Cobro y Registro de Venta · Orden N°{' '}
                  {pendingOrderDocNumber || '0001-0001'}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Confirmar Medio de Pago, Vuelto y Comprobante
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccione el medio de pago, calcule el vuelto y elija si
                  desea emitir Ticket, Factura/Remito o enviar por WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentSelectionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
                title="Volver al carrito (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {posValidationError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-800">
                {posValidationError}
              </div>
            )}

            {/* Resumen de Cliente, Desglose de Descuentos y Totales Duales (Efectivo vs Tarjeta) */}
            {(() => {
              const isCardSelected =
                activeTab.priceListId === 'lista-tarjeta';
              const grossBeforeItemDisc = activeTab.items.reduce(
                (acc, item) => {
                  const baseP = isCardSelected
                    ? item.cardPrice ??
                      Number(
                        (
                          (item.normalPrice ?? item.baseUnitPrice) *
                          (1 + cardInterestPct / 100)
                        ).toFixed(2)
                      )
                    : item.normalPrice ?? item.baseUnitPrice;
                  return acc + item.quantity * baseP;
                },
                0
              );
              const itemDiscAmount = Math.max(
                0,
                Number((grossBeforeItemDisc - cartSubtotal).toFixed(2))
              );
              const totalDiscAmount = Number(
                (itemDiscAmount + cartDiscountAmount).toFixed(2)
              );

              const cashFinalWithGlobalDisc = Math.max(
                0,
                Number(
                  (
                    cartNormalTotal -
                    (activeTab.discountValue > 0
                      ? activeTab.discountMode === 'percent'
                        ? cartNormalTotal *
                          (Math.min(100, Math.max(0, activeTab.discountValue)) /
                            100)
                        : Math.min(cartNormalTotal, activeTab.discountValue)
                      : 0)
                  ).toFixed(2)
                )
              );
              const cardFinalWithGlobalDisc = Math.max(
                0,
                Number(
                  (
                    cartCardTotal -
                    (activeTab.discountValue > 0
                      ? activeTab.discountMode === 'percent'
                        ? cartCardTotal *
                          (Math.min(100, Math.max(0, activeTab.discountValue)) /
                            100)
                        : Math.min(cartCardTotal, activeTab.discountValue)
                      : 0)
                  ).toFixed(2)
                )
              );

              return (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">
                        Cliente
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                        {activeTab.clientName || 'Consumidor Final'}
                      </span>
                      <span className="text-xs font-mono text-slate-500 ml-2">
                        ({activeTab.clientCuit || '00-00000000-0'})
                      </span>
                    </div>

                    {/* Transparencia de Descuentos */}
                    <div className="text-right text-xs space-y-0.5">
                      <div className="text-slate-600">
                        Subtotal Original (s/Dto.):{' '}
                        <strong className="font-mono text-slate-900">
                          {formatCurrency(grossBeforeItemDisc)}
                        </strong>
                      </div>
                      {totalDiscAmount > 0 && (
                        <div className="text-emerald-700 font-bold">
                          Descuento Aplicado
                          {activeTab.discountMode === 'percent' &&
                          activeTab.discountValue > 0
                            ? ` (${activeTab.discountValue}%)`
                            : ''}
                          :{' '}
                          <span className="font-mono">
                            −{formatCurrency(totalDiscAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tarjetas de Total Efectivo vs Total Tarjeta/Lista */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      className={`p-2.5 rounded-xl border-2 flex items-center justify-between ${
                        !isCardSelected
                          ? 'bg-emerald-50 border-emerald-600'
                          : 'bg-white border-slate-200 opacity-75'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-black uppercase text-emerald-800">
                          Total Precio Efectivo
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          Efectivo / Transferencia / Débito
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-black text-emerald-700">
                        {formatCurrency(cashFinalWithGlobalDisc)}
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border-2 flex items-center justify-between ${
                        isCardSelected
                          ? 'bg-amber-50 border-amber-700'
                          : 'bg-white border-slate-200 opacity-75'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-black uppercase text-amber-900">
                          Total Precio Tarjeta / Lista
                        </div>
                        <div className="text-[11px] text-amber-800">
                          Tarjeta de Crédito (+{cardInterestPct}%)
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-black text-amber-900">
                        {formatCurrency(cardFinalWithGlobalDisc)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* PASO 1: SELECCIONAR MEDIO DE PAGO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  1. Medio de Pago
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateActiveTab((t) => {
                      const nextCombined = !t.isCombinedPayment;
                      return {
                        ...t,
                        isCombinedPayment: nextCombined,
                        combinedPayments:
                          nextCombined &&
                          (!t.combinedPayments || t.combinedPayments.length === 0)
                            ? [
                                {
                                  method: 'Efectivo',
                                  amount: Number((cartFinalTotal / 2).toFixed(2)),
                                },
                                {
                                  method: 'Transferencia',
                                  amount: Number(
                                    (
                                      cartFinalTotal -
                                      Number((cartFinalTotal / 2).toFixed(2))
                                    ).toFixed(2)
                                  ),
                                },
                              ]
                            : t.combinedPayments,
                      };
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                    activeTab.isCombinedPayment
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Split className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>
                    {activeTab.isCombinedPayment
                      ? '✓ Pago Combinado Activo'
                      : 'Combinar Formas de Pago'}
                  </span>
                </button>
              </div>

              {!activeTab.isCombinedPayment ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'Efectivo',
                        label: 'Efectivo',
                        sub: 'Precio Efectivo',
                        icon: Banknote,
                      },
                      {
                        id: 'Transferencia',
                        label: 'Transferencia',
                        sub: 'CBU / Alias',
                        icon: Landmark,
                      },
                      {
                        id: 'Tarjeta de Débito',
                        label: 'Tarjeta Débito',
                        sub: 'Débito inmediato',
                        icon: CreditCard,
                      },
                      {
                        id: 'Tarjeta de Crédito',
                        label: 'Tarjeta Crédito',
                        sub: 'Aplica Lista Tarjeta',
                        icon: CreditCard,
                      },
                      {
                        id: 'Cuenta Corriente',
                        label: 'Cuenta Corriente',
                        sub: selectedClientObj
                          ? `Saldo: ${formatCurrency(selectedClientCurrentBalance)}`
                          : 'Requiere cliente',
                        icon: Wallet,
                      },
                      {
                        id: 'QR',
                        label: 'Pago con QR',
                        sub: 'Billetera virtual',
                        icon: QrCode,
                      },
                    ] as const
                  ).map((pm) => {
                    const Icon = pm.icon;
                    const isSelected = activeTab.paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setPosValidationError(null);
                          if (pm.id === 'Tarjeta de Crédito') {
                            handleSelectPriceList('lista-tarjeta');
                            const cardTot = Math.max(
                              0,
                              Number(
                                (
                                  cartCardTotal -
                                  (activeTab.discountValue > 0
                                    ? activeTab.discountMode === 'percent'
                                      ? cartCardTotal *
                                        (Math.min(
                                          100,
                                          Math.max(0, activeTab.discountValue)
                                        ) /
                                          100)
                                      : Math.min(
                                          cartCardTotal,
                                          activeTab.discountValue
                                        )
                                    : 0)
                                ).toFixed(2)
                              )
                            );
                            setCustomerTenderedAmount(String(cardTot));
                          } else {
                            if (activeTab.priceListId === 'lista-tarjeta') {
                              handleSelectPriceList('lista-normal');
                            }
                            const cashTot = Math.max(
                              0,
                              Number(
                                (
                                  cartNormalTotal -
                                  (activeTab.discountValue > 0
                                    ? activeTab.discountMode === 'percent'
                                      ? cartNormalTotal *
                                        (Math.min(
                                          100,
                                          Math.max(0, activeTab.discountValue)
                                        ) /
                                          100)
                                      : Math.min(
                                          cartNormalTotal,
                                          activeTab.discountValue
                                        )
                                    : 0)
                                ).toFixed(2)
                              )
                            );
                            setCustomerTenderedAmount(String(cashTot));
                          }
                          updateActiveTab((t) => ({
                            ...t,
                            paymentMethod: pm.id,
                          }));
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-2 ${
                          isSelected
                            ? 'border-[#FF6600] bg-orange-50/70 text-slate-900 shadow-2xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#FF6600] text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold leading-tight">
                            {pm.label}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {pm.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    Distribución de Pagos Combinados
                  </div>
                  {(activeTab.combinedPayments || []).map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const nextMethod = e.target.value as PaymentMethodType;
                          updateActiveTab((t) => {
                            const list = [...(t.combinedPayments || [])];
                            list[idx] = { ...list[idx], method: nextMethod };
                            return { ...t, combinedPayments: list };
                          });
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta de Débito">
                          Tarjeta de Débito
                        </option>
                        <option value="Tarjeta de Crédito">
                          Tarjeta de Crédito
                        </option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="QR">QR</option>
                        <option value="Cuenta Corriente">
                          Cuenta Corriente
                        </option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.amount || ''}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          updateActiveTab((t) => {
                            const list = [...(t.combinedPayments || [])];
                            list[idx] = { ...list[idx], amount: val };
                            return { ...t, combinedPayments: list };
                          });
                        }}
                        className="w-36 px-3 py-1.5 text-xs font-mono font-bold text-right border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Aviso de Saldo Actualizado si elige Cuenta Corriente */}
              {activeTab.paymentMethod === 'Cuenta Corriente' &&
                !activeTab.isCombinedPayment && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      isCuentaCorrienteBlocked
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div>
                      <div className="font-extrabold">
                        {selectedClientObj
                          ? `Cuenta Corriente: ${selectedClientObj.name}`
                          : 'Seleccione un cliente para cargar en Cuenta Corriente'}
                      </div>
                      {selectedClientObj && (
                        <div className="text-[11px] font-mono mt-0.5">
                          Saldo Anterior:{' '}
                          <strong>
                            {formatCurrency(selectedClientCurrentBalance)}
                          </strong>{' '}
                          → Nuevo Saldo:{' '}
                          <strong>
                            {formatCurrency(
                              selectedClientCurrentBalance + cartFinalTotal
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                    {isCuentaCorrienteBlocked && selectedClientObj && (
                      <button
                        type="button"
                        onClick={handleOpenAdminCreditModal}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#FF6600]" />
                        <span>Autorizar / Activar Cta. Cte.</span>
                      </button>
                    )}
                  </div>
                )}
            </div>

            {/* PASO 2: CALCULADORA DE VUELTO (CUANDO PAGA EN EFECTIVO) */}
            {(activeTab.paymentMethod === 'Efectivo' ||
              activeTab.isCombinedPayment) && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                    2. Calculadora de Vuelto (Efectivo)
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { label: 'Exacto', val: cartFinalTotal },
                      { label: '$1.000', val: 1000 },
                      { label: '$2.000', val: 2000 },
                      { label: '$5.000', val: 5000 },
                      { label: '$10.000', val: 10000 },
                      { label: '$20.000', val: 20000 },
                      { label: '$50.000', val: 50000 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() =>
                          setCustomerTenderedAmount(String(btn.val))
                        }
                        className="px-2 py-1 rounded-md bg-white hover:bg-emerald-600 hover:text-white border border-emerald-300 text-[11px] font-mono font-bold text-emerald-900 transition-colors cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                      Con cuánto paga el cliente ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={customerTenderedAmount}
                      onChange={(e) =>
                        setCustomerTenderedAmount(e.target.value)
                      }
                      placeholder={String(cartFinalTotal)}
                      className="w-full px-3 py-2 text-base font-mono font-black border-2 border-emerald-400 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {(() => {
                    const tendered = Number(customerTenderedAmount) || 0;
                    const changeDue = Number(
                      (tendered - cartFinalTotal).toFixed(2)
                    );
                    return (
                      <div
                        className={`p-2.5 rounded-xl border-2 text-right ${
                          changeDue >= 0
                            ? 'bg-white border-emerald-500 text-emerald-800'
                            : 'bg-amber-50 border-amber-300 text-amber-900'
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-wider">
                          {changeDue >= 0
                            ? 'VUELTO A ENTREGAR AL CLIENTE'
                            : 'FALTA CUBRIR'}
                        </div>
                        <div className="text-xl sm:text-2xl font-mono tabular-nums font-black">
                          {formatCurrency(Math.abs(changeDue))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* PASO 3: OPCIONES DE COMPROBANTE / ENTREGABLE AL CLIENTE */}
            <div className="space-y-2.5">
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                3. Comprobante / Entregable al Cliente
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    {
                      id: 'Sin comprobante',
                      title: 'No emitir ticket',
                      desc: 'Solo registro interno',
                    },
                    {
                      id: 'Ticket 58mm',
                      title: 'Ticket Físico',
                      desc: 'Imprimir térmico 58mm',
                    },
                    {
                      id: 'Factura / Remito',
                      title: 'Factura / Remito',
                      desc: 'Comprobante A4 / PDF',
                    },
                    {
                      id: 'WhatsApp',
                      title: 'Enviar WhatsApp',
                      desc: 'Comprobante digital',
                    },
                  ] as const
                ).map((opt) => {
                  const isSelected = deliverableMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setPosValidationError(null);
                        setDeliverableMode(opt.id);
                      }}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{opt.title}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? 'text-orange-300' : 'text-slate-500'
                        }`}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Si seleccionó Factura / Remito, permitir elegir el tipo de documento */}
              {deliverableMode === 'Factura / Remito' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Tipo de Documento A4 / PDF:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      ['Factura B', 'Factura A', 'Factura C', 'Remito'] as const
                    ).map((docT) => (
                      <button
                        key={docT}
                        type="button"
                        onClick={() =>
                          updateActiveTab((t) => ({
                            ...t,
                            billingType: docT,
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                          (activeTab.billingType || 'Factura B') === docT
                            ? 'bg-[#FF6600] text-white border-[#FF6600]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {docT}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Si seleccionó WhatsApp, mostrar campo para ingresar o confirmar el teléfono del cliente */}
              {deliverableMode === 'WhatsApp' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1.5">
                  <label className="block text-xs font-extrabold text-emerald-950">
                    Número de Teléfono / WhatsApp del Cliente:
                  </label>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={activeTab.clientPhone}
                      onChange={(e) => {
                        setPosValidationError(null);
                        updateActiveTab((t) => ({
                          ...t,
                          clientPhone: e.target.value,
                        }));
                      }}
                      placeholder="Ej: 5491122334455 (código de país + área + número)"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-emerald-400 rounded-lg focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Al confirmar la venta se generará el PDF con el desglose de
                    descuentos y se abrirá el envío por WhatsApp a este número.
                  </p>
                </div>
              )}
            </div>

            {/* Botones de Confirmación Final */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isProcessingCheckout}
                onClick={() => void handleFinalizeSaleCheckout(true)}
                className="py-2.5 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                title="Atajo F4: Registra inmediatamente en Efectivo sin emitir ticket físico"
              >
                <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200 font-mono text-[10px] font-black">
                  F4
                </span>
                <span>Cobro Rápido (Efectivo · Sin Ticket)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSelectionModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isProcessingCheckout}
                  onClick={() => void handleFinalizeSaleCheckout(false)}
                  className="flex-1 sm:flex-initial py-3 px-5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isProcessingCheckout
                      ? 'REGISTRANDO...'
                      : `Confirmar y Registrar Venta (${formatCurrency(
                          cartFinalTotal
                        )})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: VISTA PREVIA E IMPRESIÓN / WHATSAPP DEL COMPROBANTE */}
      {activeVoucherModal && (
        <VoucherActionModal
          voucher={activeVoucherModal.voucher}
          initialTab={activeVoucherModal.tab}
          onClose={() => setActiveVoucherModal(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* MODAL 5: CUADRO DE DIÁLOGO POST-VENTA (AJUSTE MANUAL DE STOCK) */}
      {postSaleStockPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-emerald-500 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
            {/* Cabecera del Modal Post-Venta */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase">
                      Venta #{postSaleStockPrompt.docNumber} Completada
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                    ¿Deseas actualizar el stock actual de los productos vendidos?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPostSaleStockPrompt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Omitir y cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmPostSaleStockUpdate}
              className="p-5 space-y-4"
            >
              <p className="text-xs text-slate-600 leading-relaxed">
                Verifique o ingrese la cantidad exacta de unidades físicas que quedaron en estantería luego de esta venta. El sistema registrará el ajuste en el historial de inventario.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">Producto y SKU</th>
                      <th className="py-2.5 px-3 text-center">Cant. Vendida</th>
                      <th className="py-2.5 px-3 text-center">
                        Stock Sistema Actual
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        Nuevo Stock Real / Actual
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {postSaleStockPrompt.items.map((item, idx) => {
                      const enteredNum = Math.max(
                        0,
                        Math.round(Number(item.newRealStockInput) || 0)
                      );
                      const isModified =
                        enteredNum !== item.calculatedSystemStock;
                      return (
                        <tr
                          key={`${item.productId}-${idx}`}
                          className={
                            isModified ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">
                              {item.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              SKU: {item.sku}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-100 text-[#FF6600] font-mono font-extrabold text-xs">
                              -{item.soldQuantity} u.
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-slate-700 text-xs">
                              {item.calculatedSystemStock} u.
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Calculado post-venta
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                autoFocus={idx === 0}
                                value={item.newRealStockInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPostSaleStockPrompt((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          items: prev.items.map((it, i) =>
                                            i === idx
                                              ? {
                                                  ...it,
                                                  newRealStockInput: val,
                                                }
                                              : it
                                          ),
                                        }
                                      : null
                                  );
                                }}
                                className={`w-24 px-2.5 py-1.5 text-right font-mono text-sm font-extrabold rounded-lg border focus:outline-none ${
                                  isModified
                                    ? 'bg-white border-emerald-600 text-emerald-800 ring-2 ring-emerald-500/20'
                                    : 'bg-white border-slate-300 text-slate-900 focus:border-[#FF6600]'
                                }`}
                              />
                              <span className="text-xs font-mono font-semibold text-slate-500">
                                u.
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPostSaleStockPrompt(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-extrabold cursor-pointer transition-colors"
                >
                  Omitir / Mantener Stock Calculado
                </button>
                <button
                  type="submit"
                  disabled={isSavingPostSaleStock}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingPostSaleStock
                      ? 'Guardando Stock...'
                      : 'Guardar y Actualizar Stock'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
