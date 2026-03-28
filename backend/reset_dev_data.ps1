$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Remove-IfExists([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -Force -LiteralPath $Path
  }
}

function Clear-FolderFiles([string]$Folder) {
  if (!(Test-Path -LiteralPath $Folder)) { return }
  Get-ChildItem -Force -LiteralPath $Folder -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host "Resetting dev data in: $BackendDir"
Write-Host "Make sure the backend (python app.py) is STOPPED, otherwise electoral.db may be locked."

# SQLite DB
Remove-IfExists (Join-Path $BackendDir "electoral.db")
Remove-IfExists (Join-Path $BackendDir "electoral.db-wal")
Remove-IfExists (Join-Path $BackendDir "electoral.db-shm")

# Legacy / debug embedding jsons (safe to delete; DB is now the source of truth)
Remove-IfExists (Join-Path $BackendDir "embeddings.json")
Remove-IfExists (Join-Path $BackendDir "known_embeddings.json")
Remove-IfExists (Join-Path $BackendDir "epoch_embeddings.json")
Remove-IfExists (Join-Path $BackendDir "epoch_embeddings_meta.json")
Remove-IfExists (Join-Path $BackendDir "arcface_embeddings.json")
Remove-IfExists (Join-Path $BackendDir "arcface_embeddings_meta.json")

# Saved images
Clear-FolderFiles (Join-Path $BackendDir "voter_photos")
Clear-FolderFiles (Join-Path $BackendDir "static\\intruder_captures")
Clear-FolderFiles (Join-Path $BackendDir "cropped_faces")

Write-Host "Done. Next run of python app.py will recreate a fresh database and default admin user."

