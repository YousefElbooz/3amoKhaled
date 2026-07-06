import cv2
import numpy as np
import fitz
import base64
import easyocr
import re
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse

app = FastAPI()

# Initialize EasyOCR for Arabic
reader = easyocr.Reader(['ar'])

def order_points(pts):
    # Order points: top-left, top-right, bottom-right, bottom-left
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Calculate exact target width
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    # Calculate exact target height
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    # FIX 1: Remove "- 1" to map to the absolute edge, preventing squishing
    dst = np.array([
        [0, 0],
        [maxWidth, 0],
        [maxWidth, maxHeight],
        [0, maxHeight]], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    
    # FIX 2: Apply BORDER_REPLICATE to stop black pixel bleed during interpolation
    warped = cv2.warpPerspective(
        image, 
        M, 
        (maxWidth, maxHeight), 
        borderMode=cv2.BORDER_REPLICATE
    )
    
    return warped


@app.post("/process-id")
async def process_id(file: UploadFile = File(...), points: str = Form(None)):
    try:
        contents = await file.read()
        
        # 1. Native PDF Support
        if file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
            # Load PDF from memory
            pdf_document = fitz.open(stream=contents, filetype="pdf")
            if pdf_document.page_count == 0:
                from fastapi import Response
                return Response(content="Empty PDF.", status_code=400)
            
            page = pdf_document[0]
            # Render to 300 DPI image
            zoom = 300 / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # Convert to OpenCV format
            img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                image = cv2.cvtColor(img_data, cv2.COLOR_BGRA2BGR)
            else:
                image = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
            pdf_document.close()
        else:
            # Standard image handling
            nparr = np.frombuffer(contents, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            from fastapi import Response
            return Response(content="Invalid image format.", status_code=400)
            
        ratio = image.shape[0] / 800.0
        orig = image.copy()
        
        if points:
            print("Points used:", points)
            import json
            pts_data = json.loads(points)
            orig_pts = np.array([[p["x"], p["y"]] for p in pts_data], dtype="float32")
            warped = four_point_transform(orig, orig_pts)
        else:
            print("No points provided! Falling back to auto-crop")
            dim = (int(image.shape[1] * (800.0 / image.shape[0])), 800)
            resized = cv2.resize(image, dim)

            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            
            # 1. Outer Boundary Optimization
            # Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Canny edge detection (great for photos)
            edged = cv2.Canny(blurred, 50, 150)
            
            # Inverse Binary Thresholding (great for white backgrounds like PDFs)
            # Any non-white pixel becomes white (255).
            _, thresh = cv2.threshold(blurred, 245, 255, cv2.THRESH_BINARY_INV)
            
            # Combine Canny edges and Threshold blob
            combined = cv2.bitwise_or(edged, thresh)
            
            # Dilate to close the boundary into a solid contour
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            dilated = cv2.dilate(combined, kernel, iterations=3)

            cnts, _ = cv2.findContours(dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cnts = sorted(cnts, key=cv2.contourArea, reverse=True)
            screenCnt = None
            
            total_area = resized.shape[0] * resized.shape[1]

            for c in cnts:
                if cv2.contourArea(c) < (total_area * 0.05):
                    continue
                    
                rect = cv2.minAreaRect(c)
                (center, (width, height), angle) = rect
                
                if width == 0 or height == 0:
                    continue
                    
                ar = width / float(height) if width > height else height / float(width)
                
                # Support both Physical IDs (1.2 to 1.9) AND Wide Digital Banners (2.2 to 3.5)
                if (1.2 <= ar <= 1.9) or (2.2 <= ar <= 3.8):
                    box = cv2.boxPoints(rect)
                    screenCnt = np.int32(box)
                    break
                    
            # Fallback 1: If no matching AR, take largest contour > 10%
            if screenCnt is None and len(cnts) > 0:
                if cv2.contourArea(cnts[0]) > (total_area * 0.10):
                    rect = cv2.minAreaRect(cnts[0])
                    box = cv2.boxPoints(rect)
                    screenCnt = np.int32(box)

            # Fallback 2: If everything fails, use the whole image instead of slicing it blindly
            if screenCnt is None:
                h, w = orig.shape[:2]
                pts = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype="float32")
                warped = four_point_transform(orig, pts)
            else:
                # Scale coordinates back to the original image size
                orig_pts = screenCnt * ratio
                
                # Perspective Warp (maintains natural aspect ratio)
                warped = four_point_transform(orig, orig_pts)
            
            
            # Precision Edge Shaving 
            # We shave 2% uniformly to prevent overcropping while removing thin borders.
            h, w = warped.shape[:2]
            t_crop = int(h * 0.02)
            b_crop = int(h * 0.02)
            l_crop = int(w * 0.02)
            r_crop = int(w * 0.02)
            
            if h > (t_crop + b_crop) and w > (l_crop + r_crop):
                warped = warped[t_crop:h-b_crop, l_crop:w-r_crop]

        # 5. Perfect Photocopier Grayscale Effect
        # Convert to grayscale and apply contrast boost to simulate a scanner.
        gray_warped = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        final_output = cv2.convertScaleAbs(gray_warped, alpha=1.05, beta=10)

        # 6. Apply Perfect Transparent Rounded Corners
        # Convert to BGRA to support alpha transparency
        bgra = cv2.cvtColor(final_output, cv2.COLOR_GRAY2BGRA)
        h_out, w_out = bgra.shape[:2]
        
        # Calculate radius (approx 4% of the width gives a very realistic ID corner)
        r = int(w_out * 0.04)
        
        # Create an alpha mask (0 = fully transparent, 255 = fully opaque)
        alpha_mask = np.zeros((h_out, w_out), dtype=np.uint8)
        
        # Draw the main intersecting rectangles
        cv2.rectangle(alpha_mask, (r, 0), (w_out - r, h_out), 255, -1)
        cv2.rectangle(alpha_mask, (0, r), (w_out, h_out - r), 255, -1)
        
        # Draw the 4 perfect circular corners with Anti-Aliasing for smooth edges
        cv2.circle(alpha_mask, (r, r), r, 255, -1, cv2.LINE_AA)
        cv2.circle(alpha_mask, (w_out - r, r), r, 255, -1, cv2.LINE_AA)
        cv2.circle(alpha_mask, (r, h_out - r), r, 255, -1, cv2.LINE_AA)
        cv2.circle(alpha_mask, (w_out - r, h_out - r), r, 255, -1, cv2.LINE_AA)
        
        # Apply mask to the alpha channel
        bgra[:, :, 3] = alpha_mask

        # 7. Flawless Arabic OCR (EasyOCR)
        extracted_name = ""
        # The name is in the top-center/right area of the Saudi ID.
        roi_t = int(h_out * 0.15)
        roi_b = int(h_out * 0.35)
        roi_l = int(w_out * 0.25)
        roi_r = int(w_out * 0.85)
        roi_image = bgra[roi_t:roi_b, roi_l:roi_r]
        
        # EasyOCR works best with pure BGR/Grayscale, so drop the alpha channel
        roi_bgr = cv2.cvtColor(roi_image, cv2.COLOR_BGRA2BGR)
        
        results = reader.readtext(roi_bgr)
        
        valid_texts = []
        for bbox, text, prob in results:
            # Keep only Arabic characters and spaces
            cleaned = re.sub(r'[^\u0600-\u06FF\s]', '', text).strip()
            
            # Filter out stray characters and common labels
            if len(cleaned) > 2 and 'الاسم' not in cleaned and 'جهة' not in cleaned and 'تاريخ' not in cleaned:
                valid_texts.append(cleaned)
                
        if valid_texts:
            # Concatenate ALL valid Arabic parts since EasyOCR might split a long name into multiple boxes
            extracted_name = " ".join(valid_texts)

        # Apply a subtle 1.5% blur to the final output image as requested
        # A 3x3 Gaussian kernel provides a very light softening effect
        bgra_blurred = cv2.GaussianBlur(bgra, (3, 3), 0)
        
        # Restore the sharp alpha mask so the transparent rounded corners stay pixel-perfect
        bgra_blurred[:, :, 3] = alpha_mask

        _, encoded_img = cv2.imencode('.png', bgra_blurred)
        base64_img = base64.b64encode(encoded_img.tobytes()).decode('utf-8')
        
        return JSONResponse(content={
            "image": base64_img,
            "name": extracted_name
        })
    except Exception as e:
        return JSONResponse(content={"error": f"Error processing image: {str(e)}"}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
