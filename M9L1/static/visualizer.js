/**
 * J.A.R.V.I.S. Holographic Arc Reactor & Tactical HUD Visualizer
 * Stark Industries Advanced Tactical Interface
 */

class JarvisVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    this.state = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'
    this.audioData = new Uint8Array(64);
    this.analyser = null;
    this.time = 0;
    
    // HUD Rings & Gears
    this.rings = [
      { radius: 75,  speed:  0.008, width: 1.5, type: 'ticks', color: '#00f0ff', count: 48 },
      { radius: 110, speed: -0.006, width: 2.0, type: 'dashed', color: '#00c3ff', dash: [14, 10] },
      { radius: 155, speed:  0.004, width: 1.0, type: 'dots', color: '#00f0ff', count: 32 },
      { radius: 195, speed: -0.003, width: 1.5, type: 'arcs', color: '#0099ff', segments: 4 },
      { radius: 245, speed:  0.002, width: 1.0, type: 'bracket', color: 'rgba(0, 240, 255, 0.45)', count: 8 },
      { radius: 290, speed: -0.001, width: 0.8, type: 'radar', color: 'rgba(0, 162, 255, 0.3)' }
    ];

    // Floating Holographic Dust
    this.particles = [];
    this.numParticles = 60;
    
    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Generate HUD ambient floating particles
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * this.width,
        y: (Math.random() - 0.5) * this.height,
        size: Math.random() * 2 + 0.8,
        color: Math.random() > 0.3 ? '#00f0ff' : '#ffd000',
        alpha: Math.random() * 0.6 + 0.2,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3
      });
    }

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    this.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.parentElement.clientHeight;
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  }

  setState(newState) {
    this.state = newState;
  }

  setAnalyser(analyserNode) {
    this.analyser = analyserNode;
  }

  getAudioIntensity() {
    if (this.analyser && this.state === 'speaking') {
      this.analyser.getByteFrequencyData(this.audioData);
      let sum = 0;
      for (let i = 0; i < 32; i++) {
        sum += this.audioData[i];
      }
      return (sum / 32) / 255;
    }
    return 0;
  }

  animate() {
    this.time += 1;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const audioAmp = this.getAudioIntensity();

    // Speed multiplier depending on J.A.R.V.I.S. operational state
    let speedMult = 1.0;
    if (this.state === 'thinking') speedMult = 4.2;
    if (this.state === 'listening') speedMult = 1.8;
    if (this.state === 'speaking') speedMult = 1.3 + audioAmp * 3.0;

    // 1. Draw Hologram Grid & Crosshairs
    this.drawHoloGrid();

    // 2. Draw Ambient Floating Hologram Sparks
    this.drawParticles();

    // 3. Draw Concentric Arc Reactor Tactical HUD Rings
    this.drawHudRings(speedMult, audioAmp);

    // 4. Draw Radial Equalizer Bars (Reacts dynamically to voice!)
    this.drawCircularEqualizer(audioAmp);

    // 5. Draw Central Arc Reactor Core
    this.drawArcReactorCore(audioAmp);

    // 6. Draw Scanning Radar Sweep
    this.drawRadarSweep();

    requestAnimationFrame(this.animate);
  }

  drawHoloGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;

    // Center Crosshairs
    const len = 350;
    ctx.beginPath();
    ctx.moveTo(this.cx - len, this.cy);
    ctx.lineTo(this.cx + len, this.cy);
    ctx.moveTo(this.cx, this.cy - len);
    ctx.lineTo(this.cx, this.cy + len);
    ctx.stroke();

    // Corner targeting ticks
    const r = 270;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.strokeRect(this.cx - r, this.cy - r, r * 2, r * 2);

    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();

    for (let p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < -this.width / 2) p.x = this.width / 2;
      if (p.x > this.width / 2) p.x = -this.width / 2;
      if (p.y < -this.height / 2) p.y = this.height / 2;
      if (p.y > this.height / 2) p.y = -this.height / 2;

      const px = this.cx + p.x;
      const py = this.cy + p.y;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * 0.45;
      ctx.fill();
    }
    ctx.restore();
  }

  drawHudRings(speedMult, audioAmp) {
    const ctx = this.ctx;

    this.rings.forEach((ring, idx) => {
      const angle = this.time * ring.speed * speedMult;
      const radiusBoost = this.state === 'speaking' ? audioAmp * 25 * (idx % 2 === 0 ? 1 : -0.5) : 0;
      const currentRadius = ring.radius + radiusBoost;

      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(angle);

      // Distinct J.A.R.V.I.S. HUD ring geometry
      if (ring.type === 'ticks') {
        // High-density precision dial
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.width;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        
        for (let i = 0; i < ring.count; i++) {
          const theta = (i / ring.count) * Math.PI * 2;
          const tickLen = (i % 4 === 0) ? 9 : 4;
          const x1 = Math.cos(theta) * (currentRadius - tickLen);
          const y1 = Math.sin(theta) * (currentRadius - tickLen);
          const x2 = Math.cos(theta) * currentRadius;
          const y2 = Math.sin(theta) * currentRadius;
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } 
      else if (ring.type === 'dashed') {
        // Segmented shield ring
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.setLineDash(ring.dash);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.width;
        ctx.shadowColor = '#00c3ff';
        ctx.shadowBlur = 6;
        ctx.stroke();
      } 
      else if (ring.type === 'dots') {
        // Rotating orbital telemetry nodes
        for (let i = 0; i < ring.count; i++) {
          const theta = (i / ring.count) * Math.PI * 2;
          const px = Math.cos(theta) * currentRadius;
          const py = Math.sin(theta) * currentRadius;
          
          ctx.beginPath();
          const dotRadius = (i % 8 === 0) ? 3.5 : 2.0;
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = (i % 8 === 0) ? '#ffd000' : ring.color;
          ctx.shadowColor = ring.color;
          ctx.shadowBlur = 10;
          ctx.fill();
        }
      } 
      else if (ring.type === 'arcs') {
        // Heavy holographic armor arcs
        for (let i = 0; i < ring.segments; i++) {
          const startTheta = (i / ring.segments) * Math.PI * 2;
          const arcLen = (Math.PI * 2 / ring.segments) * 0.55;
          ctx.beginPath();
          ctx.arc(0, 0, currentRadius, startTheta, startTheta + arcLen);
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = ring.width + (audioAmp * 2);
          ctx.shadowColor = '#0099ff';
          ctx.shadowBlur = 8;
          ctx.stroke();
        }
      } 
      else if (ring.type === 'bracket') {
        // Tactical outer bounding brackets
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        for (let i = 0; i < ring.count; i++) {
          const theta = (i / ring.count) * Math.PI * 2;
          const x = Math.cos(theta) * currentRadius;
          const y = Math.sin(theta) * currentRadius;
          ctx.strokeRect(x - 3, y - 3, 6, 6);
        }
      }
      else if (ring.type === 'radar') {
        // Precision coordinate ring
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  drawCircularEqualizer(audioAmp) {
    const ctx = this.ctx;
    const numBars = 48;
    const baseRadius = 125;

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.time * 0.003);

    for (let i = 0; i < numBars; i++) {
      const theta = (i / numBars) * Math.PI * 2;
      let barHeight = 4;
      
      if (this.state === 'speaking') {
        const freqIdx = i % 32;
        const val = this.audioData[freqIdx] / 255;
        barHeight = 4 + val * 45;
      } else if (this.state === 'listening') {
        barHeight = 4 + Math.sin(this.time * 0.15 + i * 0.4) * 14;
      } else if (this.state === 'thinking') {
        barHeight = 6 + Math.sin(this.time * 0.3 + i * 0.8) * 20;
      }

      const x1 = Math.cos(theta) * baseRadius;
      const y1 = Math.sin(theta) * baseRadius;
      const x2 = Math.cos(theta) * (baseRadius + barHeight);
      const y2 = Math.sin(theta) * (baseRadius + barHeight);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2.2;
      
      if (this.state === 'thinking') {
        ctx.strokeStyle = (i % 2 === 0) ? '#ffd000' : '#00f0ff';
      } else if (this.state === 'speaking') {
        ctx.strokeStyle = (i % 3 === 0) ? '#ffffff' : '#00f0ff';
      } else {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      }
      
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawArcReactorCore(audioAmp) {
    const ctx = this.ctx;
    let coreRadius = 45;

    if (this.state === 'listening') {
      coreRadius = 50 + Math.sin(this.time * 0.12) * 6;
    } else if (this.state === 'thinking') {
      coreRadius = 42 + Math.sin(this.time * 0.3) * 10;
    } else if (this.state === 'speaking') {
      coreRadius = 46 + audioAmp * 35;
    } else {
      coreRadius = 45 + Math.sin(this.time * 0.04) * 3;
    }

    ctx.save();

    // Outer Arc Reactor Energy Aura
    const auraGrad = ctx.createRadialGradient(this.cx, this.cy, 5, this.cx, this.cy, coreRadius * 2.2);
    auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    auraGrad.addColorStop(0.25, 'rgba(0, 240, 255, 0.85)');
    auraGrad.addColorStop(0.65, 'rgba(0, 150, 255, 0.25)');
    auraGrad.addColorStop(1, 'rgba(0, 80, 255, 0)');

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, coreRadius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = auraGrad;
    ctx.fill();

    // Inner Glowing Core (Pure Arc Reactor Palladium/Vibranium core)
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, coreRadius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 28;
    ctx.fill();

    // Inner Triangular Geometry (Stark Arc Reactor Symbol)
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.time * (this.state === 'thinking' ? -0.05 : -0.01));

    ctx.beginPath();
    const triRadius = coreRadius * 0.65;
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      const x = Math.cos(angle) * triRadius;
      const y = Math.sin(angle) * triRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }

  drawRadarSweep() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.time * 0.015);

    const sweepGrad = ctx.createLinearGradient(0, 0, 180, 0);
    sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    sweepGrad.addColorStop(1, 'rgba(0, 240, 255, 0.15)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 180, 0, 0.45);
    ctx.closePath();
    ctx.fillStyle = sweepGrad;
    ctx.fill();

    ctx.restore();
  }
}

// Export for app.js
window.OrbVisualizer = JarvisVisualizer;
