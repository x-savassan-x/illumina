import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import '../styles/CityMetaphor.css';

interface CityMetaphorProps {
  data: any; // For now using any, will be typed properly later
}

const CityMetaphor: React.FC<CityMetaphorProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Basic Three.js setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    
    const camera = new THREE.PerspectiveCamera(
      75, 
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    
    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Add a grid for reference
    const gridHelper = new THREE.GridHelper(100, 20);
    scene.add(gridHelper);
    
    // Add some basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add a simple building as placeholder
    const geometry = new THREE.BoxGeometry(10, 20, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 10, 0);
    scene.add(cube);
    
    // Add text to show that this is a placeholder
    const textDiv = document.createElement('div');
    textDiv.className = 'placeholder-text';
    textDiv.textContent = 'CityMetaphor Placeholder - Real visualization coming soon';
    containerRef.current.appendChild(textDiv);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
        if (textDiv.parentNode) {
          containerRef.current.removeChild(textDiv);
        }
      }
    };
  }, []);
  
  // Log data for debugging
  useEffect(() => {
    if (data) {
      console.log('Received data:', data);
    }
  }, [data]);
  
  return (
    <div className="city-metaphor-container" ref={containerRef}>
      {/* Three.js content will be added here */}
    </div>
  );
};

export default CityMetaphor;