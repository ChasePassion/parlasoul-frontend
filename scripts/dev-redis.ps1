param(
    [ValidateSet("start", "stop", "status")]
    [string]$Action = "start"
)

$ErrorActionPreference = "Stop"

$containerName = "parlasoul-redis"
$hostPort = 6380
$image = "redis:7.4-alpine"

function Require-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "docker is not installed or not available in PATH."
    }
}

function Get-ContainerId {
    $containerId = docker ps -aq --filter "name=$containerName"
    $first = $containerId | Select-Object -First 1
    if ($null -eq $first) {
        return ""
    }
    return "$first".Trim()
}

function Get-RunningContainerId {
    $containerId = docker ps -q --filter "name=$containerName"
    $first = $containerId | Select-Object -First 1
    if ($null -eq $first) {
        return ""
    }
    return "$first".Trim()
}

function Start-RedisContainer {
    $existingContainerId = Get-ContainerId
    if ($existingContainerId) {
        $runningContainerId = Get-RunningContainerId
        if ($runningContainerId) {
            Write-Host "Redis is already running. container=$containerName port=$hostPort"
            return
        }

        docker start $containerName | Out-Null
        Write-Host "Redis started. container=$containerName port=$hostPort"
        return
    }

    docker run -d --name $containerName -p "${hostPort}:6379" $image | Out-Null
    Write-Host "Redis created and started. container=$containerName port=$hostPort image=$image"
}

function Stop-RedisContainer {
    $runningContainerId = Get-RunningContainerId
    if (-not $runningContainerId) {
        Write-Host "Redis is not running. container=$containerName"
        return
    }

    docker stop $containerName | Out-Null
    Write-Host "Redis stopped. container=$containerName"
}

function Show-RedisStatus {
    $existingContainerId = Get-ContainerId
    if (-not $existingContainerId) {
        Write-Host "Redis container does not exist. container=$containerName port=$hostPort"
        return
    }

    $runningContainerId = Get-RunningContainerId
    if ($runningContainerId) {
        Write-Host "Redis is running. container=$containerName port=$hostPort"
        return
    }

    Write-Host "Redis container exists but is not running. container=$containerName port=$hostPort"
}

Require-Docker

switch ($Action) {
    "start" {
        Start-RedisContainer
    }
    "stop" {
        Stop-RedisContainer
    }
    "status" {
        Show-RedisStatus
    }
}
