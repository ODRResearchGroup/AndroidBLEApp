
This branch is a supportive branch to the eNose app to set up backend services in Microsoft Azure. It serves as a working prototype for research on olfactory documentation during smellwalks, performed by intern Sofia Viviani Helleberg during the internship course of 2025:

📄 See the full research report here: https://drive.google.com/file/d/10ZsNhfNnYcSav7udXDZm5WqYzUuI1mBD/view?usp=sharing


This branch outlines how to:
-Store data in Azure Blob Storage
-Transcribe both diarized and non-diarized audio recordings
-Visually annotate photographic notes
-Get olfactory descriptor suggestions using a GPT-4.01 model that analyses transcript text against the Multi-Labelled SMILES Odors Dataset: https://www.kaggle.com/datasets/aryanamitbarsainyan/multi-labelled-smiles-odors-dataset?resource=download

How to set up and deploy the backend:
⚠️ Access credentials for all Azure accounts and the eNose dev phone will be stored in the physical box of the eNose dev phone in the ioio lab.

Step 1 — Prepare the backend folder

Remove the backend-function folder from the general app folder. It is a standalone project. Install dependencies and compile:

npm install
npm run build
Dependencies required:
json"@azure/functions": "^4.5.0",
"@azure/storage-blob": "^12.24.0",
"@azure/storage-queue": "^12.23.0"

Step 2 — Deploy

func azure functionapp publish YOUR_FUNCTION_APP_NAME --typescript
