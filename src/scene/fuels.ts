import type { HouseVariant, RoomId } from '../simulation/house'

// Coordinates follow the exposed surfaces of the furnished Blender assemblies.
// Plants use foliage or petals above the pot. Books and textiles use their own
// surfaces so the surrounding furniture can remain visible through the flames.
type FuelPatch = readonly [x: number, heightAboveFloor: number, z: number, width: number]
const surfaces: Record<HouseVariant, Partial<Record<RoomId, readonly FuelPatch[]>>> = {
  klein: {
    kitchen: [
      [-2.95, 1.237, -1.36, 0.37], // Wooden spice shelf
      [-3.11, 1.408, -1.393, 0.12], // Cork lids
      [-2.89, 0.5, -0.883, 0.38], // Sink cabinet front
      [-2.78, 0.022, 0.01, 0.86], // Kitchen rug
    ],
    living: [
      [-0.9, 0.657, -0.53, 0.74], // Left and right sofa cushions
      [0.08, 0.657, -0.53, 0.74],
      [-0.8, 0.485, 0.54, 0.62], // Book on the coffee table
      [-0.29, 0.443, 0.69, 0.42], // Exposed wooden tabletop
      [-1.51, 0.036, 0.56, 0.54], // Rug beyond the table
      [-3.31, 0.516, -1.01, 0.52], // Television cabinet
      [-3.997, 0.588, -0.368, 0.55], // Foliage left of the television
      [-1.214, 1.51, -1.76, 0.26], // Left and right linen curtains
      [-0.046, 1.57, -1.76, 0.26],
    ],
    playroom: [
      [-0.96, 0.607, -1.17, 0.36], // Book on low cabinet
      [-1.14, 0.556, -1.08, 0.32], // Cabinet
      [-0.18, 0.457, 0.42, 0.30], // Wooden engine and wagons
      [0.20, 0.302, 0.42, 0.27],
      [0.58, 0.30, 0.42, 0.32],
      [0.08, 0.021, 0.73, 0.46], // Play mat
      [0.29, 0.755, -0.97, 0.49], // Desk
      [-0.291, 0.79, -0.986, 0.28], // Sketchbook
      [0.33, 1.02, -1.264, 0.15], // Pencils
      [-0.302, 0.447, -0.535, 0.38], // Desk chair
      [-0.445, 1.55, -1.836, 0.30], // Wall print
    ],
    attic: [
      [-3.25, 1.491, -1.44, 0.90], // Bookcase
      [-3.499, 0.659, -1.245, 0.35], // Books on lower and upper shelves
      [-3.342, 1.233, -1.245, 0.35],
      [0.5, 0.676, -0.73, 0.72], // Reading chair
      [-0.86, 0.415, 0.43, 0.58], // Book on the coffee table
      [-0.50, 0.380, 0.53, 0.38], // Table
      [-1.48, 0.031, 0.40, 0.49], // Woven rug
      [-3.959, 0.516, 0.21, 0.43], // Flower petals
      [-2.704, 1.68, -1.76, 0.25], // Curtains
      [-1.556, 1.74, -1.76, 0.25],
      [0.72, 1.72, -1.84, 0.32], // Framed print
    ],
  },
  gross: {
    laundry: [
      [5.44, 0.455, 0.04, 0.52], // Woven basket and laundry
      [5.87, 0.986, -1.21, 0.53], // Upper and lower towel stacks
      [5.87, 0.396, -1.10, 0.43],
      [6.32, 1.353, -1.12, 0.36], // Wooden shelving
      [5.74, 1.73, -1.24, 0.25], // Plastic bottles
      [6.12, 1.73, -1.24, 0.25],
    ],
    studio0: [
      [-3.37, 0.603, -0.43, 0.68], // Armchair
      [-3.90, 0.402, 0.53, 0.60], // Book
      [-3.47, 0.367, 0.65, 0.33], // Table
      [-4.40, 0.030, 0.55, 0.47], // Woven rug
      [-6.17, 0.70, -1.02, 0.44], // Kettle cabinet
      [-5.228, 0.982, -0.977, 0.27], // Countertop plant leaves
      [-3.46, 1.47, -1.84, 0.34], // Wall print
    ],
    living: [
      [-3.63, 0.49, 0.12, 0.57], // Armchair
      [-2.89, 0.028, 0.25, 0.80], // Woven rug
      [-2.45, 0.54, -0.99, 0.36], // Television cabinet
      [-2.068, 0.486, -1.204, 0.46], // Window-side plant foliage
    ],
    playroom: [
      [2.50, 0.84, -1.01, 0.40], // Sketchbook
      [3.14, 0.804, -0.99, 0.46], // Wooden desk
      [3.158, 1.088, -1.309, 0.15], // Pencils
      [2.485, 0.476, -0.533, 0.40], // Chair
      [2.333, 1.62, -1.832, 0.30], // Wall print
      [3.04, 0.413, 0.50, 0.28], // Wooden engine and wagons
      [3.39, 0.272, 0.50, 0.27],
      [3.71, 0.272, 0.50, 0.31],
      [3.25, 0.023, 0.72, 0.45], // Play mat
    ],
    attic: [
      [-5.74, 1.342, -1.48, 0.88], // Bookcase
      [-5.964, 0.593, -1.32, 0.32], // Lower and upper books
      [-5.823, 1.11, -1.32, 0.32],
      [-2.81, 0.647, -0.65, 0.67], // Reading chair
      [-3.25, 0.027, -0.14, 0.92], // Reading rug
      [-6.507, 0.414, 0.205, 0.40], // Potted leaves
    ],
  },
}

/** Return the exposed fuel patches in a source room in model coordinates relative to its floor. */
export function fuelSurfaces(variant: HouseVariant, room: RoomId): readonly FuelPatch[] {
  return surfaces[variant][room] ?? []
}
