$ErrorActionPreference = 'Stop'
$speechRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$speechInput = Join-Path $speechRoot 'word/referensi/Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.docx'
$speechPdf = Join-Path $speechRoot 'Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.pdf'
$speechWord = $null
$speechDoc = $null
$speechOwnInstance = $false
try {
    $speechWord = New-Object -ComObject Word.Application
    $speechOwnInstance = ($speechWord.Documents.Count -eq 0)
    if ($speechOwnInstance) { $speechWord.Visible = $false; $speechWord.DisplayAlerts = 0 }
    $speechDoc = $speechWord.Documents.Open($speechInput, $false, $true)
    $speechDoc.Repaginate()
    $speechPages = $speechDoc.ComputeStatistics(2)
    $speechDoc.ExportAsFixedFormat($speechPdf, 17)
    Write-Output "Pages: $speechPages"
    Write-Output $speechPdf
} finally {
    if ($null -ne $speechDoc) { $speechDoc.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($speechDoc) }
    if ($null -ne $speechWord) {
        if ($speechOwnInstance) { $speechWord.Quit() }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($speechWord)
    }
}
