import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  LogOut,
  Menu,
  UserCheck,
  Check,
  ShieldCheck,
  Bell,
  AlertTriangle,
  Wifi,
  WifiOff,
  DollarSign,
  Server,
  Plus,
  User,
  RefreshCw,
  PackageCheck,
  Package,
} from 'lucide-react';
import { Branch, SellerProfile } from '../types/ferreteria.ts';
import {
  loadSystemAdminConfig,
  saveSystemAdminConfig,
  SystemAdminConfig,
} from './UsersRolesModule.tsx';

export interface UrgentNoteItem {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  read: boolean;
}

const URGENT_NOTES_STORAGE_KEY = 'ferreteria_urgent_notes_v2_clean';
const DOLLAR_RATE_STORAGE_KEY = 'ferreteria_dollar_rate_v1';

const DEFAULT_URGENT_NOTES: UrgentNoteItem[] = [];

function loadUrgentNotes(): UrgentNoteItem[] {
  if (typeof window === 'undefined') return DEFAULT_URGENT_NOTES;
  try {
    const raw = window.localStorage.getItem(URGENT_NOTES_STORAGE_KEY);
    if (!raw) return DEFAULT_URGENT_NOTES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_URGENT_NOTES;
  } catch {
    return DEFAULT_URGENT_NOTES;
  }
}

function saveUrgentNotes(notes: UrgentNoteItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(URGENT_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore storage errors
  }
}

interface TopBarProps {
  branches?: Branch[];
  selectedBranch?: Branch | null;
  onSelectBranch?: (branch: Branch) => void;
  seller: SellerProfile;
  operators?: SellerProfile[];
  onSelectSeller?: (seller: SellerProfile) => void;
  onOpenProfileSettings?: () => void;
  onOpenMobileMenu: () => void;
  onLogoutClick: () => void;
  onSwitchSellerClick: () => void;
  sectionBreadcrumb?: string;
  showPostSaleStockButton?: boolean;
  postSaleStockAdjustmentActive?: boolean;
  onTogglePostSaleStockAdjustment?: (nextActive: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  seller,
  operators = [],
  onSelectSeller,
  onOpenProfileSettings,
  onOpenMobileMenu,
  onLogoutClick,
  onSwitchSellerClick,
  showPostSaleStockButton,
  postSaleStockAdjustmentActive,
  onTogglePostSaleStockAdjustment,
}) => {
  // 1. Estado de Conexión a Internet en tiempo real
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // 2. Cotización del Dólar en tiempo real (editable con clic rápido)
  const [dollarRate, setDollarRate] = useState<number>(() => {
    if (typeof window === 'undefined') return 1250;
    const saved = Number(window.localStorage.getItem(DOLLAR_RATE_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 1250;
  });
  const [editingDollar, setEditingDollar] = useState<boolean>(false);
  const [dollarDraft, setDollarDraft] = useState<string>(String(dollarRate));

  // 3. Estado de Servicios ARCA / AFIP
  const [arcaStatus] = useState<'Operativo' | 'Con Demora'>('Operativo');

  // 4. Módulo de Notas Urgentes (Notificación Desplegable e Intermitente)
  const [urgentNotes, setUrgentNotes] = useState<UrgentNoteItem[]>(() =>
    loadUrgentNotes()
  );
  const [urgentDropdownOpen, setUrgentDropdownOpen] = useState<boolean>(false);
  const [showNewNoteForm, setShowNewNoteForm] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');

  // 5. Menú Desplegable de Usuario / Operador (Perfil / Cambiar Rol / Cerrar Sesión)
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);

  // 6. Estado sincronizado de Configuración para el botón "Ajuste Post-Venta: ACTIVO / INACTIVO"
  const [adminCfg, setAdminCfg] = useState<SystemAdminConfig>(() =>
    loadSystemAdminConfig()
  );

  const urgentMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncAdminCfg = () => setAdminCfg(loadSystemAdminConfig());
    window.addEventListener('ferreteria-config-updated', syncAdminCfg);
    window.addEventListener('storage', syncAdminCfg);
    return () => {
      window.removeEventListener('ferreteria-config-updated', syncAdminCfg);
      window.removeEventListener('storage', syncAdminCfg);
    };
  }, []);

  const isPostSaleButtonVisible =
    showPostSaleStockButton !== undefined
      ? showPostSaleStockButton
      : Boolean(adminCfg.showPostSaleStockButtonInTopBar);

  const isPostSaleAdjustmentActive =
    postSaleStockAdjustmentActive !== undefined
      ? postSaleStockAdjustmentActive
      : Boolean(adminCfg.postSaleStockAdjustmentActive);

  const handleTogglePostSaleActive = () => {
    const nextActive = !isPostSaleAdjustmentActive;
    const latest = loadSystemAdminConfig();
    const updated: SystemAdminConfig = {
      ...latest,
      postSaleStockAdjustmentActive: nextActive,
    };
    saveSystemAdminConfig(updated);
    setAdminCfg(updated);
    onTogglePostSaleStockAdjustment?.(nextActive);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    saveUrgentNotes(urgentNotes);
  }, [urgentNotes]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        urgentMenuRef.current &&
        !urgentMenuRef.current.contains(event.target as Node)
      ) {
        setUrgentDropdownOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notas urgentes no leídas activas
  const unreadUrgentNotes = urgentNotes.filter((n) => !n.read);
  const activeUnreadNote = unreadUrgentNotes[0] || null;

  // Marcar la nota urgente actual (o todas las activas) como leída y ocultar la alerta intermitente
  const handleAcceptAndMarkNoteAsRead = (noteId?: string) => {
    setUrgentNotes((prev) =>
      prev.map((note) => {
        if (!noteId || note.id === noteId) {
          return { ...note, read: true };
        }
        return note;
      })
    );
    if (unreadUrgentNotes.length <= 1 || !noteId) {
      setUrgentDropdownOpen(false);
    }
  };

  // Crear nueva Nota Urgente para el equipo
  const handleCreateUrgentNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const created: UrgentNoteItem = {
      id: `urg-${Date.now()}`,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      author: seller.name,
      createdAt: `Hoy · ${timeStr} hs`,
      read: false,
    };
    setUrgentNotes((prev) => [created, ...prev]);
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowNewNoteForm(false);
  };

  const handleSaveDollarRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(1, Number(dollarDraft.replace(/[^0-9.]/g, '')) || 1250);
    setDollarRate(parsed);
    setEditingDollar(false);
    try {
      window.localStorage.setItem(DOLLAR_RATE_STORAGE_KEY, String(parsed));
    } catch {
      // ignore
    }
  };

  return (
    <header className="h-12 bg-white border-b border-slate-200 px-3 lg:px-4 flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-30">
      {/* ZONA IZQUIERDA: Botón Menú Móvil + Bloque de Información en Tiempo Real (Dólar, Internet, ARCA/AFIP) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú de navegación"
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Bloque de Indicadores en Tiempo Real */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs overflow-x-auto">
          {/* 1. Cotización del Dólar */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {editingDollar ? (
              <form
                onSubmit={handleSaveDollarRate}
                className="inline-flex items-center gap-1"
              >
                <input
                  type="number"
                  value={dollarDraft}
                  onChange={(e) => setDollarDraft(e.target.value)}
                  onBlur={handleSaveDollarRate}
                  autoFocus
                  className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-[#FF6600] rounded text-slate-900 focus:outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDollarDraft(String(dollarRate));
                  setEditingDollar(true);
                }}
                title="Clic para actualizar cotización de referencia del Dólar"
                className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 cursor-pointer"
              >
                <span className="font-semibold text-slate-500">Dólar:</span>
                <span className="font-mono font-extrabold text-slate-900">
                  ${dollarRate.toLocaleString('es-AR')}
                </span>
              </button>
            )}
          </div>

          <span className="text-slate-300 select-none" aria-hidden="true">
            |
          </span>

          {/* 2. Estado de Conexión a Internet (Verde: En Línea / Rojo: Sin Conexión) */}
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title={
              isOnline
                ? 'Conexión a Internet activa y sincronizada'
                : 'Sin conexión a Internet'
            }
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-500' : 'bg-rose-600 animate-ping'
              }`}
            />
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0 hidden sm:inline" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-600 shrink-0 hidden sm:inline" />
            )}
            <span
              className={`font-bold ${
                isOnline ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {isOnline ? 'En Línea' : 'Sin Conexión'}
            </span>
          </div>

          <span className="text-slate-300 select-none" aria-hidden="true">
            |
          </span>

          {/* 3. Estado de Servicios ARCA / AFIP */}
          <div
            className="flex items-center gap-1.5 whitespace-nowrap"
            title="Estado de WebServices de Facturación Electrónica ARCA / AFIP"
          >
            <Server className="w-3.5 h-3.5 text-emerald-600 shrink-0 hidden md:inline" />
            <span className="font-semibold text-slate-500">ARCA:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>{arcaStatus}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ZONA DERECHA: Botón Ajuste Post-Venta (Opcional) + Módulo de Notas Urgentes + Menú de Usuario */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* BOTÓN DE AJUSTE DE STOCK POST-VENTA (Solo visible si está habilitado en Configuración -> Paneles y Menú) */}
        {isPostSaleButtonVisible && (
          <button
            type="button"
            onClick={handleTogglePostSaleActive}
            role="switch"
            aria-checked={isPostSaleAdjustmentActive}
            title={
              isPostSaleAdjustmentActive
                ? 'Ajuste de Stock Post-Venta ACTIVO: Luego de cada cobro en el POS se abrirá un cuadro para verificar/actualizar el stock real. Clic para desactivar.'
                : 'Ajuste de Stock Post-Venta INACTIVO: No se mostrará el cuadro de diálogo luego de vender. Clic para activar.'
            }
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition-all cursor-pointer ${
              isPostSaleAdjustmentActive
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 hover:bg-emerald-100/80 shadow-2xs'
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            {isPostSaleAdjustmentActive ? (
              <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Package className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span className="whitespace-nowrap">
              <span className="hidden md:inline">Ajuste Post-Venta: </span>
              <span
                className={
                  isPostSaleAdjustmentActive
                    ? 'text-emerald-700 font-black'
                    : 'text-slate-500 font-bold'
                }
              >
                {isPostSaleAdjustmentActive ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </span>
            <span
              className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                isPostSaleAdjustmentActive ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full bg-white shadow-2xs transition-transform ${
                  isPostSaleAdjustmentActive ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        )}

        {/* MÓDULO DE NOTAS URGENTES (Notificación Desplegable e Intermitente) */}
        <div className="relative" ref={urgentMenuRef}>
          {activeUnreadNote ? (
            /* Banner / Etiqueta Llamativa Rojo/Naranja con Parpadeo Intermitente cuando hay Nota Urgente Activa */
            <button
              type="button"
              onClick={() => setUrgentDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 via-[#FF6600] to-rose-600 text-white text-xs font-extrabold shadow-md ring-2 ring-rose-400/70 animate-pulse hover:animate-none cursor-pointer transition-all"
              title="Haga clic para leer la Nota Urgente activa"
            >
              <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-[230px]">
                ¡NOTA URGENTE!: {activeUnreadNote.title}
              </span>
              {unreadUrgentNotes.length > 1 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-950/40 font-mono text-[10px]">
                  +{unreadUrgentNotes.length - 1}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
          ) : (
            /* Botón discreto cuando todas las Notas Urgentes ya fueron leídas */
            <button
              type="button"
              onClick={() => setUrgentDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
              title="Notas Urgentes (Sin alertas pendientes)"
            >
              <Bell className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="hidden md:inline">Notas Urgentes</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          )}

          {/* Panel Desplegable de la Nota Urgente */}
          {urgentDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border-2 border-rose-500/80 shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-[#FF6600] text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Notas Urgentes de Operación
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewNoteForm((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[11px] font-bold text-white cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showNewNoteForm ? 'Cerrar' : 'Nueva Nota'}</span>
                </button>
              </div>

              {/* Formulario rápido para publicar una nueva Nota Urgente */}
              {showNewNoteForm && (
                <form
                  onSubmit={handleCreateUrgentNote}
                  className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2"
                >
                  <input
                    type="text"
                    required
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Título breve de la alerta urgente..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                  <textarea
                    rows={3}
                    required
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Detalle completo de la nota urgente para los operadores..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewNoteForm(false)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
                    >
                      Publicar Alerta Urgente
                    </button>
                  </div>
                </form>
              )}

              {/* Contenido de la Nota Urgente Activa o Estado Leído */}
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {activeUnreadNote ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-rose-950 leading-snug">
                          {activeUnreadNote.title}
                        </h4>
                        <span className="text-[10px] font-mono font-bold text-rose-700 shrink-0">
                          {activeUnreadNote.createdAt}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                        {activeUnreadNote.content}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-rose-200/70">
                        Enviado por:{' '}
                        <strong className="text-slate-700">
                          {activeUnreadNote.author}
                        </strong>
                      </div>
                    </div>

                    {/* Botón Destacado: Aceptar / Marcar como Leída */}
                    <button
                      type="button"
                      onClick={() =>
                        handleAcceptAndMarkNoteAsRead(activeUnreadNote.id)
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Aceptar / Marcar como Leída</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      No hay notas urgentes pendientes de lectura
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Todas las alertas urgentes fueron aceptadas y leídas.
                    </p>
                    {urgentNotes.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setUrgentNotes((prev) =>
                            prev.map((n, i) =>
                              i === 0 ? { ...n, read: false } : n
                            )
                          )
                        }
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6600] hover:underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Volver a activar última nota urgente</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MENÚ DESPLEGABLE DE USUARIO / OPERADOR (Único selector de perfil/rol/cierre de sesión) */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6600]"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {seller.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  {seller.name}
                </span>
                {seller.isGoogleAuthenticated ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                )}
              </div>
              <p className="hidden sm:block text-[10px] text-slate-500 whitespace-nowrap leading-none mt-0.5">
                {seller.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
          </button>

          {/* Dropdown de Opciones de Usuario (Perfil / Cambiar Rol / Cerrar Sesión) */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50">
              {/* Información del Operador Activo */}
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="text-xs font-extrabold text-slate-900">
                  {seller.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {seller.role} · {seller.email}
                </div>
              </div>

              {/* Cambio Rápido de Operador / Rol */}
              {operators.length > 0 && onSelectSeller && (
                <div className="py-1.5 border-b border-slate-100">
                  <div className="px-4 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Cambiar Operador / Rol Activo
                  </div>
                  {operators.map((op) => {
                    const isCurrent = op.name === seller.name;
                    return (
                      <button
                        key={op.email}
                        type="button"
                        onClick={() => {
                          onSelectSeller(op);
                          setUserMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-orange-50/80 text-[#FF6600] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate">{op.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {op.role}
                          </div>
                        </div>
                        {isCurrent && (
                          <Check className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Opciones de Perfil, Gestión de Turno y Cerrar Sesión */}
              <div className="py-1">
                {onOpenProfileSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenProfileSettings();
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mi Perfil y Permisos de Rol</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onSwitchSellerClick();
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Control de Turno / Cambiar Rol</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogoutClick();
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
