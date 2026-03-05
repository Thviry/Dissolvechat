# GitHub Actions CI — Cross-Platform Build Design

**Date:** 2026-03-04
**Status:** Approved

## Problem

The GitHub release only contains a Windows `.exe`. Mac users hit a 404 when clicking the macOS download on the landing page. Cross-compiling from Windows is not possible for macOS or Linux Tauri apps.

## Solution

Use GitHub Actions with `tauri-action` (official Tauri GitHub Action) to build all three platforms on their native runners automatically on every release tag push.

## Workflow Design

**Trigger:** `push` on tags matching `v*.*.*`

**Jobs:** 3 parallel jobs on native runners
- `build-windows` → `windows-latest` → `.exe` (NSIS installer)
- `build-macos` → `macos-latest` → `.dmg` (universal)
- `build-linux` → `ubuntu-latest` → `.AppImage`

**Package manager:** pnpm (matches workspace setup)

**Steps per job:**
1. Checkout repo
2. Install pnpm
3. Install Node dependencies (`pnpm install`)
4. Install Rust stable toolchain
5. Install Linux system deps (Linux job only — webkit2gtk, etc.)
6. Run `tauri-action` → builds + uploads artifact to matching GitHub release

**Output:** All 3 artifacts auto-attached to the GitHub release that triggered the workflow.

## Code Signing

macOS apps will be **unsigned** (no Apple Developer account). Users see a Gatekeeper warning on first launch. Workaround: right-click → Open.

A note will be added to the landing page under the macOS download button explaining this.

## Files Changed

- `.github/workflows/release.yml` — new workflow file
- `landing/index.html` — add macOS Gatekeeper note under Mac download button
