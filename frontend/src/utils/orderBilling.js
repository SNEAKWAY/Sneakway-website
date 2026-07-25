import { jsPDF } from "jspdf";
import { formatMoney } from "./adminFinance.js";

export const ORDER_TYPES = {
  retail: "retail",
  reselling: "reselling",
};

export const normalizeOrderType = (value) =>
  value === ORDER_TYPES.reselling
    ? ORDER_TYPES.reselling
    : ORDER_TYPES.retail;

export const normalizePhoneDigits = (phone) =>
  String(phone || "").replace(/\D/g, "");

/** Build WhatsApp-ready number (default India country code for 10-digit mobiles). */
export const toWhatsAppNumber = (phone) => {
  let digits = normalizePhoneDigits(phone);
  if (!digits) return "";
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
};

const buildInvoiceId = (orderId) => {
  const raw = String(orderId || Date.now());
  const short = raw.slice(-8).toUpperCase();
  return `SW-INV-${short}`;
};

const buildOrderNumber = (orderId) => {
  const raw = String(orderId || Date.now());
  return `SW-ORD-${raw.slice(-10)}`;
};

/** Invert blue-on-white logo so it reads cleanly on a white invoice page. */
const loadInvertedLogoDataUrl = async () => {
  try {
    const response = await fetch("/sneakway-logo-new.jpeg");
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        // Brand blue for artwork after invert (~#0d2aff)
        const inkR = 13;
        const inkG = 42;
        const inkB = 255;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isWhiteish = r > 200 && g > 200 && b > 200;
          const isBlueish = b > 140 && b > r + 20 && b > g + 20;

          if (isWhiteish) {
            data[i] = inkR;
            data[i + 1] = inkG;
            data[i + 2] = inkB;
            data[i + 3] = 255;
          } else if (isBlueish || (max - min > 30 && b >= r && b >= g)) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
};

export const generateOrderBillPdf = async (order) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const price = formatMoney(order.customerPrice);
  const name = order.customerName || "—";
  const orderId = order.id || `${Date.now()}`;
  const invoiceId = buildInvoiceId(orderId);
  const orderNumber = buildOrderNumber(orderId);
  const dateLabel = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  const logoDataUrl = await loadInvertedLogoDataUrl();

  // Header bar
  doc.setFillColor(248, 249, 252);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(0, 42, pageWidth, 42);

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 8, 26, 26);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SNEAKWAY", margin + (logoDataUrl ? 32 : 0), 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("TAX / RETAIL INVOICE", margin + (logoDataUrl ? 32 : 0), 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("INVOICE", pageWidth - margin, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(invoiceId, pageWidth - margin, 23, { align: "right" });
  doc.text(`Date: ${dateLabel}`, pageWidth - margin, 30, { align: "right" });

  // Meta box
  let y = 52;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "S");

  const col1 = margin + 6;
  const col2 = margin + contentWidth / 2 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("INVOICE ID", col1, y + 8);
  doc.text("ORDER NUMBER", col2, y + 8);
  doc.text("ORDER ID", col1, y + 20);
  doc.text("BILL DATE", col2, y + 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(invoiceId, col1, y + 13);
  doc.text(orderNumber, col2, y + 13);
  doc.text(String(orderId), col1, y + 25);
  doc.text(dateLabel, col2, y + 25);

  // Bill to
  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("BILL TO", margin, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const nameLines = doc.splitTextToSize(name, contentWidth);
  doc.text(nameLines, margin, y);
  y += nameLines.length * 6 + 4;

  if (order.customerPhone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${order.customerPhone}`, margin, y);
    y += 6;
  }

  // Table header
  y += 8;
  const tableTop = y;
  const rowH = 10;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, tableTop, contentWidth, rowH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("#", margin + 4, tableTop + 6.5);
  doc.text("DESCRIPTION", margin + 14, tableTop + 6.5);
  doc.text("AMOUNT (INR)", pageWidth - margin - 4, tableTop + 6.5, {
    align: "right",
  });

  // Line item
  y = tableTop + rowH;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 14, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("1", margin + 4, y + 9);
  doc.text("Shoes", margin + 14, y + 9);
  doc.setFont("helvetica", "bold");
  doc.text(`Rs. ${price}`, pageWidth - margin - 4, y + 9, { align: "right" });

  // Totals
  y += 22;
  const totalsX = pageWidth - margin - 70;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs. ${price}`, pageWidth - margin, y, { align: "right" });

  y += 7;
  doc.setTextColor(71, 85, 105);
  doc.text("Tax / Other", totalsX, y);
  doc.setTextColor(15, 23, 42);
  doc.text("Rs. 0", pageWidth - margin, y, { align: "right" });

  y += 5;
  doc.setDrawColor(226, 232, 240);
  doc.line(totalsX, y, pageWidth - margin, y);

  y += 8;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(totalsX - 4, y - 5, 74, 12, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", totalsX, y + 3);
  doc.text(`Rs. ${price}`, pageWidth - margin - 4, y + 3, { align: "right" });

  // Notes
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Notes", margin, y);
  y += 5;
  doc.setTextColor(71, 85, 105);
  doc.text(
    "This is a computer-generated retail invoice from Sneakway.",
    margin,
    y,
  );
  if (order.trackingId) {
    y += 5;
    doc.text(`Tracking reference: ${order.trackingId}`, margin, y);
  }

  // Signature + thank you footer
  const footerTop = pageHeight - 48;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, footerTop, pageWidth - margin, footerTop);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Sneakway", pageWidth - margin, footerTop + 12, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Digitally signed by Sneakway", pageWidth - margin, footerTop + 17, {
    align: "right",
  });
  doc.text(
    `Authorized invoice · ${invoiceId}`,
    pageWidth - margin,
    footerTop + 21,
    { align: "right" },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Thank you, Sneakway", pageWidth / 2, pageHeight - 18, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Curated sneakers for the street.", pageWidth / 2, pageHeight - 13, {
    align: "center",
  });

  const filename = `sneakway-invoice-${invoiceId}.pdf`;
  doc.save(filename);
  return filename;
};

export const openOrderWhatsApp = (order) => {
  const number = toWhatsAppNumber(order.customerPhone);
  if (!number) {
    throw new Error("Add a customer phone number to send on WhatsApp.");
  }

  const price = formatMoney(order.customerPrice);
  const name = order.customerName || "there";
  const invoiceId = buildInvoiceId(order.id);
  const message = [
    `Hi ${name},`,
    "",
    `Thank you for shopping with Sneakway.`,
    `Invoice: ${invoiceId}`,
    `Total: Rs. ${price}`,
    "",
    "Please find your bill attached.",
  ].join("\n");

  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return url;
};

export const sendRetailBillOnWhatsApp = async (order) => {
  if (normalizeOrderType(order.orderType) !== ORDER_TYPES.retail) {
    throw new Error("Bills are only generated for retail orders.");
  }
  if (!normalizePhoneDigits(order.customerPhone)) {
    throw new Error("Add a customer phone number to send the bill on WhatsApp.");
  }

  // Open WhatsApp first so the chat opens immediately on mobile.
  openOrderWhatsApp(order);

  // Generate/download the PDF shortly after so it does not interrupt WhatsApp.
  window.setTimeout(() => {
    generateOrderBillPdf(order).catch((error) => {
      console.error("Failed to generate bill PDF", error);
    });
  }, 400);
};
