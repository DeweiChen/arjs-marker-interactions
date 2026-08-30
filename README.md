# AR.js + A-Frame Dual Marker Dynamic Lightning Interaction

A WebAR dual-marker proximity interaction system built on **AR.js**, **A-Frame (v1.6.0)**, and **Three.js**.

---

## 🌟 Key Features

- 🎯 **8 Barcode Marker Support (3x3 Hamming 6,3)**: Real-time simultaneous multi-marker tracking (values 0–7) for testing AR.js stability.
- 🔤 **Custom 3D Emissive Text**: Marker 0 renders `"Fu"`, Marker 1 renders `"DW"`, and Markers 2–7 render their respective index numbers (`"2"` to `"7"`).
- ⚡ **Dedicated Proximity Electric Arcs**: High-voltage electric arcs and energy core expansion triggered exclusively when Marker 0 ("Fu") and Marker 1 ("DW") are brought close together.
- 🔮 **Proximity-Scaled Plasma Core**: Midpoint energy core and orbital rings that scale in size and rotate faster as Fu and DW approach.
- 🎛️ **Live Marker Tracking Bar**: Top HUD telemetry features real-time active detection dots for all 8 markers (0–7) to evaluate multi-marker tracking performance.
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
│           ├── barcode-0.png   # "Fu"
│           ├── barcode-1.png   # "DW"
│           └── barcode-[2-7].png # "2" - "7"
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

## 🎯 Marker Testing & Patterns

Click the **"Markers"** button in the top HUD to view or download all 8 marker patterns:

| Marker ID | 3D Text / Number | Color | Interaction |
|:---:|:---:|:---:|:---:|
| **Barcode 0** | `"Fu"` | Morandi Green (`#00cba9`) | Electric arc with Barcode 1 |
| **Barcode 1** | `"DW"` | Deep Cobalt Blue (`#0077ff`) | Electric arc with Barcode 0 |
| **Barcode 2** | `"2"` | Orchid Purple (`#e879f9`) | Standalone 3D Text |
| **Barcode 3** | `"3"` | Amber Gold (`#f59e0b`) | Standalone 3D Text |
| **Barcode 4** | `"4"` | Rose Pink (`#f43f5e`) | Standalone 3D Text |
| **Barcode 5** | `"5"` | Lime Green (`#84cc16`) | Standalone 3D Text |
| **Barcode 6** | `"6"` | Cyan Teal (`#06b6d4`) | Standalone 3D Text |
| **Barcode 7** | `"7"` | Coral Orange (`#fb923c`) | Standalone 3D Text |

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

## 📜 Git Commit History

- `ba3aa3a` - `feat: init project with three.js r164 + ar.js 3.4.8`
- `9018f5c` - `feat: add vite config and github pages deployment`
- `9e2b4ee` - `feat: setup AR.js + Three.js core scene`
- `9d6ad58` - `feat: add dual marker detection with 3D objects`
- `aea45c6` - `docs: add development and deployment guide`
