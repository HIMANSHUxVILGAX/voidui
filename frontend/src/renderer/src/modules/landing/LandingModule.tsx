import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'

interface LandingModuleProps {
  activeMod: string
  onSwitchModule: (modId: string) => void
  onOpenSettings?: () => void
}

export const LandingModule: React.FC<LandingModuleProps> = ({
  activeMod,
  onSwitchModule,
  onOpenSettings
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorDotRef = useRef<HTMLDivElement>(null)
  const cursorFollowerRef = useRef<HTMLDivElement>(null)
  const compassRef = useRef<HTMLDivElement>(null)
  const [activeSectionIdx, setActiveSectionIdx] = useState<number>(0)

  // -------------------------------------------------------------
  // 1. THREE.JS 3D WEBGL PARTICLE SYSTEM
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animFrameId: number
    const N = 300000

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050505, 0.002)

    const getW = () => containerRef.current ? containerRef.current.clientWidth : window.innerWidth
    const getH = () => containerRef.current ? containerRef.current.clientHeight : window.innerHeight

    const cam = new THREE.PerspectiveCamera(50, getW() / getH(), 0.1, 2000)
    cam.position.z = 180

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(getW(), getH())
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const geo = new THREE.BufferGeometry()
    const starts = new Float32Array(N * 3)
    const targets = new Float32Array(N * 3)
    const startColors = new Float32Array(N * 3)
    const targetColors = new Float32Array(N * 3)
    const randoms = new Float32Array(N)
    const sizes = new Float32Array(N)

    const S: Record<string, { pos: Float32Array; col: Float32Array }> = {
      origin: { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) },
      practice: { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) },
      method: { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) },
      evidence: { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) },
      impact: { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) },
      contact: { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) }
    }

    const cWhite = new THREE.Color(0xe8e4dc)
    const cGreyLight = new THREE.Color(0x8b9094)
    const cGreyDark = new THREE.Color(0x3a3d40)
    const cPurple = new THREE.Color(0x3b1c5a)
    const cYellow = new THREE.Color(0xc89b3c)

    const dir = new THREE.Vector3()
    function randomDir(out: THREE.Vector3) {
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)
      out.x = Math.sin(phi) * Math.cos(theta)
      out.y = Math.sin(phi) * Math.sin(theta)
      out.z = Math.cos(phi)
    }

    const tUp = [new THREE.Vector3(0, 70, 0), new THREE.Vector3(-60, -35, 0), new THREE.Vector3(60, -35, 0)]
    const tDn = [new THREE.Vector3(0, -70, 0), new THREE.Vector3(-60, 35, 0), new THREE.Vector3(60, 35, 0)]

    const dTop = new THREE.Vector3(0, 70, 0)
    const dBot = new THREE.Vector3(0, -70, 0)
    const dEq = [
      new THREE.Vector3(50, 0, 0),
      new THREE.Vector3(0, 0, 50),
      new THREE.Vector3(-50, 0, 0),
      new THREE.Vector3(0, 0, -50)
    ]
    const dEdges = [
      [dTop, dEq[0]], [dTop, dEq[1]], [dTop, dEq[2]], [dTop, dEq[3]],
      [dBot, dEq[0]], [dBot, dEq[1]], [dBot, dEq[2]], [dBot, dEq[3]],
      [dEq[0], dEq[1]], [dEq[1], dEq[2]], [dEq[2], dEq[3]], [dEq[3], dEq[0]]
    ]

    for (let i = 0; i < N; i++) {
      randoms[i] = Math.random()
      sizes[i] = Math.random() > 0.9 ? Math.random() * 1.2 + 0.8 : Math.random() * 0.3 + 0.1
      const i3 = i * 3

      // 1. ORIGIN (Galaxy)
      const branches = 3
      const gRadius = Math.pow(Math.random(), 2.0) * 240
      const spinAngle = gRadius * 0.02
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const randomnessPower = 2.5
      const rX = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 75 * (gRadius / 240 + 0.1)
      const rZ = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 75 * (gRadius / 240 + 0.1)
      const coreDensity = Math.exp(-gRadius * 0.04) * 45.0
      const coreY = (Math.random() - 0.5) * coreDensity
      const rY = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 15

      S.origin.pos[i3] = Math.cos(branchAngle + spinAngle) * gRadius + rX
      S.origin.pos[i3 + 1] = rY + coreY
      S.origin.pos[i3 + 2] = Math.sin(branchAngle + spinAngle) * gRadius + rZ

      let co = cWhite.clone()
      if (gRadius < 25) co = cWhite.clone()
      else if (gRadius < 50) co.lerp(cYellow, Math.random() * 0.8)
      else if (gRadius > 110 && Math.random() < 0.25) co = cPurple.clone()
      else co.lerp(cGreyLight, Math.random())
      if (gRadius > 180) co.lerp(cGreyDark, 0.9)
      S.origin.col[i3] = co.r; S.origin.col[i3 + 1] = co.g; S.origin.col[i3 + 2] = co.b

      // 2. PRACTICE (Infinity Loop)
      const tInf = Math.random() * Math.PI * 2
      const scInf = 90
      const divisor = 1 + Math.pow(Math.sin(tInf), 2)
      const bpx = (scInf * Math.cos(tInf)) / divisor
      const bpy = (scInf * Math.sin(tInf) * Math.cos(tInf)) / divisor
      const bpz = Math.sin(tInf) * 30
      const scatP = Math.pow(Math.random(), 2.0) * 15
      randomDir(dir)
      S.practice.pos[i3] = bpx + dir.x * scatP
      S.practice.pos[i3 + 1] = bpy + dir.y * scatP
      S.practice.pos[i3 + 2] = bpz + dir.z * scatP

      let cp = cWhite.clone()
      if (scatP < 2) cp = cWhite.clone()
      else if (Math.random() > 0.93) cp = cYellow.clone()
      else if (scatP > 8) cp = cPurple.clone()
      else cp.lerp(cGreyLight, 0.7)
      S.practice.col[i3] = cp.r; S.practice.col[i3 + 1] = cp.g; S.practice.col[i3 + 2] = cp.b

      // 3. METHOD (Triangles)
      const isUp = Math.random() > 0.5
      const tri = isUp ? tUp : tDn
      const edge = Math.floor(Math.random() * 3)
      const pA = tri[edge]
      const pB = tri[(edge + 1) % 3]
      const lerpVal = Math.random()
      const scatM = Math.pow(Math.random(), 3.0) * 4.0
      randomDir(dir)
      S.method.pos[i3] = pA.x + (pB.x - pA.x) * lerpVal + dir.x * scatM
      S.method.pos[i3 + 1] = pA.y + (pB.y - pA.y) * lerpVal + dir.y * scatM
      S.method.pos[i3 + 2] = pA.z + (pB.z - pA.z) * lerpVal + dir.z * scatM

      let cm = cWhite.clone()
      if (scatM < 0.8) cm = cWhite.clone()
      else if (Math.random() > 0.93) cm = cYellow.clone()
      else if (scatM > 2.5) cm = cPurple.clone()
      else cm.lerp(cGreyLight, 0.8)
      S.method.col[i3] = cm.r; S.method.col[i3 + 1] = cm.g; S.method.col[i3 + 2] = cm.b

      // 4. EVIDENCE (Hourglass Tunnel)
      const hz = (Math.random() - 0.5) * 280
      const hTheta = Math.random() * Math.PI * 2
      const hr = 12 + Math.pow(Math.abs(hz) * 0.35, 1.25)
      const scatE = Math.pow(Math.random(), 2.0) * 15
      randomDir(dir)
      S.evidence.pos[i3] = Math.cos(hTheta) * hr + dir.x * scatE
      S.evidence.pos[i3 + 1] = Math.sin(hTheta) * hr + dir.y * scatE
      S.evidence.pos[i3 + 2] = hz + dir.z * scatE

      let ce = cWhite.clone()
      if (Math.abs(hz) < 25 && scatE < 8) ce = cPurple.clone()
      else if (Math.abs(hz) > 110 && Math.random() > 0.85) ce = cYellow.clone()
      else ce.lerp(cGreyLight, Math.random() * 0.8)
      S.evidence.col[i3] = ce.r; S.evidence.col[i3 + 1] = ce.g; S.evidence.col[i3 + 2] = ce.b

      // 5. IMPACT (Massive Torus)
      const tU = Math.random() * Math.PI * 2
      const tV = Math.random() * Math.PI * 2
      const torusR = 60
      const torusTube = 25
      const rT = torusTube + (Math.random() - 0.5) * 6.0
      S.impact.pos[i3] = (torusR + rT * Math.cos(tV)) * Math.cos(tU)
      S.impact.pos[i3 + 1] = (torusR + rT * Math.cos(tV)) * Math.sin(tU)
      S.impact.pos[i3 + 2] = rT * Math.sin(tV)

      let ci = cWhite.clone()
      const dCenter = Math.sqrt(S.impact.pos[i3] * S.impact.pos[i3] + S.impact.pos[i3 + 1] * S.impact.pos[i3 + 1])
      if (dCenter < 45 && Math.random() > 0.5) ci = cYellow.clone()
      else if (dCenter > 75 && Math.random() > 0.5) ci = cPurple.clone()
      else ci.lerp(cGreyLight, Math.random() * 0.9)
      S.impact.col[i3] = ci.r; S.impact.col[i3 + 1] = ci.g; S.impact.col[i3 + 2] = ci.b

      // 6. CONTACT (Sharp Diamond)
      const ed = dEdges[Math.floor(Math.random() * 12)]
      const l = Math.random()
      const scatC = Math.pow(Math.random(), 3.0) * 3.5
      randomDir(dir)
      S.contact.pos[i3] = ed[0].x + (ed[1].x - ed[0].x) * l + dir.x * scatC
      S.contact.pos[i3 + 1] = ed[0].y + (ed[1].y - ed[0].y) * l + dir.y * scatC
      S.contact.pos[i3 + 2] = ed[0].z + (ed[1].z - ed[0].z) * l + dir.z * scatC

      let cc = cWhite.clone()
      if (scatC < 0.8) cc = cWhite.clone()
      else if (Math.abs(S.contact.pos[i3 + 1]) > 55) cc = cYellow.clone()
      else if (scatC > 2.2) cc = cPurple.clone()
      else cc.lerp(cGreyLight, 0.7)
      S.contact.col[i3] = cc.r; S.contact.col[i3 + 1] = cc.g; S.contact.col[i3 + 2] = cc.b
    }

    for (let i = 0; i < N * 3; i++) {
      starts[i] = S.origin.pos[i]
      targets[i] = S.origin.pos[i]
      startColors[i] = S.origin.col[i]
      targetColors[i] = S.origin.col[i]
    }

    geo.setAttribute('aStart', new THREE.BufferAttribute(starts, 3))
    geo.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3))
    geo.setAttribute('aStartColor', new THREE.BufferAttribute(startColors, 3))
    geo.setAttribute('aTargetColor', new THREE.BufferAttribute(targetColors, 3))
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('position', new THREE.BufferAttribute(starts, 3))

    const uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 1 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: getW() / getH() }
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform vec2 uMouse;
        uniform float uAspect;
        
        attribute vec3 aStart;
        attribute vec3 aTarget;
        attribute vec3 aStartColor;
        attribute vec3 aTargetColor;
        attribute float aRandom;
        attribute float aSize;
        
        varying vec3 vColor;
        
        void main() {
          float delay = aRandom * 0.25;
          float p = clamp((uProgress - delay) / 0.75, 0.0, 1.0);
          float ease = p == 0.0 ? 0.0 : p == 1.0 ? 1.0 : p < 0.5 ? pow(2.0, 20.0 * p - 10.0) / 2.0 : (2.0 - pow(2.0, -20.0 * p + 10.0)) / 2.0;
          
          vec3 pos = mix(aStart, aTarget, ease);
          vColor = mix(aStartColor, aTargetColor, ease);
          
          float swell = sin(p * 3.14159);
          pos.x += sin(pos.y * 0.05 + uTime * 2.0 + aRandom * 10.0) * swell * 20.0;
          pos.y += cos(pos.z * 0.05 + uTime * 2.0 + aRandom * 10.0) * swell * 20.0;
          pos.z += sin(pos.x * 0.05 + uTime * 2.0 + aRandom * 10.0) * swell * 20.0;
          
          pos.x += sin(uTime * 0.6 + aRandom * 20.0) * 2.5;
          pos.y += cos(uTime * 0.9 + aRandom * 20.0) * 2.5;
          pos.z += sin(uTime * 0.75 + aRandom * 20.0) * 2.5;

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          
          float half_height = -mvPos.z * tan(50.0 * 3.14159 / 360.0);
          float half_width = half_height * uAspect;
          vec2 mouseView = vec2(uMouse.x * half_width, uMouse.y * half_height);
          
          float dist = distance(mvPos.xy, mouseView);
          float interactRadius = 40.0; 
          
          if (dist < interactRadius) {
              float force = pow((interactRadius - dist) / interactRadius, 2.0); 
              vec2 pushDir = normalize(mvPos.xy - mouseView);
              mvPos.xy += pushDir * force * 15.0; 
          }

          gl_PointSize = aSize * (150.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 xy = gl_PointCoord.xy - vec2(0.5);
          float ll = length(xy);
          if(ll > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.4, ll); 
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `
    })

    const pts = new THREE.Points(geo, mat)
    scene.add(pts)

    const keys = ['origin', 'practice', 'method', 'evidence', 'impact', 'contact']
    let currentKey = 'origin'

    function morphTo(key: string) {
      if (!S[key] || key === currentKey) return
      currentKey = key

      const curP = uniforms.uProgress.value
      const aStart = geo.attributes.aStart.array as Float32Array
      const aTarget = geo.attributes.aTarget.array as Float32Array
      const aStartC = geo.attributes.aStartColor.array as Float32Array
      const aTargetC = geo.attributes.aTargetColor.array as Float32Array
      const newT = S[key].pos
      const newC = S[key].col
      const rands = geo.attributes.aRandom.array as Float32Array

      for (let i = 0; i < N; i++) {
        const delay = rands[i] * 0.25
        const p = Math.max(0, Math.min(1, (curP - delay) / 0.75))
        const ease =
          p === 0.0
            ? 0.0
            : p === 1.0
              ? 1.0
              : p < 0.5
                ? Math.pow(2.0, 20.0 * p - 10.0) / 2.0
                : (2.0 - Math.pow(2.0, -20.0 * p + 10.0)) / 2.0

        const i3 = i * 3
        aStart[i3] = aStart[i3] + (aTarget[i3] - aStart[i3]) * ease
        aStart[i3 + 1] = aStart[i3 + 1] + (aTarget[i3 + 1] - aStart[i3 + 1]) * ease
        aStart[i3 + 2] = aStart[i3 + 2] + (aTarget[i3 + 2] - aStart[i3 + 2]) * ease

        aStartC[i3] = aStartC[i3] + (aTargetC[i3] - aStartC[i3]) * ease
        aStartC[i3 + 1] = aStartC[i3 + 1] + (aTargetC[i3 + 1] - aStartC[i3 + 1]) * ease
        aStartC[i3 + 2] = aStartC[i3 + 2] + (aTargetC[i3 + 2] - aStartC[i3 + 2]) * ease

        aTarget[i3] = newT[i3]
        aTarget[i3 + 1] = newT[i3 + 1]
        aTarget[i3 + 2] = newT[i3 + 2]
        aTargetC[i3] = newC[i3]
        aTargetC[i3 + 1] = newC[i3 + 1]
        aTargetC[i3 + 2] = newC[i3 + 2]
      }

      geo.attributes.aStart.needsUpdate = true
      geo.attributes.aTarget.needsUpdate = true
      geo.attributes.aStartColor.needsUpdate = true
      geo.attributes.aTargetColor.needsUpdate = true

      uniforms.uProgress.value = 0
      gsap.to(uniforms.uProgress, {
        value: 1,
        duration: 1.8,
        ease: 'power2.inOut'
      })
    }

    const baseRot = { x: 0.4, y: 0.2 }
    function moveCamera(idx: number) {
      const cfgs = [
        { rx: 0.4, ry: 0.2, z: 180 },
        { rx: 0.0, ry: 0.0, z: 220 },
        { rx: 0.2, ry: 0.4, z: 190 },
        { rx: 0.0, ry: 0.0, z: 60 },
        { rx: 0.4, ry: 0.3, z: 190 },
        { rx: 0.2, ry: 0.2, z: 170 }
      ]
      const c = cfgs[idx] || cfgs[0]
      gsap.to(baseRot, { x: c.rx, y: c.ry, duration: 1.8, ease: 'power2.inOut' })
      gsap.to(cam.position, { z: c.z, duration: 1.8, ease: 'power2.inOut' })
    }

    // Mouse coordinates for WebGL interaction
    let glMouseX = 0
    let glMouseY = 0
    const handleMouseMove = (e: MouseEvent) => {
      const w = containerRef.current?.clientWidth || window.innerWidth
      const h = containerRef.current?.clientHeight || window.innerHeight
      const rect = containerRef.current?.getBoundingClientRect()

      // Calculate active scale applied to the container (if any) to un-scale client coordinates
      const scaleX = rect && containerRef.current ? rect.width / (containerRef.current.offsetWidth || 1) : 1
      const scaleY = rect && containerRef.current ? rect.height / (containerRef.current.offsetHeight || 1) : 1

      // Calculate local mouse position inside the scaled container
      const localX = (e.clientX - (rect?.left || 0)) / scaleX
      const localY = (e.clientY - (rect?.top || 0)) / scaleY

      glMouseX = (localX / w) * 2 - 1
      glMouseY = -(localY / h) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)

    // IntersectionObserver for 6 sections
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const parent = entry.target.parentElement
            if (!parent) return
            const idxStr = parent.getAttribute('data-idx')
            if (idxStr === null) return
            const idx = parseInt(idxStr, 10)

            setActiveSectionIdx(idx)
            morphTo(keys[idx])
            moveCamera(idx)

            if (idx === 1) {
              gsap.to('.disc-label', { opacity: 1, scale: 1, y: 0, duration: 1.5, stagger: 0.15, ease: 'expo.out' })
            } else {
              gsap.to('.disc-label', { opacity: 0, scale: 0.9, y: 20, duration: 0.8 })
            }

            const els = parent.querySelectorAll('.anim-el')
            if (els.length > 0 && !parent.classList.contains('anim-done')) {
              parent.classList.add('anim-done')
              gsap.fromTo(
                els,
                { y: 50, opacity: 0 },
                { y: 0, opacity: 1, duration: 1.5, stagger: 0.12, ease: 'expo.out' }
              )
            }
          }
        })
      },
      { threshold: 0.15 }
    )

    const triggers = containerRef.current?.querySelectorAll('.section-trigger')
    triggers?.forEach((trigger) => observer.observe(trigger))

    // Initial fade in for persistent UI elements
    gsap.to('.anim-fade', { opacity: 1, duration: 2.0, stagger: 0.2, delay: 0.3, ease: 'power2.out' })

    const clock = new THREE.Clock()
    let globalSpinY = 0
    let targetRotX = 0
    let targetRotY = 0

    function loop() {
      animFrameId = requestAnimationFrame(loop)
      const t = clock.getElapsedTime()
      uniforms.uTime.value = t

      uniforms.uMouse.value.x += (glMouseX - uniforms.uMouse.value.x) * 0.15
      uniforms.uMouse.value.y += (glMouseY - uniforms.uMouse.value.y) * 0.15

      globalSpinY += 0.0015

      targetRotX = baseRot.x + glMouseY * 0.12
      targetRotY = baseRot.y + glMouseX * 0.12 + globalSpinY

      pts.rotation.x += (targetRotX - pts.rotation.x) * 0.05
      pts.rotation.y += (targetRotY - pts.rotation.y) * 0.05

      if (compassRef.current) {
        compassRef.current.style.transform = `rotate(${Math.atan2(glMouseY, glMouseX) * 57.3 + 90}deg)`
      }

      renderer.render(scene, cam)
    }
    loop()

    const handleResize = () => {
      const w = getW()
      const h = getH()
      cam.aspect = w / h
      cam.updateProjectionMatrix()
      renderer.setSize(w, h)
      uniforms.uAspect.value = w / h
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animFrameId)
      observer.disconnect()
      geo.dispose()
      mat.dispose()
      renderer.dispose()
    }
  }, [])

  // -------------------------------------------------------------
  // 2. CUSTOM CURSOR & HOVER INTERACTION
  // -------------------------------------------------------------
  useEffect(() => {
    let animId: number
    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let fmx = mx
    let fmy = my
    let currentScale = 1

    const dot = cursorDotRef.current
    const follower = cursorFollowerRef.current

    if (dot) dot.style.display = ''
    if (follower) follower.style.display = ''

    const handleMouseMove = (e: MouseEvent) => {
      let scaleX = 1
      let scaleY = 1
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (containerRef.current.offsetWidth > 0) scaleX = rect.width / containerRef.current.offsetWidth
        if (containerRef.current.offsetHeight > 0) scaleY = rect.height / containerRef.current.offsetHeight
      }

      // Divide by scale to ensure the custom cursor matches the physical OS cursor when the app is zoomed
      mx = e.clientX / scaleX
      my = e.clientY / scaleY

      if (dot) dot.style.transform = `translate3d(${mx}px, ${my}px, 0) scale(${currentScale})`
    }

    const animateCursor = () => {
      animId = requestAnimationFrame(animateCursor)
      fmx += (mx - fmx) * 0.25
      fmy += (my - fmy) * 0.25
      if (follower) follower.style.transform = `translate3d(${fmx}px, ${fmy}px, 0)`
    }
    animateCursor()

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('.hover-target, button, a, .cursor-pointer, [data-mod]')) {
        currentScale = 0.2
        if (dot) dot.style.transform = `translate3d(${mx}px, ${my}px, 0) scale(${currentScale})`
        if (follower) follower.classList.add('hovered')
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('.hover-target, button, a, .cursor-pointer, [data-mod]')) {
        const related = e.relatedTarget as HTMLElement | null
        if (!related || !related.closest('.hover-target, button, a, .cursor-pointer, [data-mod]')) {
          currentScale = 1
          if (dot) dot.style.transform = `translate3d(${mx}px, ${my}px, 0) scale(${currentScale})`
          if (follower) follower.classList.remove('hovered')
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseover', handleMouseOver, { passive: true })
    window.addEventListener('mouseout', handleMouseOut, { passive: true })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseover', handleMouseOver)
      window.removeEventListener('mouseout', handleMouseOut)
      cancelAnimationFrame(animId)
      if (dot) dot.style.display = 'none'
      if (follower) follower.style.display = 'none'
    }
  }, [])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div
      ref={containerRef}
      id="module-front"
      className="relative w-full h-full bg-[#050505] text-[#e8e4dc] font-sans overflow-y-auto overflow-x-hidden select-text"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* Custom Cursor */}
      <div ref={cursorDotRef} className="void-cursor-dot" />
      <div ref={cursorFollowerRef} className="void-cursor-follower" />

      {/* Ambient Gradients & Noise Grain */}
      <div className="bg-gradient" />
      <div className="grain" />

      {/* WebGL Canvas for 3D Particle System */}
      <div className="fixed top-0 left-0 bottom-0 z-0 pointer-events-none flex items-center justify-start">
        <canvas ref={canvasRef} className="max-w-full max-h-full" />
      </div>

      {/* 1. FLOATING PILL TOP NAVBAR */}
      <header className="fixed top-14 inset-x-0 z-40 flex justify-center px-4 pointer-events-none anim-fade" id="navbar">
        <nav className="glass-nav rounded-full px-2 py-1.5 flex items-center gap-0.5 sm:gap-1 pointer-events-auto hover-target">
          <button
            onClick={() => scrollToSection('s1')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium text-bone hover:text-white transition group"
          >
            <div className="w-8 h-8 rounded-full bg-foam text-space flex items-center justify-center font-display font-bold text-sm shadow-[0_0_15px_rgba(200,155,60,0.4)] group-hover:scale-110 transition-all duration-300">
              V
            </div>
            <span className="tracking-widest font-bold text-[15px] font-display text-bone">VØID</span>
          </button>
          <div className="h-3 w-px bg-line mx-1 hidden sm:block"></div>
          <button
            onClick={() => scrollToSection('s1')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 0 ? 'nav-active' : ''
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => scrollToSection('s2')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 1 ? 'nav-active' : ''
              }`}
          >
            Arsenal
          </button>
          <button
            onClick={() => scrollToSection('s3')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 2 ? 'nav-active' : ''
              }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => scrollToSection('s4')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 3 ? 'nav-active' : ''
              }`}
          >
            Telemetry
          </button>
          <button
            onClick={() => scrollToSection('s5')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 4 ? 'nav-active' : ''
              }`}
          >
            Modules
          </button>
          <button
            onClick={() => onSwitchModule('nodes')}
            className="ml-1 flex items-center gap-1.5 rounded-full bg-bone px-4 py-1.5 text-xs font-semibold text-space transition hover:bg-white hover:scale-105 active:scale-95 shadow-md"
          >
            Enter workspace <span className="w-1.5 h-1.5 rounded-full bg-space"></span>
          </button>
        </nav>
      </header>

      {/* 2. LEFT SIDEBAR NAVIGATION PANEL (MODULE ICON TABS) */}
      <aside
        id="left-panel"
        className="fixed left-5 md:left-6 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-3 pointer-events-auto anim-fade"
      >
        <button
          data-mod="front"
          className={`side-icon-btn hover-target group ${activeMod === 'front' ? 'active' : ''}`}
          title="Overview (Landing Matrix)"
          onClick={() => {
            onSwitchModule('front')
            scrollToSection('s1')
          }}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
        </button>

        <div className="w-[46px] flex justify-center py-0.5">
          <div className="w-px h-5 bg-white/15"></div>
        </div>

        <button
          data-mod="nodes"
          className={`side-icon-btn hover-target group ${activeMod === 'nodes' ? 'active' : ''}`}
          title="DCS // developer's colabrative space"
          onClick={() => onSwitchModule('nodes')}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
        </button>

        <button
          data-mod="ide"
          className={`side-icon-btn hover-target group ${activeMod === 'ide' ? 'active' : ''}`}
          title="lumen"
          onClick={() => onSwitchModule('ide')}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>
        </button>

        <button
          data-mod="timeline"
          className={`side-icon-btn hover-target group ${activeMod === 'timeline' ? 'active' : ''}`}
          title="quark"
          onClick={() => onSwitchModule('timeline')}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        </button>

        <button
          data-mod="bento"
          className={`side-icon-btn hover-target group ${activeMod === 'bento' ? 'active' : ''}`}
          title="optics"
          onClick={() => onSwitchModule('bento')}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" /><path d="M19.1 4.9c3.9 3.9 3.9 10.2 0 14.1" /></svg>
        </button>

        <button
          data-mod="settings"
          className={`side-icon-btn hover-target group ${activeMod === 'settings' ? 'active' : ''}`}
          title="MAG // mantor and guide"
          onClick={() => onSwitchModule('settings')}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" /><line x1="17" x2="23" y1="16" y2="16" /></svg>
        </button>
      </aside>

      {/* 3. RIGHT RAIL SECTION INDICATOR */}
      <aside
        id="rail"
        className="fixed right-5 md:right-8 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-end pointer-events-auto anim-fade"
      >
        <div className="relative flex flex-col gap-3.5 pr-3">
          <div className="rail-line"></div>
          {[
            { idx: 0, label: '01 ORIGIN', id: 's1' },
            { idx: 1, label: '02 ARSENAL', id: 's2' },
            { idx: 2, label: '03 PIPELINE', id: 's3' },
            { idx: 3, label: '04 TELEMETRY', id: 's4' },
            { idx: 4, label: '05 MODULES', id: 's5' },
            { idx: 5, label: '06 ACCESS', id: 's6' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`rail-item hover-target flex items-center gap-2.5 text-right transition-colors text-dim hover:text-bone ${activeSectionIdx === item.idx ? 'active' : ''
                }`}
              data-idx={item.idx}
            >
              <span className="rail-label font-mono text-[10px] uppercase tracking-[.18em] whitespace-nowrap opacity-0">
                {item.label}
              </span>
              <span className="rail-dot w-[5px] h-[5px] rounded-full"></span>
            </button>
          ))}
        </div>
      </aside>

      {/* 4. BOTTOM COMPASS & SCROLL WIDGETS */}
      <div className="fixed bottom-5 left-5 z-40 pointer-events-auto anim-fade">
        <div
          ref={compassRef}
          id="compass"
          className="w-8 h-8 rounded-full border border-line bg-space/80 backdrop-blur-md flex items-center justify-center font-mono text-[10px] font-bold text-mist hover-target transition shadow-lg"
        >
          V
        </div>
      </div>
      <div className="fixed bottom-5 right-5 z-40 pointer-events-auto hidden md:block anim-fade">
        <div
          id="scroll-toggle"
          onClick={() => scrollToSection('s1')}
          className="hover-target w-8 h-8 rounded-full border border-line bg-space/80 backdrop-blur-md flex items-center justify-center transition group cursor-pointer"
          title="Back to top"
        >
          <div className="w-2 h-2 rounded-full bg-bone group-hover:scale-125 transition-transform"></div>
        </div>
      </div>

      {/* 5. MAIN SCROLLABLE HERO & LANDING SECTIONS */}
      <main className="relative z-20 w-full select-text">
        {/* S1: ORIGIN */}
        <section
          id="s1"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-24 text-center section-container"
          data-idx="0"
        >
          <div className="section-trigger"></div>
          <div className="max-w-4xl mx-auto origin-content mt-10">
            <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-7 flex items-center justify-center gap-3 anim-el font-semibold">
              <span className="w-5 h-px bg-line"></span>AUTONOMOUS SECURITY RUNTIME — VOID PROTOCOL<span className="w-5 h-px bg-line"></span>
            </p>
            <h1 className="font-display text-[44px] sm:text-[68px] md:text-[84px] font-semibold tracking-[-0.04em] leading-[1.02]">
              <div className="anim-wrap"><div className="anim-el text-bone">Anyone can write code.</div></div><br />
              <div className="anim-wrap"><div className="anim-el text-mist font-light">We forge the impenetrable void.</div></div>
            </h1>
            <p className="mt-8 max-w-2xl mx-auto text-[15px] sm:text-[17px] text-mist leading-relaxed font-light anim-el">
              VØID Studio is an autonomous security runtime and developer workstation. We isolate vulnerabilities, synthesize real-time threat maps, and deploy self-healing sandbox environments so your systems remain untouchable.
            </p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4 anim-el">
              <button
                onClick={() => onSwitchModule('nodes')}
                className="hover-target flex items-center gap-2 rounded-full bg-bone px-7 py-3.5 text-sm font-semibold text-space transition-all hover:bg-white hover:-translate-y-0.5 shadow-lg shadow-bone/10"
              >
                Enter Workspace <span className="w-1.5 h-1.5 rounded-full bg-space/60"></span>
              </button>
              <button
                onClick={() => scrollToSection('s2')}
                className="hover-target px-5 py-3.5 text-sm text-mist hover:text-bone transition"
              >
                Explore Arsenal ↓
              </button>
            </div>

            <div className="mt-24 sm:mt-32 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 pt-8 border-t border-line/80 max-w-3xl mx-auto">
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-foam">0.00ms</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">REAL-TIME LATENCY</div>
              </div>
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-bone">100%</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">SANDBOX ISOLATION</div>
              </div>
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-bone">5+</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">DEFENSE CORES</div>
              </div>
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-mist">ACTIVE</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">CONTAINMENT STATUS</div>
              </div>
            </div>
          </div>
        </section>

        {/* S2: ARSENAL (PRACTICE) */}
        <section
          id="s2"
          className="relative min-h-screen flex items-center justify-center px-6 py-28 section-container"
          data-idx="1"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full relative h-[80vh]">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20 pointer-events-none practice-content">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>INTEGRATED ARSENAL<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">Four Core Engines.</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">One Autonomous Defense Architecture.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-mist leading-relaxed font-light max-w-md anim-el">
                No module operates in isolation. Each component is wired directly into the VØID neural telemetry bus for instant synchronization and threat response.
              </p>
            </div>

            <div className="disc-label top-[12%] left-0 cursor-pointer" onClick={() => onSwitchModule('nodes')}>
              <div className="disc-num mb-1 text-foam">I</div>
              <div className="font-display font-bold text-bone text-2xl sm:text-3xl hover:text-foam transition">DCS</div>
              <div className="disc-sub mt-1 text-dim">developer's colabrative space</div>
            </div>
            <div className="disc-label bottom-[12%] left-0 cursor-pointer" onClick={() => onSwitchModule('ide')}>
              <div className="disc-num mb-1 text-foam">II</div>
              <div className="font-display font-bold text-bone text-2xl sm:text-3xl hover:text-foam transition">lumen</div>
              <div className="disc-sub mt-1 text-dim">AI Security Agent & Synthesis</div>
            </div>
            <div className="disc-label top-[12%] right-0 text-right cursor-pointer" onClick={() => onSwitchModule('timeline')}>
              <div className="disc-num mb-1 text-foam">III</div>
              <div className="font-display font-bold text-bone text-2xl sm:text-3xl hover:text-foam transition">quark</div>
              <div className="disc-sub mt-1 text-dim">Real-time Threat Scanner</div>
            </div>
            <div className="disc-label bottom-[12%] right-0 text-right cursor-pointer" onClick={() => onSwitchModule('bento')}>
              <div className="disc-num mb-1 text-foam">IV</div>
              <div className="font-display font-bold text-bone text-2xl sm:text-3xl hover:text-foam transition">optics</div>
              <div className="disc-sub mt-1 text-dim">Deception HoneyGrid & Forensics</div>
            </div>
          </div>
        </section>

        {/* S3: PIPELINE (METHOD) */}
        <section
          id="s3"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-28 section-container"
          data-idx="2"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full method-content">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>THREAT MITIGATION PIPELINE<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">From raw exploit signal</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">to total containment.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-mist leading-relaxed font-light max-w-lg mx-auto anim-el">
                Five autonomous phases continuously executing in memory to neutralize zero-day attack vectors before system compromise.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>01</span><span>2 MS</span></div>
                  <h3 className="font-display text-xl font-bold">Recon</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Real-time AST parsing and live process vulnerability probing across active buffers.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>
              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>02</span><span>INSTANT</span></div>
                  <h3 className="font-display text-xl font-bold">Isolation</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Zero-trust lockdown protocol isolates infected threads without crashing the host workspace.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>
              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el border-foam/30 hover:border-foam/60">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-foam mb-4"><span>03</span><span>REAL-TIME</span></div>
                  <h3 className="font-display text-xl font-bold text-foam">Synthesis</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">lumen neural core generates patched routines and verified exploit signatures.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-foam/90 rounded-full"></div></div>
              </div>
              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>04</span><span>ACTIVE</span></div>
                  <h3 className="font-display text-xl font-bold">Deception</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">optics traps redirect attacker payloads into virtual honeypot honeynets.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>
              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>05</span><span>PERMANENT</span></div>
                  <h3 className="font-display text-xl font-bold">Immunity</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Deploy immutable AST security patches and memory hardening with zero downtime.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* S4: TELEMETRY (EVIDENCE) */}
        <section
          id="s4"
          className="relative min-h-screen flex items-center px-6 py-28 pointer-events-none section-container"
          data-idx="3"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center evidence-content pointer-events-auto">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>SECURITY TELEMETRY
              </p>
              <h2 className="font-display text-4xl sm:text-[60px] font-semibold tracking-[-0.04em] leading-[1.02]">
                <div className="anim-wrap"><div className="anim-el text-bone">Resilience has</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">a mathematical proof.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-dim leading-relaxed font-light max-w-md anim-el">
                Benchmarked against adversarial intrusion suites, automated fuzzing frameworks, and enterprise zero-day exploits.
              </p>
            </div>
            <div className="glass-card rounded-3xl p-8 sm:p-10 grid grid-cols-2 gap-8 sm:gap-10 relative z-10 lg:-ml-12 anim-el hover-target">
              <div>
                <div className="font-display text-4xl sm:text-5xl font-bold text-bone">99.98<span className="text-foam font-light text-2xl ml-0.5">%</span></div>
                <div className="text-sm font-semibold mt-2 text-mist">Interception Rate</div>
                <p className="text-[12px] text-dim leading-relaxed font-light mt-2">Zero-day and malicious binary containment across tested execution vectors.</p>
              </div>
              <div>
                <div className="font-display text-4xl sm:text-5xl font-bold text-bone">10<span className="text-foam font-light text-2xl ml-0.5">x</span></div>
                <div className="text-sm font-semibold mt-2 text-mist">Faster Remediation</div>
                <p className="text-[12px] text-dim leading-relaxed font-light mt-2">Instant sandboxed patch generation vs manual incident response workflows.</p>
              </div>
              <div className="col-span-2 h-px bg-line"></div>
              <div>
                <div className="font-display text-4xl sm:text-5xl font-bold text-bone">&lt; 50<span className="font-mono text-xs text-mist tracking-wider uppercase ml-1">ms</span></div>
                <div className="text-sm font-semibold mt-2 text-mist">Containment Latency</div>
                <p className="text-[12px] text-dim leading-relaxed font-light mt-2">Zero-trust process isolation from anomaly detection to lockdown.</p>
              </div>
              <div>
                <div className="font-display text-4xl sm:text-5xl font-bold text-bone">100<span className="text-foam font-light text-2xl ml-0.5">%</span></div>
                <div className="text-sm font-semibold mt-2 text-mist">Local Sandboxing</div>
                <p className="text-[12px] text-dim leading-relaxed font-light mt-2">All code, shell commands, and threat telemetry processed in private local memory.</p>
              </div>
            </div>
          </div>
        </section>

        {/* S5: MODULES (IMPACT) */}
        <section
          id="s5"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-28 section-container"
          data-idx="4"
        >
          <div className="section-trigger"></div>
          <div className="max-w-5xl mx-auto w-full impact-content">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>OPERATIONAL CORES<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">Defense that operates</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">at machine speed.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-dim leading-relaxed font-light max-w-lg mx-auto anim-el">
                Seamlessly switch between sandboxed coding, AI synthesis, threat scanning, and deception environments.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div className="glass-card hover-target p-8 sm:p-10 rounded-3xl flex flex-col justify-between gap-8 anim-el">
                <div>
                  <div className="font-mono text-[11px] text-foam font-bold tracking-widest uppercase mb-3">CORE 01 & 02</div>
                  <h3 className="font-display text-2xl font-bold text-bone mb-3">DCS + lumen</h3>
                  <p className="text-[15px] leading-relaxed font-light text-mist">
                    Write code in a zero-trust environment with aegis AI security auditing, AST static analysis, and automated vulnerability patching.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => onSwitchModule('nodes')}
                    className="flex items-center gap-2 text-sm font-semibold text-foam hover:text-white transition group"
                  >
                    <span>Launch Code Workspace</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>
              <div className="glass-card hover-target p-8 sm:p-10 rounded-3xl flex flex-col justify-between gap-8 anim-el">
                <div>
                  <div className="font-mono text-[11px] text-foam font-bold tracking-widest uppercase mb-3">CORE 03 & 04</div>
                  <h3 className="font-display text-2xl font-bold text-bone mb-3">quark + optics</h3>
                  <p className="text-[15px] leading-relaxed font-light text-mist">
                    Real-time intrusion detection and virtual honeypots that trap, analyze, and neutralize active network exploits and malware payloads.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => onSwitchModule('timeline')}
                    className="flex items-center gap-2 text-sm font-semibold text-foam hover:text-white transition group"
                  >
                    <span>Open Threat Matrix</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="pt-10 border-t border-line/60 flex flex-wrap items-center justify-center gap-8 sm:gap-12 font-mono text-[11px] uppercase tracking-[.25em] text-dim anim-el">
              <span className="hover:text-foam transition hover-target cursor-pointer" onClick={() => onSwitchModule('nodes')}>DCS</span>
              <span className="hover:text-foam transition hover-target cursor-pointer" onClick={() => onSwitchModule('ide')}>LUMEN</span>
              <span className="hover:text-foam transition hover-target cursor-pointer" onClick={() => onSwitchModule('timeline')}>QUARK</span>
              <span className="hover:text-foam transition hover-target cursor-pointer" onClick={() => onSwitchModule('bento')}>OPTICS</span>
              <span className="hover:text-foam transition hover-target cursor-pointer" onClick={() => onSwitchModule('settings')}>MAG</span>
            </div>
          </div>
        </section>

        {/* S6: ACCESS & FOOTER */}
        <section
          id="s6"
          className="relative min-h-screen flex flex-col justify-between px-6 pt-28 pb-10 section-container"
          data-idx="5"
        >
          <div className="section-trigger"></div>
          <div className="max-w-4xl mx-auto w-full text-center my-auto contact-content">
            <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-4 flex items-center justify-center gap-2 anim-el font-semibold">
              <span className="w-4 h-px bg-line"></span>STATION ACCESS<span className="w-4 h-px bg-line"></span>
            </p>
            <h2 className="font-display text-5xl sm:text-[72px] md:text-[88px] font-semibold tracking-[-0.04em] leading-[1.02]">
              <div className="anim-wrap"><div className="anim-el text-bone">Initialize Station.</div></div><br />
              <div className="anim-wrap"><div className="anim-el font-light text-mist">Total Command.</div></div>
            </h2>
            <p className="mt-8 text-[16px] text-dim leading-relaxed font-light max-w-lg mx-auto anim-el">
              Ready to initiate your developer security session. Launch the sandboxed workspace or jump directly into any security core.
            </p>
            <div className="mt-12 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 anim-el">
              <button
                onClick={() => onSwitchModule('nodes')}
                className="w-full sm:w-auto hover-target flex items-center justify-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-bold text-space transition-all hover:bg-white hover:scale-105 shadow-xl shadow-bone/10"
              >
                Launch Workspace •
              </button>
              <button
                onClick={() => onSwitchModule('timeline')}
                className="w-full sm:w-auto hover-target flex items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 hover:border-foam/50 px-8 py-4 text-sm font-semibold text-bone transition-all hover:bg-white/10"
              >
                Run Security Audit
              </button>
            </div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[.2em] text-dim anim-el">
              VØID RUNTIME ENGINE &middot; ZERO-TRUST ARCHITECTURE &middot; ALL CORES ONLINE
            </p>
          </div>

          {/* Footer Area */}
          <div className="max-w-6xl mx-auto w-full pt-16 mt-20 border-t border-line/50 anim-fade" id="footer-area">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-left mb-12">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold mb-4 text-bone">
                  <span className="opacity-70 text-foam">✦</span> VØID STUDIO
                </div>
                <p className="text-[13px] text-mist leading-relaxed font-light mb-4 pr-4">
                  Next-generation cybersecurity runtime and sandboxed developer workspace.
                </p>
                <div className="font-mono text-[9px] uppercase tracking-widest text-foam font-bold">
                  LOCAL ENGINE RUNNING
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-dim mb-5 font-semibold">ENGINES</div>
                <ul className="space-y-3 text-[13px] text-mist">
                  <li><button onClick={() => onSwitchModule('nodes')} className="hover-target hover:text-bone transition">DCS</button></li>
                  <li><button onClick={() => onSwitchModule('ide')} className="hover-target hover:text-bone transition">lumen</button></li>
                  <li><button onClick={() => onSwitchModule('timeline')} className="hover-target hover:text-bone transition">quark</button></li>
                  <li><button onClick={() => onSwitchModule('bento')} className="hover-target hover:text-bone transition">optics</button></li>
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-dim mb-5 font-semibold">SECURITY</div>
                <ul className="space-y-3 text-[13px] text-mist">
                  <li><button onClick={() => onSwitchModule('timeline')} className="hover-target hover:text-bone transition">Lockdown Protocol</button></li>
                  <li><button onClick={() => onSwitchModule('settings')} className="hover-target hover:text-bone transition">Vulnerability Recon</button></li>
                  <li><button onClick={() => onSwitchModule('bento')} className="hover-target hover:text-bone transition">Threat Map</button></li>
                  <li><button onClick={() => { if (onOpenSettings) onOpenSettings() }} className="hover-target hover:text-bone transition">Access Policies</button></li>
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-dim mb-5 font-semibold">TELEMETRY</div>
                <ul className="space-y-3 text-[13px] text-mist">
                  <li><span className="text-dim">Protocol: v1.0.0</span></li>
                  <li><span className="text-dim">Engine: Sandboxed</span></li>
                  <li><span className="text-dim">Isolation: 100%</span></li>
                  <li><span className="text-dim">Status: Protected</span></li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-wider text-dim pt-6 border-t border-line/40">
              <span>© 2026 VØID STUDIO — VOID</span>
              <span>VOID RUNTIME v1.0.0</span>
              <button onClick={() => scrollToSection('s1')} className="hover-target hover:text-foam transition">
                BACK TO TOP ↑
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

