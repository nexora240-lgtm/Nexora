$ErrorActionPreference = 'Stop'
$region = 'us-east-2'
$functionName = 'nexora-link-admin'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$zip = Join-Path $root 'function.zip'

Push-Location $root
try {
  if (Test-Path (Join-Path $root 'node_modules')) { Remove-Item (Join-Path $root 'node_modules') -Recurse -Force }
  npm.cmd install --omit=dev --no-audit --no-fund | Out-Null
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path index.mjs, package.json, node_modules -DestinationPath $zip -Force
  aws lambda update-function-code --function-name $functionName --zip-file fileb://$zip --region $region --no-cli-pager | Out-Null
  aws lambda wait function-updated --function-name $functionName --region $region
  $envVars = 'Variables={LINKS_TABLE=nexora-linkfinder,USERS_TABLE=NexoraUsers,ADMIN_USERNAMES=oscarsuwey,ALLOWED_ORIGINS=https://thenexoraproject.xyz}'
  aws lambda update-function-configuration --function-name $functionName --runtime nodejs20.x --handler index.handler --timeout 15 --environment $envVars --region $region --no-cli-pager | Out-Null
  aws lambda wait function-updated --function-name $functionName --region $region
  Write-Output "Deployed $functionName"
} finally { Pop-Location }
