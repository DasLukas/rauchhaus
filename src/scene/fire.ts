/** Flame emission and optical density for integration into the source room's smoke shader. */
export const fireShader = `
  uniform vec3 fireAmounts; // source, gas flames, additional burning surfaces
  uniform vec4 fuelSurfaces[FUEL_COUNT]; // xyz at the actual surface, w = burning width
  uniform vec4 firstBurst, secondBurst; // room X fraction, absolute Z, envelope strength, burst progress
  uniform float upholsteryGas;
  uniform float flameTime;
  uniform float sliceDepth;

  // A translucent tracer rising from the upholstered seat in the living room.
  float upholsteryWisp() {
    if (upholsteryGas <= 0.0) return 0.0;
    vec3 d = point - (fuelSurfaces[0].xyz + vec3(0.12, 0.0, 0.17));
    float h = d.y / 0.78;
    if (h <= 0.0 || h >= 1.0 || abs(d.x) > 0.38 || abs(d.z) > 0.38) return 0.0;
    float centre = 0.16 * sin(7.0 * h - flameTime * 2.0) * h;
    float x = (d.x - centre) / (0.055 + h * 0.075);
    float z = max(0.0, abs(d.z) - sliceDepth * 0.50) / 0.1;
    return 3.0 * upholsteryGas * exp(-x*x - z*z) * smoothstep(0.0, 0.09, h) * (1.0 - smoothstep(0.44, 1.0, h));
  }

  // Returns optical density and density-weighted hot core.
  vec2 burningPatch(vec3 origin, float width, float power) {
    if (power <= 0.0) return vec2(0.0);
    float height = (0.52 + 1.30 * width) * sqrt(power);
    vec3 d = point - origin;
    float h = d.y / height;
    if (h < -0.035 || h > 1.32 || abs(d.x) > width || abs(d.z) > width + 0.17)
      return vec2(0.0);
    // Average across the voxel depth so narrow tips survive between planes.
    d.z = max(0.0, abs(d.z) - 0.5 * sliceDepth);
    float t = flameTime * 3.4 + 7.1 * origin.x;
    float scaledWidth = width * (0.68 + 0.32 * power);
    float body = 0.0;
    float core = 0.0;
    for (int i = 0; i < 3; ++i) {
      float branch = float(i) - 1.0;
      float phase = t + branch * 2.3;
      float lengthScale = 0.93 - 0.28 * abs(branch) + 0.09 * sin(phase) + 0.06 * sin(phase * 1.47);
      float y = clamp(h / lengthScale, 0.0, 1.0);
      float taper = max(0.013, (1.0 - y) * (0.78 + 0.44 * sin(3.14 * y)));
      float center = branch * 0.25 + y * (0.17 * sin(6.7 * y - phase) + 0.13 * sin(3.1 * y - 0.7 * phase));
      vec2 r = vec2((d.x / scaledWidth - center) / 0.24, d.z / (0.18 + 0.17 * scaledWidth));
      float edge = length(r) / taper;
      float foot = smoothstep(-0.035, 0.02, h);
      float density = (1.0 - smoothstep(0.73, 1.05, edge)) * foot * (1.0 - smoothstep(0.92, 1.0, y));
      body += density;
      core += density * (1.0 - smoothstep(0.13, 1.0, 0.89 * y + 0.39 * edge));
    }
    return 18.0 * vec2(body, core);
  }

  // One short-lived pocket in the turbulent contact between hot gas and air.
  // The cutaway shows this gas-flaming effect only in the upper part of the room.
  vec2 gasFlame(float top, float smokeEdge, float front, vec4 gasBurst) {
    float power = fireAmounts.y * gasBurst.z * front * (1.0 - fireAmounts.z);
    float height = top - floorY;
    float clearance = (smokeEdge - floorY) / height;
    power *= smoothstep(0.49, 0.65, clearance);
    if (power <= 0.001 || point.y < floorY + 0.49 * height || top <= smokeEdge) return vec2(0.0);

    float span = roomSides.y - roomSides.x;
    float centre = mix(roomSides.x, roomSides.y, gasBurst.x);
    float direction = centre >= source.x ? 1.0 : -1.0;
    float age = gasBurst.w;
    float lengthScale = min(span * 0.19, 0.76);
    centre += direction * (age - 0.5) * lengthScale * 0.20;
    float u = direction * (point.x - centre) / lengthScale + 0.5;
    if (u <= 0.0 || u >= 1.0 || abs(point.y - smokeEdge) > 0.42) return vec2(0.0);

    // A narrow fold lights up in place, tapering towards both ends.
    vec3 flow = point * vec3(0.18, 0.25, 0.17) + vec3(-direction * age * 0.18, -age * 0.09, 0.0);
    float fold = texture(noiseVolume, flow).r;
    float grain = texture(noiseVolume, 2.4 * flow + vec3(0.0, age * 0.07, 0.0)).r;
    float taper = sin(3.14159 * u);
    float centreZ = gasBurst.y + 0.15 * sin(4.7 * u + 3.2 * age + 5.0 * gasBurst.x);
    float across = max(0.0, abs(point.z - centreZ) - 0.5 * sliceDepth) / (0.025 + 0.085 * taper);
    float lift = min(0.23, 0.33 * (top - smokeEdge));
    float curl = sin(6.4 * u + 5.0 * gasBurst.x - 1.8 * age);
    float axis = smokeEdge - 0.07 + lift * 0.20 + 0.07 * u * u + 0.055 * taper * curl + 0.10 * (fold - 0.5);
    float vertical = (point.y - axis) / (0.006 + taper * (0.025 + 0.045 * grain));
    float edge = 1.0 - smoothstep(0.45, 1.05, length(vec2(across, vertical)));
    float wisps = smoothstep(0.14 + 0.34 * u, 0.65, 0.70 * fold + 0.30 * grain + 0.13 * taper);
    float gas = 36.0 * power * taper * edge * (0.45 + 0.55 * wisps);
    return vec2(gas, gas * edge * (0.20 + 0.65 * grain));
  }

  vec2 fireAt(float top, float smokeEdge, float front) {
    vec2 fire = burningPatch(source, 0.32 + 0.34 * fireAmounts.x, fireAmounts.x);
    if (fireAmounts.z > 0.0) {
      for (int i = 0; i < FUEL_COUNT; ++i) {
        vec4 fuel = fuelSurfaces[i];
        if (fuel.w > 0.0) fire += burningPatch(fuel.xyz, fuel.w, fireAmounts.z);
      }
    }
    return fire + gasFlame(top, smokeEdge, front, firstBurst) + gasFlame(top, smokeEdge, front, secondBurst);
  }
`
