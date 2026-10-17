$ErrorActionPreference = 'Stop'
$reportRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$reportPath = Join-Path $reportRoot 'laporan mingguan.docx'
$reportPdf = Join-Path $PSScriptRoot 'preview.pdf'
$reportWord = $null
$reportDoc = $null
$reportOwnInstance = $false
try {
    $reportWord = New-Object -ComObject Word.Application
    $reportOwnInstance = ($reportWord.Documents.Count -eq 0)
    if ($reportOwnInstance) { $reportWord.Visible = $false; $reportWord.DisplayAlerts = 0 }
    $reportDoc = $reportWord.Documents.Open($reportPath, $false, $false)
    $reportDoc.Fields.Update() | Out-Null
    foreach ($reportToc in $reportDoc.TablesOfContents) { $reportToc.Update() }
    $reportDoc.Repaginate()
    foreach ($reportToc in $reportDoc.TablesOfContents) { $reportToc.UpdatePageNumbers() }
    $reportDoc.Save()
    $reportDoc.ExportAsFixedFormat($reportPdf, 17)
    Write-Output ('Pages: ' + $reportDoc.ComputeStatistics(2))
} finally {
    if ($null -ne $reportDoc) { $reportDoc.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($reportDoc) }
    if ($null -ne $reportWord) {
        if ($reportOwnInstance) { $reportWord.Quit() }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($reportWord)
    }
}
