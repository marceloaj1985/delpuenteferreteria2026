export type NavSectionId =
  | 'inicio'
  | 'punto-de-venta'
  | 'nuevo-presupuesto'
  | 'caja'
  | 'ventas-presupuestos'
  | 'ventas-facturas'
  | 'ventas-devoluciones'
  | 'ventas-remitos'
  | 'pago-cuenta-corriente'
  | 'facturar-compra'
  | 'movimientos-ventas'
  | 'proveedores'
  | 'precios'
  | 'acciones-masivas'
  | 'reportes'
  | 'mercado-libre'
  | 'clientes'
  | 'productos'
  | 'escaner-movil'
  | 'configuracion';

export interface Branch {
  id: number;
  name: string;
  companyName: string;
  cuit: string;
  address: string;
  pointOfSaleNumber: string;
  isActive: boolean;
}

export interface CommercialDocument {
  id: number;
  docType: string; // 'Presupuesto' | 'Factura A' | 'Factura B' | 'Remito'
  docNumber: string;
  clientName: string;
  clientCuit: string;
  branchName: string;
  sellerName: string;
  totalAmount: string;
  itemsCount: number;
  status: string; // 'Borrador' | 'Aceptado' | 'Emitido' | 'Pendiente' | 'Entregado' | 'Anulado'
  createdAt?: string;
}

export type BulkPackageUnit =
  | 'CAJA'
  | 'ROLLE'
  | 'BOBINA'
  | 'PACK'
  | 'PAQUETE'
  | 'BULTO'
  | 'PALLET'
  | 'BOLSA'
  | 'BALDE'
  | 'ROLLO'
  | 'BIDÓN'
  | 'TAMBOR'
  | 'ATADO'
  | 'UNIDAD';

export type BulkContentType = 'Unidades' | 'Metros' | 'Kilos' | 'Litros';

export interface ProductItem {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category: string;
  brand: string;
  supplierName: string;
  associatedSuppliers?: string[];
  costPrice: string;
  ivaRate: string;
  salePrice: string;
  cardPrice?: string;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  contentType?: BulkContentType;
  unitFractionalCost?: number;
  retailMarginPct?: number;
  trackStock: boolean;
  hadStock?: boolean;
  orderedQty?: number;
  stock: number;
  minStock: number;
  suggestedStock?: number;
  status: string;
  meliSynced: boolean;
  meliStatus: string;
}

export type ExpenseCategoryType =
  | 'Compra a Proveedor / Mercadería'
  | 'Servicios Básicos (Luz, Agua, Gas, Internet/Teléfono)'
  | 'Inmueble (Alquiler, Expensas, Tasas Municipales)'
  | 'Personal (Sueldos, Comisiones, Cargas Sociales)'
  | 'Vehículos / Logística (Patente, Seguro, Combustible, Cuota de Vehículo)'
  | 'Impuestos y Tasas (AFIP/ARCA, Ingresos Brutos)'
  | 'Gastos Varios / Operativos';

export type ExpenseRecurrenceFrequency = 'Mensual' | 'Bimensual' | 'Anual';

export interface TreasuryAccount {
  id: string;
  name: string;
  type: 'Caja Chica' | 'Cuenta Bancaria';
  balance: number;
  accountDetail: string;
}

export interface CashflowEntry {
  id: string;
  isoDate: string;
  formattedDate: string;
  type: 'Egreso' | 'Ingreso';
  category: ExpenseCategoryType | string;
  concept: string;
  beneficiary: string;
  accountId: string;
  accountName: string;
  paymentMethod: string;
  amount: number;
  docRef?: string;
}

export type SystemRoleType =
  | 'Super Administrador'
  | 'Administrador'
  | 'Vendedor'
  | 'Cajero'
  | 'Encargado de Stock';

export type EstadoCreditoCliente = 'Habilitado' | 'Excedido' | 'Bloqueado';

export interface ClientItem {
  id: number;
  name: string;
  razonSocial?: string;
  cuit: string;
  dni?: string;
  cuitCuil?: string;
  taxCondition: string;
  condicionIva?: string; // 'Responsable Inscripto' | 'Monotributo' | 'Exento' | 'Consumidor Final'
  phone: string;
  telefono?: string;
  whatsapp?: string;
  email: string;
  balance: string;
  saldoActual?: number;
  priceList: string;
  listaPreciosId?: string;
  direccion?: string;
  direccionFiscal?: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
  habilitaCuentaCorriente?: boolean;
  creditLimit?: number;
  limiteCredito?: number;
  paymentTermsDays?: number;
  plazoDiasPago?: number;
  estadoCredito?: EstadoCreditoCliente;
  notas?: string;
  observaciones?: string;
  oldestUnpaidDate?: string | null;
  totalPurchaseVolume?: number;
  onTimePaymentRate?: number;
}

export interface SupplierItem {
  id: number;
  name: string;
  cuit: string;
  category: string;
  contactPhone: string;
  email: string;
  address?: string;
  notes?: string;
  lastPriceUpdate: string;
  balance: string;
  status: string;
}

export interface SellerProfile {
  uid?: string;
  name: string;
  email: string;
  password?: string;
  status?: 'Activo' | 'Inactivo';
  role: string;
  systemRole?: SystemRoleType;
  branchId?: number;
  isGoogleAuthenticated?: boolean;
  defaultStartSection?: NavSectionId;
  customPermissions?: Record<string, boolean>;
}

export type Product = ProductItem & {
  code?: string;
  precioVenta?: number;
  precioCosto?: number;
};

export type Client = ClientItem;

export interface ScannerAuditLogItem {
  id: number;
  operatorName: string;
  actionType: string; // 'Carga de Stock' | 'Pedido a Proveedor' | 'Presupuesto Mini POS'
  actionDetail: string;
  referenceCode: string;
  targetName: string;
  branchName: string;
  createdAt?: string;
}



