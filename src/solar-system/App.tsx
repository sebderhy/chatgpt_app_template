/**
 * Solar System Widget Template
 *
 * Interactive 3D solar system visualization - perfect for:
 * - Educational content
 * - Interactive data visualizations
 * - Immersive experiences
 * - 3D product showcases
 */

import React, { useRef, useImperativeHandle, useState, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";
import { useWidgetProps } from "../use-widget-props";
import { useDisplayMode } from "../use-display-mode";
import { Maximize2 } from "lucide-react";

type PlanetData = {
  name: string;
  radius: number;
  size: number;
  speed: number;
  physicalSize: number;
  description: string;
};

type ToolOutput = {
  planet_name?: string;
  title?: string;
};

const defaultProps: ToolOutput = {
  title: "Solar System Explorer",
};

/* -------------------------------- util text streaming ------------------------------- */
function StreamWord({ children, index, delay }: { children: React.ReactNode; index: number; delay?: number }) {
  const [isComplete, setIsComplete] = useState(false);
  return isComplete ? (
    <>{children}</>
  ) : (
    <motion.span
      key={index}
      initial={{ opacity: 0, color: "rgba(0,168,255,1)" }}
      animate={{ opacity: 1, color: "rgba(255,255,255,1)" }}
      transition={{
        type: "spring",
        bounce: 0,
        delay: index * 0.015 + 0.14 + (delay || 0),
        duration: 1,
      }}
      onAnimationComplete={() => setIsComplete(true)}
    >
      {children}
    </motion.span>
  );
}

function StreamText({ children, delay }: { children: string; delay?: number }) {
  const words = children.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <StreamWord index={index} delay={delay} key={index}>
          {word}{" "}
        </StreamWord>
      ))}
    </>
  );
}

/* -------------------------------- background stars ------------------------------- */
function SceneBackground() {
  const { scene } = useThree();
  const texture = useLoader(
    THREE.TextureLoader,
    "https://persistent.oaistatic.com/ecosys/stars_8k.webp"
  );
  useEffect(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
  }, [texture, scene]);
  return null;
}

/* -------------------------------- post-processing ------------------------------- */
function Effects({ focusTarget, hasFocus }: { focusTarget: THREE.Vector3; hasFocus: boolean }) {
  const { camera } = useThree();
  const depthOfFieldRef = useRef<any>(null);

  useFrame(() => {
    if (!depthOfFieldRef.current) return;

    if (!hasFocus) {
      depthOfFieldRef.current.bokehScale = 0;
      return;
    }

    const d = camera.position.distanceTo(focusTarget);
    const scale = THREE.MathUtils.clamp(12 - d * 0.75, 0, 12);
    depthOfFieldRef.current.bokehScale = scale;
  });

  return (
    <EffectComposer>
      <DepthOfField
        ref={depthOfFieldRef}
        focusDistance={0}
        focalLength={0.02}
        height={480}
        bokehScale={0}
        target={focusTarget}
      />
      <Bloom
        luminanceThreshold={0}
        luminanceSmoothing={0.25}
        intensity={1.75}
        mipmapBlur
      />
    </EffectComposer>
  );
}

const planets: PlanetData[] = [
  {
    name: "Mercury",
    radius: 2,
    size: 0.2,
    speed: 0.02,
    physicalSize: 4879,
    description:
      "Mercury is the smallest planet in the Solar System and the closest to the Sun. It has a rocky, cratered surface and extreme temperature swings.",
  },
  {
    name: "Venus",
    radius: 3,
    size: 0.35,
    speed: 0.015,
    physicalSize: 12104,
    description:
      "Venus, similar in size to Earth, is cloaked in thick clouds of sulfuric acid with surface temperatures hot enough to melt lead.",
  },
  {
    name: "Earth",
    radius: 4,
    size: 0.38,
    speed: 0.012,
    physicalSize: 12742,
    description:
      "Earth is the only known planet to support life, with liquid water covering 71% of its surface and a protective atmosphere.",
  },
  {
    name: "Mars",
    radius: 5,
    size: 0.25,
    speed: 0.01,
    physicalSize: 6779,
    description:
      "Mars, the Red Planet, shows evidence of ancient rivers and volcanoes and is a prime target in the search for past life.",
  },
  {
    name: "Jupiter",
    radius: 7,
    size: 0.85,
    speed: 0.008,
    physicalSize: 139820,
    description:
      "Jupiter is the largest planet, a gas giant with a Great Red Spot - an enormous storm raging for centuries.",
  },
  {
    name: "Saturn",
    radius: 9,
    size: 0.75,
    speed: 0.006,
    physicalSize: 116460,
    description:
      "Saturn is famous for its stunning ring system composed of billions of ice and rock particles orbiting the planet.",
  },
  {
    name: "Uranus",
    radius: 11,
    size: 0.65,
    speed: 0.0045,
    physicalSize: 50724,
    description:
      "Uranus is an ice giant rotating on its side, giving rise to extreme seasonal variations during its long orbit.",
  },
  {
    name: "Neptune",
    radius: 13,
    size: 0.65,
    speed: 0.0035,
    physicalSize: 49244,
    description:
      "Neptune, the farthest known giant, is a deep-blue world with supersonic winds and a faint ring system.",
  },
];

/* -------------------------------- sun sphere ------------------------------- */
function Sun() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#F6D973" />
    </mesh>
  );
}

/* -------------------------------- saturn ring component ------------------------------- */
function SaturnRing({ planetSize }: { planetSize: number }) {
  const texture = useLoader(
    THREE.TextureLoader,
    "https://persistent.oaistatic.com/ecosys/saturn_ring.webp"
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[planetSize * 1.1, planetSize * 2, 64]} />
      <meshStandardMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

/* -------------------------------- planet component ------------------------------- */
type PlanetProps = {
  name: string;
  radius: number;
  size: number;
  speed: number;
  isOrbiting: boolean;
  onPlanetClick: (position: THREE.Vector3) => void;
};

const Planet = forwardRef<{ getPosition: () => THREE.Vector3 }, PlanetProps>(
  ({ name, radius, size, speed, isOrbiting, onPlanetClick }, ref) => {
    const SPEED_SCALE = 0.2;
    const mesh = useRef<THREE.Mesh>(null);
    const theta = useRef(Math.random() * Math.PI * 2);

    useImperativeHandle(ref, () => ({
      getPosition: () => mesh.current!.position.clone(),
    }));

    const texture = useLoader(
      THREE.TextureLoader,
      `https://persistent.oaistatic.com/ecosys/${name.toLowerCase()}_2k.webp`
    );

    useFrame(() => {
      if (isOrbiting && mesh.current) {
        theta.current += speed * SPEED_SCALE;
        const x = radius * Math.cos(theta.current);
        const z = radius * Math.sin(theta.current);
        mesh.current.position.set(x, 0, z);
      }
    });

    return (
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          if (mesh.current) {
            onPlanetClick(mesh.current.position.clone());
          }
        }}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial map={texture} />
        {name === "Saturn" && <SaturnRing planetSize={size} />}
      </mesh>
    );
  }
);

Planet.displayName = "Planet";

/* -------------------------------- camera tween controller ------------------------------- */
function CameraController({
  targetPosition,
  orbitControlsRef,
  setIsOrbiting,
  initialCameraPosition,
  initialOrbitTarget,
  setFocusTarget,
}: {
  targetPosition: THREE.Vector3 | "initial" | null;
  orbitControlsRef: React.RefObject<any>;
  setIsOrbiting: (v: boolean) => void;
  initialCameraPosition: React.RefObject<THREE.Vector3>;
  initialOrbitTarget: React.RefObject<THREE.Vector3>;
  setFocusTarget: (v: THREE.Vector3) => void;
}) {
  const { camera } = useThree();

  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetCamFocus = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!targetPosition) return;

    if (targetPosition === "initial") {
      targetCamPos.current = initialCameraPosition.current!.clone();
      targetCamFocus.current = initialOrbitTarget.current!.clone();
      setIsOrbiting(true);
      setFocusTarget(new THREE.Vector3(0, 0, 0));
    } else {
      const offset = new THREE.Vector3()
        .subVectors(camera.position, targetPosition)
        .normalize()
        .multiplyScalar(2);
      targetCamPos.current = targetPosition.clone().add(offset);
      targetCamFocus.current = targetPosition.clone();
      setIsOrbiting(false);
      setFocusTarget(targetCamFocus.current.clone());
    }

    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
  }, [targetPosition, camera, initialCameraPosition, initialOrbitTarget, orbitControlsRef, setFocusTarget, setIsOrbiting]);

  useFrame(() => {
    if (!targetCamPos.current || !targetCamFocus.current) return;

    const lerpSpeed = 0.04;
    camera.position.lerp(targetCamPos.current, lerpSpeed);
    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.lerp(targetCamFocus.current, lerpSpeed);
      orbitControlsRef.current.update();
    }

    if (
      camera.position.distanceTo(targetCamPos.current) < 0.05 &&
      orbitControlsRef.current?.target.distanceTo(targetCamFocus.current) < 0.05
    ) {
      targetCamPos.current = null;
      targetCamFocus.current = null;
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = true;
        orbitControlsRef.current.update();
      }
    }
  });

  return null;
}

/* -------------------------------- main solar-system component ------------------------------- */
function SolarSystem() {
  const [isOrbiting, setIsOrbiting] = useState(true);
  const [targetPlanetPosition, setTargetPlanetPosition] = useState<THREE.Vector3 | "initial" | null>(null);
  const props = useWidgetProps<ToolOutput>(defaultProps);

  const currentPlanet = planets.find((planet) => planet.name === props.planet_name) ?? null;

  const [focusTarget, setFocusTarget] = useState(new THREE.Vector3(0, 0, 0));
  const [isReady, setIsReady] = useState(false);

  const orbitControlsRef = useRef<any>(null);
  const initialCameraPosition = useRef(new THREE.Vector3(0, 2, 8));
  const initialOrbitTarget = useRef(new THREE.Vector3(0, 0, 0));
  const planetRefs = useRef<Record<string, { getPosition: () => THREE.Vector3 }>>({});

  useEffect(() => {
    requestAnimationFrame(() => {
      const ref = planetRefs.current[currentPlanet?.name ?? ""];
      if (currentPlanet && ref) {
        const position = ref.getPosition();
        setIsOrbiting(false);
        setTargetPlanetPosition(position);
        setFocusTarget(position);
      } else {
        setIsOrbiting(true);
        setTargetPlanetPosition("initial");
        setFocusTarget(new THREE.Vector3(0, 0, 0));
      }
    });
  }, [currentPlanet, isReady]);

  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(currentPlanet);

  const handlePlanetClick = (planet: PlanetData, position: THREE.Vector3) => {
    setIsOrbiting(false);
    setSelectedPlanet(planet);
    setTargetPlanetPosition(position);
    setFocusTarget(position);
  };

  const handlePointerMissed = () => {
    setIsOrbiting(true);
    setSelectedPlanet(null);
    setTargetPlanetPosition("initial");
    setFocusTarget(new THREE.Vector3(0, 0, 0));
  };

  const displayMode = useDisplayMode() ?? "inline";

  const handleRequestFullscreen = () => {
    if (window.openai?.requestDisplayMode) {
      window.openai?.requestDisplayMode({ mode: "fullscreen" });
    } else if (window.webplus?.requestDisplayMode) {
      window.webplus?.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  const activePlanet = selectedPlanet ?? currentPlanet;

  return (
    <div
      className={`antialiased w-full relative bg-black overflow-hidden rounded-2xl ${
        displayMode !== "fullscreen"
          ? "aspect-[640/480] sm:aspect-[640/400]"
          : "h-screen"
      }`}
    >
      {displayMode !== "fullscreen" && (
        <div className="absolute end-3 z-20 top-3 aspect-square rounded-full p-2 bg-white/20 text-white backdrop-blur-lg">
          <button onClick={handleRequestFullscreen}>
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="relative w-full h-full z-10">
        <Canvas
          camera={{ position: [0, 2, 8], fov: 60 }}
          onCreated={({ camera }) => {
            initialCameraPosition.current.copy(camera.position);
            if (orbitControlsRef.current) {
              initialOrbitTarget.current.copy(orbitControlsRef.current.target);
            }
            setIsReady(true);
          }}
          onPointerMissed={handlePointerMissed}
        >
          <SceneBackground />
          <ambientLight intensity={0.135} />
          <pointLight position={[0, 0, 0]} intensity={18} />
          <directionalLight position={[0, 0, 0]} intensity={0.7} castShadow />
          <OrbitControls ref={orbitControlsRef} />
          <Sun />

          {planets.map((planet) => (
            <Planet
              key={planet.name}
              ref={(ref) => {
                if (ref) planetRefs.current[planet.name] = ref;
              }}
              {...planet}
              isOrbiting={isOrbiting}
              onPlanetClick={(position) => handlePlanetClick(planet, position)}
            />
          ))}

          <Effects focusTarget={focusTarget} hasFocus={activePlanet !== null} />
          <CameraController
            targetPosition={targetPlanetPosition}
            orbitControlsRef={orbitControlsRef}
            setIsOrbiting={setIsOrbiting}
            initialCameraPosition={initialCameraPosition}
            initialOrbitTarget={initialOrbitTarget}
            setFocusTarget={setFocusTarget}
          />
        </Canvas>
      </div>

      {/* Planet info panel */}
      <AnimatePresence>
        {activePlanet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ bounce: 0.2, duration: 0.4, type: "spring" }}
            className="
              absolute inset-0
              flex flex-col justify-end items-center text-center
              pb-4 px-8 sm:p-8
              bg-gradient-to-t from-black/80 to-black/0
              md:bg-gradient-to-r md:from-black md:to-black/0
              md:items-start md:text-left md:justify-start
              md:w-72
              rounded-xl text-white pointer-events-none z-10
            "
          >
            <div className="text-4xl font-medium">
              <StreamText>{activePlanet.name}</StreamText>
            </div>
            <div className="text-sm my-2 font-medium">
              <StreamWord index={0} delay={0.1}>
                {Intl.NumberFormat("en-US", {
                  style: "unit",
                  unit: "kilometer",
                  unitDisplay: "narrow",
                }).format(activePlanet.physicalSize)}
              </StreamWord>
            </div>
            <div className="text-sm my-2">
              <StreamText delay={0.125}>{activePlanet.description}</StreamText>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return <SolarSystem />;
}
