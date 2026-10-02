// post.js — WebGL finishing pass: shockwave ripples, underwater wobble,
// zoom blur, chromatic aberration, vignette and dithering grain.
// Falls back to a plain copy when WebGL2 is unavailable.
(function (G) {
  'use strict';

  const VS = `#version 300 es
in vec2 a;
out vec2 v;
void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform vec4 u_ripple;  // x, y (px, top-left origin), age (s, <0 = off), amplitude (px)
uniform float u_wobble;
uniform vec3 u_zoom;    // x, y (px), strength
uniform float u_ca;
uniform float u_grain;
uniform float u_vig;
in vec2 v;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
vec3 tex(vec2 p) { return texture(u_tex, p / u_res).rgb; }

void main() {
  vec2 px = vec2(v.x, 1.0 - v.y) * u_res;
  vec2 disp = vec2(0.0);
  if (u_ripple.z >= 0.0) {
    vec2 d = px - u_ripple.xy;
    float r = length(d);
    float x = r - u_ripple.z * 1450.0;
    float env = exp(-x * x / 16200.0) * exp(-u_ripple.z * 2.3);
    disp += (d / max(r, 1.0)) * sin(x * 0.05) * env * u_ripple.w;
  }
  if (u_wobble > 0.0) {
    disp.x += sin(px.y * 0.011 + u_time * 8.0) * 22.0 * u_wobble;
    disp.y += sin(px.x * 0.009 - u_time * 6.0) * 12.0 * u_wobble;
  }
  vec2 p = px + disp;
  vec3 col;
  if (u_zoom.z > 0.002) {
    vec3 acc = vec3(0.0);
    vec2 dir = p - u_zoom.xy;
    float j = hash(px + u_time);
    for (int i = 0; i < 12; i++) {
      float f = (float(i) + j) / 12.0;
      acc += tex(u_zoom.xy + dir * (1.0 - u_zoom.z * 0.24 * f));
    }
    col = acc / 12.0;
  } else if (u_ca > 0.0001) {
    vec2 c = p - u_res * 0.5;
    col = vec3(tex(p + c * u_ca).r, tex(p).g, tex(p - c * u_ca).b);
  } else {
    col = tex(p);
  }
  vec2 q = v - 0.5;
  q.x *= u_res.x / u_res.y;
  col *= 1.0 - u_vig * smoothstep(0.08, 0.6, dot(q, q) * 2.0);
  col += (hash(px + fract(u_time * 7.13) * 917.0) - 0.5) * u_grain;
  o = vec4(col, 1.0);
}`;

  function create(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) {
      const c2 = canvas.getContext('2d');
      return { webgl: false, draw: (src) => c2.drawImage(src, 0, 0) };
    }
    const sh = (type, srcText) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, srcText);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const texObj = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texObj);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const U = {};
    for (const n of ['u_tex', 'u_res', 'u_time', 'u_ripple', 'u_wobble', 'u_zoom', 'u_ca', 'u_grain', 'u_vig'])
      U[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(U.u_tex, 0);

    function draw(src, P, t) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, texObj);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform2f(U.u_res, canvas.width, canvas.height);
      gl.uniform1f(U.u_time, t);
      gl.uniform4f(U.u_ripple, P.rx, P.ry, P.rage, P.ramp);
      gl.uniform1f(U.u_wobble, P.wobble);
      gl.uniform3f(U.u_zoom, P.zx, P.zy, P.zs);
      gl.uniform1f(U.u_ca, P.ca);
      gl.uniform1f(U.u_grain, P.grain);
      gl.uniform1f(U.u_vig, P.vig);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return { webgl: true, draw };
  }

  // Frames without distortion skip WebGL entirely: vignette + grain are
  // cheap to do on the (CPU-rasterised) 2D canvas.
  const needsGL = (P) => P.rage >= 0 || P.wobble > 0.001 || P.zs > 0.002;

  let grainTile = null;
  function finish2D(ctx, P, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (P.vig > 0) {
      // matches the shader: smoothstep falloff on a circle scaled to height
      const r0 = Math.sqrt(0.08 / 2) * H, r1 = Math.sqrt(0.6 / 2) * H;
      const g = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
      for (let i = 0; i <= 8; i++) {
        const x = i / 8;
        g.addColorStop(x, `rgba(0,0,0,${(P.vig * x * x * (3 - 2 * x)).toFixed(4)})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (P.grain > 0) {
      if (!grainTile) {
        grainTile = document.createElement('canvas');
        grainTile.width = grainTile.height = 256;
        const g = grainTile.getContext('2d');
        const img = g.createImageData(256, 256);
        let s = 1234567;
        for (let i = 0; i < img.data.length; i += 4) {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          const v = (s >> 8) & 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
      }
      const f = Math.floor(t * 60);
      const ox = (f * 97) % 256, oy = (f * 61) % 256;
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = P.grain * 1.6;
      ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
      ctx.translate(-ox, -oy);
      ctx.fillRect(0, 0, W + 256, H + 256);
    }
    ctx.restore();
  }

  G.Post = { create, needsGL, finish2D };
})(typeof window !== 'undefined' ? window : globalThis);
