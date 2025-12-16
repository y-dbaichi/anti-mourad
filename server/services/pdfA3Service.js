const { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } = require('pdf-lib');

/**
 * Convert a PDF to PDF/A-3 with embedded Facture-X XML
 * PDF/A-3 allows embedding arbitrary files as attachments
 */
const embedXmlInPdf = async (pdfBuffer, xmlContent, invoiceNumber) => {
  try {
    // Load the existing PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    // Create the attachment filename
    const attachmentName = 'factur-x.xml';

    // Convert XML to bytes
    const xmlBytes = new TextEncoder().encode(xmlContent);

    // Embed the XML file
    await pdfDoc.attach(xmlBytes, attachmentName, {
      mimeType: 'application/xml',
      description: 'Facture-X XML data (EN 16931)',
      creationDate: new Date(),
      modificationDate: new Date()
    });

    // Add PDF/A-3 metadata
    const title = `Facture ${invoiceNumber}`;
    const subject = 'Facture electronique conforme Facture-X';

    pdfDoc.setTitle(title);
    pdfDoc.setSubject(subject);
    pdfDoc.setProducer('FormatX - PDF to Facture-X Converter');
    pdfDoc.setCreator('FormatX API');

    // Add Facture-X specific metadata
    const creationDate = new Date();
    pdfDoc.setCreationDate(creationDate);
    pdfDoc.setModificationDate(creationDate);

    // Add XMP metadata for Facture-X compliance
    const xmpMetadata = generateFacturexXmp(invoiceNumber, creationDate);

    // Get the catalog and add metadata stream
    const catalog = pdfDoc.catalog;

    // Create metadata stream
    const metadataStream = pdfDoc.context.stream(xmpMetadata, {
      Type: 'Metadata',
      Subtype: 'XML'
    });
    const metadataRef = pdfDoc.context.register(metadataStream);
    catalog.set(PDFName.of('Metadata'), metadataRef);

    // Add AF (Associated Files) entry for PDF/A-3 compliance
    const names = catalog.get(PDFName.of('Names'));
    if (names instanceof PDFDict) {
      const embeddedFiles = names.get(PDFName.of('EmbeddedFiles'));
      if (embeddedFiles instanceof PDFDict) {
        const namesArray = embeddedFiles.get(PDFName.of('Names'));
        if (namesArray instanceof PDFArray) {
          // Get the file spec reference
          const fileSpecRef = namesArray.get(1);
          if (fileSpecRef) {
            // Set AF relationship
            const afArray = pdfDoc.context.obj([fileSpecRef]);
            catalog.set(PDFName.of('AF'), afArray);

            // Update file spec with AFRelationship
            const fileSpec = pdfDoc.context.lookup(fileSpecRef);
            if (fileSpec instanceof PDFDict) {
              fileSpec.set(PDFName.of('AFRelationship'), PDFName.of('Data'));
            }
          }
        }
      }
    }

    // Save the document
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false // Required for some PDF/A validators
    });

    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('PDF/A-3 embedding error:', error);
    throw new Error('Failed to embed XML in PDF: ' + error.message);
  }
};

/**
 * Generate XMP metadata for Facture-X compliance
 */
const generateFacturexXmp = (invoiceNumber, date) => {
  const isoDate = date.toISOString();

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">

      <!-- PDF/A-3 Identification -->
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>

      <!-- Document info -->
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Facture ${invoiceNumber}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>FormatX</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Facture electronique conforme Facture-X EN 16931</rdf:li>
        </rdf:Alt>
      </dc:description>

      <!-- XMP dates -->
      <xmp:CreateDate>${isoDate}</xmp:CreateDate>
      <xmp:ModifyDate>${isoDate}</xmp:ModifyDate>
      <xmp:CreatorTool>FormatX PDF to Facture-X Converter</xmp:CreatorTool>

      <!-- PDF producer -->
      <pdf:Producer>FormatX (pdf-lib)</pdf:Producer>

      <!-- Facture-X extension schema -->
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Type of the hybrid document</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Version of the Factur-X standard</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Conformance level of the Factur-X document</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>

      <!-- Facture-X specific metadata -->
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>COMFORT</fx:ConformanceLevel>

    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

/**
 * Extract XML from a PDF/A-3 Facture-X document
 */
const extractXmlFromPdf = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Get embedded files
    const catalog = pdfDoc.catalog;
    const names = catalog.get(PDFName.of('Names'));

    if (!(names instanceof PDFDict)) {
      throw new Error('No embedded files found in PDF');
    }

    const embeddedFiles = names.get(PDFName.of('EmbeddedFiles'));
    if (!(embeddedFiles instanceof PDFDict)) {
      throw new Error('No embedded files dictionary found');
    }

    // Look for factur-x.xml
    const namesArray = embeddedFiles.get(PDFName.of('Names'));
    if (!(namesArray instanceof PDFArray)) {
      throw new Error('No files array found');
    }

    for (let i = 0; i < namesArray.size(); i += 2) {
      const fileName = namesArray.get(i);
      if (fileName instanceof PDFString || fileName instanceof PDFHexString) {
        const name = fileName.decodeText();
        if (name.toLowerCase().includes('factur-x') || name.toLowerCase().includes('facturx')) {
          const fileSpec = pdfDoc.context.lookup(namesArray.get(i + 1));
          if (fileSpec instanceof PDFDict) {
            const ef = fileSpec.get(PDFName.of('EF'));
            if (ef instanceof PDFDict) {
              const stream = pdfDoc.context.lookup(ef.get(PDFName.of('F')));
              if (stream) {
                const data = stream.getContents();
                return new TextDecoder().decode(data);
              }
            }
          }
        }
      }
    }

    throw new Error('Factur-X XML not found in PDF');
  } catch (error) {
    console.error('XML extraction error:', error);
    throw new Error('Failed to extract XML from PDF: ' + error.message);
  }
};

module.exports = {
  embedXmlInPdf,
  extractXmlFromPdf,
  generateFacturexXmp
};
