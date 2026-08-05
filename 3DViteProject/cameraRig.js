import * as THREE from 'three';

// frames the model inside a DOM element while the canvas stays fixed and
// fullscreen. setViewOffset is run backwards: the base frustum is the target
// box and the sub-rect asked for is the viewport in box coordinates, a superset
// of it, so the frustum widens outwards and the box stays where the DOM put it

export const rig = {
  // element to centre the model in, null means the whole viewport
  target: null,
  // bounding sphere radius, set once the GLB has loaded
  radius: 1,
  // half-extents as multiples of radius, from the bounding box
  extent: { x: 1, y: 1, z: 1 },
  // fraction of the fitted distance to sit at, tweened instead of
  // camera.position.z so framing stays resolution independent. below 1 moves in
  // towards the model, negative passes through it
  fit: 1,
  // breathing room around the model inside the box
  margin: 1.05,
  // vertical bob, added to the base position so it can't fight whatever else is
  // driving the camera
  bobY: 0,
};

let cachedRect = null;
let cachedTarget = null;
let resizeObserver = null;

// marks the cached rect stale, call whenever the target may have moved
export function invalidateRigRect() {
  cachedRect = null;
}

export function setRigTarget(element) {
  if (rig.target === element) {
    return;
  }
  rig.target = element;
  invalidateRigRect();
}

export function initRig() {
  // getBoundingClientRect forces layout and gsap writes transforms every frame
  // during a project transition, so only read it when something has changed
  resizeObserver = new ResizeObserver(invalidateRigRect);
  window.addEventListener('resize', invalidateRigRect);
  window.addEventListener('scroll', invalidateRigRect, { passive: true });
}

function viewportRect() {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function targetRect() {
  if (rig.target !== cachedTarget) {
    if (resizeObserver) {
      if (cachedTarget) {
        resizeObserver.unobserve(cachedTarget);
      }
      if (rig.target) {
        resizeObserver.observe(rig.target);
      }
    }
    cachedTarget = rig.target;
    cachedRect = null;
  }

  if (cachedRect) {
    return cachedRect;
  }

  if (!rig.target) {
    cachedRect = viewportRect();
    return cachedRect;
  }

  const rect = rig.target.getBoundingClientRect();

  // a hidden or not yet laid out target gives a degenerate frustum
  if (rect.width < 1 || rect.height < 1) {
    return viewportRect();
  }

  cachedRect = rect;
  return cachedRect;
}

// distance at which a box of these half-extents fits the frustum on both axes,
// since fov only constrains the vertical. a box rather than a sphere because
// the model is flat, and the near face projects largest so the fit is against
// that plane with the depth added back
export function fitDistance(camera, radius, extent, margin = 1.05) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distV = (radius * extent.y) / Math.tan(vFov / 2);
  const distH = (radius * extent.x) / Math.tan(hFov / 2);
  return Math.max(distV, distH) * margin + radius * extent.z;
}

export function updateCameraFraming(camera) {
  const rect = targetRect();
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  // base frustum is the target box. fitDistance reads camera.aspect so set it
  // before working out the distance
  camera.aspect = rect.width / rect.height;

  camera.position.set(0, rig.bobY, fitDistance(camera, rig.radius, rig.extent, rig.margin) * rig.fit);

  // widen out to the full canvas, leaving the box where the DOM put it.
  // setViewOffset re-derives the aspect and calls updateProjectionMatrix
  camera.setViewOffset(rect.width, rect.height, -rect.left, -rect.top, viewW, viewH);
}
