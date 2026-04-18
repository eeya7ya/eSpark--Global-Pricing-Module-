import { calculateRow, calculateTotals, type Constants, type ProductInput, type TotalsRow } from "./calculations";

interface Row extends ProductInput {
  id: number;
  position: number;
}

function N(v: number, decimals = 3) {
  return v.toFixed(decimals);
}

// ─── CSV Export ────────────────────────────────────────────────────────────────

export function exportToCsv(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string,
  targetCurrency = "JOD",
  responsiblePerson?: string | null
) {
  const calculated = rows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);
  const cur = targetCurrency;

  const headers = [
    "#",
    "Item Model",
    "USD Price /unit",
    "USD Price Total",
    "Qty",
    `${cur} Price /unit`,
    `${cur} Price Total`,
    "Shipping /unit",
    "Shipping Total",
    "Customs /unit",
    "Customs Total",
    "Landed Cost /unit",
    "Landed Cost Total",
    "Profit /unit",
    "Profit Total",
    "Pre-Tax Price /unit",
    "Pre-Tax Price Total",
    "Tax /unit",
    "Tax Total",
    "Final Price /unit",
    "Final Price Total",
  ];

  const dataRows = calculated.map((row) => [
    row.position,
    `"${row.itemModel.replace(/"/g, '""')}"`,
    N(row.priceUsd),
    N(row.usdTotal),
    row.quantity,
    N(row.jodPrice),
    N(row.jodPriceTotal),
    N(row.shipping),
    N(row.shippingTotal),
    N(row.customs),
    N(row.customsTotal),
    N(row.landedCost),
    N(row.landedCostTotal),
    N(row.profit),
    N(row.profitTotal),
    N(row.preTaxPrice),
    N(row.preTaxPriceTotal),
    N(row.tax),
    N(row.taxTotal),
    N(row.finalPrice),
    N(row.finalPriceTotal),
  ]);

  const totalRow = [
    "",
    "TOTALS",
    "",
    N(totals.usdTotal),
    "",
    "",
    N(totals.jodPriceTotal),
    "",
    N(totals.shippingTotal),
    "",
    N(totals.customsTotal),
    "",
    N(totals.landedCostTotal),
    "",
    N(totals.profitTotal),
    "",
    N(totals.preTaxPriceTotal),
    "",
    N(totals.taxTotal),
    "",
    N(totals.finalPriceTotal),
  ];

  const constantsBlock = [
    [""],
    ["Settings"],
    [`Currency Rate,${constants.currencyRate}`],
    [`Shipping Rate,${(constants.shippingRate * 100).toFixed(2)}%`],
    [`Customs Rate,${(constants.customsRate * 100).toFixed(2)}%`],
    [`Profit Margin,${(constants.profitMargin * 100).toFixed(2)}%`],
    [`Tax Rate,${(constants.taxRate * 100).toFixed(2)}%`],
  ];

  const csvLines = [
    `"${manufacturerName} – ${projectName}"`,
    ...(responsiblePerson ? [`"Responsible: ${responsiblePerson}"`] : []),
    `"Exported: ${new Date().toLocaleString()}"`,
    "",
    headers.join(","),
    ...dataRows.map((r) => r.join(",")),
    totalRow.join(","),
    ...constantsBlock.map((r) => r.join(",")),
  ];

  const csv = csvLines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${manufacturerName}-${projectName}-${new Date().toISOString().slice(0, 10)}.csv`
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Analysis sections for print (shown BELOW the main table) ─────────────────

function buildChartsHtml(totals: TotalsRow, cur: string): string {
  const fmt3 = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const rev = totals.finalPriceTotal;
  const marginPct = rev > 0 ? ((totals.profitTotal / rev) * 100).toFixed(1) : "0.0";
  const costPct = rev > 0 ? ((totals.landedCostTotal / rev) * 100).toFixed(1) : "0.0";

  // KPI cards — bigger + brand-forward
  const kpis = [
    { label: "Total Revenue",      value: `${fmt3(rev)} ${cur}`,                      color: "#0891b2" },
    { label: "Total Landed Cost",  value: `${fmt3(totals.landedCostTotal)} ${cur}`,    color: "#ea580c" },
    { label: "Gross Profit",       value: `${fmt3(totals.profitTotal)} ${cur}`,         color: "#16a34a" },
    { label: "Net Margin",         value: `${marginPct}%`,                              color: "#6366f1" },
  ];

  const kpiHtml = kpis
    .map(
      (k) => `
      <div style="flex:1;min-width:150px;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px;background:#fff;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">${k.label}</div>
        <div style="font-size:18px;font-weight:700;color:${k.color};letter-spacing:-0.02em;">${k.value}</div>
      </div>`
    )
    .join("");

  // Horizontal stacked composition bar
  const segments = [
    { label: `${cur} Base`, value: totals.jodPriceTotal,  color: "#d97706" },
    { label: "Shipping",     value: totals.shippingTotal,  color: "#2563eb" },
    { label: "Customs",      value: totals.customsTotal,   color: "#7c3aed" },
    { label: "Profit",       value: totals.profitTotal,    color: "#16a34a" },
    { label: "Tax",          value: totals.taxTotal,       color: "#e11d48" },
  ];

  const barSegments = segments
    .map((s) => {
      const pct = rev > 0 ? ((s.value / rev) * 100).toFixed(2) : "0";
      return `<div title="${s.label}: ${fmt3(s.value)} ${cur} (${pct}%)" style="width:${pct}%;background:${s.color};height:100%;"></div>`;
    })
    .join("");

  const legendItems = segments
    .map((s) => {
      const pct = rev > 0 ? ((s.value / rev) * 100).toFixed(1) : "0.0";
      return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:10px;color:#475569;margin-right:16px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.color};"></span>
          ${s.label} <strong style="color:#0f172a;font-size:11px;">${pct}%</strong>
          <span style="color:#94a3b8;">(${fmt3(s.value)} ${cur})</span>
        </span>`;
    })
    .join("");

  // Breakdown table — absolute + percent per component
  const breakdown = [
    { label: `${cur} Base`,     value: totals.jodPriceTotal,  color: "#d97706" },
    { label: "Shipping",        value: totals.shippingTotal,  color: "#2563eb" },
    { label: "Customs",         value: totals.customsTotal,   color: "#7c3aed" },
    { label: "Landed Cost",     value: totals.landedCostTotal, color: "#ea580c", bold: true },
    { label: "Profit",          value: totals.profitTotal,    color: "#16a34a" },
    { label: "Pre-Tax Revenue", value: totals.preTaxPriceTotal, color: "#0d9488" },
    { label: "Tax",             value: totals.taxTotal,       color: "#e11d48" },
    { label: "Final Revenue",   value: totals.finalPriceTotal, color: "#0891b2", bold: true },
  ];
  const breakdownRows = breakdown
    .map((b) => {
      const pct = rev > 0 ? ((b.value / rev) * 100).toFixed(2) : "0.00";
      return `<tr ${b.bold ? 'style="background:#f1f5f9;"' : ""}>
        <td style="padding:6px 10px;border-top:1px solid #e2e8f0;font-size:10px;${b.bold ? "font-weight:700;" : ""}">
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${b.color};margin-right:6px;vertical-align:middle;"></span>
          ${b.label}
        </td>
        <td style="padding:6px 10px;border-top:1px solid #e2e8f0;font-size:10px;text-align:right;font-family:'Courier New',monospace;color:${b.color};${b.bold ? "font-weight:700;" : ""}">
          ${fmt3(b.value)} ${cur}
        </td>
        <td style="padding:6px 10px;border-top:1px solid #e2e8f0;font-size:10px;text-align:right;color:#64748b;${b.bold ? "font-weight:700;" : ""}">
          ${pct}%
        </td>
      </tr>`;
    })
    .join("");

  return `
  <div class="analysis-block">
    <div class="analysis-title">Analysis Summary</div>

    <!-- KPI row -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">${kpiHtml}</div>

    <!-- Composition bar -->
    <div style="border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:14px 18px;margin-bottom:14px;page-break-inside:avoid;">
      <div style="font-size:11px;color:#0f172a;margin-bottom:10px;font-weight:600;">Revenue Composition</div>
      <div style="font-size:9.5px;color:#64748b;margin-bottom:10px;">How each cost + margin component contributes to the final price.</div>
      <div style="display:flex;width:100%;height:26px;border-radius:6px;overflow:hidden;margin-bottom:12px;border:1px solid #e2e8f0;">${barSegments}</div>
      <div style="line-height:1.8;">${legendItems}</div>
    </div>

    <!-- Breakdown table + narrative -->
    <div style="display:flex;gap:14px;flex-wrap:wrap;page-break-inside:avoid;">
      <div style="flex:1.3;min-width:320px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;overflow:hidden;">
        <div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#0f172a;">
          Cost &amp; Revenue Breakdown
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:6px 10px;font-size:9px;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.08em;">Component</th>
              <th style="padding:6px 10px;font-size:9px;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.08em;">Amount</th>
              <th style="padding:6px 10px;font-size:9px;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.08em;">% of Revenue</th>
            </tr>
          </thead>
          <tbody>${breakdownRows}</tbody>
        </table>
      </div>

      <div style="flex:1;min-width:240px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:14px 16px;">
        <div style="font-size:11px;font-weight:600;color:#0f172a;margin-bottom:8px;">Key Observations</div>
        <ul style="margin:0;padding-left:16px;font-size:10px;color:#475569;line-height:1.7;">
          <li>Landed cost represents <strong style="color:#ea580c;">${costPct}%</strong> of final revenue.</li>
          <li>Net margin after tax lands at <strong style="color:#6366f1;">${marginPct}%</strong>.</li>
          <li>Gross profit before tax totals <strong style="color:#16a34a;">${fmt3(totals.profitTotal)} ${cur}</strong>.</li>
          <li>Tax obligation totals <strong style="color:#e11d48;">${fmt3(totals.taxTotal)} ${cur}</strong>.</li>
        </ul>
      </div>
    </div>
  </div>`;
}

// ─── Print / PDF Export ────────────────────────────────────────────────────────

export function exportToPrint(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string,
  targetCurrency = "JOD",
  responsiblePerson?: string | null
) {
  const cur = targetCurrency;
  const activeRows = rows.filter((r) => r.priceUsd > 0 && r.itemModel);
  const calculated = rows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);
  const chartsHtml = activeRows.length > 0 ? buildChartsHtml(totals, cur) : "";

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const colGroups = [
    { label: `${cur} Price`, unit: "jodPrice", total: "jodPriceTotal", color: "#d97706" },
    { label: "Shipping", unit: "shipping", total: "shippingTotal", color: "#2563eb" },
    { label: "Customs", unit: "customs", total: "customsTotal", color: "#7c3aed" },
    { label: "Landed Cost", unit: "landedCost", total: "landedCostTotal", color: "#ea580c", highlight: true },
    { label: "Profit", unit: "profit", total: "profitTotal", color: "#059669" },
    { label: "Pre-Tax", unit: "preTaxPrice", total: "preTaxPriceTotal", color: "#0d9488" },
    { label: "Tax", unit: "tax", total: "taxTotal", color: "#e11d48" },
    { label: "Final Price", unit: "finalPrice", total: "finalPriceTotal", color: "#0891b2", highlight: true },
  ];

  const headerCells = colGroups
    .map(
      (c) =>
        `<th colspan="2" class="col-header${c.highlight ? " col-highlight" : ""}" style="color:${c.color};">${c.label}</th>`
    )
    .join("");

  const subHeaderCells = colGroups
    .map(
      () =>
        `<th class="col-sub">/unit</th><th class="col-sub col-sub-r">total</th>`
    )
    .join("");

  const dataRows = calculated
    .map((row, idx) => {
      const cells = colGroups
        .map(
          (c) => `
        <td class="num${c.highlight ? " col-hl" : ""}" style="color:${c.color};">
          ${row.priceUsd ? fmt((row as any)[c.unit]) : "—"}
        </td>
        <td class="num total-cell${c.highlight ? " col-hl" : ""}">
          ${row.priceUsd ? fmt((row as any)[c.total]) : "—"}
        </td>`
        )
        .join("");
      return `<tr class="${idx % 2 === 1 ? "row-alt" : ""}">
        <td class="num center">${row.position}</td>
        <td class="model">${row.itemModel || "—"}</td>
        <td class="num">${fmt(row.priceUsd)}</td>
        <td class="num total-cell">${row.priceUsd ? fmt(row.usdTotal) : "—"}</td>
        <td class="num center">${row.quantity}</td>
        ${cells}
      </tr>`;
    })
    .join("");

  const totalCells = colGroups
    .map(
      (c) => `
    <td class="${c.highlight ? "col-hl" : ""}"></td>
    <td class="num total-cell font-bold${c.highlight ? " col-hl total-highlight" : ""}">
      ${fmt((totals as any)[c.total])}
    </td>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${manufacturerName} – ${projectName}</title>
  <style>
    /* ── Page setup ── */
    @page {
      size: A4 landscape;
      margin: 12mm 10mm 12mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 9px;
      color: #1e293b;
      background: #fff;
      width: 100%;
    }

    /* ── Print-specific overrides ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break-before { page-break-before: always; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      .analysis-block { page-break-before: always; }
    }

    /* ── Layout ── */
    .page { padding: 0; width: 100%; }

    /* ── Header band (project name + manufacturer + meta) ── */
    .header-band {
      background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
      border-radius: 12px;
      padding: 16px 22px;
      margin-bottom: 14px;
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .eyebrow {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      opacity: 0.85;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 6px;
    }
    .project-line {
      font-size: 14px;
      font-weight: 600;
      opacity: 0.98;
      line-height: 1.3;
    }
    .sub-meta {
      font-size: 10px;
      opacity: 0.88;
      margin-top: 6px;
      line-height: 1.55;
    }
    .meta-right {
      text-align: right;
      font-size: 10px;
      opacity: 0.9;
      line-height: 1.6;
    }
    .meta-right strong { font-size: 13px; display:block; margin-bottom: 2px; }

    /* ── Settings grid ── */
    .settings-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 6px;
    }
    .settings {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .setting-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .setting-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
      font-weight: 600;
    }
    .setting-value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .setting-value small {
      font-size: 9px;
      color: #64748b;
      font-weight: 500;
      margin-left: 2px;
    }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #e2e8f0; padding: 4px 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    th { background: #f8fafc; font-weight: 600; font-size: 8.5px; text-align: center; color: #64748b; }
    .col-header { font-size: 8.5px; text-align: center; background: #f8fafc; }
    .col-highlight { background: #f1f5f9 !important; }
    .col-sub { font-size: 7.5px; color: #94a3b8; text-align: center; background: #fafafa; }
    .col-sub-r { }
    th:first-child { width: 22px; }
    th.model-col { width: 110px; text-align: left; }
    th.usd-col { width: 54px; }
    th.qty-col { width: 30px; }
    td, th { font-size: 8.5px; }
    td.num { text-align: right; font-family: "Courier New", monospace; font-size: 8px; }
    td.center { text-align: center; }
    td.model { text-align: left; font-size: 8.5px; color: #1e293b; }
    td.col-hl { background: #fafafa; }
    td.total-cell { color: #64748b; }
    td.total-highlight { color: #0891b2 !important; font-weight: 700; }
    td.font-bold { font-weight: 700; }
    .row-alt td { background: #fafafa; }
    .row-alt td.col-hl { background: #f4f6f8; }

    /* ── Totals row ── */
    tfoot tr { background: #f1f5f9; }
    tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; }

    /* ── Analysis block (below tables) ── */
    .analysis-block { margin-top: 18px; }
    .analysis-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
      padding-bottom: 6px;
      margin-bottom: 12px;
      border-bottom: 2px solid #6366f1;
      display: inline-block;
    }

    /* ── Footer ── */
    .footer { margin-top: 14px; font-size: 8.5px; color: #94a3b8; text-align: center; }

    /* ── Print button (screen only) ── */
    .print-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      color: #fff; border: none; border-radius: 9999px;
      padding: 10px 22px; font-size: 13px; font-weight: 600; cursor: pointer;
      margin-bottom: 16px;
      box-shadow: 0 6px 18px rgba(99,102,241,0.25);
    }
    .print-btn:hover { box-shadow: 0 8px 26px rgba(99,102,241,0.4); }
  </style>
</head>
<body>
  <div class="page">
    <button class="print-btn no-print" onclick="window.print()">🖨 Print / Save as PDF</button>

    <!-- Header band — project & manufacturer, clearly readable at the top -->
    <div class="header-band">
      <div>
        <div class="eyebrow">eSpark · Global Pricing Module</div>
        <div class="title">${manufacturerName}</div>
        <div class="project-line">Project: ${projectName}</div>
        <div class="sub-meta">
          ${responsiblePerson ? `Responsible: <strong>${responsiblePerson}</strong> &nbsp;·&nbsp; ` : ""}Currency: <strong>${cur}</strong> &nbsp;·&nbsp; Rate: 1 USD = ${constants.currencyRate} ${cur}
        </div>
      </div>
      <div class="meta-right">
        <strong>${calculated.length}</strong> product line${calculated.length !== 1 ? "s" : ""}<br/>
        Exported: ${new Date().toLocaleString()}
      </div>
    </div>

    <!-- Constants — prominent grid -->
    <div class="settings-title">Pricing Constants</div>
    <div class="settings">
      <div class="setting-card">
        <div class="setting-label">Currency Rate</div>
        <div class="setting-value">${constants.currencyRate} <small>${cur}/USD</small></div>
      </div>
      <div class="setting-card">
        <div class="setting-label">Shipping</div>
        <div class="setting-value">${(constants.shippingRate * 100).toFixed(2)}% <small>of local price</small></div>
      </div>
      <div class="setting-card">
        <div class="setting-label">Customs</div>
        <div class="setting-value">${(constants.customsRate * 100).toFixed(2)}% <small>of local+ship</small></div>
      </div>
      <div class="setting-card">
        <div class="setting-label">Profit Margin</div>
        <div class="setting-value">${(constants.profitMargin * 100).toFixed(2)}% <small>on landed</small></div>
      </div>
      <div class="setting-card">
        <div class="setting-label">Tax Rate</div>
        <div class="setting-value">${(constants.taxRate * 100).toFixed(2)}% <small>on pre-tax</small></div>
      </div>
    </div>

    <!-- Main pricing table -->
    <table>
      <colgroup>
        <col style="width:22px">
        <col style="width:110px">
        <col style="width:48px">
        <col style="width:54px">
        <col style="width:28px">
        ${colGroups.map(() => `<col style="width:52px"><col style="width:58px">`).join("")}
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">#</th>
          <th rowspan="2" class="model-col" style="text-align:left;">Item Model</th>
          <th colspan="2" class="col-header" style="color:#16a34a;">USD Price</th>
          <th rowspan="2" class="qty-col">Qty</th>
          ${headerCells}
        </tr>
        <tr>
          <th class="col-sub">/unit</th>
          <th class="col-sub col-sub-r">total</th>
          ${subHeaderCells}
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align:left;font-size:9px;font-weight:700;color:#1e293b;padding:5px 8px;">TOTALS</td>
          <td></td>
          <td class="num total-cell font-bold">${fmt(totals.usdTotal)}</td>
          <td></td>
          ${totalCells}
        </tr>
      </tfoot>
    </table>

    <!-- Analysis block — sits BELOW the main table on its own page -->
    ${chartsHtml}

    <div class="footer">Generated by eSpark · Global Pricing Module &nbsp;·&nbsp; ${new Date().toLocaleDateString()} &nbsp;·&nbsp; All amounts in ${cur}</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
