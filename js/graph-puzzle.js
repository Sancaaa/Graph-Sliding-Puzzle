/**
 * graph-puzzle.js — Core Controller for Simplified Graph Sliding Puzzle
 * Features:
 * 1. Star-5 Paper Default Topology & Free Layout Editing (Move, Add Node, Connect Edge, Delete)
 * 2. Manual Tile Sliding & Custom Initial / Goal State Management
 * 3. AI Solvers: Breadth-First Search (BFS) & Depth-First Search (DFS)
 * 4. Step-by-Step Playback Tracing & Complete Search Tree Visualizer
 * 5. Strict Color Palette: Black #111827, Gold #CF9634, Gold Dim #FFEDCD, White #FFFFFF
 * 6. Typography: Arial for UI/nodes, JetBrains Mono for arrays (with 0 in gold)
 */

(function() {
  'use strict';

  // =========================================================================
  // 1. GRAPH TOPOLOGY PRESETS: STAR-5 & STAR-6
  // =========================================================================
  const PRESET_STAR5 = {
    name: '5-Star Graph',
    badge: 'Star-5 Preset',
    nodes: [
      { id: 1, x: 202, y: 21 },
      { id: 2, x: 21, y: 152 },
      { id: 3, x: 159, y: 152 },
      { id: 4, x: 245, y: 152 },
      { id: 5, x: 383, y: 152 },
      { id: 6, x: 133, y: 233 },
      { id: 7, x: 271, y: 233 },
      { id: 8, x: 202, y: 284 },
      { id: 9, x: 90, y: 365 },
      { id: 10, x: 314, y: 365 }
    ],
    edges: [
      [1, 3], [1, 4],
      [2, 3], [2, 6],
      [3, 4], [3, 6],
      [4, 5], [4, 7],
      [5, 7],
      [6, 8], [6, 9],
      [7, 8], [7, 10],
      [8, 9], [8, 10]
    ],
    initial: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
    goal:    [1, 2, 0, 3, 4, 6, 5, 8, 9, 7]
  };

  const PRESET_STAR6 = {
    name: '6-Star Graph',
    badge: 'Star-6 Preset',
    nodes: [
      { id: 1,  x: 200, y: 35 },
      { id: 2,  x: 80,  y: 105 },
      { id: 3,  x: 160, y: 105 },
      { id: 4,  x: 240, y: 105 },
      { id: 5,  x: 320, y: 105 },
      { id: 6,  x: 120, y: 175 },
      { id: 7,  x: 280, y: 175 },
      { id: 8,  x: 80,  y: 245 },
      { id: 9,  x: 160, y: 245 },
      { id: 10, x: 240, y: 245 },
      { id: 11, x: 320, y: 245 },
      { id: 12, x: 200, y: 315 }
    ],
    edges: [
      [1, 3], [1, 4],
      [2, 3], [2, 6],
      [3, 4], [3, 6],
      [4, 5], [4, 7],
      [5, 7],
      [6, 8], [6, 9],
      [7, 10], [7, 11],
      [8, 9],
      [9, 10], [9, 12],
      [10, 11], [10, 12]
    ],
    initial: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],
    goal:    [1, 3, 0, 4, 5, 2, 7, 8, 6, 10, 11, 9]
  };

  // =========================================================================
  // 2. APPLICATION STATE
  // =========================================================================
  let graphNodes = cloneNodes(PRESET_STAR5.nodes);
  let graphEdges = cloneEdges(PRESET_STAR5.edges);

  let initialState = [...PRESET_STAR5.initial];
  let goalState    = [...PRESET_STAR5.goal];
  let currentState = [...initialState];

  // Editor Tool: 'select' (Move) | 'add-node' | 'add-edge' | 'delete'
  let currentTool = 'select';
  let selectedNodeIds = new Set();
  let edgeStartNodeId = null;
  let mouseSvgPos = { x: 0, y: 0 };

  // Pointer dragging state for nodes
  let isDraggingNode = false;
  let dragAnchor = { x: 0, y: 0 };
  let nodeStartPositions = new Map();
  let dragDistance = 0;

  // Marquee box selection
  let isMarqueeActive = false;
  let marqueeStart = { x: 0, y: 0 };

  // AI Search Result & Trace Playback
  let searchResult = null; // { algo, path, solutionNodeIds, treeNodes, rootId }
  let traceEvents = [];
  let currentStepIdx = 0;
  let isPlaying = false;
  let playTimer = null;
  let playbackSpeed = 1000; // ms per step

  // Pan & Zoom for Tree Viewport
  let treeZoom = 1.0;
  let treePan = { x: 40, y: 30 };
  let isPanningTree = false;
  let panAnchor = { x: 0, y: 0 };

  // =========================================================================
  // 3. UTILITIES & GRAPH HELPERS
  // =========================================================================
  function cloneNodes(nodes) {
    return nodes.map(n => ({ ...n }));
  }

  function cloneEdges(edges) {
    return edges.map(e => [e[0], e[1]]);
  }

  function computeAdjacency(nodes, edges) {
    const adj = {};
    nodes.forEach(n => { adj[n.id] = []; });
    edges.forEach(([u, v]) => {
      if (adj[u] && adj[v]) {
        if (!adj[u].includes(v)) adj[u].push(v);
        if (!adj[v].includes(u)) adj[v].push(u);
      }
    });
    return adj;
  }

  function showToast(message) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  function parseArrayInput(str, expectedLen) {
    if (!str || typeof str !== 'string') return null;
    const tokens = str.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length !== expectedLen) return null;
    const nums = tokens.map(t => parseInt(t, 10));
    if (nums.some(isNaN)) return null;

    // Check valid permutation 0..(expectedLen - 1)
    const sorted = [...nums].sort((a, b) => a - b);
    for (let i = 0; i < expectedLen; i++) {
      if (sorted[i] !== i) return null;
    }
    return nums;
  }

  // =========================================================================
  // 4. BOARD RENDERING (Matching graphPenyelesaian1-3.svg)
  // =========================================================================
  function renderBoard(displayState = null) {
    const svg = document.getElementById('boardSvg');
    if (!svg) return;

    const state = displayState || currentState;
    const adj = computeAdjacency(graphNodes, graphEdges);

    // Compute bounding box to automatically center & scale any graph
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    graphNodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const pad = 36;
    const vbX = Math.round(minX - pad);
    const vbY = Math.round(minY - pad);
    const vbW = Math.max(100, Math.round(maxX - minX + pad * 2));
    const vbH = Math.max(100, Math.round(maxY - minY + pad * 2));
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    // Empty slot 0 and movable neighbors
    const zeroPos = state.indexOf(0) + 1; // 1-indexed node ID
    const movableNeighbors = adj[zeroPos] || [];

    let edgeGroup = svg.querySelector('.board-edges');
    let nodeGroup = svg.querySelector('.board-nodes');
    let ghostLine = svg.querySelector('#ghostWireLine');
    let marqueeBox = svg.querySelector('#marqueeRect');

    if (!edgeGroup || !nodeGroup) {
      svg.innerHTML = `
        <rect id="boardBgRect" width="100%" height="100%" fill="transparent" />
        <g class="board-edges"></g>
        <line id="ghostWireLine" class="ghost-wire" style="display:none;"></line>
        <rect id="marqueeRect" class="marquee-rect" style="display:none;"></rect>
        <g class="board-nodes"></g>
      `;
      edgeGroup = svg.querySelector('.board-edges');
      nodeGroup = svg.querySelector('.board-nodes');
      ghostLine = svg.querySelector('#ghostWireLine');
      marqueeBox = svg.querySelector('#marqueeRect');
    } else {
      edgeGroup.innerHTML = '';
      nodeGroup.innerHTML = '';
    }

    // Render Edges: Straight lines without arrowheads (stroke="#111827" stroke-width="1.8")
    graphEdges.forEach(([u, v]) => {
      const nu = graphNodes.find(n => n.id === u);
      const nv = graphNodes.find(n => n.id === v);
      if (!nu || !nv) return;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${nu.x} ${nu.y}L${nv.x} ${nv.y}`);
      path.setAttribute('class', 'graph-edge');

      path.onclick = (e) => {
        e.stopPropagation();
        if (currentTool === 'delete') {
          deleteEdge(u, v);
          renderBoard();
        }
      };

      edgeGroup.appendChild(path);
    });

    // Render Nodes: r=20, border #111827 (2px), Arial bold numbers
    graphNodes.forEach((node, idx) => {
      const val = (state && state.length > idx) ? state[idx] : 0;
      const isEmpty = (val === 0);
      const isMovable = movableNeighbors.includes(node.id);
      const isSelected = selectedNodeIds.has(node.id);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
      let nodeClasses = 'graph-node';
      if (isEmpty) nodeClasses += ' node-empty';        // Solid Gold #CF9634
      else if (isMovable) nodeClasses += ' node-movable'; // Gold Dim #FFEDCD
      if (isSelected) nodeClasses += ' node-selected';
      g.setAttribute('class', nodeClasses);

      // Circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', 20);
      g.appendChild(circle);

      // Tile Number Text (Arial Bold)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'node-label');
      text.textContent = val;
      g.appendChild(text);

      // Node Position ID Badge (e.g. P1..P10) above node
      const posTag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      posTag.setAttribute('y', -24);
      posTag.setAttribute('class', 'pos-indicator');
      posTag.textContent = `P${node.id}`;
      g.appendChild(posTag);

      // Pointer event for tile sliding & tools
      g.addEventListener('pointerdown', (e) => handleNodePointerDown(e, node));

      nodeGroup.appendChild(g);
    });

    // Update Ghost Rubberband Line
    if (ghostLine) {
      if (currentTool === 'add-edge' && edgeStartNodeId !== null) {
        const startNode = graphNodes.find(n => n.id === edgeStartNodeId);
        if (startNode) {
          ghostLine.style.display = 'block';
          ghostLine.setAttribute('x1', startNode.x);
          ghostLine.setAttribute('y1', startNode.y);
          ghostLine.setAttribute('x2', mouseSvgPos.x);
          ghostLine.setAttribute('y2', mouseSvgPos.y);
        }
      } else {
        ghostLine.style.display = 'none';
      }
    }
  }

  // =========================================================================
  // 4b. GOAL BOARD PREVIEW (TARGET GOAL STAR GRAPH)
  // Renders the exact star graph structure showing the goal state
  // =========================================================================
  function renderGoalBoard() {
    const svg = document.getElementById('goalBoardSvg');
    if (!svg) return;

    const state = goalState;
    if (!state || state.length === 0) return;

    // Compute bounding box matching graphNodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    graphNodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const pad = 36;
    const vbX = Math.round(minX - pad);
    const vbY = Math.round(minY - pad);
    const vbW = Math.max(100, Math.round(maxX - minX + pad * 2));
    const vbH = Math.max(100, Math.round(maxY - minY + pad * 2));
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    let edgeGroup = svg.querySelector('.goal-edges');
    let nodeGroup = svg.querySelector('.goal-nodes');

    if (!edgeGroup || !nodeGroup) {
      svg.innerHTML = `
        <rect width="100%" height="100%" fill="transparent" />
        <g class="goal-edges"></g>
        <g class="goal-nodes"></g>
      `;
      edgeGroup = svg.querySelector('.goal-edges');
      nodeGroup = svg.querySelector('.goal-nodes');
    } else {
      edgeGroup.innerHTML = '';
      nodeGroup.innerHTML = '';
    }

    // Render Edges
    graphEdges.forEach(([u, v]) => {
      const nu = graphNodes.find(n => n.id === u);
      const nv = graphNodes.find(n => n.id === v);
      if (!nu || !nv) return;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${nu.x} ${nu.y}L${nv.x} ${nv.y}`);
      path.setAttribute('class', 'graph-edge');
      edgeGroup.appendChild(path);
    });

    // Render Nodes: Slot 0 in solid gold #CF9634, other slots white with black border
    graphNodes.forEach((node, idx) => {
      const val = (state.length > idx) ? state[idx] : 0;
      const isEmpty = (val === 0);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
      let nodeClasses = 'graph-node';
      if (isEmpty) nodeClasses += ' node-empty'; // Solid Gold for slot 0
      g.setAttribute('class', nodeClasses);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', 18);
      g.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'node-label');
      text.textContent = val;
      g.appendChild(text);

      const posTag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      posTag.setAttribute('y', -22);
      posTag.setAttribute('class', 'pos-indicator');
      posTag.textContent = `P${node.id}`;
      g.appendChild(posTag);

      nodeGroup.appendChild(g);
    });
  }

  // =========================================================================
  // 5. GRAPH EDITOR & INTERACTION (SELECT, MOVE, ADD NODE, ADD EDGE, DELETE)
  // =========================================================================
  function getSvgCoordinates(e, svgEl) {
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  function handleNodePointerDown(e, node) {
    e.stopPropagation();

    // 1. Delete Tool
    if (currentTool === 'delete') {
      deleteNode(node.id);
      renderBoard();
      return;
    }

    // 2. Add Edge Tool
    if (currentTool === 'add-edge') {
      if (edgeStartNodeId === null) {
        edgeStartNodeId = node.id;
        showToast(`Select second node to connect with P${node.id}`);
      } else {
        if (edgeStartNodeId !== node.id) {
          toggleEdge(edgeStartNodeId, node.id);
        }
        edgeStartNodeId = null;
      }
      renderBoard();
      return;
    }

    // 3. Select / Move Tool (Default)
    if (currentTool === 'select') {
      // Check if node is movable tile adjacent to 0
      const adj = computeAdjacency(graphNodes, graphEdges);
      const zeroPos = currentState.indexOf(0) + 1;

      if (adj[zeroPos] && adj[zeroPos].includes(node.id)) {
        // Tile Slide Move!
        slideTile(node.id, zeroPos);
        renderBoard();
        return;
      }

      // Drag Node Move
      const multi = e.shiftKey;
      if (!selectedNodeIds.has(node.id) && !multi) {
        selectedNodeIds.clear();
      }
      selectedNodeIds.add(node.id);

      isDraggingNode = true;
      dragAnchor = { x: e.clientX, y: e.clientY };
      dragDistance = 0;
      nodeStartPositions.clear();

      selectedNodeIds.forEach(id => {
        const target = graphNodes.find(n => n.id === id);
        if (target) nodeStartPositions.set(id, { x: target.x, y: target.y });
      });

      const onPointerMove = (ev) => {
        dragDistance += Math.abs(ev.clientX - dragAnchor.x) + Math.abs(ev.clientY - dragAnchor.y);
        const svg = document.getElementById('boardSvg');
        const startPt = getSvgCoordinates({ clientX: dragAnchor.x, clientY: dragAnchor.y }, svg);
        const currPt = getSvgCoordinates(ev, svg);
        const dx = Math.round(currPt.x - startPt.x);
        const dy = Math.round(currPt.y - startPt.y);

        nodeStartPositions.forEach((pos, id) => {
          const target = graphNodes.find(n => n.id === id);
          if (target) {
            target.x = pos.x + dx;
            target.y = pos.y + dy;
          }
        });
        renderBoard();
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        isDraggingNode = false;
        if (dragDistance <= 4 && !multi) {
          selectedNodeIds.clear();
          selectedNodeIds.add(node.id);
        }
        renderBoard();
        renderGoalBoard();
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }
  }

  function setupCanvasEvents() {
    const svg = document.getElementById('boardSvg');
    if (!svg) return;

    svg.addEventListener('pointermove', (e) => {
      mouseSvgPos = getSvgCoordinates(e, svg);
      if (currentTool === 'add-edge' && edgeStartNodeId !== null) {
        const ghostLine = document.getElementById('ghostWireLine');
        if (ghostLine) {
          ghostLine.setAttribute('x2', mouseSvgPos.x);
          ghostLine.setAttribute('y2', mouseSvgPos.y);
        }
      }
    });

    svg.addEventListener('pointerdown', (e) => {
      const isBg = (e.target.id === 'boardSvg' || e.target.id === 'boardBgRect');
      if (!isBg) return;

      const pt = getSvgCoordinates(e, svg);

      // Add Node Tool
      if (currentTool === 'add-node') {
        addNewNode(pt.x, pt.y);
        renderBoard();
        return;
      }

      // Marquee Selection Box
      if (currentTool === 'select') {
        if (!e.shiftKey) selectedNodeIds.clear();
        isMarqueeActive = true;
        marqueeStart = { x: pt.x, y: pt.y };

        const marqueeBox = document.getElementById('marqueeRect');
        if (marqueeBox) {
          marqueeBox.style.display = 'block';
          marqueeBox.setAttribute('x', pt.x);
          marqueeBox.setAttribute('y', pt.y);
          marqueeBox.setAttribute('width', '0');
          marqueeBox.setAttribute('height', '0');
        }

        const onMarqueeMove = (ev) => {
          const curPt = getSvgCoordinates(ev, svg);
          const x = Math.min(marqueeStart.x, curPt.x);
          const y = Math.min(marqueeStart.y, curPt.y);
          const w = Math.abs(curPt.x - marqueeStart.x);
          const h = Math.abs(curPt.y - marqueeStart.y);

          if (marqueeBox) {
            marqueeBox.setAttribute('x', x);
            marqueeBox.setAttribute('y', y);
            marqueeBox.setAttribute('width', w);
            marqueeBox.setAttribute('height', h);
          }

          graphNodes.forEach(node => {
            if (node.x >= x && node.x <= x + w && node.y >= y && node.y <= y + h) {
              selectedNodeIds.add(node.id);
            }
          });
          renderBoard();
        };

        const onMarqueeUp = () => {
          window.removeEventListener('pointermove', onMarqueeMove);
          window.removeEventListener('pointerup', onMarqueeUp);
          isMarqueeActive = false;
          if (marqueeBox) marqueeBox.style.display = 'none';
          renderBoard();
        };

        window.addEventListener('pointermove', onMarqueeMove);
        window.addEventListener('pointerup', onMarqueeUp);
      }
    });
  }

  function addNewNode(x, y) {
    const nextId = graphNodes.length > 0 ? Math.max(...graphNodes.map(n => n.id)) + 1 : 1;
    graphNodes.push({ id: nextId, x: Math.round(x), y: Math.round(y) });

    // Expand states with next number
    const nextVal = graphNodes.length - 1;
    currentState.push(nextVal);
    initialState.push(nextVal);
    goalState.push(nextVal);

    updateStateInputs();
    renderGoalBoard();
    showToast(`Added Node P${nextId}`);
  }

  function toggleEdge(u, v) {
    const existingIdx = graphEdges.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u));
    if (existingIdx !== -1) {
      graphEdges.splice(existingIdx, 1);
      showToast(`Disconnected P${u} — P${v}`);
    } else {
      graphEdges.push([Math.min(u, v), Math.max(u, v)]);
      showToast(`Connected P${u} — P${v}`);
    }
    renderGoalBoard();
  }

  function deleteEdge(u, v) {
    const idx = graphEdges.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u));
    if (idx !== -1) {
      graphEdges.splice(idx, 1);
      renderGoalBoard();
      showToast(`Deleted edge P${u} — P${v}`);
    }
  }

  function deleteNode(nodeId) {
    if (graphNodes.length <= 3) {
      showToast('Minimum 3 nodes required for graph puzzle.');
      return;
    }
    const idx = graphNodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return;

    graphNodes.splice(idx, 1);
    graphEdges = graphEdges.filter(([u, v]) => u !== nodeId && v !== nodeId);

    // Re-index remaining nodes to 1..N
    const oldToNew = new Map();
    graphNodes.forEach((n, i) => {
      oldToNew.set(n.id, i + 1);
      n.id = i + 1;
    });

    graphEdges.forEach(e => {
      e[0] = oldToNew.get(e[0]);
      e[1] = oldToNew.get(e[1]);
    });

    // Re-generate default clean states for new length
    const nLen = graphNodes.length;
    const newSt = [];
    for (let i = 1; i < nLen; i++) newSt.push(i);
    newSt.push(0);

    currentState = [...newSt];
    initialState = [...newSt];
    goalState = [...newSt];

    selectedNodeIds.clear();
    updateStateInputs();
    renderGoalBoard();
    showToast(`Deleted Node P${nodeId}. Graph re-indexed to ${nLen} nodes.`);
  }

  function slideTile(fromPos, toZeroPos) {
    const fromIdx = fromPos - 1;
    const toIdx = toZeroPos - 1;

    const val = currentState[fromIdx];
    currentState[toIdx] = val;
    currentState[fromIdx] = 0;

    showToast(`Moved Tile ${val} (P${fromPos} → P${toZeroPos})`);
  }

  // =========================================================================
  // 6. STATE INPUTS & PRESETS MANAGEMENT
  // =========================================================================
  function updateStateInputs() {
    const initInput = document.getElementById('inputInitialState');
    const goalInput = document.getElementById('inputGoalState');
    if (initInput) initInput.value = initialState.join(', ');
    if (goalInput) goalInput.value = goalState.join(', ');
  }

  function applyStateInputs() {
    const initInput = document.getElementById('inputInitialState');
    const goalInput = document.getElementById('inputGoalState');
    const alertBox = document.getElementById('stateAlert');

    const expectedLen = graphNodes.length;
    const initArr = parseArrayInput(initInput ? initInput.value : '', expectedLen);
    const goalArr = parseArrayInput(goalInput ? goalInput.value : '', expectedLen);

    if (!initArr) {
      if (alertBox) {
        alertBox.textContent = `Initial State must contain exactly ${expectedLen} unique numbers (0 to ${expectedLen - 1}).`;
        alertBox.style.display = 'block';
      }
      return false;
    }

    if (!goalArr) {
      if (alertBox) {
        alertBox.textContent = `Goal State must contain exactly ${expectedLen} unique numbers (0 to ${expectedLen - 1}).`;
        alertBox.style.display = 'block';
      }
      return false;
    }

    if (alertBox) alertBox.style.display = 'none';
    initialState = [...initArr];
    goalState = [...goalArr];
    currentState = [...initialState];

    renderBoard();
    renderGoalBoard();
    showToast('✓ Initial & Goal State successfully applied!');
    return true;
  }

  // =========================================================================
  // 7. AI SEARCH ENGINES (BFS & DFS)
  // Generates complete search tree and step-by-step trace events
  // =========================================================================
  function runSearch(algo = 'bfs') {
    if (!applyStateInputs()) return;

    pausePlayback();
    const adj = computeAdjacency(graphNodes, graphEdges);

    const startKey = initialState.join(',');
    const goalKey = goalState.join(',');

    const treeNodes = {};
    const trace = [];
    let nodeCounter = 0;

    const rootNode = {
      id: 0,
      state: [...initialState],
      parentId: null,
      depth: 0,
      move: null,
      children: [],
      status: 'unvisited'
    };
    treeNodes[0] = rootNode;

    let solutionLeaf = null;
    const maxNodesLimit = 1500;
    let expandedCount = 0;

    const t0 = performance.now();

    if (algo === 'bfs') {
      // BFS with FIFO Queue & Visited Set
      const queue = [0];
      const visited = new Set([startKey]);

      trace.push({
        step: 0,
        nodeId: 0,
        state: [...initialState],
        action: 'init',
        frontierSize: 1,
        message: 'Initialized root state in queue'
      });

      while (queue.length > 0 && nodeCounter < maxNodesLimit) {
        const curId = queue.shift();
        const cur = treeNodes[curId];
        cur.status = 'traversed';
        expandedCount++;

        trace.push({
          step: trace.length,
          nodeId: curId,
          state: [...cur.state],
          action: 'pop',
          frontierSize: queue.length,
          message: `Expanding Node ${curId === 0 ? 'Root' : 'P' + cur.move.fromPos}`
        });

        // Check Goal
        if (cur.state.join(',') === goalKey) {
          solutionLeaf = cur;
          break;
        }

        // Generate Valid Sliding Moves
        const zeroPos = cur.state.indexOf(0) + 1;
        const neighbors = (adj[zeroPos] || []).slice();
        // Paper convention: order neighbors ascending by moved tile number
        neighbors.sort((a, b) => cur.state[a - 1] - cur.state[b - 1]);

        neighbors.forEach(nPos => {
          const nextState = [...cur.state];
          const movedVal = nextState[nPos - 1];
          nextState[zeroPos - 1] = movedVal;
          nextState[nPos - 1] = 0;

          const nKey = nextState.join(',');
          if (!visited.has(nKey)) {
            visited.add(nKey);
            nodeCounter++;
            const childNode = {
              id: nodeCounter,
              state: nextState,
              parentId: cur.id,
              depth: cur.depth + 1,
              move: { fromPos: nPos, toPos: zeroPos, movedTile: movedVal },
              children: [],
              status: 'unvisited'
            };
            treeNodes[nodeCounter] = childNode;
            cur.children.push(nodeCounter);
            queue.push(nodeCounter);
          }
        });
      }
    } else {
      // DFS with LIFO Stack, Depth Limit & Path Visited (Cycle Avoidance)
      const stack = [0];
      const maxDfsDepth = 15;
      const maxNodesLimit = 3500;

      while (stack.length > 0 && nodeCounter < maxNodesLimit) {
        const curId = stack.pop();
        const cur = treeNodes[curId];
        cur.status = 'traversed';
        expandedCount++;

        if (cur.state.join(',') === goalKey) {
          solutionLeaf = cur;
          break;
        }

        if (cur.depth < maxDfsDepth) {
          const zeroPos = cur.state.indexOf(0) + 1;
          const neighbors = (adj[zeroPos] || []).slice();
          // Urutkan cabang anak berdasarkan nomor simpul wadah (Node ID ascending: P1, P2, ...)
          neighbors.sort((a, b) => a - b);

          const createdChildren = [];
          neighbors.forEach(nPos => {
            const nextState = [...cur.state];
            const movedVal = nextState[nPos - 1];
            nextState[zeroPos - 1] = movedVal;
            nextState[nPos - 1] = 0;

            const nKey = nextState.join(',');
            // Check ancestors to avoid cycles along the current branch
            let hasCycle = false;
            let p = cur;
            while (p) {
              if (p.state.join(',') === nKey) { hasCycle = true; break; }
              p = (p.parentId !== null) ? treeNodes[p.parentId] : null;
            }

            if (!hasCycle) {
              nodeCounter++;
              const childNode = {
                id: nodeCounter,
                state: nextState,
                parentId: cur.id,
                depth: cur.depth + 1,
                move: { fromPos: nPos, toPos: zeroPos, movedTile: movedVal },
                children: [],
                status: 'unvisited'
              };
              treeNodes[nodeCounter] = childNode;
              cur.children.push(nodeCounter);
              createdChildren.push(nodeCounter);
            }
          });

          // Push children to stack in reverse order so the leftmost child (Child 1) is popped first
          for (let i = createdChildren.length - 1; i >= 0; i--) {
            stack.push(createdChildren[i]);
          }
        }
      }
    }

    const tDuration = (performance.now() - t0).toFixed(1);

    // Reconstruct Solution Path
    const solutionNodeIds = [];
    const movePath = [];
    let cur = solutionLeaf;
    while (cur) {
      solutionNodeIds.unshift(cur.id);
      cur.status = 'solution'; // Gold #CF9634
      if (cur.move) movePath.unshift(cur.move);
      cur = (cur.parentId !== null) ? treeNodes[cur.parentId] : null;
    }

    // Build solution step events for sequential board playback
    const solutionTrace = [];
    solutionTrace.push({
      step: 0,
      nodeId: 0,
      state: [...initialState],
      move: null
    });

    for (let i = 0; i < movePath.length; i++) {
      const nid = solutionNodeIds[i + 1];
      solutionTrace.push({
        step: i + 1,
        nodeId: nid,
        state: [...treeNodes[nid].state],
        move: movePath[i]
      });
    }

    searchResult = {
      algo,
      found: !!solutionLeaf,
      path: movePath,
      solutionNodeIds,
      treeNodes,
      rootId: 0,
      expandedCount,
      totalNodes: Object.keys(treeNodes).length,
      durationMs: tDuration
    };

    traceEvents = solutionTrace;
    currentStepIdx = 0;

    // Immediate Step Counter Update: "Step 0 / Total"
    const stepLabel = document.getElementById('valStepCount');
    if (stepLabel) {
      stepLabel.textContent = `Step 0 / ${movePath.length}`;
    }

    // Gray out currently active algorithm button
    const btnBFS = document.getElementById('btnSolveBFS');
    const btnDFS = document.getElementById('btnSolveDFS');
    if (btnBFS && btnDFS) {
      if (algo === 'bfs') {
        btnBFS.classList.add('algo-active');
        btnDFS.classList.remove('algo-active');
      } else {
        btnDFS.classList.add('algo-active');
        btnBFS.classList.remove('algo-active');
      }
    }

    // Render Goal Board, Complete Search Tree & Update Summary
    renderGoalBoard();
    renderCompleteSearchTree(treeNodes, solutionNodeIds);
    fitTreeView(); // Auto-fit camera to track Node 0 (Root)
    updateStatsSummary(searchResult);

    if (searchResult.found) {
      showToast(`✓ ${algo.toUpperCase()} Solved! Found solution in ${movePath.length} move${movePath.length === 1 ? '' : 's'} (${tDuration} ms)`);
    } else {
      const limitDetails = (algo === 'dfs')
        ? `max ${maxNodesLimit.toLocaleString()} nodes, depth 15`
        : `max ${maxNodesLimit.toLocaleString()} nodes`;
      showToast(`⚠ ${algo.toUpperCase()} could not reach goal within search limit (${limitDetails}).`);
    }
  }

  // =========================================================================
  // 8. COMPLETE SEARCH TREE VISUALIZER (SVG HIERARCHY)
  // Strict matching treePenyelesaian1-3.svg with JetBrains Mono arrays
  // =========================================================================
  function renderCompleteSearchTree(nodesMap, solutionNodeIds = []) {
    const svg = document.getElementById('treeSvg');
    if (!svg || !nodesMap || !nodesMap[0]) return;

    // 1. Layout Tree: Compute hierarchical (x, y) coordinates
    computeTreeLayout(nodesMap);

    svg.innerHTML = '';
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mainGroup.setAttribute('id', 'treeContentGroup');
    mainGroup.setAttribute('transform', `translate(${treePan.x}, ${treePan.y}) scale(${treeZoom})`);
    svg.appendChild(mainGroup);

    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeGroup.setAttribute('class', 'tree-edges');
    mainGroup.appendChild(edgeGroup);

    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'tree-nodes');
    mainGroup.appendChild(nodeGroup);

    // 2. Render Lines: Straight lines without arrowheads (stroke="#111827" stroke-width="1.8")
    Object.values(nodesMap).forEach(node => {
      node.children.forEach(childId => {
        const child = nodesMap[childId];
        if (!child) return;

        const isSolEdge = (node.status === 'solution' && child.status === 'solution');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${node.layoutX} ${node.layoutY}L${child.layoutX} ${child.layoutY}`);
        path.setAttribute('class', `tree-edge ${isSolEdge ? 'solution-edge' : ''}`);
        edgeGroup.appendChild(path);
      });
    });

    // 3. Render Nodes: Circle r=18, stroke #111827 (2px), Gold / Gold Dim fills
    Object.values(nodesMap).forEach(node => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${node.layoutX}, ${node.layoutY})`);
      g.setAttribute('class', `tree-node node-${node.status}`);

      // Circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', 18);
      g.appendChild(circle);

      // Circle Label: '0' for root, 'P{k}' for child moves
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('class', 'circle-label');
      label.textContent = (node.id === 0) ? '0' : `P${node.move.fromPos}`;
      g.appendChild(label);

      // Array Label in JetBrains Mono with '0' in Gold
      const arrayText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      arrayText.setAttribute('class', 'array-label');

      // Placement: If tight horizontal space, stack below node; otherwise to the right
      const isTightChild = node.children && node.children.length > 2;
      const tx = 24;
      const ty = 4;
      arrayText.setAttribute('x', tx);
      arrayText.setAttribute('y', ty);

      // Format array: [1,2,3,4,5,6,0,8,9,7] with 0 in gold
      const stateArr = node.state || [];
      const zeroIdx = stateArr.indexOf(0);

      const beforeZero = '[' + stateArr.slice(0, zeroIdx).join(',') + (zeroIdx > 0 ? ',' : '');
      const afterZero = (zeroIdx < stateArr.length - 1 ? ',' : '') + stateArr.slice(zeroIdx + 1).join(',') + ']';

      arrayText.innerHTML = `
        <tspan fill="#111827">${beforeZero}</tspan><tspan class="zero-tile">0</tspan><tspan fill="#111827">${afterZero}</tspan>
      `;
      g.appendChild(arrayText);

      // Click tree node to preview its board state
      g.onclick = () => {
        renderBoard(node.state);
        if (searchResult && searchResult.solutionNodeIds && searchResult.solutionNodeIds.includes(node.id)) {
          currentStepIdx = searchResult.solutionNodeIds.indexOf(node.id);
          const totalMoves = searchResult.path ? searchResult.path.length : 0;
          const stepLabel = document.getElementById('valStepCount');
          if (stepLabel) {
            stepLabel.textContent = `Step ${currentStepIdx} / ${totalMoves}`;
          }
        }
        showToast(`Inspecting state at Node ${node.id === 0 ? 'Root' : 'P' + node.move.fromPos}`);
      };

      nodeGroup.appendChild(g);
    });
  }

  // Hierarchical tree positioning (Reingold-Tilford subtree spacing)
  function computeTreeLayout(nodesMap) {
    let nextLeafX = 40;
    const levelHeight = 90;

    function layoutSubtree(nodeId, depth) {
      const node = nodesMap[nodeId];
      node.depth = depth;
      node.layoutY = depth * levelHeight + 30;

      if (!node.children || node.children.length === 0) {
        node.layoutX = nextLeafX;
        nextLeafX += 135; // horizontal spacing per leaf branch
        return;
      }

      node.children.forEach(cId => layoutSubtree(cId, depth + 1));
      const firstChild = nodesMap[node.children[0]];
      const lastChild = nodesMap[node.children[node.children.length - 1]];
      node.layoutX = Math.round((firstChild.layoutX + lastChild.layoutX) / 2);
    }

    layoutSubtree(0, 0);
  }

  // =========================================================================
  // 9. PAN & ZOOM TREE CONTROLS
  // =========================================================================
  function setupTreePanZoom() {
    const viewport = document.getElementById('treeViewport');
    const svg = document.getElementById('treeSvg');
    if (!viewport || !svg) return;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tree-node')) return; // let node click handle inspection
      isPanningTree = true;
      panAnchor = { x: e.clientX - treePan.x, y: e.clientY - treePan.y };
    });

    window.addEventListener('pointermove', (e) => {
      if (!isPanningTree) return;
      treePan.x = e.clientX - panAnchor.x;
      treePan.y = e.clientY - panAnchor.y;
      updateTreeTransform();
    });

    window.addEventListener('pointerup', () => {
      isPanningTree = false;
    });

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      treeZoom = Math.max(0.2, Math.min(3.0, treeZoom * zoomFactor));
      updateTreeTransform();
    }, { passive: false });
  }

  function updateTreeTransform() {
    const group = document.getElementById('treeContentGroup');
    if (group) {
      group.setAttribute('transform', `translate(${treePan.x}, ${treePan.y}) scale(${treeZoom})`);
    }
  }

  function fitTreeView() {
    const viewport = document.getElementById('treeViewport');
    const vpW = (viewport && viewport.clientWidth) ? viewport.clientWidth : 800;

    let rootX = 200;
    let rootY = 30;

    if (searchResult && searchResult.treeNodes && searchResult.treeNodes[0]) {
      const rootNode = searchResult.treeNodes[0];
      if (typeof rootNode.layoutX === 'number') rootX = rootNode.layoutX;
      if (typeof rootNode.layoutY === 'number') rootY = rootNode.layoutY;
    }

    treeZoom = 1.0;
    // Track and center camera horizontally on Root Node 0, placed 50px from top
    treePan.x = Math.round(vpW / 2 - rootX * treeZoom);
    treePan.y = Math.round(50 - rootY * treeZoom);

    updateTreeTransform();
  }

  // =========================================================================
  // 10. STEP-BY-STEP PLAYBACK TRACING
  // =========================================================================
  function jumpStep(stepIdx) {
    if (!traceEvents || traceEvents.length === 0) return;
    currentStepIdx = Math.max(0, Math.min(traceEvents.length - 1, stepIdx));
    const ev = traceEvents[currentStepIdx];

    // Synchronize Left Board
    renderBoard(ev.state);

    // Synchronize Search Tree Highlights
    if (searchResult && searchResult.treeNodes) {
      Object.values(searchResult.treeNodes).forEach(n => {
        const isSol = searchResult.solutionNodeIds.includes(n.id);
        if (n.id === ev.nodeId) {
          n.status = 'active'; // Currently active step: Gold
        } else if (isSol) {
          n.status = 'solution'; // Solution Path: Gold
        } else if (n.status === 'traversed') {
          n.status = 'traversed'; // Traversed but not solution: Black circle with white text
        } else {
          n.status = 'unvisited';
        }
      });
      renderCompleteSearchTree(searchResult.treeNodes, searchResult.solutionNodeIds);
    }

    // Update Step Label: "Step X / TotalMoves"
    const totalMoves = (searchResult && searchResult.path) ? searchResult.path.length : 0;
    const stepLabel = document.getElementById('valStepCount');
    if (stepLabel) {
      stepLabel.textContent = `Step ${currentStepIdx} / ${totalMoves}`;
    }
  }

  function togglePlay() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (!traceEvents || traceEvents.length <= 1) return;
    if (currentStepIdx >= traceEvents.length - 1) {
      jumpStep(0);
    }

    isPlaying = true;
    const btn = document.getElementById('btnPlayPause');
    if (btn) btn.textContent = '⏸ Pause';

    playTimer = setInterval(() => {
      if (currentStepIdx < traceEvents.length - 1) {
        jumpStep(currentStepIdx + 1);
      } else {
        pausePlayback();
      }
    }, playbackSpeed);
  }

  function pausePlayback() {
    isPlaying = false;
    clearInterval(playTimer);
    const btn = document.getElementById('btnPlayPause');
    if (btn) btn.textContent = '▶ Play';
  }

  // =========================================================================
  // 11. STATS & SUMMARY
  // =========================================================================
  function updateStatsSummary(res) {
    const statEl = document.getElementById('statsSummaryBlock');
    const pathStrip = document.getElementById('solutionPathStrip');
    if (!statEl || !res) return;

    const movesStr = res.path.map(m => m.fromPos).join(' → ');
    if (pathStrip) {
      pathStrip.textContent = res.found ? `Path: ${movesStr}` : 'No solution path';
    }

    statEl.innerHTML = `
      <span>Algorithm: <strong>${res.algo.toUpperCase()}</strong></span>
      <span>Moves: <strong>${res.path.length}</strong></span>
      <span>Expanded: <strong>${res.expandedCount}</strong></span>
      <span>Total Tree: <strong>${res.totalNodes}</strong></span>
      <span>Time: <strong>${res.durationMs} ms</strong></span>
    `;
  }

  function applyPreset(preset) {
    pausePlayback();
    graphNodes = cloneNodes(preset.nodes);
    graphEdges = cloneEdges(preset.edges);
    initialState = [...preset.initial];
    goalState = [...preset.goal];
    currentState = [...initialState];

    selectedNodeIds.clear();
    edgeStartNodeId = null;

    const badge = document.getElementById('boardBadge');
    if (badge) badge.textContent = preset.badge;

    updateStateInputs();
    renderBoard();
    renderGoalBoard();
    runSearch('bfs');
    showToast(`✓ Loaded ${preset.name}`);
  }

  // =========================================================================
  // 12. SVG EXPORT / DOWNLOAD FUNCTIONALITY
  // Exports clean, standalone SVG of currently rendered star graph board
  // =========================================================================
  function exportSvgElement(svgElement, defaultFilename = 'star_graph.svg') {
    if (!svgElement) return;

    // 1. Clone the SVG element so we do not mutate live DOM
    const clone = svgElement.cloneNode(true);

    // 2. Remove interactive UI elements not meant for exported graphics
    const unwanted = clone.querySelectorAll('#ghostWireLine, #marqueeRect, .ghost-wire, .marquee-rect');
    unwanted.forEach(el => el.remove());

    // 3. Ensure proper namespaces and dimensions
    const vb = svgElement.getAttribute('viewBox') || '0 0 404 386';
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('viewBox', vb);

    const vbParts = vb.trim().split(/\s+/).map(Number);
    if (vbParts.length === 4) {
      clone.setAttribute('width', vbParts[2]);
      clone.setAttribute('height', vbParts[3]);
    }

    // 4. Inject self-contained styling with exact palette
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .graph-edge { stroke: #111827; stroke-width: 1.8; stroke-linecap: round; fill: none; }
      .graph-node circle { fill: #ffffff; stroke: #111827; stroke-width: 2; }
      .graph-node.node-empty circle { fill: #CF9634 !important; stroke: #111827 !important; }
      .graph-node.node-movable circle { fill: #FFEDCD !important; stroke: #111827 !important; }
      .graph-node.node-selected circle { stroke: #111827 !important; stroke-width: 3.5 !important; }
      .node-label { font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; fill: #111827; text-anchor: middle; dominant-baseline: central; }
      .pos-indicator { font-family: Arial, sans-serif; font-size: 9px; font-weight: 700; fill: #64748b; text-anchor: middle; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);

    // 5. Background rect (transparent so it seamlessly overlays on Canva slides)
    let bg = clone.querySelector('#boardBgRect');
    if (bg) {
      bg.setAttribute('fill', 'none');
    }

    // 6. Serialize and trigger browser download
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clone);
    if (!svgString.startsWith('<?xml')) {
      svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    }

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`✓ Downloaded ${defaultFilename}`);
  }

  // =========================================================================
  // 13. UI WIRING & INITIALIZATION
  // =========================================================================
  function init() {
    setupCanvasEvents();
    setupTreePanZoom();
    updateStateInputs();

    // Editor Tool Buttons
    const tools = ['select', 'add-node', 'add-edge', 'delete'];
    tools.forEach(toolName => {
      const btn = document.getElementById(`tool-${toolName}`);
      if (btn) {
        btn.onclick = () => {
          currentTool = toolName;
          edgeStartNodeId = null;
          selectedNodeIds.clear();
          tools.forEach(t => {
            const b = document.getElementById(`tool-${t}`);
            if (b) b.classList.toggle('active', t === toolName);
          });
          renderBoard();
        };
      }
    });

    // Solve Buttons
    const btnBFS = document.getElementById('btnSolveBFS');
    if (btnBFS) btnBFS.onclick = () => runSearch('bfs');

    const btnDFS = document.getElementById('btnSolveDFS');
    if (btnDFS) btnDFS.onclick = () => runSearch('dfs');

    // Presets: 5-Star Graph and 6-Star Graph
    const chipStar5 = document.getElementById('chipPresetStar5');
    if (chipStar5) chipStar5.onclick = () => applyPreset(PRESET_STAR5);

    const chipStar6 = document.getElementById('chipPresetStar6');
    if (chipStar6) chipStar6.onclick = () => applyPreset(PRESET_STAR6);

    // State Action Buttons
    const btnApplyState = document.getElementById('btnApplyState');
    if (btnApplyState) btnApplyState.onclick = applyStateInputs;

    const btnSetCurrentInit = document.getElementById('btnSetCurrentInit');
    if (btnSetCurrentInit) btnSetCurrentInit.onclick = () => {
      initialState = [...currentState];
      updateStateInputs();
      showToast('✓ Current board set as Initial State');
    };

    const btnSetCurrentGoal = document.getElementById('btnSetCurrentGoal');
    if (btnSetCurrentGoal) btnSetCurrentGoal.onclick = () => {
      goalState = [...currentState];
      updateStateInputs();
      renderGoalBoard();
      showToast('✓ Current board set as Goal State');
    };

    const btnResetBoard = document.getElementById('btnResetBoard');
    if (btnResetBoard) btnResetBoard.onclick = () => {
      currentState = [...initialState];
      renderBoard();
      showToast('Board reset to Initial State');
    };

    // SVG Download Buttons (Board & Goal)
    const btnDlBoard = document.getElementById('btnDownloadBoardSvg');
    if (btnDlBoard) {
      btnDlBoard.onclick = () => {
        const stepTag = (currentStepIdx > 0 && traceEvents && traceEvents[currentStepIdx]) ? `_step_${currentStepIdx}` : '';
        const stateTag = currentState ? `_${currentState.join('_')}` : '';
        const fname = `star_graph${stepTag}${stateTag}.svg`;
        exportSvgElement(document.getElementById('boardSvg'), fname);
      };
    }

    const btnDlGoal = document.getElementById('btnDownloadGoalSvg');
    if (btnDlGoal) {
      btnDlGoal.onclick = () => {
        const stateTag = goalState ? `_${goalState.join('_')}` : '';
        const fname = `star_graph_goal${stateTag}.svg`;
        exportSvgElement(document.getElementById('goalBoardSvg'), fname);
      };
    }

    // Tree View Controls
    const btnFit = document.getElementById('btnTreeFit');
    if (btnFit) btnFit.onclick = fitTreeView;

    const btnZoomIn = document.getElementById('btnTreeZoomIn');
    if (btnZoomIn) btnZoomIn.onclick = () => {
      treeZoom = Math.min(3.0, treeZoom * 1.2);
      updateTreeTransform();
    };

    const btnZoomOut = document.getElementById('btnTreeZoomOut');
    if (btnZoomOut) btnZoomOut.onclick = () => {
      treeZoom = Math.max(0.2, treeZoom * 0.83);
      updateTreeTransform();
    };

    // Playback Controls
    const btnPlay = document.getElementById('btnPlayPause');
    if (btnPlay) btnPlay.onclick = togglePlay;

    const btnPrev = document.getElementById('btnStepPrev');
    if (btnPrev) btnPrev.onclick = () => { pausePlayback(); jumpStep(currentStepIdx - 1); };

    const btnNext = document.getElementById('btnStepNext');
    if (btnNext) btnNext.onclick = () => { pausePlayback(); jumpStep(currentStepIdx + 1); };

    const btnFirst = document.getElementById('btnStepFirst');
    if (btnFirst) btnFirst.onclick = () => { pausePlayback(); jumpStep(0); };

    const btnLast = document.getElementById('btnStepLast');
    if (btnLast) btnLast.onclick = () => { pausePlayback(); jumpStep(traceEvents.length - 1); };

    // Initial Board & Goal Preview Render
    renderBoard();
    renderGoalBoard();

    // Auto-run BFS once on startup to display initial search tree
    setTimeout(() => {
      runSearch('bfs');
    }, 150);
  }

  // Expose API
  window.GraphPuzzleApp = {
    init,
    renderBoard,
    renderGoalBoard,
    applyPreset,
    runSearch
  };

  // Launch on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
