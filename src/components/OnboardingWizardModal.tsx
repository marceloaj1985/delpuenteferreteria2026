import React, { useState, useEffect } from 'react';
import {
  Building2,
  Package,
  Users,
  Truck,
  Wallet,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Sparkles,
  X,
  Plus,
  Check,
  Unlock,
} from 'lucide-react';
import {
  Branch,
  ClientItem,
  ProductItem,
  SupplierItem,
} from '../types/ferreteria.ts';
import {
  SystemAdminConfig,
  loadSystemAdminConfig,
  saveSystemAdminConfig,
} from './UsersRolesModule.tsx';
import {
  isCashRegisterOpenOrInitialized,
  openInitialCashShiftFromWizard,
} from './CashRegisterModule.tsx';

export type OnboardingStepNumber = 1 | 2 | 3 | 4;

interface OnboardingWizardModalProps {
  isOpen: boolean;
  initialStep?: OnboardingStepNumber;
  onClose: () => void;
  products: ProductItem[];
  clients: ClientItem[];
  suppliers: SupplierItem[];
  branches: Branch[];
  activeOperatorName: string;
  formatCurrency: (val: string | number) => string;
  onProductsUpdated: (next: ProductItem[], msg?: string) => void;
  onClientsUpdated: (next: ClientItem[], msg?: string) => void;
  onSuppliersUpdated: (next: SupplierItem[], msg?: string) => void;
  onBranchesUpdated?: (next: Branch[]) => void;
  onAdminConfigUpdated?: (next: SystemAdminConfig, msg?: string) => void;
  onOpenBulkImport: (mode: 'products' | 'suppliers') => void;
  onNavigateSection?: (
    sec: 'inicio' | 'punto-de-venta' | 'caja' | 'productos' | 'clientes'
  ) => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  initialStep = 1,
  onClose,
  products,
  clients,
  suppliers,
  activeOperatorName,
  formatCurrency,
  onProductsUpdated,
  onClientsUpdated,
  onSuppliersUpdated,
  onBranchesUpdated,
  onAdminConfigUpdated,
  onOpenBulkImport,
  onNavigateSection,
}) => {
  const [step, setStep] = useState<OnboardingStepNumber>(initialStep);
  const [adminConfig, setAdminConfig] = useState<SystemAdminConfig>(() =>
    loadSystemAdminConfig()
  );

  // Estado Paso 1: Datos del Negocio
  const [fantasyName, setFantasyName] = useState(
    adminConfig.companyFiscal.fantasyName || 'FERRETERIA DEL PUENTE'
  );
  const [legalName, setLegalName] = useState(
    adminConfig.companyFiscal.legalName || 'Ferretería del Puente S.R.L.'
  );
  const [cuit, setCuit] = useState(
    adminConfig.companyFiscal.cuit || '30-71458920-9'
  );
  const [taxCondition, setTaxCondition] = useState(
    adminConfig.companyFiscal.taxCondition || 'IVA Responsable Inscripto'
  );
  const [address, setAddress] = useState(
    adminConfig.companyFiscal.address || 'Av. San Martín 1450, Buenos Aires'
  );
  const [phone, setPhone] = useState(
    adminConfig.companyFiscal.phone || '+54 9 11 4582-9100'
  );
  const [logoDataUrl, setLogoDataUrl] = useState(
    adminConfig.companyFiscal.logoDataUrl || ''
  );
  const [step1Saved, setStep1Saved] = useState(false);
  const [isSavingStep1, setIsSavingStep1] = useState(false);

  // Estado Paso 2: Primer Producto / Catálogo Base
  const [prodSku, setProdSku] = useState('ART-0001');
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Herramientas Eléctricas');
  const [prodBrand, setProdBrand] = useState('Genérica');
  const [prodCost, setProdCost] = useState('');
  const [prodSale, setProdSale] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Estado Paso 3: Primer Cliente y Primer Proveedor
  const [cliName, setCliName] = useState('');
  const [cliCuit, setCliCuit] = useState('');
  const [cliTaxCondition, setCliTaxCondition] = useState('Consumidor Final');
  const [cliPhone, setCliPhone] = useState('');
  const [cliPriceList, setCliPriceList] = useState('Efectivo / Contado');
  const [isSavingClient, setIsSavingClient] = useState(false);

  const [supName, setSupName] = useState('');
  const [supCuit, setSupCuit] = useState('');
  const [supCategory, setSupCategory] = useState('Ferretería General');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Estado Paso 4: Primera Apertura de Caja
  const [shiftName, setShiftName] = useState<
    'Turno Mañana' | 'Turno Tarde' | 'Turno Completo'
  >('Turno Mañana');
  const [openingCash, setOpeningCash] = useState('50000');
  const [openingNotes, setOpeningNotes] = useState(
    'Apertura inicial de puesta en marcha del sistema'
  );
  const [cashOpened, setCashOpened] = useState<boolean>(() =>
    isCashRegisterOpenOrInitialized()
  );

  useEffect(() => {
    if (isOpen) {
      const freshCfg = loadSystemAdminConfig();
      setAdminConfig(freshCfg);
      setFantasyName(freshCfg.companyFiscal.fantasyName || 'FERRETERIA DEL PUENTE');
      setLegalName(freshCfg.companyFiscal.legalName || 'Ferretería del Puente S.R.L.');
      setCuit(freshCfg.companyFiscal.cuit || '30-71458920-9');
      setTaxCondition(
        freshCfg.companyFiscal.taxCondition || 'IVA Responsable Inscripto'
      );
      setAddress(
        freshCfg.companyFiscal.address || 'Av. San Martín 1450, Buenos Aires'
      );
      setPhone(freshCfg.companyFiscal.phone || '+54 9 11 4582-9100');
      setLogoDataUrl(freshCfg.companyFiscal.logoDataUrl || '');
      setCashOpened(isCashRegisterOpenOrInitialized());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Guardar Paso 1 (Datos del Negocio)
  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStep1(true);
    try {
      const updatedCfg: SystemAdminConfig = {
        ...adminConfig,
        companyFiscal: {
          ...adminConfig.companyFiscal,
          fantasyName: fantasyName.trim() || 'MI COMERCIO / FERRETERÍA',
          legalName:
            legalName.trim() || fantasyName.trim() || 'Mi Comercio S.R.L.',
          cuit: cuit.trim() || '30-00000000-0',
          taxCondition: taxCondition.trim() || 'IVA Responsable Inscripto',
          address: address.trim() || 'Dirección Comercial Central',
          phone: phone.trim() || '-',
          logoDataUrl,
        },
      };
      saveSystemAdminConfig(updatedCfg);
      setAdminConfig(updatedCfg);
      setStep1Saved(true);

      const res = await fetch('/api/system/company-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: updatedCfg.companyFiscal.fantasyName,
          cuit: updatedCfg.companyFiscal.cuit,
          address: updatedCfg.companyFiscal.address,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.branches) && onBranchesUpdated) {
          onBranchesUpdated(data.branches);
        }
      }

      onAdminConfigUpdated?.(
        updatedCfg,
        `Paso 1 completado: Datos de "${updatedCfg.companyFiscal.fantasyName}" guardados.`
      );
      setStep(2);
    } catch {
      setStep(2);
    } finally {
      setIsSavingStep1(false);
    }
  };

  // Paso 2A: Crear Primer Producto Manualmente
  const handleCreateFirstProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    setIsSavingProduct(true);
    try {
      const costVal = Math.max(0, parseFloat(prodCost) || 0);
      const saleVal =
        parseFloat(prodSale) > 0
          ? parseFloat(prodSale)
          : Math.round(costVal * 1.5);
      const stockVal = Math.max(0, parseInt(prodStock, 10) || 0);

      const res = await fetch('/api/products/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              sku: prodSku.trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}`,
              name: prodName.trim(),
              category: prodCategory.trim() || 'General',
              brand: prodBrand.trim() || 'Genérica',
              supplierName: suppliers[0]?.name || 'Proveedor General',
              costPrice: costVal.toFixed(2),
              ivaRate: '21.00',
              salePrice: saleVal.toFixed(2),
              trackStock: true,
              stock: stockVal,
              minStock: Math.max(2, Math.floor(stockVal / 3)),
              suggestedStock: Math.max(10, stockVal * 2),
              status: 'Activo',
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.products)) {
        onProductsUpdated(
          data.products,
          `Producto "${prodName.trim()}" agregado al inventario.`
        );
        setProdName('');
        setProdSku(`ART-000${data.products.length + 1}`);
        setProdCost('');
        setProdSale('');
      }
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Paso 2B: Cargar Catálogo Base de Prueba (3 Artículos Ferreteros)
  const handleLoadStarterCatalog = async () => {
    setIsSavingProduct(true);
    try {
      const starterItems = [
        {
          sku: 'TAL-750W-PRO',
          name: 'Taladro Percutor Profesional 13mm 750W',
          category: 'Herramientas Eléctricas',
          brand: 'Bosch',
          supplierName: suppliers[0]?.name || 'Proveedor Ferretero Central',
          costPrice: '85000.00',
          ivaRate: '21.00',
          salePrice: '127500.00',
          trackStock: true,
          stock: 12,
          minStock: 4,
          suggestedStock: 15,
          status: 'Activo',
        },
        {
          sku: 'AMO-900W-IND',
          name: 'Amoladora Angular 4 1/2" 900W Industrial',
          category: 'Herramientas Eléctricas',
          brand: 'DeWalt',
          supplierName: suppliers[0]?.name || 'Proveedor Ferretero Central',
          costPrice: '92000.00',
          ivaRate: '21.00',
          salePrice: '138000.00',
          trackStock: true,
          stock: 8,
          minStock: 3,
          suggestedStock: 12,
          status: 'Activo',
        },
        {
          sku: 'CIN-MET-5M',
          name: 'Cinta Métrica Profesional 5 Metros Con Freno',
          category: 'Herramientas Manuales',
          brand: 'Stanley',
          supplierName: suppliers[0]?.name || 'Proveedor Ferretero Central',
          costPrice: '9500.00',
          ivaRate: '21.00',
          salePrice: '14900.00',
          trackStock: true,
          stock: 25,
          minStock: 8,
          suggestedStock: 30,
          status: 'Activo',
        },
      ];
      const res = await fetch('/api/products/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: starterItems }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.products)) {
        onProductsUpdated(
          data.products,
          'Catálogo base inicial (3 artículos) cargado correctamente.'
        );
      }
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Paso 3A: Crear Primer Cliente
  const handleCreateFirstClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliName.trim()) return;
    setIsSavingClient(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cliName.trim(),
          cuit: cliCuit.trim() || '00-00000000-0',
          taxCondition: cliTaxCondition,
          phone: cliPhone.trim() || '-',
          email: '-',
          balance: '0.00',
          priceList: cliPriceList,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.clients)) {
        onClientsUpdated(
          data.clients,
          `Primer cliente "${cliName.trim()}" registrado en cartera.`
        );
        setCliName('');
        setCliCuit('');
        setCliPhone('');
      }
    } finally {
      setIsSavingClient(false);
    }
  };

  // Paso 3B: Crear Primer Proveedor
  const handleCreateFirstSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    setIsSavingSupplier(true);
    try {
      const res = await fetch('/api/suppliers/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              name: supName.trim(),
              cuit: supCuit.trim() || '30-00000000-0',
              category: supCategory.trim() || 'Ferretería General',
              contactPhone: supPhone.trim() || '-',
              email: supEmail.trim() || 'ventas@proveedor.com.ar',
              balance: '0.00',
              status: 'Al día',
              lastPriceUpdate: 'Registrado en puesta en marcha',
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.suppliers)) {
        onSuppliersUpdated(
          data.suppliers,
          `Primer proveedor "${supName.trim()}" registrado en el padrón.`
        );
        setSupName('');
        setSupCuit('');
        setSupPhone('');
        setSupEmail('');
      }
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // Paso 4: Realizar Primera Apertura de Caja y Finalizar
  const handleOpenFirstCashRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, parseFloat(openingCash) || 0);
    openInitialCashShiftFromWizard({
      shiftName,
      operatorName: activeOperatorName,
      openingBalance: amount,
      notes: openingNotes,
    });
    setCashOpened(true);

    const completedCfg: SystemAdminConfig = {
      ...adminConfig,
      onboardingWizardCompleted: true,
    };
    saveSystemAdminConfig(completedCfg);
    setAdminConfig(completedCfg);
    onAdminConfigUpdated?.(
      completedCfg,
      `¡Primera Apertura de Caja realizada (${formatCurrency(
        amount
      )})! Sistema listo para operar.`
    );
    onClose();
    onNavigateSection?.('punto-de-venta');
  };

  const step1Done =
    step1Saved ||
    Boolean(
      adminConfig.companyFiscal.fantasyName &&
        adminConfig.companyFiscal.cuit
    );
  const step2Done = products.length > 0;
  const step3Done = clients.length > 0 && suppliers.length > 0;
  const step4Done = cashOpened;

  const completedStepsCount = [
    step1Done,
    step2Done,
    step3Done,
    step4Done,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ENCABEZADO DEL ASISTENTE */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#FF6600]/20 text-[#FF6600] border border-[#FF6600]/40 font-mono text-[10px] font-extrabold uppercase tracking-wider">
                  Asistente de Primeros Pasos
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {completedStepsCount}/4 completados
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
                Puesta en Marcha Inicial del Sistema
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Minimizar asistente (puede reabrirlo desde Configuración)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEPPER INTERACTIVO DE 4 PASOS */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                {
                  num: 1 as OnboardingStepNumber,
                  title: 'Paso 1: Negocio',
                  subtitle: 'Nombre, CUIT y Logo',
                  done: step1Done,
                  icon: Building2,
                },
                {
                  num: 2 as OnboardingStepNumber,
                  title: 'Paso 2: Inventario',
                  subtitle: `Productos (${products.length})`,
                  done: step2Done,
                  icon: Package,
                },
                {
                  num: 3 as OnboardingStepNumber,
                  title: 'Paso 3: Agenda',
                  subtitle: `Clientes (${clients.length}) / Prov. (${suppliers.length})`,
                  done: step3Done,
                  icon: Users,
                },
                {
                  num: 4 as OnboardingStepNumber,
                  title: 'Paso 4: Caja',
                  subtitle: step4Done ? 'Caja Abierta' : 'Primera Apertura',
                  done: step4Done,
                  icon: Wallet,
                },
              ]
            ).map((s) => {
              const IconComp = s.icon;
              const isCurrent = step === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-white border-[#FF6600] ring-2 ring-[#FF6600]/20 shadow-2xs'
                      : s.done
                      ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50'
                      : 'bg-white border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-black ${
                      isCurrent
                        ? 'bg-[#FF6600] text-white'
                        : s.done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {s.done ? (
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <IconComp className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {s.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CUERPO DEL PASO ACTIVO */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* ==============================================================
              PASO 1: CONFIGURAR DATOS DEL NEGOCIO (NOMBRE, CUIT, DIRECCIÓN, LOGO)
             ============================================================== */}
          {step === 1 && (
            <form onSubmit={handleSaveStep1} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Paso 1: Configurar Datos del Negocio
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estos datos aparecerán en el encabezado del sistema, presupuestos PDF, facturas y tickets térmicos.
                  </p>
                </div>
                {step1Saved && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Datos Guardados</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
                <div className="sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre Comercial / Fantasía *
                  </label>
                  <input
                    type="text"
                    required
                    value={fantasyName}
                    onChange={(e) => setFantasyName(e.target.value)}
                    placeholder="Ej: FERRETERÍA CENTRAL"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">
                    Razón Social / Titular Fiscal
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Ej: Ferretería Central S.R.L."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    CUIT del Negocio *
                  </label>
                  <input
                    type="text"
                    required
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    placeholder="30-71458920-9"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    Condición frente al IVA
                  </label>
                  <select
                    value={taxCondition}
                    onChange={(e) => setTaxCondition(e.target.value)}
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

                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    Teléfono / WhatsApp Comercial
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+54 9 11 4582-9100"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-7">
                  <label className="block font-bold text-slate-700 mb-1">
                    Dirección Comercial / Sucursal Principal *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. San Martín 1450, Localidad, Provincia"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block font-bold text-slate-700 mb-1">
                    Logo del Negocio (Opcional)
                  </label>
                  <div className="flex items-center gap-3">
                    {logoDataUrl ? (
                      <img
                        src={logoDataUrl}
                        alt="Logo comercio"
                        className="w-10 h-10 rounded-lg object-contain border border-slate-200 bg-white p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                    )}
                    <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#FF6600]" />
                      <span>Subir Logo (PNG/JPG)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingStep1}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  <span>
                    {isSavingStep1
                      ? 'Guardando...'
                      : 'Guardar Datos del Negocio y Continuar al Paso 2'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ==============================================================
              PASO 2: CARGAR / IMPORTAR PRIMER PRODUCTO O CATÁLOGO BASE
             ============================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Paso 2: Cargar o Importar Primer Producto / Catálogo Base
                  </h3>
                  <p className="text-xs text-slate-500">
                    Agregue su primer artículo manualmente, importe una planilla Excel/CSV o cargue un lote de prueba.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold border ${
                    products.length > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{products.length} productos en Inventario</span>
                </span>
              </div>

              {/* Acciones Rápidas de Importación Masiva o Catálogo Base */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      Importar Catálogo desde Excel / CSV
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Suba su lista de artículos con SKU, costos, precios y stock.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenBulkImport('products')}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>Importar Excel</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      ¿Desea probar rápido el sistema?
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Cargue 3 artículos de muestra para probar el Punto de Venta.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingProduct}
                    onClick={handleLoadStarterCatalog}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cargar 3 Artículos Base</span>
                  </button>
                </div>
              </div>

              {/* Formulario de Alta Rápida del Primer Producto */}
              <form
                onSubmit={handleCreateFirstProduct}
                className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs"
              >
                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#FF6600]" />
                  <span>Cargar Primer Producto Manualmente</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Código / SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodSku}
                      onChange={(e) => setProdSku(e.target.value)}
                      placeholder="ART-0001"
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nombre / Descripción del Artículo *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="Ej: Martillo Galponero Cabo Fibra 27mm"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">
                      Rubro / Categoría
                    </label>
                    <input
                      type="text"
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      placeholder="Herramientas Manuales"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Marca
                    </label>
                    <input
                      type="text"
                      value={prodBrand}
                      onChange={(e) => setProdBrand(e.target.value)}
                      placeholder="Ej: Bahco / Stanley"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Precio Costo ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={prodCost}
                      onChange={(e) => {
                        setProdCost(e.target.value);
                        const c = parseFloat(e.target.value);
                        if (Number.isFinite(c) && c > 0) {
                          setProdSale(String(Math.round(c * 1.5)));
                        }
                      }}
                      placeholder="10000"
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Precio Venta ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={prodSale}
                      onChange={(e) => setProdSale(e.target.value)}
                      placeholder="15000"
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Stock Inicial *
                    </label>
                    <input
                      type="number"
                      required
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingProduct}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {isSavingProduct
                        ? 'Guardando artículo...'
                        : 'Agregar Producto al Inventario'}
                    </span>
                  </button>
                </div>
              </form>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Paso 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  <span>Continuar al Paso 3 (Clientes y Proveedores)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              PASO 3: CARGAR PRIMER CLIENTE Y PROVEEDOR
             ============================================================== */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Paso 3: Cargar Primer Cliente y Primer Proveedor
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registre al menos su primer cliente comercial y su primer proveedor para habilitar compras y cuentas corrientes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      clients.length > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    Clientes: {clients.length}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      suppliers.length > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    Proveedores: {suppliers.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Columna A: Primer Cliente */}
                <form
                  onSubmit={handleCreateFirstClient}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#FF6600]" />
                      <span>A. Registrar Primer Cliente</span>
                    </div>
                    {clients.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Listo
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nombre / Razón Social del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={cliName}
                      onChange={(e) => setCliName(e.target.value)}
                      placeholder="Ej: Constructora del Sur S.R.L. / Consumidor Final"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        CUIT / DNI
                      </label>
                      <input
                        type="text"
                        value={cliCuit}
                        onChange={(e) => setCliCuit(e.target.value)}
                        placeholder="30-70984512-3"
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Condición IVA
                      </label>
                      <select
                        value={cliTaxCondition}
                        onChange={(e) => setCliTaxCondition(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      >
                        <option value="Consumidor Final">Consumidor Final</option>
                        <option value="Responsable Inscripto">
                          Responsable Inscripto
                        </option>
                        <option value="Monotributo">Monotributo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Teléfono / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={cliPhone}
                        onChange={(e) => setCliPhone(e.target.value)}
                        placeholder="+54 9 11 4400-0000"
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Lista de Precios
                      </label>
                      <select
                        value={cliPriceList}
                        onChange={(e) => setCliPriceList(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      >
                        <option value="Efectivo / Contado">
                          Efectivo / Contado
                        </option>
                        <option value="Mayorista / Gremio">
                          Mayorista / Gremio
                        </option>
                        <option value="Cuenta Corriente">
                          Cuenta Corriente
                        </option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingClient}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>
                      {isSavingClient ? 'Guardando...' : 'Guardar Primer Cliente'}
                    </span>
                  </button>
                </form>

                {/* Columna B: Primer Proveedor */}
                <form
                  onSubmit={handleCreateFirstSupplier}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-slate-900 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#FF6600]" />
                      <span>B. Registrar Primer Proveedor</span>
                    </div>
                    {suppliers.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Listo
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Razón Social del Proveedor *
                    </label>
                    <input
                      type="text"
                      required
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="Ej: Distribuidora Ferretera S.A."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        CUIT Proveedor
                      </label>
                      <input
                        type="text"
                        value={supCuit}
                        onChange={(e) => setSupCuit(e.target.value)}
                        placeholder="30-50123456-7"
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Rubro Principal
                      </label>
                      <input
                        type="text"
                        value={supCategory}
                        onChange={(e) => setSupCategory(e.target.value)}
                        placeholder="Herramientas y Bulonería"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Teléfono Contacto
                      </label>
                      <input
                        type="text"
                        value={supPhone}
                        onChange={(e) => setSupPhone(e.target.value)}
                        placeholder="+54 11 4700-1100"
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Email Pedidos
                      </label>
                      <input
                        type="email"
                        value={supEmail}
                        onChange={(e) => setSupEmail(e.target.value)}
                        placeholder="pedidos@proveedor.com.ar"
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingSupplier}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>
                      {isSavingSupplier
                        ? 'Guardando...'
                        : 'Guardar Primer Proveedor'}
                    </span>
                  </button>
                </form>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Paso 2</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  <span>Continuar al Paso 4 (Primera Apertura de Caja)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              PASO 4: REALIZAR LA PRIMERA APERTURA DE CAJA
             ============================================================== */}
          {step === 4 && (
            <form onSubmit={handleOpenFirstCashRegister} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Paso 4: Realizar la Primera Apertura de Caja
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina el turno inicial y el fondo fijo de efectivo en mostrador para comenzar a registrar ventas y cobros.
                  </p>
                </div>
                {cashOpened && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Caja Abierta</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    Turno de Caja *
                  </label>
                  <select
                    value={shiftName}
                    onChange={(e) =>
                      setShiftName(
                        e.target.value as
                          | 'Turno Mañana'
                          | 'Turno Tarde'
                          | 'Turno Completo'
                      )
                    }
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="Turno Mañana">Turno Mañana</option>
                    <option value="Turno Tarde">Turno Tarde</option>
                    <option value="Turno Completo">Turno Completo</option>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    Operador / Cajero Responsable
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={activeOperatorName}
                    className="w-full px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">
                    Saldo Inicial / Cambio en Efectivo (ARS) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    required
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="50000"
                    className="w-full px-3 py-2.5 font-mono font-extrabold text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="block font-bold text-slate-700 mb-1">
                    Observación de Apertura
                  </label>
                  <input
                    type="text"
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Paso 3</span>
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black uppercase tracking-wide shadow-md cursor-pointer transition-all"
                >
                  <Unlock className="w-4 h-4" />
                  <span>
                    Realizar Primera Apertura de Caja y Comenzar a Operar
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
