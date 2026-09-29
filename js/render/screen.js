// The shadow screen: renders everything behind the cloth into a
// transmittance map (multiplicative, so layering order never matters —
// just like real overlapping hides), then draws the cloth itself lit
// from behind by the lamp.
//
// Physically inspired:
//  - every object at depth z (0 = on the cloth, 1 = at the lamp) casts a
//    shadow magnified by 1/(1-z) about the lamp's projection;
//  - the lamp has a finite size, so the penumbra grows with z;
//  - dyed translucent hide shows its colour only when pressed close;
//    further back it melts into a soft grey shadow.

import { compile, quadVAO, textureFromCanvas, renderTarget } from './gl.js';

export const CLOTH_W = 1600, CLOTH_H = 1000;

const SPRITE_VS = `#version 300 es
layout(location=0) in vec2 aPos;
uniform mat3 uM;       // sprite-local (world units) -> cloth units
uniform vec4 uBox;     // quad in sprite-local units
uniform vec2 uSize;    // sprite size (world units)
uniform vec2 uCloth;
out vec2 vUV;
void main() {
  vec2 p = mix(uBox.xy, uBox.zw, aPos);
  vUV = p / uSize;
  vec2 c = (uM * vec3(p, 1.0)).xy;
  gl_Position = vec4(c / uCloth * 2.0 - 1.0, 0.0, 1.0);
}`;

const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uBlurUV;   // penumbra radius in uv units
uniform float uLod;
uniform float uFar;     // 0 pressed on cloth .. 1 far (grey shadow)
uniform float uOpacity;
uniform float uGlow;    // self-lit (fire, lantern flame): let light through
out vec4 o;
const vec2 P[16] = vec2[](
  vec2(-0.613,0.354), vec2(0.171,-0.922), vec2(0.766,0.428), vec2(-0.229,-0.294),
  vec2(0.324,0.089), vec2(-0.876,-0.342), vec2(-0.117,0.834), vec2(0.548,-0.517),
  vec2(0.923,-0.093), vec2(-0.466,-0.781), vec2(0.037,0.402), vec2(-0.707,0.689),
  vec2(0.412,0.866), vec2(-0.97,0.07), vec2(0.64,-0.84), vec2(-0.32,-0.02));
vec4 tap(vec2 uv) {
  vec2 e = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return textureLod(uTex, uv, uLod) * (e.x * e.y);
}
void main() {
  vec4 acc = tap(vUV) * 1.5;
  float wsum = 1.5;
  if (uBlurUV.x > 0.0005) {
    for (int i = 0; i < 16; i++) {
      float w = 1.0 - 0.45 * length(P[i]);
      acc += tap(vUV + P[i] * uBlurUV) * w;
      wsum += w;
    }
  } else {
    acc = tap(vUV); wsum = 1.0;
  }
  acc /= wsum;
  float a = acc.a * uOpacity;
  if (a < 0.002) discard;
  vec3 col = acc.a > 1e-4 ? acc.rgb / acc.a : vec3(0.0);
  vec3 T = pow(col, vec3(1.6));
  float lum = dot(T, vec3(0.3, 0.55, 0.15));
  T = mix(T, vec3(lum * 0.45), uFar * 0.9);
  T = max(T, vec3(0.018, 0.014, 0.01));
  T = mix(T, vec3(1.0), uGlow);
  o = vec4(mix(vec3(1.0), T, a), 1.0);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec2 aPos;
uniform vec2 uA, uB;     // cloth units
uniform float uHalf;     // half width incl. blur
uniform vec2 uCloth;
out vec2 vQ;             // x along 0..1, y across -1..1
void main() {
  vec2 d = uB - uA;
  float L = max(length(d), 1e-3);
  vec2 t = d / L, n = vec2(-t.y, t.x);
  vec2 p = mix(uA - t * uHalf, uB + t * uHalf, aPos.x) + n * uHalf * (aPos.y * 2.0 - 1.0);
  vQ = vec2(aPos.x, aPos.y * 2.0 - 1.0);
  gl_Position = vec4(p / uCloth * 2.0 - 1.0, 0.0, 1.0);
}`;

const LINE_FS = `#version 300 es
precision highp float;
in vec2 vQ;
uniform float uCore;     // core half width / total half width
uniform float uDark;
out vec4 o;
void main() {
  float d = abs(vQ.y);
  float a = 1.0 - smoothstep(uCore, 1.0, d);
  a *= smoothstep(0.0, 0.04, vQ.x) * smoothstep(1.0, 0.96, vQ.x);
  o = vec4(mix(vec3(1.0), vec3(uDark), a), 1.0);
}`;

const CLOTH_VS = `#version 300 es
layout(location=0) in vec2 aPos;      // 0..1 across the cloth
uniform sampler2D uHeight;
uniform vec4 uView;    // camX, camY, zoom, unused
uniform vec2 uViewport;
uniform vec2 uCloth;
uniform vec4 uRect;    // cloth rect in scene units x0,y0,x1,y1
out vec2 vUV;
out vec2 vP;
out float vH;
void main() {
  vUV = aPos;
  float h = texture(uHeight, aPos).r;
  vH = h;
  vec2 p = mix(uRect.xy, uRect.zw, aPos);
  vP = aPos * uCloth;
  // bulge toward the viewer: a touch of perspective
  vec2 c = vec2(uView.x, uView.y);
  p += (p - c) * h * 0.00045;
  vec2 s = (p - c) * uView.z + uViewport * 0.5;
  gl_Position = vec4(s.x / uViewport.x * 2.0 - 1.0, 1.0 - s.y / uViewport.y * 2.0, 0.0, 1.0);
}`;

const CLOTH_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vP;
in float vH;
uniform sampler2D uLight;
uniform sampler2D uHeight;
uniform vec2 uCloth;
uniform vec3 uLamp;       // x, y (cloth units), distance behind the cloth
uniform float uLampI;
uniform float uLampR;     // flame size (hotspot)
uniform vec3 uLampColor;
uniform vec3 uAmbient;
uniform float uTime;
uniform int uGlowN;
uniform vec4 uGlows[8];   // x, y, radius, intensity
uniform vec3 uGlowC[8];
uniform float uExposure;
uniform float uHover;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 p = vP;
  // membrane normal
  vec2 e = 1.0 / vec2(textureSize(uHeight, 0));
  float hx = texture(uHeight, vUV + vec2(e.x, 0)).r - texture(uHeight, vUV - vec2(e.x, 0)).r;
  float hy = texture(uHeight, vUV + vec2(0, e.y)).r - texture(uHeight, vUV - vec2(0, e.y)).r;
  vec2 grad = vec2(hx, hy) / (2.0 * e * uCloth);
  vec3 n = normalize(vec3(-grad * 9.0, 1.0));

  // shadows shift where the cloth bulges
  vec2 toL = p - uLamp.xy;
  vec2 luv = vUV + toL / uCloth * (vH / uLamp.z);
  vec3 T = texture(uLight, luv).rgb;
  vec3 Tb = textureLod(uLight, luv, 4.0).rgb;
  T = mix(T, Tb, 0.10);            // light scattering inside the weave

  // lamp irradiance on the back of the cloth (cos^3 falloff + wrinkles)
  vec3 L = normalize(vec3(uLamp.xy - p, -uLamp.z));
  float r2 = dot(toL, toL);
  float D = uLamp.z;
  float E = pow(D * D / (D * D + r2), 1.5);
  float wr = clamp(dot(vec3(-n.xy, n.z), vec3(-L.xy, -L.z)), 0.3, 1.2);
  E *= mix(1.0, wr, 0.7);
  // the flame itself glowing through thin cotton
  float glare = exp(-r2 / (2.0 * uLampR * uLampR)) * 0.9 + exp(-r2 / (18.0 * uLampR * uLampR)) * 0.25;

  // hand-woven cotton: threads, slubs, seams, age
  float fw = fwidth(p.x);
  float threads = (sin(p.x * 3.3) * sin(p.y * 3.1)) * 0.5;
  float weave = 1.0 + threads * 0.06 * smoothstep(1.4, 0.35, fw);
  float slub = (noise(vec2(p.x * 0.025, p.y * 0.9)) - 0.5) * 0.05 + (noise(vec2(p.x * 1.1, p.y * 0.03)) - 0.5) * 0.04;
  weave += slub;
  float seam = 0.0;
  for (int i = 1; i < 3; i++) {
    float sx = uCloth.x * float(i) / 3.0 + sin(p.y * 0.01 + float(i)) * 2.0;
    float d = abs(p.x - sx);
    seam += (1.0 - smoothstep(1.2, 3.2, d)) * 0.22;
    seam += (1.0 - smoothstep(0.0, 1.0, abs(d - 4.5))) * step(0.5, fract(p.y / 7.0)) * 0.12;
  }
  float age = fbm(p * 0.004 + 3.1);
  float spots = smoothstep(0.72, 0.9, fbm(p * 0.011 + 17.0)) * 0.12;
  vec2 ed = min(vUV, 1.0 - vUV) * uCloth;
  float edge = min(ed.x, ed.y);
  float hem = 1.0 - smoothstep(0.0, 26.0, edge) * 0.25 - 0.75;
  float trans = clamp(weave * (1.0 - seam) * (1.0 - spots) * (0.93 + age * 0.1) * (1.0 - (1.0 - smoothstep(0.0, 22.0, edge)) * 0.35), 0.0, 1.3);
  vec3 clothTint = mix(vec3(1.0, 0.97, 0.9), vec3(0.93, 0.86, 0.72), age * 0.6 + spots);

  vec3 col = uLampColor * uLampI * (E + glare) * T * trans * clothTint;
  for (int i = 0; i < 8; i++) {
    if (i >= uGlowN) break;
    vec2 d = p - uGlows[i].xy;
    float g = exp(-dot(d, d) / (2.0 * uGlows[i].z * uGlows[i].z)) * uGlows[i].w;
    col += uGlowC[i] * g * trans * clothTint * mix(vec3(1.0), T, 0.35);
  }
  // cool moonlight reflecting off the front
  col += uAmbient * clothTint * (0.6 + 0.4 * n.z) * (0.85 + age * 0.2);
  col *= 1.0 + uHover * 0.04;
  col = aces(col * uExposure);
  col = pow(col, vec3(0.95, 0.98, 1.04));
  o = vec4(col, 1.0);
}`;

export class ShadowScreen {
  constructor(gl) {
    this.gl = gl;
    this.sprite = compile(gl, SPRITE_VS, SPRITE_FS);
    this.line = compile(gl, LINE_VS, LINE_FS);
    this.cloth = compile(gl, CLOTH_VS, CLOTH_FS);
    this.quad = quadVAO(gl);
    this.textures = new Map();
    this.q = 0;
    this.lampRadius = 26;
    this._grid(96, 60);
    this.heightTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.heightTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.stats = { draws: 0 };
  }

  _grid(nx, ny) {
    const gl = this.gl;
    const verts = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) verts.push(i / nx, j / ny);
    const idx = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    this.gridVAO = gl.createVertexArray();
    gl.bindVertexArray(this.gridVAO);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.gridCount = idx.length;
  }

  setQuality(q) {
    q = Math.max(0.5, Math.min(1.5, q));
    if (Math.abs(q - this.q) < 0.08 && this.target) return;
    this.q = q;
    const w = Math.round(CLOTH_W * q), h = Math.round(CLOTH_H * q);
    this.target = renderTarget(this.gl, w, h, { mip: true });
  }

  tex(sprite) {
    let t = this.textures.get(sprite.id);
    if (!t) {
      t = textureFromCanvas(this.gl, sprite.canvas);
      this.textures.set(sprite.id, t);
    }
    return t;
  }

  dropTexture(sprite) {
    const t = this.textures.get(sprite.id);
    if (t) this.gl.deleteTexture(t);
    this.textures.delete(sprite.id);
  }

  // items: [{ sprite, m: [a,b,c,d,e,f] sprite-local->world, z, opacity, glow }]
  //        [{ line: true, a, b, width, z, dark }]
  renderShadows(items, lamp) {
    const gl = this.gl;
    const T = this.target;
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
    gl.viewport(0, 0, T.w, T.h);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.bindVertexArray(this.quad);
    const S = this.sprite;
    gl.useProgram(S.p);
    gl.uniform2f(S.u.uCloth, CLOTH_W, CLOTH_H);
    gl.uniform1i(S.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    let draws = 0;
    const LR = this.lampRadius;
    const lines = [];
    for (const it of items) {
      if (it.line) { lines.push(it); continue; }
      const z = Math.min(0.9, Math.max(0, it.z));
      const s = 1 / (1 - z);
      const m = it.m;
      // projection about the lamp: P = L + (p - L) * s
      const a = m[0] * s, b = m[1] * s, c = m[2] * s, d = m[3] * s;
      const e = lamp.x + (m[4] - lamp.x) * s, f = lamp.y + (m[5] - lamp.y) * s;
      const sp = it.sprite;
      const scaleX = Math.hypot(a, b);
      const blur = (LR * z) / (1 - z) + (it.blur || 0); // cloth units
      const blurLocal = blur / Math.max(scaleX, 1e-3);    // sprite-local units
      const texel = sp.scale;
      const lod = Math.max(0, Math.log2(Math.max(1, blurLocal / texel / 2.5)));
      gl.uniformMatrix3fv(S.u.uM, false, [a, b, 0, c, d, 0, e, f, 1]);
      const pad = blurLocal * 1.05;
      gl.uniform4f(S.u.uBox, -pad, -pad, sp.w + pad, sp.h + pad);
      gl.uniform2f(S.u.uSize, sp.w, sp.h);
      gl.uniform2f(S.u.uBlurUV, blurLocal / sp.w, blurLocal / sp.h);
      gl.uniform1f(S.u.uLod, lod);
      gl.uniform1f(S.u.uFar, smoothstep(0.03, 0.42, z));
      gl.uniform1f(S.u.uOpacity, it.opacity ?? 1);
      gl.uniform1f(S.u.uGlow, it.glow || 0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex(sp));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      draws++;
    }
    if (lines.length) {
      const Lp = this.line;
      gl.useProgram(Lp.p);
      gl.uniform2f(Lp.u.uCloth, CLOTH_W, CLOTH_H);
      for (const l of lines) {
        const z = Math.min(0.9, Math.max(0, l.z));
        const s = 1 / (1 - z);
        const A = [lamp.x + (l.a[0] - lamp.x) * s, lamp.y + (l.a[1] - lamp.y) * s];
        const B = [lamp.x + (l.b[0] - lamp.x) * s, lamp.y + (l.b[1] - lamp.y) * s];
        const blur = (LR * z) / (1 - z);
        const core = (l.width * s) / 2;
        const half = core + blur + 0.8;
        gl.uniform2f(Lp.u.uA, A[0], A[1]);
        gl.uniform2f(Lp.u.uB, B[0], B[1]);
        gl.uniform1f(Lp.u.uHalf, half);
        gl.uniform1f(Lp.u.uCore, Math.max(0, (core - 0.6) / half));
        const darkBlur = l.dark ?? 0.04;
        gl.uniform1f(Lp.u.uDark, 1 - (1 - darkBlur) * Math.min(1, (core * 2) / (core * 2 + blur * 1.2)));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        draws++;
      }
    }
    gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.stats.draws = draws;
  }

  uploadHeights(mem) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.heightTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, mem.nx, mem.ny, 0, gl.RED, gl.FLOAT, mem.h);
  }

  // Draw the cloth into the default framebuffer.
  drawCloth({ cam, viewport, rect, lamp, lampI, lampColor, ambient, glows, time, exposure = 1, hover = 0 }) {
    const gl = this.gl;
    const C = this.cloth;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, viewport[0], viewport[1]);
    gl.useProgram(C.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.target.tex);
    gl.uniform1i(C.u.uLight, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTex);
    gl.uniform1i(C.u.uHeight, 1);
    gl.uniform4f(C.u.uView, cam.x, cam.y, cam.zoom, 0);
    gl.uniform2f(C.u.uViewport, viewport[0], viewport[1]);
    gl.uniform2f(C.u.uCloth, CLOTH_W, CLOTH_H);
    gl.uniform4f(C.u.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform3f(C.u.uLamp, lamp.x, lamp.y, lamp.dist);
    gl.uniform1f(C.u.uLampI, lampI);
    gl.uniform1f(C.u.uLampR, lamp.flame || 34);
    gl.uniform3fv(C.u.uLampColor, lampColor);
    gl.uniform3fv(C.u.uAmbient, ambient);
    gl.uniform1f(C.u.uTime, time);
    gl.uniform1f(C.u.uExposure, exposure);
    gl.uniform1f(C.u.uHover, hover);
    const n = Math.min(8, glows.length);
    gl.uniform1i(C.u.uGlowN, n);
    if (n) {
      const g4 = new Float32Array(32), gc = new Float32Array(24);
      glows.slice(0, 8).forEach((g, i) => {
        g4.set([g.x, g.y, g.r, g.i], i * 4);
        gc.set(g.c, i * 3);
      });
      gl.uniform4fv(C.u.uGlows, g4);
      gl.uniform3fv(C.u.uGlowC, gc);
    }
    gl.bindVertexArray(this.gridVAO);
    gl.drawElements(gl.TRIANGLES, this.gridCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
