param(
    [string]$InputVideo = 'output/playwright/transitlab-v05-raw.webm',
    [string]$OutputVideo = 'output/playwright/transitlab-v05-demo-final.mp4'
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $OutputVideo) { throw "Output already exists: $OutputVideo" }
$subtitleText = Get-Content -Raw -LiteralPath 'docs/demo-video-en-v0.5.srt'
$subtitleBlocks = $subtitleText.Trim() -split '\r?\n\r?\n'
$filters = [System.Collections.Generic.List[string]]::new()
$filters.Add('pad=iw:ih+90:0:0:color=0x07130f')
foreach ($block in $subtitleBlocks) {
    $lines = $block -split '\r?\n'
    $times = $lines[1] -split ' --> '
    $from = [TimeSpan]::Parse($times[0].Replace(',', '.')).TotalSeconds.ToString([Globalization.CultureInfo]::InvariantCulture)
    $to = [TimeSpan]::Parse($times[1].Replace(',', '.')).TotalSeconds.ToString([Globalization.CultureInfo]::InvariantCulture)
    $caption = ($lines[2..($lines.Length - 1)] -join ' ').Replace('\', '\\').Replace(':', '\:').Replace("'", "’")
    $filters.Add("drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='$caption':fontsize=26:fontcolor=0xf1f7f3:x=(w-text_w)/2:y=h-55:enable='gte(t,$from)*lt(t,$to)'")
}
& ffmpeg -hide_banner -loglevel warning -i $InputVideo -vf ($filters -join ',') -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart -an $OutputVideo
if ($LASTEXITCODE -ne 0) { throw 'Video encoding failed' }
& ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of json $OutputVideo
if ($LASTEXITCODE -ne 0) { throw 'Video verification failed' }
