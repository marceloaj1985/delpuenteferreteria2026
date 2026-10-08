import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Phone,
  Percent,
  Tag,
  MessageCircle,
  Save,
  CheckCircle2,
  QrCode,
  Sparkles,
  FileText,
  Volume2,
  VolumeX,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  Lock,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  ClientItem,
  CommercialDocument,
  ProductItem,
} from '../types/ferreteria.ts';
import {
  CustomPriceListRule,
  loadCustomPriceLists,
  calculateProductPriceForRule,
} from './PriceListsModule.tsx';
import {
  VoucherDocumentData,
  generateVoucherPdfInstance,
  addDaysToTodayIso,
  formatIsoToAr,
  getTodayIso,
} from './OrdersModule.tsx';
import { cleanPhoneForWhatsApp } from '../lib/whatsappVoucherSender.ts';

export interface MobileBudgetCartItem {
  productId: number;
  sku: string;
  barcode?: string;
  name: string;
  brand: string;
  category: string;
  quantity: number;
  baseUnitPrice: number; // Precio original según lista seleccionada
  discountPercent: number; // % de descuento por ítem (0 - 100)
  unitPrice: number; // Precio unitario final (con dto. o ajuste manual)
}

export interface MobileQuickBudgetAppProps {
  products: ProductItem[];
  clients: ClientItem[];
  branchName?: string;
  sellerName?: string;
  pointOfSaleNumber?: string;
  formatCurrency?: (val: string | number) => string;
  deferredPwaPrompt?: any;
  onTriggerPwaInstall?: () => void;
  onBudgetCreated?: (payload: {
    createdDoc: CommercialDocument;
    publicPdfUrl: string;
    toastMsg?: string;
  }) => void;
}

const SAVED_BUDGETS_STORAGE_KEY = 'ferreteria_saved_budgets_list_v1';
const MOBILE_BUDGET_DRAFT_KEY = 'ferreteria_mobile_quick_budget_draft_v1';

function playScanFeedbackBeep(enabled: boolean) {
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
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(1420, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {
    // ignore audio restrictions
  }
}

function getBaseNormalPrice(p: ProductItem): number {
  const rawSale = parseFloat(String(p.salePrice || '0')) || 0;
  if (rawSale > 0) return Number(rawSale.toFixed(2));
  const rawCost = parseFloat(String(p.costPrice || '0')) || 0;
  return rawCost > 0 ? Number((rawCost * 1.6).toFixed(2)) : 1500;
}

export const MobileQuickBudgetApp: React.FC<MobileQuickBudgetAppProps> = ({
  products: externalProducts,
  clients: externalClients,
  branchName = 'Sucursal Central — Av. San Martín 1450',
  sellerName = 'Mostrador Móvil',
  pointOfSaleNumber = '0004',
  formatCurrency: externalFormatCurrency,
  deferredPwaPrompt,
  onTriggerPwaInstall,
  onBudgetCreated,
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

  // Catálogos locales (con respaldo de fetch si se abre directo en /movil/presupuesto-rapido)
  const [products, setProducts] = useState<ProductItem[]>(
    () => externalProducts || []
  );
  const [clients, setClients] = useState<ClientItem[]>(
    () => externalClients || []
  );
  const [priceLists] = useState<CustomPriceListRule[]>(() =>
    loadCustomPriceLists()
  );

  useEffect(() => {
    if (externalProducts && externalProducts.length > 0) {
      setProducts(externalProducts);
    }
  }, [externalProducts]);

  useEffect(() => {
    if (externalClients && externalClients.length > 0) {
      setClients(externalClients);
    }
  }, [externalClients]);

  useEffect(() => {
    if (products.length === 0 || clients.length === 0) {
      fetch('/api/workspace')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          if (Array.isArray(data.products) && data.products.length > 0) {
            setProducts(data.products);
          }
          if (Array.isArray(data.clients) && data.clients.length > 0) {
            setClients(data.clients);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Listas de precios disponibles
  const availablePriceLists = useMemo(() => {
    const base = [
      { id: 'lista-normal', name: 'Lista Normal (Efectivo)' },
      { id: 'lista-gremio', name: 'Lista Gremio / Mayorista' },
      { id: 'lista-tarjeta', name: 'Lista Tarjeta (+9%)' },
    ];
    const seen = new Set(base.map((b) => b.id));
    priceLists.forEach((pl) => {
      if (pl.id && !seen.has(pl.id)) {
        seen.add(pl.id);
        base.push({ id: pl.id, name: pl.name });
      }
    });
    return base;
  }, [priceLists]);

  const computeUnitPriceByList = useCallback(
    (prod: ProductItem, listId: string): number => {
      const normalPrice = getBaseNormalPrice(prod);
      const cardPrice = Number((normalPrice * 1.09).toFixed(2));
      const gremioPrice = Number((normalPrice * 0.9).toFixed(2));

      const norm = (listId || '').toLowerCase();
      if (norm === 'lista-normal' || norm === 'lista-contado') {
        return normalPrice;
      }
      if (norm === 'lista-tarjeta' || norm.includes('tarjeta')) {
        return cardPrice;
      }
      if (
        norm === 'lista-gremio' ||
        norm === 'lista-mayorista' ||
        norm.includes('gremio') ||
        norm.includes('mayorista')
      ) {
        const rule = priceLists.find((r) => r.id === listId);
        return rule ? calculateProductPriceForRule(prod, rule).finalPrice : gremioPrice;
      }
      const matched = priceLists.find(
        (r) => r.id === listId || r.name.toLowerCase() === norm
      );
      if (matched) return calculateProductPriceForRule(prod, matched).finalPrice;
      return normalPrice;
    },
    [priceLists]
  );

  // =========================================================================
  // ESTADO DEL PRESUPUESTO MÓVIL (con persistencia automática anti-pérdida)
  // =========================================================================
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState<string>('Consumidor Final');
  const [clientCuit, setClientCuit] = useState<string>('00-00000000-0');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [selectedPriceListId, setSelectedPriceListId] =
    useState<string>('lista-normal');
  const [validityDays, setValidityDays] = useState<number>(15);

  const [cartItems, setCartItems] = useState<MobileBudgetCartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(MOBILE_BUDGET_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.cartItems)) return parsed.cartItems;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Descuento Global (% o $)
  const [globalDiscountMode, setGlobalDiscountMode] = useState<
    'percent' | 'amount'
  >('percent');
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);

  // Estado de descuento expandido por ítem (productId)
  const [expandedItemDiscountId, setExpandedItemDiscountId] = useState<
    number | null
  >(null);

  // Buscador de Cliente
  const [clientPanelExpanded, setClientPanelExpanded] =
    useState<boolean>(false);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');

  // Buscador Predictivo de Productos + Escáner de Cámara
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [beepEnabled, setBeepEnabled] = useState<boolean>(true);
  const [scanToast, setScanToast] = useState<string | null>(null);

  // Estado de Guardado / WhatsApp / Resultado Exitoso
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [whatsappPromptModalOpen, setWhatsappPromptModalOpen] =
    useState<boolean>(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<{
    docNumber: string;
    publicPdfUrl: string;
    whatsappMessage: string;
    totalAmount: number;
    clientName: string;
    clientPhone: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({
    code: '',
    time: 0,
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Persistir borrador automáticamente para no perder datos jamás
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        MOBILE_BUDGET_DRAFT_KEY,
        JSON.stringify({
          cartItems,
          clientName,
          clientPhone,
          selectedPriceListId,
          globalDiscountMode,
          globalDiscountValue,
        })
      );
    } catch {
      // ignore
    }
  }, [
    cartItems,
    clientName,
    clientPhone,
    selectedPriceListId,
    globalDiscountMode,
    globalDiscountValue,
  ]);

  // =========================================================================
  // BLOQUEO ESTRICTO DE CIERRE ACCIDENTAL Y NAVEGACIÓN ATRÁS
  // =========================================================================
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Asegurar ruta exclusiva /movil/presupuesto-rapido
    if (window.location.pathname !== '/movil/presupuesto-rapido') {
      window.history.replaceState(
        { lockedMobileBudget: true },
        '',
        '/movil/presupuesto-rapido'
      );
    }
    // Empujar un estado centinela para bloquear el gesto "volver atrás" del teléfono
    window.history.pushState(
      { lockedMobileBudget: true },
      '',
      '/movil/presupuesto-rapido'
    );

    const handleBlockBackNavigation = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(
        { lockedMobileBudget: true },
        '',
        '/movil/presupuesto-rapido'
      );
      setScanToast(
        'Cierre bloqueado: Usá "Guardar" o "Enviar por WhatsApp" para finalizar.'
      );
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cartItems.length > 0 && !lastSavedRecord) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('popstate', handleBlockBackNavigation);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('popstate', handleBlockBackNavigation);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [cartItems.length, lastSavedRecord]);

  // Autocultar notificaciones breves de escaneo
  useEffect(() => {
    if (!scanToast) return;
    const t = window.setTimeout(() => setScanToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [scanToast]);

  // =========================================================================
  // CÁMARA TRASERA CONTINUA PARA CÓDIGOS DE BARRAS Y QR
  // =========================================================================
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
        setScanToast('Tu navegador no permite acceso directo a la cámara.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
      setScanToast('Permiso de cámara denegado o cámara no disponible.');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Agregar producto al carrito móvil (o incrementar cantidad si ya existe)
  const handleAddProductToBudget = useCallback(
    (prod: ProductItem, sourceLabel = 'Agregado') => {
      playScanFeedbackBeep(beepEnabled);
      const basePrice = computeUnitPriceByList(prod, selectedPriceListId);
      setLastSavedRecord(null); // Si modifica el carrito, habilita nuevo guardado

      setCartItems((prev) => {
        const existingIdx = prev.findIndex((it) => it.productId === prod.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          const current = next[existingIdx];
          next[existingIdx] = {
            ...current,
            quantity: current.quantity + 1,
          };
          return next;
        }
        return [
          {
            productId: prod.id,
            sku: prod.sku,
            barcode: prod.barcode || prod.sku,
            name: prod.name,
            brand: prod.brand || 'General',
            category: prod.category || 'Ferretería',
            quantity: 1,
            baseUnitPrice: basePrice,
            discountPercent: 0,
            unitPrice: basePrice,
          },
          ...prev,
        ];
      });

      setScanToast(`${sourceLabel}: +1 ${prod.name}`);
      setProductSearchQuery('');
    },
    [beepEnabled, computeUnitPriceByList, selectedPriceListId]
  );

  // Lector continuo BarcodeDetector sobre el stream de video
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

    const interval = window.setInterval(async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        if (Array.isArray(codes) && codes.length > 0) {
          const rawCode = String(codes[0].rawValue || '').trim();
          const now = Date.now();
          if (
            rawCode &&
            (rawCode !== lastScannedRef.current.code ||
              now - lastScannedRef.current.time > 1300)
          ) {
            lastScannedRef.current = { code: rawCode, time: now };
            const q = rawCode.toLowerCase();
            const matched = products.find(
              (p) =>
                p.sku.toLowerCase() === q ||
                (p.barcode && p.barcode.toLowerCase() === q) ||
                String(p.id) === q
            );
            if (matched) {
              handleAddProductToBudget(matched, 'Escaneado');
            } else {
              setScanToast(`Código "${rawCode}" no encontrado en catálogo.`);
            }
          }
        }
      } catch {
        // ignore frame error
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cameraActive, products, handleAddProductToBudget]);

  // Sugerencias predictivas instantáneas de productos
  const predictiveProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, productSearchQuery]);

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return;
    const exact = products.find(
      (p) =>
        p.sku.toLowerCase() === q ||
        (p.barcode && p.barcode.toLowerCase() === q)
    );
    if (exact) {
      handleAddProductToBudget(exact, 'Código');
      return;
    }
    if (predictiveProducts.length > 0) {
      handleAddProductToBudget(predictiveProducts[0], 'Agregado');
    } else {
      setScanToast(`Sin resultados para "${productSearchQuery}".`);
    }
  };

  // =========================================================================
  // SELECTOR DE CLIENTE Y CAMBIO DE LISTA DE PRECIOS
  // =========================================================================
  const filteredClients = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.cuit && c.cuit.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [clients, clientSearchQuery]);

  const handleApplyPriceList = useCallback(
    (newListId: string) => {
      setSelectedPriceListId(newListId);
      setLastSavedRecord(null);
      setCartItems((prev) =>
        prev.map((item) => {
          const prod = products.find((p) => p.id === item.productId);
          const newBase = prod
            ? computeUnitPriceByList(prod, newListId)
            : item.baseUnitPrice;
          const disc = Math.max(0, Math.min(100, item.discountPercent || 0));
          const newUnit = Number((newBase * (1 - disc / 100)).toFixed(2));
          return {
            ...item,
            baseUnitPrice: newBase,
            unitPrice: newUnit,
          };
        })
      );
    },
    [products, computeUnitPriceByList]
  );

  const handleSelectRegisteredClient = (cli: ClientItem) => {
    setSelectedClientId(cli.id);
    setClientName(cli.name);
    setClientCuit(cli.cuit || '00-00000000-0');
    setClientPhone(cli.phone && cli.phone !== '-' ? cli.phone : '');
    setClientSearchQuery('');
    setClientPanelExpanded(false);
    setLastSavedRecord(null);

    // Sincronizar lista de precios asignada al cliente si tiene
    const rawList = (cli.listaPreciosId || cli.priceList || '').toLowerCase();
    if (rawList.includes('gremio') || rawList.includes('mayorista')) {
      handleApplyPriceList('lista-gremio');
    } else if (rawList.includes('tarjeta')) {
      handleApplyPriceList('lista-tarjeta');
    } else if (cli.listaPreciosId) {
      const exists = availablePriceLists.find((l) => l.id === cli.listaPreciosId);
      if (exists) handleApplyPriceList(exists.id);
    }
    setScanToast(`Cliente asignado: ${cli.name}`);
  };

  // =========================================================================
  // CONTROLES DE CANTIDAD Y DESCUENTOS EN EL CARRITO MÓVIL
  // =========================================================================
  const handleUpdateQuantity = (productId: number, delta: number) => {
    setLastSavedRecord(null);
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.productId !== productId) return it;
          const nextQty = it.quantity + delta;
          return nextQty > 0 ? { ...it, quantity: nextQty } : null;
        })
        .filter(Boolean) as MobileBudgetCartItem[]
    );
  };

  const handleSetDirectQuantity = (productId: number, rawVal: string) => {
    const qty = Math.max(1, parseInt(rawVal, 10) || 1);
    setLastSavedRecord(null);
    setCartItems((prev) =>
      prev.map((it) =>
        it.productId === productId ? { ...it, quantity: qty } : it
      )
    );
  };

  const handleRemoveCartItem = (productId: number) => {
    setLastSavedRecord(null);
    setCartItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleUpdateItemDiscountPercent = (
    productId: number,
    rawPercent: number
  ) => {
    const cleanPct = Math.max(
      0,
      Math.min(100, Number(rawPercent.toFixed(2)) || 0)
    );
    setLastSavedRecord(null);
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.productId !== productId) return it;
        const nextUnit = Number(
          (it.baseUnitPrice * (1 - cleanPct / 100)).toFixed(2)
        );
        return {
          ...it,
          discountPercent: cleanPct,
          unitPrice: nextUnit,
        };
      })
    );
  };

  const handleUpdateItemCustomUnitPrice = (
    productId: number,
    rawUnitPrice: number
  ) => {
    const cleanUnit = Math.max(0, Number(rawUnitPrice.toFixed(2)) || 0);
    setLastSavedRecord(null);
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.productId !== productId) return it;
        const impliedPct =
          it.baseUnitPrice > 0 && cleanUnit < it.baseUnitPrice
            ? Number(
                (
                  ((it.baseUnitPrice - cleanUnit) / it.baseUnitPrice) *
                  100
                ).toFixed(1)
              )
            : 0;
        return {
          ...it,
          unitPrice: cleanUnit,
          discountPercent: impliedPct,
        };
      })
    );
  };

  // =========================================================================
  // CÁLCULO EN TIEMPO REAL DE SUBTOTAL, DESCUENTOS Y TOTAL FINAL
  // =========================================================================
  const totals = useMemo(() => {
    // Subtotal original bruto (sin descuentos por ítem ni global)
    const grossOriginalSubtotal = cartItems.reduce(
      (acc, it) => acc + it.quantity * it.baseUnitPrice,
      0
    );
    // Subtotal luego de aplicar descuentos por ítem
    const subtotalAfterItemDiscounts = cartItems.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice,
      0
    );
    const itemDiscountsTotal = Math.max(
      0,
      Number((grossOriginalSubtotal - subtotalAfterItemDiscounts).toFixed(2))
    );

    // Descuento general (global) aplicado sobre el subtotal de líneas
    const globalDiscountAmount =
      globalDiscountMode === 'percent'
        ? Number(
            (
              subtotalAfterItemDiscounts *
              (Math.min(100, Math.max(0, globalDiscountValue)) / 100)
            ).toFixed(2)
          )
        : Math.min(
            subtotalAfterItemDiscounts,
            Math.max(0, Number(globalDiscountValue) || 0)
          );

    const totalAllDiscounts = Number(
      (itemDiscountsTotal + globalDiscountAmount).toFixed(2)
    );
    const finalTotal = Math.max(
      0,
      Number((subtotalAfterItemDiscounts - globalDiscountAmount).toFixed(2))
    );
    const totalUnits = cartItems.reduce((acc, it) => acc + it.quantity, 0);

    return {
      grossOriginalSubtotal,
      subtotalAfterItemDiscounts,
      itemDiscountsTotal,
      globalDiscountAmount,
      totalAllDiscounts,
      finalTotal,
      totalUnits,
    };
  }, [cartItems, globalDiscountMode, globalDiscountValue]);

  // =========================================================================
  // GENERACIÓN DEL MENSAJE DETALLADO Y PDF DESCARGABLE PARA WHATSAPP / GUARDADO
  // =========================================================================
  const buildFormattedWhatsAppBudgetText = useCallback(
    (params: {
      docNumber: string;
      issueDateAr: string;
      validUntilAr: string;
      publicPdfUrl: string;
    }) => {
      const lines: string[] = [
        `*FERRETERÍA DEL PUENTE — PRESUPUESTO OFICIAL*`,
        `📄 *Presupuesto N°:* ${params.docNumber}`,
        `📅 *Fecha:* ${params.issueDateAr} (Válido hasta ${params.validUntilAr})`,
        `👤 *Cliente:* ${clientName.trim() || 'Consumidor Final'}${
          clientCuit && clientCuit !== '00-00000000-0'
            ? ` (CUIT: ${clientCuit})`
            : ''
        }`,
        `────────────────────────`,
        `*DETALLE DE PRODUCTOS COTIZADOS:*`,
      ];

      cartItems.forEach((it, idx) => {
        const lineTotal = it.quantity * it.unitPrice;
        const hasItemDisc = it.discountPercent > 0;
        lines.push(
          `${idx + 1}. *${it.quantity} x ${it.name}* [${it.sku}]`,
          hasItemDisc
            ? `   • P. Lista: ${formatMoney(it.baseUnitPrice)} | *Dto. -${it.discountPercent}%* → P. Unit: ${formatMoney(it.unitPrice)} = *${formatMoney(lineTotal)}*`
            : `   • P. Unit: ${formatMoney(it.unitPrice)} = *${formatMoney(lineTotal)}*`
        );
      });

      lines.push(`────────────────────────`);
      lines.push(
        `• *Subtotal Original:* ${formatMoney(totals.grossOriginalSubtotal)}`
      );

      if (totals.itemDiscountsTotal > 0) {
        lines.push(
          `• *Descuentos por Ítem:* -${formatMoney(totals.itemDiscountsTotal)}`
        );
      }

      if (totals.globalDiscountAmount > 0) {
        const globalLabel =
          globalDiscountMode === 'percent'
            ? `Descuento General (${globalDiscountValue}%)`
            : `Descuento General`;
        lines.push(
          `• *${globalLabel}:* -${formatMoney(totals.globalDiscountAmount)}`
        );
      }

      if (totals.totalAllDiscounts > 0) {
        lines.push(
          `✨ *Ahorro Total Aplicado:* -${formatMoney(totals.totalAllDiscounts)}`
        );
      }

      lines.push(`💰 *TOTAL FINAL: ${formatMoney(totals.finalTotal)}*`);
      lines.push(`────────────────────────`);
      lines.push(`📥 *Descargar Presupuesto en PDF / Vista Interactiva:*`);
      lines.push(`${params.publicPdfUrl}`);
      lines.push(
        `\n_Gracias por su consulta. Quedamos a su disposición en Ferretería del Puente._`
      );

      return lines.join('\n');
    },
    [
      cartItems,
      clientName,
      clientCuit,
      totals,
      globalDiscountMode,
      globalDiscountValue,
      formatMoney,
    ]
  );

  // Función central que guarda el presupuesto en PostgreSQL + Movimientos de Ventas + genera el PDF público
  const persistBudgetAndGeneratePdf = useCallback(async (): Promise<{
    docNumber: string;
    publicPdfUrl: string;
    whatsappMessage: string;
    totalAmount: number;
    clientName: string;
    clientPhone: string;
  } | null> => {
    if (cartItems.length === 0) {
      setScanToast('Agregá al menos un producto al presupuesto.');
      return null;
    }

    // Si ya fue guardado sin cambios posteriores, reutilizar registro
    if (lastSavedRecord) {
      return lastSavedRecord;
    }

    setIsProcessing(true);
    try {
      const pv = pointOfSaleNumber || '0004';
      const randomSix = String(Math.floor(19000 + Math.random() * 80000)).padStart(
        8,
        '0'
      );
      const docNumber = `PRE-${pv}-${randomSix}`;
      const todayIso = getTodayIso();
      const validUntilIso = addDaysToTodayIso(validityDays);
      const issueDateAr = formatIsoToAr(todayIso);
      const validUntilAr = formatIsoToAr(validUntilIso);

      const cleanClientName = clientName.trim() || 'Consumidor Final';
      const cleanCuit = clientCuit.trim() || '00-00000000-0';
      const activeListObj =
        availablePriceLists.find((l) => l.id === selectedPriceListId) ||
        availablePriceLists[0];

      // 1. Guardar en Base de Datos (/api/documents -> aparece en Movimientos de Ventas)
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: 'Presupuesto',
          docNumber,
          clientName: cleanClientName,
          clientCuit: cleanCuit,
          branchName,
          sellerName,
          itemsCount: totals.totalUnits,
          totalAmount: totals.finalTotal.toFixed(2),
          status: 'Emitido',
        }),
      });

      if (!res.ok) {
        throw new Error('No se pudo registrar el presupuesto en el servidor.');
      }
      const createdDoc: CommercialDocument = await res.json();

      // 2. Guardar también en el listado local de Presupuestos del POS (ferreteria_saved_budgets_list_v1)
      if (typeof window !== 'undefined') {
        try {
          const existingRaw = window.localStorage.getItem(
            SAVED_BUDGETS_STORAGE_KEY
          );
          const existingList = existingRaw ? JSON.parse(existingRaw) : [];
          const newSavedBudget = {
            id: docNumber,
            docNumber,
            dateIso: todayIso,
            validUntilIso,
            clientId: selectedClientId,
            clientName: cleanClientName,
            clientCuit: cleanCuit,
            clientPhone: clientPhone.trim(),
            priceListId: selectedPriceListId,
            priceListName: activeListObj.name,
            discountMode: globalDiscountMode,
            discountValue: globalDiscountValue,
            totalAmount: totals.finalTotal,
            status: 'Aceptado',
            items: cartItems.map((it) => ({
              productId: it.productId,
              sku: it.sku,
              name: it.name,
              brand: it.brand,
              category: it.category,
              quantity: it.quantity,
              normalPrice: it.baseUnitPrice,
              cardPrice: Number((it.baseUnitPrice * 1.09).toFixed(2)),
              discountPercent: it.discountPercent,
              baseUnitPrice: it.baseUnitPrice,
              unitPrice: it.unitPrice,
            })),
          };
          window.localStorage.setItem(
            SAVED_BUDGETS_STORAGE_KEY,
            JSON.stringify([
              newSavedBudget,
              ...(Array.isArray(existingList) ? existingList : []),
            ])
          );
        } catch {
          // ignore storage error
        }
      }

      // 3. Generar el PDF A4 con desglose completo de descuentos y alojarlo en /pdfs/Presupuesto_...pdf
      const safeFilename = `Presupuesto_${docNumber.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      )}.pdf`;
      let publicPdfUrl = `${window.location.origin}/pdfs/${encodeURIComponent(
        safeFilename
      )}`;

      try {
        const voucherData: VoucherDocumentData = {
          docType: 'Presupuesto',
          docNumber,
          dateFormatted: issueDateAr,
          dueDateFormatted: validUntilAr,
          issueDate: issueDateAr,
          validUntilDate: validUntilAr,
          validityText: `${validityDays} días corridos`,
          recipientRoleLabel: 'CLIENTE / DESTINATARIO',
          partyLabel: 'Cliente',
          partyName: cleanClientName,
          partyCuit: cleanCuit,
          partyPhone: clientPhone.trim() || '-',
          branchName,
          operatorName: sellerName,
          statusLabel: 'PRESUPUESTO COTIZADO',
          supplierName: cleanClientName,
          supplierCuit: cleanCuit,
          supplierPhone: clientPhone.trim() || '-',
          status: 'Vigente',
          secondaryStatus: activeListObj.name,
          totalAmount: totals.finalTotal,
          subtotalBeforeGlobalDiscount: totals.subtotalAfterItemDiscounts,
          globalDiscountPct:
            globalDiscountMode === 'percent' ? globalDiscountValue : undefined,
          globalDiscountAmount: totals.globalDiscountAmount,
          paymentMethod: activeListObj.name,
          reason: `Presupuesto Rápido Móvil (${validityDays} días de validez)`,
          notes: `Emitido desde Presupuesto Rápido Móvil. Lista: ${activeListObj.name}.`,
          items: cartItems.map((it) => ({
            sku: it.sku,
            name: it.name,
            description: it.name,
            quantity: it.quantity,
            unitCost: it.unitPrice,
            unitPrice: it.unitPrice,
            originalUnitPrice: it.baseUnitPrice,
            discountPct: it.discountPercent,
            discountAmount: Number(
              ((it.baseUnitPrice - it.unitPrice) * it.quantity).toFixed(2)
            ),
            subtotal: Number((it.quantity * it.unitPrice).toFixed(2)),
          })),
        };

        const { pdf: pdfDoc } = await generateVoucherPdfInstance(
          voucherData,
          formatMoney
        );
        const pdfBase64 = pdfDoc.output('datauristring');

        const uploadRes = await fetch('/api/public-pdfs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: safeFilename,
            pdfBase64,
          }),
        });

        if (uploadRes.ok) {
          // Exponer URL limpia bajo /pdfs/...
          publicPdfUrl = `${window.location.origin}/pdfs/${encodeURIComponent(
            safeFilename
          )}`;
        }
      } catch {
        // Si falla el renderizado canvas en algún navegador, el servidor sirve el PDF limpio en /pdfs/:filename
      }

      // 4. Registrar auditoría móvil
      fetch('/api/scanner/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: sellerName,
          actionType: 'Presupuesto Mini POS',
          actionDetail: `Presupuesto Rápido Móvil ${docNumber} (${totals.totalUnits} u. · Total ${formatMoney(totals.finalTotal)})`,
          referenceCode: docNumber,
          targetName: cleanClientName,
          branchName,
        }),
      }).catch(() => {});

      const whatsappMessage = buildFormattedWhatsAppBudgetText({
        docNumber,
        issueDateAr,
        validUntilAr,
        publicPdfUrl,
      });

      const savedInfo = {
        docNumber,
        publicPdfUrl,
        whatsappMessage,
        totalAmount: totals.finalTotal,
        clientName: cleanClientName,
        clientPhone: clientPhone.trim(),
      };

      setLastSavedRecord(savedInfo);
      onBudgetCreated?.({
        createdDoc,
        publicPdfUrl,
        toastMsg: `Presupuesto ${docNumber} registrado en Movimientos de Ventas`,
      });

      return savedInfo;
    } catch (err: any) {
      setScanToast(err?.message || 'Error al guardar el presupuesto.');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [
    cartItems,
    lastSavedRecord,
    pointOfSaleNumber,
    validityDays,
    clientName,
    clientCuit,
    clientPhone,
    selectedClientId,
    selectedPriceListId,
    availablePriceLists,
    branchName,
    sellerName,
    totals,
    globalDiscountMode,
    globalDiscountValue,
    buildFormattedWhatsAppBudgetText,
    formatMoney,
    onBudgetCreated,
  ]);

  // ACCIÓN 1: BOTÓN "GUARDAR"
  const handleSaveOnlyAction = async () => {
    const saved = await persistBudgetAndGeneratePdf();
    if (saved) {
      playScanFeedbackBeep(beepEnabled);
      setScanToast(
        `Presupuesto ${saved.docNumber} guardado en Movimientos de Ventas.`
      );
    }
  };

  // ACCIÓN 2: BOTÓN "ENVIAR POR WHATSAPP"
  const handleSendWhatsAppAction = async () => {
    if (cartItems.length === 0) {
      setScanToast('Agregá al menos un producto antes de enviar por WhatsApp.');
      return;
    }

    const cleanedPhone = cleanPhoneForWhatsApp(clientPhone);
    if (!cleanedPhone || cleanedPhone.length < 10) {
      // Abrir mini diálogo para ingresar el WhatsApp del cliente y disparar inmediatamente
      setWhatsappPromptModalOpen(true);
      return;
    }

    const saved = await persistBudgetAndGeneratePdf();
    if (!saved) return;

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(
      saved.whatsappMessage
    )}`;
    window.location.href = waUrl;
  };

  // Limpiar para iniciar un nuevo presupuesto luego de haber guardado/enviado
  const handleStartFreshBudget = () => {
    setCartItems([]);
    setGlobalDiscountValue(0);
    setLastSavedRecord(null);
    setSelectedClientId(null);
    setClientName('Consumidor Final');
    setClientCuit('00-00000000-0');
    setClientPhone('');
    try {
      window.localStorage.removeItem(MOBILE_BUDGET_DRAFT_KEY);
    } catch {
      // ignore
    }
    setScanToast('Listo para confeccionar un nuevo presupuesto.');
  };

  return (
    <div className="fixed inset-0 h-dvh w-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none overscroll-none">
      {/* NOTIFICACIÓN FLOTANTE COMPACTA */}
      {scanToast && (
        <div className="fixed top-3 left-3 right-3 z-50 bg-slate-900/95 border border-[#FF6600] text-white px-3.5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-[#FF6600] shrink-0" />
          <span className="truncate">{scanToast}</span>
        </div>
      )}

      {/* CABECERA COMPACTA MÓVIL (SIN BOTONES DE CIERRE "X" NI VOLVER ATRÁS) */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FF6600] flex items-center justify-center shrink-0 shadow-sm">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-black uppercase tracking-wider text-white truncate">
                Presupuesto Rápido Móvil
              </h1>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-extrabold uppercase">
                <Lock className="w-2.5 h-2.5" /> Modo Seguro
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {branchName} · Operador: {sellerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {deferredPwaPrompt && onTriggerPwaInstall && (
            <button
              type="button"
              onClick={onTriggerPwaInstall}
              className="px-2.5 py-1.5 rounded-lg bg-[#FF6600]/20 border border-[#FF6600]/50 text-[#FF6600] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Download className="w-3 h-3" />
              Instalar
            </button>
          )}
          <button
            type="button"
            onClick={() => setBeepEnabled((prev) => !prev)}
            title={beepEnabled ? 'Sonido activado' : 'Silenciado'}
            className={`p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
              beepEnabled
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            {beepEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* SECCIÓN SUPERIOR DE ENTRADA RÁPIDA: CLIENTE + BUSCADOR PREDICTIVO + CÁMARA */}
      <div className="shrink-0 bg-slate-900/90 border-b border-slate-800 px-3 py-2 space-y-2">
        {/* FILA 1: CLIENTE + WHATSAPP + LISTA DE PRECIOS */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setClientPanelExpanded((prev) => !prev)}
              className="flex-1 flex items-center justify-between gap-2 text-left min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-[#FF6600]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span>Cliente:</span>
                    {clientPhone && (
                      <span className="text-emerald-400 font-mono">
                        · WA: {clientPhone}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-black text-white truncate">
                    {clientName || 'Consumidor Final'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#FF6600] shrink-0">
                <span>{clientPanelExpanded ? 'Cerrar' : 'Cambiar'}</span>
                {clientPanelExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {/* Selector rápido de Lista de Precios */}
            <select
              value={selectedPriceListId}
              onChange={(e) => handleApplyPriceList(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-extrabold text-amber-300 focus:outline-none focus:border-[#FF6600] max-w-[140px] truncate"
            >
              {availablePriceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </div>

          {/* PANEL DESPLEGABLE DE SELECCIÓN / CARGA RÁPIDA DE CLIENTE OCASIONAL */}
          {clientPanelExpanded && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  placeholder="Buscar cliente registrado por Nombre o CUIT..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              {clientSearchQuery.trim().length > 0 && (
                <div className="max-h-36 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg divide-y divide-slate-800">
                  {filteredClients.map((cli) => (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => handleSelectRegisteredClient(cli)}
                      className="w-full px-2.5 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          {cli.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          CUIT: {cli.cuit} · Tel: {cli.phone || 'Sin teléfono'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#FF6600]/20 text-[#FF6600] text-[10px] font-bold shrink-0">
                        Elegir
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Campos directos para cliente ocasional o edición rápida de Nombre y WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Nombre / Razón Social
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setLastSavedRecord(null);
                    }}
                    placeholder="Ej: Juan Pérez / Obra Mitre"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 mb-0.5">
                    Teléfono / WhatsApp Cliente
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => {
                        setClientPhone(e.target.value);
                        setLastSavedRecord(null);
                      }}
                      placeholder="Ej: 11 2345-6789"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FILA 2: BUSCADOR PREDICTIVO DE PRODUCTOS + BOTÓN DESTACADO DE ESCÁNER CÁMARA */}
        <div className="relative">
          <form
            onSubmit={handleSearchFormSubmit}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#FF6600] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Buscar producto por nombre, SKU o código..."
                className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border-2 border-slate-700 focus:border-[#FF6600] rounded-xl text-xs font-bold text-white placeholder-slate-400 focus:outline-none"
              />
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-black px-1"
                >
                  ×
                </button>
              )}
            </div>

            {/* BOTÓN DESTACADO DE CÁMARA TRASERA CONTINUA */}
            <button
              type="button"
              onClick={() => (cameraActive ? stopCamera() : void startCamera())}
              className={`px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer active:scale-95 transition-all ${
                cameraActive
                  ? 'bg-red-600 hover:bg-red-500 text-white border-2 border-red-400 animate-pulse'
                  : 'bg-[#FF6600] hover:bg-orange-500 text-white border-2 border-orange-400'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{cameraActive ? 'Detener' : 'Escanear'}</span>
            </button>
          </form>

          {/* SUGERENCIAS PREDICTIVAS INSTANTÁNEAS AL ESCRIBIR (UN TOQUE PARA AGREGAR) */}
          {predictiveProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-slate-900 border-2 border-[#FF6600] rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-800">
              {predictiveProducts.map((prod) => {
                const unitPrice = computeUnitPriceByList(
                  prod,
                  selectedPriceListId
                );
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() =>
                      handleAddProductToBudget(prod, 'Toque rápido')
                    }
                    className="w-full px-3 py-2.5 text-left hover:bg-slate-800 active:bg-slate-700 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-white truncate">
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-amber-300 font-bold">
                          {prod.sku}
                        </span>
                        <span>· {prod.brand}</span>
                        <span
                          className={
                            prod.stock > 0
                              ? 'text-emerald-400 font-semibold'
                              : 'text-red-400 font-semibold'
                          }
                        >
                          · Stock: {prod.stock} u.
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div className="text-xs font-black text-emerald-400 font-mono">
                          {formatMoney(unitPrice)}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold">
                          + Tocar para sumar
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-[#FF6600] text-white flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* VISOR DE CÁMARA TRASERA EN VIVO CUANDO ESTÁ ACTIVO */}
        {cameraActive && (
          <div className="relative rounded-xl overflow-hidden border-2 border-[#FF6600] bg-black h-36">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-48 h-20 border-2 border-[#FF6600] rounded-lg shadow-[0_0_20px_rgba(255,102,0,0.5)] relative">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#FF6600] animate-pulse" />
              </div>
              <span className="mt-1.5 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-bold text-amber-300">
                Apuntá al código de barras o QR para sumar al presupuesto
              </span>
            </div>
          </div>
        )}
      </div>

      {/* LISTA CENTRAL COMPACTA DE PRODUCTOS EN EL CARRITO MÓVIL */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* BANNER DE CONFIRMACIÓN CUANDO YA SE GUARDÓ EL PRESUPUESTO */}
        {lastSavedRecord && (
          <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-xl p-3 space-y-2 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-black uppercase text-emerald-300">
                    Presupuesto {lastSavedRecord.docNumber} Registrado
                  </div>
                  <div className="text-[10px] text-emerald-200/80">
                    Guardado en Base de Datos y en Movimientos de Ventas
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartFreshBudget}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Nuevo
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-800/70 text-[11px]">
              <a
                href={lastSavedRecord.publicPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-amber-300 hover:underline truncate"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Ver / Descargar PDF Oficial</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <span className="font-mono font-bold text-white shrink-0">
                {formatMoney(lastSavedRecord.totalAmount)}
              </span>
            </div>
          </div>
        )}

        {cartItems.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-4 py-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2.5 text-[#FF6600]">
              <QrCode className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-slate-200 uppercase tracking-wide">
              Carrito de Presupuesto Vacío
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              Usá el buscador predictivo superior o presioná{' '}
              <strong className="text-[#FF6600]">Escanear</strong> para leer
              códigos de barras con la cámara.
            </p>

            {/* Botones de carga rápida de productos frecuentes para cotizar con 1 toque */}
            {products.length > 0 && (
              <div className="mt-4 w-full max-w-md">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Sugerencias rápidas (1 toque):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {products.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        handleAddProductToBudget(p, 'Acceso rápido')
                      }
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between gap-1.5 cursor-pointer active:scale-98"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400 font-bold">
                          {formatMoney(
                            computeUnitPriceByList(p, selectedPriceListId)
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-[#FF6600] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          cartItems.map((item) => {
            const lineSubtotal = item.quantity * item.unitPrice;
            const lineOriginalSubtotal = item.quantity * item.baseUnitPrice;
            const lineSavings = Math.max(
              0,
              lineOriginalSubtotal - lineSubtotal
            );
            const isDiscountOpen = expandedItemDiscountId === item.productId;

            return (
              <div
                key={item.productId}
                className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                        {item.sku}
                      </span>
                      <h3 className="text-xs font-extrabold text-white truncate">
                        {item.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {item.discountPercent > 0 ? (
                        <>
                          <span className="line-through text-slate-500 font-mono">
                            {formatMoney(item.baseUnitPrice)}
                          </span>
                          <span className="font-mono font-bold text-emerald-400">
                            {formatMoney(item.unitPrice)} c/u
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black">
                            -{item.discountPercent}% DTO.
                          </span>
                        </>
                      ) : (
                        <span className="font-mono font-bold text-slate-300">
                          {formatMoney(item.unitPrice)} c/u
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subtotal de la línea + Botón eliminar */}
                  <div className="text-right shrink-0 flex items-start gap-2">
                    <div>
                      <div className="text-sm font-black text-white font-mono">
                        {formatMoney(lineSubtotal)}
                      </div>
                      {lineSavings > 0 && (
                        <div className="text-[10px] font-bold text-emerald-400 font-mono">
                          Ahorro: -{formatMoney(lineSavings)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCartItem(item.productId)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 cursor-pointer"
                      title="Quitar ítem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* CONTROLES TÁCTILES GRANDES DE CANTIDAD (- / +) Y BOTÓN DE DESCUENTO POR ÍTEM */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.productId, -1)}
                      className="w-9 h-9 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-black text-base active:scale-95 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        handleSetDirectQuantity(item.productId, e.target.value)
                      }
                      className="w-14 h-9 bg-slate-950 border border-slate-700 rounded-xl text-center font-mono font-black text-sm text-white focus:outline-none focus:border-[#FF6600]"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.productId, 1)}
                      className="w-9 h-9 rounded-xl bg-[#FF6600] hover:bg-orange-500 text-white flex items-center justify-center font-black text-base active:scale-95 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Botón rápido para abrir/ajustar Descuento por Ítem o Precio Unitario */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedItemDiscountId((prev) =>
                        prev === item.productId ? null : item.productId
                      )
                    }
                    className={`px-2.5 py-2 rounded-xl border text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${
                      item.discountPercent > 0 || isDiscountOpen
                        ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {item.discountPercent > 0
                        ? `Dto. ${item.discountPercent}%`
                        : 'Dto. / Precio'}
                    </span>
                  </button>
                </div>

                {/* PANEL COMPACTO DE DESCUENTO POR ÍTEM (% O PRECIO UNITARIO) */}
                {isDiscountOpen && (
                  <div className="pt-2 border-t border-slate-800 bg-slate-950/90 rounded-lg p-2 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Dto. Rápido Ítem:
                      </span>
                      <div className="flex items-center gap-1">
                        {[0, 5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              handleUpdateItemDiscountPercent(
                                item.productId,
                                pct
                              )
                            }
                            className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer ${
                              item.discountPercent === pct
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {pct === 0 ? '0%' : `-${pct}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                          % Descuento Ítem
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={item.discountPercent || ''}
                          onChange={(e) =>
                            handleUpdateItemDiscountPercent(
                              item.productId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0%"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                          Precio Unit. Final ($)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleUpdateItemCustomUnitPrice(
                              item.productId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* PIE FIJO / STICKY FOOTER: DESCUENTO GENERAL + RESUMEN + GUARDAR Y ENVIAR POR WHATSAPP */}
      <footer className="shrink-0 bg-slate-900 border-t-2 border-slate-800 px-3 pt-2 pb-3 space-y-2 shadow-[0_-8px_25px_rgba(0,0,0,0.6)]">
        {/* FILA DE DESCUENTO GENERAL (% o $) Y VALIDEZ */}
        <div className="flex items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
              Dto. General:
            </span>
            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setGlobalDiscountMode('percent');
                  setLastSavedRecord(null);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                  globalDiscountMode === 'percent'
                    ? 'bg-[#FF6600] text-white'
                    : 'text-slate-400'
                }`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => {
                  setGlobalDiscountMode('amount');
                  setLastSavedRecord(null);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                  globalDiscountMode === 'amount'
                    ? 'bg-[#FF6600] text-white'
                    : 'text-slate-400'
                }`}
              >
                $
              </button>
            </div>
            <input
              type="number"
              min={0}
              max={globalDiscountMode === 'percent' ? 100 : undefined}
              value={globalDiscountValue || ''}
              onChange={(e) => {
                setGlobalDiscountValue(
                  Math.max(0, parseFloat(e.target.value) || 0)
                );
                setLastSavedRecord(null);
              }}
              placeholder={globalDiscountMode === 'percent' ? '0%' : '$0'}
              className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-black text-emerald-400 text-right focus:outline-none focus:border-[#FF6600]"
            />
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="font-bold">Validez:</span>
            <select
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value) || 15)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
            >
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
            </select>
          </div>
        </div>

        {/* DESGLOSE DE SUBTOTAL, TOTAL DESCUENTOS Y TOTAL FINAL DESTACADO */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="space-y-0.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-400">
              <span>
                Subtotal ({totals.totalUnits}{' '}
                {totals.totalUnits === 1 ? 'u.' : 'u.'}):
              </span>
              <span className="font-mono font-bold text-slate-200">
                {formatMoney(totals.grossOriginalSubtotal)}
              </span>
            </div>
            {totals.totalAllDiscounts > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>
                  Ahorro / Descuentos: -{formatMoney(totals.totalAllDiscounts)}
                </span>
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
              Total Final
            </div>
            <div className="text-xl font-black font-mono text-white leading-none">
              {formatMoney(totals.finalTotal)}
            </div>
          </div>
        </div>

        {/* ÚNICAS 2 ACCIONES DE SALIDA / FINALIZACIÓN PERMITIDAS: GUARDAR Y ENVIAR POR WHATSAPP */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            disabled={isProcessing || cartItems.length === 0}
            onClick={() => void handleSaveOnlyAction()}
            className="py-3 px-3 rounded-xl bg-[#FF6600] hover:bg-orange-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 transition-all"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>{isProcessing ? 'Guardando...' : 'Guardar'}</span>
          </button>

          <button
            type="button"
            disabled={isProcessing || cartItems.length === 0}
            onClick={() => void handleSendWhatsAppAction()}
            className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 transition-all"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Enviar por WhatsApp</span>
          </button>
        </div>
      </footer>

      {/* MODAL LIVIANO SI FALTA INGRESAR EL TELÉFONO AL PULSAR "ENVIAR POR WHATSAPP" */}
      {whatsappPromptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-emerald-500 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400">
              <MessageCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black uppercase">
                WhatsApp del Cliente
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              Ingresá el número móvil del cliente para enviarle el presupuesto y
              el enlace PDF descargable:
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white mb-2"
              />
              <label className="block text-[10px] font-bold uppercase text-emerald-400 mb-1">
                Número de WhatsApp (con código de área)
              </label>
              <input
                type="tel"
                autoFocus
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ej: 11 2345-6789"
                className="w-full px-3 py-2.5 bg-slate-950 border-2 border-emerald-500/60 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
            {cleanPhoneForWhatsApp(clientPhone).length > 0 &&
              cleanPhoneForWhatsApp(clientPhone).length < 10 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Ingresá al menos 10 dígitos (ej. 1123456789).</span>
                </div>
              )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setWhatsappPromptModalOpen(false)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase cursor-pointer"
              >
                Seguir Editando
              </button>
              <button
                type="button"
                disabled={cleanPhoneForWhatsApp(clientPhone).length < 10}
                onClick={async () => {
                  setWhatsappPromptModalOpen(false);
                  const saved = await persistBudgetAndGeneratePdf();
                  if (!saved) return;
                  const cleaned = cleanPhoneForWhatsApp(clientPhone);
                  const waUrl = `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(
                    saved.whatsappMessage
                  )}`;
                  window.location.href = waUrl;
                }}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Confirmar y Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
