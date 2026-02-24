import * as XLSX from 'xlsx';
import type {
    FaturaXmlExcelRow,
    FaturaXmlInvoice,
    FaturaXmlLineItem,
    FaturaXmlModuleData,
} from '../../common/types';

const SUPPORTED_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.xml']);

interface ArchiveHandle {
    extractFiles: () => Promise<Record<string, unknown>>;
}

interface ArchiveApi {
    init: (options?: Record<string, unknown>) => unknown;
    open: (file: File) => Promise<ArchiveHandle>;
}

let archiveApiPromise: Promise<ArchiveApi> | null = null;

const resolveAssetUrl = (assetPath: string): string => {
    const baseUri =
        typeof document !== 'undefined'
            ? document.baseURI
            : typeof location !== 'undefined'
              ? location.href
              : '';

    if (!baseUri) {
        return `./${assetPath}`;
    }

    return new URL(assetPath, baseUri).toString();
};

const resolveArchiveModuleUrl = (): string => resolveAssetUrl('fatura-xml/libarchive.js');

const resolveArchiveWorkerUrl = (): string => resolveAssetUrl('fatura-xml/worker-bundle.js');

export type ParsePhase = 'reading' | 'parsing' | 'excel' | 'done';

export interface ParseProgressState {
    phase: ParsePhase;
    percent: number;
    message: string;
    processedInvoices: number;
    processedItems: number;
}

export interface ParseFaturaXmlResult {
    invoices: FaturaXmlInvoice[];
    excelRows: FaturaXmlExcelRow[];
    invoiceCount: number;
    itemCount: number;
}

interface XmlSource {
    name: string;
    content: string;
}

const makeProgress = (
    phase: ParsePhase,
    percent: number,
    message: string,
    processedInvoices: number,
    processedItems: number,
): ParseProgressState => ({
    phase,
    percent: Math.max(0, Math.min(100, percent)),
    message,
    processedInvoices,
    processedItems,
});

const sanitizeInvoiceId = (value: string, index: number): string => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '');
    if (cleaned) return `inv_${index}_${cleaned}`;
    return `inv_${index}_${Date.now().toString(36)}`;
};

const toNumberOrString = (value: string): number | string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed;
    return trimmed;
};

const toDisplayString = (value: number | string): string => {
    if (typeof value === 'number') return value.toString();
    return value;
};

const formatIssueDate = (rawDate: string): string => {
    if (!rawDate.includes('-')) return rawDate;
    const parts = rawDate.split('-');
    if (parts.length !== 3) return rawDate;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const getLocalName = (nodeName: string): string => {
    if (!nodeName.includes(':')) return nodeName;
    const parts = nodeName.split(':');
    return parts[parts.length - 1];
};

type XmlRoot = Document | Element;

const getFirstElement = (xml: XmlRoot, tagName: string): Element | null => {
    const prefixed = xml.getElementsByTagName(tagName);
    if (prefixed.length > 0) return prefixed[0];

    const localName = getLocalName(tagName);
    const byNs = xml.getElementsByTagNameNS('*', localName);
    if (byNs.length > 0) return byNs[0];

    const plain = xml.getElementsByTagName(localName);
    if (plain.length > 0) return plain[0];

    return null;
};

const getElements = (xml: XmlRoot, tagName: string): Element[] => {
    const prefixed = Array.from(xml.getElementsByTagName(tagName));
    if (prefixed.length > 0) return prefixed;

    const localName = getLocalName(tagName);
    const byNs = Array.from(xml.getElementsByTagNameNS('*', localName));
    if (byNs.length > 0) return byNs;

    return Array.from(xml.getElementsByTagName(localName));
};

const getText = (xml: XmlRoot, tags: string | string[]): string => {
    const tagNames = Array.isArray(tags) ? tags : [tags];
    for (const tag of tagNames) {
        const element = getFirstElement(xml, tag);
        if (element?.textContent) {
            const value = element.textContent.trim();
            if (value) return value;
        }
    }
    return '';
};

const hasParserError = (xmlDoc: Document): boolean => xmlDoc.getElementsByTagName('parsererror').length > 0;

const decodeBase64Utf8 = (encoded: string): string => {
    const normalized = encoded.replace(/\s+/g, '').trim();
    if (!normalized) return '';

    try {
        const binary = atob(normalized);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        try {
            return atob(normalized);
        } catch {
            return '';
        }
    }
};

const isXsltAttachment = (referenceElement: Element, embeddedElement: Element): boolean => {
    const documentType = getText(referenceElement, ['cbc:DocumentType', 'DocumentType']).toLowerCase();
    const documentTypeCode = getText(referenceElement, ['cbc:DocumentTypeCode', 'DocumentTypeCode']).toLowerCase();
    const referenceId = getText(referenceElement, ['cbc:ID', 'ID']).toLowerCase();
    const fileName = (embeddedElement.getAttribute('filename') || '').toLowerCase();
    const mimeCode = (embeddedElement.getAttribute('mimeCode') || '').toLowerCase();

    return (
        documentType.includes('xsl') ||
        documentTypeCode.includes('xsl') ||
        referenceId.endsWith('.xsl') ||
        referenceId.endsWith('.xslt') ||
        fileName.endsWith('.xsl') ||
        fileName.endsWith('.xslt') ||
        mimeCode.includes('xsl')
    );
};

const extractEmbeddedXslt = (xmlDoc: Document): string => {
    const references = getElements(xmlDoc, 'cac:AdditionalDocumentReference');

    for (const reference of references) {
        const attachment = getFirstElement(reference, 'cac:Attachment') || getFirstElement(reference, 'Attachment');
        if (!attachment) continue;

        const embeddedDocument =
            getFirstElement(attachment, 'cbc:EmbeddedDocumentBinaryObject') ||
            getFirstElement(attachment, 'EmbeddedDocumentBinaryObject');
        if (!embeddedDocument?.textContent) continue;
        if (!isXsltAttachment(reference, embeddedDocument)) continue;

        const decoded = decodeBase64Utf8(embeddedDocument.textContent);
        if (decoded.includes('<xsl:stylesheet') || decoded.includes('<xsl:transform')) {
            return decoded;
        }
    }

    return '';
};

const generateOriginalInvoiceHtml = (xmlDoc: Document): string => {
    if (typeof XSLTProcessor === 'undefined') return '';

    const xsltContent = extractEmbeddedXslt(xmlDoc);
    if (!xsltContent) return '';

    const parser = new DOMParser();
    const xsltDoc = parser.parseFromString(xsltContent, 'text/xml');
    if (hasParserError(xsltDoc)) return '';

    try {
        const processor = new XSLTProcessor();
        processor.importStylesheet(xsltDoc);
        const transformed = processor.transformToDocument(xmlDoc);
        return new XMLSerializer().serializeToString(transformed);
    } catch {
        return '';
    }
};

const flattenXml = (
    node: Element,
    prefix = '',
    row: Record<string, string | number | null> = {},
): Record<string, string | number | null> => {
    const children = Array.from(node.children);
    if (children.length === 0) {
        const content = node.textContent?.trim();
        if (!content) return row;
        const shortText =
            content.length > 2000 ? `${content.slice(0, 2000)}... [uzun icerik kisaltildi]` : content;

        const key = prefix || getLocalName(node.nodeName);
        let uniqueKey = key;
        let count = 1;
        while (row[uniqueKey] !== undefined && row[uniqueKey] !== shortText) {
            count += 1;
            uniqueKey = `${key}_${count}`;
        }
        row[uniqueKey] = shortText;
        return row;
    }

    const countByTag: Record<string, number> = {};
    for (const child of children) {
        const localName = child.localName || getLocalName(child.nodeName);
        if (localName === 'InvoiceLine' && !prefix) {
            continue;
        }
        countByTag[localName] = (countByTag[localName] || 0) + 1;
        const countSuffix = countByTag[localName] > 1 ? `_${countByTag[localName]}` : '';
        const nextPrefix = prefix ? `${prefix}_${localName}${countSuffix}` : `${localName}${countSuffix}`;
        flattenXml(child, nextPrefix, row);
    }

    return row;
};

const getPartyInfo = (partyElement: Element | null): { name: string; taxNo: string } => {
    if (!partyElement) return { name: '', taxNo: '' };

    const partyNameElement = getFirstElement(partyElement, 'cac:PartyName');
    const legalElement = getFirstElement(partyElement, 'cac:PartyLegalEntity');
    const personElement = getFirstElement(partyElement, 'cac:Person');

    const name =
        (partyNameElement ? getText(partyNameElement, ['cbc:Name', 'Name']) : '') ||
        (legalElement ? getText(legalElement, ['cbc:RegistrationName', 'RegistrationName']) : '') ||
        (personElement
            ? `${getText(personElement, 'cbc:FirstName')} ${getText(personElement, 'cbc:FamilyName')}`.trim()
            : '');

    const taxNo =
        getText(partyElement, ['cbc:CompanyID', 'CompanyID']) || getText(partyElement, ['cbc:ID', 'ID']);

    return { name, taxNo };
};

const collectArchiveFiles = (root: unknown, files: File[]): void => {
    if (!root) return;
    if (root instanceof File) {
        files.push(root);
        return;
    }
    if (typeof root !== 'object') return;

    for (const value of Object.values(root as Record<string, unknown>)) {
        collectArchiveFiles(value, files);
    }
};

const getArchiveApi = async (): Promise<ArchiveApi> => {
    if (!archiveApiPromise) {
        const moduleUrl = resolveArchiveModuleUrl();
        archiveApiPromise = import(/* @vite-ignore */ moduleUrl).then((mod) => {
            const archive = (mod as { Archive?: ArchiveApi }).Archive;
            if (!archive?.open || !archive?.init) {
                throw new Error('libarchive modulu yuklenemedi.');
            }
            archive.init({ workerUrl: resolveArchiveWorkerUrl() });
            return archive;
        });
    }
    return archiveApiPromise;
};

const extractXmlSources = async (inputFile: File): Promise<XmlSource[]> => {
    const extension = inputFile.name.slice(inputFile.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
        throw new Error('Sadece ZIP, RAR, 7Z veya XML dosyalari desteklenir.');
    }

    if (extension === '.xml') {
        return [{ name: inputFile.name, content: await inputFile.text() }];
    }

    const archiveApi = await getArchiveApi();
    const archive = await archiveApi.open(inputFile);
    const extractedRoot = await archive.extractFiles();
    const extractedFiles: File[] = [];
    collectArchiveFiles(extractedRoot, extractedFiles);

    const xmlFiles = extractedFiles.filter((file) => file.name.toLowerCase().endsWith('.xml'));
    const sources: XmlSource[] = [];
    for (const xmlFile of xmlFiles) {
        sources.push({ name: xmlFile.name, content: await xmlFile.text() });
    }
    return sources;
};

export const parseFaturaXmlFile = async (
    inputFile: File,
    onProgress?: (state: ParseProgressState) => void,
): Promise<ParseFaturaXmlResult> => {
    onProgress?.(makeProgress('reading', 10, 'Dosya okunuyor...', 0, 0));
    const xmlSources = await extractXmlSources(inputFile);

    if (xmlSources.length === 0) {
        throw new Error('Gecerli bir XML dosyasi bulunamadi.');
    }

    const parser = new DOMParser();
    const excelRows: FaturaXmlExcelRow[] = [];
    const invoices: FaturaXmlInvoice[] = [];

    let processedInvoices = 0;
    let processedItems = 0;

    for (let i = 0; i < xmlSources.length; i += 1) {
        const source = xmlSources[i];
        const xmlDoc = parser.parseFromString(source.content, 'text/xml');
        if (hasParserError(xmlDoc)) {
            continue;
        }

        const invNo = getText(xmlDoc, ['cbc:ID', 'ID']) || `NO-${i + 1}`;
        const invDate = formatIssueDate(getText(xmlDoc, ['cbc:IssueDate', 'IssueDate']));
        const supplierParty =
            getFirstElement(xmlDoc, 'cac:AccountingSupplierParty') ||
            getFirstElement(xmlDoc.documentElement, 'AccountingSupplierParty');
        const customerParty =
            getFirstElement(xmlDoc, 'cac:AccountingCustomerParty') ||
            getFirstElement(xmlDoc.documentElement, 'AccountingCustomerParty');

        const supplier = getPartyInfo(supplierParty);
        const customer = getPartyInfo(customerParty);

        const taxExclusiveAmount = getText(xmlDoc, ['cbc:TaxExclusiveAmount', 'TaxExclusiveAmount']);
        const taxInclusiveAmount = getText(xmlDoc, ['cbc:TaxInclusiveAmount', 'TaxInclusiveAmount']);
        const taxAmount = getText(xmlDoc, ['cbc:TaxAmount', 'TaxAmount']);
        const taxInclusiveElement = getFirstElement(xmlDoc, 'cbc:TaxInclusiveAmount');
        const currency = taxInclusiveElement?.getAttribute('currencyID') || 'TRY';

        const headerFlatData = flattenXml(xmlDoc.documentElement);
        const lineNodes = Array.from(xmlDoc.getElementsByTagName('cac:InvoiceLine')).length
            ? Array.from(xmlDoc.getElementsByTagName('cac:InvoiceLine'))
            : Array.from(xmlDoc.getElementsByTagNameNS('*', 'InvoiceLine'));

        const invoiceLines: FaturaXmlLineItem[] = [];

        if (lineNodes.length > 0) {
            for (const lineNode of lineNodes) {
                const itemNode =
                    getFirstElement(lineNode, 'cac:Item') || getFirstElement(lineNode, 'Item') || lineNode;

                let itemName = getText(itemNode, ['cbc:Name', 'Name']);
                const description = getText(itemNode, ['cbc:Description', 'Description']);
                const keyword = getText(itemNode, ['cbc:Keyword', 'Keyword']);

                if (description && description.length > itemName.length) {
                    itemName = description;
                } else if (!itemName && keyword) {
                    itemName = keyword;
                } else if (!itemName && description) {
                    itemName = description;
                }

                const quantity = getText(lineNode, ['cbc:InvoicedQuantity', 'InvoicedQuantity']);
                const priceElement = getFirstElement(lineNode, 'cac:Price') || getFirstElement(lineNode, 'Price');
                const unitPrice = priceElement ? getText(priceElement, ['cbc:PriceAmount', 'PriceAmount']) : '';
                const lineTotal = getText(lineNode, ['cbc:LineExtensionAmount', 'LineExtensionAmount']);

                const taxTotalElement =
                    getFirstElement(lineNode, 'cac:TaxTotal') || getFirstElement(lineNode, 'TaxTotal');
                let itemTaxPercent = '';
                let itemTaxAmount = '';
                if (taxTotalElement) {
                    const taxSubTotalElement =
                        getFirstElement(taxTotalElement, 'cac:TaxSubtotal') ||
                        getFirstElement(taxTotalElement, 'TaxSubtotal');
                    if (taxSubTotalElement) {
                        itemTaxPercent = getText(taxSubTotalElement, ['cbc:Percent', 'Percent']);
                        itemTaxAmount = getText(taxSubTotalElement, ['cbc:TaxAmount', 'TaxAmount']);
                    } else {
                        itemTaxAmount = getText(taxTotalElement, ['cbc:TaxAmount', 'TaxAmount']);
                    }
                }

                const lineFlatData = flattenXml(lineNode);
                const row: FaturaXmlExcelRow = {
                    'Fatura Numarasi': invNo,
                    'Fatura Tarihi': invDate,
                    'Alici VKN/TCKN': customer.taxNo,
                    'Alici Unvan / Ad Soyad': customer.name,
                    'Satici VKN/TCKN': supplier.taxNo,
                    'Satici Unvan / Ad Soyad': supplier.name,
                    'Urun/Hizmet Adi': itemName || '(Belirtilmedi)',
                    Miktar: toNumberOrString(quantity),
                    'Birim Fiyat': toNumberOrString(unitPrice),
                    'Satir Toplam (Vergisiz)': toNumberOrString(lineTotal),
                    'KDV Orani (%)': toNumberOrString(itemTaxPercent),
                    'KDV Tutari': toNumberOrString(itemTaxAmount),
                    'Fatura Genel Vergisiz Toplam': toNumberOrString(taxExclusiveAmount),
                    'Fatura Toplam Vergi': toNumberOrString(taxAmount),
                    'Fatura Genel Toplam (Vergiler Dahil)': toNumberOrString(taxInclusiveAmount),
                    'Para Birimi': currency,
                    ...headerFlatData,
                    ...lineFlatData,
                };

                excelRows.push(row);
                invoiceLines.push({
                    itemName: String(row['Urun/Hizmet Adi'] || ''),
                    quantity: row.Miktar as number | string,
                    unitPrice: row['Birim Fiyat'] as number | string,
                    taxPercent: row['KDV Orani (%)'] as number | string,
                    taxAmount: row['KDV Tutari'] as number | string,
                    lineTotal: row['Satir Toplam (Vergisiz)'] as number | string,
                });
                processedItems += 1;
            }
        } else {
            excelRows.push({
                'Fatura Numarasi': invNo,
                'Fatura Tarihi': invDate,
                'Alici VKN/TCKN': customer.taxNo,
                'Alici Unvan / Ad Soyad': customer.name,
                'Satici VKN/TCKN': supplier.taxNo,
                'Satici Unvan / Ad Soyad': supplier.name,
                'Urun/Hizmet Adi': '(Belirtilmedi)',
                Miktar: '',
                'Birim Fiyat': '',
                'Satir Toplam (Vergisiz)': '',
                'KDV Orani (%)': '',
                'KDV Tutari': '',
                'Fatura Genel Vergisiz Toplam': toNumberOrString(taxExclusiveAmount),
                'Fatura Toplam Vergi': toNumberOrString(taxAmount),
                'Fatura Genel Toplam (Vergiler Dahil)': toNumberOrString(taxInclusiveAmount),
                'Para Birimi': currency,
                ...headerFlatData,
            });
            processedItems += 1;
        }

        const previewHtml = generateOriginalInvoiceHtml(xmlDoc);
        const invoice: FaturaXmlInvoice = {
            id: sanitizeInvoiceId(invNo, i),
            invNo,
            invDate,
            companyName: supplier.name || customer.name,
            supplierName: supplier.name,
            supplierVN: supplier.taxNo,
            customerName: customer.name,
            customerVN: customer.taxNo,
            taxExclusiveAmount: toNumberOrString(taxExclusiveAmount),
            taxAmount: toNumberOrString(taxAmount),
            taxInclusiveAmount: toNumberOrString(taxInclusiveAmount),
            currency,
            totalAmountLabel: `${toDisplayString(toNumberOrString(taxInclusiveAmount))} ${currency}`.trim(),
            previewHtml: previewHtml || undefined,
            lines: invoiceLines,
        };

        invoices.push(invoice);
        processedInvoices += 1;

        if (processedInvoices % 25 === 0 || processedInvoices === xmlSources.length) {
            const percent = Math.floor(20 + (70 * processedInvoices) / xmlSources.length);
            onProgress?.(
                makeProgress('parsing', percent, 'Faturalar isleniyor...', processedInvoices, processedItems),
            );
        }
    }

    if (excelRows.length === 0) {
        throw new Error('Faturalardan gecerli veri okunamadi.');
    }

    onProgress?.(makeProgress('done', 100, 'Islem tamamlandi.', processedInvoices, processedItems));
    return {
        invoices,
        excelRows,
        invoiceCount: processedInvoices,
        itemCount: processedItems,
    };
};

export const exportFaturaXmlExcel = (rows: FaturaXmlExcelRow[], fileName = 'E-Fatura_Raporu.xlsx'): void => {
    if (rows.length === 0) {
        throw new Error('Excel olusturmak icin veri bulunamadi.');
    }

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 40 },
        { wch: 50 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 10 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Fatura ve Kalemler');
    XLSX.writeFile(workbook, fileName);
};

export const generateInvoiceHtml = (invoice: FaturaXmlInvoice): string => {
    const linesHtml = invoice.lines
        .map(
            (line) => `
                <tr>
                    <td>${line.itemName}</td>
                    <td>${toDisplayString(line.quantity)}</td>
                    <td>${toDisplayString(line.unitPrice)}</td>
                    <td>${toDisplayString(line.taxPercent)}</td>
                    <td>${toDisplayString(line.taxAmount)}</td>
                    <td>${toDisplayString(line.lineTotal)}</td>
                </tr>
            `,
        )
        .join('');

    return `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>E-Fatura</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
    .header { border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
    .row { display: flex; gap: 16px; margin-bottom: 20px; }
    .box { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 13px; text-align: left; }
    th { background: #f1f5f9; }
    .totals { width: 320px; margin-left: auto; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
    .line { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .line.total { font-weight: bold; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>E-FATURA</h2>
    <p><b>Fatura Numarasi:</b> ${invoice.invNo} | <b>Tarih:</b> ${invoice.invDate}</p>
  </div>
  <div class="row">
    <div class="box">
      <h4>GONDERICI (SATICI)</h4>
      <div>${invoice.supplierName}</div>
      <div><b>VKN/TCKN:</b> ${invoice.supplierVN}</div>
    </div>
    <div class="box">
      <h4>ALICI (MUSTERI)</h4>
      <div>${invoice.customerName}</div>
      <div><b>VKN/TCKN:</b> ${invoice.customerVN}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Urun/Hizmet</th>
        <th>Miktar</th>
        <th>Birim Fiyat</th>
        <th>KDV (%)</th>
        <th>KDV Tutari</th>
        <th>Satir Toplam</th>
      </tr>
    </thead>
    <tbody>${linesHtml || '<tr><td colspan="6">Kalem bulunamadi.</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="line"><span>Vergisiz Tutar:</span><span>${toDisplayString(invoice.taxExclusiveAmount)} ${invoice.currency}</span></div>
    <div class="line"><span>KDV:</span><span>${toDisplayString(invoice.taxAmount)} ${invoice.currency}</span></div>
    <div class="line total"><span>Genel Toplam:</span><span>${toDisplayString(invoice.taxInclusiveAmount)} ${invoice.currency}</span></div>
  </div>
</body>
</html>
    `;
};

export const buildFaturaXmlModuleData = (
    sourceFileName: string,
    parsed: ParseFaturaXmlResult,
): FaturaXmlModuleData => ({
    sourceFileName,
    processedAt: new Date().toISOString(),
    invoiceCount: parsed.invoiceCount,
    itemCount: parsed.itemCount,
    invoices: parsed.invoices,
    excelRows: parsed.excelRows,
});
