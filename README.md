# AR.js + A-Frame Dual Marker Dynamic Lightning Interaction

A WebAR dual-marker proximity interaction system built on **AR.js**, **A-Frame (v1.6.0)**, and **Three.js**.

---

## 🌟 Key Features

- 🎯 **Simultaneous Dual Marker Detection**: Real-time independent 6-DoF tracking for both Hiro and Kanji markers.
- ⚡ **Procedural Lightning Arcs**: Dynamic multi-branch electric arcs generated between markers via the Midpoint Displacement algorithm.
- 🔮 **Proximity-Scaled Plasma Core**: Midpoint energy core and orbital rings that scale in size and rotate faster as markers approach.
- 💥 **Dynamic Intensity Curves**: Lightning bolt count (1 to 4 bolts), spark particle emissions, light intensity, and visual scale ramp up non-linearly as distance decreases ($D < 3.0\text{m}$ to $D = 0.35\text{m}$), and disappear completely beyond threshold distance.
- 🎛️ **Modern Glassmorphism HUD**: Real-time tracking status indicators, live distance readout, dynamic discharge progress bar, and built-in marker preview modal.
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
│   ├── data/
│   │   └── camera_para.dat     # Local camera calibration file
│   ├── markers/
│   │   ├── pattern-hiro.patt   # Hiro marker pattern file
│   │   ├── pattern-kanji.patt  # Kanji marker pattern file
│   │   └── images/             # Printable / screen-displayable marker images
│   │       ├── hiro.png
│   │       └── kanji.png
│   └── assets/
├── src/
│   ├── lightning-fx.js         # Procedural lightning, plasma core & sparks FX generator
│   ├── proximity-component.js  # A-Frame component tracking distance & driving FX
│   ├── style.css               # Glassmorphism HUD overlay & responsive styles
│   └── main.js                 # Application bootstrap & UI event handlers
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

Click the **"Marker 圖案" (Marker Patterns)** button in the top-right corner of the app to view or download marker patterns, or use the files directly:

- **Marker 1 (Hiro)**: `public/markers/images/hiro.png` (displays glowing rose cube)
- **Marker 2 (Kanji)**: `public/markers/images/kanji.png` (displays glowing cyan octahedron)

When the camera detects a marker, the status card at the bottom will light up and switch to `已鎖定 (Tracking)`.

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
