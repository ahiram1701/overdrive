// Mallas 3D low-poly propias (sin librerías: la PWA sigue funcionando offline). Módulo puro.
// Ejes: x = derecha, y = arriba, z = hacia delante (la punta de la nave está en +z).

// Casco paramétrico: cambiando las proporciones salen siluetas muy distintas.
// L = largo de la punta, W = envergadura, wz = retraso de las alas, H = altura, R = ancho trasero,
// T = cola, F = altura de la aleta (0 = sin aleta), tw = alas gemelas (Raptor)
function hull({ L = 1, W = 0.9, wz = 0.25, H = 0.2, R = 0.25, T = 0.35, F = 0, tw = 0 }) {
  const v = [
    [0, 0, L], //   0 punta
    [0, H, 0], //   1 lomo
    [0, -H * 0.6, 0], // 2 vientre
    [-W, 0, -wz], // 3 ala izquierda
    [W, 0, -wz], //  4 ala derecha
    [-R, H * 0.3, -T], // 5 trasera izquierda
    [R, H * 0.3, -T], //  6 trasera derecha
    [0, -H * 0.4, -T], // 7 trasera baja
    [0, H * 0.7, -T], //  8 trasera alta
  ];
  const f = [
    [0, 3, 1, 'hull'], [0, 1, 4, 'hull'], [1, 3, 5, 'hull'], [1, 6, 4, 'hull'], [1, 5, 8, 'hull'], [1, 8, 6, 'hull'],
    [0, 2, 3, 'hull'], [0, 4, 2, 'hull'], [2, 7, 3, 'hull'], [2, 4, 7, 'hull'], [3, 7, 5, 'hull'], [4, 6, 7, 'hull'],
    [5, 7, 8, 'glow'], [6, 8, 7, 'glow'],
  ];
  if (F > 0) {
    v.push([0, H + F, -T * 0.95], [0, H * 0.8, -T * 0.3]); // 9, 10: aleta
    f.push([8, 9, 10, 'edge']);
  }
  if (tw > 0) {
    // alas gemelas adelantadas
    const n = v.length;
    v.push([-W * 0.75, H * 0.1, L * 0.45], [W * 0.75, H * 0.1, L * 0.45]);
    f.push([n, 3, 0, 'edge'], [0, 4, n + 1, 'edge']);
  }
  // dónde puede ir el emblema: las dos alas (punta, ala, lomo), solo la izquierda, o la cola (la
  // parte de arriba de la trasera). La aleta NO: desde detrás, que es como se ve jugando, es una raya.
  const decalSets = {
    alas: [[0, 3, 1], [0, 1, 4]],
    ala: [[0, 3, 1]],
    cola: [[1, 5, 8], [1, 8, 6]],
  };
  return { v, f, decalSets, twoSided: [] };
}

export const MESHES = {
  viper: hull({ L: 1.1, W: 0.85, wz: 0.3, H: 0.2 }),
  brick: hull({ L: 0.7, W: 1.0, wz: 0.05, H: 0.38, R: 0.55, T: 0.5 }),
  ghost: hull({ L: 1.3, W: 0.6, wz: 0.55, H: 0.12, R: 0.15, T: 0.6, F: 0.35 }),
  nova: hull({ L: 0.9, W: 1.05, wz: -0.15, H: 0.24, R: 0.3, T: 0.3 }),
  kaiju: hull({ L: 0.85, W: 1.1, wz: 0.2, H: 0.45, R: 0.5, T: 0.45, F: 0.45 }),
  raptor: hull({ L: 1.2, W: 0.75, wz: 0.4, H: 0.18, R: 0.2, T: 0.4, tw: 1 }),
  comet: hull({ L: 0.95, W: 0.7, wz: 0.1, H: 0.32, R: 0.38, T: 0.25, F: 0.2 }),
  manta: hull({ L: 0.75, W: 1.25, wz: 0.45, H: 0.16, R: 0.3, T: 0.3 }), // ala volante, plana y ancha
  spectra: hull({ L: 1.45, W: 0.55, wz: 0.2, H: 0.15, R: 0.18, T: 0.5, tw: 1 }), // aguja con alas gemelas
  titan: hull({ L: 0.8, W: 0.95, wz: 0.1, H: 0.5, R: 0.6, T: 0.55, F: 0.3 }), // bloque blindado
};

// Rota un vértice: yaw (eje y), pitch (eje x), roll (eje z). Escribe en `out` para no crear basura.
export function rotate(p, rot, out = [0, 0, 0]) {
  let [x, y, z] = p;
  const cy = Math.cos(rot.yaw || 0), sy = Math.sin(rot.yaw || 0);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cp = Math.cos(rot.pitch || 0), sp = Math.sin(rot.pitch || 0);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  const cr = Math.cos(rot.roll || 0), sr = Math.sin(rot.roll || 0);
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

// Proyecta una malla rotada. Devuelve las caras ordenadas de lejos a cerca, cada una con su
// sombreado plano (0..1). sx/sy en píxeles alrededor de (cx, cy).
const LIGHT = (() => { const l = [0.35, 0.8, 0.45]; const n = Math.hypot(...l); return l.map((c) => c / n); })();

export function projectMesh(mesh, rot, cx, cy, size, focal = 4) {
  const pts = mesh.v.map((v) => rotate(v, rot));
  const scr = pts.map(([x, y, z]) => {
    const k = focal / (focal + z); // la +z (punta) se aleja: más pequeña
    return [cx + x * size * k, cy - y * size * k, z];
  });
  const faces = mesh.f.map(([a, b, c, role], fi) => {
    const A = pts[a], B = pts[b], C = pts[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const shade = 0.35 + 0.65 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl);
    return { pts: [scr[a], scr[b], scr[c]], depth: (A[2] + B[2] + C[2]) / 3, shade, role, vi: [a, b, c], fi };
  });
  faces.sort((p, q) => q.depth - p.depth);
  return faces;
}
