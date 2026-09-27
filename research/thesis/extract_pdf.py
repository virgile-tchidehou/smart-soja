import sys
import os

pdf_path = "rapport_final_depot_smart_soja.pdf"
out_path = "rapport_final_depot_smart_soja.txt"

# Try PyMuPDF (fitz) first
try:
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    text = ""
    for page_num, page in enumerate(doc, 1):
        text += f"\n{'='*60}\n PAGE {page_num}\n{'='*60}\n"
        text += page.get_text()
    doc.close()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"[PyMuPDF] Extraction reussie : {len(text)} caracteres -> {out_path}")
    sys.exit(0)
except ImportError:
    print("[PyMuPDF] Non installe, essai avec pdfplumber...")

# Try pdfplumber
try:
    import pdfplumber
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text += f"\n{'='*60}\n PAGE {page_num}\n{'='*60}\n"
            t = page.extract_text()
            if t:
                text += t
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"[pdfplumber] Extraction reussie : {len(text)} caracteres -> {out_path}")
    sys.exit(0)
except ImportError:
    print("[pdfplumber] Non installe, essai avec pypdf2...")

# Try PyPDF2
try:
    import PyPDF2
    text = ""
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page_num, page in enumerate(reader.pages, 1):
            text += f"\n{'='*60}\n PAGE {page_num}\n{'='*60}\n"
            t = page.extract_text()
            if t:
                text += t
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"[PyPDF2] Extraction reussie : {len(text)} caracteres -> {out_path}")
    sys.exit(0)
except ImportError:
    print("[PyPDF2] Non installe.")

print("Aucune librairie PDF disponible. Installation de PyMuPDF...")
os.system("pip install pymupdf")
import fitz
doc = fitz.open(pdf_path)
text = ""
for page_num, page in enumerate(doc, 1):
    text += f"\n{'='*60}\n PAGE {page_num}\n{'='*60}\n"
    text += page.get_text()
doc.close()
with open(out_path, "w", encoding="utf-8") as f:
    f.write(text)
print(f"[PyMuPDF apres install] Extraction reussie -> {out_path}")
