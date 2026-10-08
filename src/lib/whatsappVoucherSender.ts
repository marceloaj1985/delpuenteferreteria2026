import { jsPDF } from 'jspdf';

/**
 * Interfaz de datos del comprobante de venta para el envío por WhatsApp
 */
export interface SaleVoucherWhatsAppPayload {
  docNumber: string;
  docType?: string;
  clientName: string;
  clientPhone: string;
  totalAmount?: number | string;
  issueDate?: string;
  items?: Array<{
    sku?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * ============================================================================
 * 1. LIMPIEZA Y FORMATEO INTERNACIONAL DE TELÉFONO PARA WHATSAPP (wa.me)
 * ============================================================================
 * Elimina espacios, guiones, paréntesis, corchetes, puntos, el signo "+"
 * y ceros iniciales de código de área ("011" -> "11") o prefijos locales ("15"),
 * devolviendo estrictamente dígitos en formato internacional (ej: "5491123456789").
 */
export function cleanPhoneForWhatsApp(
  rawPhone: string,
  defaultCountryCode = '549'
): string {
  if (!rawPhone) return '';

  // Paso 1: Eliminar espacios, guiones, paréntesis, corchetes, signo "+" y cualquier carácter no numérico
  let digits = rawPhone.replace(/\D/g, '');

  // Paso 2: Eliminar prefijo internacional "00" si el usuario escribió "0054..."
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Paso 3: Eliminar ceros iniciales del código de área nacional (ej: "011 4567-8901" -> "1145678901")
  digits = digits.replace(/^0+/, '');

  if (!digits) return '';

  // Paso 4: Normalización inteligente para números de Argentina (54 / 549)
  // Si empieza con "54" pero le falta el "9" móvil (ej: 541123456789 -> 5491123456789)
  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
    digits = `549${digits.slice(2)}`;
  }

  // Si es un número local de 10 dígitos sin código de país (ej: 1123456789 o 3512345678)
  if (digits.length === 10 && !digits.startsWith('54')) {
    digits = `${defaultCountryCode}${digits}`;
  }

  // Si incluye el prefijo local "15" después del código de área (ej: 111523456789 -> 5491123456789)
  if (digits.length === 12 && !digits.startsWith('54') && digits.slice(2, 4) === '15') {
    digits = `${defaultCountryCode}${digits.slice(0, 2)}${digits.slice(4)}`;
  }

  return digits;
}

/**
 * ============================================================================
 * 2. GUARDADO DEL COMPROBANTE PDF Y OBTENCIÓN DE URL PÚBLICA DE DESCARGA
 * ============================================================================
 * Recibe un PDF ya generado (en Base64 / DataURI) o genera uno al vuelo con jsPDF,
 * lo sube al endpoint del servidor (/api/public-pdfs) y retorna la URL pública
 * accesible directamente por el cliente desde WhatsApp.
 */
export async function savePdfAndGetPublicUrl(
  voucher: SaleVoucherWhatsAppPayload,
  existingPdfBase64?: string
): Promise<{ publicPdfUrl: string; filename: string }> {
  const safeDocNumber = String(voucher.docNumber || '0001-00000001').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const filename = `Comprobante_${safeDocNumber}.pdf`;

  // Si no se pasó un PDF pre-renderizado, generamos el comprobante PDF con jsPDF
  let pdfDataUri = existingPdfBase64;
  if (!pdfDataUri) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('FERRETERÍA DEL PUENTE - COMPROBANTE DE VENTA', 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Comprobante: ${voucher.docType || 'Factura B'} N° ${voucher.docNumber}`,
      14,
      26
    );
    doc.text(
      `Fecha: ${voucher.issueDate || new Date().toLocaleDateString('es-AR')}`,
      14,
      32
    );
    doc.text(`Cliente: ${voucher.clientName}`, 14, 38);
    doc.line(14, 42, 196, 42);

    let y = 50;
    if (Array.isArray(voucher.items) && voucher.items.length > 0) {
      doc.text('Cant.', 14, y);
      doc.text('Descripción', 35, y);
      doc.text('P. Unit.', 140, y);
      doc.text('Subtotal', 172, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      voucher.items.forEach((item) => {
        const sub = item.quantity * item.unitPrice;
        doc.text(String(item.quantity), 14, y);
        doc.text(String(item.name).slice(0, 48), 35, y);
        doc.text(`$${item.unitPrice.toLocaleString('es-AR')}`, 140, y);
        doc.text(`$${sub.toLocaleString('es-AR')}`, 172, y);
        y += 7;
      });
      doc.line(14, y + 2, 196, y + 2);
      y += 10;
    }

    if (voucher.totalAmount !== undefined) {
      const formattedTotal =
        typeof voucher.totalAmount === 'number'
          ? `$${voucher.totalAmount.toLocaleString('es-AR', {
              minimumFractionDigits: 2,
            })}`
          : String(voucher.totalAmount);
      doc.setFontSize(12);
      doc.text(`TOTAL: ${formattedTotal}`, 14, y);
    }

    pdfDataUri = doc.output('datauristring');
  }

  // Subir el PDF al servidor para exponerlo en una URL pública de descarga
  const fallbackUrl = `${window.location.origin}/api/public-pdfs/${encodeURIComponent(
    filename
  )}`;

  try {
    const response = await fetch('/api/public-pdfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        pdfBase64: pdfDataUri,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.publicUrl) {
        // Asegurar URL absoluta con protocolo + dominio
        const fullUrl = data.publicUrl.startsWith('http')
          ? data.publicUrl
          : `${window.location.origin}${data.publicUrl}`;
        return { publicPdfUrl: fullUrl, filename };
      }
    }
  } catch (error) {
    console.error('Error al alojar el PDF público:', error);
  }

  return { publicPdfUrl: fallbackUrl, filename };
}

/**
 * ============================================================================
 * 3. ARMADO Y APERTURA DEL ENLACE PÚBLICO DE WHATSAPP (https://wa.me/...)
 * ============================================================================
 * Construye el mensaje personalizado con el nombre del cliente y la URL pública
 * del comprobante PDF, aplica URL Encoding (encodeURIComponent) y abre el enlace
 * https://wa.me/NUMERO?text=MENSAJE en una nueva pestaña del navegador.
 */
export function buildAndOpenWhatsAppVoucherLink(params: {
  phone: string;
  clientName: string;
  pdfUrl: string;
  docNumber?: string;
  docType?: string;
  subtotalOriginalFormatted?: string;
  discountAppliedFormatted?: string;
  discountLabel?: string;
  totalFormatted?: string;
  itemsSummaryLines?: string[];
  openInNewTab?: boolean;
}): {
  cleanedPhone: string;
  message: string;
  waMeUrl: string;
} {
  const cleanedPhone = cleanPhoneForWhatsApp(params.phone);

  // Construir el cuerpo del mensaje para el cliente con desglose transparente de descuentos
  const lines = [
    `Hola *${params.clientName || 'Cliente'}* 👋,`,
    `Te enviamos tu comprobante de *FERRETERÍA DEL PUENTE*:`,
    '',
    params.docNumber
      ? `📄 *${params.docType || 'Comprobante'}:* N° ${params.docNumber}`
      : null,
    ...(params.itemsSummaryLines && params.itemsSummaryLines.length > 0
      ? ['', '*DETALLE DE PRODUCTOS:*', ...params.itemsSummaryLines, '']
      : []),
    params.subtotalOriginalFormatted
      ? `💵 *Subtotal Original:* ${params.subtotalOriginalFormatted}`
      : null,
    params.discountAppliedFormatted
      ? `🏷️ *Descuento Aplicado${params.discountLabel ? ` (${params.discountLabel})` : ''}:* -${params.discountAppliedFormatted}`
      : null,
    params.totalFormatted
      ? `💰 *TOTAL FINAL A PAGAR:* ${params.totalFormatted}`
      : null,
    '',
    `📥 *Descargá tu comprobante en PDF aquí:*`,
    params.pdfUrl,
    '',
    `¡Muchas gracias por tu compra!`,
  ].filter((line): line is string => line !== null);

  const message = lines.join('\n');

  // Aplicar URL Encoding estricto al texto del mensaje
  const encodedMessage = encodeURIComponent(message);

  // Construir la URL oficial wa.me con el número limpio (solo dígitos)
  const waMeUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;

  // Abrir en una pestaña nueva del navegador de forma segura
  if (params.openInNewTab !== false && typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = waMeUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return {
    cleanedPhone,
    message,
    waMeUrl,
  };
}

/**
 * ============================================================================
 * 4. FUNCIÓN INTEGRAL LISTA PARA USAR EN EL FLUJO DE VENTAS
 * ============================================================================
 * Ejecuta todo el proceso en un solo paso:
 * 1) Limpia el teléfono, 2) Guarda el PDF y obtiene la URL pública,
 * 3) Arma el link https://wa.me/NUMERO?text=MENSAJE y lo abre en una nueva pestaña.
 */
export async function sendSaleVoucherViaWhatsApp(
  voucher: SaleVoucherWhatsAppPayload,
  existingPdfBase64?: string
): Promise<{
  cleanedPhone: string;
  publicPdfUrl: string;
  waMeUrl: string;
}> {
  const { publicPdfUrl } = await savePdfAndGetPublicUrl(
    voucher,
    existingPdfBase64
  );

  const totalFormatted =
    voucher.totalAmount !== undefined
      ? typeof voucher.totalAmount === 'number'
        ? `$${voucher.totalAmount.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
          })}`
        : String(voucher.totalAmount)
      : undefined;

  const { cleanedPhone, waMeUrl } = buildAndOpenWhatsAppVoucherLink({
    phone: voucher.clientPhone,
    clientName: voucher.clientName,
    pdfUrl: publicPdfUrl,
    docNumber: voucher.docNumber,
    docType: voucher.docType,
    totalFormatted,
    openInNewTab: true,
  });

  return {
    cleanedPhone,
    publicPdfUrl,
    waMeUrl,
  };
}

/**
 * ============================================================================
 * 5. DATOS FICTICIOS LISTOS PARA PROBAR EL MÓDULO
 * ============================================================================
 */
export const MOCK_SALE_VOUCHER_FOR_WHATSAPP: SaleVoucherWhatsAppPayload = {
  docNumber: '0001-00004892',
  docType: 'Factura B',
  clientName: 'Constructora San Martín S.R.L.',
  clientPhone: '+54 (011) 15-6789-4321', // Se limpiará automáticamente a "5491167894321"
  totalAmount: 148500,
  issueDate: new Date().toLocaleDateString('es-AR'),
  items: [
    {
      sku: 'TAL-750W',
      name: 'Taladro Percutor Industrial 750W 13mm',
      quantity: 1,
      unitPrice: 98500,
    },
    {
      sku: 'DIS-115',
      name: 'Pack x10 Discos de Corte Diamantado 115mm',
      quantity: 2,
      unitPrice: 25000,
    },
  ],
};
