import fitz
import cv2
import numpy as np

doc = fitz.open(r"e:\Projects\3amo_khaled\نموذج هويه - خالد بن عبدالله بن محمد العصيمي العتيبي .pdf")
page = doc[0]
pix = page.get_pixmap()

# Determine number of channels
if pix.alpha:
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 4)
    img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
else:
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blur = cv2.GaussianBlur(gray, (5, 5), 0)

# Thresholding might work better since it's a scanned doc
_, thresh = cv2.threshold(blur, 200, 255, cv2.THRESH_BINARY_INV)

cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cnts = sorted(cnts, key=cv2.contourArea, reverse=True)

print("Top 5 contours:")
for c in cnts[:5]:
    x, y, w, h = cv2.boundingRect(c)
    print(f"Contour: X={x}, Y={y}, W={w}, H={h}, Area={cv2.contourArea(c)}, AspectRatio={w/h}")

# Also just save the image so we can look at it if needed
cv2.imwrite(r"e:\Projects\3amo_khaled\vision-service\pdf_render.jpg", img)
