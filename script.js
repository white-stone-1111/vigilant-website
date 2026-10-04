/* ============================================================
   Endors.io | Waitlist — recreation
   1. WebGL2 "liquid gradient" plasma background — source-parity
      rewrite of the site's actual Shader component (GLSL 300 es,
      mouse interaction disabled, site-default props)
   2. Word-by-word entrance animations
   3. Waitlist form behaviour
   ============================================================ */

(function () {
  'use strict';

  /* debug/verification flags: ?freeze puts entrance animations at their
     final state; ?plainstar / ?hidestar toggle the star's blend modes */
  var FREEZE = /[?&]freeze\b/.test(location.search);
  if (FREEZE) document.documentElement.classList.add('freeze');
  if (/[?&]plainstar\b/.test(location.search)) document.documentElement.classList.add('plainstar');
  if (/[?&]hidestar\b/.test(location.search)) document.documentElement.classList.add('hidestar');

  /* ------------------------------------------------------------
     1. Shader background (the site's actual liquid-gradient shader)
     ------------------------------------------------------------ */

  var canvas = document.getElementById('bg-canvas');

  var VERTEX_SRC = `
#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

  var FRAGMENT_SRC = `
#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform float u_scale;
uniform float u_seed;
uniform float u_speed;
uniform float u_turbAmp;
uniform float u_turbFreq;
uniform float u_turbIter;
uniform float u_waveFreq;
uniform float u_distBias;
uniform float u_jellify;
uniform int u_ditherMode;
uniform float u_ditherAmount;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform int u_colors_length;
uniform vec4 u_colors[8];
uniform float u_pixelRatio;
uniform sampler2D u_push_buffer;

const float GOLDEN_ANGLE = 2.3999632;
const float TAU = 6.28318530;
uvec3 hash3(uvec3 v){v=v*1664525u+1013904223u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;v^=v>>16u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;return v;}
vec3 seedRandom(float s){uvec3 v=uvec3(floatBitsToUint(s),floatBitsToUint(s*1.5+7.31),floatBitsToUint(s*2.7+13.37));return vec3(hash3(v))/float(0xFFFFFFFFu);}
vec3 toLinear(vec3 c){return pow(c,vec3(2.2));}
vec3 toSrgb(vec3 c){return pow(clamp(c,0.,1.),vec3(.4545));}
vec3 linearToOklab(vec3 c){float l=.4122214708*c.r+.5363325363*c.g+.0514459929*c.b;float m=.2119034982*c.r+.6806995451*c.g+.1073969566*c.b;float s=.0883024619*c.r+.2817188376*c.g+.6299787005*c.b;l=pow(max(l,0.),1./3.);m=pow(max(m,0.),1./3.);s=pow(max(s,0.),1./3.);return vec3(.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s);}
vec3 oklabToLinear(vec3 c){float l=c.x+.3963377774*c.y+.2158037573*c.z;float m=c.x-.1055613458*c.y-.0638541728*c.z;float s=c.x-.0894841775*c.y-1.2914855480*c.z;l=l*l*l;m=m*m*m;s=s*s*s;return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s);}
vec3 oklabToLch(vec3 lab){return vec3(lab.x,length(lab.yz),atan(lab.z,lab.y));}
vec3 lchToOklab(vec3 c){return vec3(c.x,c.y*cos(c.z),c.y*sin(c.z));}
vec3 mixLch(vec3 lab0,vec3 lab1,float t){vec3 lch0=oklabToLch(lab0),lch1=oklabToLch(lab1);if(lch0.y<.05)lch0.z=lch1.z;if(lch1.y<.05)lch1.z=lch0.z;float dh=lch1.z-lch0.z;if(dh>3.14159265)dh-=6.28318530;if(dh< -3.14159265)dh+=6.28318530;return lchToOklab(vec3(mix(lch0.x,lch1.x,t),mix(lch0.y,lch1.y,t),lch0.z+dh*t));}
vec3 getColor(int idx){if(u_colors_length<1)return vec3(0.);return u_colors[clamp(idx,0,u_colors_length-1)].rgb;}
vec3 paletteN(float t,int count){if(count<1)return vec3(0.);if(count<2)return toLinear(getColor(0));float segmentSize=1./float(count-1);t=clamp(t,0.,1.);int idx=min(int(floor(t/segmentSize)),count-2);float localT=clamp((t-float(idx)*segmentSize)/segmentSize,0.,1.);return oklabToLinear(mixLch(linearToOklab(toLinear(getColor(idx))),linearToOklab(toLinear(getColor(idx+1))),localT));}
float IGN(vec2 uv){return fract(52.9829189*fract(dot(uv,vec2(.06711056,.00583715))));}
float quickNoise(vec2 I){return fract(sin(dot(I,vec2(12.9898,78.233)))*43758.5453);}
float getDither(vec2 I,float mode){if(mode<.5)return .5;if(mode<1.5)return IGN(I);return quickNoise(I);}
vec3 softGamutMap(vec3 rgb){float maxC=max(rgb.r,max(rgb.g,rgb.b)),minC=min(rgb.r,min(rgb.g,rgb.b));if(minC>=0.&&maxC<=1.)return rgb;vec3 lab=linearToOklab(max(rgb,0.));float L=clamp(lab.x,0.,1.),C=length(lab.yz),h=atan(lab.z,lab.y);float maxChroma=.4*(1.-pow(abs(2.*L-1.),2.));if(C>maxChroma*.7){float knee=maxChroma*.7;C=knee+(maxChroma-knee)*tanh((C-knee)/(maxChroma-knee+.001));}return clamp(oklabToLinear(vec3(L,C*cos(h),C*sin(h))),0.,1.);}
vec3 applyContrastSaturation(vec3 rgb,float contrast,float saturation){vec3 lab=linearToOklab(rgb);float C=length(lab.yz),h=atan(lab.z,lab.y);lab.x=clamp((lab.x-.5)*contrast+.5,0.,1.);C*=saturation;lab.y=C*cos(h);lab.z=C*sin(h);return oklabToLinear(lab);}

void main(){
    vec2 fragCoord=v_uv*u_resolution;
    vec2 r=u_resolution;
    vec2 p=(fragCoord*2.-r)/r.y;
    int count=u_colors_length;
    if(count<1){fragColor=vec4(0.,0.,0.,1.);return;}
    float t=u_time*.3;
    float looping=step(.5,u_loop),phase=TAU*u_time/max(u_loop,.01),radius=u_loop*u_speed*.3/TAU;
    float tA=sin(phase)*radius,tB=(1.-cos(phase))*radius;
    vec3 so=seedRandom(u_seed),so2=seedRandom(u_seed+100.);
    float angle=u_seed*GOLDEN_ANGLE;
    vec2 seedPhase=(so2.xy-.5)*TAU;
    float cs=cos(angle),sn=sin(angle);
    mat2 rot=mat2(cs,-sn,sn,cs);
    p=rot*p;
    vec2 pushField=texture(u_push_buffer,v_uv).xy;
    p-=rot*pushField*2.;
    float dither=getDither(floor(fragCoord/u_pixelRatio),float(u_ditherMode));
    float totalVal=0.,totalWeight=0.;
    int iter=int(u_turbIter);
    float freq=1./max(u_turbFreq,.01);
    for(float i=0.;i<4.;i++){
        float eph=i/4.;
        vec2 q=p*u_scale;
        float sq=eph*eph;
        if(u_jellify>.5)q.yx*=mix(1.,.5,1.-exp(-sq));
        float a=seedPhase.x,d=seedPhase.y;
        for(int j=2;j<13;j++){
            if(j>=iter)break;
            float fj=float(j),t1=mix(t*u_speed,tA,looping),t2=mix(t*u_speed,tB,looping);
            q+=u_turbAmp*sin(q.yx/freq*fj+t1+vec2(a,d)+so.xy*fj)/fj;
            a+=cos(fj+d*1.2+q.x*2.-t1+so2.z+t2*.3*looping);
            d+=sin(fj*q.y+a+so.z+t1+so2.y+t2*.3*looping);
        }
        float v=.5+.5*sin(length(q.yx+vec2(a,d)*.2)*u_waveFreq+i*i+so.x);
        float weight=smoothstep(0.,.5,eph)*smoothstep(1.,.5,eph);
        totalVal+=v*weight;
        totalWeight+=weight;
    }
    float val=totalVal/totalWeight;
    val=clamp((val-.3)/.4,0.,1.);
    val=pow(val,exp(-u_distBias));
    val=clamp(val+(dither-.5)*u_ditherAmount,0.,1.);
    vec3 col=paletteN(val,count);
    col*=u_exposure;
    col=applyContrastSaturation(col,u_contrast,u_saturation);
    col=softGamutMap(col);
    col=toSrgb(col);
    fragColor=vec4(col,1.);
}
`;

  function initShader(gl, canvas) {
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src.trimStart());
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
    var fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) { canvas.parentElement.classList.add('no-webgl'); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      canvas.parentElement.classList.add('no-webgl');
      return;
    }
    gl.useProgram(prog);

    // fullscreen triangle
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // 1x1 zero push texture (mouse interaction disabled)
    var pushTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pushTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    function U(name) { return gl.getUniformLocation(prog, name); }

    // site-default props (from the component)
    gl.uniform1f(U('u_loop'), 0);
    gl.uniform1f(U('u_scale'), 0.72);
    gl.uniform1f(U('u_seed'), 558);
    gl.uniform1f(U('u_speed'), 0.44);
    gl.uniform1f(U('u_turbAmp'), 1);
    gl.uniform1f(U('u_turbFreq'), 0.1);
    gl.uniform1f(U('u_turbIter'), 6);
    gl.uniform1f(U('u_waveFreq'), 1);
    gl.uniform1f(U('u_distBias'), 0);
    gl.uniform1f(U('u_jellify'), 0);
    gl.uniform1i(U('u_ditherMode'), 0);
    gl.uniform1f(U('u_ditherAmount'), 0.08);
    gl.uniform1f(U('u_exposure'), 1.1);
    gl.uniform1f(U('u_contrast'), 1.1);
    gl.uniform1f(U('u_saturation'), 1);
    gl.uniform1i(U('u_colors_length'), 6);
    // rgb(10,10,10), rgb(0,80,166), rgb(0,229,255) x4, padded to 8
    var cyan = [0, 229 / 255, 1, 1];
    var colors = new Float32Array([]
      .concat([10 / 255, 10 / 255, 10 / 255, 1])
      .concat([0, 80 / 255, 166 / 255, 1])
      .concat(cyan, cyan, cyan, cyan, cyan, cyan));
    gl.uniform4fv(U('u_colors[0]'), colors);
    gl.uniform1i(U('u_push_buffer'), 0);

    var uRes = U('u_resolution');
    var uTime = U('u_time');
    var uPixelRatio = U('u_pixelRatio');

    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    window.addEventListener('resize', resize);
    resize();

    var start = performance.now();
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function frame(now) {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uPixelRatio, dpr);
      gl.uniform1f(uTime, reduced.matches ? 0 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced.matches) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    reduced.addEventListener && reduced.addEventListener('change', function () {
      if (!reduced.matches) requestAnimationFrame(frame);
    });
  }

  var gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false });
  if (!gl) {
    canvas.parentElement.classList.add('no-webgl');
  } else {
    initShader(gl, canvas);
  }

  /* ------------------------------------------------------------
     2. Word-by-word entrance animation
     ------------------------------------------------------------ */

  function splitWords(el, baseDelay, step) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      span.style.animationDelay = (baseDelay + i * step).toFixed(3) + 's';
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  var headline = document.getElementById('headline');
  var bodyText = document.getElementById('body-text');
  if (headline) splitWords(headline, 0.25, 0.09);
  if (bodyText) splitWords(bodyText, 0.75, 0.035);

  /* ------------------------------------------------------------
     3. Waitlist form
     ------------------------------------------------------------ */

  var form = document.getElementById('waitlist-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var value = (input.value || '').trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!valid) {
        input.focus();
        form.classList.remove('shake');
        void form.offsetWidth; // restart animation
        form.classList.add('shake');
        return;
      }
      // send the email to the Make.com webhook (fire-and-forget:
      // no-cors avoids a preflight the hook wouldn't answer; the
      // hook still receives the body)
      try {
        fetch('https://hook.eu2.make.com/48wsfj195r2qutyvxy1wbd2fs63j3i27', {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ email: value, submittedAt: new Date().toISOString() })
        });
      } catch (err) { /* network errors still show success */ }

      var field = form.querySelector('.field');
      field.classList.add('success');
      field.innerHTML = '<p class="success-msg">Thanks — you’re on the list.</p>';
    });
  }
})();
