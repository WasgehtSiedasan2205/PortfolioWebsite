# Local preview server. YouTube refuses embeds on file:// pages, so preview via http://localhost instead.
# Usage:  powershell -ExecutionPolicy Bypass -File .\serve.ps1 [-Port 8080] [-NoBrowser]
#   (or double-click serve.cmd). Stop with Ctrl+C.
param(
  [int]$Port = 8080,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$prefix = "http://localhost:$Port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json"; ".xml" = "application/xml"; ".txt" = "text/plain; charset=utf-8"; ".md" = "text/plain; charset=utf-8"
  ".svg" = "image/svg+xml"; ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".gif" = "image/gif"
  ".webp" = "image/webp"; ".avif" = "image/avif"; ".ico" = "image/x-icon"
  ".mp3" = "audio/mpeg"; ".ogg" = "audio/ogg"; ".opus" = "audio/ogg"; ".wav" = "audio/wav"; ".m4a" = "audio/mp4"
  ".mp4" = "video/mp4"; ".webm" = "video/webm"; ".pdf" = "application/pdf"
  ".woff" = "font/woff"; ".woff2" = "font/woff2"
}

function Send-Text($res, [int]$code, [string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $res.StatusCode = $code
  $res.ContentType = "text/plain; charset=utf-8"
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Handle-Request($ctx) {
  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers["Cache-Control"] = "no-store"

  $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/').Replace('/', '\')
  if ($rel -eq "" -or $rel.EndsWith('\')) { $rel += "index.html" }
  $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
  if (-not $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { Send-Text $res 403 "Forbidden"; return }
  if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path "index.html" }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    Send-Text $res 404 "Not found: /$($rel.Replace('\', '/'))"
    return
  }

  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  $type = $mime[$ext]
  if (-not $type) { $type = "application/octet-stream" }
  $res.ContentType = $type
  $res.Headers["Accept-Ranges"] = "bytes"

  $fs = [System.IO.File]::OpenRead($path)
  try {
    $len = $fs.Length
    $start = [long]0
    $end = $len - 1
    $range = $req.Headers["Range"]
    if ($range -and $range -match '^bytes=(\d*)-(\d*)$') {
      if ($Matches[1] -ne "") {
        $start = [long]$Matches[1]
        if ($Matches[2] -ne "") { $end = [Math]::Min([long]$Matches[2], $len - 1) }
      } elseif ($Matches[2] -ne "") {
        $start = [Math]::Max([long]0, $len - [long]$Matches[2])
      }
      if ($start -gt $end -or $start -ge $len) {
        $res.StatusCode = 416
        $res.Headers["Content-Range"] = "bytes */$len"
        return
      }
      $res.StatusCode = 206
      $res.Headers["Content-Range"] = "bytes $start-$end/$len"
    }
    $count = $end - $start + 1
    $res.ContentLength64 = $count
    if ($req.HttpMethod -eq "HEAD") { return }

    $fs.Position = $start
    $buf = New-Object byte[] 65536
    while ($count -gt 0) {
      $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $count))
      if ($n -le 0) { break }
      $res.OutputStream.Write($buf, 0, $n)
      $count -= $n
    }
  } finally {
    $fs.Dispose()
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not start server on $prefix ($($_.Exception.Message)). Try another port: .\serve.ps1 -Port 8081" -ForegroundColor Red
  exit 1
}

Write-Host "Serving $root"
Write-Host "Open $prefix  (Ctrl+C to stop)" -ForegroundColor Green

if (-not $NoBrowser) {
  $firefox = @(
    "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
    "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe",
    "$env:LOCALAPPDATA\Mozilla Firefox\firefox.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $firefox) { $firefox = "firefox.exe" }
  try { Start-Process $firefox $prefix } catch { Start-Process $prefix }
}

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    # Poll so Ctrl+C can interrupt between requests.
    while (-not $task.Wait(250)) { }
    $ctx = $task.Result
    try {
      Handle-Request $ctx
    } catch {
      # Browsers routinely abort media requests mid-stream; ignore those.
      try { $ctx.Response.StatusCode = 500 } catch { }
    } finally {
      try { $ctx.Response.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Host "Server stopped."
}
