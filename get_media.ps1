# Persistent Media Polling Script
# This script runs in a loop to avoid the overhead of spawning a new process every second.

Add-Type -AssemblyName "System.Runtime.WindowsRuntime"

while ($true) {
    try {
        $found = $false
        
        # METHOD 1: Try the Official Windows Media API (Global SMTC)
        try {
            $managerOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
            while ($managerOp.Status -eq 'Started') { Start-Sleep -Milliseconds 5 }
            $manager = $managerOp.GetResults()
            $session = $manager.GetCurrentSession()

            if ($session -ne $null) {
                $propsOp = $session.TryGetMediaPropertiesAsync()
                while ($propsOp.Status -eq 'Started') { Start-Sleep -Milliseconds 5 }
                $props = $propsOp.GetResults()
                
                $playback = $session.GetPlaybackInfo()
                $timeline = $session.GetTimelineProperties()
                
                $result = @{
                    Title    = $props.Title
                    Artist   = $props.Artist
                    Status   = $playback.PlaybackStatus.ToString()
                    Progress = $timeline.Position.TotalSeconds
                    Duration = $timeline.EndTime.TotalSeconds
                    Method   = "SMTC"
                }
                $result | ConvertTo-Json -Compress | Write-Host
                $found = $true
            }
        } catch { }

        # METHOD 2: Backup - Scan Window Titles for Desktop Apps
        if (-not $found) {
            $processes = Get-Process | Where-Object { $_.MainWindowTitle -ne "" }
            foreach ($p in $processes) {
                if ($p.ProcessName -eq "Spotify") {
                    $parts = $p.MainWindowTitle -split " - ", 2
                    $res = @{
                        Title  = if ($parts.Count -gt 1) { $parts[1] } else { $parts[0] }
                        Artist = if ($parts.Count -gt 1) { $parts[0] } else { "Spotify" }
                        Status = "Playing"
                        Method = "Spotify"
                    }
                    $res | ConvertTo-Json -Compress | Write-Host
                    $found = $true
                    break
                }
                if ($p.MainWindowTitle -like "*YouTube*") {
                    $parts = $p.MainWindowTitle -split " - YouTube"
                    $cleanTitle = $parts[0].Replace("Music", "").Trim()
                    
                    if ($cleanTitle -and $cleanTitle -ne "YouTube") {
                        $res = @{
                            Title  = $cleanTitle
                            Artist = "YouTube"
                            Status = "Playing"
                            Method = "YouTube"
                        }
                        $res | ConvertTo-Json -Compress | Write-Host
                        $found = $true
                        break
                    }
                }
            }
        }

        if (-not $found) {
            "null" | Write-Host
        }

    } catch {
        "null" | Write-Host
    }

    Start-Sleep -Seconds 1
}
