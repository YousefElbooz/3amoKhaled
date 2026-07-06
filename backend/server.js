const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const archiver = require('archiver');

const app = express();
app.use(cors({
    exposedHeaders: ['Content-Disposition']
}));

// Store upload in memory to avoid writing to disk
const upload = multer({ storage: multer.memoryStorage() });

// Create templates directory if it doesn't exist
const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir);
}

// Copy the provided PDF template into templates folder initially (this is a placeholder check)
const templatePath = path.join(templatesDir, 'template.pdf');
const originalTemplatePath = path.join(__dirname, '..', 'نموذج هويه - خالد بن عبدالله بن محمد العصيمي العتيبي .pdf');
if (!fs.existsSync(templatePath) && fs.existsSync(originalTemplatePath)) {
    fs.copyFileSync(originalTemplatePath, templatePath);
}

app.post('/api/generate-id-form', upload.array('idImages', 50), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        const processedPdfs = [];
        const pointsMap = req.body.pointsMap ? JSON.parse(req.body.pointsMap) : {};

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            console.log(`Processing file ${i+1}/${req.files.length}:`, file.originalname);
            
            const filePoints = pointsMap[i];
            if (filePoints) {
                console.log(`Points received for file ${i}:`, filePoints);
                fs.appendFileSync(path.join(__dirname, 'debug.log'), `[${new Date().toISOString()}] File: ${file.originalname}, Points: ${filePoints}\n`);
            }

            // 1. Send raw file to Python Microservice
            const formData = new FormData();
            
            if (filePoints) {
                formData.append('points', filePoints);
            }

            formData.append('file', file.buffer, file.originalname);

        const pythonRes = await axios.post('http://127.0.0.1:8000/process-id', formData, {
          headers: formData.getHeaders(),
          responseType: 'json' // Expecting JSON back (image base64 + extracted name)
        });

        // The python service returns: { image: "base64_string", name: "extracted_name" }
        const base64Image = pythonRes.data.image;
        let extractedName = pythonRes.data.name || `Official_ID_Form_${i+1}`;
        
        // Convert base64 image to buffer for PDF embedding
        const processedImageBuffer = Buffer.from(base64Image, 'base64');

        console.log(`Extracted Name for ${file.originalname}:`, extractedName);

        // 2. Load the Blank PDF Template
        if (!fs.existsSync(templatePath)) {
            throw new Error('PDF template not found on server.');
        }
        const templateBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(templateBytes);
        
        // 3. Embed the processed image into the PDF
        const embeddedImage = await pdfDoc.embedPng(processedImageBuffer);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0]; 

        const TARGET_WIDTH = 265;
        const TARGET_HEIGHT = 167; // 265 / 1.586
        const X_COORD = 165; // Centered horizontally
        
        const Y_TARGET_TOP = 745; 
        const Y_COORD = Y_TARGET_TOP - TARGET_HEIGHT;

        firstPage.drawImage(embeddedImage, {
          x: X_COORD,
          y: Y_COORD,
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
        });

        // 4. Save to array
        const pdfBytes = await pdfDoc.save();
        processedPdfs.push({
            name: extractedName,
            buffer: Buffer.from(pdfBytes)
        });
    }

    // 5. Send Response (PDF or ZIP)
    if (processedPdfs.length === 1) {
        const singlePdf = processedPdfs[0];
        res.setHeader('Content-Type', 'application/pdf');
        const encodedFilename = encodeURIComponent(singlePdf.name + ".pdf");
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        return res.send(singlePdf.buffer);
    } else {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="ID_Forms.zip"');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => { throw err; });
        archive.pipe(res);

        processedPdfs.forEach((pdf, index) => {
            // Append a suffix if multiple files share the same name
            let filename = `${pdf.name}.pdf`;
            if (processedPdfs.filter(p => p.name === pdf.name).length > 1) {
                filename = `${pdf.name}_${index + 1}.pdf`;
            }
            archive.append(pdf.buffer, { name: filename });
        });

        archive.finalize();
    }

  } catch (error) {
    console.error('Processing Error:', error.message);
    if (error.response && error.response.status === 400) {
      return res.status(400).json({ error: error.response.data.toString() });
    }
    res.status(500).json({ error: 'Internal server error processing document.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Node backend running on http://localhost:${PORT}`);
});
