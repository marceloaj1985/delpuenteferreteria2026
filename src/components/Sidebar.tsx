import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Receipt,
  Truck,
  BarChart3,
  Users,
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  FileText,
  FileCheck,
  RotateCcw,
  Smartphone,
  QrCode,
  Wallet,
  Trophy,
  CalendarClock,
  CreditCard,
  ClipboardList,
  Tag,
  Banknote,
  History,
  Calculator,
  ArrowUpDown,
  Download,
  Upload,
  Layers,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { NavSectionId, SystemRoleType } from '../types/ferreteria.ts';
import {
  isSectionAllowedForRole,
  loadSystemAdminConfig,
  SidebarMenuTabId,
  SystemAdminConfig,
  AdminCenterTab,
} from './UsersRolesModule.tsx';
import { SuppliersSubTab } from './SuppliersModule.tsx';
import { CashSubTab } from './CashRegisterModule.tsx';

export type MobileQuickMode = 'stock' | 'supplier_order' | 'mini_pos';

interface SidebarProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activeRole?: SystemRoleType;
  onOpenScannerApp?: (mode?: MobileQuickMode) => void;
  onInstallMobileApp?: (mode: MobileQuickMode) => void;
  activeCashSubTab?: CashSubTab;
  onSelectCashQuickAction?: (subTab: CashSubTab) => void;
  activeClientSubTab?: 'padron' | 'cuenta-corriente' | 'ranking';
  onSelectClientQuickAction?: (
    subTab: 'padron' | 'cuenta-corriente' | 'ranking'
  ) => void;
  activeSupplierSubTab?: SuppliersSubTab;
  onSelectSupplierQuickAction?: (subTab: SuppliersSubTab) => void;
  activeConfigSubTab?: AdminCenterTab;
  onSelectConfigQuickAction?: (subTab: AdminCenterTab) => void;
  onSelectBulkAction?: (
    action:
      | 'import-suppliers'
      | 'import-products'
      | 'import-clients'
      | 'bulk-editor'
  ) => void;
  onDownloadTemplate?: (
    entity: 'suppliers' | 'products' | 'clients'
  ) => void;
  onOpenDownloadsModal?: () => void;
  counts: {
    presupuestos: number;
    facturas: number;
    devoluciones: number;
    productos: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  activeRole = 'Administrador',
  onOpenScannerApp,
  onInstallMobileApp,
  activeCashSubTab = 'resumen-arqueo',
  onSelectCashQuickAction,
  activeClientSubTab = 'padron',
  onSelectClientQuickAction,
  activeSupplierSubTab = 'listado',
  onSelectSupplierQuickAction,
  activeConfigSubTab = 'usuarios-rbac',
  onSelectConfigQuickAction,
  onSelectBulkAction,
  onDownloadTemplate,
  counts,
}) => {
  const [cajaExpanded, setCajaExpanded] = useState(false);
  const [ventasExpanded, setVentasExpanded] = useState(false);
  const [clientesExpanded, setClientesExpanded] = useState(false);
  const [proveedoresExpanded, setProveedoresExpanded] = useState(false);
  const [inventarioExpanded, setInventarioExpanded] = useState(false);
  const [accionesMasivasExpanded, setAccionesMasivasExpanded] = useState(
    activeSection === 'acciones-masivas'
  );
  const [configuracionExpanded, setConfiguracionExpanded] = useState(
    activeSection === 'configuracion'
  );
  const [movilExpanded, setMovilExpanded] = useState(false);
  const [movilAppsExpanded, setMovilAppsExpanded] = useState(true);
  const [movilDescargasExpanded, setMovilDescargasExpanded] = useState(true);

  const [adminConfig, setAdminConfig] = useState<SystemAdminConfig>(() =>
    loadSystemAdminConfig()
  );

  useEffect(() => {
    const syncConfig = () => {
      setAdminConfig(loadSystemAdminConfig());
    };
    window.addEventListener('ferreteria-config-updated', syncConfig);
    window.addEventListener('storage', syncConfig);
    return () => {
      window.removeEventListener('ferreteria-config-updated', syncConfig);
      window.removeEventListener('storage', syncConfig);
    };
  }, []);

  const isTabVisible = (tabId: SidebarMenuTabId): boolean => {
    const found = adminConfig.sidebarMenuOrder?.find((t) => t.id === tabId);
    return found ? found.visible : true;
  };

  const isVentasActive =
    activeSection === 'nuevo-presupuesto' ||
    activeSection === 'ventas-presupuestos' ||
    activeSection === 'ventas-facturas' ||
    activeSection === 'ventas-devoluciones' ||
    activeSection === 'pago-cuenta-corriente' ||
    activeSection === 'facturar-compra' ||
    activeSection === 'movimientos-ventas';

  const isInventarioActive =
    activeSection === 'productos' || activeSection === 'precios';

  const handleNavClick = (section: NavSectionId) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const handleCajaToggle = () => {
    onSelectCashQuickAction?.('resumen-arqueo');
    if (isCollapsed) {
      onToggleCollapse();
      setCajaExpanded(true);
      handleNavClick('caja');
    } else {
      setCajaExpanded((prev) => (activeSection !== 'caja' ? true : !prev));
      onSelectSection('caja');
    }
  };

  const handleVentasToggle = () => {
    if (isCollapsed) {
      onToggleCollapse();
      setVentasExpanded(true);
      onSelectSection('movimientos-ventas');
    } else {
      setVentasExpanded((prev) => !prev);
    }
  };

  const handleClientesToggle = () => {
    onSelectClientQuickAction?.('padron');
    if (isCollapsed) {
      onToggleCollapse();
      setClientesExpanded(true);
      handleNavClick('clientes');
    } else {
      setClientesExpanded((prev) =>
        activeSection !== 'clientes' ? true : !prev
      );
      onSelectSection('clientes');
    }
  };

  const handleProveedoresToggle = () => {
    onSelectSupplierQuickAction?.('listado');
    if (isCollapsed) {
      onToggleCollapse();
      setProveedoresExpanded(true);
      handleNavClick('proveedores');
    } else {
      setProveedoresExpanded((prev) =>
        activeSection !== 'proveedores' ? true : !prev
      );
      onSelectSection('proveedores');
    }
  };

  const handleInventarioToggle = () => {
    if (isCollapsed) {
      onToggleCollapse();
      setInventarioExpanded(true);
      handleNavClick('productos');
    } else {
      setInventarioExpanded((prev) => !prev);
      if (!isInventarioActive) {
        onSelectSection('productos');
      }
    }
  };

  const handleAccionesMasivasToggle = () => {
    if (isCollapsed) {
      onToggleCollapse();
      setAccionesMasivasExpanded(true);
      handleNavClick('acciones-masivas');
    } else {
      setAccionesMasivasExpanded((prev) =>
        activeSection !== 'acciones-masivas' ? true : !prev
      );
      onSelectSection('acciones-masivas');
    }
  };

  const handleConfiguracionToggle = () => {
    onSelectConfigQuickAction?.('usuarios-rbac');
    if (isCollapsed) {
      onToggleCollapse();
      setConfiguracionExpanded(true);
      handleNavClick('configuracion');
    } else {
      setConfiguracionExpanded((prev) =>
        activeSection !== 'configuracion' ? true : !prev
      );
      onSelectSection('configuracion');
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/configuracion');
      }
    }
  };

  const handleMovilToggle = () => {
    if (isCollapsed) {
      onToggleCollapse();
      setMovilExpanded(true);
    } else {
      setMovilExpanded((prev) => !prev);
    }
  };

  // Submenú Ventas (contraído por defecto): Nueva Venta, Nuevo Presupuesto, Nueva Devolución, Pago Cuenta Corriente, Facturar Compra, Movimientos
  const ventasSubItems: Array<{
    id: NavSectionId;
    label: string;
    path: string;
    icon: React.ElementType;
    iconColor: string;
    count?: number;
  }> = (
    [
      {
        id: 'punto-de-venta' as NavSectionId,
        label: 'Nueva Venta',
        path: '/pos',
        icon: ShoppingCart,
        iconColor: 'text-[#FF6600]',
      },
      {
        id: 'nuevo-presupuesto' as NavSectionId,
        label: 'Nuevo Presupuesto',
        path: '/nuevo-presupuesto',
        icon: FileText,
        iconColor: 'text-indigo-400',
        count: counts.presupuestos,
      },
      {
        id: 'ventas-devoluciones' as NavSectionId,
        label: 'Nueva Devolución',
        path: '/nueva-devolucion',
        icon: RotateCcw,
        iconColor: 'text-rose-400',
        count: counts.devoluciones,
      },
      {
        id: 'pago-cuenta-corriente' as NavSectionId,
        label: 'Pago Cuenta Corriente',
        path: '/pago-cuenta-corriente',
        icon: Wallet,
        iconColor: 'text-emerald-400',
      },
      {
        id: 'facturar-compra' as NavSectionId,
        label: 'Facturar Compra',
        path: '/facturar-compra',
        icon: Truck,
        iconColor: 'text-amber-400',
      },
      {
        id: 'movimientos-ventas' as NavSectionId,
        label: 'Movimientos',
        path: '/movimientos-ventas',
        icon: History,
        iconColor: 'text-sky-400',
        count: counts.facturas + counts.presupuestos + counts.devoluciones,
      },
    ]
  ).filter((it) => isSectionAllowedForRole(it.id, activeRole));

  const renderTabItem = (tabId: SidebarMenuTabId) => {
    if (!isTabVisible(tabId)) return null;

    switch (tabId) {
      case 'punto-de-venta':
        if (!isSectionAllowedForRole('punto-de-venta', activeRole)) return null;
        return (
          <button
            key="punto-de-venta"
            type="button"
            onClick={() => handleNavClick('punto-de-venta')}
            title={isCollapsed ? 'Punto de Venta Rápido' : undefined}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
            } py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeSection === 'punto-de-venta'
                ? 'bg-[#FF6600] text-white shadow-sm'
                : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <ShoppingCart
                className={`w-5 h-5 shrink-0 ${
                  activeSection === 'punto-de-venta'
                    ? 'text-white'
                    : 'text-[#FF6600]'
                }`}
              />
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">
                  Punto de Venta Rápido
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  activeSection === 'punto-de-venta'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800 text-[#FF6600]'
                }`}
              >
                POS
              </span>
            )}
          </button>
        );

      case 'caja':
        if (!isSectionAllowedForRole('caja', activeRole)) return null;
        return (
          <div key="caja" className="pt-0.5">
            <button
              type="button"
              onClick={handleCajaToggle}
              title={
                isCollapsed
                  ? 'CAJA (Apertura/Cierre, Ingresos/Egresos, Historial, Medios de Pago)'
                  : undefined
              }
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-bold tracking-wide transition-colors cursor-pointer ${
                activeSection === 'caja'
                  ? 'bg-[#FF6600] text-white shadow-sm'
                  : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Wallet
                  className={`w-5 h-5 shrink-0 ${
                    activeSection === 'caja' ? 'text-white' : 'text-emerald-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">CAJA</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  {cajaExpanded ? (
                    <ChevronDown className="w-4 h-4 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-current opacity-80" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && cajaExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                {(
                  [
                    {
                      id: 'resumen-arqueo' as CashSubTab,
                      label: 'Apertura y Cierre de Caja (Arqueo)',
                      icon: Calculator,
                      iconColor: 'text-emerald-400',
                    },
                    {
                      id: 'ingresos-egresos' as CashSubTab,
                      label: 'Ingresos / Egresos Manuales',
                      icon: ArrowUpDown,
                      iconColor: 'text-[#FF6600]',
                    },
                    {
                      id: 'historial-cajas' as CashSubTab,
                      label: 'Historial de Cajas y Movimientos',
                      icon: History,
                      iconColor: 'text-amber-400',
                    },
                    {
                      id: 'medios-pago' as CashSubTab,
                      label: 'Resumen por Medio de Pago',
                      icon: Banknote,
                      iconColor: 'text-sky-400',
                    },
                  ]
                ).map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive =
                    activeSection === 'caja' && activeCashSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onSelectCashQuickAction?.(sub.id);
                        handleNavClick('caja');
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                        isSubActive
                          ? 'bg-[#FF6600] text-white font-bold shadow-2xs'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <SubIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSubActive ? 'text-white' : sub.iconColor
                        }`}
                      />
                      <span className="truncate">{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'ventas':
        if (ventasSubItems.length === 0) return null;
        return (
          <div key="ventas" className="pt-0.5">
            <button
              type="button"
              onClick={handleVentasToggle}
              title={
                isCollapsed
                  ? 'Ventas (Nueva Venta, Nuevo Presupuesto, Nueva Devolución, Pago Cuenta Corriente, Facturar Compra, Movimientos)'
                  : undefined
              }
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isVentasActive && isCollapsed
                  ? 'bg-[#FF6600] text-white'
                  : isVentasActive
                  ? 'bg-slate-800/90 text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Receipt
                  className={`w-5 h-5 shrink-0 ${
                    isVentasActive ? 'text-[#FF6600]' : 'text-slate-400'
                  } ${isVentasActive && isCollapsed ? '!text-white' : ''}`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">Ventas</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  {ventasExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && ventasExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                {ventasSubItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive = activeSection === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      title={sub.path}
                      onClick={() => {
                        if (sub.id === 'pago-cuenta-corriente') {
                          onSelectClientQuickAction?.('cuenta-corriente');
                        }
                        if (typeof window !== 'undefined') {
                          window.history.pushState({}, '', sub.path);
                        }
                        handleNavClick(sub.id);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isSubActive
                          ? 'bg-[#FF6600] text-white font-semibold shadow-2xs'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 text-left">
                        <SubIcon
                          className={`w-4 h-4 shrink-0 ${
                            isSubActive ? 'text-white' : sub.iconColor
                          }`}
                        />
                        <span className="leading-tight truncate">
                          {sub.label}
                        </span>
                      </div>
                      {sub.count !== undefined && (
                        <span
                          className={`font-mono text-[11px] tabular-nums ml-1.5 shrink-0 ${
                            isSubActive ? 'text-white/90' : 'text-slate-400'
                          }`}
                        >
                          {sub.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'ventas-devoluciones':
        // Se renderiza dentro del submenú de Ventas (o acceso rápido si Ventas estuviera oculto)
        return null;

      case 'clientes':
        if (!isSectionAllowedForRole('clientes', activeRole)) return null;
        return (
          <div key="clientes" className="pt-0.5">
            <button
              type="button"
              onClick={handleClientesToggle}
              title={isCollapsed ? 'Clientes y Funciones Rápidas' : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === 'clientes' && isCollapsed
                  ? 'bg-[#FF6600] text-white'
                  : activeSection === 'clientes'
                  ? 'bg-[#FF6600] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Users
                  className={`w-5 h-5 shrink-0 ${
                    activeSection === 'clientes'
                      ? 'text-white'
                      : 'text-slate-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">Clientes</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  {clientesExpanded ? (
                    <ChevronDown className="w-4 h-4 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-current opacity-80" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && clientesExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                {(
                  [
                    {
                      id: 'padron' as const,
                      label: 'Padrón y Alta Rápida',
                      icon: Users,
                      iconColor: 'text-[#FF6600]',
                    },
                    {
                      id: 'cuenta-corriente' as const,
                      label: 'Cuentas Corrientes y Cobros',
                      icon: Wallet,
                      iconColor: 'text-emerald-400',
                    },
                    {
                      id: 'ranking' as const,
                      label: 'Ranking y Límites de Crédito',
                      icon: Trophy,
                      iconColor: 'text-amber-400',
                    },
                  ]
                ).map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive =
                    activeSection === 'clientes' &&
                    activeClientSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onSelectClientQuickAction?.(sub.id);
                        handleNavClick('clientes');
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                        isSubActive
                          ? 'bg-[#FF6600] text-white font-bold shadow-2xs'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <SubIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSubActive ? 'text-white' : sub.iconColor
                        }`}
                      />
                      <span className="truncate">{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'proveedores':
        if (!isSectionAllowedForRole('proveedores', activeRole)) return null;
        return (
          <div key="proveedores" className="pt-0.5">
            <button
              type="button"
              onClick={handleProveedoresToggle}
              title={isCollapsed ? 'Proveedores y Funciones Rápidas' : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === 'proveedores'
                  ? 'bg-[#FF6600] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Truck
                  className={`w-5 h-5 shrink-0 ${
                    activeSection === 'proveedores'
                      ? 'text-white'
                      : 'text-slate-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">Proveedores</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  {proveedoresExpanded ? (
                    <ChevronDown className="w-4 h-4 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-current opacity-80" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && proveedoresExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                {(
                  [
                    {
                      id: 'listado' as SuppliersSubTab,
                      label: 'Padrón y Saldos Cta. Cte.',
                      icon: Truck,
                      iconColor: 'text-[#FF6600]',
                    },
                    {
                      id: 'pedidos' as SuppliersSubTab,
                      label: 'Armar Pedido a Proveedor',
                      icon: ShoppingCart,
                      iconColor: 'text-amber-400',
                    },
                    {
                      id: 'pagos' as SuppliersSubTab,
                      label: 'Registrar Pago / Orden',
                      icon: CreditCard,
                      iconColor: 'text-emerald-400',
                    },
                    {
                      id: 'devoluciones' as SuppliersSubTab,
                      label: 'Devoluciones a Proveedor',
                      icon: RotateCcw,
                      iconColor: 'text-rose-400',
                    },
                    {
                      id: 'calendario' as SuppliersSubTab,
                      label: 'Calendario de Vencimientos',
                      icon: CalendarClock,
                      iconColor: 'text-sky-400',
                    },
                    {
                      id: 'gestion-pedidos' as SuppliersSubTab,
                      label: 'Gestión de Pedidos Emitidos',
                      icon: ClipboardList,
                      iconColor: 'text-orange-400',
                    },
                    {
                      id: 'historial-operaciones' as SuppliersSubTab,
                      label: 'Historial de Movimientos',
                      icon: History,
                      iconColor: 'text-slate-300',
                    },
                  ]
                ).map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive =
                    activeSection === 'proveedores' &&
                    activeSupplierSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onSelectSupplierQuickAction?.(sub.id);
                        handleNavClick('proveedores');
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                        isSubActive
                          ? 'bg-[#FF6600] text-white font-bold shadow-2xs'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <SubIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSubActive ? 'text-white' : sub.iconColor
                        }`}
                      />
                      <span className="truncate">{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'productos':
        if (!isSectionAllowedForRole('productos', activeRole)) return null;
        return (
          <div key="productos" className="pt-0.5">
            <button
              type="button"
              onClick={handleInventarioToggle}
              title={isCollapsed ? 'INVENTARIO' : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-bold tracking-wide transition-colors cursor-pointer ${
                isInventarioActive
                  ? 'bg-[#FF6600] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Package
                  className={`w-5 h-5 shrink-0 ${
                    isInventarioActive ? 'text-white' : 'text-slate-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">INVENTARIO</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                      isInventarioActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {counts.productos}
                  </span>
                  {inventarioExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-current opacity-80" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && inventarioExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={() => handleNavClick('productos')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    activeSection === 'productos'
                      ? 'text-[#FF6600] font-bold bg-slate-800/60'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Catálogo y Control de Stock</span>
                </button>
                {isSectionAllowedForRole('precios', activeRole) && (
                  <button
                    type="button"
                    onClick={() => handleNavClick('precios')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                      activeSection === 'precios'
                        ? 'text-[#FF6600] font-bold bg-slate-800/60'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Listas de Precios y Márgenes</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );

      case 'acciones-masivas':
        if (!isSectionAllowedForRole('acciones-masivas', activeRole))
          return null;
        return (
          <div key="acciones-masivas" className="pt-0.5">
            <button
              type="button"
              onClick={handleAccionesMasivasToggle}
              title={
                isCollapsed
                  ? 'ACCIONES MASIVAS (Importar Proveedores, Productos, Clientes y Edición Masiva)'
                  : undefined
              }
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-bold tracking-wide transition-colors cursor-pointer ${
                activeSection === 'acciones-masivas'
                  ? 'bg-[#FF6600] text-white shadow-sm'
                  : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Layers
                  className={`w-5 h-5 shrink-0 ${
                    activeSection === 'acciones-masivas'
                      ? 'text-white'
                      : 'text-[#FF6600]'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">
                    ACCIONES MASIVAS
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  {accionesMasivasExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-current opacity-80" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && accionesMasivasExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBulkAction?.('import-suppliers');
                      onCloseMobile();
                    }}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer text-left min-w-0"
                  >
                    <Truck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="truncate">Importar Proveedores</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadTemplate?.('suppliers')}
                    title="Descargar Plantilla Base de Proveedores"
                    className="p-1.5 rounded-md text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBulkAction?.('import-products');
                      onCloseMobile();
                    }}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer text-left min-w-0"
                  >
                    <Package className="w-3.5 h-3.5 shrink-0 text-[#FF6600]" />
                    <span className="truncate">Importar Productos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadTemplate?.('products')}
                    title="Descargar Plantilla Base de Productos"
                    className="p-1.5 rounded-md text-slate-400 hover:text-[#FF6600] hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBulkAction?.('import-clients');
                      onCloseMobile();
                    }}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer text-left min-w-0"
                  >
                    <Users className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="truncate">Importar Clientes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadTemplate?.('clients')}
                    title="Descargar Plantilla Base de Clientes"
                    className="p-1.5 rounded-md text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectBulkAction?.('bulk-editor');
                    handleNavClick('acciones-masivas');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                    activeSection === 'acciones-masivas'
                      ? 'bg-[#FF6600] text-white font-bold shadow-2xs'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeSection === 'acciones-masivas'
                        ? 'text-white'
                        : 'text-sky-400'
                    }`}
                  />
                  <span className="truncate">
                    Edición Masiva de Productos
                  </span>
                </button>
              </div>
            )}
          </div>
        );

      case 'reportes':
        if (!isSectionAllowedForRole('reportes', activeRole)) return null;
        return (
          <button
            key="reportes"
            type="button"
            onClick={() => handleNavClick('reportes')}
            title={isCollapsed ? 'Reportes' : undefined}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
            } py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeSection === 'reportes'
                ? 'bg-[#FF6600] text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <BarChart3
                className={`w-5 h-5 shrink-0 ${
                  activeSection === 'reportes' ? 'text-white' : 'text-slate-400'
                }`}
              />
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">Reportes</span>
              )}
            </div>
          </button>
        );

      case 'configuracion':
        if (!isSectionAllowedForRole('configuracion', activeRole)) return null;
        return (
          <div key="configuracion" className="pt-0.5">
            <button
              type="button"
              onClick={handleConfiguracionToggle}
              title={
                isCollapsed
                  ? 'Configuración (Usuarios y Roles, Paneles y Menú, Empresa y ARCA, Impresoras y Plantillas)'
                  : undefined
              }
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === 'configuracion'
                  ? 'bg-[#FF6600] text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Settings
                  className={`w-5 h-5 shrink-0 ${
                    activeSection === 'configuracion'
                      ? 'text-white'
                      : 'text-slate-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">
                    Configuración
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  {configuracionExpanded ? (
                    <ChevronDown className="w-4 h-4 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-current opacity-80" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && configuracionExpanded && (
              <div className="mt-1 ml-3.5 pl-2.5 border-l border-slate-800 space-y-1">
                {(
                  [
                    {
                      id: 'usuarios-rbac' as AdminCenterTab,
                      label: '👤 Usuarios y Roles',
                    },
                    {
                      id: 'paneles-menu' as AdminCenterTab,
                      label: '🖥️ Paneles y Menú',
                    },
                    {
                      id: 'empresa-fiscal' as AdminCenterTab,
                      label: '🏢 Empresa y ARCA',
                    },
                    {
                      id: 'impresion-envios' as AdminCenterTab,
                      label: '🖨️ Impresoras y Plantillas',
                    },
                    {
                      id: 'seguridad-sistema' as AdminCenterTab,
                      label: '🛡️ Seguridad / Sistema',
                    },
                  ]
                ).map((subItem) => {
                  const isSubActive =
                    activeSection === 'configuracion' &&
                    activeConfigSubTab === subItem.id;
                  return (
                    <button
                      key={subItem.id}
                      type="button"
                      onClick={() => {
                        onSelectConfigQuickAction?.(subItem.id);
                        handleNavClick('configuracion');
                        if (typeof window !== 'undefined') {
                          window.history.pushState({}, '', '/configuracion');
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                        isSubActive
                          ? 'bg-[#FF6600] text-white font-bold shadow-2xs'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{subItem.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'movil':
        return (
          <div key="movil" className="pt-1">
            <div className="my-2 border-t border-slate-800/80" />
            <button
              type="button"
              onClick={handleMovilToggle}
              title={
                isCollapsed
                  ? 'MÓVIL (Aplicaciones y Descargas PWA)'
                  : undefined
              }
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
              } py-2.5 rounded-xl text-sm font-extrabold transition-colors cursor-pointer border ${
                movilExpanded
                  ? 'bg-slate-900 border-[#FF6600]/60 text-white'
                  : 'bg-slate-900/70 border-slate-800 text-amber-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Smartphone className="w-5 h-5 shrink-0 text-[#FF6600]" />
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap tracking-wider">
                    MÓVIL
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#FF6600]/20 text-[#FF6600] text-[10px] font-mono font-bold">
                    PWA
                  </span>
                  {movilExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              )}
            </button>

            {!isCollapsed && movilExpanded && (
              <div className="mt-1.5 ml-3 pl-2.5 border-l-2 border-[#FF6600]/50 space-y-2.5">
                {/* SUBMENÚ 1: APLICACIONES */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setMovilAppsExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <span>APLICACIONES</span>
                    {movilAppsExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>

                  {movilAppsExpanded && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenScannerApp?.('stock');
                          onCloseMobile();
                        }}
                        title="/escaner-app"
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-900/90 hover:bg-[#FF6600] text-slate-200 hover:text-white transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <QrCode className="w-4 h-4 shrink-0 text-[#FF6600] group-hover:text-white" />
                          <span className="truncate">Stock Móvil Rápido</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenScannerApp?.('supplier_order');
                          onCloseMobile();
                        }}
                        title="/pedido-rapido-movil"
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-900/90 hover:bg-[#FF6600] text-slate-200 hover:text-white transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Truck className="w-4 h-4 shrink-0 text-amber-400 group-hover:text-white" />
                          <span className="truncate">Pedido Rápido Móvil</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenScannerApp?.('mini_pos');
                          onCloseMobile();
                        }}
                        title="/movil/presupuesto-rapido"
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-900/90 hover:bg-[#FF6600] text-slate-200 hover:text-white transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ShoppingCart className="w-4 h-4 shrink-0 text-emerald-400 group-hover:text-white" />
                          <span className="truncate">
                            Presupuesto Rápido Móvil
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* SUBMENÚ 2: DESCARGAS */}
                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setMovilDescargasExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <span>DESCARGAS</span>
                    {movilDescargasExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-amber-500/80" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500/80" />
                    )}
                  </button>

                  {movilDescargasExpanded && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (onInstallMobileApp) {
                            onInstallMobileApp('stock');
                          } else {
                            onOpenScannerApp?.('stock');
                          }
                          onCloseMobile();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-900/60 hover:bg-[#FF6600] border border-slate-800 hover:border-[#FF6600] text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Download className="w-3.5 h-3.5 shrink-0 text-[#FF6600] group-hover:text-white" />
                          <span className="truncate">
                            Descargar Stock Móvil Rápido
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onInstallMobileApp) {
                            onInstallMobileApp('supplier_order');
                          } else {
                            onOpenScannerApp?.('supplier_order');
                          }
                          onCloseMobile();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-900/60 hover:bg-[#FF6600] border border-slate-800 hover:border-[#FF6600] text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Download className="w-3.5 h-3.5 shrink-0 text-amber-400 group-hover:text-white" />
                          <span className="truncate">
                            Descargar Pedido Rápido Móvil
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onInstallMobileApp) {
                            onInstallMobileApp('mini_pos');
                          } else {
                            onOpenScannerApp?.('mini_pos');
                          }
                          onCloseMobile();
                        }}
                        title="/movil/presupuesto-rapido"
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-900/60 hover:bg-[#FF6600] border border-slate-800 hover:border-[#FF6600] text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Download className="w-3.5 h-3.5 shrink-0 text-emerald-400 group-hover:text-white" />
                          <span className="truncate">
                            Descargar Presupuesto Rápido Móvil
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const orderedTabs: SidebarMenuTabId[] =
    adminConfig.sidebarMenuOrder && adminConfig.sidebarMenuOrder.length > 0
      ? adminConfig.sidebarMenuOrder.map((t) => t.id)
      : [
          'punto-de-venta',
          'caja',
          'ventas',
          'ventas-devoluciones',
          'clientes',
          'proveedores',
          'productos',
          'reportes',
          'configuracion',
          'movil',
        ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-12 flex items-center justify-between px-3.5 border-b border-slate-800/90 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('inicio')}
          title="Ir al Panel General (Inicio)"
          className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[#FF6600] rounded-lg overflow-hidden cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-[#FF6600] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Wrench className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-tight text-white truncate">
                {adminConfig.companyFiscal?.fantasyName || 'FERRETERIA DEL PUENTE'}
              </span>
            </div>
          )}
        </button>

        {/* Desktop collapse button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List — Orden Configurable y Módulo CAJA */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            handleNavClick('inicio');
          }}
          title={isCollapsed ? 'Dashboard Principal' : undefined}
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
          } py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            activeSection === 'inicio'
              ? 'bg-[#FF6600] text-white shadow-sm'
              : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <BarChart3
              className={`w-5 h-5 shrink-0 ${
                activeSection === 'inicio' ? 'text-white' : 'text-[#FF6600]'
              }`}
            />
            {!isCollapsed && (
              <span className="truncate whitespace-nowrap">Dashboard</span>
            )}
          </div>
        </button>
        {orderedTabs.map((tabId) => renderTabItem(tabId))}
      </nav>

      {/* Pie del Menú Lateral Limpio (Sin botones de Descargas ni Stock Móvil Rápido) */}
      <div className="p-2 border-t border-slate-800/90 shrink-0 bg-slate-950/70">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`w-full hidden lg:flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer`}
        >
          {!isCollapsed && (
            <span className="whitespace-nowrap">Contraer panel lateral</span>
          )}
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 shrink-0" />
          ) : (
            <PanelLeftClose className="w-4 h-4 shrink-0" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ease-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}
    </>
  );
};
