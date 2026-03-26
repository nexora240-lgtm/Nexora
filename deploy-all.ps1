$projects = @(
    "fire02",
    "fire06",
    "fire18",
    "fire21",
    "fire25",
    "fire30",
    "fire32",
    "fire36",
    "fire38",
    "fire40",
    "fire42"
)

foreach ($alias in $projects) {
    Write-Host "`n=== Deploying to $alias ===" -ForegroundColor Cyan
    firebase use $alias
    firebase deploy --only hosting
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to deploy to $alias" -ForegroundColor Red
    } else {
        Write-Host "Successfully deployed to $alias" -ForegroundColor Green
    }
}

Write-Host "`nAll deployments complete!" -ForegroundColor Yellow
