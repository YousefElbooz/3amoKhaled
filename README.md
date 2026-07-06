# 3amo Khaled ID Scanner System

This repository contains the complete "3amo Khaled" smart ID scanning platform, built to extract, crop, perspective-warp, and process identity documents into perfect PDF sheets.

The architecture is split into three main microservices:
1. **Frontend**: A React + Vite web application offering an advanced UI for batch uploads, standard cropping, and 4-point perspective warp.
2. **Backend**: A Node.js/Express proxy that processes batches, communicates with the vision service, and bundles the generated assets into downloadable PDFs or ZIP archives.
3. **Vision Service**: A Python FastAPI backend utilizing OpenCV for image processing, PyMuPDF for PDF extraction, and EasyOCR for automated Arabic text extraction.

---

## 🚀 Getting Started

Follow these steps to run the entire stack locally.

### Prerequisites
You will need the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Python](https://www.python.org/) (v3.9 or higher recommended)

---

### Step 1: Start the Python Vision Service
The vision service handles all the heavy lifting (OpenCV warping, OCR, etc.). It runs on **Port 8000**.

1. Open a terminal and navigate to the `vision-service` folder:
   ```bash
   cd vision-service
   ```
2. Create a Python Virtual Environment:
   ```bash
   # Windows
   python -m venv venv
   
   # Mac/Linux
   python3 -m venv venv
   ```
3. Activate the Virtual Environment:
   ```bash
   # Windows
   .\venv\Scripts\activate
   
   # Mac/Linux
   source venv/bin/activate
   ```
4. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn app:app --port 8000
   ```
   *(Keep this terminal open)*

---

### Step 2: Start the Node.js Backend
The Node backend serves as a proxy and PDF generator. It runs on **Port 3000**.

1. Open a **new** terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Express server:
   ```bash
   node server.js
   ```
   *(Keep this terminal open)*

---

### Step 3: Start the React Frontend
The frontend provides the interactive cropping UI. It runs on Vite's default port (usually **Port 5173**).

1. Open a **new** terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

**You're all set!** 
Open the local URL provided by Vite in your browser (usually `http://localhost:5173`) to start using the app.

---

## 🛠 Features Included
- **Batch Processing**: Upload multiple IDs at once.
- **Perspective Crop**: Interactive 4-point corner adjust with a magnifying glass overlay.
- **Auto-Extract**: Native OpenCV contour detection to auto-find ID boundaries.
- **PDF Generation**: Outputs professional, standardized A4 sheets with the ID perfectly aligned.
