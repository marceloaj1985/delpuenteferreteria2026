import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  CheckCircle2,
  Building2,
  KeyRound,
  SlidersHorizontal,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Printer,
  MessageCircle,
  Mail,
  Upload,
  Check,
  LayoutDashboard,
  FileText,
  Save,
  RotateCcw,
  AlertTriangle,
  Lock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  Branch,
  NavSectionId,
  SellerProfile,
  SystemRoleType,
} from '../types/ferreteria.ts';

const SYSTEM_OPERATORS_STORAGE_KEY = 'ferreteria_system_operators_rbac_v2';
export const SYSTEM_ADMIN_CONFIG_STORAGE_KEY =
  'ferreteria_admin_center_config_v2';

export type PermissionKey =
  | 'modificarPrecios'
  | 'permitirDescuentos'
  | 'verCostosBase'
  | 'anularFacturas'
  | 'exportarReportes'
  | 'abrirCerrarCaja'
  | 'editarStockMinimo'
  | 'autorizarCuentasCorrientes';

export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  description: string;
  moduleName: string;
}

export const PERMISSIONS_CATALOG: PermissionMeta[] = [
  {
    key: 'modificarPrecios',
    label: 'Permitir Modificar Precios',
    description: 'Habilita editar precios de venta e importes unitarios en POS y Listas',
    moduleName: 'Punto de Venta / Precios',
  },
  {
    key: 'permitirDescuentos',
    label: 'Permitir Descuentos',
    description: 'Autoriza aplicar bonificaciones por ítem o descuento global en ventas',
    moduleName: 'Punto de Venta / Presupuestos',
  },
  {
    key: 'verCostosBase',
    label: 'Ver Costos Base',
    description: 'Muestra columnas de Precio de Costo Neto y márgenes de ganancia',
    moduleName: 'Inventario / Proveedores',
  },
  {
    key: 'anularFacturas',
    label: 'Anular Facturas y Emitir NC',
    description: 'Permite anular comprobantes emitidos y generar Notas de Crédito',
    moduleName: 'Ventas / Devoluciones',
  },
  {
    key: 'exportarReportes',
    label: 'Exportar Reportes (Excel / PDF)',
    description: 'Habilita la descarga de planillas maestras e informes financieros',
    moduleName: 'Reportes / Inventario',
  },
  {
    key: 'abrirCerrarCaja',
    label: 'Abrir, Arqueo y Cierre de Caja',
    description: 'Autoriza realizar aperturas de turno, ingresos/egresos y cierres de caja',
    moduleName: 'Módulo Caja',
  },
  {
    key: 'editarStockMinimo',
    label: 'Editar Stock Actual, Mínimo y Sugerido',
    description: 'Permite ajustar existencias físicas y alertas de reposición',
    moduleName: 'Inventario / Escáner Móvil',
  },
  {
    key: 'autorizarCuentasCorrientes',
    label: 'Autorizar Cuentas Corrientes y Límites',
    description: 'Permite desbloquear cuentas corrientes y modificar topes de crédito',
    moduleName: 'Clientes / POS',
  },
];

export type SidebarMenuTabId =
  | 'punto-de-venta'
  | 'caja'
  | 'ventas'
  | 'ventas-devoluciones'
  | 'clientes'
  | 'proveedores'
  | 'productos'
  | 'acciones-masivas'
  | 'reportes'
  | 'configuracion'
  | 'movil';

export interface SidebarMenuItemConfig {
  id: SidebarMenuTabId;
  label: string;
  visible: boolean;
}

export interface DashboardWidgetsConfig {
  showSalesKpis: boolean;
  showCriticalStockAlerts: boolean;
  showAccountsReceivable: boolean;
  showTopClientsRanking: boolean;
  showSupplierDueAlerts: boolean;
}

export interface CompanyFiscalParams {
  fantasyName: string;
  legalName: string;
  cuit: string;
  taxCondition: string;
  address: string;
  phone: string;
  email: string;
  logoDataUrl: string;
  defaultCurrency: 'ARS' | 'USD';
  defaultIvaRate: '21' | '10.5' | '27' | '0';
  defaultTermsAndConditions: string;
}

export interface PrintingAndMessagingConfig {
  defaultPrintFormat: 'Ticket 80mm' | 'Ticket 58mm' | 'Hoja A4';
  autoPrintOnSale: boolean;
  includeLogoOnPrint: boolean;
  includeAccountBalanceOnTicket: boolean;
  whatsappTemplate: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
}

export interface SystemAdminConfig {
  rolePermissionsMatrix: Record<SystemRoleType, Record<PermissionKey, boolean>>;
  sidebarMenuOrder: SidebarMenuItemConfig[];
  defaultStartScreenByRole: Record<SystemRoleType, NavSectionId>;
  dashboardWidgets: DashboardWidgetsConfig;
  companyFiscal: CompanyFiscalParams;
  printingAndMessaging: PrintingAndMessagingConfig;
  onboardingWizardEnabled: boolean;
  onboardingWizardCompleted: boolean;
  showPostSaleStockButtonInTopBar?: boolean;
  postSaleStockAdjustmentActive?: boolean;
  superAdminPassword?: string;
}

export const DEFAULT_SYSTEM_OPERATORS: SellerProfile[] = [
  {
    name: 'Martín Gómez',
    email: 'martin.gomez@ferreteriadelpuente.com.ar',
    password: 'admin1234',
    status: 'Activo',
    role: 'Super Administrador · Control Total y Reset de Sistema',
    systemRole: 'Super Administrador',
    branchId: 1,
    defaultStartSection: 'inicio',
  },
  {
    name: 'Laura Pereyra',
    email: 'laura.pereyra@ferreteriadelpuente.com.ar',
    password: 'admin123',
    status: 'Activo',
    role: 'Administrador General · Gestión Comercial',
    systemRole: 'Administrador',
    branchId: 1,
    defaultStartSection: 'punto-de-venta',
  },
  {
    name: 'Lucía Fernández',
    email: 'lucia.fernandez@ferreteriadelpuente.com.ar',
    password: 'vendedor123',
    status: 'Activo',
    role: 'Vendedor de Mostrador · POS y Presupuestos',
    systemRole: 'Vendedor',
    branchId: 1,
    defaultStartSection: 'punto-de-venta',
  },
  {
    name: 'Diego Torres',
    email: 'diego.torres@ferreteriadelpuente.com.ar',
    password: 'cajero123',
    status: 'Activo',
    role: 'Cajero Principal · Cobros, Caja y Facturación',
    systemRole: 'Cajero',
    branchId: 1,
    defaultStartSection: 'caja',
  },
  {
    name: 'Roberto Sánchez',
    email: 'roberto.sanchez@ferreteriadelpuente.com.ar',
    password: 'stock123',
    status: 'Activo',
    role: 'Encargado de Depósito · Inventario y Proveedores',
    systemRole: 'Encargado de Stock',
    branchId: 1,
    defaultStartSection: 'productos',
  },
];

export const DEFAULT_ADMIN_CONFIG: SystemAdminConfig = {
  rolePermissionsMatrix: {
    'Super Administrador': {
      modificarPrecios: true,
      permitirDescuentos: true,
      verCostosBase: true,
      anularFacturas: true,
      exportarReportes: true,
      abrirCerrarCaja: true,
      editarStockMinimo: true,
      autorizarCuentasCorrientes: true,
    },
    Administrador: {
      modificarPrecios: true,
      permitirDescuentos: true,
      verCostosBase: true,
      anularFacturas: true,
      exportarReportes: true,
      abrirCerrarCaja: true,
      editarStockMinimo: true,
      autorizarCuentasCorrientes: true,
    },
    Vendedor: {
      modificarPrecios: false,
      permitirDescuentos: true,
      verCostosBase: false,
      anularFacturas: false,
      exportarReportes: false,
      abrirCerrarCaja: false,
      editarStockMinimo: false,
      autorizarCuentasCorrientes: false,
    },
    Cajero: {
      modificarPrecios: false,
      permitirDescuentos: true,
      verCostosBase: false,
      anularFacturas: true,
      exportarReportes: true,
      abrirCerrarCaja: true,
      editarStockMinimo: false,
      autorizarCuentasCorrientes: true,
    },
    'Encargado de Stock': {
      modificarPrecios: true,
      permitirDescuentos: false,
      verCostosBase: true,
      anularFacturas: false,
      exportarReportes: true,
      abrirCerrarCaja: false,
      editarStockMinimo: true,
      autorizarCuentasCorrientes: false,
    },
  },
  sidebarMenuOrder: [
    { id: 'punto-de-venta', label: 'Punto de Venta Rápido', visible: true },
    { id: 'caja', label: 'Caja', visible: true },
    { id: 'ventas', label: 'Ventas', visible: true },
    {
      id: 'ventas-devoluciones',
      label: 'Devoluciones / Notas de Crédito Clientes',
      visible: true,
    },
    { id: 'clientes', label: 'Clientes', visible: true },
    { id: 'proveedores', label: 'Proveedores', visible: true },
    { id: 'productos', label: 'INVENTARIO', visible: true },
    { id: 'acciones-masivas', label: 'ACCIONES MASIVAS', visible: true },
    { id: 'reportes', label: 'Reportes', visible: true },
    { id: 'configuracion', label: 'Configuración', visible: true },
    { id: 'movil', label: 'MÓVIL (Submenú Apps)', visible: true },
  ],
  defaultStartScreenByRole: {
    'Super Administrador': 'inicio',
    Administrador: 'punto-de-venta',
    Vendedor: 'punto-de-venta',
    Cajero: 'caja',
    'Encargado de Stock': 'productos',
  },
  dashboardWidgets: {
    showSalesKpis: true,
    showCriticalStockAlerts: true,
    showAccountsReceivable: true,
    showTopClientsRanking: true,
    showSupplierDueAlerts: true,
  },
  companyFiscal: {
    fantasyName: 'FERRETERIA DEL PUENTE',
    legalName: 'Ferretería del Puente S.R.L.',
    cuit: '30-71458920-9',
    taxCondition: 'IVA Responsable Inscripto',
    address: 'Av. San Martín 1450, CABA, Buenos Aires',
    phone: '+54 9 11 4582-9100',
    email: 'ventas@ferreteriadelpuente.com.ar',
    logoDataUrl: '',
    defaultCurrency: 'ARS',
    defaultIvaRate: '21',
    defaultTermsAndConditions:
      'Presupuesto válido por 15 días corridos. Precios sujetos a modificación sin previo aviso según variación de listas de fábrica. Mercadería entregada y revisada en mostrador.',
  },
  printingAndMessaging: {
    defaultPrintFormat: 'Ticket 58mm',
    autoPrintOnSale: true,
    includeLogoOnPrint: true,
    includeAccountBalanceOnTicket: true,
    whatsappTemplate:
      'Hola *{cliente}* 👋,\nTe enviamos tu comprobante *{comprobante}* de *{empresa}* por un total de *{total}*.\n\n📥 Descargá tu PDF aquí:\n{link_pdf}\n\n¡Muchas gracias por tu compra!',
    emailSubjectTemplate: 'Comprobante {comprobante} - {empresa}',
    emailBodyTemplate:
      'Estimado/a {cliente},\n\nAdjuntamos el detalle de su comprobante {comprobante} emitido por {empresa} por un importe total de {total}.\n\nPuede visualizar o descargar el PDF oficial desde el siguiente enlace:\n{link_pdf}\n\nSaludos cordiales,\n{empresa}',
  },
  onboardingWizardEnabled: true,
  onboardingWizardCompleted: false,
  showPostSaleStockButtonInTopBar: false,
  postSaleStockAdjustmentActive: true,
  superAdminPassword: 'admin1234',
};

export function loadSystemAdminConfig(): SystemAdminConfig {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_CONFIG;
  try {
    const raw = window.localStorage.getItem(SYSTEM_ADMIN_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_ADMIN_CONFIG;

    // Asegurar que la pestaña 'caja' exista en sidebarMenuOrder si venía de una versión previa
    let menuOrder: SidebarMenuItemConfig[] = Array.isArray(
      parsed.sidebarMenuOrder
    )
      ? parsed.sidebarMenuOrder
      : DEFAULT_ADMIN_CONFIG.sidebarMenuOrder;
    if (!menuOrder.some((item) => item.id === 'caja')) {
      const posIdx = menuOrder.findIndex((i) => i.id === 'punto-de-venta');
      const nextOrder = [...menuOrder];
      nextOrder.splice(posIdx >= 0 ? posIdx + 1 : 1, 0, {
        id: 'caja',
        label: 'Caja',
        visible: true,
      });
      menuOrder = nextOrder;
    }
    if (!menuOrder.some((item) => item.id === 'acciones-masivas')) {
      const prodIdx = menuOrder.findIndex((i) => i.id === 'productos');
      const nextOrder = [...menuOrder];
      nextOrder.splice(prodIdx >= 0 ? prodIdx + 1 : nextOrder.length, 0, {
        id: 'acciones-masivas',
        label: 'ACCIONES MASIVAS',
        visible: true,
      });
      menuOrder = nextOrder;
    }

    return {
      rolePermissionsMatrix: {
        ...DEFAULT_ADMIN_CONFIG.rolePermissionsMatrix,
        ...(parsed.rolePermissionsMatrix || {}),
      },
      sidebarMenuOrder: menuOrder,
      defaultStartScreenByRole: {
        ...DEFAULT_ADMIN_CONFIG.defaultStartScreenByRole,
        ...(parsed.defaultStartScreenByRole || {}),
      },
      dashboardWidgets: {
        ...DEFAULT_ADMIN_CONFIG.dashboardWidgets,
        ...(parsed.dashboardWidgets || {}),
      },
      companyFiscal: {
        ...DEFAULT_ADMIN_CONFIG.companyFiscal,
        ...(parsed.companyFiscal || {}),
      },
      printingAndMessaging: {
        ...DEFAULT_ADMIN_CONFIG.printingAndMessaging,
        ...(parsed.printingAndMessaging || {}),
      },
      onboardingWizardEnabled:
        typeof parsed.onboardingWizardEnabled === 'boolean'
          ? parsed.onboardingWizardEnabled
          : true,
      onboardingWizardCompleted:
        typeof parsed.onboardingWizardCompleted === 'boolean'
          ? parsed.onboardingWizardCompleted
          : false,
      showPostSaleStockButtonInTopBar:
        typeof parsed.showPostSaleStockButtonInTopBar === 'boolean'
          ? parsed.showPostSaleStockButtonInTopBar
          : false,
      postSaleStockAdjustmentActive:
        typeof parsed.postSaleStockAdjustmentActive === 'boolean'
          ? parsed.postSaleStockAdjustmentActive
          : true,
      superAdminPassword:
        typeof parsed.superAdminPassword === 'string' &&
        parsed.superAdminPassword.trim()
          ? parsed.superAdminPassword
          : 'admin1234',
    };
  } catch {
    return DEFAULT_ADMIN_CONFIG;
  }
}

export function saveSystemAdminConfig(config: SystemAdminConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SYSTEM_ADMIN_CONFIG_STORAGE_KEY,
      JSON.stringify(config)
    );
    // Sincronizar también el formato de impresión con el modal de comprobantes
    const customPrefsKey = 'ferreteria_voucher_custom_prefs_v1';
    const rawPrefs = window.localStorage.getItem(customPrefsKey);
    const prevPrefs = rawPrefs ? JSON.parse(rawPrefs) : {};
    const isTicket = config.printingAndMessaging.defaultPrintFormat !== 'Hoja A4';
    const thermalWidth =
      config.printingAndMessaging.defaultPrintFormat === 'Ticket 80mm'
        ? '80mm'
        : '58mm';
    window.localStorage.setItem(
      customPrefsKey,
      JSON.stringify({
        ...prevPrefs,
        documentFormat: isTicket ? 'Ticket' : 'A4',
        thermalWidth,
        includeLogo: config.printingAndMessaging.includeLogoOnPrint,
      })
    );
    if (config.companyFiscal.logoDataUrl) {
      window.localStorage.setItem(
        'ferreteria_custom_logo_v1',
        config.companyFiscal.logoDataUrl
      );
    }
    window.dispatchEvent(new CustomEvent('ferreteria-config-updated'));
  } catch {
    // ignore storage errors
  }
}

export function clearAllFerreteriaLocalStoragePreservingSuperAdmin(
  superAdminSeller?: SellerProfile
): {
  preservedOperators: SellerProfile[];
  resetConfig: SystemAdminConfig;
} {
  const superAdminOp: SellerProfile = {
    name: superAdminSeller?.name || DEFAULT_SYSTEM_OPERATORS[0].name,
    email: superAdminSeller?.email || DEFAULT_SYSTEM_OPERATORS[0].email,
    password:
      superAdminSeller?.password ||
      DEFAULT_SYSTEM_OPERATORS[0].password ||
      'admin1234',
    status: 'Activo',
    role: 'Super Administrador · Control Total y Reset de Sistema',
    systemRole: 'Super Administrador',
    branchId: 1,
    defaultStartSection: 'inicio',
  };

  const resetConfig: SystemAdminConfig = {
    ...DEFAULT_ADMIN_CONFIG,
    onboardingWizardEnabled: true,
    onboardingWizardCompleted: false,
    superAdminPassword: superAdminOp.password || 'admin1234',
  };

  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('ferreteria_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem(
        SYSTEM_OPERATORS_STORAGE_KEY,
        JSON.stringify([superAdminOp])
      );
      window.localStorage.setItem(
        SYSTEM_ADMIN_CONFIG_STORAGE_KEY,
        JSON.stringify(resetConfig)
      );
      window.dispatchEvent(new Event('ferreteria_cash_shift_updated'));
      window.dispatchEvent(new CustomEvent('ferreteria-config-updated'));
    } catch {
      // ignore
    }
  }

  return {
    preservedOperators: [superAdminOp],
    resetConfig,
  };
}

export function resolveSystemRole(profile?: SellerProfile | null): SystemRoleType {
  if (!profile) return 'Super Administrador';
  if (
    profile.systemRole === 'Super Administrador' ||
    profile.systemRole === 'Administrador' ||
    profile.systemRole === 'Vendedor' ||
    profile.systemRole === 'Cajero' ||
    profile.systemRole === 'Encargado de Stock'
  ) {
    return profile.systemRole;
  }
  const r = (profile.role || '').toLowerCase();
  if (r.includes('super administrador') || r.includes('superadmin')) {
    return 'Super Administrador';
  }
  if (r.includes('cajero')) return 'Cajero';
  if (r.includes('stock') || r.includes('depósito') || r.includes('deposito'))
    return 'Encargado de Stock';
  if (r.includes('vendedor') && !r.includes('admin')) return 'Vendedor';
  return 'Administrador';
}

export function loadSystemOperators(): SellerProfile[] {
  if (typeof window === 'undefined') return DEFAULT_SYSTEM_OPERATORS;
  try {
    const raw = window.localStorage.getItem(SYSTEM_OPERATORS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        SYSTEM_OPERATORS_STORAGE_KEY,
        JSON.stringify(DEFAULT_SYSTEM_OPERATORS)
      );
      return DEFAULT_SYSTEM_OPERATORS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SYSTEM_OPERATORS;
  } catch {
    return DEFAULT_SYSTEM_OPERATORS;
  }
}

export function saveSystemOperators(list: SellerProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SYSTEM_OPERATORS_STORAGE_KEY,
      JSON.stringify(list)
    );
  } catch {
    // ignore storage errors
  }
}

/**
 * Reglas de Acceso por Rol:
 * - Super Administrador: Acceso total e ilimitado + Reinicio de Sistema a Cero (Reset de Fábrica).
 * - Administrador: Acceso total a todos los módulos operativos.
 * - Vendedor: Acceso a Punto de Venta (POS), Presupuestos y Clientes.
 * - Cajero: Acceso a Cobros, Caja, Facturación, Devoluciones y Cuentas Corrientes de Clientes.
 * - Encargado de Stock: Acceso a Inventario, Precios, Proveedores y Escáner Móvil.
 */
export function isSectionAllowedForRole(
  section: NavSectionId,
  role: SystemRoleType
): boolean {
  if (role === 'Super Administrador' || role === 'Administrador') {
    return true;
  }
  if (role === 'Vendedor') {
    return (
      section === 'punto-de-venta' ||
      section === 'nuevo-presupuesto' ||
      section === 'ventas-presupuestos' ||
      section === 'ventas-devoluciones' ||
      section === 'pago-cuenta-corriente' ||
      section === 'facturar-compra' ||
      section === 'movimientos-ventas' ||
      section === 'clientes' ||
      section === 'escaner-movil'
    );
  }
  if (role === 'Cajero') {
    return (
      section === 'inicio' ||
      section === 'punto-de-venta' ||
      section === 'nuevo-presupuesto' ||
      section === 'caja' ||
      section === 'ventas-presupuestos' ||
      section === 'ventas-facturas' ||
      section === 'ventas-devoluciones' ||
      section === 'pago-cuenta-corriente' ||
      section === 'facturar-compra' ||
      section === 'movimientos-ventas' ||
      section === 'clientes' ||
      section === 'escaner-movil'
    );
  }
  if (role === 'Encargado de Stock') {
    return (
      section === 'productos' ||
      section === 'precios' ||
      section === 'proveedores' ||
      section === 'acciones-masivas' ||
      section === 'facturar-compra' ||
      section === 'escaner-movil'
    );
  }
  return true;
}

export function getDefaultSectionForRole(role: SystemRoleType): NavSectionId {
  const cfg = loadSystemAdminConfig();
  const configured = cfg.defaultStartScreenByRole?.[role];
  if (configured) return configured;
  if (role === 'Super Administrador') return 'inicio';
  if (role === 'Vendedor') return 'punto-de-venta';
  if (role === 'Cajero') return 'caja';
  if (role === 'Encargado de Stock') return 'productos';
  return 'punto-de-venta';
}

export function canViewCostsForRole(role: SystemRoleType): boolean {
  const cfg = loadSystemAdminConfig();
  return Boolean(
    cfg.rolePermissionsMatrix?.[role]?.verCostosBase ??
      (role === 'Super Administrador' ||
        role === 'Administrador' ||
        role === 'Encargado de Stock')
  );
}

export type AdminCenterTab =
  | 'usuarios-rbac'
  | 'paneles-menu'
  | 'empresa-fiscal'
  | 'impresion-envios'
  | 'seguridad-sistema';

interface UsersRolesModuleProps {
  operators: SellerProfile[];
  activeSeller: SellerProfile;
  onUpdateOperators: (next: SellerProfile[], message?: string) => void;
  onSwitchActiveSeller: (seller: SellerProfile) => void;
  branches: Branch[];
  selectedBranch: Branch | null;
  initialTab?: AdminCenterTab;
  onTabChange?: (tab: AdminCenterTab) => void;
  onRelaunchOnboardingWizard?: () => void;
  onFactoryResetCompleted?: (payload: {
    preservedOperators: SellerProfile[];
    resetConfig: SystemAdminConfig;
    workspace: any;
  }) => void;
}

export const UsersRolesModule: React.FC<UsersRolesModuleProps> = ({
  operators,
  activeSeller,
  onUpdateOperators,
  onSwitchActiveSeller,
  selectedBranch,
  initialTab = 'usuarios-rbac',
  onTabChange,
  onRelaunchOnboardingWizard,
  onFactoryResetCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<AdminCenterTab>(initialTab);
  const [adminConfig, setAdminConfig] = useState<SystemAdminConfig>(() =>
    loadSystemAdminConfig()
  );
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Estados para Modal de Confirmación Crítica de Reset de Fábrica (Super Administrador)
  const [factoryResetModalOpen, setFactoryResetModalOpen] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetConfirmTextInput, setResetConfirmTextInput] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [isExecutingFactoryReset, setIsExecutingFactoryReset] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Estados para ABM de Usuarios
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] =
    useState<SystemRoleType>('Vendedor');

  const [userForm, setUserForm] = useState<{
    name: string;
    email: string;
    password: string;
    status: 'Activo' | 'Inactivo';
    systemRole: SystemRoleType;
    customTitle: string;
    defaultStartSection: NavSectionId;
  }>({
    name: '',
    email: '',
    password: '',
    status: 'Activo',
    systemRole: 'Vendedor',
    customTitle: '',
    defaultStartSection: 'punto-de-venta',
  });

  useEffect(() => {
    saveSystemAdminConfig(adminConfig);
  }, [adminConfig]);

  useEffect(() => {
    const handleExternalSync = () => {
      const latest = loadSystemAdminConfig();
      setAdminConfig((prev) => {
        if (
          prev.showPostSaleStockButtonInTopBar ===
            latest.showPostSaleStockButtonInTopBar &&
          prev.postSaleStockAdjustmentActive ===
            latest.postSaleStockAdjustmentActive
        ) {
          return prev;
        }
        return latest;
      });
    };
    window.addEventListener('ferreteria-config-updated', handleExternalSync);
    window.addEventListener('storage', handleExternalSync);
    return () => {
      window.removeEventListener(
        'ferreteria-config-updated',
        handleExternalSync
      );
      window.removeEventListener('storage', handleExternalSync);
    };
  }, []);

  const triggerFeedback = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const buildRoleDescription = (sysRole: SystemRoleType, custom?: string) => {
    if (custom?.trim()) return custom.trim();
    if (sysRole === 'Super Administrador')
      return 'Super Administrador · Control Total y Reset de Sistema';
    if (sysRole === 'Administrador')
      return 'Administrador General · Acceso Total';
    if (sysRole === 'Vendedor')
      return 'Vendedor de Mostrador · POS y Presupuestos';
    if (sysRole === 'Cajero')
      return 'Cajero · Cobros, Cajas y Facturación';
    return 'Encargado de Stock · Inventario y Proveedores';
  };

  const handleOpenCreate = () => {
    setEditingIndex(null);
    setShowPasswordInModal(false);
    setUserForm({
      name: '',
      email: 'usuario@ferreteriadelpuente.com.ar',
      password: 'clave123',
      status: 'Activo',
      systemRole: 'Vendedor',
      customTitle: '',
      defaultStartSection: 'punto-de-venta',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (op: SellerProfile, idx: number) => {
    const resolved = resolveSystemRole(op);
    setEditingIndex(idx);
    setShowPasswordInModal(false);
    setUserForm({
      name: op.name,
      email: op.email,
      password: op.password || 'admin123',
      status: op.status || 'Activo',
      systemRole: resolved,
      customTitle: op.role,
      defaultStartSection:
        op.defaultStartSection || getDefaultSectionForRole(resolved),
    });
    setModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim()) return;

    const newProfile: SellerProfile = {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      password: userForm.password.trim() || '1234',
      status: userForm.status,
      systemRole: userForm.systemRole,
      role: buildRoleDescription(userForm.systemRole, userForm.customTitle),
      branchId: selectedBranch?.id || 1,
      defaultStartSection: userForm.defaultStartSection,
    };

    let nextList: SellerProfile[];
    if (editingIndex !== null) {
      nextList = operators.map((op, i) =>
        i === editingIndex ? newProfile : op
      );
      if (operators[editingIndex]?.name === activeSeller.name) {
        onSwitchActiveSeller(newProfile);
      }
    } else {
      nextList = [...operators, newProfile];
    }

    saveSystemOperators(nextList);
    onUpdateOperators(
      nextList,
      `Usuario "${newProfile.name}" guardado (${newProfile.systemRole} · ${newProfile.status}).`
    );
    setModalOpen(false);
  };

  const handleDeleteUser = (idx: number) => {
    if (operators.length <= 1) return;
    const target = operators[idx];
    const nextList = operators.filter((_, i) => i !== idx);
    saveSystemOperators(nextList);
    onUpdateOperators(
      nextList,
      `Usuario "${target.name}" eliminado del sistema.`
    );
  };

  const handleToggleUserStatus = (idx: number) => {
    const nextList = operators.map((op, i) => {
      if (i !== idx) return op;
      const nextStatus: 'Activo' | 'Inactivo' =
        op.status === 'Inactivo' ? 'Activo' : 'Inactivo';
      return { ...op, status: nextStatus };
    });
    saveSystemOperators(nextList);
    onUpdateOperators(nextList, 'Estado del usuario actualizado.');
  };

  // Matriz de Permisos Personalizados por Rol
  const handleToggleRolePermission = (
    role: SystemRoleType,
    permKey: PermissionKey
  ) => {
    setAdminConfig((prev) => ({
      ...prev,
      rolePermissionsMatrix: {
        ...prev.rolePermissionsMatrix,
        [role]: {
          ...prev.rolePermissionsMatrix[role],
          [permKey]: !prev.rolePermissionsMatrix[role]?.[permKey],
        },
      },
    }));
    triggerFeedback(`Permiso actualizado para el rol ${role}.`);
  };

  // Reordenar y Mostrar/Ocultar Pestañas del Menú Lateral
  const handleToggleSidebarTabVisibility = (tabId: SidebarMenuTabId) => {
    if (tabId === 'configuracion') return; // Configuración siempre visible para poder volver a administrarlo
    setAdminConfig((prev) => ({
      ...prev,
      sidebarMenuOrder: prev.sidebarMenuOrder.map((item) =>
        item.id === tabId ? { ...item, visible: !item.visible } : item
      ),
    }));
    triggerFeedback('Visibilidad del menú lateral actualizada en vivo.');
  };

  const handleMoveSidebarTab = (index: number, direction: -1 | 1) => {
    setAdminConfig((prev) => {
      const list = [...prev.sidebarMenuOrder];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return {
        ...prev,
        sidebarMenuOrder: list,
      };
    });
    triggerFeedback('Orden del menú lateral actualizado en vivo.');
  };

  // Subida de Logo Corporativo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAdminConfig((prev) => ({
          ...prev,
          companyFiscal: {
            ...prev.companyFiscal,
            logoDataUrl: reader.result as string,
          },
        }));
        triggerFeedback('Logo comercial cargado y aplicado en comprobantes.');
      }
    };
    reader.readAsDataURL(file);
  };

  const currentActiveRole = resolveSystemRole(activeSeller);
  const isSuperAdmin = currentActiveRole === 'Super Administrador';

  const expectedSuperAdminPassword =
    adminConfig.superAdminPassword ||
    activeSeller.password ||
    DEFAULT_SYSTEM_OPERATORS[0].password ||
    'admin1234';

  const isFactoryResetConfirmedReady =
    isSuperAdmin &&
    resetPasswordInput.trim().length > 0 &&
    resetConfirmTextInput.trim().toUpperCase() === 'BORRAR TODO';

  const handleOpenFactoryResetModal = () => {
    if (!isSuperAdmin) {
      triggerFeedback(
        'Acceso denegado: Solo el rol Super Administrador puede reiniciar el sistema a cero.'
      );
      return;
    }
    setResetPasswordInput('');
    setResetConfirmTextInput('');
    setResetErrorMsg(null);
    setFactoryResetModalOpen(true);
  };

  const handleConfirmFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setResetErrorMsg(
        'Acceso exclusivo restringido al rol Super Administrador.'
      );
      return;
    }
    if (resetConfirmTextInput.trim().toUpperCase() !== 'BORRAR TODO') {
      setResetErrorMsg(
        'Debe tipear exactamente "BORRAR TODO" para confirmar la operación.'
      );
      return;
    }
    if (resetPasswordInput !== expectedSuperAdminPassword) {
      setResetErrorMsg(
        `Contraseña de Super Administrador incorrecta. (Clave actual configurada: ${expectedSuperAdminPassword})`
      );
      return;
    }

    setIsExecutingFactoryReset(true);
    setResetErrorMsg(null);
    try {
      const res = await fetch('/api/system/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentActiveRole,
          password: resetPasswordInput,
          expectedPassword: expectedSuperAdminPassword,
          confirmationText: resetConfirmTextInput.trim().toUpperCase(),
          superAdminName: activeSeller.name,
          superAdminEmail: activeSeller.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudo completar el reinicio de fábrica.'
        );
      }

      const { preservedOperators, resetConfig } =
        clearAllFerreteriaLocalStoragePreservingSuperAdmin(activeSeller);

      setAdminConfig(resetConfig);
      setFactoryResetModalOpen(false);
      triggerFeedback(
        'Sistema reiniciado a cero correctamente. Se preservó únicamente la cuenta del Super Administrador.'
      );

      if (onFactoryResetCompleted) {
        onFactoryResetCompleted({
          preservedOperators,
          resetConfig,
          workspace: data.workspace,
        });
      }
    } catch (err: any) {
      setResetErrorMsg(
        err.message || 'Error al ejecutar el reinicio del sistema.'
      );
    } finally {
      setIsExecutingFactoryReset(false);
    }
  };

  const handleSwitchTab = (tab: AdminCenterTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="space-y-4">
      {saveToast && (
        <div className="fixed bottom-12 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-[#FF6600] shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* BARRA SUPERIOR DE PESTAÑAS DE CONFIGURACIÓN */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center gap-1.5 shadow-2xs">
        {(
          [
            {
              id: 'usuarios-rbac' as AdminCenterTab,
              label: 'Usuarios y Roles (RBAC)',
              icon: Users,
            },
            {
              id: 'paneles-menu' as AdminCenterTab,
              label: 'Paneles y Menú',
              icon: LayoutDashboard,
            },
            {
              id: 'empresa-fiscal' as AdminCenterTab,
              label: 'Empresa y ARCA',
              icon: Building2,
            },
            {
              id: 'impresion-envios' as AdminCenterTab,
              label: 'Impresoras y Plantillas',
              icon: Printer,
            },
            {
              id: 'seguridad-sistema' as AdminCenterTab,
              label: 'Seguridad / Sistema',
              icon: ShieldCheck,
            },
          ]
        ).map((tabItem) => {
          const IconComp = tabItem.icon;
          const isCurrent = activeTab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => handleSwitchTab(tabItem.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                isCurrent
                  ? tabItem.id === 'seguridad-sistema'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-[#FF6600] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <IconComp className="w-3.5 h-3.5 shrink-0" />
              <span>{tabItem.label}</span>
            </button>
          );
        })}
      </div>

      {/* ====================================================================
          SECCIÓN A: GESTIÓN DE USUARIOS, ROLES Y PERMISOS (RBAC)
         ==================================================================== */}
      {activeTab === 'usuarios-rbac' && (
        <div className="space-y-4">
          {/* Padrón de Usuarios */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF6600]" />
                  <span>Gestión de Usuarios y Asignación de Roles</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cree, edite o desactive usuarios y asigne roles predefinidos (Administrador, Vendedor, Cajero, Encargado de Stock)
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nuevo Usuario</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Nombre y Cargo</th>
                    <th className="py-3 px-4">Email / Usuario</th>
                    <th className="py-3 px-4">Rol Predefinido</th>
                    <th className="py-3 px-4">Pantalla Inicial</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {operators.map((op, idx) => {
                    const role = resolveSystemRole(op);
                    const isCurrent = op.name === activeSeller.name;
                    const status = op.status || 'Activo';
                    return (
                      <tr key={op.email + idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{op.name}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded bg-orange-100 text-[#FF6600] text-[10px] font-extrabold">
                                En Sesión
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {op.role}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {op.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">
                            {role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">
                          {op.defaultStartSection ||
                            getDefaultSectionForRole(role)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(idx)}
                            className={`font-bold cursor-pointer ${
                              status === 'Activo'
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {status}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {!isCurrent && status === 'Activo' && (
                              <button
                                type="button"
                                onClick={() => onSwitchActiveSeller(op)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-[#FF6600] text-[11px] font-bold text-slate-700 hover:text-[#FF6600] cursor-pointer"
                              >
                                Usar Sesión
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(op, idx)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="Editar usuario"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {operators.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(idx)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Matriz de Permisos Personalizados por Rol */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#FF6600]" />
                  <span>Matriz de Permisos Personalizados por Rol</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active o desactive permisos granulares para cada rol predefinido del sistema
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(
                  [
                    'Administrador',
                    'Vendedor',
                    'Cajero',
                    'Encargado de Stock',
                  ] as SystemRoleType[]
                ).map((roleOption) => (
                  <button
                    key={roleOption}
                    type="button"
                    onClick={() => setSelectedRoleForMatrix(roleOption)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      selectedRoleForMatrix === roleOption
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {roleOption}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERMISSIONS_CATALOG.map((perm) => {
                const isEnabled = Boolean(
                  adminConfig.rolePermissionsMatrix[selectedRoleForMatrix]?.[
                    perm.key
                  ]
                );
                return (
                  <div
                    key={perm.key}
                    onClick={() =>
                      handleToggleRolePermission(
                        selectedRoleForMatrix,
                        perm.key
                      )
                    }
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isEnabled
                        ? 'bg-orange-50/40 border-[#FF6600]/50'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">
                          {perm.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          · {perm.moduleName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {perm.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
                        isEnabled ? 'bg-[#FF6600]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          SECCIÓN B: EDICIÓN Y PERSONALIZACIÓN DE PANELES Y MENÚ LATERAL
         ==================================================================== */}
      {activeTab === 'paneles-menu' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* 1. Administrador del Menú de Navegación Lateral */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Administrador del Menú de Navegación Lateral
                </h3>
                <p className="text-xs text-slate-500">
                  Active, oculte o reordene las pestañas del menú principal izquierdo en tiempo real
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminConfig((prev) => ({
                    ...prev,
                    sidebarMenuOrder: DEFAULT_ADMIN_CONFIG.sidebarMenuOrder,
                  }));
                  triggerFeedback('Menú lateral restaurado al orden predeterminado.');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Orden</span>
              </button>
            </div>

            <div className="space-y-2">
              {adminConfig.sidebarMenuOrder.map((item, idx) => (
                <div
                  key={item.id}
                  className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                    item.visible
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSidebarTab(idx, -1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 cursor-pointer"
                      title="Subir posición"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={
                        idx === adminConfig.sidebarMenuOrder.length - 1
                      }
                      onClick={() => handleMoveSidebarTab(idx, 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 cursor-pointer"
                      title="Bajar posición"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={item.id === 'configuracion'}
                      onClick={() => handleToggleSidebarTabVisibility(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        item.visible
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.visible ? 'Visible' : 'Oculto'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Pantalla de Inicio por Defecto + Personalización del Dashboard */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Pantalla de Inicio por Defecto según Rol
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccione en qué módulo abre el sistema al iniciar sesión cada perfil
                </p>
              </div>

              {(
                [
                  'Administrador',
                  'Vendedor',
                  'Cajero',
                  'Encargado de Stock',
                ] as SystemRoleType[]
              ).map((roleKey) => (
                <div
                  key={roleKey}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-bold text-slate-800">{roleKey}</span>
                  <select
                    value={
                      adminConfig.defaultStartScreenByRole[roleKey] ||
                      'punto-de-venta'
                    }
                    onChange={(e) => {
                      const val = e.target.value as NavSectionId;
                      setAdminConfig((prev) => ({
                        ...prev,
                        defaultStartScreenByRole: {
                          ...prev.defaultStartScreenByRole,
                          [roleKey]: val,
                        },
                      }));
                      triggerFeedback(
                        `Pantalla inicial de ${roleKey} actualizada.`
                      );
                    }}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="punto-de-venta">Punto de Venta Rápido (POS)</option>
                    <option value="caja">Módulo de Caja y Arqueo</option>
                    <option value="ventas-presupuestos">Ventas y Presupuestos</option>
                    <option value="productos">Inventario de Productos</option>
                    <option value="proveedores">Proveedores y Pedidos</option>
                    <option value="clientes">Clientes y Cuentas Corrientes</option>
                    <option value="reportes">Reportes y Estadísticas</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Personalización de Tarjetas y Widgets Visibles
                </h3>
                <p className="text-xs text-slate-500">
                  Elija qué indicadores e informes resumidos mostrar en los paneles principales
                </p>
              </div>

              {[
                {
                  key: 'showSalesKpis' as const,
                  label: 'KPIs de Facturación Diaria y Ticket Promedio',
                },
                {
                  key: 'showCriticalStockAlerts' as const,
                  label: 'Alertas de Stock Crítico y Reposición Urgente',
                },
                {
                  key: 'showAccountsReceivable' as const,
                  label: 'Resumen de Cuentas Corrientes por Cobrar',
                },
                {
                  key: 'showTopClientsRanking' as const,
                  label: 'Ranking de Mejores Clientes y Cumplimiento',
                },
                {
                  key: 'showSupplierDueAlerts' as const,
                  label: 'Calendario de Vencimientos a Proveedores',
                },
              ].map((w) => {
                const active = adminConfig.dashboardWidgets[w.key];
                return (
                  <label
                    key={w.key}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 text-xs cursor-pointer"
                  >
                    <span className="font-semibold text-slate-800">
                      {w.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        setAdminConfig((prev) => ({
                          ...prev,
                          dashboardWidgets: {
                            ...prev.dashboardWidgets,
                            [w.key]: !prev.dashboardWidgets[w.key],
                          },
                        }));
                        triggerFeedback('Preferencias de widgets actualizadas.');
                      }}
                      className="w-4 h-4 accent-[#FF6600] cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>

            {/* 3. Control de Visibilidad en Encabezado Superior (TopBar): Actualizar Stock Post-Venta */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Controles Rápidos en Encabezado Superior (TopBar)
                </h3>
                <p className="text-xs text-slate-500">
                  Active u oculte accesos directos operativos en la barra superior del sistema
                </p>
              </div>

              <div
                onClick={() => {
                  const nextVal = !adminConfig.showPostSaleStockButtonInTopBar;
                  setAdminConfig((prev) => ({
                    ...prev,
                    showPostSaleStockButtonInTopBar: nextVal,
                    postSaleStockAdjustmentActive: nextVal
                      ? true
                      : prev.postSaleStockAdjustmentActive,
                  }));
                  triggerFeedback(
                    nextVal
                      ? 'Botón "Ajuste Post-Venta" visible y activado en el Encabezado Superior (TopBar).'
                      : 'Botón "Ajuste Post-Venta" ocultado del Encabezado Superior.'
                  );
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  adminConfig.showPostSaleStockButtonInTopBar
                    ? 'bg-orange-50/50 border-[#FF6600]/60'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      Mostrar Botón Actualizar Stock Post-Venta en Encabezado
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        adminConfig.showPostSaleStockButtonInTopBar
                          ? 'bg-[#FF6600] text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {adminConfig.showPostSaleStockButtonInTopBar
                        ? 'Visible en TopBar'
                        : 'Desactivado (Por Defecto)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Muestra un botón interruptor en la barra superior para activar o desactivar el cuadro de diálogo que solicita confirmar/corregir el stock real luego de cada venta en el POS.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(
                    adminConfig.showPostSaleStockButtonInTopBar
                  )}
                  className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
                    adminConfig.showPostSaleStockButtonInTopBar
                      ? 'bg-[#FF6600]'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                      adminConfig.showPostSaleStockButtonInTopBar
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          SECCIÓN C: PARÁMETROS ESTÁNDAR DE LA EMPRESA Y DATOS FISCALES
         ==================================================================== */}
      {activeTab === 'empresa-fiscal' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#FF6600]" />
                <span>Parámetros Estándar de la Empresa y Datos Fiscales</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure los datos comerciales, CUIT, moneda predeterminada, tasa general de IVA y términos legales
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                saveSystemAdminConfig(adminConfig);
                triggerFeedback(
                  'Datos fiscales y parámetros de la empresa guardados correctamente.'
                );
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Parámetros Fiscales</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nombre de Fantasía
              </label>
              <input
                type="text"
                value={adminConfig.companyFiscal.fantasyName}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      fantasyName: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Razón Social Oficial
              </label>
              <input
                type="text"
                value={adminConfig.companyFiscal.legalName}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      legalName: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                CUIT de la Empresa
              </label>
              <input
                type="text"
                value={adminConfig.companyFiscal.cuit}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      cuit: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Condición frente al IVA
              </label>
              <select
                value={adminConfig.companyFiscal.taxCondition}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      taxCondition: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-[#FF6600]"
              >
                <option value="IVA Responsable Inscripto">
                  IVA Responsable Inscripto
                </option>
                <option value="Responsable Monotributo">
                  Responsable Monotributo
                </option>
                <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dirección Comercial
              </label>
              <input
                type="text"
                value={adminConfig.companyFiscal.address}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      address: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Teléfono Comercial / WhatsApp
              </label>
              <input
                type="text"
                value={adminConfig.companyFiscal.phone}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      phone: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Correo Electrónico Comercial
              </label>
              <input
                type="email"
                value={adminConfig.companyFiscal.email}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      email: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Moneda Predeterminada
              </label>
              <select
                value={adminConfig.companyFiscal.defaultCurrency}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      defaultCurrency: e.target.value as 'ARS' | 'USD',
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
              >
                <option value="ARS">ARS ($) — Peso Argentino</option>
                <option value="USD">USD (u$s) — Dólar Estadounidense</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tasa General de IVA Predeterminada
              </label>
              <select
                value={adminConfig.companyFiscal.defaultIvaRate}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      defaultIvaRate: e.target.value as any,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
              >
                <option value="21">21% (Tasa General Estándar)</option>
                <option value="10.5">10.5% (Tasa Reducida / Bienes de Capital)</option>
                <option value="27">27% (Servicios Especiales)</option>
                <option value="0">0% (Exento)</option>
              </select>
            </div>
          </div>

          {/* Logo del Comercio y Términos y Condiciones */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="md:col-span-4 space-y-2">
              <label className="block font-bold text-slate-700">
                Logo del Comercio (Impresión A4 y Presupuestos)
              </label>
              <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center gap-3">
                {adminConfig.companyFiscal.logoDataUrl ? (
                  <img
                    src={adminConfig.companyFiscal.logoDataUrl}
                    alt="Logo Empresa"
                    className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#FF6600] text-white font-black text-sm flex items-center justify-center shrink-0">
                    FP
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {adminConfig.companyFiscal.logoDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setAdminConfig((prev) => ({
                          ...prev,
                          companyFiscal: {
                            ...prev.companyFiscal,
                            logoDataUrl: '',
                          },
                        }))
                      }
                      className="block text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Quitar logo personalizado
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-8">
              <label className="block font-bold text-slate-700 mb-1">
                Términos y Condiciones Predeterminados para Presupuestos y Comprobantes
              </label>
              <textarea
                rows={3}
                value={adminConfig.companyFiscal.defaultTermsAndConditions}
                onChange={(e) =>
                  setAdminConfig((prev) => ({
                    ...prev,
                    companyFiscal: {
                      ...prev.companyFiscal,
                      defaultTermsAndConditions: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          SECCIÓN D: CONFIGURACIÓN DE IMPRESIÓN, TICKETS Y ENVÍOS
         ==================================================================== */}
      {activeTab === 'impresion-envios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Formato de Impresión Predeterminado */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#FF6600]" />
                <span>Formato de Impresión Predeterminado</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure el formato de salida estándar para Punto de Venta y Facturación
              </p>
            </div>

            <div className="space-y-2">
              {(
                ['Ticket 80mm', 'Ticket 58mm', 'Hoja A4'] as const
              ).map((fmt) => {
                const isSelected =
                  adminConfig.printingAndMessaging.defaultPrintFormat === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setAdminConfig((prev) => ({
                        ...prev,
                        printingAndMessaging: {
                          ...prev.printingAndMessaging,
                          defaultPrintFormat: fmt,
                        },
                      }));
                      triggerFeedback(
                        `Formato de impresión predeterminado establecido en ${fmt}.`
                      );
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6600] bg-orange-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        {fmt === 'Hoja A4'
                          ? 'Hoja A4 Estándar (Impresora Láser / Inkjet)'
                          : `Comandera Térmica (${fmt})`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fmt === 'Ticket 80mm'
                          ? 'Rollo térmico ancho de 80mm para mostrador principal'
                          : fmt === 'Ticket 58mm'
                          ? 'Rollo térmico compacto de 58mm en blanco y negro puro'
                          : 'Documento comercial completo tamaño A4 vertical'}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#FF6600] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              {[
                {
                  key: 'autoPrintOnSale' as const,
                  label: 'Disparar impresión automáticamente al confirmar cobro en POS',
                },
                {
                  key: 'includeLogoOnPrint' as const,
                  label: 'Incluir logo y membrete comercial en el encabezado',
                },
                {
                  key: 'includeAccountBalanceOnTicket' as const,
                  label: 'Imprimir saldo actualizado de Cuenta Corriente al pie del ticket',
                },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <span className="font-semibold text-slate-800">
                    {opt.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={adminConfig.printingAndMessaging[opt.key]}
                    onChange={() => {
                      setAdminConfig((prev) => ({
                        ...prev,
                        printingAndMessaging: {
                          ...prev.printingAndMessaging,
                          [opt.key]: !prev.printingAndMessaging[opt.key],
                        },
                      }));
                      triggerFeedback('Opciones de impresión actualizadas.');
                    }}
                    className="w-4 h-4 accent-[#FF6600] cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Plantillas de Mensajes Predeterminados para WhatsApp y Correo Electrónico */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>
                    Plantillas de Mensajes para WhatsApp y Correo Electrónico
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Variables disponibles:{' '}
                  <code className="font-mono text-[#FF6600]">
                    {'{cliente}'}, {'{comprobante}'}, {'{total}'}, {'{link_pdf}'},{' '}
                    {'{empresa}'}
                  </code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  saveSystemAdminConfig(adminConfig);
                  triggerFeedback(
                    'Plantillas de WhatsApp y Email guardadas correctamente.'
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Plantillas</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Plantilla Predeterminada para Envío por WhatsApp (wa.me)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={adminConfig.printingAndMessaging.whatsappTemplate}
                  onChange={(e) =>
                    setAdminConfig((prev) => ({
                      ...prev,
                      printingAndMessaging: {
                        ...prev.printingAndMessaging,
                        whatsappTemplate: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <Mail className="w-3.5 h-3.5 text-sky-600" />
                  <span>Asunto Predeterminado de Correo Electrónico</span>
                </label>
                <input
                  type="text"
                  value={adminConfig.printingAndMessaging.emailSubjectTemplate}
                  onChange={(e) =>
                    setAdminConfig((prev) => ({
                      ...prev,
                      printingAndMessaging: {
                        ...prev.printingAndMessaging,
                        emailSubjectTemplate: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Cuerpo Predeterminado de Correo Electrónico</span>
                </label>
                <textarea
                  rows={4}
                  value={adminConfig.printingAndMessaging.emailBodyTemplate}
                  onChange={(e) =>
                    setAdminConfig((prev) => ({
                      ...prev,
                      printingAndMessaging: {
                        ...prev.printingAndMessaging,
                        emailBodyTemplate: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIO CON CONTRASEÑA, ROL Y ESTADO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#FF6600]" />
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingIndex !== null
                    ? 'Editar Usuario y Rol'
                    : 'Crear Nuevo Usuario'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) =>
                    setUserForm({ ...userForm, name: e.target.value })
                  }
                  placeholder="Ej: Carla Méndez"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email / Nombre de Usuario *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.email}
                  onChange={(e) =>
                    setUserForm({ ...userForm, email: e.target.value })
                  }
                  placeholder="usuario@ferreteriadelpuente.com.ar"
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contraseña de Acceso *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInModal ? 'text' : 'password'}
                      required
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm({ ...userForm, password: e.target.value })
                      }
                      className="w-full pl-3 pr-8 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswordInModal((prev) => !prev)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPasswordInModal ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Estado del Usuario
                  </label>
                  <select
                    value={userForm.status}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        status: e.target.value as 'Activo' | 'Inactivo',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rol Predefinido (RBAC)
                </label>
                <select
                  value={userForm.systemRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as SystemRoleType;
                    setUserForm({
                      ...userForm,
                      systemRole: nextRole,
                      defaultStartSection: getDefaultSectionForRole(nextRole),
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Super Administrador">
                    Super Administrador (Control Total + Reset de Fábrica)
                  </option>
                  <option value="Administrador">
                    Administrador (Acceso Total Operativo)
                  </option>
                  <option value="Vendedor">
                    Vendedor (Acceso a POS y Presupuestos)
                  </option>
                  <option value="Cajero">
                    Cajero (Acceso a Cobros, Cajas y Facturación)
                  </option>
                  <option value="Encargado de Stock">
                    Encargado de Stock (Acceso a Inventario y Proveedores)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pantalla Inicial al Iniciar Sesión
                </label>
                <select
                  value={userForm.defaultStartSection}
                  onChange={(e) =>
                    setUserForm({
                      ...userForm,
                      defaultStartSection: e.target.value as NavSectionId,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="inicio">Dashboard Principal (Inicio)</option>
                  <option value="punto-de-venta">Punto de Venta Rápido (POS)</option>
                  <option value="caja">Caja Diaria y Arqueo</option>
                  <option value="ventas-presupuestos">Ventas y Presupuestos</option>
                  <option value="productos">Inventario de Productos</option>
                  <option value="proveedores">Proveedores y Pedidos</option>
                  <option value="clientes">Clientes y Cuentas Corrientes</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg font-extrabold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          SECCIÓN E: SEGURIDAD / SISTEMA (ASISTENTE INICIAL Y RESET DE FÁBRICA)
         ==================================================================== */}
      {activeTab === 'seguridad-sistema' && (
        <div className="space-y-4">
          {/* PANEL 1: CONTROL DE ACTIVACIÓN DEL ASISTENTE DE PRIMEROS PASOS (ONBOARDING WIZARD) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6600] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Asistente de Inicio Guía (Wizard de Primeros Pasos)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure si el asistente interactivo de 4 pasos debe mostrarse al iniciar o cuando la base de datos esté vacía
                  </p>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                  adminConfig.onboardingWizardEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {adminConfig.onboardingWizardEnabled
                  ? 'Asistente Guía: ACTIVO'
                  : 'Asistente Guía: DESACTIVADO'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Toggle On/Off */}
              <div className="lg:col-span-7 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                    Activar / Desactivar Asistente de Inicio Guía
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cuando está activado, guía paso a paso la configuración del negocio, primer producto, cliente/proveedor y primera apertura de caja.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={adminConfig.onboardingWizardEnabled}
                  onClick={() => {
                    const nextVal = !adminConfig.onboardingWizardEnabled;
                    setAdminConfig((prev) => ({
                      ...prev,
                      onboardingWizardEnabled: nextVal,
                    }));
                    triggerFeedback(
                      nextVal
                        ? 'Asistente de Inicio Guía ACTIVADO.'
                        : 'Asistente de Inicio Guía DESACTIVADO.'
                    );
                  }}
                  className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    adminConfig.onboardingWizardEnabled
                      ? 'bg-[#FF6600]'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      adminConfig.onboardingWizardEnabled
                        ? 'translate-x-6'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Botón para Reiniciar / Volver a Lanzar el Asistente en cualquier momento */}
              <div className="lg:col-span-5 p-4 rounded-xl bg-orange-50/70 border border-orange-200 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    ¿Desea recorrer la guía inicial nuevamente?
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Reabre el asistente interactivo desde el Paso 1 en cualquier momento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminConfig((prev) => ({
                      ...prev,
                      onboardingWizardEnabled: true,
                      onboardingWizardCompleted: false,
                    }));
                    onRelaunchOnboardingWizard?.();
                  }}
                  className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold shadow-xs cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reiniciar / Volver a Lanzar el Asistente</span>
                </button>
              </div>
            </div>
          </div>

          {/* PANEL 2: ZONA DE PELIGRO — REINICIAR SISTEMA A CERO (ACCESO EXCLUSIVO SUPER ADMINISTRADOR) */}
          <div className="bg-white border-2 border-rose-300 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-rose-950 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/50 text-rose-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black tracking-wide uppercase text-white">
                      Reiniciar Sistema a Cero (Reset de Fábrica)
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                      Acceso Exclusivo SuperAdmin
                    </span>
                  </div>
                  <p className="text-xs text-rose-200 mt-0.5">
                    Elimina todos los registros operativos y deja la base de datos en blanco lista para la puesta en marcha inicial
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-rose-200">Operador actual:</span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                    isSuperAdmin
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-800 text-rose-100 border border-rose-600'
                  }`}
                >
                  {activeSeller.name} ({currentActiveRole})
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {!isSuperAdmin ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm font-extrabold text-rose-950">
                        Acción Bloqueada — Requiere Rol &ldquo;Super Administrador&rdquo; (SuperAdmin)
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed">
                        Su sesión actual tiene el rol <strong>{currentActiveRole}</strong>. Por razones de seguridad crítica, únicamente el <strong>Super Administrador</strong> tiene permisos para ejecutar el Reinicio desde Cero (Reset de Fábrica).
                      </p>
                    </div>
                  </div>
                  {operators.some(
                    (op) => resolveSystemRole(op) === 'Super Administrador'
                  ) && (
                    <button
                      type="button"
                      onClick={() => {
                        const superAdminOp = operators.find(
                          (op) => resolveSystemRole(op) === 'Super Administrador'
                        );
                        if (superAdminOp) {
                          onSwitchActiveSeller(superAdminOp);
                          triggerFeedback(
                            `Sesión cambiada a ${superAdminOp.name} (Super Administrador).`
                          );
                        }
                      }}
                      className="shrink-0 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer transition-colors"
                    >
                      Cambiar a Super Administrador
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-8 space-y-2">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                      ¿Qué datos se eliminarán al ejecutar el Reset de Fábrica?
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Esta operación vaciará por completo las tablas de <strong>clientes, proveedores, productos/inventario, turnos y arqueos de caja, ventas, presupuestos, remitos y movimientos</strong>. Se preservará únicamente la cuenta del <strong>Super Administrador ({activeSeller.name})</strong> y se reiniciará la aplicación lanzando el Asistente de Primeros Pasos.
                    </p>
                    <div className="inline-flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        Contraseña SuperAdmin actual:{' '}
                        <strong className="text-slate-900">
                          {expectedSuperAdminPassword}
                        </strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        Frase requerida:{' '}
                        <strong className="text-rose-700">BORRAR TODO</strong>
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-4 flex lg:justify-end">
                    <button
                      type="button"
                      onClick={handleOpenFactoryResetModal}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black uppercase tracking-wide shadow-md cursor-pointer transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reiniciar Sistema a Cero (Reset de Fábrica)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADVERTENCIA CRÍTICA CON FONDO ROJO PARA RESET DE FÁBRICA */}
      {factoryResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/90 backdrop-blur-sm">
          <div className="bg-rose-900 border-2 border-rose-400 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-white space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-rose-700/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 border-2 border-rose-300 flex items-center justify-center shrink-0 shadow-lg">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded bg-rose-950 text-rose-200 font-mono text-[10px] font-black uppercase tracking-widest border border-rose-700">
                    ADVERTENCIA CRÍTICA DE SEGURIDAD
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    Reiniciar Sistema a Cero (Reset de Fábrica)
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFactoryResetModalOpen(false)}
                className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-rose-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/90 border border-rose-500/70 space-y-2 text-xs text-rose-100 leading-relaxed">
              <p className="font-black text-rose-200 uppercase tracking-wide">
                ⚠️ ESTA ACCIÓN ES TOTALMENTE IRREVERSIBLE
              </p>
              <p>
                Al confirmar, se eliminarán de forma permanente todos los registros de:
              </p>
              <ul className="list-disc list-inside font-semibold text-white space-y-0.5">
                <li>Clientes, Cuentas Corrientes y Saldos</li>
                <li>Proveedores, Órdenes de Compra y Vencimientos</li>
                <li>Productos, Catálogo de Inventario y Ajustes de Stock</li>
                <li>Turnos de Caja, Arqueos, Ventas, Presupuestos y Movimientos</li>
              </ul>
              <p className="pt-1 text-amber-200 font-bold">
                Únicamente se preservará la cuenta del Super Administrador ({activeSeller.name}) y el sistema se reiniciará en blanco.
              </p>
            </div>

            <form onSubmit={handleConfirmFactoryReset} className="space-y-4 text-xs">
              <div>
                <label className="block font-extrabold text-rose-100 mb-1.5">
                  1. Ingrese la Contraseña del Super Administrador *
                </label>
                <input
                  type="password"
                  required
                  value={resetPasswordInput}
                  onChange={(e) => {
                    setResetPasswordInput(e.target.value);
                    setResetErrorMsg(null);
                  }}
                  placeholder={`Contraseña de ${activeSeller.name} (Ej: ${expectedSuperAdminPassword})`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-rose-950 border border-rose-500 text-white placeholder:text-rose-400/70 font-mono text-sm focus:outline-none focus:border-white"
                />
                <span className="block text-[11px] text-rose-200/90 mt-1 font-mono">
                  Clave configurada para SuperAdmin: <strong>{expectedSuperAdminPassword}</strong>
                </span>
              </div>

              <div>
                <label className="block font-extrabold text-rose-100 mb-1.5">
                  2. Escriba exactamente <span className="px-1.5 py-0.5 rounded bg-rose-950 text-amber-300 font-mono font-black">BORRAR TODO</span> para habilitar el borrado *
                </label>
                <input
                  type="text"
                  required
                  value={resetConfirmTextInput}
                  onChange={(e) => {
                    setResetConfirmTextInput(e.target.value);
                    setResetErrorMsg(null);
                  }}
                  placeholder="Escriba BORRAR TODO en mayúsculas"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-rose-950 border border-rose-500 text-white placeholder:text-rose-400/70 font-mono font-bold text-sm uppercase focus:outline-none focus:border-white"
                />
              </div>

              {resetErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-950 border border-amber-400 text-amber-200 font-bold text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>{resetErrorMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-rose-700/80">
                <button
                  type="button"
                  disabled={isExecutingFactoryReset}
                  onClick={() => setFactoryResetModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-rose-100 font-bold cursor-pointer"
                >
                  Cancelar y Volver
                </button>
                <button
                  type="submit"
                  disabled={
                    !isFactoryResetConfirmedReady || isExecutingFactoryReset
                  }
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase tracking-wide transition-all ${
                    isFactoryResetConfirmedReady && !isExecutingFactoryReset
                      ? 'bg-white text-rose-900 hover:bg-rose-100 shadow-lg cursor-pointer'
                      : 'bg-rose-950/60 text-rose-400/60 border border-rose-800 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {isExecutingFactoryReset
                      ? 'Borrando Base de Datos...'
                      : 'Confirmar y Borrar Todo a Cero'}
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
