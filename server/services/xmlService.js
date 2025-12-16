const { create } = require('xmlbuilder2');

// Parse address into structured components
const parseAddress = (address) => {
  if (!address) return { lineOne: '', postcode: '', city: '', country: 'FR' };

  const parts = address.split(',').map(p => p.trim());
  const lineOne = parts[0] || '';
  let postcode = '';
  let city = '';
  let country = 'FR';

  // Try to extract French postcode and city
  if (parts.length >= 2) {
    const postcodeCity = parts[1];
    const match = postcodeCity.match(/(\d{5})\s+(.+)/);
    if (match) {
      postcode = match[1];
      city = match[2];
    }
  }

  // Check last part for country
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1].toUpperCase();
    if (lastPart === 'FRANCE') country = 'FR';
    else if (lastPart === 'GERMANY' || lastPart === 'DEUTSCHLAND') country = 'DE';
    else if (lastPart.length === 2) country = lastPart;
  }

  return { lineOne, postcode, city, country };
};

// Generate Facture-X XML
const generateFactureX = (data, profile = 'comfort') => {
  const invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];
  const dueDate = data.dueDate || invoiceDate;

  const sellerAddr = parseAddress(data.sellerAddress);
  const buyerAddr = parseAddress(data.buyerAddress);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });

  const root = doc.ele('rsm:CrossIndustryInvoice', {
    'xmlns:rsm': 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
    'xmlns:ram': 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
    'xmlns:udt': 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100'
  });

  // Context
  const context = root.ele('rsm:ExchangedDocumentContext');
  const profileId = profile === 'basic'
    ? 'urn:factur-x.eu:1p0:basic'
    : profile === 'extended'
      ? 'urn:factur-x.eu:1p0:extended'
      : 'urn:factur-x.eu:1p0:comfort';
  context.ele('ram:GuidelineSpecifiedDocumentContextParameter').ele('ram:ID').txt(profileId);

  // Document header
  const exchanged = root.ele('rsm:ExchangedDocument');
  exchanged.ele('ram:ID').txt(data.invoiceNumber || 'UNKNOWN');
  exchanged.ele('ram:TypeCode').txt('380'); // Commercial invoice
  exchanged.ele('ram:IssueDateTime')
    .ele('udt:DateTimeString', { format: '102' })
    .txt(invoiceDate.replace(/-/g, ''));

  const transaction = root.ele('rsm:SupplyChainTradeTransaction');

  // Seller/Buyer Agreement
  const agreement = transaction.ele('ram:ApplicableHeaderTradeAgreement');

  // Seller
  const sellerParty = agreement.ele('ram:SellerTradeParty');
  sellerParty.ele('ram:Name').txt(data.sellerName || '');

  const sellerAddress = sellerParty.ele('ram:PostalTradeAddress');
  if (sellerAddr.postcode) sellerAddress.ele('ram:PostcodeCode').txt(sellerAddr.postcode);
  sellerAddress.ele('ram:LineOne').txt(sellerAddr.lineOne);
  if (sellerAddr.city) sellerAddress.ele('ram:CityName').txt(sellerAddr.city);
  sellerAddress.ele('ram:CountryID').txt(data.sellerCountry || sellerAddr.country);

  if (data.sellerSIRET) {
    sellerParty.ele('ram:SpecifiedTaxRegistration')
      .ele('ram:ID', { schemeID: 'VA' })
      .txt(data.sellerSIRET);
  }

  // Buyer
  const buyerParty = agreement.ele('ram:BuyerTradeParty');
  buyerParty.ele('ram:Name').txt(data.buyerName || '');

  const buyerAddress = buyerParty.ele('ram:PostalTradeAddress');
  if (buyerAddr.postcode) buyerAddress.ele('ram:PostcodeCode').txt(buyerAddr.postcode);
  buyerAddress.ele('ram:LineOne').txt(buyerAddr.lineOne);
  if (buyerAddr.city) buyerAddress.ele('ram:CityName').txt(buyerAddr.city);
  buyerAddress.ele('ram:CountryID').txt(data.buyerCountry || buyerAddr.country);

  if (data.buyerSIRET) {
    buyerParty.ele('ram:SpecifiedTaxRegistration')
      .ele('ram:ID', { schemeID: 'VA' })
      .txt(data.buyerSIRET);
  }

  // Delivery
  const delivery = transaction.ele('ram:ApplicableHeaderTradeDelivery');
  delivery.ele('ram:ActualDeliverySupplyChainEvent')
    .ele('ram:OccurrenceDateTime')
    .ele('udt:DateTimeString', { format: '102' })
    .txt(invoiceDate.replace(/-/g, ''));

  // Settlement
  const settlement = transaction.ele('ram:ApplicableHeaderTradeSettlement');
  settlement.ele('ram:InvoiceCurrencyCode').txt(data.currency || 'EUR');

  // VAT breakdown
  const vatAmount = (data.totalTTC || 0) - (data.totalHT || 0);
  const taxTotal = settlement.ele('ram:ApplicableTradeTax');
  taxTotal.ele('ram:CalculatedAmount').txt(vatAmount.toFixed(2));
  taxTotal.ele('ram:TypeCode').txt('VAT');
  taxTotal.ele('ram:BasisAmount').txt((data.totalHT || 0).toFixed(2));
  taxTotal.ele('ram:CategoryCode').txt('S');
  taxTotal.ele('ram:RateApplicablePercent').txt('20');

  // Payment terms
  const paymentTerms = settlement.ele('ram:SpecifiedTradePaymentTerms');
  paymentTerms.ele('ram:DueDateDateTime')
    .ele('udt:DateTimeString', { format: '102' })
    .txt(dueDate.replace(/-/g, ''));

  // Monetary summary
  const monetary = settlement.ele('ram:SpecifiedTradeSettlementHeaderMonetarySummation');
  monetary.ele('ram:LineTotalAmount').txt((data.totalHT || 0).toFixed(2));
  monetary.ele('ram:TaxBasisTotalAmount').txt((data.totalHT || 0).toFixed(2));
  monetary.ele('ram:TaxTotalAmount', { currencyID: data.currency || 'EUR' })
    .txt(vatAmount.toFixed(2));
  monetary.ele('ram:GrandTotalAmount').txt((data.totalTTC || 0).toFixed(2));
  monetary.ele('ram:DuePayableAmount').txt((data.totalTTC || 0).toFixed(2));

  // Line items
  (data.items || []).forEach((item, index) => {
    const lineItem = transaction.ele('ram:IncludedSupplyChainTradeLineItem');
    lineItem.ele('ram:AssociatedDocumentLineDocument')
      .ele('ram:LineID')
      .txt((index + 1).toString());

    const product = lineItem.ele('ram:SpecifiedTradeProduct');
    product.ele('ram:Name').txt(item.designation || 'Item');

    const lineAgreement = lineItem.ele('ram:SpecifiedLineTradeAgreement');
    lineAgreement.ele('ram:NetPriceProductTradePrice')
      .ele('ram:ChargeAmount')
      .txt((item.unitPrice || 0).toFixed(2));

    const lineDelivery = lineItem.ele('ram:SpecifiedLineTradeDelivery');
    lineDelivery.ele('ram:BilledQuantity', { unitCode: 'C62' })
      .txt((item.quantity || 1).toString());

    const lineSettlement = lineItem.ele('ram:SpecifiedLineTradeSettlement');
    const lineTax = lineSettlement.ele('ram:ApplicableTradeTax');
    lineTax.ele('ram:TypeCode').txt('VAT');
    lineTax.ele('ram:CategoryCode').txt('S');
    lineTax.ele('ram:RateApplicablePercent').txt((item.vatRate || 20).toString());

    lineSettlement.ele('ram:SpecifiedTradeSettlementLineMonetarySummation')
      .ele('ram:LineTotalAmount')
      .txt((item.montantHT || 0).toFixed(2));
  });

  return doc.end({ prettyPrint: true });
};

module.exports = { generateFactureX, parseAddress };
