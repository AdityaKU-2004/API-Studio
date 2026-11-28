# API Studio

API Studio is a modern API development and testing desktop application built with **Tauri 2**, **Rust**, **React**, **TypeScript**, **Vite**, and **Tailwind CSS**.

### Linux Installation (.deb)

GitHub Actions automatically compiles the React frontend and Tauri 2 Rust desktop application on `ubuntu-latest` (`x86_64-unknown-linux-gnu`) via [`.github/workflows/build-deb.yml`](.github/workflows/build-deb.yml) and packages a Debian installer (`.deb`).

#### 1. Download from GitHub Actions Artifacts (Branch, PR, or Manual Builds)
1. Open the repository's **Actions** tab on GitHub and select the **Build Linux Debian Package (.deb)** workflow.
2. Open a completed workflow run (for a push to `main`, a pull request targeting `main`, or a manual `workflow_dispatch` run).
3. Scroll to the **Artifacts** section and download **`api-studio-linux-deb`** (retained for 30 days).
4. Extract the downloaded ZIP archive to access the `.deb` installer file.

#### 2. Download from GitHub Releases (Tagged Releases)
1. Open the repository's **Releases** page on GitHub.
2. Select the desired release (for example, `API Studio v2.0.0` or `API Studio v1.0.0`).
3. Under **Assets**, download the attached `.deb` package (for example, `API-Studio_2.0.0_amd64.deb`).

#### 3. Install on Ubuntu / Debian
Install the downloaded `.deb` package using `apt` so system dependencies are resolved automatically:

```bash
sudo apt install ./API-Studio_1.0.0_amd64.deb
```

> **Note:** The `.deb` filename and version segment (for example, `1.0.0` or `2.0.0`) change with each release to match the version configured in `src-tauri/tauri.conf.json` / `package.json`. Replace the filename above with the exact `.deb` file you downloaded.

#### 4. Trigger a New Tagged GitHub Release
To trigger an automated Debian build and publish a new GitHub Release with the `.deb` asset attached, create and push a semantic version tag matching `v*`:

```bash
git tag v1.0.0
git push origin v1.0.0
```
