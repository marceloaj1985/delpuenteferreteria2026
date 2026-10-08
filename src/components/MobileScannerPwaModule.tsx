import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Barcode,
  PackagePlus,
  Truck,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  ImagePlus,
  Trash2,
  Plus,
  Minus,
  Send,
  Mail,
  MessageCircle,
  Search,
  Sparkles,
  FileText,
  X,
  Check,
  AlertCircle,
  UserCheck,
  Users,
  Smartphone,
  Download,
  ArrowLeft,
} from 'lucide-react';
import {
  Product,
  Client,
  ProductItem,
  ClientItem,
  SupplierItem,
  CommercialDocument,
  ScannerAuditLogItem,
} from '../types/ferreteria.ts';
import {
  saveSupplierPersistentCartsMap,
  loadSupplierPersistentCartsMap,
} from '../lib/supplierCartsStorage.ts';

export type ScannerModeType = 'stock' | 'supplier_order' | 'mini_pos';

export interface PersistentSupplierCartItem {
  productId: number;
  sku: string;
  barcode?: string;
  name: string;
  supplierName: string;
  costPrice: number;
  currentStock: number;
  minStock: number;
  quantity: number;
  addedAt: string;
}

export type SupplierCartsMap = Record<string, PersistentSupplierCartItem[]>;

export interface MiniPosBudgetItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface SavedScannerBudget {
  id: string;
  docNumber: string;
  createdAt: string;
  clientId: number | null;
  clientName: string;
  clientCuit: string;
  clientPhone: string;
  clientEmail: string;
  totalAmount: number;
  items: {
    productId: number;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

const SUPPLIER_PERSISTENT_CARTS_KEY = 'ferreteria_scanner_supplier_carts_v1';
const PRODUCT_PHOTOS_STORAGE_KEY = 'ferreteria_scanner_product_photos_v1';
const SAVED_BUDGETS_STORAGE_KEY = 'ferreteria_saved_budgets_list_v1';
const MOBILE_OPERATOR_STORAGE_KEY = 'ferreteria_scanner_mobile_operator_v1';

export interface MobileOperatorOption {
  name: string;
  role: string;
  badge: string;
}

const DEFAULT_MOBILE_OPERATORS: MobileOperatorOption[] = [
  {
    name: 'Martín Gómez',
    role: 'Encargado / Depósito y Ventas',
    badge: 'Turno Mañana / Tarde',
  },
  {
    name: 'Juan Pérez',
    role: 'Operador de Stock y Recepción',
    badge: 'Depósito Central',
  },
  {
    name: 'Lucas Fernández',
    role: 'Vendedor Mostrador / Pedidos',
    badge: 'Salón de Ventas',
  },
  {
    name: 'Carla Méndez',
    role: 'Control de Inventario y Caja',
    badge: 'Administración',
  },
];

interface MobileScannerPwaModuleProps {
  initialMode?: ScannerModeType;
  products?: ProductItem[];
  clients?: ClientItem[];
  suppliers?: SupplierItem[];
  operators?: Array<{ name: string; role?: string }>;
  branchName?: string;
  sellerName?: string;
  formatCurrency?: (val: string | number) => string;
  onProductsUpdated?: (nextProducts: ProductItem[], toastMsg?: string) => void;
  onAuditLogsUpdated?: (nextLogs: ScannerAuditLogItem[]) => void;
  onBack?: () => void;
  onInstallPwaClick?: () => void;
  isPwaInstalled?: boolean;
  onOrderConfirmed?: (payload: {
    documents?: CommercialDocument[];
    products?: ProductItem[];
    toastMsg?: string;
    redirectToPos?: boolean;
  }) => void;
}

function normalizeProduct(p: ProductItem): Product {
  return {
    ...p,
    code: p.sku,
    precioVenta: parseFloat(String(p.salePrice || '0')) || 0,
    precioCosto: parseFloat(String(p.costPrice || '0')) || 0,
  };
}

function loadSupplierPersistentCarts(): SupplierCartsMap {
  return loadSupplierPersistentCartsMap();
}

function saveSupplierPersistentCarts(
  map: SupplierCartsMap,
  suppliersList: SupplierItem[] = []
) {
  saveSupplierPersistentCartsMap(map, suppliersList);
}

function loadProductPhotosMap(): Record<number, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRODUCT_PHOTOS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveProductPhotosMap(map: Record<number, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PRODUCT_PHOTOS_STORAGE_KEY,
      JSON.stringify(map)
    );
  } catch {
    // ignore quota error
  }
}

function playScannerBeep(enabled: boolean) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(75);
    } catch {
      // ignore
    }
  }
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(1350, now);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {
    // ignore
  }
}

export const MobileScannerPwaModule: React.FC<MobileScannerPwaModuleProps> = ({
  initialMode = 'stock',
  products: externalProducts,
  clients: externalClients,
  suppliers: externalSuppliers,
  operators: externalOperators,
  branchName = 'Sucursal Central',
  sellerName = 'Martín Gómez',
  formatCurrency: externalFormatCurrency,
  onProductsUpdated,
  onAuditLogsUpdated,
  onBack,
  onOrderConfirmed,
}) => {
  const formatMoney = useCallback(
    (val: string | number) => {
      if (externalFormatCurrency) return externalFormatCurrency(val);
      const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      return `$${num.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [externalFormatCurrency]
  );

  // OPCIÓN B: Selección de Operador / Inicio de Turno persistido en localStorage del celular
  const [mobileOperator, setMobileOperator] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(MOBILE_OPERATOR_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [showOperatorSelector, setShowOperatorSelector] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(MOBILE_OPERATOR_STORAGE_KEY);
      return !saved || !saved.trim();
    } catch {
      return true;
    }
  });

  const operatorOptions = useMemo<MobileOperatorOption[]>(() => {
    const map = new Map<string, MobileOperatorOption>();
    DEFAULT_MOBILE_OPERATORS.forEach((op) => map.set(op.name, op));
    if (Array.isArray(externalOperators)) {
      externalOperators.forEach((op) => {
        if (op.name && op.name.trim() && !map.has(op.name.trim())) {
          map.set(op.name.trim(), {
            name: op.name.trim(),
            role: op.role || 'Operador de Turno',
            badge: 'Personal Autorizado',
          });
        }
      });
    }
    return Array.from(map.values());
  }, [externalOperators]);

  const activeOperatorName = (mobileOperator || sellerName || 'Martín Gómez').trim();

  const handleSelectMobileOperator = (opName: string) => {
    const clean = opName.trim();
    if (!clean) return;
    setMobileOperator(clean);
    setShowOperatorSelector(false);
    try {
      window.localStorage.setItem(MOBILE_OPERATOR_STORAGE_KEY, clean);
    } catch {
      // ignore storage error
    }
  };

  // Helper para registrar auditoría en la base de datos central (PostgreSQL)
  const recordDatabaseAuditLog = useCallback(
    async (payload: {
      actionType: 'Carga de Stock' | 'Pedido a Proveedor' | 'Presupuesto Mini POS';
      actionDetail: string;
      referenceCode: string;
      targetName: string;
    }) => {
      try {
        const res = await fetch('/api/scanner/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorName: activeOperatorName,
            actionType: payload.actionType,
            actionDetail: payload.actionDetail,
            referenceCode: payload.referenceCode,
            targetName: payload.targetName,
            branchName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs) && onAuditLogsUpdated) {
            onAuditLogsUpdated(data.logs);
          }
        }
      } catch {
        // ignore network error
      }
    },
    [activeOperatorName, branchName, onAuditLogsUpdated]
  );

  // Selector de los 3 Modos Diferenciados del Escáner Móvil
  const [activeMode, setActiveMode] = useState<ScannerModeType>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  // Activación automática de Pantalla Completa (Fullscreen API & Meta Tags PWA) en dispositivos móviles
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const ensureMetaTag = (name: string, content: string) => {
      let meta = document.querySelector(
        `meta[name="${name}"]`
      ) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    ensureMetaTag(
      'viewport',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
    ensureMetaTag('mobile-web-app-capable', 'yes');
    ensureMetaTag('apple-mobile-web-app-capable', 'yes');
    ensureMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');

    const triggerFullscreen = () => {
      try {
        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        const isAlreadyFullscreen =
          Boolean(document.fullscreenElement) ||
          Boolean((document as any).webkitFullscreenElement);

        if (!isAlreadyFullscreen) {
          if (typeof docEl.requestFullscreen === 'function') {
            docEl.requestFullscreen().catch(() => {});
          } else if (typeof docEl.webkitRequestFullscreen === 'function') {
            docEl.webkitRequestFullscreen();
          } else if (typeof docEl.msRequestFullscreen === 'function') {
            docEl.msRequestFullscreen();
          }
        }
      } catch {
        // Ignorar si el navegador restringe la solicitud sin gesto previo
      }
    };

    // Ejecutar inmediatamente al montar la vista de Stock Móvil Rápido
    triggerFullscreen();

    // Respaldo automático en el primer toque/clic si el navegador móvil bloqueó la ejecución inicial sin gesto
    const handleFirstUserInteraction = () => {
      triggerFullscreen();
    };

    window.addEventListener('touchstart', handleFirstUserInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener('click', handleFirstUserInteraction, {
      once: true,
      passive: true,
    });

    return () => {
      window.removeEventListener('touchstart', handleFirstUserInteraction);
      window.removeEventListener('click', handleFirstUserInteraction);
    };
  }, []);

  // Catálogos sincronizados
  const [products, setProducts] = useState<Product[]>(() =>
    externalProducts && externalProducts.length > 0
      ? externalProducts.map(normalizeProduct)
      : []
  );
  const [clients, setClients] = useState<Client[]>(
    () => externalClients || []
  );
  const [suppliers, setSuppliers] = useState<SupplierItem[]>(
    () => externalSuppliers || []
  );
  const [loading, setLoading] = useState<boolean>(
    !externalProducts || externalProducts.length === 0
  );

  // Buscador / Lector universal con Selección Automática al Escanear
  const [scannerInput, setScannerInput] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() =>
    externalProducts && externalProducts.length > 0
      ? normalizeProduct(externalProducts[0])
      : null
  );
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);

  // Fotos de productos asociadas (Modo 1)
  const [productPhotos, setProductPhotos] = useState<Record<number, string>>(
    () => loadProductPhotosMap()
  );
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados editables de MODO 1: CARGA DE STOCK AL INVENTARIO
  const [stockToAddInput, setStockToAddInput] = useState<number>(1);
  const [directStockInput, setDirectStockInput] = useState<number>(0);
  const [directMinStockInput, setDirectMinStockInput] = useState<number>(0);
  const [directSuggestedStockInput, setDirectSuggestedStockInput] =
    useState<number>(0);
  const [directTrackStock, setDirectTrackStock] = useState<boolean>(true);
  const [wasAutoActivatedTrackStock, setWasAutoActivatedTrackStock] =
    useState<boolean>(false);
  const [directSalePriceInput, setDirectSalePriceInput] = useState<string>('0');
  const [directCostPriceInput, setDirectCostPriceInput] = useState<string>('0');
  const [stockSessionFinishedSummary, setStockSessionFinishedSummary] =
    useState<number | null>(null);
  const [stockProcessedCount, setStockProcessedCount] = useState<number>(0);
  const [isSavingStock, setIsSavingStock] = useState<boolean>(false);
  const [dbSaveToast, setDbSaveToast] = useState<{
    type: 'success' | 'error';
    message: string;
    retryMode?: 'next' | 'finish';
  } | null>(null);

  // Estados de MODO 2: PEDIDO RÁPIDO MÓVIL A PROVEEDORES (Carritos Persistentes por Proveedor)
  const [supplierCarts, setSupplierCarts] = useState<SupplierCartsMap>(() =>
    loadSupplierPersistentCarts()
  );
  const [activeSupplierName, setActiveSupplierName] = useState<string>('');
  const [supplierOrderQtyInput, setSupplierOrderQtyInput] = useState<number>(1);
  const [confirmingSendSupplier, setConfirmingSendSupplier] = useState<
    string | null
  >(null);
  // Método de entrada deslizable en Pedido Rápido Móvil: 'manual' vs 'camera'
  const [orderInputMethod, setOrderInputMethod] = useState<'manual' | 'camera'>(
    'manual'
  );
  // Modal táctil en pantalla completa con teclado numérico 0-9: "¿Cuántas unidades deseas agregar al pedido?"
  const [orderQtyModalProduct, setOrderQtyModalProduct] =
    useState<Product | null>(null);
  const [orderQtyKeypadStr, setOrderQtyKeypadStr] = useState<string>('');
  const [orderQtyDefaultVal, setOrderQtyDefaultVal] = useState<number>(1);
  // Desplegable / pestaña visual para revisar o ajustar los ítems del carrito del proveedor
  const [supplierCartExpanded, setSupplierCartExpanded] =
    useState<boolean>(true);
  // Confirmación posterior al envío por WhatsApp antes de vaciar exclusivamente ese carrito
  const [pendingWhatsAppClearSupplier, setPendingWhatsAppClearSupplier] =
    useState<{
      supplierName: string;
      orderNum: string;
      waUrl: string;
    } | null>(null);

  // Estados de MODO 3: MINI POS (PRESUPUESTOS)
  const [miniPosCart, setMiniPosCart] = useState<MiniPosBudgetItem[]>([]);
  const [miniPosQtyInput, setMiniPosQtyInput] = useState<number>(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(() =>
    externalClients && externalClients.length > 0 ? externalClients[0] : null
  );
  const [clientWhatsappPhone, setClientWhatsappPhone] = useState<string>(() => {
    const p = externalClients?.[0]?.phone;
    return p && p !== '-' ? p : '';
  });
  const [clientEmailInput, setClientEmailInput] = useState<string>(() => {
    const em = externalClients?.[0]?.email;
    return em && em !== '-' ? em : '';
  });
  const [lastSavedBudget, setLastSavedBudget] =
    useState<SavedScannerBudget | null>(null);
  const [isSavingBudget, setIsSavingBudget] = useState<boolean>(false);

  // Cámara móvil en vivo + Beep
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>(
    'environment'
  );
  const [beepEnabled, setBeepEnabled] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCodeTimeRef = useRef<{ code: string; time: number }>({
    code: '',
    time: 0,
  });

  // Persistir carritos de proveedores siempre que cambien y sincronizar con el módulo de Proveedores
  useEffect(() => {
    saveSupplierPersistentCarts(supplierCarts, suppliers);
  }, [supplierCarts, suppliers]);

  // Escuchar cambios de carritos hechos desde otros módulos
  useEffect(() => {
    const handleStorageSync = () => {
      const latest = loadSupplierPersistentCarts();
      setSupplierCarts((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(latest)) return prev;
        return latest;
      });
    };
    window.addEventListener('storage', handleStorageSync);
    window.addEventListener('supplier-carts-updated', handleStorageSync);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('supplier-carts-updated', handleStorageSync);
    };
  }, []);

  // Persistir fotos de productos siempre que cambien
  useEffect(() => {
    saveProductPhotosMap(productPhotos);
  }, [productPhotos]);

  // Sincronizar catálogos externos
  useEffect(() => {
    if (externalProducts && externalProducts.length > 0) {
      const normalized = externalProducts.map(normalizeProduct);
      setProducts(normalized);
      setLoading(false);
      setSelectedProduct((prev) => {
        if (!prev) return normalized[0];
        const updated = normalized.find((p) => p.id === prev.id);
        return updated || prev;
      });
    }
  }, [externalProducts]);

  useEffect(() => {
    if (externalClients && externalClients.length > 0) {
      setClients(externalClients);
      if (!selectedClient) {
        setSelectedClient(externalClients[0]);
        if (externalClients[0].phone && externalClients[0].phone !== '-') {
          setClientWhatsappPhone(externalClients[0].phone);
        }
        if (externalClients[0].email && externalClients[0].email !== '-') {
          setClientEmailInput(externalClients[0].email);
        }
      }
    }
  }, [externalClients, selectedClient]);

  useEffect(() => {
    if (externalSuppliers && externalSuppliers.length > 0) {
      setSuppliers(externalSuppliers);
    }
  }, [externalSuppliers]);

  // Lista unificada de nombres de proveedores disponibles
  const availableSupplierNames = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    });
    products.forEach((p) => {
      if (p.supplierName && p.supplierName.trim()) set.add(p.supplierName.trim());
    });
    Object.keys(supplierCarts).forEach((k) => {
      if (k.trim()) set.add(k.trim());
    });
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    return arr.length > 0 ? arr : ['Proveedor General'];
  }, [suppliers, products, supplierCarts]);

  useEffect(() => {
    if (!activeSupplierName && availableSupplierNames.length > 0) {
      setActiveSupplierName(availableSupplierNames[0]);
    }
  }, [activeSupplierName, availableSupplierNames]);

  // Auto-activación de Control de Stock ("Lleva Control de Stock" / controla_stock = true) al editar cualquier campo de stock
  const activateStockControlOnEdit = useCallback(() => {
    setDirectTrackStock((prevTrack) => {
      if (!prevTrack) {
        setWasAutoActivatedTrackStock(true);
      }
      return true;
    });
    setSelectedProduct((prevProd) => {
      if (!prevProd) return prevProd;
      if (!prevProd.trackStock) {
        return {
          ...prevProd,
          trackStock: true,
          hadStock: true,
          status: 'Activo',
        };
      }
      return prevProd;
    });
  }, []);

  // Cuando cambia el producto seleccionado automáticamente, sincronizar sus datos en pantalla
  const applyAutoSelectedProduct = useCallback(
    (prod: Product, sourceLabel = 'Código escaneado') => {
      playScannerBeep(beepEnabled);
      setSelectedProduct(prod);
      setStockSessionFinishedSummary(null);
      setStockToAddInput(1);
      setDirectStockInput(prod.stock ?? 0);
      setDirectMinStockInput(prod.minStock ?? 0);
      setDirectSuggestedStockInput(
        prod.suggestedStock ?? Math.max((prod.minStock || 0) * 2, 0)
      );
      setDirectTrackStock(Boolean(prod.trackStock ?? true));
      setWasAutoActivatedTrackStock(false);
      setDirectSalePriceInput(
        String(prod.precioVenta || prod.salePrice || '0')
      );
      setDirectCostPriceInput(
        String(prod.precioCosto || prod.costPrice || '0')
      );
      const suggestedQty = Math.max(
        1,
        (prod.minStock || 5) - prod.stock > 0
          ? (prod.minStock || 5) - prod.stock
          : 1
      );
      setSupplierOrderQtyInput(suggestedQty);
      setMiniPosQtyInput(1);

      const recognizedSupplier =
        prod.supplierName && prod.supplierName.trim()
          ? prod.supplierName.trim()
          : 'Proveedor General';
      setActiveSupplierName(recognizedSupplier);

      // Si estamos en "Pedido Rápido Móvil" (supplier_order), abrir inmediatamente el modal táctil 0-9 en pantalla completa
      if (activeMode === 'supplier_order') {
        setOrderQtyModalProduct(prod);
        setOrderQtyDefaultVal(suggestedQty);
        setOrderQtyKeypadStr('');
      }

      setFeedbackBanner({
        type: 'success',
        text: `${sourceLabel}: [${prod.code || prod.sku}] ${prod.name} · Proveedor: ${recognizedSupplier}`,
      });
    },
    [beepEnabled, activeMode]
  );

  // Sincronizar automáticamente Stock Actual, Stock Mínimo y Stock Sugerido cuando cambia el SKU seleccionado
  useEffect(() => {
    if (selectedProduct) {
      setDirectStockInput(selectedProduct.stock ?? 0);
      setDirectMinStockInput(selectedProduct.minStock ?? 0);
      setDirectSuggestedStockInput(
        selectedProduct.suggestedStock ??
          Math.max((selectedProduct.minStock || 0) * 2, 0)
      );
      setDirectTrackStock(Boolean(selectedProduct.trackStock ?? true));
      setWasAutoActivatedTrackStock(false);
      setDirectSalePriceInput(
        String(selectedProduct.precioVenta || selectedProduct.salePrice || '0')
      );
      setDirectCostPriceInput(
        String(selectedProduct.precioCosto || selectedProduct.costPrice || '0')
      );
      if (selectedProduct.supplierName) {
        setActiveSupplierName(selectedProduct.supplierName);
      }
    }
  }, [selectedProduct?.id]);
  // Cargar datos si no vinieron por props
  useEffect(() => {
    if (
      !externalProducts ||
      externalProducts.length === 0 ||
      !externalClients ||
      externalClients.length === 0
    ) {
      void loadDataFromApi();
    }
  }, []);

  const loadDataFromApi = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workspace');
      if (!res.ok) throw new Error('Error al obtener datos');
      const data = await res.json();
      const prodsData: Product[] = Array.isArray(data.products)
        ? data.products.map(normalizeProduct)
        : [];
      const clientsData: Client[] = Array.isArray(data.clients)
        ? data.clients
        : [];
      const suppliersData: SupplierItem[] = Array.isArray(data.suppliers)
        ? data.suppliers
        : [];

      setProducts(prodsData);
      setClients(clientsData);
      if (suppliersData.length > 0) setSuppliers(suppliersData);

      if (clientsData.length > 0) {
        setSelectedClient(clientsData[0]);
        if (clientsData[0].phone && clientsData[0].phone !== '-') {
          setClientWhatsappPhone(clientsData[0].phone);
        }
        if (clientsData[0].email && clientsData[0].email !== '-') {
          setClientEmailInput(clientsData[0].email);
        }
      }

      if (prodsData.length > 0) {
        setSelectedProduct(prodsData[0]);
        setDirectStockInput(prodsData[0].stock ?? 0);
        setDirectMinStockInput(prodsData[0].minStock ?? 0);
        setDirectSuggestedStockInput(
          prodsData[0].suggestedStock ??
            Math.max((prodsData[0].minStock || 0) * 2, 0)
        );
        setDirectSalePriceInput(
          String(prodsData[0].precioVenta || prodsData[0].salePrice || '0')
        );
        setDirectCostPriceInput(
          String(prodsData[0].precioCosto || prodsData[0].costPrice || '0')
        );
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Control de Cámara Móvil en Vivo
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: cameraFacing } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraActive(false);
    }
  }, [cameraFacing]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 1. SELECCIÓN AUTOMÁTICA AL ESCANEAR O INGRESAR CÓDIGO DE BARRAS / SKU
  const findExactProductByCode = useCallback(
    (rawCode: string): Product | undefined => {
      const q = rawCode.trim().toLowerCase();
      if (!q) return undefined;
      return products.find(
        (p) =>
          (p.code || p.sku).toLowerCase() === q ||
          (p.barcode && p.barcode.toLowerCase() === q) ||
          String(p.id).toLowerCase() === q
      );
    },
    [products]
  );

  // Al escribir en el campo de escaneo: NO auto-selecciona al tipear; requiere presionar ENTER para confirmar
  const handleScannerInputChange = (val: string) => {
    setScannerInput(val);
  };

  // Al presionar Enter o Escanear en el formulario de código/búsqueda
  const handleScannerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = scannerInput.trim();
    if (!q) return;

    const exact = findExactProductByCode(q);
    if (exact) {
      applyAutoSelectedProduct(exact, 'Código detectado');
      setScannerInput('');
      return;
    }

    const partial = products.find(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.code || p.sku).toLowerCase().includes(q.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(q.toLowerCase()))
    );
    if (partial) {
      applyAutoSelectedProduct(partial, 'Producto encontrado');
      setScannerInput('');
    } else {
      setFeedbackBanner({
        type: 'warning',
        text: `No se encontró ningún artículo con el código o referencia "${q}".`,
      });
    }
  };

  // Detección continua por Cámara Móvil -> Selección Automática Inmediata
  useEffect(() => {
    if (!cameraActive) return;
    const BarcodeDetectorApi = (window as unknown as { BarcodeDetector?: any })
      .BarcodeDetector;
    if (!BarcodeDetectorApi) return;

    let cancelled = false;
    let detector: any = null;
    try {
      detector = new BarcodeDetectorApi({
        formats: [
          'ean_13',
          'ean_8',
          'code_128',
          'code_39',
          'upc_a',
          'upc_e',
          'qr_code',
        ],
      });
    } catch {
      return;
    }

    const timer = window.setInterval(async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        if (Array.isArray(codes) && codes.length > 0) {
          const rawValue = String(codes[0].rawValue || '').trim();
          const now = Date.now();
          if (
            rawValue &&
            (rawValue !== lastCodeTimeRef.current.code ||
              now - lastCodeTimeRef.current.time > 1400)
          ) {
            lastCodeTimeRef.current = { code: rawValue, time: now };
            const found =
              findExactProductByCode(rawValue) ||
              products.find((p) =>
                p.name.toLowerCase().includes(rawValue.toLowerCase())
              );
            if (found) {
              applyAutoSelectedProduct(found, 'Escaneo por Cámara');
            }
          }
        }
      } catch {
        // ignore frame error
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cameraActive, products, findExactProductByCode, applyAutoSelectedProduct]);

  // Sugerencias en vivo mientras escribe nombre o parte del código
  const matchingSuggestions = useMemo(() => {
    const q = scannerInput.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code || p.sku).toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [products, scannerInput]);

  // ====================================================================
  // MODO 1: CARGA DE STOCK AL INVENTARIO (Foto + Guardar y Finalizar / Siguiente)
  // ====================================================================
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        setProductPhotos((prev) => ({
          ...prev,
          [selectedProduct.id]: dataUrl,
        }));
        setFeedbackBanner({
          type: 'success',
          text: `Foto adjuntada correctamente para [${selectedProduct.code || selectedProduct.sku}] ${selectedProduct.name}.`,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCaptureFrameFromLiveCamera = () => {
    if (!cameraActive || !videoRef.current || !selectedProduct) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setProductPhotos((prev) => ({
        ...prev,
        [selectedProduct.id]: dataUrl,
      }));
      playScannerBeep(beepEnabled);
      setFeedbackBanner({
        type: 'success',
        text: `Foto capturada desde la cámara para ${selectedProduct.name}.`,
      });
    } catch {
      // ignore capture error
    }
  };

  const handleSaveStockChanges = async (mode: 'finish' | 'next') => {
    if (!selectedProduct || isSavingStock) return;
    setIsSavingStock(true);
    setDbSaveToast(null);
    playScannerBeep(beepEnabled);

    const updatedStock = Math.max(0, Number(directStockInput) || 0);
    const updatedMinStock = Math.max(0, Number(directMinStockInput) || 0);
    const updatedSuggestedStock = Math.max(
      0,
      Number(directSuggestedStockInput) || 0
    );
    const updatedSalePrice = Math.max(0, parseFloat(directSalePriceInput) || 0);
    const updatedCostPrice = Math.max(0, parseFloat(directCostPriceInput) || 0);

    // 1. Auto-activación: Al editar y confirmar el stock desde la app móvil, controla_stock / trackStock pasa automáticamente a true
    const finalTrackStock = true;
    const previousStock = selectedProduct.stock ?? 0;
    const stockDelta = updatedStock - previousStock;

    const updatedProduct: Product = {
      ...selectedProduct,
      trackStock: finalTrackStock,
      hadStock: true,
      status: 'Activo',
      stock: updatedStock,
      minStock: updatedMinStock,
      suggestedStock: updatedSuggestedStock,
      salePrice: updatedSalePrice.toFixed(2),
      costPrice: updatedCostPrice.toFixed(2),
      precioVenta: updatedSalePrice,
      precioCosto: updatedCostPrice,
    };

    try {
      // 2. Llamada directa a la API / Base de Datos PostgreSQL para persistir en la tabla principal de INVENTARIO
      let res = await fetch(`/api/products/${selectedProduct.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackStock: true,
          controla_stock: true,
          stock: updatedStock,
          minStock: updatedMinStock,
          suggestedStock: updatedSuggestedStock,
        }),
      });

      if (!res.ok) {
        res = await fetch(`/api/products/${selectedProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...updatedProduct,
            trackStock: true,
            controla_stock: true,
            stock: updatedStock,
            minStock: updatedMinStock,
            suggestedStock: updatedSuggestedStock,
            salePrice: updatedSalePrice.toFixed(2),
            costPrice: updatedCostPrice.toFixed(2),
          }),
        });
      }

      if (!res.ok) {
        throw new Error('Error al guardar en la Base de Datos');
      }

      const data = await res.json();
      let nextProductsList = products.map((p) =>
        p.id === selectedProduct.id ? updatedProduct : p
      );

      if (Array.isArray(data.products)) {
        nextProductsList = data.products.map(normalizeProduct);
      } else if (data.updated && data.updated.id) {
        const normalizedUpdated = normalizeProduct(data.updated);
        nextProductsList = products.map((p) =>
          p.id === normalizedUpdated.id ? normalizedUpdated : p
        );
      }

      setProducts(nextProductsList);
      setSelectedProduct(updatedProduct);
      setDirectTrackStock(true);

      // Registrar movimiento en la base de datos central con el operador del turno
      const detailText =
        stockDelta > 0
          ? `Carga de +${stockDelta} unidades por ${activeOperatorName} (Stock Actual: ${previousStock} → ${updatedStock} u. · Mínimo: ${updatedMinStock} u. · Sugerido: ${updatedSuggestedStock} u. · Control de Stock: Activo)`
          : stockDelta < 0
          ? `Ajuste de ${stockDelta} unidades por ${activeOperatorName} (Stock Actual: ${previousStock} → ${updatedStock} u. · Mínimo: ${updatedMinStock} u. · Sugerido: ${updatedSuggestedStock} u. · Control de Stock: Activo)`
          : `Actualización de stock (Actual: ${updatedStock} u. · Mínimo: ${updatedMinStock} u. · Sugerido: ${updatedSuggestedStock} u. · Control de Stock: Activo) por ${activeOperatorName}`;

      void recordDatabaseAuditLog({
        actionType: 'Carga de Stock',
        actionDetail: detailText,
        referenceCode: updatedProduct.code || updatedProduct.sku,
        targetName: updatedProduct.name,
      });

      const nextProcessed = stockProcessedCount + 1;
      setStockProcessedCount(nextProcessed);

      const successMsg =
        'Cambios e inventario guardados con éxito en la Base de Datos';

      setDbSaveToast({
        type: 'success',
        message: successMsg,
      });
      setTimeout(() => {
        setDbSaveToast((prev) => (prev?.type === 'success' ? null : prev));
      }, 3500);

      if (onProductsUpdated) {
        onProductsUpdated(nextProductsList, successMsg);
      }

      setIsSavingStock(false);

      if (mode === 'finish') {
        setScannerInput('');
        if (onBack) {
          onBack();
        }
      } else {
        setSelectedProduct(null);
        setScannerInput('');
        setDirectStockInput(0);
        setDirectMinStockInput(0);
        setDirectSuggestedStockInput(0);
        setStockToAddInput(1);
        setWasAutoActivatedTrackStock(false);
        setTimeout(() => {
          scannerInputRef.current?.focus();
        }, 60);
      }
    } catch (error) {
      console.error('Error guardando stock en BD:', error);
      // En caso de falla de conexión o error de red, mantener todos los números ingresados en pantalla y permitir reintentar
      setIsSavingStock(false);
      setDbSaveToast({
        type: 'error',
        message:
          'Error de conexión al guardar en la Base de Datos. Sus datos siguen en pantalla.',
        retryMode: mode,
      });
    }
  };

  // ====================================================================
  // MODO 2: PEDIDO RÁPIDO MÓVIL A PROVEEDORES (Carritos Persistentes por Proveedor)
  // ====================================================================
  const handleSelectOrderInputMethod = (method: 'manual' | 'camera') => {
    setOrderInputMethod(method);
    if (method === 'camera') {
      void startCamera();
    } else {
      stopCamera();
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 60);
    }
  };

  // Teclado numérico 0-9 del Modal de Cantidad de Pedido Rápido Móvil
  const handleOrderKeypadDigit = (digit: string) => {
    playScannerBeep(beepEnabled);
    setOrderQtyKeypadStr((prev) => {
      const next = `${prev}${digit}`.replace(/^0+(?=\d)/, '');
      if (next.length > 5) return prev;
      return next;
    });
  };

  const handleOrderKeypadBackspace = () => {
    setOrderQtyKeypadStr((prev) => prev.slice(0, -1));
  };

  const handleOrderKeypadClear = () => {
    setOrderQtyKeypadStr('');
  };

  const handleOrderKeypadStep = (delta: number) => {
    const currentVal =
      orderQtyKeypadStr !== ''
        ? parseInt(orderQtyKeypadStr, 10) || 0
        : orderQtyDefaultVal;
    const nextVal = Math.max(1, currentVal + delta);
    setOrderQtyKeypadStr(String(nextVal));
  };

  // Confirmar / Agregar desde el modal táctil de cantidad y volver a pedir un nuevo código automáticamente
  const handleConfirmOrderQtyModal = () => {
    const targetProd = orderQtyModalProduct || selectedProduct;
    if (!targetProd) return;

    const parsedQty =
      orderQtyKeypadStr !== ''
        ? parseInt(orderQtyKeypadStr, 10)
        : orderQtyDefaultVal;
    const qty = Math.max(1, Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1);

    const targetSupplier = (
      targetProd.supplierName ||
      activeSupplierName ||
      'Proveedor General'
    ).trim();

    playScannerBeep(beepEnabled);
    setActiveSupplierName(targetSupplier);

    setSupplierCarts((prev) => {
      const currentList = prev[targetSupplier] || [];
      const existingIdx = currentList.findIndex(
        (item) => item.productId === targetProd.id
      );
      const unitCost =
        targetProd.precioCosto ||
        parseFloat(String(targetProd.costPrice || '0')) ||
        0;

      let nextList: PersistentSupplierCartItem[];
      if (existingIdx >= 0) {
        nextList = currentList.map((item, idx) =>
          idx === existingIdx
            ? {
                ...item,
                quantity: item.quantity + qty,
                costPrice: unitCost,
                currentStock: targetProd.stock,
              }
            : item
        );
      } else {
        nextList = [
          ...currentList,
          {
            productId: targetProd.id,
            sku: targetProd.code || targetProd.sku,
            barcode: targetProd.barcode,
            name: targetProd.name,
            supplierName: targetSupplier,
            costPrice: unitCost,
            currentStock: targetProd.stock,
            minStock: targetProd.minStock || 0,
            quantity: qty,
            addedAt: new Date().toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ];
      }

      return {
        ...prev,
        [targetSupplier]: nextList,
      };
    });

    setFeedbackBanner({
      type: 'success',
      text: `+${qty} u. de "${targetProd.name}" agregadas a Carrito ${targetSupplier}.`,
    });

    // Cerrar el modal y volver a solicitar automáticamente un nuevo código según el método elegido
    setOrderQtyModalProduct(null);
    setOrderQtyKeypadStr('');
    setScannerInput('');

    if (orderInputMethod === 'camera') {
      if (!cameraActive) {
        void startCamera();
      }
    } else {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 60);
    }
  };

  const handleCancelOrderQtyModal = () => {
    setOrderQtyModalProduct(null);
    setOrderQtyKeypadStr('');
    setScannerInput('');
    if (orderInputMethod === 'camera') {
      if (!cameraActive) {
        void startCamera();
      }
    } else {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 60);
    }
  };

  const handleAddProductToSupplierCart = () => {
    if (!selectedProduct) return;
    const suggestedQty = Math.max(1, Number(supplierOrderQtyInput) || 1);
    setOrderQtyModalProduct(selectedProduct);
    setOrderQtyDefaultVal(suggestedQty);
    setOrderQtyKeypadStr(String(suggestedQty));
  };

  const handleUpdateSupplierCartItemQty = (
    supplierKey: string,
    productId: number,
    delta: number
  ) => {
    setSupplierCarts((prev) => {
      const list = prev[supplierKey] || [];
      const nextList = list.map((it) =>
        it.productId === productId
          ? { ...it, quantity: Math.max(1, it.quantity + delta) }
          : it
      );
      return {
        ...prev,
        [supplierKey]: nextList,
      };
    });
  };

  const handleRemoveSupplierCartItem = (
    supplierKey: string,
    productId: number
  ) => {
    setSupplierCarts((prev) => {
      const list = (prev[supplierKey] || []).filter(
        (it) => it.productId !== productId
      );
      const next = { ...prev };
      if (list.length > 0) {
        next[supplierKey] = list;
      } else {
        delete next[supplierKey];
      }
      return next;
    });
  };

  // Generar el PDF formal de Orden de Compra y abrir WhatsApp para el proveedor
  const handleConfirmAndSendSupplierOrder = async (
    supplierKey: string,
    channel: 'whatsapp' | 'pdf'
  ) => {
    const items = supplierCarts[supplierKey] || [];
    if (items.length === 0) return;

    playScannerBeep(beepEnabled);
    const supObj = suppliers.find(
      (s) => s.name.trim().toLowerCase() === supplierKey.trim().toLowerCase()
    );
    const orderNum = `OC-${Date.now().toString().slice(-6)}`;
    const totalEstimated = items.reduce(
      (acc, it) => acc + it.quantity * it.costPrice,
      0
    );

    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text('ORDEN DE COMPRA / PEDIDO A PROVEEDOR', 14, 16);
    doc.setFontSize(10);
    doc.text(`Comercio: Ferretería del Puente (${branchName})`, 14, 23);
    doc.text(`Orden N°: ${orderNum}`, 14, 29);
    doc.text(`Proveedor: ${supplierKey}`, 14, 35);
    if (supObj?.cuit) {
      doc.text(`CUIT Proveedor: ${supObj.cuit}`, 115, 35);
    }
    doc.text(
      `Fecha: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')} · Operador: ${activeOperatorName}`,
      14,
      41
    );
    doc.line(14, 45, 196, 45);

    let y = 52;
    doc.text('SKU', 14, y);
    doc.text('Producto / Descripción', 46, y);
    doc.text('Cant.', 135, y);
    doc.text('Costo U.', 155, y);
    doc.text('Subtotal', 178, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;

    items.forEach((it) => {
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
      doc.text(it.sku.slice(0, 14), 14, y);
      doc.text(it.name.slice(0, 42), 46, y);
      doc.text(String(it.quantity), 135, y);
      doc.text(`$${it.costPrice.toLocaleString('es-AR')}`, 155, y);
      doc.text(
        `$${(it.quantity * it.costPrice).toLocaleString('es-AR')}`,
        178,
        y
      );
      y += 7;
    });

    doc.line(14, y + 2, 196, y + 2);
    y += 9;
    doc.setFontSize(12);
    doc.text(
      `TOTAL ESTIMADO: $${totalEstimated.toLocaleString('es-AR')}`,
      125,
      y
    );

    const pdfFilename = `Orden_Compra_${supplierKey.replace(/\s+/g, '_')}_${orderNum}.pdf`;
    doc.save(pdfFilename);

    // Subir el PDF para poder incluir enlace descargable directo en el mensaje de WhatsApp
    let publicPdfUrl = '';
    try {
      const pdfDataUri = doc.output('datauristring');
      const uploadRes = await fetch('/api/public-pdfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: pdfFilename,
          pdfBase64: pdfDataUri,
        }),
      });
      if (uploadRes.ok) {
        const upData = await uploadRes.json();
        if (upData.publicUrl) {
          publicPdfUrl = `${window.location.origin}${upData.publicUrl}`;
        }
      }
    } catch {
      // ignore upload error
    }

    if (channel === 'whatsapp') {
      let msg = `*ORDEN DE COMPRA / PEDIDO (${orderNum})*\n`;
      msg += `*FERRETERIA DEL PUENTE*\n`;
      msg += `Proveedor: *${supplierKey}*\n`;
      msg += `Operador: ${activeOperatorName}\n`;
      msg += `-----------------------------\n`;
      items.forEach((it) => {
        msg += `• *[${it.sku}] ${it.name}*\n  Cantidad solicitada: *${it.quantity} u.*\n`;
      });
      msg += `-----------------------------\n`;
      msg += `*Total unidades:* ${items.reduce((a, b) => a + b.quantity, 0)} u.\n`;
      msg += `*Total estimado:* $${totalEstimated.toLocaleString('es-AR')}`;
      if (publicPdfUrl) {
        msg += `\n\n📄 *Descargar Orden de Compra PDF:*\n${publicPdfUrl}`;
      }

      const cleanPhone = (supObj?.contactPhone || '').replace(/\D/g, '');
      const waUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

      const a = document.createElement('a');
      a.href = waUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Mostrar confirmación de envío exitoso para limpiar únicamente el carrito de este proveedor
      setPendingWhatsAppClearSupplier({
        supplierName: supplierKey,
        orderNum,
        waUrl,
      });
      return;
    }

    // Si fue solo descarga PDF y confirmación directa:
    finalizeAndClearSingleSupplierCart(supplierKey, orderNum);
  };

  // Limpia ÚNICAMENTE el carrito del proveedor enviado y actualiza el estado "En Pedido" en la BD
  const finalizeAndClearSingleSupplierCart = (
    supplierKey: string,
    orderNum: string
  ) => {
    const items = supplierCarts[supplierKey] || [];
    if (items.length === 0) {
      setPendingWhatsAppClearSupplier(null);
      return;
    }

    const supObj = suppliers.find(
      (s) => s.name.trim().toLowerCase() === supplierKey.trim().toLowerCase()
    );
    const totalEstimated = items.reduce(
      (acc, it) => acc + it.quantity * it.costPrice,
      0
    );
    const totalUnitsOrdered = items.reduce((a, b) => a + b.quantity, 0);

    // Actualizar orderedQty localmente en los productos para que muestren "En Pedido (X u.)"
    const orderedMap = new Map<number, number>();
    items.forEach((it) => {
      orderedMap.set(it.productId, it.quantity);
    });

    const updatedProds = products.map((p) => {
      const addedQty = orderedMap.get(p.id);
      if (!addedQty) return p;
      return {
        ...p,
        orderedQty: (p.orderedQty ?? 0) + addedQty,
      };
    });
    setProducts(updatedProds);
    if (onProductsUpdated) {
      onProductsUpdated(
        updatedProds,
        `Pedido ${orderNum} enviado a ${supplierKey} (${totalUnitsOrdered} u.).`
      );
    }

    // Registrar orden en el proveedor de la base de datos si existe
    if (supObj?.id) {
      fetch(`/api/suppliers/${supObj.id}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: totalEstimated,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.products) && onProductsUpdated) {
            onProductsUpdated(data.products);
          }
        })
        .catch(() => {});
    }

    // Registrar auditoría en la base de datos central con el operador del turno
    void recordDatabaseAuditLog({
      actionType: 'Pedido a Proveedor',
      actionDetail: `Pedido ${orderNum} de +${totalUnitsOrdered} unidades a ${supplierKey} confirmado y enviado por WhatsApp por ${activeOperatorName}`,
      referenceCode: orderNum,
      targetName: supplierKey,
    });

    // Limpiar ÚNICAMENTE el carrito de ese proveedor manteniendo intactos los demás
    setSupplierCarts((prev) => {
      const next = { ...prev };
      delete next[supplierKey];
      return next;
    });
    setConfirmingSendSupplier(null);
    setPendingWhatsAppClearSupplier(null);
    setFeedbackBanner({
      type: 'success',
      text: `Pedido ${orderNum} para "${supplierKey}" confirmado y enviado. Solo se vació el carrito de ${supplierKey}; los demás carritos siguen intactos.`,
    });
  };
  // ====================================================================
  // MODO 3: MINI POS (PRESUPUESTOS)
  // ====================================================================
  const handleAddProductToMiniPosCart = (prodToUse?: Product, customQty?: number) => {
    const prod = prodToUse || selectedProduct;
    if (!prod) return;
    const qty = Math.max(1, customQty ?? (Number(miniPosQtyInput) || 1));
    const unitPrice =
      prod.precioVenta ||
      parseFloat(String(prod.salePrice || '0')) ||
      prod.precioCosto ||
      0;

    playScannerBeep(beepEnabled);
    setLastSavedBudget(null);

    setMiniPosCart((prev) => {
      const idx = prev.findIndex((it) => it.product.id === prod.id);
      if (idx >= 0) {
        return prev.map((it, i) =>
          i === idx ? { ...it, quantity: it.quantity + qty, unitPrice } : it
        );
      }
      return [...prev, { product: prod, quantity: qty, unitPrice }];
    });

    setFeedbackBanner({
      type: 'success',
      text: `+${qty} u. de "${prod.name}" sumadas al carrito de Mini POS (Presupuesto).`,
    });
    setMiniPosQtyInput(1);
    setScannerInput('');
  };

  const handleUpdateMiniPosQty = (productId: number, delta: number) => {
    playScannerBeep(beepEnabled);
    setMiniPosCart((prev) =>
      prev
        .map((it) =>
          it.product.id === productId
            ? { ...it, quantity: it.quantity + delta }
            : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const miniPosTotal = useMemo(
    () =>
      miniPosCart.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0),
    [miniPosCart]
  );

  // Guardar como Presupuesto formal en el sistema
  const handleSaveAsFormalBudget = async (): Promise<SavedScannerBudget | null> => {
    if (miniPosCart.length === 0 || isSavingBudget) return null;
    setIsSavingBudget(true);
    playScannerBeep(beepEnabled);

    const docNumber = `PRE-0004-${Math.floor(100000 + Math.random() * 899999)}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 15);
    const validUntilIso = validUntilDate.toISOString().slice(0, 10);

    const clientNameStr = selectedClient?.name || 'Consumidor Final';
    const clientCuitStr = selectedClient?.cuit || '00-00000000-0';

    const savedBudgetObj: SavedScannerBudget = {
      id: docNumber,
      docNumber,
      createdAt: `${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      clientId: selectedClient?.id ?? null,
      clientName: clientNameStr,
      clientCuit: clientCuitStr,
      clientPhone: clientWhatsappPhone.trim(),
      clientEmail: clientEmailInput.trim(),
      totalAmount: miniPosTotal,
      items: miniPosCart.map((it) => ({
        productId: it.product.id,
        sku: it.product.code || it.product.sku,
        name: it.product.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.quantity * it.unitPrice,
      })),
    };

    // Sincronizar con la lista de presupuestos de SalesPosWorkspaceModule en localStorage
    try {
      const existingRaw = window.localStorage.getItem(SAVED_BUDGETS_STORAGE_KEY);
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const posCompatibleBudget = {
        id: docNumber,
        docNumber,
        dateIso: todayIso,
        validUntilIso,
        clientId: selectedClient?.id ?? null,
        clientName: clientNameStr,
        clientCuit: clientCuitStr,
        clientPhone: clientWhatsappPhone.trim(),
        priceListId: 'lista-normal',
        priceListName: 'Lista de Precio Normal',
        discountMode: 'percent',
        discountValue: 0,
        totalAmount: miniPosTotal,
        status: 'Borrador',
        items: miniPosCart.map((it) => ({
          productId: it.product.id,
          sku: it.product.code || it.product.sku,
          name: it.product.name,
          brand: it.product.brand || 'General',
          category: it.product.category || 'Ferretería',
          quantity: it.quantity,
          normalPrice: it.unitPrice,
          cardPrice: Number((it.unitPrice * 1.09).toFixed(2)),
          discountPercent: 0,
          baseUnitPrice: it.unitPrice,
          unitPrice: it.unitPrice,
        })),
      };
      if (Array.isArray(existingList)) {
        window.localStorage.setItem(
          SAVED_BUDGETS_STORAGE_KEY,
          JSON.stringify([posCompatibleBudget, ...existingList])
        );
      }
    } catch {
      // ignore localStorage error
    }

    const totalBudgetUnits = miniPosCart.reduce((acc, it) => acc + it.quantity, 0);

    // Registrar en el backend con el operador móvil seleccionado en el turno
    try {
      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNumber,
          docType: 'Presupuesto',
          clientId: selectedClient?.id ?? null,
          clientName: clientNameStr,
          clientCuit: clientCuitStr,
          branchName,
          sellerName: activeOperatorName,
          paymentMethod: 'Efectivo',
          totalAmount: miniPosTotal,
          status: 'Borrador',
          items: miniPosCart.map((it) => ({
            productId: it.product.id,
            quantity: it.quantity,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onOrderConfirmed) {
          onOrderConfirmed({
            documents: data.documents,
            products: data.products,
            toastMsg: `Presupuesto ${docNumber} guardado por ${activeOperatorName}.`,
          });
        }
      }
    } catch {
      // ignore network error
    } finally {
      setIsSavingBudget(false);
    }

    // Registrar auditoría en la base de datos central con el operador del turno
    void recordDatabaseAuditLog({
      actionType: 'Presupuesto Mini POS',
      actionDetail: `Presupuesto ${docNumber} (${totalBudgetUnits} unidades · ${formatMoney(miniPosTotal)}) generado por ${activeOperatorName}`,
      referenceCode: docNumber,
      targetName: clientNameStr,
    });

    setLastSavedBudget(savedBudgetObj);
    setFeedbackBanner({
      type: 'success',
      text: `Presupuesto ${docNumber} firmado por ${activeOperatorName} y guardado en la base de datos. Ahora puede enviarlo por WhatsApp o Email.`,
    });

    return savedBudgetObj;
  };

  // Enviar Presupuesto por WhatsApp o Email
  const handleSendBudgetToClient = async (channel: 'whatsapp' | 'email') => {
    let budget = lastSavedBudget;
    if (!budget) {
      budget = await handleSaveAsFormalBudget();
    }
    if (!budget) return;

    // Generar PDF del Presupuesto
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('PRESUPUESTO OFICIAL', 14, 16);
    doc.setFontSize(10);
    doc.text(`Comercio: Ferretería del Puente (${branchName})`, 14, 23);
    doc.text(`Presupuesto N°: ${budget.docNumber}`, 14, 29);
    doc.text(`Fecha: ${budget.createdAt}`, 14, 35);
    doc.text(
      `Cliente: ${budget.clientName} (CUIT/DNI: ${budget.clientCuit})`,
      14,
      41
    );
    doc.line(14, 45, 196, 45);

    let y = 52;
    doc.text('SKU', 14, y);
    doc.text('Descripción', 45, y);
    doc.text('Cant.', 130, y);
    doc.text('P.Unit', 150, y);
    doc.text('Subtotal', 176, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;

    budget.items.forEach((it) => {
      doc.text(it.sku.slice(0, 14), 14, y);
      doc.text(it.name.slice(0, 42), 45, y);
      doc.text(String(it.quantity), 130, y);
      doc.text(`$${it.unitPrice.toLocaleString('es-AR')}`, 150, y);
      doc.text(`$${it.subtotal.toLocaleString('es-AR')}`, 176, y);
      y += 7;
    });

    doc.line(14, y + 2, 196, y + 2);
    y += 10;
    doc.setFontSize(12);
    doc.text(
      `TOTAL PRESUPUESTADO: $${budget.totalAmount.toLocaleString('es-AR')}`,
      125,
      y
    );

    const fileName = `Presupuesto_${budget.docNumber}.pdf`;
    doc.save(fileName);

    if (channel === 'whatsapp') {
      // Enviar también al endpoint de WhatsApp API en segundo plano si tiene teléfono
      try {
        const pdfDataUri = doc.output('datauristring');
        const uploadRes = await fetch('/api/public-pdfs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: fileName,
            pdfBase64: pdfDataUri,
          }),
        });
        if (uploadRes.ok && budget.clientPhone) {
          const { publicUrl } = await uploadRes.json();
          fetch('/api/whatsapp/send-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientName: budget.clientName,
              phone: budget.clientPhone,
              docNumber: budget.docNumber,
              pdfUrl: publicUrl,
              filename: fileName,
            }),
          }).catch(() => {});
        }
      } catch {
        // ignore
      }

      let text = `*PRESUPUESTO ${budget.docNumber}*\n`;
      text += `*Ferretería del Puente*\n`;
      text += `Cliente: *${budget.clientName}*\n`;
      text += `-----------------------------\n`;
      budget.items.forEach((it) => {
        text += `• *${it.name}* (${it.sku})\n  ${it.quantity} x ${formatMoney(it.unitPrice)} = *${formatMoney(it.subtotal)}*\n`;
      });
      text += `-----------------------------\n`;
      text += `*TOTAL: ${formatMoney(budget.totalAmount)}*\n`;
      text += `_Validez: 15 días_`;

      const cleanDigits = budget.clientPhone.replace(/\D/g, '');
      const waUrl = cleanDigits
        ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      const a = document.createElement('a');
      a.href = waUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const subject = `Presupuesto ${budget.docNumber} - Ferretería del Puente`;
      let body = `Estimado/a ${budget.clientName},\n\n`;
      body += `Adjuntamos el detalle del Presupuesto N° ${budget.docNumber} emitido el ${budget.createdAt}:\n\n`;
      budget.items.forEach((it) => {
        body += `- [${it.sku}] ${it.name}: ${it.quantity} u. x ${formatMoney(it.unitPrice)} = ${formatMoney(it.subtotal)}\n`;
      });
      body += `\nTOTAL PRESUPUESTADO: ${formatMoney(budget.totalAmount)}\n\n`;
      body += `Saludos cordiales,\nFerretería del Puente (${branchName})`;

      const mailtoUrl = `mailto:${encodeURIComponent(
        budget.clientEmail || ''
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const a = document.createElement('a');
      a.href = mailtoUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Total de ítems guardados en todos los carritos persistentes de proveedores
  const totalPersistentSupplierItemsCount = useMemo(() => {
    return (Object.values(supplierCarts) as PersistentSupplierCartItem[][]).reduce(
      (acc, list) =>
        acc + list.reduce((sum, item) => sum + (item.quantity || 0), 0),
      0
    );
  }, [supplierCarts]);

  const activeSupplierCartItems = useMemo(() => {
    return supplierCarts[activeSupplierName] || [];
  }, [supplierCarts, activeSupplierName]);
  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col justify-between overflow-y-auto font-sans select-none">
      {/* 1. CABECERA SUPERIOR ULTRA COMPACTA: Selector de Operador ("¿Quién escanea?") + Botón Volver */}
      <header className="shrink-0 h-11 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <label
            htmlFor="scanner-operator-select"
            className="text-[11px] font-bold text-slate-400 whitespace-nowrap shrink-0"
          >
            ¿Quién escanea?
          </label>
          <select
            id="scanner-operator-select"
            value={activeOperatorName}
            onChange={(e) => handleSelectMobileOperator(e.target.value)}
            className="bg-slate-950 text-white border border-slate-700 focus:border-[#FF6600] rounded-lg px-2.5 py-1 text-xs font-extrabold truncate max-w-[200px] focus:outline-none cursor-pointer"
          >
            {operatorOptions.map((op) => (
              <option key={op.name} value={op.name}>
                {op.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onBack) {
              onBack();
            } else if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold shrink-0 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver</span>
        </button>
      </header>

      {/* 2. VISTA ÚNICA DE CARGA DE STOCK (100vh Fijo Sin Scroll) */}
      <div className="flex-1 min-h-0 flex flex-col justify-between p-2 gap-2 max-w-lg w-full mx-auto overflow-hidden">
        {activeMode !== 'supplier_order' && (
          <>
            {/* A. Buscador / Lector de SKU / Código de Barras (Confirmación con ENTER) */}
            <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1.5 relative">
              <form onSubmit={handleScannerFormSubmit} className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Barcode className="w-4 h-4 text-[#FF6600] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={scannerInputRef}
                type="text"
                value={scannerInput}
                onChange={(e) => handleScannerInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScannerFormSubmit(e);
                  }
                }}
                placeholder="SKU o Código + ENTER..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-700 focus:border-[#FF6600] rounded-lg text-xs sm:text-sm text-white font-mono placeholder:font-sans placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold shrink-0 cursor-pointer transition-colors"
              title="Confirmar SKU (Enter)"
            >
              ENTER
            </button>

            <button
              type="button"
              onClick={() => (cameraActive ? stopCamera() : startCamera())}
              className={`p-1.5 rounded-lg border text-xs font-bold cursor-pointer shrink-0 transition-colors ${
                cameraActive
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
              }`}
              title="Cámara Lectora"
            >
              {cameraActive ? (
                <CameraOff className="w-4 h-4" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setBeepEnabled((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs font-bold cursor-pointer shrink-0 transition-colors ${
                beepEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Sonido Beep"
            >
              {beepEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Selector directo de catálogo */}
          <select
            value={selectedProduct?.id || ''}
            onChange={(e) => {
              const prod = products.find(
                (p) => String(p.id) === String(e.target.value)
              );
              if (prod) {
                applyAutoSelectedProduct(prod, 'Producto seleccionado');
              }
            }}
            className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#FF6600] cursor-pointer"
          >
            <option value="">Seleccionar producto ({products.length})</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code || p.sku}] {p.name} ({p.stock} u.)
              </option>
            ))}
          </select>

          {/* Visor compacto de cámara si está activa */}
          {cameraActive && (
            <div className="relative h-20 rounded-lg overflow-hidden bg-black border border-amber-500/60">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-9 border border-amber-400 rounded-lg relative">
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500" />
                </div>
              </div>
            </div>
          )}

          {/* Desplegable flotante de coincidencias sin desplazar el layout */}
          {matchingSuggestions.length > 0 && (
            <div className="absolute left-2 right-2 top-11 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-800 max-h-40 overflow-y-auto">
              {matchingSuggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    applyAutoSelectedProduct(p, 'Seleccionado');
                    setScannerInput('');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] font-mono text-amber-400">
                      {p.code || p.sku} · {p.brand || 'S/M'}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
                    {p.stock} u.
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* B. Tarjeta Compacta con Datos Esenciales (SKU, Nombre, Marca y Estado de Control de Stock) + Icono Muy Pequeño para Agregar Foto */}
        <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 relative">
          {/* Alerta / Toast Flotante de Guardado Exitoso o Error con Botón de Reintentar */}
          {dbSaveToast && (
            <div
              className={`fixed top-12 left-3 right-3 max-w-lg mx-auto z-50 px-3.5 py-2.5 rounded-xl shadow-2xl border flex items-center justify-between gap-2.5 text-xs font-extrabold ${
                dbSaveToast.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950/95 border-rose-500 text-rose-100'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {dbSaveToast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="leading-tight">{dbSaveToast.message}</span>
              </div>

              {dbSaveToast.type === 'error' ? (
                <button
                  type="button"
                  disabled={isSavingStock}
                  onClick={() =>
                    void handleSaveStockChanges(dbSaveToast.retryMode || 'next')
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-[11px] font-black shrink-0 inline-flex items-center gap-1 cursor-pointer shadow-md"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isSavingStock ? 'animate-spin' : ''}`}
                  />
                  <span>Reintentar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDbSaveToast(null)}
                  className="p-1 text-emerald-300 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <input
            ref={photoFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoFileChange}
            className="hidden"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-black text-[#FF6600] truncate">
                SKU: {selectedProduct ? selectedProduct.code || selectedProduct.sku : '---'}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 font-semibold truncate">
                Marca: {selectedProduct ? selectedProduct.brand || 'S/M' : '---'}
              </span>
              {selectedProduct && (
                <span
                  className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                    wasAutoActivatedTrackStock
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : directTrackStock
                      ? 'bg-slate-800 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {wasAutoActivatedTrackStock
                    ? 'Control Stock: AUTO-ACTIVADO'
                    : directTrackStock
                    ? 'Control Stock: SÍ'
                    : 'Sin Control Stock'}
                </span>
              )}
            </div>
            <div className="text-sm font-extrabold text-white truncate mt-0.5">
              {selectedProduct ? selectedProduct.name : 'Sin producto seleccionado'}
            </div>
          </div>

          {/* Icono muy pequeño para agregar foto */}
          <button
            type="button"
            disabled={!selectedProduct}
            onClick={() => photoFileInputRef.current?.click()}
            title="Agregar foto"
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer shrink-0 relative disabled:opacity-40 transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5 text-[#FF6600]" />
            {selectedProduct && productPhotos[selectedProduct.id] && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950" />
            )}
          </button>
        </div>
          </>
        )}

        {/* MODO 1: STOCK MÓVIL RÁPIDO (Vista por defecto) */}
        {activeMode === 'stock' && (
          <>
            {/* C. BLOQUES PROMINENTES Y DESTACADOS: [STOCK MÍNIMO], [STOCK SUGERIDO] y [STOCK ACTUAL] con [-1] [Input XL/2XL] [+1] */}
            <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between gap-2.5">
              {/* Fila horizontal (grid de 2 columnas) arriba de STOCK ACTUAL */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Campo 1 (Izquierda): STOCK MÍNIMO con [-1] [Input XL/2XL] [+1] */}
                <div className="bg-slate-950 border-2 border-slate-700/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5 shadow-md">
                  <label
                    htmlFor="scanner-min-stock-input"
                    className="block text-xs font-black uppercase tracking-wider text-amber-400 text-center"
                  >
                    STOCK MÍNIMO
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!selectedProduct}
                      onClick={() => {
                        activateStockControlOnEdit();
                        setDirectMinStockInput((prev) => Math.max(0, prev - 1));
                      }}
                      className="h-11 w-10 sm:w-11 shrink-0 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-mono font-black text-base flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    >
                      -1
                    </button>

                    <input
                      id="scanner-min-stock-input"
                      type="number"
                      min={0}
                      disabled={!selectedProduct}
                      placeholder="0"
                      value={selectedProduct ? directMinStockInput : ''}
                      onChange={(e) => {
                        activateStockControlOnEdit();
                        setDirectMinStockInput(
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        );
                      }}
                      className="w-full min-w-0 h-11 text-center font-mono font-black text-xl sm:text-2xl bg-slate-900 border border-slate-700 focus:border-[#FF6600] rounded-lg px-1 text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-40"
                    />

                    <button
                      type="button"
                      disabled={!selectedProduct}
                      onClick={() => {
                        activateStockControlOnEdit();
                        setDirectMinStockInput((prev) => prev + 1);
                      }}
                      className="h-11 w-10 sm:w-11 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono font-black text-base flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {/* Campo 2 (Derecha): STOCK SUGERIDO con [-1] [Input XL/2XL] [+1] */}
                <div className="bg-slate-950 border-2 border-slate-700/90 rounded-xl p-2.5 flex flex-col justify-between gap-1.5 shadow-md">
                  <label
                    htmlFor="scanner-suggested-stock-input"
                    className="block text-xs font-black uppercase tracking-wider text-sky-400 text-center"
                  >
                    STOCK SUGERIDO
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!selectedProduct}
                      onClick={() => {
                        activateStockControlOnEdit();
                        setDirectSuggestedStockInput((prev) =>
                          Math.max(0, prev - 1)
                        );
                      }}
                      className="h-11 w-10 sm:w-11 shrink-0 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-mono font-black text-base flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    >
                      -1
                    </button>

                    <input
                      id="scanner-suggested-stock-input"
                      type="number"
                      min={0}
                      disabled={!selectedProduct}
                      placeholder="0"
                      value={selectedProduct ? directSuggestedStockInput : ''}
                      onChange={(e) => {
                        activateStockControlOnEdit();
                        setDirectSuggestedStockInput(
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        );
                      }}
                      className="w-full min-w-0 h-11 text-center font-mono font-black text-xl sm:text-2xl bg-slate-900 border border-slate-700 focus:border-[#FF6600] rounded-lg px-1 text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-40"
                    />

                    <button
                      type="button"
                      disabled={!selectedProduct}
                      onClick={() => {
                        activateStockControlOnEdit();
                        setDirectSuggestedStockInput((prev) => prev + 1);
                      }}
                      className="h-11 w-10 sm:w-11 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono font-black text-base flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    >
                      +1
                    </button>
                  </div>
                </div>
              </div>

              {/* Bloque Principal Destacado: STOCK ACTUAL con [-1] [Input Numérico 2XL/3XL] [+1] */}
              <div className="flex-1 min-h-0 bg-slate-950 border-2 border-[#FF6600]/80 rounded-xl p-3 flex flex-col justify-center gap-2 shadow-lg">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    STOCK ACTUAL
                  </span>
                  <span className="text-xs font-mono font-black text-amber-400">
                    {selectedProduct
                      ? `En sistema: ${selectedProduct.stock} u.`
                      : '0 u.'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => {
                      activateStockControlOnEdit();
                      setDirectStockInput((prev) => Math.max(0, prev - 1));
                    }}
                    className="h-14 w-14 sm:w-16 shrink-0 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-mono font-black text-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-md"
                  >
                    -1
                  </button>

                  <input
                    type="number"
                    min={0}
                    disabled={!selectedProduct}
                    placeholder="0"
                    value={selectedProduct ? directStockInput : 0}
                    onChange={(e) => {
                      activateStockControlOnEdit();
                      setDirectStockInput(
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      );
                    }}
                    className="w-full min-w-0 h-14 text-center font-mono font-black text-2xl sm:text-3xl bg-slate-900 border-2 border-slate-700 focus:border-[#FF6600] rounded-xl px-2 text-white focus:outline-none disabled:opacity-40"
                  />

                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => {
                      activateStockControlOnEdit();
                      setDirectStockInput((prev) => prev + 1);
                    }}
                    className="h-14 w-14 sm:w-16 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono font-black text-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-md"
                  >
                    +1
                  </button>
                </div>

                {/* Botones rápidos adicionales (+5, +10) */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => {
                      activateStockControlOnEdit();
                      setDirectStockInput((prev) => prev + 5);
                    }}
                    className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 disabled:opacity-40 text-emerald-400 font-mono font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  >
                    +5
                  </button>

                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => {
                      activateStockControlOnEdit();
                      setDirectStockInput((prev) => prev + 10);
                    }}
                    className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 disabled:opacity-40 text-emerald-400 font-mono font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  >
                    +10
                  </button>
                </div>
              </div>
            </div>

            {/* 3. BOTONES FIJOS INFERIORES DE GUARDADO EN UNA SOLA FILA */}
            <div className="shrink-0 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!selectedProduct || isSavingStock}
                onClick={() => void handleSaveStockChanges('next')}
                className="py-3.5 px-3 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-md"
              >
                <span>
                  {isSavingStock ? 'Guardando en BD...' : 'Guardar y Siguiente SKU'}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                disabled={!selectedProduct || isSavingStock}
                onClick={() => void handleSaveStockChanges('finish')}
                className="py-3.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isSavingStock ? 'Guardando...' : 'Guardar y Finalizar'}
                </span>
              </button>
            </div>
          </>
        )}

        {/* MODO 2: PEDIDO RÁPIDO MÓVIL A PROVEEDOR (/pedido-rapido-movil) */}
        {activeMode === 'supplier_order' && (
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-2 overflow-hidden">
            {/* 1. BOTÓN DESLIZABLE Y LIMPIO EN LA PARTE SUPERIOR PARA ELEGIR MÉTODO DE INGRESO */}
            <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-2 relative">
              <div className="relative grid grid-cols-2 rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSelectOrderInputMethod('manual')}
                  className={`py-2 px-2 rounded-lg text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    orderInputMethod === 'manual'
                      ? 'bg-[#FF6600] text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>⌨️ Ingresar SKU Manualmente</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectOrderInputMethod('camera')}
                  className={`py-2 px-2 rounded-lg text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    orderInputMethod === 'camera'
                      ? 'bg-[#FF6600] text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>📷 Escanear con Cámara (Código de Barras)</span>
                </button>
              </div>

              {/* Método 1: Ingreso Manual de SKU / Código o Selección Rápida */}
              {orderInputMethod === 'manual' ? (
                <div className="space-y-1.5">
                  <form
                    onSubmit={handleScannerFormSubmit}
                    className="flex items-center gap-1.5"
                  >
                    <div className="relative flex-1 min-w-0">
                      <Barcode className="w-4 h-4 text-[#FF6600] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        ref={scannerInputRef}
                        type="text"
                        value={scannerInput}
                        onChange={(e) => handleScannerInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleScannerFormSubmit(e);
                          }
                        }}
                        placeholder="Ingresar SKU, Código o Nombre + ENTER..."
                        className="w-full pl-8 pr-2.5 py-2 bg-slate-950 border border-slate-700 focus:border-[#FF6600] rounded-lg text-xs sm:text-sm text-white font-mono placeholder:font-sans placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold shrink-0 cursor-pointer transition-colors"
                    >
                      ENTER
                    </button>
                  </form>

                  <select
                    value={selectedProduct?.id || ''}
                    onChange={(e) => {
                      const prod = products.find(
                        (p) => String(p.id) === String(e.target.value)
                      );
                      if (prod) {
                        applyAutoSelectedProduct(prod, 'Producto seleccionado');
                      }
                    }}
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#FF6600] cursor-pointer"
                  >
                    <option value="">
                      O seleccionar producto de la lista ({products.length})...
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code || p.sku}] {p.name} — Prov: {p.supplierName || 'General'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Método 2: Escaneo con Cámara (Código de Barras) */
                <div className="space-y-1.5">
                  <div className="relative h-28 rounded-xl overflow-hidden bg-black border-2 border-[#FF6600]/80 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-48 h-12 border-2 border-amber-400 rounded-lg relative">
                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]" />
                      </div>
                      <span className="mt-1 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-bold text-amber-300">
                        Apunte al Código de Barras para identificar Proveedor
                      </span>
                    </div>
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => (cameraActive ? stopCamera() : startCamera())}
                        className="px-2 py-1 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-bold text-white cursor-pointer"
                      >
                        {cameraActive ? 'Pausar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Desplegable flotante de coincidencias al tipear SKU o nombre */}
              {matchingSuggestions.length > 0 && (
                <div className="absolute left-2 right-2 top-24 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-800 max-h-44 overflow-y-auto">
                  {matchingSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        applyAutoSelectedProduct(p, 'Seleccionado');
                        setScannerInput('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] font-mono text-amber-400 truncate">
                          [{p.code || p.sku}] · Prov: {p.supplierName || 'General'}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
                        + Elegir
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Proveedor Identificado Automáticamente del Producto Actual + Botón para abrir Teclado Numérico */}
              {selectedProduct && (
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                      Proveedor Identificado:{' '}
                      {selectedProduct.supplierName ||
                        activeSupplierName ||
                        'Proveedor General'}
                    </div>
                    <div className="text-xs font-extrabold text-white truncate">
                      [{selectedProduct.code || selectedProduct.sku}]{' '}
                      {selectedProduct.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = Math.max(
                        1,
                        (selectedProduct.minStock || 5) - selectedProduct.stock > 0
                          ? (selectedProduct.minStock || 5) - selectedProduct.stock
                          : 1
                      );
                      setOrderQtyModalProduct(selectedProduct);
                      setOrderQtyDefaultVal(suggested);
                      setOrderQtyKeypadStr('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-[11px] font-black shrink-0 cursor-pointer active:scale-95"
                  >
                    + Cantidad
                  </button>
                </div>
              )}
            </div>

            {/* 2. CARRITOS PERSISTENTES AGRUPADOS POR PROVEEDOR (Ej: "Carrito Latyn: 4 ítems", "Carrito FV: 2 ítems") */}
            <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col overflow-hidden gap-2">
              <div className="shrink-0 flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Carritos por Proveedor</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSupplierCartExpanded((prev) => !prev)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 cursor-pointer"
                >
                  {supplierCartExpanded ? 'Compactar lista' : 'Desplegar ítems'}
                </button>
              </div>

              {/* Pestañas / Botones visuales de Carritos Guardados por Proveedor */}
              <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1">
                {Object.entries(supplierCarts).filter(
                  ([, list]) => Array.isArray(list) && list.length > 0
                ).length === 0 ? (
                  <span className="text-[11px] text-slate-500">
                    Sin carritos pendientes aún. Escanee o ingrese un SKU arriba.
                  </span>
                ) : (
                  Object.entries(supplierCarts)
                    .filter(([, list]) => Array.isArray(list) && list.length > 0)
                    .map(([supName, list]) => {
                      const isSelected = supName === activeSupplierName;
                      const shortName =
                        supName.length > 18
                          ? `${supName.slice(0, 18)}…`
                          : supName;
                      return (
                        <button
                          key={supName}
                          type="button"
                          onClick={() => setActiveSupplierName(supName)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-[#FF6600] text-white border-[#FF6600] shadow-sm'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>Carrito {shortName}:</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                              isSelected
                                ? 'bg-slate-950 text-amber-400'
                                : 'bg-slate-800 text-amber-400'
                            }`}
                          >
                            {list.length} ítems
                          </span>
                        </button>
                      );
                    })
                )}
              </div>

              {/* Selector desplegable de Proveedor para revisar cualquier carrito */}
              <select
                value={activeSupplierName}
                onChange={(e) => setActiveSupplierName(e.target.value)}
                className="shrink-0 w-full bg-slate-950 text-white border border-slate-700 focus:border-[#FF6600] rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
              >
                {availableSupplierNames.map((supName) => {
                  const count = (supplierCarts[supName] || []).length;
                  return (
                    <option key={supName} value={supName}>
                      Carrito {supName}: {count} {count === 1 ? 'ítem' : 'ítems'}
                    </option>
                  );
                })}
              </select>

              {/* Listado de ítems acumulados del proveedor activo */}
              {supplierCartExpanded && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                  {activeSupplierCartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 text-center px-3">
                      <p className="font-semibold text-slate-400">
                        Carrito de {activeSupplierName || 'este proveedor'} sin ítems
                      </p>
                      <p className="text-[11px] mt-0.5">
                        Al ingresar o escanear un SKU se identificará su proveedor y se abrirá el teclado numérico de cantidad.
                      </p>
                    </div>
                  ) : (
                    activeSupplierCartItems.map((it) => (
                      <div
                        key={it.productId}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {it.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            [{it.sku}] · Stock: {it.currentStock} u. ·{' '}
                            {formatMoney(it.costPrice * it.quantity)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSupplierCartItemQty(
                                activeSupplierName,
                                it.productId,
                                -1
                              )
                            }
                            className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono text-xs font-black text-amber-400">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSupplierCartItemQty(
                                activeSupplierName,
                                it.productId,
                                1
                              )
                            }
                            className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveSupplierCartItem(
                                activeSupplierName,
                                it.productId
                              )
                            }
                            className="w-7 h-7 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-400 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 4. FINALIZACIÓN Y ENVÍO DE PEDIDO EN PDF POR WHATSAPP */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                disabled={activeSupplierCartItems.length === 0}
                onClick={() =>
                  void handleConfirmAndSendSupplierOrder(
                    activeSupplierName,
                    'whatsapp'
                  )
                }
                className="flex-1 py-3.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs sm:text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Confirmar Pedido y Enviar por WhatsApp</span>
              </button>
            </div>

            {/* MODAL TÁCTIL EN PANTALLA COMPLETA (0-9): "¿Cuántas unidades deseas agregar al pedido?" */}
            {orderQtyModalProduct && (
              <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-3 select-none">
                {/* Encabezado: Proveedor Reconocido Automáticamente + Datos del Producto */}
                <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                      <Truck className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                      <span>
                        Proveedor: {orderQtyModalProduct.supplierName || 'Proveedor General'}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-bold text-[#FF6600]">
                      SKU: {orderQtyModalProduct.code || orderQtyModalProduct.sku}
                    </span>
                  </div>

                  <div className="text-base sm:text-lg font-extrabold text-white leading-snug line-clamp-2">
                    {orderQtyModalProduct.name}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-0.5">
                    <span>Marca: {orderQtyModalProduct.brand || 'General'}</span>
                    <span className="font-mono text-slate-300">
                      Stock actual: <strong className="text-white">{orderQtyModalProduct.stock} u.</strong> (Mín: {orderQtyModalProduct.minStock || 0} u.)
                    </span>
                  </div>
                </div>

                {/* Pregunta central + Visor gigante de cantidad */}
                <div className="shrink-0 text-center space-y-1.5 my-1">
                  <p className="text-sm sm:text-base font-extrabold text-amber-400">
                    ¿Cuántas unidades deseas agregar al pedido?
                  </p>
                  <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => handleOrderKeypadStep(-1)}
                      className="h-14 w-14 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono font-black text-xl flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      -1
                    </button>
                    <div className="flex-1 h-14 rounded-2xl bg-slate-900 border-2 border-[#FF6600] flex items-center justify-center font-mono font-black text-3xl sm:text-4xl text-white shadow-inner">
                      {orderQtyKeypadStr !== ''
                        ? orderQtyKeypadStr
                        : orderQtyDefaultVal}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOrderKeypadStep(1)}
                      className="h-14 w-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-black text-xl flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {/* Teclado Numérico Táctil del 0 al 9 en Pantalla Completa */}
                <div className="flex-1 min-h-0 grid grid-cols-3 gap-2 my-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleOrderKeypadDigit(digit)}
                      className="rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-[#FF6600] border border-slate-800 text-white font-mono font-black text-2xl sm:text-3xl flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleOrderKeypadClear}
                    className="rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 font-extrabold text-sm sm:text-base flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    LIMPIAR (C)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOrderKeypadDigit('0')}
                    className="rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-[#FF6600] border border-slate-800 text-white font-mono font-black text-2xl sm:text-3xl flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleOrderKeypadBackspace}
                    className="rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-extrabold text-lg sm:text-xl flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    ⌫
                  </button>
                </div>

                {/* Botones Inferiores: Cancelar y Confirmar / Agregar */}
                <div className="shrink-0 grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelOrderQtyModal}
                    className="py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <X className="w-5 h-5 text-rose-400" />
                    <span>Cancelar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmOrderQtyModal}
                    className="py-4 px-4 rounded-2xl bg-[#FF6600] hover:bg-[#E65C00] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                  >
                    <Check className="w-5 h-5" />
                    <span>Confirmar / Agregar</span>
                  </button>
                </div>
              </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE ENVÍO EXITOSO POR WHATSAPP (Solo vacía el carrito tras confirmar el envío) */}
            {pendingWhatsAppClearSupplier && (
              <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl max-w-md w-full p-5 space-y-4 text-center shadow-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-white">
                      Orden {pendingWhatsAppClearSupplier.orderNum} Generada en PDF + WhatsApp
                    </h3>
                    <p className="text-xs text-slate-300">
                      Se descargó el PDF formal y se abrió WhatsApp para{' '}
                      <strong className="text-amber-400">
                        {pendingWhatsAppClearSupplier.supplierName}
                      </strong>
                      . ¿Confirmás que el pedido fue enviado con éxito para limpiar únicamente este carrito?
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        finalizeAndClearSingleSupplierCart(
                          pendingWhatsAppClearSupplier.supplierName,
                          pendingWhatsAppClearSupplier.orderNum
                        )
                      }
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      <span>Sí, Envío Exitoso (Limpiar este Carrito)</span>
                    </button>

                    <a
                      href={pendingWhatsAppClearSupplier.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Volver a abrir WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setPendingWhatsAppClearSupplier(null)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold text-xs cursor-pointer"
                    >
                      Mantener productos en el carrito por ahora
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO 3: PRESUPUESTO RÁPIDO MÓVIL (MINI POS) */}
        {activeMode === 'mini_pos' && (
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-2 overflow-hidden">
            <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4" />
                  <span>Presupuesto Rápido Móvil</span>
                </span>
                <span className="text-xs font-mono font-black text-white">
                  Total: {formatMoney(miniPosTotal)}
                </span>
              </div>

              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const found = clients.find(
                    (c) => String(c.id) === String(e.target.value)
                  );
                  if (found) {
                    setSelectedClient(found);
                    if (found.phone && found.phone !== '-') {
                      setClientWhatsappPhone(found.phone);
                    }
                  }
                }}
                className="w-full bg-slate-950 text-white border border-slate-700 focus:border-[#FF6600] rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.cuit})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedProduct}
                  onClick={() =>
                    setMiniPosQtyInput((prev) => Math.max(1, prev - 1))
                  }
                  className="h-11 w-12 shrink-0 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-mono font-black text-lg flex items-center justify-center cursor-pointer"
                >
                  -1
                </button>
                <input
                  type="number"
                  min={1}
                  disabled={!selectedProduct}
                  value={miniPosQtyInput}
                  onChange={(e) =>
                    setMiniPosQtyInput(
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  className="w-full min-w-0 h-11 text-center font-mono font-black text-xl bg-slate-950 border border-slate-700 focus:border-[#FF6600] rounded-lg text-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!selectedProduct}
                  onClick={() => setMiniPosQtyInput((prev) => prev + 1)}
                  className="h-11 w-12 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono font-black text-lg flex items-center justify-center cursor-pointer"
                >
                  +1
                </button>
                <button
                  type="button"
                  disabled={!selectedProduct}
                  onClick={() => handleAddProductToMiniPosCart()}
                  className="h-11 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  + Sumar
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {miniPosCart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center">
                    Escanee artículos y presione "+ Sumar" para cotizar el presupuesto móvil.
                  </div>
                ) : (
                  miniPosCart.map((it) => (
                    <div
                      key={it.product.id}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {it.product.name}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400">
                          {it.quantity} x {formatMoney(it.unitPrice)} ={' '}
                          {formatMoney(it.quantity * it.unitPrice)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateMiniPosQty(it.product.id, -1)
                          }
                          className="w-7 h-7 rounded bg-slate-800 text-white font-mono text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-mono text-xs font-black text-white">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateMiniPosQty(it.product.id, 1)
                          }
                          className="w-7 h-7 rounded bg-slate-800 text-white font-mono text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="shrink-0 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={miniPosCart.length === 0 || isSavingBudget}
                onClick={() => void handleSaveAsFormalBudget()}
                className="py-3 px-3 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Presupuesto</span>
              </button>
              <button
                type="button"
                disabled={miniPosCart.length === 0 || isSavingBudget}
                onClick={() => void handleSendBudgetToClient('whatsapp')}
                className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar WhatsApp / PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
