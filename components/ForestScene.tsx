"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Id } from "@/convex/_generated/dataModel";

export interface ForestTree {
  _id: Id<"trees">;
  title: string;
  nodeCount: number;
}

export interface ForestPatch {
  _id: Id<"gardens"> | null;
  name: string;
  color: string;
  trees: ForestTree[];
}

interface Props {
  patches: ForestPatch[];
}

const TREE_COLORS = ["#4ade80", "#22c55e", "#34d399", "#86efac", "#16a34a"];
const TRUNK_COLOR = "#b08968";
const PATCH_TILE = 2.6;
const PATCH_SPACING = 11;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function treeScale(nodeCount: number): number {
  return Math.min(1.6, 0.55 + Math.sqrt(Math.max(1, nodeCount)) * 0.3);
}

function makeTree(color: string, scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.55, 6),
    new THREE.MeshLambertMaterial({ color: TRUNK_COLOR }),
  );
  trunk.position.y = 0.27 * scale;
  trunk.scale.setScalar(scale);
  group.add(trunk);

  const material = new THREE.MeshLambertMaterial({ color });
  const layers = [
    { radius: 0.62, height: 0.85, y: 0.95 },
    { radius: 0.47, height: 0.72, y: 1.45 },
    { radius: 0.3, height: 0.6, y: 1.9 },
  ];
  for (const layer of layers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(layer.radius, layer.height, 7),
      material,
    );
    cone.position.y = layer.y * scale;
    cone.scale.setScalar(scale);
    group.add(cone);
  }
  return group;
}

interface PatchLayout {
  patch: ForestPatch;
  origin: THREE.Vector3;
  radius: number;
  hitMesh: THREE.Mesh;
}

export function ForestScene({ patches }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [hovered, setHovered] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [labels, setLabels] = useState<
    { name: string; url: string; x: number; y: number }[]
  >([]);


  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? "#0f172a" : "#e0f2e9");
    scene.fog = new THREE.Fog(dark ? "#0f172a" : "#e0f2e9", 30, 70);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.borderRadius = "1rem";

    const camera = new THREE.OrthographicCamera();
    camera.position.set(16, 22, 16);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.7 : 1.1));
    const sun = new THREE.DirectionalLight(0xfff3d6, dark ? 1.2 : 1.6);
    sun.position.set(8, 18, 6);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 28, 0.5, 48),
      new THREE.MeshLambertMaterial({ color: dark ? "#14532d" : "#a7d7a9" }),
    );
    ground.position.y = -0.26;
    scene.add(ground);

    const clickable: THREE.Object3D[] = [];
    const treeGroups: { group: THREE.Group; treeId: string; baseY: number }[] =
      [];
    const layouts: PatchLayout[] = [];

    const cols = Math.max(1, Math.ceil(Math.sqrt(patches.length)));
    patches.forEach((patch, patchIndex) => {
      const col = patchIndex % cols;
      const row = Math.floor(patchIndex / cols);
      const cx = (col - (cols - 1) / 2) * PATCH_SPACING;
      const cz = (row - (Math.ceil(patches.length / cols) - 1) / 2) *
        PATCH_SPACING;

      const tiles = Math.ceil(Math.sqrt(Math.max(1, patch.trees.length)));
      const radius = Math.max(2.4, (tiles * PATCH_TILE) / 2 + 0.8);
      const patchMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius + 0.25, 0.4, 24),
        new THREE.MeshLambertMaterial({
          color: patch._id ? (patch.color ?? "#64748b") : dark
            ? "#365a40"
            : "#8fbf92",
        }),
      );
      patchMesh.position.set(cx, 0.05, cz);
      patchMesh.userData = {
        url: patch._id ? `/forest/${patch._id}` : null,
        label: patch.name,
      };
      scene.add(patchMesh);
      clickable.push(patchMesh);
      layouts.push({
        patch,
        origin: new THREE.Vector3(cx, 0.25, cz),
        radius,
        hitMesh: patchMesh,
      });

      patch.trees.forEach((tree, i) => {
        const tx = (i % tiles) - (tiles - 1) / 2;
        const tz = Math.floor(i / tiles) - (tiles - 1) / 2;
        const scale = treeScale(tree.nodeCount);
        const color = TREE_COLORS[hashString(tree._id) % TREE_COLORS.length];
        const group = makeTree(color, scale);
        group.position.set(
          cx + tx * PATCH_TILE,
          0.22,
          cz + tz * PATCH_TILE,
        );
        group.userData = { url: `/tree/${tree._id}`, label: tree.title };
        group.traverse((obj) => {
          obj.userData = { url: `/tree/${tree._id}`, label: tree.title };
          clickable.push(obj);
        });
        scene.add(group);
        treeGroups.push({ group, treeId: tree._id, baseY: 0.22 });
      });
    });

    const extentX = Math.max(
      ...layouts.map((l) => Math.abs(l.origin.x) + l.radius),
      8,
    );
    const extentZ = Math.max(
      ...layouts.map((l) => Math.abs(l.origin.z) + l.radius),
      8,
    );

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredGroup: THREE.Group | null = null;

    function worldToScreen(world: THREE.Vector3) {
      const rect = renderer.domElement.getBoundingClientRect();
      const v = world.clone().project(camera);
      return {
        x: ((v.x + 1) / 2) * rect.width,
        y: ((1 - v.y) / 2) * rect.height,
      };
    }

    function updateLabels() {
      setLabels(
        layouts.map(({ patch, origin, radius }) => ({
          name: patch.name,
          url: patch._id ? `/forest/${patch._id}` : "",
          ...worldToScreen(origin.clone().setZ(origin.z - radius - 0.4)),
        })),
      );
    }

    function resize() {
      const { clientWidth: w, clientHeight: h } = mount!;
      renderer.setSize(w, h);
      const aspect = w / h;
      const halfHeight = Math.max(
        extentZ + 2.5,
        (extentX + 2.5) / aspect,
      );
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      updateLabels();
    }
    resize();
    window.addEventListener("resize", resize);

    function pick(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0];
      return hit?.object ?? null;
    }

    function onMove(event: PointerEvent) {
      const obj = pick(event);
      const rect = renderer.domElement.getBoundingClientRect();
      if (hoveredGroup) {
        hoveredGroup.scale.setScalar(1);
        hoveredGroup = null;
      }
      if (obj) {
        const group = obj.parent instanceof THREE.Group ? obj.parent : null;
        const label = (obj.userData.label as string) ?? "";
        if (group) {
          hoveredGroup = group;
          group.scale.setScalar(1.08);
        }
        setHovered({
          label,
          x: event.clientX - rect.left + 12,
          y: event.clientY - rect.top - 8,
        });
        mount!.style.cursor = obj.userData.url ? "pointer" : "default";
      } else {
        setHovered(null);
        mount!.style.cursor = "default";
      }
    }

    function onClick(event: PointerEvent) {
      const obj = pick(event);
      const url = obj?.userData.url as string | null | undefined;
      if (url) router.push(url);
    }

    mount.addEventListener("pointermove", onMove as EventListener);
    mount.addEventListener("click", onClick as EventListener);

    const clock = new THREE.Clock();
    let frame = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      treeGroups.forEach(({ group }, i) => {
        if (group !== hoveredGroup) {
          group.position.y =
            treeGroups[i].baseY + Math.sin(t * 0.9 + i * 1.7) * 0.05;
        }
      });
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", onMove as EventListener);
      mount.removeEventListener("click", onClick as EventListener);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
    };
  }, [patches, router]);

  return (
    <div className="relative">
      <div ref={mountRef} className="h-[70vh] w-full overflow-hidden" />
      {labels.map((label, i) => (
        <button
          key={`${label.name}-${i}`}
          onClick={() => label.url && router.push(label.url)}
          className="pointer-events-auto absolute -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:bg-slate-800/85 dark:text-slate-200 dark:hover:bg-slate-800"
          style={{ left: label.x, top: label.y - 6 }}
        >
          {label.name}
        </button>
      ))}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-56 truncate rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-slate-100/90 dark:text-slate-900"
          style={{ left: hovered.x, top: hovered.y }}
        >
          {hovered.label}
        </div>
      )}
    </div>
  );
}
