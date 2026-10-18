# POS Desktop App Icon Generator
$buildDir = "c:\Users\Yaras\pos-frontend\build"
if (!(Test-Path -Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
}

Add-Type -AssemblyName System.Drawing

function Create-PosIcon {
    param([int]$size)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $cTop = [System.Drawing.Color]::FromArgb(15, 23, 42)    # Slate 900
    $cBottom = [System.Drawing.Color]::FromArgb(30, 41, 59) # Slate 800
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45)
    
    # Rounded container path
    $radius = [int]($size * 0.22)
    $diameter = $radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $margin = [int]($size * 0.04)
    $box = New-Object System.Drawing.Rectangle($margin, $margin, ($size - 2 * $margin), ($size - 2 * $margin))
    
    $path.AddArc($box.X, $box.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($box.Right - $diameter, $box.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($box.Right - $diameter, $box.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($box.X, $box.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    $g.FillPath($bgBrush, $path)

    # Gradient border
    $cBorder1 = [System.Drawing.Color]::FromArgb(79, 70, 229)   # Indigo 600
    $cBorder2 = [System.Drawing.Color]::FromArgb(6, 182, 212)   # Cyan 500
    $borderBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($box, $cBorder1, $cBorder2, 45)
    $pen = New-Object System.Drawing.Pen($borderBrush, [Math]::Max(1.0, ($size * 0.04)))
    $g.DrawPath($pen, $path)

    # Cash register / Shopping basket symbol
    # Center emblem
    $cIcon1 = [System.Drawing.Color]::FromArgb(56, 189, 248)  # Sky 400
    $cIcon2 = [System.Drawing.Color]::FromArgb(99, 102, 241)  # Indigo 500
    $iconBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cIcon1, $cIcon2, 90)
    $iconPen = New-Object System.Drawing.Pen($iconBrush, [Math]::Max(1.5, ($size * 0.055)))
    $iconPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $iconPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Shopping cart outline
    $w = $size
    $ptA = New-Object System.Drawing.PointF(($w * 0.22), ($w * 0.32))
    $ptB = New-Object System.Drawing.PointF(($w * 0.34), ($w * 0.32))
    $ptC = New-Object System.Drawing.PointF(($w * 0.44), ($w * 0.62))
    $ptD = New-Object System.Drawing.PointF(($w * 0.76), ($w * 0.62))
    $ptE = New-Object System.Drawing.PointF(($w * 0.82), ($w * 0.40))
    $ptF = New-Object System.Drawing.PointF(($w * 0.38), ($w * 0.40))

    $g.DrawLine($iconPen, $ptA, $ptB)
    $g.DrawLine($iconPen, $ptB, $ptC)
    $g.DrawLine($iconPen, $ptC, $ptD)
    $g.DrawLine($iconPen, $ptD, $ptE)
    $g.DrawLine($iconPen, $ptE, $ptF)

    # Cart wheels
    $wheelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 185, 129)) # Emerald 500
    $wheelR = [int]($size * 0.055)
    $g.FillEllipse($wheelBrush, [int]($w * 0.43 - $wheelR), [int]($w * 0.74 - $wheelR), ($wheelR * 2), ($wheelR * 2))
    $g.FillEllipse($wheelBrush, [int]($w * 0.72 - $wheelR), [int]($w * 0.74 - $wheelR), ($wheelR * 2), ($wheelR * 2))

    # POS badge / checkmark or lightning symbol inside cart
    $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11)) # Amber 500
    $badgeRect = New-Object System.Drawing.Rectangle([int]($w * 0.52), [int]($w * 0.24), [int]($w * 0.28), [int]($w * 0.16))
    $g.FillRectangle($badgeBrush, $badgeRect)
    
    # Text on badge: POS
    $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    $fontSize = [Math]::Max(6.0, ($size * 0.08))
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("POS", $font, $textBrush, [System.Drawing.RectangleF]$badgeRect, $format)

    $g.Dispose()
    return $bmp
}

# 1. Generate 512x512 master PNG
$masterBmp = Create-PosIcon -size 512
$masterBmp.Save("$buildDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$masterBmp.Save("c:\Users\Yaras\pos-frontend\public\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Created build/icon.png & public/icon.png (512x512)"

# 2. Build multi-resolution ICO file (256, 128, 64, 48, 32, 16)
$sizes = @(256, 128, 64, 48, 32, 16)
$imagesData = @()

foreach ($s in $sizes) {
    $img = Create-PosIcon -size $s
    $ms = New-Object System.IO.MemoryStream
    $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $imagesData += ,@($s, $bytes)
    $ms.Dispose()
    $img.Dispose()
}

$icoFs = [System.IO.File]::Create("$buildDir\icon.ico")
$icoWriter = New-Object System.IO.BinaryWriter($icoFs)

# ICONDIR header: 6 bytes
$icoWriter.Write([uint16]0) # Reserved
$icoWriter.Write([uint16]1) # 1 = Icon
$icoWriter.Write([uint16]$sizes.Length) # Image count

$offset = 6 + ($sizes.Length * 16)

# Directory entries
foreach ($item in $imagesData) {
    $s = $item[0]
    $data = $item[1]
    
    $widthByte = if ($s -ge 256) { 0 } else { [byte]$s }
    $heightByte = if ($s -ge 256) { 0 } else { [byte]$s }
    
    $icoWriter.Write([byte]$widthByte)
    $icoWriter.Write([byte]$heightByte)
    $icoWriter.Write([byte]0) # Color count
    $icoWriter.Write([byte]0) # Reserved
    $icoWriter.Write([uint16]1) # Color planes
    $icoWriter.Write([uint16]32) # Bits per pixel
    $icoWriter.Write([uint32]$data.Length) # Image size in bytes
    $icoWriter.Write([uint32]$offset) # Offset
    
    $offset += $data.Length
}

# Image payloads (PNG format)
foreach ($item in $imagesData) {
    $icoWriter.Write($item[1])
}

$icoWriter.Flush()
$icoWriter.Close()
$icoFs.Close()

Write-Output "Created build/icon.ico successfully with multi-resolution sizes: $($sizes -join ', ')"
