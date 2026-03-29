# Java Safe Integration

This folder shows the safest Java integration pattern for this CMS:

- JDBC for read-only/reporting use cases.
- Node API for writes (so auth and business rules stay consistent).

## Prerequisites

- Java 17+
- Maven
- CMS backend running (`node backend/server.js`)

## 1) JDBC Read-Only Check

Set DB environment variables (PowerShell example):

```powershell
$env:CMS_DB_HOST="localhost"
$env:CMS_DB_PORT="3306"
$env:CMS_DB_NAME="cms_db"
$env:CMS_DB_USER="root"
$env:CMS_DB_PASS="your_mysql_password"
```

Run:

```powershell
cd java-safe-integration
mvn -q -DskipTests exec:java -Dexec.mainClass=com.inkcms.ReadOnlyJdbcCheck
```

## 2) API Write Demo (Safe Write Path)

Set API/login environment variables:

```powershell
$env:CMS_API_BASE="http://localhost:5001/api"
$env:CMS_API_EMAIL="you@example.com"
$env:CMS_API_PASSWORD="your_password"
```

Run:

```powershell
cd java-safe-integration
mvn -q -DskipTests exec:java -Dexec.mainClass=com.inkcms.ApiWriteDemo
```

If your backend is on port `5000`, set:

```powershell
$env:CMS_API_BASE="http://localhost:5000/api"
```
