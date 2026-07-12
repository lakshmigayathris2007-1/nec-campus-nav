/* ==========================================================================
   NEC KOVILPATTI — CAMPUS NAVIGATION ASSISTANT
   Vanilla JS. No external mapping libraries. SVG-rendered map + Dijkstra
   shortest-path routing over a custom campus road graph.

   Sections:
     1. Campus Data (categories, locations, internal sub-locations, roads)
     2. Graph Construction
     3. Dijkstra Pathfinding
     4. Map Rendering (SVG)
     5. Route Drawing & Animation
     6. Search / Autocomplete
     7. Zoom & Pan
     8. Theme Toggle
     9. Info Popups
    10. Stats Panel
    11. Sidebar / Tab Navigation
    12. Init
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CAMPUS DATA
     ------------------------------------------------------------------------ */

  // Visual + descriptive metadata for each category of location.
  const CATEGORIES = {
    cse:      { label: 'CSE Department',            color: '#4361ee', icon: '💻' },
    aids:     { label: 'AI & DS Department',        color: '#7209b7', icon: '🤖' },
    ece:      { label: 'ECE Department',            color: '#f72585', icon: '📡' },
    eee:      { label: 'EEE Department',            color: '#ff6d00', icon: '⚡' },
    mech:     { label: 'Mechanical Department',     color: '#8338ec', icon: '⚙️' },
    civil:    { label: 'Civil Department',          color: '#bc6c25', icon: '🏗️' },
    sh:       { label: 'Science & Humanities',      color: '#219ebc', icon: '📚' },
    admin:    { label: 'Administration',            color: '#495057', icon: '🏢' },
    facility: { label: 'Facilities',                color: '#2a9d8f', icon: '📖' },
    ground:   { label: 'Ground',                    color: '#588157', icon: '🏟️' },
    transport:{ label: 'Transport',                 color: '#457b9d', icon: '🚌' },
    parking:  { label: 'Parking',                   color: '#6c757d', icon: '🅿️' },
    gate:     { label: 'Entrance',                  color: '#e63946', icon: '🚩' }
  };

  // Primary map locations. Coordinates live on a 960 x 700 SVG canvas.
  // `hidden:true` marks invisible road-junction nodes used only for routing.
  const LOCATIONS = [
    { id: 'entrance',          name: 'Main Gate / Entrance',   cat: 'gate',      x: 500, y: 660, icon: '🚩', desc: 'The main entrance to NEC campus, Kovilpatti.' },
    { id: 'bus_stand',         name: 'Bus Stand',              cat: 'transport', x: 380, y: 660, icon: '🚌', desc: 'In-campus bus stand for college transport.' },
    { id: 'bike_park',         name: 'Bike Parking',           cat: 'parking',   x: 620, y: 660, icon: '🏍️', desc: 'Two-wheeler parking area near the main gate.' },
    { id: 'car_park',          name: 'Car Parking',            cat: 'parking',   x: 760, y: 660, icon: '🚗', desc: 'Four-wheeler parking area near the main gate.' },

    { id: 'j_south',           name: 'Junction', hidden: true,  cat: 'admin', x: 500, y: 560 },

    { id: 'main_office',       name: 'Main Office',            cat: 'admin',     x: 330, y: 560, icon: '🏢', desc: 'General administration and student services office.' },
    { id: 'principal_office',  name: 'Principal Office',       cat: 'admin',     x: 200, y: 560, icon: '🎓', desc: 'Office of the Principal, NEC.' },

    { id: 'library',           name: 'Central Library',        cat: 'facility',  x: 500, y: 430, icon: '📖', desc: 'Central library with reading halls and digital resources.' },
    { id: 'canteen',           name: 'Canteen',                cat: 'facility',  x: 320, y: 430, icon: '🍽️', desc: 'Main student and staff canteen.' },
    { id: 'newgen',            name: 'NewGen Centre',          cat: 'facility',  x: 700, y: 430, icon: '🚀', desc: 'Innovation and incubation centre for student projects & startups.' },

    { id: 'ground',            name: 'Ground',                 cat: 'ground',    x: 500, y: 300, icon: '🏟️', desc: 'Sports ground used for athletics and college events.' },
    { id: 'cse',               name: 'CSE Department',         cat: 'cse',       x: 260, y: 300, icon: '💻', desc: 'Department of Computer Science & Engineering.' },
    { id: 'ece',               name: 'ECE Department',         cat: 'ece',       x: 740, y: 300, icon: '📡', desc: 'Department of Electronics & Communication Engineering.' },

    { id: 'sh',                name: 'Science & Humanities (S&H) Block', cat: 'sh', x: 500, y: 170, icon: '📚', desc: 'Houses all First Year classes across every branch.' },
    { id: 'aids',              name: 'AI & DS Department',     cat: 'aids',      x: 260, y: 170, icon: '🤖', desc: 'Department of Artificial Intelligence & Data Science.' },
    { id: 'eee',               name: 'EEE Department',         cat: 'eee',       x: 740, y: 170, icon: '⚡', desc: 'Department of Electrical & Electronics Engineering.' },
    { id: 'mech',              name: 'Mechanical Department',  cat: 'mech',      x: 370, y: 70,  icon: '⚙️', desc: 'Department of Mechanical Engineering.' },
    { id: 'civil',             name: 'Civil Department',       cat: 'civil',     x: 630, y: 70,  icon: '🏗️', desc: 'Department of Civil Engineering.' }
  ];

  // Departments that contain the standard set of internal rooms.
  const DEPT_BLOCKS = [
    { parent: 'cse',   cat: 'cse'   },
    { parent: 'aids',  cat: 'aids'  },
    { parent: 'ece',   cat: 'ece'   },
    { parent: 'eee',   cat: 'eee'   },
    { parent: 'mech',  cat: 'mech'  },
    { parent: 'civil', cat: 'civil' }
  ];

  // Internal room template shared by every department block.
  // Weight = extra indoor walking distance (metres) from the building entrance.
  const INTERNAL_ROOM_TEMPLATE = [
    { key: 'hod',    label: 'HOD Room',             icon: '🧑‍🏫', weight: 15 },
    { key: 'staff',  label: 'Staff Room',           icon: '👥',   weight: 20 },
    { key: 'y2',     label: '2nd Year Classroom',   icon: '📗',   weight: 25 },
    { key: 'y3',     label: '3rd Year Classroom',   icon: '📘',   weight: 35 },
    { key: 'final',  label: 'Final Year Classroom', icon: '📙',   weight: 45 }
  ];

  // First-year classrooms located inside the S&H block.
  const SH_ROOMS = [
    { key: 'cse1',   parentDept: 'CSE',    label: 'CSE 1st Year',    weight: 20 },
    { key: 'aids1',  parentDept: 'AI&DS',  label: 'AI&DS 1st Year',  weight: 24 },
    { key: 'ece1',   parentDept: 'ECE',    label: 'ECE 1st Year',    weight: 28 },
    { key: 'eee1',   parentDept: 'EEE',    label: 'EEE 1st Year',    weight: 22 },
    { key: 'mech1',  parentDept: 'Mech',   label: 'Mechanical 1st Year', weight: 26 },
    { key: 'civil1', parentDept: 'Civil',  label: 'Civil 1st Year',  weight: 30 }
  ];

  // Build internal location entries and attach them to LOCATIONS.
  // Each internal node inherits its parent building's coordinates (it is
  // physically inside that building) and carries a fixed `internalWeight`
  // used instead of Euclidean distance when building the graph.
  const INTERNAL_LOCATIONS = [];
  DEPT_BLOCKS.forEach(function (dept) {
    const parentLoc = LOCATIONS.find(function (l) { return l.id === dept.parent; });
    INTERNAL_ROOM_TEMPLATE.forEach(function (room) {
      INTERNAL_LOCATIONS.push({
        id: dept.parent + '_' + room.key,
        name: parentLoc.name + ' — ' + room.label,
        shortName: room.label,
        cat: dept.cat,
        internal: true,
        parent: dept.parent,
        x: parentLoc.x,
        y: parentLoc.y,
        icon: room.icon,
        internalWeight: room.weight,
        desc: room.label + ' inside ' + parentLoc.name + '.'
      });
    });
  });
  SH_ROOMS.forEach(function (room) {
    const parentLoc = LOCATIONS.find(function (l) { return l.id === 'sh'; });
    INTERNAL_LOCATIONS.push({
      id: 'sh_' + room.key,
      name: 'S&H Block — ' + room.label,
      shortName: room.label,
      cat: 'sh',
      internal: true,
      parent: 'sh',
      x: parentLoc.x,
      y: parentLoc.y,
      icon: '📕',
      internalWeight: room.weight,
      desc: room.label + ' classroom inside the Science & Humanities block.'
    });
  });

  const ALL_LOCATIONS = LOCATIONS.concat(INTERNAL_LOCATIONS);
  const LOC_BY_ID = {};
  ALL_LOCATIONS.forEach(function (l) { LOC_BY_ID[l.id] = l; });

  // Road network — each pair becomes both a rendered road segment AND a
  // graph edge. Weight is computed from the Euclidean distance between
  // the two points (treated as metres).
  const ROADS = [
    ['entrance', 'bus_stand'],
    ['entrance', 'bike_park'],
    ['entrance', 'car_park'],
    ['entrance', 'j_south'],
    ['j_south', 'main_office'],
    ['j_south', 'principal_office'],
    ['j_south', 'library'],
    ['library', 'canteen'],
    ['library', 'newgen'],
    ['library', 'ground'],
    ['ground', 'cse'],
    ['ground', 'ece'],
    ['ground', 'sh'],
    ['sh', 'aids'],
    ['sh', 'eee'],
    ['sh', 'mech'],
    ['sh', 'civil']
  ];

  function dist(a, b) {
    const la = LOC_BY_ID[a], lb = LOC_BY_ID[b];
    return Math.round(Math.hypot(la.x - lb.x, la.y - lb.y));
  }

  /* ------------------------------------------------------------------------
     2. GRAPH CONSTRUCTION
     ------------------------------------------------------------------------ */

  const GRAPH = {}; // adjacency list: { id: [{ to, weight }] }

  function addEdge(a, b, w) {
    if (!GRAPH[a]) GRAPH[a] = [];
    if (!GRAPH[b]) GRAPH[b] = [];
    GRAPH[a].push({ to: b, weight: w });
    GRAPH[b].push({ to: a, weight: w });
  }

  ROADS.forEach(function (pair) {
    addEdge(pair[0], pair[1], dist(pair[0], pair[1]));
  });

  INTERNAL_LOCATIONS.forEach(function (loc) {
    addEdge(loc.id, loc.parent, loc.internalWeight);
  });

  const TOTAL_ROAD_LENGTH = ROADS.reduce(function (sum, pair) {
    return sum + dist(pair[0], pair[1]);
  }, 0);

  /* ------------------------------------------------------------------------
     3. DIJKSTRA PATHFINDING
     ------------------------------------------------------------------------ */

  // Returns { path: [ids...], distance: number } or null if unreachable.
  function findShortestPath(startId, endId) {
    if (startId === endId) return { path: [startId], distance: 0 };

    const dists = {};
    const prev = {};
    const visited = {};
    const queue = new Set(Object.keys(GRAPH));

    Object.keys(GRAPH).forEach(function (id) { dists[id] = Infinity; });
    dists[startId] = 0;

    while (queue.size > 0) {
      // Pick the unvisited node with smallest tentative distance.
      let current = null;
      let best = Infinity;
      queue.forEach(function (id) {
        if (dists[id] < best) { best = dists[id]; current = id; }
      });
      if (current === null) break; // remaining nodes are unreachable
      queue.delete(current);
      visited[current] = true;

      if (current === endId) break;

      (GRAPH[current] || []).forEach(function (edge) {
        if (visited[edge.to]) return;
        const alt = dists[current] + edge.weight;
        if (alt < dists[edge.to]) {
          dists[edge.to] = alt;
          prev[edge.to] = current;
        }
      });
    }

    if (dists[endId] === undefined || dists[endId] === Infinity) return null;

    const path = [];
    let node = endId;
    while (node !== undefined) {
      path.unshift(node);
      if (node === startId) break;
      node = prev[node];
    }
    return { path: path, distance: dists[endId] };
  }

  /* ------------------------------------------------------------------------
     4. MAP RENDERING (SVG)
     ------------------------------------------------------------------------ */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let svgEl, roadsLayer, groundLayer, buildingsLayer, routeLayer, labelsLayer;

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function buildMap() {
    svgEl = document.getElementById('campus-svg');
    svgEl.setAttribute('viewBox', '0 0 960 700');

    // Layer order matters: ground -> roads -> buildings -> route -> labels
    groundLayer = el('g', { class: 'layer-ground' });
    roadsLayer = el('g', { class: 'layer-roads' });
    buildingsLayer = el('g', { class: 'layer-buildings' });
    routeLayer = el('g', { class: 'layer-route' });
    labelsLayer = el('g', { class: 'layer-labels' });

    svgEl.appendChild(groundLayer);
    svgEl.appendChild(roadsLayer);
    svgEl.appendChild(buildingsLayer);
    svgEl.appendChild(routeLayer);
    svgEl.appendChild(labelsLayer);

    drawGround();
    drawRoads();
    drawBuildings();

    // Arrowhead marker used by the route layer.
    const defs = el('defs', {});
    const marker = el('marker', {
      id: 'arrowhead', markerWidth: '8', markerHeight: '8',
      refX: '4', refY: '4', orient: 'auto', markerUnits: 'strokeWidth'
    });
    marker.appendChild(el('path', { d: 'M0,0 L8,4 L0,8 Z', fill: 'var(--accent)' }));
    defs.appendChild(marker);
    svgEl.insertBefore(defs, svgEl.firstChild);
  }

  function drawGround() {
    const g = LOC_BY_ID['ground'];
    const rect = el('rect', {
      x: g.x - 130, y: g.y - 80, width: 260, height: 160, rx: 24,
      class: 'ground-area'
    });
    groundLayer.appendChild(rect);
    const label = el('text', { x: g.x, y: g.y + 4, class: 'ground-label', 'text-anchor': 'middle' });
    label.textContent = '🏟️ Ground';
    groundLayer.appendChild(label);
  }

  function drawRoads() {
    ROADS.forEach(function (pair) {
      const a = LOC_BY_ID[pair[0]], b = LOC_BY_ID[pair[1]];
      const line = el('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'road-line'
      });
      roadsLayer.appendChild(line);
    });
  }

  function drawBuildings() {
    LOCATIONS.forEach(function (loc) {
      if (loc.hidden) return;
      const catInfo = CATEGORIES[loc.cat];
      const group = el('g', {
        class: 'building-marker', 'data-id': loc.id, tabindex: '0',
        role: 'button', 'aria-label': loc.name
      });

      const isGround = loc.id === 'ground';
      if (!isGround) {
        const w = loc.cat === 'gate' ? 46 : 84;
        const h = 54;
        const rect = el('rect', {
          x: loc.x - w / 2, y: loc.y - h / 2, width: w, height: h, rx: 14,
          class: 'building-rect',
          style: '--marker-color:' + catInfo.color
        });
        group.appendChild(rect);

        const icon = el('text', { x: loc.x, y: loc.y - 4, class: 'building-icon', 'text-anchor': 'middle' });
        icon.textContent = loc.icon;
        group.appendChild(icon);

        const label = el('text', { x: loc.x, y: loc.y + 20, class: 'building-label', 'text-anchor': 'middle' });
        label.textContent = shortLabel(loc.name);
        group.appendChild(label);
      }

      group.addEventListener('click', function () { openInfoPopup(loc.id); });
      group.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInfoPopup(loc.id); }
      });

      buildingsLayer.appendChild(group);
    });

    // Marker for "current location" (rendered dynamically, updated on demand)
    const marker = el('circle', { r: 9, class: 'current-marker', id: 'current-marker', style: 'display:none' });
    buildingsLayer.appendChild(marker);
  }

  function shortLabel(name) {
    return name.length > 16 ? name.slice(0, 15) + '…' : name;
  }

  function setCurrentMarker(locId) {
    const marker = document.getElementById('current-marker');
    if (!locId) { marker.style.display = 'none'; return; }
    const loc = LOC_BY_ID[locId];
    marker.setAttribute('cx', loc.x);
    marker.setAttribute('cy', loc.y);
    marker.style.display = 'block';
  }

  /* ------------------------------------------------------------------------
     5. ROUTE DRAWING & ANIMATION
     ------------------------------------------------------------------------ */

  const WALK_SPEED_M_PER_MIN = 70; // ~4.2 km/h

  function clearRoute() {
    while (routeLayer.firstChild) routeLayer.removeChild(routeLayer.firstChild);
  }

  function drawRoute(pathIds, totalDistance) {
    clearRoute();
    const points = pathIds.map(function (id) {
      const l = LOC_BY_ID[id];
      return l.x + ',' + l.y;
    }).join(' ');

    const glow = el('polyline', { points: points, class: 'route-glow' });
    const line = el('polyline', { points: points, class: 'route-line', 'marker-mid': 'url(#arrowhead)' });
    routeLayer.appendChild(glow);
    routeLayer.appendChild(line);

    // Draw-on animation using stroke-dasharray/offset.
    const length = line.getTotalLength ? estimatePolylineLength(pathIds) : totalDistance;
    [glow, line].forEach(function (p) {
      p.style.strokeDasharray = length;
      p.style.strokeDashoffset = length;
    });
    // Force reflow then animate.
    void line.getBoundingClientRect();
    [glow, line].forEach(function (p) {
      p.style.transition = 'stroke-dashoffset 1.1s ease-in-out';
      p.style.strokeDashoffset = '0';
    });

    // Direction arrow dots placed along each segment.
    for (let i = 0; i < pathIds.length - 1; i++) {
      const a = LOC_BY_ID[pathIds[i]], b = LOC_BY_ID[pathIds[i + 1]];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
      const arrow = el('polygon', {
        points: '0,-6 12,0 0,6',
        transform: 'translate(' + mx + ',' + my + ') rotate(' + angle + ')',
        class: 'route-arrow',
        style: 'animation-delay:' + (i * 0.12) + 's'
      });
      routeLayer.appendChild(arrow);
    }

    // Start + end pulse markers.
    const startLoc = LOC_BY_ID[pathIds[0]];
    const endLoc = LOC_BY_ID[pathIds[pathIds.length - 1]];
    routeLayer.appendChild(el('circle', { cx: startLoc.x, cy: startLoc.y, r: 10, class: 'route-start' }));
    routeLayer.appendChild(el('circle', { cx: endLoc.x, cy: endLoc.y, r: 10, class: 'route-end' }));
  }

  function estimatePolylineLength(pathIds) {
    let total = 0;
    for (let i = 0; i < pathIds.length - 1; i++) {
      total += dist(pathIds[i], pathIds[i + 1]);
    }
    return total || 1;
  }

  function computeAndShowRoute(startId, endId) {
    const result = findShortestPath(startId, endId);
    const panel = document.getElementById('route-info-panel');

    if (!result) {
      panel.innerHTML = '<p class="route-error">No route could be found between these two locations.</p>';
      panel.classList.add('visible');
      clearRoute();
      return;
    }

    drawRoute(result.path, result.distance);
    setCurrentMarker(startId);

    const minutes = Math.max(1, Math.round(result.distance / WALK_SPEED_M_PER_MIN));
    const steps = buildDirectionSteps(result.path);

    panel.innerHTML =
      '<div class="route-summary">' +
        '<div class="route-stat"><span class="route-stat-value">' + result.distance + ' m</span><span class="route-stat-label">Distance</span></div>' +
        '<div class="route-stat"><span class="route-stat-value">' + minutes + ' min</span><span class="route-stat-label">Walking time</span></div>' +
        '<div class="route-stat"><span class="route-stat-value">' + (result.path.length - 1) + '</span><span class="route-stat-label">Segments</span></div>' +
      '</div>' +
      '<ol class="route-steps">' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    panel.classList.add('visible');
  }

  function buildDirectionSteps(pathIds) {
    const steps = [];
    const visible = pathIds.filter(function (id) { return !LOC_BY_ID[id].hidden; });
    for (let i = 0; i < visible.length; i++) {
      const loc = LOC_BY_ID[visible[i]];
      const name = loc.internal ? loc.shortName + ' (' + LOC_BY_ID[loc.parent].name + ')' : loc.name;
      if (i === 0) {
        steps.push('Start at <strong>' + name + '</strong>.');
      } else if (i === visible.length - 1) {
        const segDist = dist(visible[i - 1], visible[i]);
        steps.push('Arrive at <strong>' + name + '</strong> (' + segDist + ' m).');
      } else {
        const segDist = dist(visible[i - 1], visible[i]);
        steps.push('Head toward <strong>' + name + '</strong> (' + segDist + ' m).');
      }
    }
    return steps;
  }

  /* ------------------------------------------------------------------------
     6. SEARCH / AUTOCOMPLETE
     ------------------------------------------------------------------------ */

  function initSearch() {
    const input = document.getElementById('search-input');
    const suggestionsBox = document.getElementById('search-suggestions');

    input.addEventListener('input', function () {
      const q = input.value.trim().toLowerCase();
      suggestionsBox.innerHTML = '';
      if (!q) { suggestionsBox.classList.remove('visible'); return; }

      const matches = ALL_LOCATIONS.filter(function (l) {
        return !l.hidden && l.name.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);

      if (matches.length === 0) {
        suggestionsBox.classList.remove('visible');
        return;
      }

      matches.forEach(function (m) {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        const catInfo = CATEGORIES[m.cat];
        item.innerHTML = '<span class="suggestion-icon" style="color:' + catInfo.color + '">' + (m.icon || catInfo.icon) + '</span>' +
          '<span>' + m.name + '</span>';
        item.addEventListener('click', function () {
          selectSearchResult(m.id);
          input.value = m.name;
          suggestionsBox.classList.remove('visible');
        });
        suggestionsBox.appendChild(item);
      });
      suggestionsBox.classList.add('visible');
    });

    document.addEventListener('click', function (e) {
      if (!suggestionsBox.contains(e.target) && e.target !== input) {
        suggestionsBox.classList.remove('visible');
      }
    });
  }

  function selectSearchResult(locId) {
    openInfoPopup(locId);
    focusOnLocation(locId);
  }

  function focusOnLocation(locId) {
    const loc = LOC_BY_ID[locId];
    resetView();
    panState.x = (svgWrapper.clientWidth / 2) - (loc.x * panState.scale);
    panState.y = (svgWrapper.clientHeight / 2) - (loc.y * panState.scale);
    applyTransform();
  }

  /* ------------------------------------------------------------------------
     7. ZOOM & PAN
     ------------------------------------------------------------------------ */

  let svgWrapper;
  const panState = { x: 0, y: 0, scale: 1 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  function initZoomPan() {
    svgWrapper = document.getElementById('map-viewport');

    document.getElementById('zoom-in').addEventListener('click', function () { zoomBy(1.2); });
    document.getElementById('zoom-out').addEventListener('click', function () { zoomBy(1 / 1.2); });
    document.getElementById('zoom-reset').addEventListener('click', resetView);

    svgWrapper.addEventListener('mousedown', function (e) {
      isDragging = true;
      dragStart = { x: e.clientX - panState.x, y: e.clientY - panState.y };
      svgWrapper.classList.add('grabbing');
    });
    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      panState.x = e.clientX - dragStart.x;
      panState.y = e.clientY - dragStart.y;
      applyTransform();
    });
    window.addEventListener('mouseup', function () {
      isDragging = false;
      svgWrapper.classList.remove('grabbing');
    });

    // Touch support
    svgWrapper.addEventListener('touchstart', function (e) {
      const t = e.touches[0];
      isDragging = true;
      dragStart = { x: t.clientX - panState.x, y: t.clientY - panState.y };
    }, { passive: true });
    svgWrapper.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      const t = e.touches[0];
      panState.x = t.clientX - dragStart.x;
      panState.y = t.clientY - dragStart.y;
      applyTransform();
    }, { passive: true });
    svgWrapper.addEventListener('touchend', function () { isDragging = false; });

    svgWrapper.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
    }, { passive: false });
  }

  function zoomBy(factor) {
    const newScale = Math.min(3, Math.max(0.5, panState.scale * factor));
    panState.scale = newScale;
    applyTransform();
  }

  function resetView() {
    panState.x = 0; panState.y = 0; panState.scale = 1;
    applyTransform();
  }

  function applyTransform() {
    svgEl.style.transform = 'translate(' + panState.x + 'px,' + panState.y + 'px) scale(' + panState.scale + ')';
  }

  /* ------------------------------------------------------------------------
     8. THEME TOGGLE
     ------------------------------------------------------------------------ */

  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('nec-nav-theme');
    if (saved === 'dark') document.body.classList.add('dark');
    updateToggleLabel();

    toggle.addEventListener('click', function () {
      document.body.classList.toggle('dark');
      localStorage.setItem('nec-nav-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
      updateToggleLabel();
    });

    function updateToggleLabel() {
      toggle.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
  }

  /* ------------------------------------------------------------------------
     9. INFO POPUPS
     ------------------------------------------------------------------------ */

  function openInfoPopup(locId) {
    const loc = LOC_BY_ID[locId];
    const parent = loc.internal ? LOC_BY_ID[loc.parent] : null;
    const catInfo = CATEGORIES[loc.cat];
    const popup = document.getElementById('info-popup');

    const internalRooms = !loc.internal ? INTERNAL_LOCATIONS.filter(function (l) { return l.parent === locId; }) : [];

    let html = '<button class="popup-close" id="popup-close">✕</button>' +
      '<div class="popup-icon" style="background:' + catInfo.color + '22;color:' + catInfo.color + '">' + (loc.icon || catInfo.icon) + '</div>' +
      '<h3>' + loc.name + '</h3>' +
      '<p class="popup-cat" style="color:' + catInfo.color + '">' + (parent ? 'Inside ' + parent.name : catInfo.label) + '</p>' +
      '<p class="popup-desc">' + (loc.desc || '') + '</p>';

    if (internalRooms.length) {
      html += '<div class="popup-rooms"><span class="popup-rooms-title">Inside this building</span><ul>' +
        internalRooms.map(function (r) {
          return '<li><button class="popup-room-btn" data-room="' + r.id + '">' + r.icon + ' ' + r.shortName + '</button></li>';
        }).join('') + '</ul></div>';
    }

    html += '<div class="popup-actions">' +
      '<button class="btn btn-secondary" id="popup-set-current">Set as Current</button>' +
      '<button class="btn btn-primary" id="popup-set-destination">Set as Destination</button>' +
      '</div>';

    popup.innerHTML = html;
    popup.classList.add('visible');

    document.getElementById('popup-close').addEventListener('click', function () { popup.classList.remove('visible'); });
    document.getElementById('popup-set-current').addEventListener('click', function () {
      document.getElementById('current-select').value = locId;
      setCurrentMarker(locId);
      popup.classList.remove('visible');
    });
    document.getElementById('popup-set-destination').addEventListener('click', function () {
      document.getElementById('destination-select').value = locId;
      popup.classList.remove('visible');
    });
    popup.querySelectorAll('.popup-room-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('destination-select').value = btn.dataset.room;
        popup.classList.remove('visible');
      });
    });
  }

  /* ------------------------------------------------------------------------
     10. STATS PANEL
     ------------------------------------------------------------------------ */

  function renderStats() {
    const el = document.getElementById('stats-panel');
    const deptCount = DEPT_BLOCKS.length;
    const facilityCount = LOCATIONS.filter(function (l) { return l.cat === 'facility'; }).length;
    el.innerHTML =
      '<div class="stat-card"><span class="stat-value">' + ALL_LOCATIONS.filter(function (l) { return !l.hidden; }).length + '</span><span class="stat-label">Total mapped locations</span></div>' +
      '<div class="stat-card"><span class="stat-value">' + deptCount + '</span><span class="stat-label">Academic departments</span></div>' +
      '<div class="stat-card"><span class="stat-value">' + facilityCount + '</span><span class="stat-label">Facilities</span></div>' +
      '<div class="stat-card"><span class="stat-value">' + TOTAL_ROAD_LENGTH + ' m</span><span class="stat-label">Total road network</span></div>' +
      '<div class="stat-card"><span class="stat-value">' + INTERNAL_LOCATIONS.length + '</span><span class="stat-label">Rooms indexed inside buildings</span></div>' +
      '<div class="stat-card"><span class="stat-value">' + ROADS.length + '</span><span class="stat-label">Road segments</span></div>';
  }

  /* ------------------------------------------------------------------------
     11. SIDEBAR / TAB NAVIGATION
     ------------------------------------------------------------------------ */

  function initSidebar() {
    const tabs = document.querySelectorAll('.sidebar-tab');
    const panels = document.querySelectorAll('.side-panel');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById(tab.dataset.panel).classList.add('active');
        document.body.classList.remove('sidebar-open');
      });
    });

    const menuBtn = document.getElementById('mobile-menu-btn');
    menuBtn.addEventListener('click', function () {
      document.body.classList.toggle('sidebar-open');
    });
  }

  function populateLegend() {
    const legend = document.getElementById('legend-panel');
    legend.innerHTML = Object.keys(CATEGORIES).map(function (key) {
      const c = CATEGORIES[key];
      return '<div class="legend-item"><span class="legend-swatch" style="background:' + c.color + '">' + c.icon + '</span><span>' + c.label + '</span></div>';
    }).join('');
  }

  /* ------------------------------------------------------------------------
     12. DROPDOWNS + ROUTE FORM
     ------------------------------------------------------------------------ */

  function populateDropdowns() {
    const currentSel = document.getElementById('current-select');
    const destSel = document.getElementById('destination-select');

    const groups = {};
    ALL_LOCATIONS.forEach(function (loc) {
      if (loc.hidden) return;
      const key = loc.internal ? LOC_BY_ID[loc.parent].name : CATEGORIES[loc.cat].label;
      if (!groups[key]) groups[key] = [];
      groups[key].push(loc);
    });

    [currentSel, destSel].forEach(function (sel) {
      sel.innerHTML = '<option value="">Select a location…</option>';
      Object.keys(groups).sort().forEach(function (groupName) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        groups[groupName].forEach(function (loc) {
          const opt = document.createElement('option');
          opt.value = loc.id;
          opt.textContent = loc.internal ? loc.shortName : loc.name;
          optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
      });
    });
  }

  function initRouteForm() {
    document.getElementById('find-route-btn').addEventListener('click', function () {
      const startId = document.getElementById('current-select').value;
      const endId = document.getElementById('destination-select').value;
      if (!startId || !endId) {
        alert('Please choose both a current location and a destination.');
        return;
      }
      computeAndShowRoute(startId, endId);
    });

    document.getElementById('reset-route-btn').addEventListener('click', function () {
      clearRoute();
      document.getElementById('current-select').value = '';
      document.getElementById('destination-select').value = '';
      document.getElementById('route-info-panel').classList.remove('visible');
      document.getElementById('route-info-panel').innerHTML = '';
      setCurrentMarker(null);
      resetView();
    });

    document.getElementById('swap-locations-btn').addEventListener('click', function () {
      const a = document.getElementById('current-select');
      const b = document.getElementById('destination-select');
      const tmp = a.value;
      a.value = b.value;
      b.value = tmp;
    });
  }

  /* ------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    buildMap();
    initZoomPan();
    initTheme();
    initSearch();
    initSidebar();
    populateLegend();
    populateDropdowns();
    initRouteForm();
    renderStats();

    // Close popup when clicking the backdrop / outside the card.
    document.getElementById('info-popup-backdrop').addEventListener('click', function () {
      document.getElementById('info-popup').classList.remove('visible');
    });

    document.getElementById('current-year').textContent = new Date().getFullYear();
  });
})();
