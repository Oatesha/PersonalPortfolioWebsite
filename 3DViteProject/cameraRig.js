import * as THREE from 'three';

// frames the model inside a DOM element while the canvas stays fixed and
// fullscreen. setViewOffset is run backwards: the base frustum is the target
// box and the sub-rect asked for is the viewport in box coordinates, a superset
// of it, so the frustum widens outwards and the box stays where the DOM put it

export const rig = {
  // Element the model should be centred in. Null means the whole viewport.
  target: null,
  // Radius of the model's bounding sphere, set once the GLB has loaded.
  radius: 1,
  // Fraction of the fitted distance to sit at. Animations tween this instead of
  // camera.position.z, so framing stays resolution independent. Values below 1
  // move the camera in towards the model; negative values pass through it.
  fit: 1,
  // Breathing room around the model inside the box.
  margin: 1.2,
  // Vertical bob, added to the base position rather than mutating it, so the
  // bobbing tween cannot fight whatever else is driving the camera.
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
  if (import.meta.env.DEV) {
    window.__rig = rig;
  }
  // getBoundingClientRect forces layout, and GSAP writes transforms every frame
  // during a project transition, so read it only when something has changed.
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

// Distance at which a sphere of the given radius fits the frustum on both axes.
// Checking the horizontal axis as well is what stops a wide-short or tall-narrow
// window from cropping the model, since fov alone only constrains the vertical.
export function fitDistance(camera, radius, margin = 1.2) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distV = radius / Math.sin(vFov / 2);
  const distH = radius / Math.sin(hFov / 2);
  return Math.max(distV, distH) * margin;
}

export function updateCameraFraming(camera) {
  const rect = targetRect();
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  // Base frustum is the target box itself. fitDistance reads camera.aspect, so
  // this has to be set before the distance is computed.
  camera.aspect = rect.width / rect.height;

  camera.position.set(0, rig.bobY, fitDistance(camera, rig.radius, rig.margin) * rig.fit);

  // Then widen it out to the full canvas, leaving the box where the DOM put it.
  // setViewOffset re-derives the same aspect and calls updateProjectionMatrix.
  camera.setViewOffset(rect.width, rect.height, -rect.left, -rect.top, viewW, viewH);
}
