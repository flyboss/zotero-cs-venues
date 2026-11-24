$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$pluginRoot = $PSScriptRoot
$pluginManifest = Get-Content -LiteralPath (Join-Path $pluginRoot 'manifest.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$outputPath = Join-Path $pluginRoot ("cs-venues-title-" + $pluginManifest.version + '.xpi')
$files = @('manifest.json', 'LICENSE', 'bootstrap.js', 'prefs.js', 'config.js', 'venues.json', 'matcher.js', 'arxiv.js', 'main.js', 'locale/zh-CN/cs-venues-title.ftl', 'locale/en-US/cs-venues-title.ftl')
$stream = [IO.File]::Open($outputPath, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relative in $files) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $pluginRoot $relative), $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}
Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
Get-FileHash -LiteralPath $outputPath -Algorithm SHA256 | Select-Object Hash
