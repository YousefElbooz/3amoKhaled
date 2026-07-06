import fitz

doc = fitz.open(r"e:\Projects\3amo_khaled\نموذج هويه - خالد بن عبدالله بن محمد العصيمي العتيبي .pdf")
page = doc[0]

# PyMuPDF uses a coordinate system where (0,0) is top-left
print(f"Page rect: {page.rect}")
print(f"Page mediabox: {page.mediabox}")
print(f"Page cropbox: {page.cropbox}")

images = page.get_image_info()
for i, img in enumerate(images):
    bbox = img['bbox']
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    print(f"Image {i}: bbox {bbox}, width {width}, height {height}")
