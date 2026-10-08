import React, { useState, useEffect, useMemo } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  Plus,
  Search,
  ShoppingCart,
  FileText,
  FileCheck,
  ClipboardList,
  Truck,
  Tag,
  BarChart3,
  ShoppingBag,
  Users,
  Package,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Building2,
  UserCheck,
  LogOut,
  X,
  SlidersHorizontal,
  Percent,
  FileSpreadsheet,
  Printer,
  Download,
  MessageCircle,
  AlertTriangle,
  Lock,
  Clock,
  Trophy,
  Wallet,
  ShieldCheck,
  Barcode,
  Smartphone,
  QrCode,
  Wrench,
  ExternalLink,
  ArrowLeft,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { Sidebar, MobileQuickMode } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { StatusBadge } from './components/StatusBadge.tsx';
import {
  ProductsModule,
  enrichProductWithExtendedMeta,
  getSingularContentTypeLabel,
  calculateUnitFractionalCost,
} from './components/ProductsModule.tsx';
import { SuppliersModule, SuppliersSubTab } from './components/SuppliersModule.tsx';
import { PriceListsModule } from './components/PriceListsModule.tsx';
import {
  ClientsModule,
  evaluateAllClientsCreditStatus,
} from './components/ClientsModule.tsx';
import {
  UsersRolesModule,
  DEFAULT_SYSTEM_OPERATORS,
  loadSystemOperators,
  resolveSystemRole,
  isSectionAllowedForRole,
  getDefaultSectionForRole,
  canViewCostsForRole,
  loadSystemAdminConfig,
  SystemAdminConfig,
  AdminCenterTab,
} from './components/UsersRolesModule.tsx';
import {
  CashRegisterModule,
  CashSubTab,
  isCashRegisterOpenOrInitialized,
} from './components/CashRegisterModule.tsx';
import {
  VoucherActionModal,
  VoucherDocumentData,
} from './components/OrdersModule.tsx';
import {
  BulkImportModal,
  BulkImportMode,
  downloadEntityTemplate,
} from './components/BulkImportModal.tsx';
import { BulkProductEditorModule } from './components/BulkProductEditorModule.tsx';
import { SalesPosWorkspaceModule } from './components/SalesPosWorkspaceModule.tsx';
import { SalesMovementsModule } from './components/SalesMovementsModule.tsx';
import { DashboardModule } from './components/DashboardModule.tsx';
import { MobileScannerPwaModule } from './components/MobileScannerPwaModule.tsx';
import { MobileQuickBudgetApp } from './components/MobileQuickBudgetApp.tsx';
import {
  OnboardingWizardModal,
  OnboardingStepNumber,
} from './components/OnboardingWizardModal.tsx';
import { UpdateBanner } from './components/UpdateBanner.tsx';
import {
  Branch,
  ClientItem,
  CommercialDocument,
  NavSectionId,
  ProductItem,
  SellerProfile,
  SupplierItem,
  ScannerAuditLogItem,
} from './types/ferreteria.ts';

const SECTION_META: Record<
  NavSectionId,
  {
    title: string;
    breadcrumb: string;
    subtitle: string;
    primaryCta: string;
  }
> = {
  inicio: {
    title: 'Panel General de Gestión',
    breadcrumb: 'Inicio / Resumen Operativo',
    subtitle:
      'Vista consolidada de operaciones diarias, comprobantes recientes y estado de sucursal.',
    primaryCta: 'Nuevo Presupuesto',
  },
  'punto-de-venta': {
    title: 'Punto de Venta Mostrador (POS)',
    breadcrumb: 'Ventas / Nueva Venta (POS)',
    subtitle:
      'Terminal ágil para ventas de mostrador con lector de código de barras y listas de precios.',
    primaryCta: 'Confirmar Venta Mostrador',
  },
  'nuevo-presupuesto': {
    title: 'Nuevo Presupuesto Comercial',
    breadcrumb: 'Ventas / Nuevo Presupuesto',
    subtitle:
      'Armado rápido de presupuestos y cotizaciones para clientes, gremio y obras con conversión directa a venta.',
    primaryCta: 'Guardar Presupuesto',
  },
  caja: {
    title: 'Módulo de Caja — Turnos, Arqueos y Movimientos Diarios',
    breadcrumb: 'Caja / Apertura, Ingresos, Egresos y Medios de Pago',
    subtitle:
      'Control de apertura y cierre de caja por turno, registro de ingresos/egresos manuales, historial de cajas diarias y resumen de cobros por medio de pago.',
    primaryCta: 'Registrar Movimiento de Caja',
  },
  'ventas-presupuestos': {
    title: 'Gestión de Presupuestos',
    breadcrumb: 'Ventas / Presupuestos',
    subtitle:
      'Cotizaciones para obras, gremio y mostrador con seguimiento de estados (Borrador y Aceptado).',
    primaryCta: 'Nuevo Presupuesto',
  },
  'ventas-facturas': {
    title: 'Comprobantes y Facturación Electrónica',
    breadcrumb: 'Ventas / Facturas',
    subtitle:
      'Emisión de Facturas A, B y Notas de Crédito vinculadas al Punto de Venta AFIP/ARCA.',
    primaryCta: 'Emitir Factura',
  },
  'ventas-devoluciones': {
    title: 'Nueva Devolución y Notas de Crédito Clientes',
    breadcrumb: 'Ventas / Nueva Devolución',
    subtitle:
      'Gestión de devoluciones de mercadería, emisión de Notas de Crédito A/B, reintegro de stock al inventario y acreditación en Cuenta Corriente.',
    primaryCta: 'Emitir Nota de Crédito / Devolución',
  },
  'ventas-remitos': {
    title: 'Remitos de Entrega y Despacho',
    breadcrumb: 'Ventas / Remitos',
    subtitle:
      'Control de mercadería despachada en obra y retiros por depósito.',
    primaryCta: 'Generar Remito',
  },
  'pago-cuenta-corriente': {
    title: 'Pago de Cuenta Corriente Clientes',
    breadcrumb: 'Ventas / Pago Cuenta Corriente',
    subtitle:
      'Registro de cobros, recibos e imputación de pagos sobre saldos de Cuentas Corrientes de clientes.',
    primaryCta: 'Registrar Cobro Cta. Cte.',
  },
  'facturar-compra': {
    title: 'Facturar Compra e Ingreso de Mercadería',
    breadcrumb: 'Ventas / Facturar Compra',
    subtitle:
      'Carga de facturas de compra de proveedores con actualización automática de stock y costos en el inventario.',
    primaryCta: 'Registrar Factura de Compra',
  },
  'movimientos-ventas': {
    title: 'Movimientos Comerciales de Ventas',
    breadcrumb: 'Ventas / Movimientos',
    subtitle:
      'Historial unificado de ventas, presupuestos, devoluciones, cobros de cuenta corriente y facturas de compra con filtros avanzados y totales netos.',
    primaryCta: 'Exportar Movimientos',
  },
  proveedores: {
    title: 'Maestro de Proveedores y Cuentas Corrientes',
    breadcrumb: 'Proveedores / Padrón e Importación Masiva',
    subtitle:
      'Listado con Razón Social, CUIT, Teléfono, Email, Estado de Cuenta Corriente e importación por Excel/CSV.',
    primaryCta: 'Importación Masiva (Excel/CSV)',
  },
  precios: {
    title: 'Listas de Precios y Actualización Masiva',
    breadcrumb: 'Inventario / Listas de Precios y Márgenes',
    subtitle:
      'Ajuste porcentual por proveedor, marca o rubro e importación de planillas Excel.',
    primaryCta: 'Importación Masiva (Excel/CSV)',
  },
  reportes: {
    title: 'Reportes Comerciales y Caja',
    breadcrumb: 'Reportes / Estadísticas',
    subtitle:
      'Indicadores de rentabilidad, arqueo de caja por turno, IVA Ventas y rotación de artículos.',
    primaryCta: 'Exportar Reporte',
  },
  'mercado-libre': {
    title: 'Integración Mercado Libre',
    breadcrumb: 'Mercado Libre / Sincronización',
    subtitle:
      'Sincronización automática de stock y precios con publicaciones activas en Mercado Libre.',
    primaryCta: 'Sincronizar Publicaciones',
  },
  clientes: {
    title: 'Clientes y Cuentas Corrientes',
    breadcrumb: 'Clientes / Cartera Comercial',
    subtitle:
      'Gestión de constructoras, gremio e instaladores con límites de crédito y listas asignadas.',
    primaryCta: 'Nuevo Presupuesto',
  },
  productos: {
    title: 'INVENTARIO — Maestro de Artículos y Stock',
    breadcrumb: 'INVENTARIO / Catálogo e Importación Masiva',
    subtitle:
      'Catálogo con Código/SKU, Nombre, Categoría, Marca, Precio Costo, Precio Venta, Stock Actual, Stock Mínimo, Stock Sugerido e importación Excel/CSV.',
    primaryCta: 'Importación Masiva (Excel/CSV)',
  },
  'acciones-masivas': {
    title: 'ACCIONES MASIVAS — Importadores, Plantillas y Planilla Interactiva',
    breadcrumb: 'ACCIONES MASIVAS / Edición Masiva de Productos y Plantillas',
    subtitle:
      'Importación masiva de Proveedores, Productos y Clientes con plantillas oficiales, y edición masiva en grilla con cálculo de costo por bulto/unidad.',
    primaryCta: 'Importar Catálogo (Excel/CSV)',
  },
  'escaner-movil': {
    title: 'Control de Stock, Ajustes y Armado de Pedidos por Cámara (Mobile / PWA)',
    breadcrumb: 'Mobile PWA / Escáner Continuo por Cámara',
    subtitle:
      'Interfaz Mobile-First con tipografía extra grande, botones táctiles gigantes, escaneo continuo con Beep/Vibración, ajuste de stock en tiempo real y armado de pedidos.',
    primaryCta: 'Ir a Punto de Venta',
  },
  configuracion: {
    title: 'Centro de Administración y Configuración del Sistema',
    breadcrumb: 'Configuración / Usuarios, Paneles, Empresa e Impresión',
    subtitle:
      'Gestión de Usuarios, Roles y Permisos (RBAC), personalización del menú lateral y paneles, parámetros fiscales/IVA y plantillas de impresión/WhatsApp.',
    primaryCta: 'Guardar Configuración',
  },
};

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/configuracion')) return 'configuracion';
      if (p.startsWith('/caja')) return 'caja';
      if (p.startsWith('/pos')) return 'punto-de-venta';
      if (p.startsWith('/nuevo-presupuesto')) return 'nuevo-presupuesto';
      if (p.startsWith('/nueva-devolucion')) return 'ventas-devoluciones';
      if (p.startsWith('/pago-cuenta-corriente')) return 'pago-cuenta-corriente';
      if (p.startsWith('/facturar-compra')) return 'facturar-compra';
      if (p.startsWith('/movimientos-ventas')) return 'movimientos-ventas';
    }
    return 'inicio';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data from PostgreSQL (Cloud SQL)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [scannerAuditLogs, setScannerAuditLogs] = useState<ScannerAuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Seller / Auth & RBAC Roles state
  const [operators, setOperators] = useState<SellerProfile[]>(() =>
    loadSystemOperators()
  );
  const [seller, setSeller] = useState<SellerProfile>(
    () => loadSystemOperators()[0] || DEFAULT_SYSTEM_OPERATORS[0]
  );
  const [idToken, setIdToken] = useState<string | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  // Sub-navegación rápida hacia Cuenta Corriente o Ranking de Clientes
  const [clientsInitialSubTab, setClientsInitialSubTab] = useState<
    'padron' | 'cuenta-corriente' | 'ranking'
  >('padron');
  const [clientsSelectedAccountId, setClientsSelectedAccountId] = useState<
    number | null
  >(null);

  // Sub-navegación rápida hacia submódulos de Proveedores, Caja y Configuración
  const [suppliersInitialSubTab, setSuppliersInitialSubTab] =
    useState<SuppliersSubTab>('listado');
  const [cashInitialSubTab, setCashInitialSubTab] =
    useState<CashSubTab>('resumen-arqueo');
  const [configInitialSubTab, setConfigInitialSubTab] =
    useState<AdminCenterTab>('usuarios-rbac');
  const [adminConfigState, setAdminConfigState] = useState<SystemAdminConfig>(
    () => loadSystemAdminConfig()
  );

  // Estado del Asistente / Wizard de Primeros Pasos (Onboarding)
  const [onboardingWizardOpen, setOnboardingWizardOpen] = useState<boolean>(false);
  const [onboardingInitialStep, setOnboardingInitialStep] =
    useState<OnboardingStepNumber>(1);
  const [hasEvaluatedAutoOnboarding, setHasEvaluatedAutoOnboarding] =
    useState<boolean>(false);

  useEffect(() => {
    const handleAdminCfgUpdate = () => {
      setAdminConfigState(loadSystemAdminConfig());
    };
    window.addEventListener('ferreteria-config-updated', handleAdminCfgUpdate);
    window.addEventListener('storage', handleAdminCfgUpdate);
    return () => {
      window.removeEventListener('ferreteria-config-updated', handleAdminCfgUpdate);
      window.removeEventListener('storage', handleAdminCfgUpdate);
    };
  }, []);

  // Modal de Centro de Descargas ("DESCARGAS")
  const [downloadsModalOpen, setDownloadsModalOpen] = useState<boolean>(false);

  // Estado para formulario rápido de Devoluciones / Notas de Crédito Clientes
  const [creditNoteClientId, setCreditNoteClientId] = useState<string>('');
  const [creditNoteDocType, setCreditNoteDocType] = useState<string>('Nota de Crédito A');
  const [creditNoteReason, setCreditNoteReason] = useState<string>(
    'Devolución de Mercadería en Mostrador'
  );
  const [creditNoteRefInvoice, setCreditNoteRefInvoice] = useState<string>('');
  const [creditNoteProductId, setCreditNoteProductId] = useState<string>('');
  const [creditNoteQty, setCreditNoteQty] = useState<number>(1);
  const [creditNoteAmount, setCreditNoteAmount] = useState<string>('48500');
  const [creditNoteRestock, setCreditNoteRestock] = useState<boolean>(true);
  const [creditNoteApplyToBalance, setCreditNoteApplyToBalance] =
    useState<boolean>(true);
  const [isSubmittingCreditNote, setIsSubmittingCreditNote] =
    useState<boolean>(false);

  // Estado de Apertura / Cierre de Caja para Cajero y Administrador
  const [cashDrawerOpen, setCashDrawerOpen] = useState<boolean>(true);
  const [cashDrawerOpeningBalance, setCashDrawerOpeningBalance] =
    useState<number>(185000);

  const activeSystemRole = useMemo(() => resolveSystemRole(seller), [seller]);

  // Asegurar que la sección activa esté permitida cuando se cambia de Rol (ej. Vendedor o Cajero)
  useEffect(() => {
    if (!isSectionAllowedForRole(activeSection, activeSystemRole)) {
      setActiveSection(getDefaultSectionForRole(activeSystemRole));
    }
  }, [activeSection, activeSystemRole]);

  // Bulk Import Modal state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<BulkImportMode>('products');

  // Filters & interactive state for Comprobantes
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [newDocModalOpen, setNewDocModalOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({
    docType: 'Presupuesto',
    clientName: 'Constructora Río de la Plata S.A.',
    clientCuit: '30-68912044-2',
    itemsCount: 5,
    totalAmount: '185400.00',
    status: 'Borrador',
  });

  // POS cart quick simulator state
  const [posDiscountPercent, setPosDiscountPercent] = useState<number>(0);

  // Modal de Configuración y Vista Previa de PDF Corporativo (Presupuestos y Comprobantes)
  const [activeDocVoucherModal, setActiveDocVoucherModal] = useState<{
    voucher: VoucherDocumentData;
    tab: 'pdf' | 'whatsapp';
  } | null>(null);

  const buildCommercialDocVoucher = (
    doc: CommercialDocument
  ): VoucherDocumentData => {
    const matchedClient = clients.find(
      (c) =>
        c.cuit === doc.clientCuit ||
        c.name.toLowerCase() === doc.clientName.toLowerCase()
    );
    const totalNum = parseFloat(String(doc.totalAmount || '0')) || 0;
    const count = Math.max(1, Number(doc.itemsCount) || 1);

    const catalogSlice =
      products.length > 0
        ? products.slice(0, Math.min(count, 5))
        : [
            {
              sku: 'FER-001',
              name: 'Artículos de Ferretería Industrial según detalle comercial',
              salePrice: String(totalNum),
            },
          ];

    const builtItems = catalogSlice.map((p, idx) => {
      const isLast = idx === catalogSlice.length - 1;
      const share = totalNum / catalogSlice.length;
      const qty = idx === 0 && count > catalogSlice.length ? count - catalogSlice.length + 1 : 1;
      const unitPrice = isLast
        ? Math.max(1, Math.round((totalNum - share * idx) / qty))
        : Math.max(1, Math.round(share / qty));
      return {
        sku: p.sku || `ART-0${idx + 1}`,
        name: p.name,
        quantity: qty,
        unitCost: unitPrice,
      };
    });

    const issueDateStr = doc.createdAt
      ? new Date(doc.createdAt).toLocaleDateString('es-AR')
      : new Date().toLocaleDateString('es-AR');

    return {
      docType: (doc.docType as VoucherDocumentData['docType']) || 'Presupuesto',
      docNumber: doc.docNumber,
      dateFormatted: issueDateStr,
      dueDateFormatted:
        doc.docType === 'Presupuesto' ? '15 días desde su emisión' : issueDateStr,
      recipientRoleLabel: 'Datos del Cliente / Destinatario',
      supplierName: doc.clientName,
      supplierCuit: doc.clientCuit || matchedClient?.cuit || '30-68912044-2',
      supplierPhone: matchedClient?.phone || '+54 9 11 4800-3300',
      supplierEmail: 'compras@clientecomercial.com.ar',
      status: doc.status,
      secondaryStatus: `${doc.branchName} · Atendió: ${doc.sellerName}`,
      totalAmount: totalNum,
      notes:
        doc.docType === 'Presupuesto'
          ? 'Cotización comercial emitida por FERRETERIA DEL PUENTE. Precios expresados en ARS.'
          : `Comprobante emitido en ${doc.branchName}.`,
      items: builtItems,
    };
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Load workspace data from backend
  const fetchWorkspaceData = async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const response = await fetch('/api/workspace');
      if (!response.ok) {
        throw new Error('No se pudo conectar con el servidor de base de datos.');
      }
      const data = await response.json();
      setBranches(data.branches || []);
      if (data.branches?.length > 0 && !selectedBranch) {
        setSelectedBranch(data.branches[0]);
      }
      setDocuments(data.documents || []);
      setProducts(
        Array.isArray(data.products)
          ? data.products.map((p: ProductItem) => enrichProductWithExtendedMeta(p))
          : []
      );
      setClients(data.clients || []);
      setSuppliers(data.suppliers || []);
      if (Array.isArray(data.scannerAuditLogs)) {
        setScannerAuditLogs(data.scannerAuditLogs);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Error al cargar datos iniciales.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  // Lanzar automáticamente el Asistente / Wizard de Primeros Pasos en la primera entrada o cuando la BD esté vacía
  useEffect(() => {
    if (isLoading || hasEvaluatedAutoOnboarding) return;
    setHasEvaluatedAutoOnboarding(true);
    const cfg = loadSystemAdminConfig();
    const isDatabaseEmpty =
      products.length === 0 && clients.length === 0 && suppliers.length === 0;
    if (
      cfg.onboardingWizardEnabled !== false &&
      (!cfg.onboardingWizardCompleted || isDatabaseEmpty)
    ) {
      setOnboardingInitialStep(1);
      setOnboardingWizardOpen(true);
    }
  }, [
    isLoading,
    hasEvaluatedAutoOnboarding,
    products.length,
    clients.length,
    suppliers.length,
  ]);

  // Listen to Firebase Google Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
          const res = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const dbUser = await res.json();
            setSeller({
              uid: dbUser.uid,
              name: firebaseUser.displayName || dbUser.name || 'Operador Verificado',
              email: firebaseUser.email || dbUser.email,
              role: dbUser.role || 'Administrador · Google Auth',
              isGoogleAuthenticated: true,
            });
          }
        } catch (err) {
          console.error('Error syncing authenticated user:', err);
        }
      } else {
        setIdToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSelectBranch = async (branch: Branch) => {
    setSelectedBranch(branch);
    showToast(`Sucursal activa: ${branch.name} (PV ${branch.pointOfSaleNumber})`);
    if (idToken) {
      try {
        await fetch('/api/me/branch', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ branchId: branch.id }),
        });
      } catch (err) {
        console.error('Failed to persist branch choice:', err);
      }
    }
  };

  const handleCycleDocumentStatus = async (doc: CommercialDocument) => {
    const statusOrder = ['Borrador', 'Aceptado', 'Emitido', 'Entregado'];
    const currentIndex = statusOrder.findIndex(
      (s) => s.toLowerCase() === doc.status.toLowerCase()
    );
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    setDocuments((prev) =>
      prev.map((item) => (item.id === doc.id ? { ...item, status: nextStatus } : item))
    );

    try {
      const res = await fetch(`/api/documents/${doc.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Error al guardar estado');
      showToast(`Comprobante ${doc.docNumber} actualizado a "${nextStatus}"`);
    } catch (err) {
      console.error(err);
      showToast('No se pudo actualizar el estado en la base de datos.');
      fetchWorkspaceData();
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prefix =
        newDocForm.docType === 'Presupuesto'
          ? 'PRE'
          : newDocForm.docType.startsWith('Nota de Crédito') ||
            newDocForm.docType.startsWith('Devolución')
          ? 'NC'
          : newDocForm.docType === 'Remito'
          ? 'REM'
          : 'FA';
      const pv = selectedBranch?.pointOfSaleNumber || '0004';
      const randomNum = Math.floor(18425 + Math.random() * 900);
      const docNumber = `${prefix}-${pv}-000${randomNum}`;

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDocForm,
          docNumber,
          branchName: selectedBranch?.name || 'Sucursal Central — Av. San Martín 1450',
          sellerName: seller.name,
        }),
      });

      if (!res.ok) throw new Error('Error al crear comprobante');
      const created = await res.json();
      setDocuments((prev) => [created, ...prev]);
      setNewDocModalOpen(false);
      showToast(`${created.docType} ${created.docNumber} guardado con estado "${created.status}"`);
      setActiveDocVoucherModal({
        voucher: buildCommercialDocVoucher(created),
        tab: 'pdf',
      });
    } catch (err) {
      console.error(err);
      showToast('Error al registrar el comprobante.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      setSessionModalOpen(false);
      showToast('Sesión iniciada con Google correctamente');
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      showToast('Inicio con Google cancelado o no disponible en esta ventana.');
    }
  };

  const handleSignOutSeller = async () => {
    if (seller.isGoogleAuthenticated) {
      await signOut(auth);
    }
    const nextOperator =
      operators.find((op) => op.name !== seller.name) || operators[0];
    setSeller(nextOperator);
    setSessionModalOpen(false);
    showToast(`Sesión cambiada a operador: ${nextOperator.name}`);
  };

  const openBulkImportModal = (mode: BulkImportMode) => {
    setBulkImportMode(mode);
    setBulkImportOpen(true);
  };

  // Counts for Sidebar badges
  const sidebarCounts = useMemo(() => {
    return {
      presupuestos: documents.filter((d) => d.docType === 'Presupuesto').length,
      facturas: documents.filter((d) => d.docType.startsWith('Factura')).length,
      devoluciones: documents.filter(
        (d) =>
          d.docType.startsWith('Nota de Crédito') ||
          d.docType.startsWith('Devolución')
      ).length,
      remitos: documents.filter((d) => d.docType === 'Remito').length,
      productos: products.length,
    };
  }, [documents, products]);

  // Filtered documents depending on section + search + status filter
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (activeSection === 'ventas-presupuestos' && doc.docType !== 'Presupuesto') {
        return false;
      }
      if (activeSection === 'ventas-facturas' && !doc.docType.startsWith('Factura')) {
        return false;
      }
      if (
        activeSection === 'ventas-devoluciones' &&
        !doc.docType.startsWith('Nota de Crédito') &&
        !doc.docType.startsWith('Devolución')
      ) {
        return false;
      }
      if (activeSection === 'ventas-remitos' && doc.docType !== 'Remito') {
        return false;
      }
      if (
        statusFilter !== 'Todos' &&
        doc.status.toLowerCase() !== statusFilter.toLowerCase()
      ) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          doc.clientName.toLowerCase().includes(q) ||
          doc.docNumber.toLowerCase().includes(q) ||
          doc.clientCuit.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, activeSection, statusFilter, searchQuery]);

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '$ 0,00';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const currentMeta = SECTION_META[activeSection];

  const handleHeaderPrimaryAction = () => {
    if (activeSection === 'caja') {
      setCashInitialSubTab('ingresos-egresos');
      showToast('Formulario de Ingresos / Egresos Manuales de Caja activo');
      return;
    }
    if (activeSection === 'configuracion') {
      showToast('Todos los cambios del Centro de Administración están guardados y activos');
      return;
    }
    if (activeSection === 'productos' || activeSection === 'precios') {
      openBulkImportModal('products');
      return;
    }
    if (activeSection === 'proveedores') {
      openBulkImportModal('suppliers');
      return;
    }

    let defaultType = 'Presupuesto';
    let defaultStatus = 'Borrador';
    if (activeSection === 'ventas-facturas') {
      defaultType = 'Factura A';
      defaultStatus = 'Emitido';
    } else if (activeSection === 'ventas-devoluciones') {
      defaultType = 'Nota de Crédito A';
      defaultStatus = 'Emitido';
    } else if (activeSection === 'ventas-remitos') {
      defaultType = 'Remito';
      defaultStatus = 'Borrador';
    }
    setNewDocForm((prev) => ({
      ...prev,
      docType: defaultType,
      status: defaultStatus,
    }));
    setNewDocModalOpen(true);
  };

  const isBulkActionHeader =
    activeSection === 'productos' ||
    activeSection === 'proveedores' ||
    activeSection === 'precios';

  const dashboardClientsCredit = useMemo(
    () => evaluateAllClientsCreditStatus(clients),
    [clients]
  );

  const dashboardNearLimitClients = useMemo(
    () => dashboardClientsCredit.filter((c) => c.isNearLimit),
    [dashboardClientsCredit]
  );

  const dashboardOverdueClients = useMemo(
    () => dashboardClientsCredit.filter((c) => c.isBlockedByOverdue),
    [dashboardClientsCredit]
  );

  const dashboardBlockedClients = useMemo(
    () => dashboardClientsCredit.filter((c) => c.isBlocked),
    [dashboardClientsCredit]
  );

  const dashboardTopClients = useMemo(() => {
    return [...dashboardClientsCredit]
      .sort((a, b) => {
        const scoreA =
          a.totalPurchaseVolume * (0.65 + (a.onTimePaymentRate / 100) * 0.35);
        const scoreB =
          b.totalPurchaseVolume * (0.65 + (b.onTimePaymentRate / 100) * 0.35);
        return scoreB - scoreA;
      })
      .slice(0, 4);
  }, [dashboardClientsCredit]);

  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [pwaInstallModalOpen, setPwaInstallModalOpen] = useState(false);
  const [pwaInstallTargetMode, setPwaInstallTargetMode] =
    useState<MobileQuickMode>('stock');
  const [scannerInitialMode, setScannerInitialMode] = useState<MobileQuickMode>(() => {
    if (typeof window === 'undefined') return 'stock';
    if (window.location.pathname.startsWith('/pedido-rapido-movil')) {
      return 'supplier_order';
    }
    if (
      window.location.pathname.startsWith('/movil/presupuesto-rapido') ||
      window.location.pathname.startsWith('/presupuesto-rapido-movil')
    ) {
      return 'mini_pos';
    }
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m === 'supplier_order' || m === 'mini_pos' || m === 'stock') return m;
    return 'stock';
  });
  const [isScannerAppRoute, setIsScannerAppRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.startsWith('/escaner-app') ||
      window.location.pathname.startsWith('/pedido-rapido-movil') ||
      window.location.pathname.startsWith('/movil/presupuesto-rapido') ||
      window.location.pathname.startsWith('/presupuesto-rapido-movil')
    );
  });

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsPwaInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPwaPrompt(null);
      showToast('Aplicación Móvil instalada correctamente en el dispositivo.');
    };

    const handlePopState = () => {
      const path = window.location.pathname;
      const isMobileRoute =
        path.startsWith('/escaner-app') ||
        path.startsWith('/pedido-rapido-movil') ||
        path.startsWith('/movil/presupuesto-rapido') ||
        path.startsWith('/presupuesto-rapido-movil');
      setIsScannerAppRoute(isMobileRoute);
      if (path.startsWith('/pedido-rapido-movil')) {
        setScannerInitialMode('supplier_order');
      } else if (
        path.startsWith('/movil/presupuesto-rapido') ||
        path.startsWith('/presupuesto-rapido-movil')
      ) {
        setScannerInitialMode('mini_pos');
      } else if (path.startsWith('/escaner-app')) {
        const params = new URLSearchParams(window.location.search);
        const m = params.get('mode');
        if (m === 'supplier_order' || m === 'mini_pos' || m === 'stock') {
          setScannerInitialMode(m);
        } else {
          setScannerInitialMode('stock');
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Redirige o abre directamente la vista optimizada de la app aislada (/escaner-app, /pedido-rapido-movil o /movil/presupuesto-rapido) en Pantalla Completa (100vh)
  const handleOpenOrInstallScannerApp = (mode: MobileQuickMode = 'stock') => {
    setScannerInitialMode(mode);
    if (typeof window !== 'undefined') {
      const targetUrl =
        mode === 'supplier_order'
          ? '/pedido-rapido-movil'
          : mode === 'mini_pos'
          ? '/movil/presupuesto-rapido'
          : '/escaner-app';
      window.history.pushState({}, '', targetUrl);

      // Solicitar pantalla completa automáticamente al abrir la vista móvil
      try {
        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (!document.fullscreenElement) {
          if (typeof docEl.requestFullscreen === 'function') {
            docEl.requestFullscreen().catch(() => {});
          } else if (typeof docEl.webkitRequestFullscreen === 'function') {
            docEl.webkitRequestFullscreen();
          }
        }
      } catch {
        // ignore fullscreen errors
      }
    }
    setIsScannerAppRoute(true);
  };

  // Funciones de exportación rápida para el Centro de Descargas ("DESCARGAS")
  const handleDownloadInventoryExcel = (onlyCritical = false) => {
    const list = onlyCritical
      ? products.filter((p) => p.stock <= p.minStock)
      : products;
    const rows = list.map((p) => ({
      SKU: p.sku,
      Codigo_Barras: p.barcode || p.sku,
      Articulo: p.name,
      Marca: p.brand,
      Categoria: p.category,
      Proveedor: p.supplierName,
      Precio_Costo_ARS: Number(p.costPrice || 0),
      Precio_Venta_ARS: Number(p.salePrice || 0),
      Stock_Actual: p.stock,
      Stock_Minimo: p.minStock,
      Stock_Sugerido: p.suggestedStock ?? Math.max(p.minStock * 2, 10),
      Cantidad_a_Reponer: Math.max(
        0,
        (p.suggestedStock ?? Math.max(p.minStock * 2, 10)) - p.stock
      ),
      Estado: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      onlyCritical ? 'Stock_Critico' : 'Inventario'
    );
    XLSX.writeFile(
      wb,
      onlyCritical
        ? `Alerta_Reposicion_Stock_Critico_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Inventario_Completo_Ferreteria_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast(
      onlyCritical
        ? 'Planilla de Stock Crítico y Reposición descargada (.xlsx)'
        : 'Inventario completo descargado en Excel (.xlsx)'
    );
  };

  const handleDownloadClientsExcel = () => {
    const rows = dashboardClientsCredit.map((item) => ({
      ID: item.client.id,
      Cliente_Razon_Social: item.client.name,
      CUIT: item.client.cuit,
      Condicion_IVA: item.client.taxCondition,
      Telefono: item.client.phone,
      Email: item.client.email,
      Lista_Asignada: item.client.priceList,
      Saldo_Cuenta_Corriente_ARS: item.balanceNum,
      Limite_Credito_ARS: item.creditLimit,
      Credito_Disponible_ARS: item.availableCredit,
      Estado_Cuenta: item.isBlocked ? 'BLOQUEADA' : 'ACTIVA',
      Importe_Vencido_ARS: item.overdueAmount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes_Cta_Cte');
    XLSX.writeFile(
      wb,
      `Padron_Clientes_Cuentas_Corrientes_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast('Padrón de Clientes y Cuentas Corrientes descargado (.xlsx)');
  };

  const handleDownloadSuppliersExcel = () => {
    const rows = suppliers.map((s) => ({
      ID: s.id,
      Proveedor_Razon_Social: s.name,
      CUIT: s.cuit,
      Rubro_Categoria: s.category,
      Telefono: s.contactPhone,
      Email: s.email,
      Saldo_Cuenta_Corriente_ARS: Number(s.balance || 0),
      Estado: s.status,
      Ultima_Actualizacion: s.lastPriceUpdate,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
    XLSX.writeFile(
      wb,
      `Padron_Proveedores_Saldos_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast('Padrón de Proveedores y Saldos descargado (.xlsx)');
  };

  const handleDownloadDocumentsExcel = () => {
    const rows = documents.map((d) => ({
      Comprobante: d.docNumber,
      Tipo: d.docType,
      Cliente: d.clientName,
      CUIT: d.clientCuit,
      Sucursal: d.branchName,
      Vendedor: d.sellerName,
      Cantidad_Items: d.itemsCount,
      Importe_Total_ARS: Number(d.totalAmount || 0),
      Estado: d.status,
      Fecha: d.createdAt || new Date().toISOString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes_Ventas');
    XLSX.writeFile(
      wb,
      `Reporte_Comprobantes_Ventas_NC_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast('Reporte de Ventas, Facturas y Notas de Crédito descargado (.xlsx)');
  };

  const handleEmitClientCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCreditNote(true);
    try {
      const selectedCli =
        clients.find((c) => String(c.id) === String(creditNoteClientId)) ||
        clients[0];
      const selectedProd = products.find(
        (p) => String(p.id) === String(creditNoteProductId)
      );
      const pv = selectedBranch?.pointOfSaleNumber || '0004';
      const randomNum = Math.floor(10400 + Math.random() * 8900);
      const docNumber = `NC-${pv}-000${randomNum}`;

      const computedAmount = selectedProd
        ? Math.max(
            1,
            Math.round((parseFloat(selectedProd.salePrice) || 0) * creditNoteQty)
          )
        : Math.max(1, parseFloat(creditNoteAmount) || 0);

      // 1. Crear comprobante Nota de Crédito en la base de datos
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: creditNoteDocType,
          docNumber,
          clientName: selectedCli ? selectedCli.name : 'Consumidor Final',
          clientCuit: selectedCli ? selectedCli.cuit : '00-00000000-0',
          branchName:
            selectedBranch?.name || 'Sucursal Central — Av. San Martín 1450',
          sellerName: seller.name,
          itemsCount: creditNoteQty,
          totalAmount: String(computedAmount.toFixed(2)),
          status: 'Emitido',
        }),
      });

      if (!res.ok) throw new Error('Error al emitir Nota de Crédito');
      const createdDoc = await res.json();
      setDocuments((prev) => [createdDoc, ...prev]);

      // 2. Si se seleccionó reintegrar stock al inventario y hay producto seleccionado
      if (creditNoteRestock && selectedProd) {
        const nextStock = (selectedProd.stock || 0) + Math.max(1, creditNoteQty);
        const stockRes = await fetch(`/api/products/${selectedProd.id}/stock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackStock: true,
            stock: nextStock,
            minStock: selectedProd.minStock || 0,
            suggestedStock:
              selectedProd.suggestedStock ??
              Math.max((selectedProd.minStock || 0) * 2, 10),
          }),
        });
        if (stockRes.ok) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === selectedProd.id ? { ...p, stock: nextStock } : p
            )
          );
        }
      }

      // 3. Si aplica descuento a Cuenta Corriente del cliente
      if (creditNoteApplyToBalance && selectedCli) {
        const currentBal = parseFloat(String(selectedCli.balance || '0')) || 0;
        const nextBal = Math.max(0, currentBal - computedAmount);
        setClients((prev) =>
          prev.map((c) =>
            c.id === selectedCli.id ? { ...c, balance: nextBal.toFixed(2) } : c
          )
        );
      }

      showToast(
        `${creditNoteDocType} ${docNumber} emitida correctamente (${formatCurrency(
          computedAmount
        )})`
      );
      setActiveDocVoucherModal({
        voucher: {
          ...buildCommercialDocVoucher(createdDoc),
          notes: `Motivo: ${creditNoteReason}${
            creditNoteRefInvoice ? ` · Ref. Factura: ${creditNoteRefInvoice}` : ''
          }`,
        },
        tab: 'pdf',
      });
    } catch (err) {
      console.error(err);
      showToast('No se pudo registrar la Nota de Crédito.');
    } finally {
      setIsSubmittingCreditNote(false);
    }
  };

  const handleTriggerNativePwaInstall = async (
    targetMode: MobileQuickMode = 'stock'
  ) => {
    setPwaInstallTargetMode(targetMode);
    const appLabel =
      targetMode === 'supplier_order'
        ? 'Pedido Rápido Móvil'
        : targetMode === 'mini_pos'
        ? 'Presupuesto Rápido Móvil'
        : 'Stock Móvil Rápido';

    // Si es "Descargar Presupuesto Rápido Móvil", abrir/redirigir a la vista exclusiva /movil/presupuesto-rapido e invocar instalación PWA si está disponible
    if (targetMode === 'mini_pos') {
      if (deferredPwaPrompt) {
        try {
          await deferredPwaPrompt.prompt();
          const choiceResult = await deferredPwaPrompt.userChoice;
          if (choiceResult?.outcome === 'accepted') {
            showToast(`Instalando ${appLabel} en el dispositivo...`);
            setDeferredPwaPrompt(null);
          }
        } catch {
          // ignore
        }
      }
      handleOpenOrInstallScannerApp('mini_pos');
      return;
    }

    if (deferredPwaPrompt) {
      try {
        await deferredPwaPrompt.prompt();
        const choiceResult = await deferredPwaPrompt.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          showToast(`Instalando ${appLabel} en el dispositivo...`);
          setDeferredPwaPrompt(null);
        } else {
          setPwaInstallModalOpen(true);
        }
      } catch {
        setPwaInstallModalOpen(true);
      }
    } else {
      setPwaInstallModalOpen(true);
    }
  };

  const handleReturnToMainErp = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      try {
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
    setIsScannerAppRoute(false);
  };

  const handleSelectSectionGuarded = (sec: NavSectionId) => {
    if (!isSectionAllowedForRole(sec, activeSystemRole)) {
      showToast(
        `Acceso restringido para el rol "${activeSystemRole}". Cambie a Administrador para acceder a este módulo.`
      );
      return;
    }
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/escaner-app') ||
        window.location.pathname.startsWith('/pedido-rapido-movil') ||
        window.location.pathname.startsWith('/movil/presupuesto-rapido') ||
        window.location.pathname.startsWith('/presupuesto-rapido-movil'))
    ) {
      window.history.pushState({}, '', '/');
      setIsScannerAppRoute(false);
    }
    setActiveSection(sec);
    setStatusFilter('Todos');
    setSearchQuery('');
  };

  // VISTA AISLADA Y DEDICADA EXCLUSIVAMENTE AL MÓDULO MÓVIL (100vh / 100vw Fullscreen)
  if (isScannerAppRoute) {
    if (scannerInitialMode === 'mini_pos') {
      return (
        <div className="h-dvh w-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
          <UpdateBanner />
          <MobileQuickBudgetApp
            products={products}
            clients={clients}
            branchName={selectedBranch?.name || 'Sucursal Central'}
            sellerName={seller.name}
            pointOfSaleNumber={selectedBranch?.pointOfSaleNumber || '0004'}
            formatCurrency={formatCurrency}
            deferredPwaPrompt={deferredPwaPrompt}
            onTriggerPwaInstall={async () => {
              if (!deferredPwaPrompt) return;
              try {
                await deferredPwaPrompt.prompt();
                const res = await deferredPwaPrompt.userChoice;
                if (res?.outcome === 'accepted') {
                  setDeferredPwaPrompt(null);
                  showToast('Presupuesto Rápido Móvil instalado en el teléfono.');
                }
              } catch {
                // ignore
              }
            }}
            onBudgetCreated={({ createdDoc, toastMsg }) => {
              setDocuments((prev) => [createdDoc, ...prev]);
              if (toastMsg) showToast(toastMsg);
            }}
          />
        </div>
      );
    }

    return (
      <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-y-auto select-none">
        <UpdateBanner />
        {toastMessage && (
          <div className="fixed top-12 right-3 z-50 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 text-xs font-medium pointer-events-none">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <MobileScannerPwaModule
          initialMode={scannerInitialMode}
          products={products}
          clients={clients}
          suppliers={suppliers}
          operators={operators}
          branchName={selectedBranch?.name || 'Sucursal Central'}
          sellerName={seller.name}
          formatCurrency={formatCurrency}
          onBack={handleReturnToMainErp}
          onAuditLogsUpdated={(nextLogs) => setScannerAuditLogs(nextLogs)}
          onProductsUpdated={(nextList, msg) => {
            setProducts(nextList);
            if (msg) showToast(msg);
          }}
          onOrderConfirmed={({ documents: nextDocs, products: nextProds, toastMsg, redirectToPos }) => {
            if (nextDocs) setDocuments(nextDocs);
            if (nextProds) setProducts(nextProds);
            if (toastMsg) showToast(toastMsg);
            if (redirectToPos) {
              handleReturnToMainErp();
              setActiveSection('punto-de-venta');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen w-screen flex flex-col lg:flex-row bg-[#F4F5F7] text-slate-900 overflow-hidden">
      {/* Menú Lateral Reestructurado (Sidebar) */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSectionGuarded}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        activeRole={activeSystemRole}
        onOpenScannerApp={(mode) => handleOpenOrInstallScannerApp(mode || 'stock')}
        onInstallMobileApp={(mode) => handleTriggerNativePwaInstall(mode)}
        activeCashSubTab={cashInitialSubTab}
        onSelectCashQuickAction={(subTab) => {
          setCashInitialSubTab(subTab);
        }}
        activeClientSubTab={clientsInitialSubTab}
        onSelectClientQuickAction={(subTab) => {
          setClientsInitialSubTab(subTab);
        }}
        activeSupplierSubTab={suppliersInitialSubTab}
        onSelectSupplierQuickAction={(subTab) => {
          setSuppliersInitialSubTab(subTab);
        }}
        activeConfigSubTab={configInitialSubTab}
        onSelectConfigQuickAction={(subTab) => {
          setConfigInitialSubTab(subTab);
        }}
        onSelectBulkAction={(action) => {
          if (action === 'import-suppliers') {
            openBulkImportModal('suppliers');
          } else if (action === 'import-products') {
            openBulkImportModal('products');
          } else if (action === 'import-clients') {
            openBulkImportModal('clients');
          } else if (action === 'bulk-editor') {
            handleSelectSectionGuarded('acciones-masivas');
          }
        }}
        onDownloadTemplate={(entity) => {
          downloadEntityTemplate(entity, 'xlsx');
          const label =
            entity === 'clients'
              ? 'Clientes (NOMBRE, TELEFONO, CUIT, DNI, DEUDA TOTAL)'
              : entity === 'suppliers'
              ? 'Proveedores (RAZON SOCIAL, CUIT, TELEFONO, EMAIL, DIRECCION, NOTAS)'
              : 'Productos (SKU, Empaque, Unidades x Bulto, Costo Bulto, Efectivo, Tarjeta, Stock)';
          showToast(`Plantilla Base de ${label} descargada (.xlsx).`);
        }}
        onOpenDownloadsModal={() => setDownloadsModalOpen(true)}
        counts={sidebarCounts}
      />

      {/* Columna Principal Derecha en Pantalla Única (100vh Sin Scroll Global) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Barra Superior (TopBar) */}
        <TopBar
          branches={branches}
          selectedBranch={selectedBranch}
          onSelectBranch={handleSelectBranch}
          seller={seller}
          operators={operators}
          onSelectSeller={(nextSeller) => {
            setSeller(nextSeller);
            showToast(
              `Operador activo: ${nextSeller.name} (Rol: ${resolveSystemRole(
                nextSeller
              )})`
            );
          }}
          onOpenProfileSettings={() => handleSelectSectionGuarded('configuracion')}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onLogoutClick={handleSignOutSeller}
          onSwitchSellerClick={() => setSessionModalOpen(true)}
          sectionBreadcrumb={currentMeta.breadcrumb}
          showPostSaleStockButton={Boolean(
            adminConfigState.showPostSaleStockButtonInTopBar
          )}
          postSaleStockAdjustmentActive={Boolean(
            adminConfigState.postSaleStockAdjustmentActive
          )}
          onTogglePostSaleStockAdjustment={(nextActive) => {
            showToast(
              nextActive
                ? 'Ajuste de Stock Post-Venta: ACTIVO (Se solicitará confirmar stock luego de cada venta).'
                : 'Ajuste de Stock Post-Venta: INACTIVO.'
            );
          }}
        />

        {/* Área de Trabajo Principal (100vh sin scroll global en Punto de Venta) */}
        <main
          className={`flex-1 min-h-0 ${
            activeSection === 'punto-de-venta' ||
            activeSection === 'nuevo-presupuesto' ||
            activeSection === 'ventas-presupuestos' ||
            activeSection === 'ventas-facturas' ||
            activeSection === 'facturar-compra'
              ? 'overflow-hidden p-2 sm:p-2.5 flex flex-col'
              : 'overflow-y-auto p-3 sm:p-4 space-y-3'
          }`}
        >
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-12 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#FF6600] shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Error Banner if any */}
          {errorBanner && (
            <div className="shrink-0 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl flex items-center justify-between text-xs mb-2">
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={fetchWorkspaceData}
                className="font-semibold underline cursor-pointer ml-4"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* MÓDULO DE CAJA (Apertura/Cierre, Ingresos/Egresos, Historial de Cajas y Resumen por Medio de Pago) */}
          {activeSection === 'caja' && (
            <CashRegisterModule
              documents={documents}
              activeOperatorName={seller.name}
              formatCurrency={formatCurrency}
              initialSubTab={cashInitialSubTab}
              onNotify={(msg) => showToast(msg)}
            />
          )}

          {/* MÓDULO DE INVENTARIO (anteriormente Productos, con Importación Masiva Excel/CSV) */}
          {activeSection === 'productos' && (
            <ProductsModule
              products={products}
              suppliers={suppliers}
              onOpenBulkImport={() => openBulkImportModal('products')}
              onProductsUpdated={(updatedList, msg) => {
                setProducts(updatedList);
                showToast(msg);
              }}
              formatCurrency={formatCurrency}
            />
          )}

          {/* MÓDULO DE PROVEEDORES (Padrón, Pedidos, Pagos, Devoluciones e Importación Masiva) */}
          {activeSection === 'proveedores' && (
            <SuppliersModule
              suppliers={suppliers}
              products={products}
              initialSubTab={suppliersInitialSubTab}
              onOpenBulkImport={() => openBulkImportModal('suppliers')}
              onSuppliersUpdated={(updatedList, msg) => {
                setSuppliers(updatedList);
                showToast(msg);
              }}
              onProductsUpdated={(updatedList, msg) => {
                setProducts(updatedList);
                showToast(msg);
              }}
              formatCurrency={formatCurrency}
            />
          )}

          {/* MÓDULO DE DEVOLUCIONES O NOTAS DE CRÉDITO CLIENTES */}
          {activeSection === 'ventas-devoluciones' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Registrar Devolución de Mercadería / Emitir Nota de Crédito a Cliente
                    </h2>
                    <p className="text-xs text-slate-500">
                      Reintegra stock al INVENTARIO automáticamente y acredita el saldo en la Cuenta Corriente del cliente
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleEmitClientCreditNote}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-3.5 rounded-xl border border-slate-200"
              >
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cliente
                  </label>
                  <select
                    value={creditNoteClientId}
                    onChange={(e) => setCreditNoteClientId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="">
                      {clients[0]
                        ? `${clients[0].name} (${clients[0].cuit})`
                        : 'Consumidor Final'}
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.cuit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo Comprobante
                  </label>
                  <select
                    value={creditNoteDocType}
                    onChange={(e) => setCreditNoteDocType(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Nota de Crédito A">Nota de Crédito A</option>
                    <option value="Nota de Crédito B">Nota de Crédito B</option>
                    <option value="Devolución Cliente">Devolución Cliente</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Artículo Devuelto (Opcional - Reintegra Stock)
                  </label>
                  <select
                    value={creditNoteProductId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCreditNoteProductId(val);
                      const prod = products.find((p) => String(p.id) === val);
                      if (prod) {
                        setCreditNoteAmount(
                          String(
                            Math.round(
                              (parseFloat(prod.salePrice) || 0) * creditNoteQty
                            )
                          )
                        );
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="">Bonificación / Importe Manual</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} ({formatCurrency(p.salePrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cant.
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={creditNoteQty}
                    onChange={(e) => {
                      const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setCreditNoteQty(q);
                      const prod = products.find(
                        (p) => String(p.id) === String(creditNoteProductId)
                      );
                      if (prod) {
                        setCreditNoteAmount(
                          String(Math.round((parseFloat(prod.salePrice) || 0) * q))
                        );
                      }
                    }}
                    className="w-full px-2.5 py-2 text-xs font-mono font-bold text-center border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Importe Total Acreditado (ARS)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={creditNoteAmount}
                    onChange={(e) => setCreditNoteAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-extrabold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motivo de la Devolución / Nota de Crédito
                  </label>
                  <select
                    value={creditNoteReason}
                    onChange={(e) => setCreditNoteReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Devolución de Mercadería en Mostrador">
                      Devolución de Mercadería en Mostrador
                    </option>
                    <option value="Producto Fallado / Garantía">
                      Producto Fallado / Garantía
                    </option>
                    <option value="Diferencia de Precio / Bonificación Comercial">
                      Diferencia de Precio / Bonificación Comercial
                    </option>
                    <option value="Anulación Parcial o Total de Factura">
                      Anulación Parcial o Total de Factura
                    </option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Factura de Referencia (Opcional)
                  </label>
                  <input
                    type="text"
                    value={creditNoteRefInvoice}
                    onChange={(e) => setCreditNoteRefInvoice(e.target.value)}
                    placeholder="Ej: FA-0004-00018420"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="md:col-span-3 flex flex-col gap-1.5 pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={creditNoteRestock}
                      onChange={(e) => setCreditNoteRestock(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#FF6600]"
                    />
                    <span>Reintegrar unidades al Inventario</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={creditNoteApplyToBalance}
                      onChange={(e) =>
                        setCreditNoteApplyToBalance(e.target.checked)
                      }
                      className="w-3.5 h-3.5 accent-[#FF6600]"
                    />
                    <span>Acreditar en Cuenta Corriente del Cliente</span>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmittingCreditNote}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Emitir NC</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 1A: PÁGINA PRINCIPAL (DASHBOARD REDISEÑADO) */}
          {activeSection === 'inicio' && (
            <>
              {(adminConfigState.onboardingWizardEnabled !== false ||
                (products.length === 0 &&
                  clients.length === 0 &&
                  suppliers.length === 0)) && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-white">
                          Asistente de Primeros Pasos (Puesta en Marcha Inicial)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#FF6600]/20 text-amber-300 border border-[#FF6600]/40 text-[10px] font-mono font-bold">
                          {[
                            Boolean(adminConfigState.companyFiscal?.cuit),
                            products.length > 0,
                            clients.length > 0 && suppliers.length > 0,
                            isCashRegisterOpenOrInitialized(),
                          ].filter(Boolean).length}
                          /4 pasos listos
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Configure los datos del negocio, cargue su primer producto, registre su primer cliente/proveedor y realice la primera apertura de caja.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setOnboardingInitialStep(1);
                        setOnboardingWizardOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Abrir Asistente Guía (4 Pasos)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfigInitialSubTab('seguridad-sistema');
                        handleSelectSectionGuarded('configuracion');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>Seguridad / Reset de Fábrica</span>
                    </button>
                  </div>
                </div>
              )}

              <DashboardModule
                documents={documents}
                products={products}
                clients={clients}
                suppliers={suppliers}
                branchName={selectedBranch?.name || 'Sucursal Central'}
                pointOfSaleNumber={selectedBranch?.pointOfSaleNumber || '0004'}
                sellerName={seller.name}
                formatCurrency={formatCurrency}
                onNavigateSection={(sec) => handleSelectSectionGuarded(sec)}
                onOpenClientAccount={(clientId) => {
                  setClientsSelectedAccountId(clientId);
                  setClientsInitialSubTab('cuenta-corriente');
                  setActiveSection('clientes');
                }}
                onOpenClientsRanking={() => {
                  setClientsInitialSubTab('ranking');
                  setActiveSection('clientes');
                }}
                onOpenSupplierTab={(subTab) => {
                  setSuppliersInitialSubTab(subTab);
                  setActiveSection('proveedores');
                }}
                onOpenCashTab={(subTab) => {
                  setCashInitialSubTab(subTab);
                  setActiveSection('caja');
                }}
                onSuppliersUpdated={(nextSuppliers, msg) => {
                  setSuppliers(nextSuppliers);
                  showToast(msg);
                }}
                onNotify={(msg) => showToast(msg)}
              />
            </>
          )}

          {/* SECTION 1B: TABLA DE COMPROBANTES PARA DEVOLUCIONES Y REMITOS */}
          {(activeSection === 'ventas-devoluciones' ||
            activeSection === 'ventas-remitos') && (
            <>
              {/* Comprobantes Table Container */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                    {['Todos', 'Borrador', 'Aceptado', 'Emitido', 'Pendiente', 'Entregado'].map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            statusFilter === st
                              ? 'bg-white text-slate-900 shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative w-full lg:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por cliente, CUIT o número..."
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                        <th className="py-3 px-4">Comprobante</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Cliente / Razón Social</th>
                        <th className="py-3 px-4">Sucursal</th>
                        <th className="py-3 px-4">Vendedor</th>
                        <th className="py-3 px-4 text-right">Ítems</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4">Estado (Clic para cambiar)</th>
                        <th className="py-3 px-4 text-right">
                          Exportar PDF / Enviar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-500">
                            No se encontraron comprobantes para el filtro seleccionado.
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => (
                          <tr
                            key={doc.id}
                            className="hover:bg-slate-50/90 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                              {doc.docNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                              {doc.docType}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900">
                                {doc.clientName}
                              </div>
                              <div className="text-xs font-mono tabular-nums text-slate-500">
                                CUIT {doc.clientCuit}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                              {doc.branchName}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                              {doc.sellerName}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                              {doc.itemsCount}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                              {formatCurrency(doc.totalAmount)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <StatusBadge
                                status={doc.status}
                                onClick={() => handleCycleDocumentStatus(doc)}
                                title="Haga clic para alternar estado (Borrador / Aceptado / Emitido / Entregado)"
                              />
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveDocVoucherModal({
                                      voucher: buildCommercialDocVoucher(doc),
                                      tab: 'pdf',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                  title="Personalizar y Descargar PDF Corporativo"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Descargar PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveDocVoucherModal({
                                      voucher: buildCommercialDocVoucher(doc),
                                      tab: 'pdf',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                                  title="Configurar e Imprimir Comprobante"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Imprimir</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveDocVoucherModal({
                                      voucher: buildCommercialDocVoucher(doc),
                                      tab: 'whatsapp',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Personalizar y Enviar por WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* SECTION 2: FLUJO COMPLETO DE VENTAS, POS MULTIPESTAÑA, NUEVO PRESUPUESTO, FACTURACIÓN Y FACTURAR COMPRA */}
          {(activeSection === 'punto-de-venta' ||
            activeSection === 'nuevo-presupuesto' ||
            activeSection === 'ventas-presupuestos' ||
            activeSection === 'ventas-facturas' ||
            activeSection === 'facturar-compra') && (
            <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
              <SalesPosWorkspaceModule
                initialViewMode={
                  activeSection === 'ventas-presupuestos'
                    ? 'presupuestos'
                    : activeSection === 'ventas-facturas'
                    ? 'facturacion'
                    : activeSection === 'facturar-compra'
                    ? 'compras'
                    : 'pos'
                }
                initialOperationMode={
                  activeSection === 'nuevo-presupuesto'
                    ? 'presupuesto'
                    : 'venta'
                }
                products={products}
                clients={clients}
                suppliers={suppliers}
                documents={documents}
                branchName={selectedBranch?.name || 'Sucursal Central'}
                sellerName={seller.name}
                activeSystemRole={activeSystemRole}
                formatCurrency={formatCurrency}
                onCycleDocStatus={handleCycleDocumentStatus}
                onDataUpdated={({
                  products: nextProducts,
                  clients: nextClients,
                  suppliers: nextSuppliers,
                  documents: nextDocuments,
                  toastMessage,
                }) => {
                  if (nextProducts) setProducts(nextProducts);
                  if (nextClients) setClients(nextClients);
                  if (nextSuppliers) setSuppliers(nextSuppliers);
                  if (nextDocuments) setDocuments(nextDocuments);
                  if (toastMessage) showToast(toastMessage);
                }}
              />
            </div>
          )}

          {/* SECTION 2B: PANEL DEDICADO DE MOVIMIENTOS DE VENTAS (/movimientos-ventas) */}
          {activeSection === 'movimientos-ventas' && (
            <SalesMovementsModule
              documents={documents}
              clients={clients}
              suppliers={suppliers}
              products={products}
              branchName={selectedBranch?.name || 'Sucursal Central'}
              sellerName={seller.name}
              formatCurrency={formatCurrency}
              onCycleDocStatus={handleCycleDocumentStatus}
              onOpenDocVoucherModal={(doc, tab) => {
                setActiveDocVoucherModal({
                  voucher: buildCommercialDocVoucher(doc),
                  tab,
                });
              }}
              onNavigateSection={(targetSec) => {
                if (targetSec === 'pago-cuenta-corriente') {
                  setClientsInitialSubTab('cuenta-corriente');
                }
                handleSelectSectionGuarded(targetSec);
              }}
            />
          )}

          {/* SECTION 3: LISTAS DE PRECIOS Y ACTUALIZACIÓN MASIVA */}
          {activeSection === 'precios' && (
            <PriceListsModule
              products={products}
              suppliers={suppliers}
              onProductsUpdated={(updatedList, msg) => {
                setProducts(updatedList);
                if (msg) showToast(msg);
              }}
              onOpenBulkImport={() => openBulkImportModal('products')}
              formatCurrency={formatCurrency}
            />
          )}

          {/* SECTION 3B: ACCIONES MASIVAS — IMPORTACIÓN, PLANTILLAS Y EDICIÓN MASIVA DE PRODUCTOS */}
          {activeSection === 'acciones-masivas' && (
            <BulkProductEditorModule
              products={products}
              suppliers={suppliers}
              onProductsUpdated={(updatedList, msg) => {
                setProducts(updatedList);
                if (msg) showToast(msg);
              }}
              onOpenBulkImport={(entityMode) => openBulkImportModal(entityMode)}
              formatCurrency={formatCurrency}
            />
          )}

          {/* SECTION 4: MERCADO LIBRE */}
          {activeSection === 'mercado-libre' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Publicaciones Vinculadas con Mercado Libre
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Precios expresados en ARS · Sincronización en tiempo real con sucursal activa
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openBulkImportModal('products')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Importar Planilla de Precios (Excel/CSV)</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">Bulto / Contenido</th>
                      <th className="py-3 px-4 text-right">Costo del Bulto (Lista)</th>
                      <th className="py-3 px-4 text-right">Costo Unitario / Fraccionado</th>
                      <th className="py-3 px-4 text-right">Precio Venta Minorista</th>
                      <th className="py-3 px-4 text-right">Stock</th>
                      <th className="py-3 px-4">Estado MeLi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                    {products.map((rawProd) => {
                      const prod = enrichProductWithExtendedMeta(rawProd);
                      const singularUnit = getSingularContentTypeLabel(
                        prod.contentType
                      );
                      const unitCost =
                        prod.unitFractionalCost ??
                        calculateUnitFractionalCost(
                          prod.costPrice,
                          prod.unitsPerPackage || 1
                        );
                      const margin = prod.retailMarginPct ?? 45;
                      return (
                        <tr key={prod.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            {prod.sku}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <div>{prod.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {prod.brand} · {prod.category}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                            {prod.purchaseUnit || 'CAJA'} x {prod.unitsPerPackage || 1}{' '}
                            {prod.contentType || 'Unidades'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatCurrency(prod.costPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#FF6600] whitespace-nowrap">
                            Costo por {singularUnit}: {formatCurrency(unitCost)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            <div>{formatCurrency(prod.salePrice)}</div>
                            <div className="text-[10px] text-emerald-700">
                              por {singularUnit} (+{Number(margin).toFixed(0)}%)
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={
                                prod.stock <= prod.minStock
                                  ? 'text-rose-700 font-bold'
                                  : 'text-slate-900 font-medium'
                              }
                            >
                              {prod.stock} u.
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <StatusBadge status={prod.meliStatus} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: MÓDULO DE CLIENTES, CUENTAS CORRIENTES Y PAGO CUENTA CORRIENTE */}
          {(activeSection === 'clientes' ||
            activeSection === 'pago-cuenta-corriente') && (
            <ClientsModule
              clients={clients}
              onClientsUpdated={(updatedList, msg) => {
                setClients(updatedList);
                if (msg) showToast(msg);
              }}
              formatCurrency={formatCurrency}
              activeOperatorName={seller.name}
              activeSystemRole={activeSystemRole}
              initialSubTab={
                activeSection === 'pago-cuenta-corriente'
                  ? 'cuenta-corriente'
                  : clientsInitialSubTab
              }
              initialSelectedClientId={clientsSelectedAccountId}
            />
          )}

          {/* SECTION 6: REPORTES & USUARIOS, ROLES Y CONFIGURACIÓN */}
          {activeSection === 'reportes' && (
            <ClientsModule
              clients={clients}
              onClientsUpdated={(updatedList, msg) => {
                setClients(updatedList);
                if (msg) showToast(msg);
              }}
              formatCurrency={formatCurrency}
              activeOperatorName={seller.name}
              activeSystemRole={activeSystemRole}
              initialSubTab="ranking"
              initialSelectedClientId={clientsSelectedAccountId}
            />
          )}

          {activeSection === 'configuracion' && (
            <UsersRolesModule
              operators={operators}
              activeSeller={seller}
              onUpdateOperators={(nextList, msg) => {
                setOperators(nextList);
                if (msg) showToast(msg);
              }}
              onSwitchActiveSeller={(nextSeller) => {
                setSeller(nextSeller);
                showToast(
                  `Sesión cambiada a ${nextSeller.name} (Rol: ${resolveSystemRole(
                    nextSeller
                  )})`
                );
              }}
              branches={branches}
              selectedBranch={selectedBranch}
              initialTab={configInitialSubTab}
              onTabChange={(tab) => setConfigInitialSubTab(tab)}
              onRelaunchOnboardingWizard={() => {
                setOnboardingInitialStep(1);
                setOnboardingWizardOpen(true);
                showToast(
                  'Asistente de Primeros Pasos reiniciado y abierto en el Paso 1.'
                );
              }}
              onFactoryResetCompleted={({
                preservedOperators,
                resetConfig,
                workspace,
              }) => {
                setOperators(preservedOperators);
                if (preservedOperators[0]) {
                  setSeller(preservedOperators[0]);
                }
                setAdminConfigState(resetConfig);
                setProducts(workspace?.products || []);
                setClients(workspace?.clients || []);
                setSuppliers(workspace?.suppliers || []);
                setDocuments(workspace?.documents || []);
                setScannerAuditLogs(workspace?.scannerAuditLogs || []);
                if (Array.isArray(workspace?.branches) && workspace.branches.length > 0) {
                  setBranches(workspace.branches);
                  setSelectedBranch(workspace.branches[0]);
                }
                setActiveSection('inicio');
                setOnboardingInitialStep(1);
                setOnboardingWizardOpen(true);
                showToast(
                  'Sistema reiniciado a cero (Reset de Fábrica). Base de datos limpia y lista para comenzar.'
                );
              }}
            />
          )}
        </main>

        {/* Pie Inferior del Sistema Limpio (Sin botones de Descargas ni Stock Móvil Rápido) */}
        <footer className="shrink-0 bg-white border-t border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 z-20">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              {adminConfigState.companyFiscal?.fantasyName ||
                selectedBranch?.companyName ||
                'FERRETERIA DEL PUENTE'}
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline font-mono text-slate-500">
              Atajos POS: <strong className="text-slate-800">F12</strong> Cobrar / 2x <strong className="text-slate-800">F12</strong> Efectivo Rápido
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto font-mono text-[10px] text-slate-400">
            <span>CUIT: {adminConfigState.companyFiscal?.cuit || '30-71458920-9'}</span>
            <span>·</span>
            <span>{adminConfigState.companyFiscal?.taxCondition || 'IVA Responsable Inscripto'}</span>
          </div>
        </footer>
      </div>

      {/* MODAL DE "DESCARGAS": Recursos, Planillas Excel/CSV, Informes y Apps Móviles */}
      {downloadsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Centro de Descargas, Informes y Aplicaciones Móviles
                  </h3>
                  <p className="text-xs text-slate-500">
                    Descargue recursos en Excel (.xlsx), plantillas de importación y acceda a los módulos móviles
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDownloadsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Exportación de Informes y Bases de Datos en Excel */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                1. Informes y Bases de Datos Descargables (Excel .XLSX)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadInventoryExcel(false)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#FF6600] bg-slate-50 hover:bg-orange-50/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">
                      Inventario Completo (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {products.length} artículos con Stock Actual, Mínimo y Sugerido
                    </div>
                  </div>
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadInventoryExcel(true)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#FF6600] bg-slate-50 hover:bg-orange-50/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">
                      Alerta de Reposición / Stock Crítico (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Artículos bajo stock mínimo y cantidad sugerida a pedir
                    </div>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadClientsExcel}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#FF6600] bg-slate-50 hover:bg-orange-50/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">
                      Clientes y Cuentas Corrientes (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Padrón, saldos, límites de crédito y estado de mora
                    </div>
                  </div>
                  <Users className="w-5 h-5 text-[#FF6600] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSuppliersExcel}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#FF6600] bg-slate-50 hover:bg-orange-50/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">
                      Proveedores y Saldos (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Listado completo de proveedores y cuentas corrientes
                    </div>
                  </div>
                  <Truck className="w-5 h-5 text-slate-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDocumentsExcel}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#FF6600] bg-slate-50 hover:bg-orange-50/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer sm:col-span-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">
                      Reporte de Ventas, Facturas, Presupuestos y Notas de Crédito (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Historial consolidado de los {documents.length} comprobantes comerciales emitidos
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-[#FF6600] shrink-0" />
                </button>
              </div>
            </div>

            {/* 2. Accesos Directos a Módulos Móviles y PWA */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                2. Aplicaciones Móviles Optimizadas (/escaner-app) y PWA
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDownloadsModalOpen(false);
                    handleOpenOrInstallScannerApp('stock');
                  }}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-left flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-extrabold text-[#FF6600]">
                      Stock Móvil Rápido
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Escáner 100vh de Stock
                    </div>
                  </div>
                  <QrCode className="w-4 h-4 text-[#FF6600] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDownloadsModalOpen(false);
                    handleOpenOrInstallScannerApp('supplier_order');
                  }}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-left flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-extrabold text-amber-400">
                      Pedido Rápido Móvil
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Pedidos a Proveedores
                    </div>
                  </div>
                  <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDownloadsModalOpen(false);
                    handleOpenOrInstallScannerApp('mini_pos');
                  }}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-left flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-extrabold text-emerald-400">
                      Presupuesto Rápido Móvil
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Cotizador Móvil Rápido
                    </div>
                  </div>
                  <ShoppingCart className="w-4 h-4 text-emerald-400 shrink-0" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDownloadsModalOpen(false);
                    openBulkImportModal('products');
                  }}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Importar / Descargar Plantilla Excel de Inventario
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerNativePwaInstall('stock')}
                  className="px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Instalar App Descargable (PWA) en Dispositivo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSTALACIÓN PWA / GUARDAR EN PANTALLA DE INICIO DEL TELÉFONO */}
      {pwaInstallModalOpen && (() => {
        const appInfo =
          pwaInstallTargetMode === 'supplier_order'
            ? {
                title: 'Pedido Rápido Móvil',
                path: '/pedido-rapido-movil',
                description:
                  'Aplicación móvil en pantalla completa (100vh) para escaneo y armado de pedidos por proveedor.',
                badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
              }
            : pwaInstallTargetMode === 'mini_pos'
            ? {
                title: 'Presupuesto Rápido Móvil',
                path: '/movil/presupuesto-rapido',
                description:
                  'Aplicación móvil en pantalla completa (100vh) para cotizaciones y presupuestos rápidos de mostrador.',
                badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
              }
            : {
                title: 'Stock Móvil Rápido',
                path: '/escaner-app',
                description:
                  'Aplicación móvil en pantalla completa (100vh) para control y carga rápida de stock con lector de barras.',
                badgeColor: 'bg-[#FF6600]/20 text-[#FF6600] border-[#FF6600]/30',
              };
        const fullAppUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}${appInfo.path}`
            : appInfo.path;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
          fullAppUrl
        )}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-white">
                        Descargar {appInfo.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${appInfo.badgeColor}`}
                      >
                        {appInfo.path}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {appInfo.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPwaInstallModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Selector rápido entre las 3 apps móviles */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(
                  [
                    { mode: 'stock' as MobileQuickMode, label: 'Stock Rápido' },
                    {
                      mode: 'supplier_order' as MobileQuickMode,
                      label: 'Pedido Móvil',
                    },
                    {
                      mode: 'mini_pos' as MobileQuickMode,
                      label: 'Presupuesto',
                    },
                  ]
                ).map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setPwaInstallTargetMode(item.mode)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      pwaInstallTargetMode === item.mode
                        ? 'bg-[#FF6600] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Código QR e instrucciones para guardar en pantalla de inicio */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <div className="sm:col-span-5 flex flex-col items-center justify-center">
                  <div className="bg-white p-2 rounded-xl shadow-md">
                    <img
                      src={qrUrl}
                      alt={`QR ${appInfo.title}`}
                      className="w-32 h-32 object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 mt-1.5 text-center">
                    Escanee desde la cámara del celular
                  </span>
                </div>

                <div className="sm:col-span-7 space-y-2.5 text-xs">
                  <div className="font-extrabold text-amber-400 uppercase tracking-wider text-[11px]">
                    Guardar en Pantalla de Inicio (PWA)
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="font-bold text-white">
                      📱 En Android (Chrome):
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Toque el menú <strong>⋮</strong> del navegador y seleccione{' '}
                      <strong className="text-[#FF6600]">
                        &ldquo;Instalar aplicación&rdquo;
                      </strong>{' '}
                      o{' '}
                      <strong>
                        &ldquo;Agregar a la pantalla principal&rdquo;
                      </strong>
                      .
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="font-bold text-white">
                      🍏 En iPhone / iOS (Safari):
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Toque el botón <strong>Compartir</strong> y elija{' '}
                      <strong className="text-[#FF6600]">
                        &ldquo;Agregar a inicio&rdquo;
                      </strong>{' '}
                      para usarla en pantalla completa.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPwaInstallModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Cerrar
                </button>
                {deferredPwaPrompt && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deferredPwaPrompt.prompt();
                        const choice = await deferredPwaPrompt.userChoice;
                        if (choice?.outcome === 'accepted') {
                          showToast(
                            `Instalando ${appInfo.title} en el dispositivo...`
                          );
                          setDeferredPwaPrompt(null);
                          setPwaInstallModalOpen(false);
                        }
                      } catch {
                        // ignore
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar PWA Ahora</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPwaInstallModalOpen(false);
                    handleOpenOrInstallScannerApp(pwaInstallTargetMode);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Abrir {appInfo.title} (Pantalla Completa)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Importación Masiva (Excel / CSV) para Productos, Proveedores o Clientes */}
      <BulkImportModal
        mode={bulkImportMode}
        isOpen={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        suppliers={suppliers}
        onSupplierQuickCreated={(updatedSuppliers, createdName) => {
          setSuppliers(updatedSuppliers);
          showToast(`Proveedor "${createdName}" creado rápidamente y seleccionado.`);
        }}
        onSuccess={(count, updatedList, summaryMessage, completedMode) => {
          const targetMode = completedMode || bulkImportMode;
          if (targetMode === 'products') {
            setProducts(updatedList);
            showToast(
              summaryMessage ||
                `Importación masiva exitosa: ${count} productos procesados en la base de datos.`
            );
          } else if (targetMode === 'clients') {
            setClients(updatedList);
            showToast(
              summaryMessage ||
                `Importación masiva exitosa: ${count} clientes procesados en la base de datos.`
            );
          } else {
            setSuppliers(updatedList);
            showToast(
              summaryMessage ||
                `Importación masiva exitosa: ${count} proveedores procesados en la base de datos.`
            );
          }
        }}
      />

      {/* MODAL: Personalización y Exportación de PDF Corporativo para Presupuestos y Comprobantes */}
      {activeDocVoucherModal && (
        <VoucherActionModal
          voucher={activeDocVoucherModal.voucher}
          initialTab={activeDocVoucherModal.tab}
          onClose={() => setActiveDocVoucherModal(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* MODAL 1: Crear Nuevo Presupuesto / Comprobante */}
      {newDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Registrar Nuevo Comprobante Comercial
              </h3>
              <button
                type="button"
                onClick={() => setNewDocModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Comprobante
                </label>
                <select
                  value={newDocForm.docType}
                  onChange={(e) =>
                    setNewDocForm({ ...newDocForm, docType: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Presupuesto">Presupuesto</option>
                  <option value="Factura A">Factura A</option>
                  <option value="Factura B">Factura B</option>
                  <option value="Remito">Remito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cliente / Razón Social
                </label>
                <input
                  type="text"
                  required
                  value={newDocForm.clientName}
                  onChange={(e) =>
                    setNewDocForm({ ...newDocForm, clientName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CUIT Cliente
                  </label>
                  <input
                    type="text"
                    value={newDocForm.clientCuit}
                    onChange={(e) =>
                      setNewDocForm({ ...newDocForm, clientCuit: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={newDocForm.status}
                    onChange={(e) =>
                      setNewDocForm({ ...newDocForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Borrador">Borrador (Gris)</option>
                    <option value="Aceptado">Aceptado (Verde)</option>
                    <option value="Emitido">Emitido (Azul)</option>
                    <option value="Entregado">Entregado (Verde)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cantidad de Ítems
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newDocForm.itemsCount}
                    onChange={(e) =>
                      setNewDocForm({
                        ...newDocForm,
                        itemsCount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Importe Total (ARS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDocForm.totalAmount}
                    onChange={(e) =>
                      setNewDocForm({ ...newDocForm, totalAmount: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewDocModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  Guardar Comprobante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Sesión del Vendedor / Cambiar Operador / Salir */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#FF6600]" />
                <h3 className="text-base font-bold text-slate-900">
                  Operador Logueado y Control de Turno
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSessionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500">Vendedor activo en terminal</div>
              <div className="text-sm font-bold text-slate-900">{seller.name}</div>
              <div className="text-xs text-slate-600">
                {seller.role} · {seller.email}
              </div>
              <div className="text-xs text-slate-500 pt-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>{selectedBranch?.name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Cambiar rápidamente de usuario y rol de permisos (RBAC):
              </p>
              {operators.map((op) => {
                const sysRole = resolveSystemRole(op);
                return (
                  <button
                    key={op.email}
                    type="button"
                    onClick={() => {
                      setSeller(op);
                      setSessionModalOpen(false);
                      showToast(
                        `Operador activo: ${op.name} (Rol: ${sysRole})`
                      );
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      seller.name === op.name
                        ? 'border-[#FF6600] bg-[#FF6600]/8 font-semibold text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {op.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sysRole === 'Super Administrador'
                              ? 'bg-rose-600 text-white'
                              : sysRole === 'Administrador'
                              ? 'bg-slate-900 text-white'
                              : sysRole === 'Vendedor'
                              ? 'bg-[#FF6600] text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {sysRole}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {op.role}
                      </div>
                    </div>
                    {seller.name === op.name && (
                      <span className="text-[11px] font-semibold text-[#FF6600]">
                        Activo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full sm:w-auto px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Vincular con Google Auth
              </button>
              <button
                type="button"
                onClick={handleSignOutSeller}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Turno / Salir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASISTENTE / WIZARD DE PRIMEROS PASOS (ONBOARDING GUIADO DE 4 PASOS) */}
      <OnboardingWizardModal
        isOpen={onboardingWizardOpen}
        initialStep={onboardingInitialStep}
        onClose={() => setOnboardingWizardOpen(false)}
        products={products}
        clients={clients}
        suppliers={suppliers}
        branches={branches}
        activeOperatorName={seller.name}
        formatCurrency={formatCurrency}
        onProductsUpdated={(nextList, msg) => {
          setProducts(nextList);
          if (msg) showToast(msg);
        }}
        onClientsUpdated={(nextList, msg) => {
          setClients(nextList);
          if (msg) showToast(msg);
        }}
        onSuppliersUpdated={(nextList, msg) => {
          setSuppliers(nextList);
          if (msg) showToast(msg);
        }}
        onBranchesUpdated={(nextBranches) => {
          setBranches(nextBranches);
          if (nextBranches.length > 0) {
            setSelectedBranch(nextBranches[0]);
          }
        }}
        onAdminConfigUpdated={(nextCfg, msg) => {
          setAdminConfigState(nextCfg);
          if (msg) showToast(msg);
        }}
        onOpenBulkImport={(mode) => {
          setOnboardingWizardOpen(false);
          openBulkImportModal(mode);
        }}
        onNavigateSection={(sec) => {
          setOnboardingWizardOpen(false);
          handleSelectSectionGuarded(sec);
        }}
      />

      <UpdateBanner />
    </div>
  );
}
