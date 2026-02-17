
$json = Get-Content "d:\steepanProjects\sillobite\client\public\lottiefiles\Food.json" -Raw | ConvertFrom-Json
$layers = $json.layers
$lastLayer = $layers[$layers.Count - 1]
Write-Output "Last Layer Name: $($lastLayer.nm)"
Write-Output "Last Layer Type: $($lastLayer.ty)"
Write-Output "Last Layer Index: $($lastLayer.ind)"
if ($lastLayer.sc) {
    Write-Output "Solid Color: $($lastLayer.sc)"
}
if ($lastLayer.shapes) {
    Write-Output "Has Shapes"
    foreach ($shape in $lastLayer.shapes) {
         if ($shape.it) {
            foreach ($item in $shape.it) {
                 if ($item.ty -eq "fl") {
                     Write-Output "Fill Color: $($item.c.k)"
                 }
                 if ($item.ty -eq "gr") {
                     # Recursive check might be needed but let's check first level group
                     foreach ($subitem in $item.it) {
                         if ($subitem.ty -eq "fl") {
                             Write-Output "Group Fill Color: $($subitem.c.k)"
                         }
                     }
                 }
            }
         }
    }
}
