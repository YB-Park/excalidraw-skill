export function rectOf(element, padding = 0) {
  return {
    x: element.x - padding,
    y: element.y - padding,
    width: element.width + padding * 2,
    height: element.height + padding * 2
  };
}

export function boxesOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function absolutePoints(edge) {
  const points = edge.points ?? [[0, 0], [edge.width ?? 0, edge.height ?? 0]];
  return points.map(([x, y]) => ({ x: edge.x + x, y: edge.y + y }));
}

export function segmentsFromPoints(points) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({ a: points[index], b: points[index + 1] });
  }
  return segments;
}

export function segmentsFromEdge(edge) {
  return segmentsFromPoints(absolutePoints(edge));
}

export function segmentLength(segment) {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 1e-9 && b.x + 1e-9 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 1e-9 && b.y + 1e-9 >= Math.min(a.y, c.y);
}

export function segmentsIntersect(first, second, { includeEndpoints = true } = {}) {
  const { a: p1, b: q1 } = first;
  const { a: p2, b: q2 } = second;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  let intersects = o1 !== o2 && o3 !== o4;
  if (!intersects && o1 === 0 && onSegment(p1, p2, q1)) intersects = true;
  if (!intersects && o2 === 0 && onSegment(p1, q2, q1)) intersects = true;
  if (!intersects && o3 === 0 && onSegment(p2, p1, q2)) intersects = true;
  if (!intersects && o4 === 0 && onSegment(p2, q1, q2)) intersects = true;
  if (!intersects || includeEndpoints) return intersects;
  const sharedEndpoint = [p1, q1].some((point) => [p2, q2].some((other) => Math.abs(point.x - other.x) < 1e-9 && Math.abs(point.y - other.y) < 1e-9));
  return !sharedEndpoint;
}

export function segmentIntersectsRect(segment, rect, { includeBoundary = true } = {}) {
  const minX = Math.min(segment.a.x, segment.b.x);
  const maxX = Math.max(segment.a.x, segment.b.x);
  const minY = Math.min(segment.a.y, segment.b.y);
  const maxY = Math.max(segment.a.y, segment.b.y);
  const inside = (point) => includeBoundary
    ? point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
    : point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;
  if (inside(segment.a) || inside(segment.b)) return true;
  if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height) return false;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
  const sides = corners.map((corner, index) => ({ a: corner, b: corners[(index + 1) % corners.length] }));
  return sides.some((side) => segmentsIntersect(segment, side, { includeEndpoints: includeBoundary }));
}

export function polylineLength(points) {
  return segmentsFromPoints(points).reduce((total, segment) => total + segmentLength(segment), 0);
}

export function collinearOverlapLength(first, second) {
  const firstHorizontal = Math.abs(first.a.y - first.b.y) < 1e-9;
  const secondHorizontal = Math.abs(second.a.y - second.b.y) < 1e-9;
  if (firstHorizontal !== secondHorizontal) return 0;
  if (firstHorizontal) {
    if (Math.abs(first.a.y - second.a.y) > 1e-9) return 0;
    return Math.max(0, Math.min(Math.max(first.a.x, first.b.x), Math.max(second.a.x, second.b.x)) - Math.max(Math.min(first.a.x, first.b.x), Math.min(second.a.x, second.b.x)));
  }
  if (Math.abs(first.a.x - second.a.x) > 1e-9) return 0;
  return Math.max(0, Math.min(Math.max(first.a.y, first.b.y), Math.max(second.a.y, second.b.y)) - Math.max(Math.min(first.a.y, first.b.y), Math.min(second.a.y, second.b.y)));
}
