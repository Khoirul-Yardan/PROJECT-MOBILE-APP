param([switch]$Inspect, [switch]$Smoke)
$ErrorActionPreference = 'Stop'
if ($Inspect) {
    Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ProgressWindows {
 public delegate bool Callback(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 public static void Inspect(uint target) {
  EnumWindows((h,l) => { uint p; GetWindowThreadProcessId(h,out p); if(p==target) { var s=new StringBuilder(512); var c=new StringBuilder(512); GetWindowText(h,s,512); GetClassName(h,c,512); Console.WriteLine(h+" | "+c+" | "+s); } return true; },IntPtr.Zero);
 }
}
'@
    foreach ($progressProcess in (Get-Process WINWORD -ErrorAction SilentlyContinue)) {
        Write-Output "Word process: $($progressProcess.Id)"
        [ProgressWindows]::Inspect($progressProcess.Id)
    }
    Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline
    exit
}
$progressRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$progressInput = Join-Path $progressRoot 'Dokumentasi/Progres 2/progres 2 Try and error sistem.docx'
$progressOutput = Join-Path $progressRoot '.work-docs-progres2/report-preview.pdf'
if ($Smoke) {
    $progressInput = Join-Path $progressRoot '.work-docs-progres2/render-smoke.docx'
    $progressOutput = Join-Path $progressRoot '.work-docs-progres2/render-smoke.pdf'
}
$progressWord = $null
$progressDocument = $null
try {
    Write-Output 'Creating Word automation instance...'
    $progressWord = New-Object -ComObject Word.Application
    Write-Output 'Word instance ready; opening report...'
    $progressWord.Visible = $false
    $progressWord.DisplayAlerts = 0
    $progressDocument = $progressWord.Documents.Open($progressInput, $false, $true)
    Write-Output 'Report opened; exporting PDF...'
    $progressDocument.ExportAsFixedFormat($progressOutput, 17)
    Write-Output $progressOutput
} finally {
    if ($null -ne $progressDocument) {
        $progressDocument.Close(0)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($progressDocument)
    }
    if ($null -ne $progressWord) {
        $progressWord.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($progressWord)
    }
}
