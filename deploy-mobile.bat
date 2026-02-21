@echo off
REM Mobile Version Deployment Script
REM यह script mobile version को deploy करने में मदद करता है

echo ====================================
echo FWF Mobile Version Deployment
echo ====================================
echo.

echo [1/4] Checking files...
if not exist "m\index.html" (
    echo ERROR: Mobile files not found!
    echo Please make sure m\index.html exists.
    pause
    exit /b 1
)
echo ✓ Mobile files found

echo.
echo [2/4] Adding files to git...
git add m/
git add assets/css/mobile.css
git add assets/js/mobile-detect.js
git add assets/js/lazy-load.js
git add manifest.json
git add service-worker.js
git add vercel.json
git add index.html
git add MOBILE_VERSION_README.md

echo ✓ Files added to git

echo.
echo [3/4] Committing changes...
git commit -m "Added mobile-optimized version with PWA support"

if errorlevel 1 (
    echo No changes to commit or commit aborted.
    pause
    exit /b 1
)
echo ✓ Changes committed

echo.
echo [4/4] Pushing to repository...
git push

if errorlevel 1 (
    echo ERROR: Failed to push to repository
    echo Please check your git configuration and try again.
    pause
    exit /b 1
)

echo.
echo ====================================
echo ✓ Deployment Complete!
echo ====================================
echo.
echo Your mobile version will be live in a few minutes.
echo Check: https://your-domain.vercel.app/m/index.html
echo.
echo To test locally:
echo 1. cd backend
echo 2. npm start
echo 3. Open: http://localhost:3000/m/index.html
echo.
pause
