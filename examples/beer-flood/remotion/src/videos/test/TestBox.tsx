import React from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EffectComposer } from "@react-three/postprocessing";

const Inner: React.FC = () => (
  <mesh position={[0, 0, 0]}>
    <boxGeometry args={[2, 2, 2]} />
    <meshBasicMaterial color="#ff0000" />
  </mesh>
);

export const TestBox: React.FC = () => (
  <AbsoluteFill style={{ background: "#00ff00" }}>
    <ThreeCanvas width={720} height={1280} camera={{ fov: 40, near: 0.2, far: 1500, position: [0, 0, 6] }}>
      <Inner />
      <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType} />
    </ThreeCanvas>
  </AbsoluteFill>
);
