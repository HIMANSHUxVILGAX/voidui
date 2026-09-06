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
  const [queryText, setQueryText] = useState<string>('')
  const [querySubmitted, setQuerySubmitted] = useState<boolean>(false)

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!queryText.trim()) return
    setQuerySubmitted(true)
    setTimeout(() => {
      setQuerySubmitted(false)
      setQueryText('')
    }, 4000)
  }

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
    const cYellow = new THREE.Color(0xdeb00d)

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
            <div className="w-8 h-8 rounded-full bg-foam text-space flex items-center justify-center font-display font-bold text-sm shadow-sm shadow-black/50 group-hover:scale-110 transition-all duration-300">
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
            Usage
          </button>
          <button
            onClick={() => scrollToSection('s3')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 2 ? 'nav-active' : ''
              }`}
          >
            Blueprint
          </button>
          <button
            onClick={() => scrollToSection('s4')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 3 ? 'nav-active' : ''
              }`}
          >
            Developers
          </button>
          <button
            onClick={() => scrollToSection('s5')}
            className={`nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full text-[13px] text-mist hover:text-bone transition-all ${activeSectionIdx === 4 ? 'nav-active' : ''
              }`}
          >
            Subscription
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
            { idx: 0, label: '01 OVERVIEW', id: 's1' },
            { idx: 1, label: '02 USAGE', id: 's2' },
            { idx: 2, label: '03 BLUEPRINT', id: 's3' },
            { idx: 3, label: '04 DEVELOPERS', id: 's4' },
            { idx: 4, label: '05 SUBSCRIPTION', id: 's5' },
            { idx: 5, label: '06 CONTACT', id: 's6' }
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
        {/* S1: OVERVIEW */}
        <section
          id="s1"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-24 text-center section-container"
          data-idx="0"
        >
          <div className="section-trigger"></div>
          <div className="max-w-5xl mx-auto origin-content mt-10">
            <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-7 flex items-center justify-center gap-3 anim-el font-semibold">
              <span className="w-5 h-px bg-line"></span>INITIALIZING VERSION 1....VOID<span className="w-5 h-px bg-line"></span>
            </p>
            <h1 className="font-display text-[44px] sm:text-[68px] md:text-[84px] font-semibold tracking-[-0.04em] leading-[1.02]">
              <div className="anim-wrap"><div className="anim-el text-bone">Supreme tool for a community.</div></div><br />
              <div className="anim-wrap"><div className="anim-el text-mist font-light">We forge the impenetrable void.</div></div>
            </h1>
            <p className="mt-8 max-w-2xl mx-auto text-[15px] sm:text-[17px] text-mist leading-relaxed font-light anim-el">
              VØID Studio is an autonomous sovereign engineering runtime and developer workstation. Powered by DCS collaborative space, Lumen neural synthesis, Quark zero-trust threat containment, Optics deception honeygrid, and MAG autonomous intelligence — engineered to build, audit, and fortify next-generation software.
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
                Explore Usage ↓
              </button>
            </div>

            <div className="mt-20 sm:mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 pt-8 border-t border-line/80 max-w-3xl mx-auto">
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-foam">0.00ms</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">REAL-TIME LATENCY</div>
              </div>
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-bone">100%</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">SANDBOX ISOLATION</div>
              </div>
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-foam">5/5</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">DEFENSE CORES ONLINE</div>
              </div>
              <div className="anim-el">
                <div className="font-display text-2xl sm:text-3xl font-bold text-mist">ACTIVE</div>
                <div className="font-mono text-[9px] uppercase tracking-[.22em] text-dim mt-2">CONTAINMENT STATUS</div>
              </div>
            </div>

            {/* FIVE CORE ENGINES CONTAINER (Overview Section) */}
            <div className="mt-20 anim-el text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-line">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[.22em] text-foam font-bold">
                    FIVE OPERATIONAL CORES
                  </span>
                  <h3 className="text-xl sm:text-2xl font-display font-semibold text-bone mt-1">
                    Unified Autonomous Architecture
                  </h3>
                </div>
                <div className="font-mono text-[11px] text-dim flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-foam animate-pulse"></span> ALL 5 CORES INTEGRATED
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Engine 1: DCS */}
                <div
                  onClick={() => onSwitchModule('nodes')}
                  className="glass-card hover-target p-5 rounded-2xl flex flex-col justify-between cursor-pointer group hover:border-foam/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-foam font-bold">CORE I</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-foam"></span>
                    </div>
                    <div className="font-display font-bold text-xl text-bone group-hover:text-foam transition">DCS</div>
                    <div className="font-mono text-[10px] text-mist mt-1">developer's colabrative space</div>
                    <p className="mt-3 text-[12px] text-dim leading-relaxed font-light">
                      Visual logic node canvas, real-time shared buffer, and zero-trust collaborative coding.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-foam font-medium">
                    <span>Launch Space</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>

                {/* Engine 2: Lumen */}
                <div
                  onClick={() => onSwitchModule('ide')}
                  className="glass-card hover-target p-5 rounded-2xl flex flex-col justify-between cursor-pointer group hover:border-foam/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-foam font-bold">CORE II</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-foam"></span>
                    </div>
                    <div className="font-display font-bold text-xl text-bone group-hover:text-foam transition">lumen</div>
                    <div className="font-mono text-[10px] text-mist mt-1">AI Security Agent & Synthesis</div>
                    <p className="mt-3 text-[12px] text-dim leading-relaxed font-light">
                      Neural AST code generation, real-time vulnerability detection, and automated patch synthesis.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-foam font-medium">
                    <span>Launch Lumen</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>

                {/* Engine 3: Quark */}
                <div
                  onClick={() => onSwitchModule('timeline')}
                  className="glass-card hover-target p-5 rounded-2xl flex flex-col justify-between cursor-pointer group hover:border-foam/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-foam font-bold">CORE III</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-foam"></span>
                    </div>
                    <div className="font-display font-bold text-xl text-bone group-hover:text-foam transition">quark</div>
                    <div className="font-mono text-[10px] text-mist mt-1">Real-time Threat Defense</div>
                    <p className="mt-3 text-[12px] text-dim leading-relaxed font-light">
                      Autonomous process memory isolation, zero-trust system lockdown, and threat mitigation.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-foam font-medium">
                    <span>Launch Quark</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>

                {/* Engine 4: Optics */}
                <div
                  onClick={() => onSwitchModule('bento')}
                  className="glass-card hover-target p-5 rounded-2xl flex flex-col justify-between cursor-pointer group hover:border-foam/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-foam font-bold">CORE IV</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-foam"></span>
                    </div>
                    <div className="font-display font-bold text-xl text-bone group-hover:text-foam transition">optics</div>
                    <div className="font-mono text-[10px] text-mist mt-1">Deception HoneyGrid & Forensics</div>
                    <p className="mt-3 text-[12px] text-dim leading-relaxed font-light">
                      Virtual honeygrid traps, intruder manipulation, live packet telemetry, and payload dissection.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-foam font-medium">
                    <span>Launch Optics</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>

                {/* Engine 5: MAG */}
                <div
                  onClick={() => onSwitchModule('settings')}
                  className="glass-card hover-target p-5 rounded-2xl flex flex-col justify-between cursor-pointer group hover:border-foam/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-foam font-bold">CORE V</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-foam"></span>
                    </div>
                    <div className="font-display font-bold text-xl text-bone group-hover:text-foam transition">MAG</div>
                    <div className="font-mono text-[10px] text-mist mt-1">Mentor & Architectural Guide</div>
                    <p className="mt-3 text-[12px] text-dim leading-relaxed font-light">
                      Intelligent cyber mentor, deep system reconnaissance, dependency auditing, and setup guidance.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-foam font-medium">
                    <span>Launch MAG</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* S2: USAGE */}
        <section
          id="s2"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-28 section-container"
          data-idx="1"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>OPERATIONAL RUNTIME — USAGE & WORKFLOW<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">How to use VØID.</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">From code creation to continuous containment.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-mist leading-relaxed font-light max-w-2xl mx-auto anim-el">
                Engineered for independent developers, security researchers, red & blue cyber operators, and students. Experience seamless workflow between software building and real-time defense.
              </p>
            </div>

            {/* Who is it for? */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12 anim-el">
              <div className="glass-card p-5 rounded-2xl border-white/10 hover:border-foam/30 transition">
                <div className="font-mono text-[10px] text-foam font-bold uppercase tracking-wider mb-2">FOR DEVELOPERS</div>
                <h4 className="font-display text-base font-bold text-bone">Zero-Trust Coding</h4>
                <p className="text-[12px] text-dim leading-relaxed mt-2 font-light">
                  Write and compile in an isolated sandbox with instant terminal execution and local AST safety checks.
                </p>
              </div>
              <div className="glass-card p-5 rounded-2xl border-white/10 hover:border-foam/30 transition">
                <div className="font-mono text-[10px] text-foam font-bold uppercase tracking-wider mb-2">FOR RESEARCHERS</div>
                <h4 className="font-display text-base font-bold text-bone">Vulnerability Recon</h4>
                <p className="text-[12px] text-dim leading-relaxed mt-2 font-light">
                  Probe source code for memory corruption, injection vectors, and extract real-time exploit signatures.
                </p>
              </div>
              <div className="glass-card p-5 rounded-2xl border-white/10 hover:border-foam/30 transition">
                <div className="font-mono text-[10px] text-foam font-bold uppercase tracking-wider mb-2">FOR RED/BLUE TEAMS</div>
                <h4 className="font-display text-base font-bold text-bone">Honeynet Deception</h4>
                <p className="text-[12px] text-dim leading-relaxed mt-2 font-light">
                  Trap active network intruders in isolated honeypot decoys, dissect payloads, and block hostile IPs.
                </p>
              </div>
              <div className="glass-card p-5 rounded-2xl border-white/10 hover:border-foam/30 transition">
                <div className="font-mono text-[10px] text-foam font-bold uppercase tracking-wider mb-2">FOR STUDENTS</div>
                <h4 className="font-display text-base font-bold text-bone">Guided Cyber Lab</h4>
                <p className="text-[12px] text-dim leading-relaxed mt-2 font-light">
                  Learn cybersecurity in a safe air-gapped lab with interactive mentoring and architectural guidance via MAG.
                </p>
              </div>
            </div>

            {/* 5-Step Usage Pipeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>01</span><span>INIT</span></div>
                  <h3 className="font-display text-lg font-bold">1. Scaffold Space</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Launch DCS. Connect your local directory or begin node-based visual logic programming.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>

              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el border-foam/30 hover:border-foam/60">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-foam mb-4"><span>02</span><span>SYNTHESIS</span></div>
                  <h3 className="font-display text-lg font-bold text-foam">2. Neural Code</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Activate Lumen AI to write routines, detect zero-day AST vulnerabilities, and apply instant patches.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-foam/90 rounded-full"></div></div>
              </div>

              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>03</span><span>REAL-TIME</span></div>
                  <h3 className="font-display text-lg font-bold">3. Kernel Defense</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Quark monitors background threads, applying instant quarantine to memory-corrupting processes.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>

              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>04</span><span>DECEPTION</span></div>
                  <h3 className="font-display text-lg font-bold">4. Trap & Analyze</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Optics intercepts hostile scans into virtual honeypots, logging attacker activity without risking host files.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>

              <div className="glass-card hover-target p-6 rounded-3xl flex flex-col justify-between min-h-[260px] anim-el">
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-mist mb-4"><span>05</span><span>TACTICAL</span></div>
                  <h3 className="font-display text-lg font-bold">5. Mentor Guidance</h3>
                  <p className="mt-3 text-[13px] text-dim leading-relaxed font-light">Consult MAG for deep system dependency audits, security recon, and best practice remediation.</p>
                </div>
                <div className="w-full h-[3px] bg-line rounded-full mt-6"><div className="w-full h-full bg-mist/50 rounded-full"></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* S3: BLUEPRINT */}
        <section
          id="s3"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-28 section-container"
          data-idx="2"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>SYSTEM ARCHITECTURE & BLUEPRINTS<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">Interactive 2D Schematics.</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">Mathematical proof of sovereign defense.</div></div>
              </h2>
              <p className="mt-5 text-[15px] text-dim leading-relaxed font-light max-w-xl mx-auto anim-el">
                Deep architectural schematics of the VØID multi-engine framework. Scroll inside the blueprint container below to examine individual subsystem schematics without moving the page.
              </p>
            </div>

            {/* Blueprint Outer Frame with Inner Scrollable Container */}
            <div className="glass-card rounded-3xl p-4 sm:p-7 border border-white/15 bg-black/60 backdrop-blur-2xl anim-el">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-line text-[11px] font-mono text-dim">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-foam"></span>
                  <span className="text-bone font-bold tracking-wider">BLUEPRINT DOCK // 5 SCHEMATICS LOADED</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>SCALE: 1:1 VECTOR</span>
                  <span className="text-foam">↕ SCROLL INTERNALLY TO INSPECT</span>
                </div>
              </div>

              {/* Scrollable Container */}
              <div
                className="max-h-[580px] overflow-y-auto pr-3 space-y-6 blueprint-scroll-container select-text"
                style={{ overscrollBehavior: 'contain' }}
              >
                {/* Blueprint 01: Core Kernel Sandbox */}
                <div className="p-6 rounded-2xl bg-[#09090f]/90 border border-white/10 hover:border-foam/40 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-foam font-bold tracking-wider">SCHEMATIC BP-01 // AIR-GAP RUNTIME</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">ISOLATION: L3 RING-3</span>
                  </div>
                  <h4 className="font-display text-xl font-bold text-bone">Core Kernel Sandbox & Process Air-Gap Topology</h4>
                  <p className="text-[13px] text-dim mt-2 font-light">
                    Visualizes the absolute process segregation between host operating system memory and the VØID sandboxed execution threads.
                  </p>
                  {/* 2D Vector Schematic */}
                  <div className="mt-4 p-4 rounded-xl bg-black/80 border border-white/10 font-mono text-[11px] text-mist relative overflow-hidden">
                    <div className="absolute inset-0 canvas-grid-bg opacity-40"></div>
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-foam">HOST OS RING-0</span>
                        <span className="text-dim">eBPF MONITOR ACTIVE</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center my-3">
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">V8 RUNTIME</div>
                          <div className="text-[10px] text-dim mt-1">Air-Gapped Memory</div>
                        </div>
                        <div className="p-2.5 rounded bg-foam/10 border border-foam/30">
                          <div className="text-foam font-bold text-xs">IPC BRIDGE</div>
                          <div className="text-[10px] text-foam/80 mt-1">Zero-Trust Bus</div>
                        </div>
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">THREAD QUARANTINE</div>
                          <div className="text-[10px] text-dim mt-1">&lt;50ms Lockdown</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-dim pt-2 border-t border-white/5">
                        <span>DATAFLOW: ONE-WAY ENCRYPTED SOCKET</span>
                        <span className="text-foam font-bold">STATE: SECURE AIR-GAP</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blueprint 02: Lumen Neural Synthesis */}
                <div className="p-6 rounded-2xl bg-[#09090f]/90 border border-white/10 hover:border-foam/40 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-foam font-bold tracking-wider">SCHEMATIC BP-02 // NEURAL SYNTHESIS</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">LATENCY: 22MS AST</span>
                  </div>
                  <h4 className="font-display text-xl font-bold text-bone">Lumen Neural AST Parser & Security Synthesis Engine</h4>
                  <p className="text-[13px] text-dim mt-2 font-light">
                    Real-time tokenized abstract syntax tree analysis pipeline that discovers logic flaws and synthesizes verified exploit mitigations.
                  </p>
                  <div className="mt-4 p-4 rounded-xl bg-black/80 border border-white/10 font-mono text-[11px] text-mist relative overflow-hidden">
                    <div className="absolute inset-0 canvas-grid-bg opacity-40"></div>
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-foam">RAW CODE STREAM</span>
                        <span className="text-dim">TOKENIZER BUFFER</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-center my-3">
                        <div className="p-2 rounded bg-white/5 border border-white/10">
                          <div className="text-bone text-[11px] font-bold">LEXER</div>
                          <div className="text-[9px] text-dim">Tokens</div>
                        </div>
                        <div className="p-2 rounded bg-white/5 border border-white/10">
                          <div className="text-bone text-[11px] font-bold">AST GRAPH</div>
                          <div className="text-[9px] text-dim">Syntax Tree</div>
                        </div>
                        <div className="p-2 rounded bg-foam/10 border border-foam/30">
                          <div className="text-foam text-[11px] font-bold">AI AUDIT</div>
                          <div className="text-[9px] text-foam/80">Neural Model</div>
                        </div>
                        <div className="p-2 rounded bg-white/5 border border-white/10">
                          <div className="text-bone text-[11px] font-bold">PATCH CODE</div>
                          <div className="text-[9px] text-dim">Hot Reload</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-dim pt-2 border-t border-white/5">
                        <span>MODEL EXECUTION: LOCAL EMBEDDED</span>
                        <span className="text-foam font-bold">ACCURACY: 99.98%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blueprint 03: Quark Kernel Memory Shield */}
                <div className="p-6 rounded-2xl bg-[#09090f]/90 border border-white/10 hover:border-foam/40 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-foam font-bold tracking-wider">SCHEMATIC BP-03 // THREAT MITIGATION</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">PROTECTION: MEMORY-LOCK</span>
                  </div>
                  <h4 className="font-display text-xl font-bold text-bone">Quark Zero-Trust Memory Isolation Circuit</h4>
                  <p className="text-[13px] text-dim mt-2 font-light">
                    Background behavioral watcher intercepting buffer overflow attempts, suspicious shell forks, and unauthorized system calls.
                  </p>
                  <div className="mt-4 p-4 rounded-xl bg-black/80 border border-white/10 font-mono text-[11px] text-mist relative overflow-hidden">
                    <div className="absolute inset-0 canvas-grid-bg opacity-40"></div>
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-foam">PROCESS HEURISTICS</span>
                        <span className="text-dim">ANOMALY DETECTOR</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center my-3">
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">MEMORY BUFFER</div>
                          <div className="text-[10px] text-dim mt-1">Bounds Check</div>
                        </div>
                        <div className="p-2.5 rounded bg-foam/10 border border-foam/30">
                          <div className="text-foam font-bold text-xs">LOCKDOWN TRIGGER</div>
                          <div className="text-[10px] text-foam/80 mt-1">Zero-Trust Halt</div>
                        </div>
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">THREAD QUARANTINE</div>
                          <div className="text-[10px] text-dim mt-1">Host Shielded</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-dim pt-2 border-t border-white/5">
                        <span>REACTION TIME: 0.02ms</span>
                        <span className="text-foam font-bold">CONTAINMENT: 100% ISOLATED</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blueprint 04: Optics Virtual HoneyGrid */}
                <div className="p-6 rounded-2xl bg-[#09090f]/90 border border-white/10 hover:border-foam/40 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-foam font-bold tracking-wider">SCHEMATIC BP-04 // HONEYGRID MATRIX</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">DECEPTION: ACTIVE DECOY</span>
                  </div>
                  <h4 className="font-display text-xl font-bold text-bone">Optics Virtual HoneyGrid & Deception Routing Map</h4>
                  <p className="text-[13px] text-dim mt-2 font-light">
                    Dynamically binds synthetic daemon ports to attract, trap, and manipulate unauthorized threat actors into simulated sandbox jails.
                  </p>
                  <div className="mt-4 p-4 rounded-xl bg-black/80 border border-white/10 font-mono text-[11px] text-mist relative overflow-hidden">
                    <div className="absolute inset-0 canvas-grid-bg opacity-40"></div>
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-foam">INBOUND HOSTILE PROBE</span>
                        <span className="text-dim">DECOY ROUTING</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center my-3">
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">VIRTUAL PORTS</div>
                          <div className="text-[10px] text-dim mt-1">21, 22, 80, 8080</div>
                        </div>
                        <div className="p-2.5 rounded bg-foam/10 border border-foam/30">
                          <div className="text-foam font-bold text-xs">HONEYPOT JAIL</div>
                          <div className="text-[10px] text-foam/80 mt-1">Simulated FS</div>
                        </div>
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">FORENSIC LOGGER</div>
                          <div className="text-[10px] text-dim mt-1">PCAP Extraction</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-dim pt-2 border-t border-white/5">
                        <span>DISRUPTION TO HOST WORKSPACE: 0.00%</span>
                        <span className="text-foam font-bold">MANIPULATION: ENABLED</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blueprint 05: MAG Intelligent Recon Fabric */}
                <div className="p-6 rounded-2xl bg-[#09090f]/90 border border-white/10 hover:border-foam/40 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-foam font-bold tracking-wider">SCHEMATIC BP-05 // ADVISORY FABRIC</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">RECON: FULL SYSTEM</span>
                  </div>
                  <h4 className="font-display text-xl font-bold text-bone">MAG Intelligent Recon & Architectural Guidance</h4>
                  <p className="text-[13px] text-dim mt-2 font-light">
                    Cross-system dependency auditing, CVE vulnerability mapping, and automated guidance for secure systems architecture.
                  </p>
                  <div className="mt-4 p-4 rounded-xl bg-black/80 border border-white/10 font-mono text-[11px] text-mist relative overflow-hidden">
                    <div className="absolute inset-0 canvas-grid-bg opacity-40"></div>
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-foam">LOCAL WORKSPACE AUDIT</span>
                        <span className="text-dim">GUIDANCE SYNTHESIS</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center my-3">
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">DEPENDENCY GRAPH</div>
                          <div className="text-[10px] text-dim mt-1">Package Audit</div>
                        </div>
                        <div className="p-2.5 rounded bg-foam/10 border border-foam/30">
                          <div className="text-foam font-bold text-xs">CVE DATABASE</div>
                          <div className="text-[10px] text-foam/80 mt-1">Local Heuristics</div>
                        </div>
                        <div className="p-2.5 rounded bg-white/5 border border-white/10">
                          <div className="text-bone font-bold text-xs">AI MENTOR</div>
                          <div className="text-[10px] text-dim mt-1">Hardening Steps</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-dim pt-2 border-t border-white/5">
                        <span>ACCURACY: MATHEMATICALLY VERIFIED</span>
                        <span className="text-foam font-bold">SCOPE: UNRESTRICTED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* S4: DEVELOPERS */}
        <section
          id="s4"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-28 section-container"
          data-idx="3"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>CORE PROTOCOL ARCHITECTS<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">The Engineers Behind VØID.</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">Built by developers, for developers.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-dim leading-relaxed font-light max-w-lg mx-auto anim-el">
                Meet the systems architects, AI engineers, and security researchers maintaining the sovereign VØID runtime ecosystem.
              </p>
            </div>

            {/* 4 Developer Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {/* Dev 1 */}
              <div className="glass-card hover-target p-8 sm:p-10 rounded-3xl flex flex-col justify-between gap-6 anim-el hover:border-foam/50 transition">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[11px] text-foam font-bold tracking-widest uppercase">ARCHITECT 01</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">CLEARANCE: LEVEL 0</span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-foam/10 border border-foam/30 flex items-center justify-center font-display font-bold text-lg text-foam">
                      AM
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-bone">Alex Mercer</h3>
                      <div className="font-mono text-xs text-mist">@alex-void // Lead Kernel Architect</div>
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed font-light text-mist">
                    Pioneered the zero-trust kernel thread sandbox, eBPF telemetry hooks, and low-latency process air-gapping powering the VØID runtime.
                  </p>
                </div>
                <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-dim">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Rust</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">C++</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">eBPF</span>
                  </div>
                  <span className="text-foam">● ACTIVE CONTRIBUTOR</span>
                </div>
              </div>

              {/* Dev 2 */}
              <div className="glass-card hover-target p-8 sm:p-10 rounded-3xl flex flex-col justify-between gap-6 anim-el hover:border-foam/50 transition">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[11px] text-foam font-bold tracking-widest uppercase">ARCHITECT 02</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">CLEARANCE: LEVEL 1</span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-foam/10 border border-foam/30 flex items-center justify-center font-display font-bold text-lg text-foam">
                      ER
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-bone">Elena Rostova</h3>
                      <div className="font-mono text-xs text-mist">@elena-neural // Head of AI Synthesis</div>
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed font-light text-mist">
                    Designed Lumen's generative AST code transformer, automated vulnerability mitigation model, and real-time security inference pipeline.
                  </p>
                </div>
                <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-dim">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">PyTorch</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">AST Graph</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">TypeScript</span>
                  </div>
                  <span className="text-foam">● ACTIVE CONTRIBUTOR</span>
                </div>
              </div>

              {/* Dev 3 */}
              <div className="glass-card hover-target p-8 sm:p-10 rounded-3xl flex flex-col justify-between gap-6 anim-el hover:border-foam/50 transition">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[11px] text-foam font-bold tracking-widest uppercase">ARCHITECT 03</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">CLEARANCE: LEVEL 1</span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-foam/10 border border-foam/30 flex items-center justify-center font-display font-bold text-lg text-foam">
                      KV
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-bone">Kaelen Vance</h3>
                      <div className="font-mono text-xs text-mist">@kaelen-optics // Offensive Deception Ops</div>
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed font-light text-mist">
                    Engineered Optics virtual honeypots, automated payload capture mechanisms, and interactive intruder deception terminals.
                  </p>
                </div>
                <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-dim">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Go</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Packet PCAP</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Honeynets</span>
                  </div>
                  <span className="text-foam">● ACTIVE CONTRIBUTOR</span>
                </div>
              </div>

              {/* Dev 4 */}
              <div className="glass-card hover-target p-8 sm:p-10 rounded-3xl flex flex-col justify-between gap-6 anim-el hover:border-foam/50 transition">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[11px] text-foam font-bold tracking-widest uppercase">ARCHITECT 04</span>
                    <span className="font-mono text-[10px] text-dim bg-white/5 px-2.5 py-1 rounded">CLEARANCE: LEVEL 1</span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-foam/10 border border-foam/30 flex items-center justify-center font-display font-bold text-lg text-foam">
                      ST
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-bone">Sora Takanashi</h3>
                      <div className="font-mono text-xs text-mist">@sora-sec // Zero-Trust Protocol Lead</div>
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed font-light text-mist">
                    Architected Quark's real-time threat heuristics, cross-core encrypted telemetry fabric, and cryptographic workspace validation.
                  </p>
                </div>
                <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-dim">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Crypto</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Node.js</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-bone">Auditing</span>
                  </div>
                  <span className="text-foam">● ACTIVE CONTRIBUTOR</span>
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

        {/* S5: SUBSCRIPTION */}
        <section
          id="s5"
          className="relative min-h-screen flex flex-col justify-center items-center px-6 py-28 section-container"
          data-idx="4"
        >
          <div className="section-trigger"></div>
          <div className="max-w-6xl mx-auto w-full">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-3 flex items-center justify-center gap-2 anim-el font-semibold">
                <span className="w-4 h-px bg-line"></span>STATION ACCESS & TIERS<span className="w-4 h-px bg-line"></span>
              </p>
              <h2 className="font-display text-3xl sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08]">
                <div className="anim-wrap"><div className="anim-el text-bone">Transparent Access.</div></div><br />
                <div className="anim-wrap"><div className="anim-el text-mist font-light">Engineered for individual and team scale.</div></div>
              </h2>
              <p className="mt-6 text-[15px] text-dim leading-relaxed font-light max-w-lg mx-auto anim-el">
                Deploy the sovereign runtime model suited for your security and engineering requirements.
              </p>
            </div>

            {/* 4 Subscription Packs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Pack 1: Student */}
              <div className="glass-card hover-target p-7 rounded-3xl flex flex-col justify-between border-white/10 hover:border-foam/30 transition anim-el">
                <div>
                  <span className="font-mono text-[10px] text-mist font-bold uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded">
                    STUDENT PASS
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-bone">$0</span>
                    <span className="text-xs text-dim font-mono">/ FOREVER</span>
                  </div>
                  <p className="text-[13px] text-mist mt-3 font-light leading-relaxed">
                    Essential toolset for students, cybersecurity learners, and open-source hobbyists.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-[12px] text-dim font-light">
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> DCS Visual Node Canvas
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> 50 Lumen AI queries / day
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Local Quark dependency scanner
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-dim">✕</span> Live HoneyGrid Deception
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-dim">✕</span> Air-gapped offline team sync
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => onSwitchModule('nodes')}
                  className="mt-8 w-full py-3 rounded-full bg-white/5 border border-white/10 hover:border-foam/40 hover:bg-white/10 text-xs font-bold text-bone transition"
                >
                  Start Free
                </button>
              </div>

              {/* Pack 2: Monthly Pro */}
              <div className="glass-card hover-target p-7 rounded-3xl flex flex-col justify-between border-white/10 hover:border-foam/30 transition anim-el">
                <div>
                  <span className="font-mono text-[10px] text-foam font-bold uppercase tracking-widest bg-foam/10 px-2.5 py-1 rounded">
                    MONTHLY PRO
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-bone">$29</span>
                    <span className="text-xs text-dim font-mono">/ MONTH</span>
                  </div>
                  <p className="text-[13px] text-mist mt-3 font-light leading-relaxed">
                    Full sovereign runtime access for professional developers and solo security researchers.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-[12px] text-dim font-light">
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Unlimited Lumen Neural AI Synthesis
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Quark Real-time Process Lockdown
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> 2 Active Optics Decoy Honeyports
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Forensic PCAP Export
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-dim">✕</span> Air-gapped multi-seat sync
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => onSwitchModule('nodes')}
                  className="mt-8 w-full py-3 rounded-full bg-white/10 border border-white/20 hover:bg-white hover:text-space text-xs font-bold text-bone transition"
                >
                  Deploy Monthly Pro
                </button>
              </div>

              {/* Pack 3: Yearly Sovereign (Featured) */}
              <div className="glass-card hover-target p-7 rounded-3xl flex flex-col justify-between border-foam/50 bg-[#0c0c12] relative shadow-xl shadow-foam/5 transition anim-el">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foam text-space font-mono text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full shadow">
                  ★ MOST POPULAR // SAVE 20%
                </div>
                <div>
                  <span className="font-mono text-[10px] text-foam font-bold uppercase tracking-widest bg-foam/15 px-2.5 py-1 rounded">
                    YEARLY SOVEREIGN
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-foam">$24</span>
                    <span className="text-xs text-dim font-mono">/ MONTH</span>
                  </div>
                  <div className="text-[11px] font-mono text-dim mt-1">$288 billed annually (2 months free)</div>
                  <p className="text-[13px] text-mist mt-3 font-light leading-relaxed">
                    Complete tactical cybersecurity workstation for elite security engineers and full-time developers.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-[12px] text-dim font-light">
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> All Pro Features Included
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Unlimited Optics Virtual HoneyGrid
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Full MAG Autonomous Cyber Mentor
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Local GPU Neural Acceleration
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Air-Gap Offline License Key
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => onSwitchModule('nodes')}
                  className="mt-8 w-full py-3 rounded-full bg-foam hover:bg-white text-space text-xs font-bold transition shadow-lg shadow-foam/20"
                >
                  Claim Sovereign Access
                </button>
              </div>

              {/* Pack 4: Contact Vice / Enterprise */}
              <div className="glass-card hover-target p-7 rounded-3xl flex flex-col justify-between border-white/10 hover:border-foam/30 transition anim-el">
                <div>
                  <span className="font-mono text-[10px] text-mist font-bold uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded">
                    CONTACT VICE
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-3xl sm:text-4xl font-bold text-bone">Custom</span>
                    <span className="text-xs text-dim font-mono">/ ORG</span>
                  </div>
                  <p className="text-[13px] text-mist mt-3 font-light leading-relaxed">
                    Bespoke air-gapped deployment for enterprise security teams, red/blue units, and institutions.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-[12px] text-dim font-light">
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> 100% On-Premise Air-Gap Cluster
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Custom eBPF Kernel Hooks & Audits
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Multi-seat Shared Forensics
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> Dedicated Zero-Day Intelligence Feed
                    </li>
                    <li className="flex items-center gap-2 text-bone">
                      <span className="text-foam">✓</span> 24/7 Security Engineering SLA
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => scrollToSection('s6')}
                  className="mt-8 w-full py-3 rounded-full bg-white/5 border border-white/10 hover:border-foam/40 hover:bg-white/10 text-xs font-bold text-bone transition"
                >
                  Contact Vice →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* S6: DIRECT TRANSMISSION & FOOTER */}
        <section
          id="s6"
          className="relative min-h-screen flex flex-col justify-between px-6 pt-28 pb-10 section-container"
          data-idx="5"
        >
          <div className="section-trigger"></div>
          <div className="max-w-4xl mx-auto w-full text-center my-auto contact-content">
            <p className="font-mono text-[11px] uppercase tracking-[.25em] text-mist mb-4 flex items-center justify-center gap-2 anim-el font-semibold">
              <span className="w-4 h-px bg-line"></span>DIRECT TRANSMISSION<span className="w-4 h-px bg-line"></span>
            </p>
            <h2 className="font-display text-4xl sm:text-[64px] md:text-[80px] font-semibold tracking-[-0.04em] leading-[1.02]">
              <div className="anim-wrap"><div className="anim-el text-bone">Connect with VØID.</div></div><br />
              <div className="anim-wrap"><div className="anim-el font-light text-mist">Transmit your signal.</div></div>
            </h2>
            <p className="mt-6 text-[15px] sm:text-[16px] text-dim leading-relaxed font-light max-w-lg mx-auto anim-el">
              Have a subscription inquiry, zero-day disclosure, or question for the development guild? Transmit your query directly.
            </p>

            {/* Custom Input Bar Requested by User */}
            <div className="mt-10 max-w-xl mx-auto anim-el">
              <div className="font-mono text-[11px] text-foam uppercase tracking-widest mb-3 font-semibold text-left sm:text-center">
                YOUR QUERY
              </div>
              <form onSubmit={handleQuerySubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="we contact you soon"
                  className="w-full bg-black/60 border border-white/15 focus:border-foam/80 rounded-full px-6 py-4 text-sm text-bone placeholder:text-mist/50 outline-none backdrop-blur-xl transition shadow-xl hover-target pr-36"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-5 py-2.5 bg-foam hover:bg-white text-space font-bold text-xs tracking-wider uppercase rounded-full transition shadow hover:scale-105 active:scale-95"
                >
                  Send
                </button>
              </form>
              {querySubmitted && (
                <div className="mt-3 font-mono text-xs text-foam bg-foam/10 border border-foam/30 rounded-xl py-2 px-4 inline-block fade-in">
                  ✓ Transmission received. We contact you soon.
                </div>
              )}
            </div>

            {/* Social Handles & Contact Links */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 anim-el font-mono text-xs">
              <div className="flex items-center gap-2 text-mist bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <span className="text-foam">GIT:</span>
                <span className="text-bone">github.com/void-protocol</span>
              </div>
              <div className="flex items-center gap-2 text-mist bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <span className="text-foam">DISCORD:</span>
                <span className="text-bone">discord.gg/void-sec</span>
              </div>
              <div className="flex items-center gap-2 text-mist bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <span className="text-foam">X:</span>
                <span className="text-bone">@void_runtime</span>
              </div>
              <div className="flex items-center gap-2 text-mist bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <span className="text-foam">TELEGRAM:</span>
                <span className="text-bone">t.me/void_security</span>
              </div>
            </div>

            <p className="mt-8 font-mono text-[10px] uppercase tracking-[.2em] text-dim anim-el">
              VØID RUNTIME ENGINE &middot; ZERO-TRUST SOVEREIGN WORKSTATION &middot; ALL CORES ONLINE
            </p>
          </div>

          {/* Footer Area with All External Links Cut Off & Re-routed to VOID */}
          <div className="max-w-6xl mx-auto w-full pt-16 mt-20 border-t border-line/50 anim-fade" id="footer-area">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-left mb-12">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold mb-4 text-bone">
                  <span className="opacity-70 text-foam">✦</span> VØID STUDIO
                </div>
                <p className="text-[13px] text-mist leading-relaxed font-light mb-4 pr-4">
                  Sovereign developer workstation and autonomous cyber runtime environment.
                </p>
                <div className="font-mono text-[9px] uppercase tracking-widest text-foam font-bold">
                  LOCAL ENGINE AIR-GAPPED
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-dim mb-5 font-semibold">ENGINES</div>
                <ul className="space-y-3 text-[13px] text-mist">
                  <li><button onClick={() => onSwitchModule('nodes')} className="hover-target hover:text-bone transition">DCS (Collaborative Space)</button></li>
                  <li><button onClick={() => onSwitchModule('ide')} className="hover-target hover:text-bone transition">lumen (AI Security Synthesis)</button></li>
                  <li><button onClick={() => onSwitchModule('timeline')} className="hover-target hover:text-bone transition">quark (Threat Defense)</button></li>
                  <li><button onClick={() => onSwitchModule('bento')} className="hover-target hover:text-bone transition">optics (HoneyGrid)</button></li>
                  <li><button onClick={() => onSwitchModule('settings')} className="hover-target hover:text-bone transition">MAG (Mentor & Guide)</button></li>
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-dim mb-5 font-semibold">SECURITY CORES</div>
                <ul className="space-y-3 text-[13px] text-mist">
                  <li><button onClick={() => onSwitchModule('timeline')} className="hover-target hover:text-bone transition">Process Lockdown</button></li>
                  <li><button onClick={() => onSwitchModule('settings')} className="hover-target hover:text-bone transition">Vulnerability Recon</button></li>
                  <li><button onClick={() => onSwitchModule('bento')} className="hover-target hover:text-bone transition">Threat Deception Map</button></li>
                  <li><button onClick={() => { if (onOpenSettings) onOpenSettings() }} className="hover-target hover:text-bone transition">Access Policies</button></li>
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-dim mb-5 font-semibold">TELEMETRY</div>
                <ul className="space-y-3 text-[13px] text-mist">
                  <li><span className="text-dim">Protocol: v1.0.0 (Void)</span></li>
                  <li><span className="text-dim">Engine: 100% Sandboxed</span></li>
                  <li><span className="text-dim">Cores: 5 / 5 Active</span></li>
                  <li><span className="text-dim">Status: Mathematical Proof</span></li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-wider text-dim pt-6 border-t border-line/40">
              <span>© 2026 VØID PROTOCOL STUDIO — SOVEREIGN RUNTIME</span>
              <span>VERSION 1....VOID</span>
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

