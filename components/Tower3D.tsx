'use client';
import { useRef, useMemo } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Tower, Bin, sectionAt } from '@/lib/tower-model';
import { COLORS } from '@/lib/scheme';
import type { ReactElement } from 'react';

const R = 1.25, HTOT = 2.6;

function faceBasis(column: number) {
  const a0 = column * Math.PI / 3, a1 = (column + 1) * Math.PI / 3;
  const v0 = new THREE.Vector3(R * Math.cos(a0), 0, R * Math.sin(a0));
  const v1 = new THREE.Vector3(R * Math.cos(a1), 0, R * Math.sin(a1));
  const center = v0.clone().add(v1).multiplyScalar(0.5);
  const along = v1.clone().sub(v0);
  const width = along.length();
  along.normalize();
  const normal = new THREE.Vector3(Math.cos((column + 0.5) * Math.PI / 3), 0,
                                   Math.sin((column + 0.5) * Math.PI / 3));
  return { center, along, width, normal };
}

function Cell({ position, quaternion, w, h, color, onClick }: {
  position: THREE.Vector3; quaternion: THREE.Quaternion; w: number; h: number;
  color: string; onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <mesh position={position} quaternion={quaternion} onClick={onClick}>
      <boxGeometry args={[w * 0.96, h * 0.92, 0.12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function TowerMesh({ tower, onPick }: { tower: Tower; onPick: (b: Bin) => void }) {
  const rows = tower.layers + 1;
  const rowH = HTOT / rows;
  const cells = useMemo(() => {
    const out: ReactElement[] = [];
    for (let column = 0; column < 6; column++) {
      const { center, along, width, normal } = faceBasis(column);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      for (let row = 0; row < rows; row++) {
        const yTop = HTOT / 2 - row * rowH, yc = yTop - rowH / 2;
        const isHeader = row === 0;
        const count = isHeader ? 1 : sectionAt(tower, column, row).binCount;
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) / count - 0.5;
          const pos = center.clone().addScaledVector(normal, 0.06)
            .addScaledVector(along, u * width).setY(yc);
          const color = isHeader
            ? (tower.scheme.columnType === 'color' ? COLORS[column] : '#dfe6ec')
            : '#f4f6f8';
          out.push(
            <Cell key={`${column}-${row}-${j}`} position={pos} quaternion={quat}
              w={width / count} h={rowH} color={color}
              onClick={isHeader ? undefined : (e) => { e.stopPropagation();
                onPick({ column, rowFromTop: row, leftRank: j + 1 }); }} />
          );
        }
      }
    }
    return out;
  }, [tower, onPick, rows, rowH]);

  return (
    <group>
      {cells}
      <mesh position={[0, HTOT / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R, 6]} />
        <meshStandardMaterial color="#cfd6dd" />
      </mesh>
    </group>
  );
}

export default function Tower3D({ tower, onPick }: { tower: Tower; onPick: (b: Bin) => void }) {
  const groupRot = useRef(0.5);
  const dragging = useRef(false);
  const moved = useRef(0);
  const lastX = useRef(0);
  const group = useRef<THREE.Group>(null);

  return (
    <div
      style={{ width: '100%', height: 520, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={(e) => { dragging.current = true; moved.current = 0; lastX.current = e.clientX; }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastX.current; lastX.current = e.clientX;
        moved.current += Math.abs(dx);
        groupRot.current += dx * 0.01;
        if (group.current) group.current.rotation.y = groupRot.current;
      }}
      onPointerUp={() => { dragging.current = false; }}
    >
      <Canvas
        camera={{ position: [0, 1.6, 5.2], fov: 42 }}
        onPointerMissed={() => {}}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={0.7} />
        <group ref={group} rotation={[0, groupRot.current, 0]}>
          <TowerMesh tower={tower} onPick={(b) => { if (moved.current < 6) onPick(b); }} />
        </group>
      </Canvas>
    </div>
  );
}
