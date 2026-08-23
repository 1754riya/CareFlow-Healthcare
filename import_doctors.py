"""
Import Practo doctor dataset into Firestore (jeevan-chakkar project).

Data source priority:
  1. doctor.json  (if present in the same directory)
  2. doctor.csv   (if present in the same directory)
  3. Kaggle download (automatic fallback)

Requirements:
    pip install firebase-admin kagglehub pandas

Place your Firebase service account key at:
    MediChain-main/serviceAccountKey.json

Run:
    python import_doctors.py
"""

import os
import re
import sys
import hashlib
from collections import Counter

import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore

# Force UTF-8 output so ₹ and other Unicode chars don't crash on Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# ── Test mode — set False to upload the entire dataset ────────────────────────
TEST_MODE = False
TEST_LIMIT = 20

# ── Firebase init ──────────────────────────────────────────────────────────────
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Load data (local file first, Kaggle fallback) ──────────────────────────────
def load_dataframe():
    """Return a DataFrame from doctor.json, doctor.csv, or Kaggle download."""

    if os.path.exists("doctor.json"):
        print("Using local file: doctor.json")
        return pd.read_json("doctor.json", lines=True)

    if os.path.exists("doctor.csv"):
        print("Using local file: doctor.csv")
        return pd.read_csv("doctor.csv")

    print("No local file found — downloading from Kaggle...")
    import kagglehub
    path = kagglehub.dataset_download("shashankshukla123123/doctor-fee-predictionpracto")
    print(f"Dataset saved at: {path}")

    for f in os.listdir(path):
        if f.endswith(".csv"):
            print(f"CSV file: {f}")
            return pd.read_csv(os.path.join(path, f))

    raise FileNotFoundError(f"No CSV found in {path}. Files: {os.listdir(path)}")


df = load_dataframe()
df.columns = df.columns.str.strip()   # remove accidental leading/trailing spaces
print(f"\nTotal rows : {len(df)}")
print(f"Columns    : {df.columns.tolist()}")
print(f"\nSample row :\n{df.iloc[0].to_dict()}\n")

# ── Specialty normalization map ────────────────────────────────────────────────
# Ordered longest-match first to avoid "surg" matching "neurosurgeon" as General Surgeon.
SPECIALTY_MAP = [
    ("general physician",    "General Physician"),
    ("general practice",     "General Physician"),
    ("family medicine",      "General Physician"),
    ("internal medicine",    "General Physician"),
    ("gastroenterolog",      "Gastroenterologist"),
    ("otolaryngolog",        "ENT Specialist"),
    ("ear, nose",            "ENT Specialist"),
    ("ophthalmolog",         "Ophthalmologist"),
    ("endocrinolog",         "Endocrinologist"),
    ("rheumatolog",          "Rheumatologist"),
    ("pulmonolog",           "Pulmonologist"),
    ("nephrolog",            "Nephrologist"),
    ("cardiolog",            "Cardiologist"),
    ("oncolog",              "Oncologist"),
    ("neurolog",             "Neurologist"),
    ("pediatr",              "Pediatrician"),
    ("paediatr",             "Pediatrician"),
    ("psychiatr",            "Psychiatrist"),
    ("gynaecolog",           "Gynologist"),
    ("gynecolog",            "Gynologist"),
    ("dermatolog",           "Dermatologist"),
    ("orthoped",             "Orthopedist"),
    ("orthopaed",            "Orthopedist"),
    ("urolog",               "Urologist"),
    ("diabetolog",           "Endocrinologist"),
    ("plastic surg",         "Plastic Surgeon"),
    ("cosmetic surg",        "Plastic Surgeon"),
    ("surg",                 "General Surgeon"),
    ("dentist",              "Dentist"),
    ("dental",               "Dentist"),
    ("orthodont",            "Dentist"),
    ("heart",                "Cardiologist"),
    ("renal",                "Nephrologist"),
    ("kidney",               "Nephrologist"),
    ("diabetes",             "Endocrinologist"),
    ("thyroid",              "Endocrinologist"),
    ("digestive",            "Gastroenterologist"),
    ("gastro",               "Gastroenterologist"),
    ("respiratory",          "Pulmonologist"),
    ("lung",                 "Pulmonologist"),
    ("cancer",               "Oncologist"),
    ("arthrit",              "Rheumatologist"),
    ("retina",               "Ophthalmologist"),
    ("eye",                  "Ophthalmologist"),
    ("bone",                 "Orthopedist"),
    ("joint",                "Orthopedist"),
    ("spine",                "Neurologist"),
    ("brain",                "Neurologist"),
    ("child",                "Pediatrician"),
    ("mental health",        "Psychiatrist"),
    ("psycholog",            "Psychiatrist"),
    ("obstetr",              "Gynologist"),
    ("women",                "Gynologist"),
    ("skin",                 "Dermatologist"),
    ("cosmetolog",           "Dermatologist"),
    ("ent",                  "ENT Specialist"),
]

def normalize_specialty(raw):
    if pd.isna(raw):
        return "General Physician"
    lower = str(raw).lower().strip()
    for key, mapped in SPECIALTY_MAP:
        if key in lower:
            return mapped
    return str(raw).strip().title()   # unknown specialty kept as-is

# ── Helper functions ───────────────────────────────────────────────────────────
def make_doc_id(first, last, city):
    """Deterministic 20-char Firestore ID — same doctor always gets the same ID,
    so re-running the script upserts rather than creating duplicates."""
    key = f"{first.lower()}|{last.lower()}|{city.lower()}"
    return hashlib.sha256(key.encode()).hexdigest()[:20]

def split_name(raw):
    """Strip 'Dr.' prefix, return (firstName, lastName). Returns None on failure."""
    if pd.isna(raw) or str(raw).strip() == "":
        return None, None
    name = re.sub(r"^Dr\.?\s*", "", str(raw).strip(), flags=re.IGNORECASE).strip().title()
    parts = name.split()
    if not parts:
        return None, None
    return parts[0], " ".join(parts[1:]) if len(parts) > 1 else ""

def parse_int(val, default=0):
    if pd.isna(val):
        return default
    nums = re.findall(r"\d+", str(val).replace(",", ""))
    return int(nums[0]) if nums else default

def clean_str(val, default=""):
    if pd.isna(val) or str(val).strip() in ("", "nan"):
        return default
    return str(val).strip().title()

def build_clinic_name(area, city):
    area = area.strip()
    city = city.strip()
    if area and area.lower() != city.lower():
        return f"{area}, {city}"
    return city

def build_about(qualifications, specialty, experience):
    parts = []
    if qualifications:
        parts.append(qualifications)
    if experience:
        parts.append(f"{experience} years of experience")
    if specialty:
        parts.append(f"Specializing in {specialty}.")
    return " · ".join(parts) if parts else f"Experienced {specialty}."

def build_keywords(first, last, specialty, city):
    tokens = []
    for text in [first, last, specialty, city]:
        if text:
            tokens += text.lower().split()
    full_name  = f"{first} {last}".strip().lower()
    spec_lower = specialty.lower()
    return list(set([full_name, spec_lower] + tokens))

def default_availability():
    slots = ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"]
    return {"Monday": slots, "Wednesday": slots, "Friday": slots}

# ── Transform rows ─────────────────────────────────────────────────────────────
# Kaggle column names:
#   Name | Degree | Location | City | Consult Fee | Years of Experience | Speciality

doctors  = []
failed   = []

for idx, row in df.iterrows():
    try:
        first, last = split_name(row.get("Name"))

        # Skip if name could not be parsed
        if not first:
            failed.append({"row": idx, "reason": "missing or unparseable Name", "raw": row.get("Name")})
            continue

        city = clean_str(row.get("City"), "")

        # Skip if city is missing (location field becomes useless)
        if not city:
            failed.append({"row": idx, "reason": "missing City", "raw": row.get("Name")})
            continue

        area          = clean_str(row.get("Location"), "")
        specialty     = normalize_specialty(row.get("Speciality"))
        qualifications= clean_str(row.get("Degree"), "")
        experience    = parse_int(row.get("Years of Experience"), 0)
        fee           = parse_int(row.get("Consult Fee"), 500)
        clinic_name   = build_clinic_name(area, city)

        doctors.append({
            "firstName":      first,
            "lastName":       last,
            "specialty":      specialty,
            "qualifications": qualifications,
            "location":       city,
            "clinicName":     clinic_name,
            "experience":     experience,
            "fee":            fee,
            "avgRating":      0.0,
            "totalRatings":   0,
            "verified":       experience >= 5,
            "image":          "",
            "about":          build_about(qualifications, specialty, experience),
            "searchKeywords": build_keywords(first, last, specialty, city),
            "availability":   default_availability(),
        })

    except Exception as e:
        failed.append({"row": idx, "reason": str(e), "raw": row.get("Name", "")})

print(f"Total found  : {len(df)}")
print(f"Prepared     : {len(doctors)}")
print(f"Skipped/failed: {len(failed)}")

if failed:
    print("\nFailed records (first 10):")
    for f in failed[:10]:
        print(f"  Row {f['row']:>5} | {f['reason']:<35} | {f['raw']}")

# ── Apply TEST_MODE limit ──────────────────────────────────────────────────────
if TEST_MODE:
    doctors = doctors[:TEST_LIMIT]
    print(f"\n⚠️  TEST_MODE is ON — uploading first {TEST_LIMIT} doctors only.")
    print("   Set TEST_MODE = False to upload the full dataset.\n")
else:
    print(f"\n🚀 TEST_MODE is OFF — uploading all {len(doctors)} doctors.\n")

# ── Specialty breakdown ────────────────────────────────────────────────────────
counts = Counter(d["specialty"] for d in doctors)
print("\nSpecialty breakdown (top 15):")
for spec, n in counts.most_common(15):
    print(f"  {n:>5}  {spec}")

# ── Upload to Firestore in batches of 400 ─────────────────────────────────────
BATCH_SIZE   = 400
uploaded     = 0
upload_failed= 0

print(f"\nUploading to Firestore collection 'doctors'...")

for i in range(0, len(doctors), BATCH_SIZE):
    chunk = doctors[i : i + BATCH_SIZE]
    try:
        batch = db.batch()
        for d in chunk:
            doc_id = make_doc_id(d["firstName"], d["lastName"], d["location"])
            ref = db.collection("doctors").document(doc_id)
            batch.set(ref, d)
        batch.commit()
        uploaded += len(chunk)
        print(f"  ✓ {uploaded}/{len(doctors)} uploaded")
    except Exception as e:
        upload_failed += len(chunk)
        print(f"  ✗ Batch {i//BATCH_SIZE + 1} failed: {e}")

# ── Final summary ──────────────────────────────────────────────────────────────
print(f"\n── Summary ───────────────────────────────")
print(f"  Total rows in dataset : {len(df)}")
print(f"  Valid doctors prepared: {len(doctors)}")
print(f"  Transform failures    : {len(failed)}")
print(f"  Successfully uploaded : {uploaded}")
print(f"  Upload failures       : {upload_failed}")
print(f"──────────────────────────────────────────")
if uploaded:
    print(f"\n✅ Open /search in your app to see the doctors.")
