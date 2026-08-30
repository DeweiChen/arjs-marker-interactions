# AR.js + A-Frame Dual Marker Dynamic Lightning Interaction

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![AR.js](https://img.shields.io/badge/AR.js-3.4.8-green.svg)](https://ar-js-org.github.io/AR.js-Docs/)
[![A-Frame](https://img.shields.io/badge/A--Frame-1.6.0-pink.svg)](https://aframe.io/)
[![Three.js](https://img.shields.io/badge/Three.js-r164-orange.svg)](https://threejs.org/)

A WebAR dual-marker proximity interaction system built on **AR.js**, **A-Frame (v1.6.0)**, and **Three.js**.

---

## 🌟 Key Features

- 🎯 **8 Barcode Marker Support (3x3 Hamming 6,3)**: Real-time simultaneous multi-marker tracking (values 0–7) for testing AR.js stability.
- 🔤 **Custom 3D Emissive Text**: Marker 0 and Marker 1 render primary terminal endpoints, and Markers 2–7 render their respective index numbers (`"2"` to `"7"`).
- ⚡ **Multi-Marker Chain Conduction Interaction**: High-voltage electric arcs continuously chain across visible markers via physical distance (Nearest-Neighbor) routing:
  - **Full Chain**: Connects terminal markers through intermediate number markers (`Marker 0 ➔ [numbers...] ➔ Marker 1`) with dynamic segment gradient colors and traveling plasma sparks.
  - **Direct Arcs**: When no intermediate numbers are present, maintains direct high-voltage electric arcs between the terminal markers.
  - **Half-Chain & Idle Nodes**: Single terminals form partial chains with nearby numbers, while unlinked markers exhibit soft breathing idle pulse auras.
- 🔮 **Proximity-Scaled Plasma & Relay Cores**: Active relay energy crystals at each marker node and midpoint arcs that expand, rotate, and pulse with high-frequency jitter.
- 🎛️ **Live Marker Tracking Bar**: Top HUD telemetry features real-time active detection dots and live chain conduction telemetry (e.g. `[0 ➔ 2 ➔ 4 ➔ 1]`).
- 🖼️ **Standardized Marker Assets**: 8 normalized 600x600 PNG marker patterns with white quiet borders ready for printing or screen display.
- 📱 **Mobile HTTPS Ready**: Includes `@vitejs/plugin-basic-ssl` for local development HTTPS certificates and automated GitHub Pages CI/CD deployment.

---

## 🛠️ Technology Stack & Versions

| Package | Version | Description |
|---|---|---|
| `@ar-js-org/ar.js` | `3.4.8` | Latest community-maintained stable WebAR tracking core |
| `A-Frame` | `1.6.0` | Declarative 3D scene graph & custom component system |
| `three` | `0.164.0` | Core WebGL 3D rendering engine |
| `vite` | `^6.x` | High-performance frontend dev server and bundler |
| `@vitejs/plugin-basic-ssl` | `^2.x` | Local HTTPS certificate plugin for mobile camera testing |
| `pnpm` | `^10.x` | Fast, disk space-efficient package manager |

---

## 📁 Project Structure

```
arjs-marker-interactions/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages automated CI/CD deployment
├── public/
│   ├── fonts/
│   │   └── fredoka_light_regular.json  # 3D Typeface font
│   └── markers/
│       └── images/             # 8 Barcode marker PNGs (0 to 7)
│           ├── barcode-0.png   # Terminal Marker 0
│           ├── barcode-1.png   # Terminal Marker 1
│           └── barcode-[2-7].png # Number Markers 2–7
├── scripts/
│   └── generate-barcode-markers.py # Barcode marker generator
├── src/
│   ├── components/             # Custom A-Frame components
│   ├── core/                   # Font loader, aspect ratio corrector
│   ├── fx/                     # Lightning FX, Birthday FX strategies
│   ├── pages/                  # Application bootstrap
│   ├── ui/                     # HUD telemetry, modal, bloom panel
│   └── style.css               # Glassmorphism HUD overlay & responsive styles
├── index.html                  # Main HTML entry, AR scene & HUD markup
├── vite.config.js              # Vite configuration (base path & HTTPS setup)
├── package.json
└── pnpm-lock.yaml
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Local Development Server
```bash
pnpm run dev
```
The terminal will display:
- Local URL: `https://localhost:5173/arjs-marker-interactions/`
- Network URL: `https://192.168.x.x:5173/arjs-marker-interactions/`

> **Mobile Testing Steps**:
> 1. Connect your mobile device and computer to the same Wi-Fi network.
> 2. Open your mobile browser and navigate to the Network URL (e.g. `https://192.168.x.x:5173/arjs-marker-interactions/`).
> 3. Accept the self-signed certificate (tap "Advanced" -> "Proceed to site").
> 4. Allow camera permissions to start the AR experience.

### 3. Build & Preview
```bash
# Build production bundle to dist/
pnpm run build

# Preview production build locally
pnpm run preview
```

---

## 🔮 Customization & Extension Guide

### 1. Replacing 3D Objects with Photo Textures or Custom Meshes
Use `setMarkerObject` in `src/marker-manager.js`:
```javascript
// Example: Replace Hiro object with a flat photo plane
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('./assets/textures/my-photo.jpg');
const photoGeo = new THREE.PlaneGeometry(1, 1);
const photoMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
const photoMesh = new THREE.Mesh(photoGeo, photoMat);
photoMesh.rotation.x = -Math.PI / 2; // Lie flat on top of the marker

markerManager.setMarkerObject('hiro', photoMesh);
```

### 2. Loading External 3D Models (GLTF / GLB)
```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('./assets/models/my-model.glb', (gltf) => {
  const model = gltf.scene;
  model.scale.set(0.5, 0.5, 0.5);
  markerManager.setMarkerObject('hiro', model);
});
```

### 3. Adding Custom Markers (.patt)
Generate custom `.patt` files using the [AR.js Marker Training Generator](https://ar-js-org.github.io/AR.js/three.js/examples/marker-training/examples/generator.html):
1. Place the generated `.patt` file in `public/markers/`.
2. Register it via `markerManager.addCustomMarker('my-marker', './markers/pattern-custom.patt', myObject)`.

---

## 🌐 GitHub Pages Deployment

This project includes a pre-configured GitHub Actions workflow (`.github/workflows/deploy.yml`):

1. Create a GitHub repository named `arjs-marker-interactions`.
2. Push your local repository to the `main` branch:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/arjs-marker-interactions.git
   git branch -M main
   git push -u origin main
   ```
3. In your GitHub repository settings:
   - Navigate to **Settings** -> **Pages**.
   - Set **Build and deployment > Source** to **GitHub Actions**.
4. Once deployed, access the app at `https://<YOUR_GITHUB_USERNAME>.github.io/arjs-marker-interactions/` with automatic HTTPS.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for the full license text.

```text
MIT License

Copyright (c) 2026 DW

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
