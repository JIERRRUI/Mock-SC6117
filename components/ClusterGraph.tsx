import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ClusterNode } from '../types';

interface ClusterGraphProps {
  clusters: ClusterNode[];
  onNoteSelect: (noteId: string) => void;
  onNodeReparent?: (noteId: string, newClusterId: string, newClusterName: string) => void;
}

// Extend the D3 node type to include physical properties
interface D3Node {
  id: string;
  name: string;
  type: 'root' | 'cluster' | 'note';
  noteId?: string;
  r: number;
  originalClusterId?: string;
  // D3 simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  index?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

const ClusterGraph: React.FC<ClusterGraphProps> = ({ clusters, onNoteSelect, onNodeReparent }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Refs for D3 simulation and data persistence
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);
  const linksRef = useRef<D3Link[]>([]);
  
  // State persistence for drag interactions
  const hoverTargetRef = useRef<string | null>(null);
  
  // Callback Ref Pattern:
  // Store the callback in a ref to handle the "Stale Closure" problem common in React+D3.
  // D3 event listeners are bound once; using a Ref ensures they access the latest function 
  // without needing to re-bind or re-run the effect when the function identity changes.
  const onReparentRef = useRef(onNodeReparent);
  
  // Update the ref whenever the parent passes a new callback
  useEffect(() => {
    onReparentRef.current = onNodeReparent;
  }, [onNodeReparent]);

  const updateGraphData = () => {
    const newNodes: D3Node[] = [];
    const newLinks: D3Link[] = [];
    // Root node
    const rootId = 'root';
    newNodes.push({ id: rootId, name: 'Knowledge Base', type: 'root', r: 35 });

    clusters.forEach(cluster => {
      newNodes.push({ id: cluster.id, name: cluster.name, type: 'cluster', r: 25 });
      newLinks.push({ source: rootId, target: cluster.id });
     // Add notes under this cluster
      if (cluster.children) {
        cluster.children.forEach(note => {
          newNodes.push({
            id: note.id,
            name: note.name,
            type: 'note',
            noteId: note.noteId,
            r: 12,
            originalClusterId: cluster.id 
          });
          newLinks.push({ source: cluster.id, target: note.id });
        });
      }
    });

    const existingNodesMap = new Map<string, D3Node>(
      nodesRef.current.map(d => [d.id, d] as [string, D3Node])
    );
    
    const mergedNodes = newNodes.map(d => {
      const old = existingNodesMap.get(d.id);
      if (old) {
        // Preserve physical properties to maintain layout stability
        d.x = old.x;
        d.y = old.y;
        d.vx = old.vx;
        d.vy = old.vy;
      }
      return d;
    });

    nodesRef.current = mergedNodes;
    linksRef.current = newLinks;
  };

  useEffect(() => {
    if (!clusters.length || !svgRef.current || !containerRef.current) return;

    updateGraphData();
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const g = svg.append("g"); // Main group for zooming

    // --- Force Simulation Setup ---
    const simulation = d3.forceSimulation<D3Node, D3Link>(nodesRef.current)
      .force("link", d3.forceLink<D3Node, D3Link>(linksRef.current)
        .id(d => d.id)
        .distance(d => d.source.type === 'root' ? 120 : 60)) 
      .force("charge", d3.forceManyBody().strength(-400)) 
      .force("collide", d3.forceCollide().radius((d: any) => d.r * 1.5).iterations(2)) 
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1));

    simulationRef.current = simulation;
    
    // --- Drawing Elements ---
    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#2e323e")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(linksRef.current)
      .join("line")
      .attr("stroke-width", d => d.source.type === 'root' ? 2 : 1);
    
    // Draw Node Groups
    const node = g.append("g")
      .selectAll("g")
      .data(nodesRef.current)
      .join("g")
      .attr("cursor", "grab");

    // Draw Circles
    node.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => {
        if (d.type === 'root') return '#a855f7'; 
        if (d.type === 'cluster') return '#3b82f6'; 
        return '#64748b'; 
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("id", d => `circle-${d.id}`); 

    // Draw Text Labels
    node.append("text")
      .text(d => d.name)
      .attr("x", d => d.r + 5)
      .attr("y", 4)
      .attr("stroke", "none")
      .attr("fill", "#e2e8f0")
      .attr("font-size", d => d.type === 'note' ? "10px" : "12px")
      .attr("font-weight", d => d.type === 'note' ? "normal" : "bold")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 4px rgba(0,0,0,0.8)");

    node.on("click", (event, d) => {
      if (d.type === 'note' && d.noteId) {
        event.stopPropagation();
        onNoteSelect(d.noteId);
      }
    });

    // --- Drag & Drop Behavior Configuration ---
    const dragBehavior = d3.drag<SVGGElement, D3Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent.target).attr("cursor", "grabbing");
        // Reset drop target when drag starts
        hoverTargetRef.current = null;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;

        if (d.type === 'note') {
          let foundClusterId: string | null = null;
          let minDistance = 50; 

          // Traverse other nodes to find collision with a Cluster node
          nodesRef.current.forEach(other => {
            if (other.type === 'cluster' && other.id !== d.originalClusterId) {
               const dx = (d.x || 0) - (other.x || 0);
               const dy = (d.y || 0) - (other.y || 0);
               const dist = Math.sqrt(dx*dx + dy*dy);
               
               if (dist < minDistance + other.r) {
                 foundClusterId = other.id;
               }
            }
          });
          
          // Update Visual Feedback (Highlighting)
          if (foundClusterId) {
             svg.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
             svg.select(`#circle-${foundClusterId}`)
                .attr("stroke", "#facc15")
                .attr("stroke-width", 4);
          } else {
             // Clear highlight if moved out of range
             svg.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
          }
          
          // Store the potential target in the ref for the 'end' event
          hoverTargetRef.current = foundClusterId;
        }
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select(event.sourceEvent.target).attr("cursor", "grab");
        
        // Clear all highlights
        svg.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);

        // Check if we have a valid drop target
        const targetId = hoverTargetRef.current;
        
        // Execute the reparent logic if conditions are met
        if (d.type === 'note' && targetId && onReparentRef.current) {
           const targetCluster = nodesRef.current.find(n => n.id === targetId);
           if (targetCluster && d.noteId) {
               // Call the latest callback via the Ref
               onReparentRef.current(d.noteId, targetCluster.id, targetCluster.name);
           }
        }
        hoverTargetRef.current = null;
      });

    node.call(dragBehavior);
  
    // --- Simulation Tick Handler ---
  simulation.on("tick", () => {
    link
      .attr("x1", d => {
        const source = typeof d.source === 'object' && d.source ? d.source : null;
        return source ? (source.x ?? 0) : 0;  //Use type guards and default values ​​to avoid accessing `undefined`.
      })
      .attr("y1", d => {
        const source = typeof d.source === 'object' && d.source ? d.source : null;
        return source ? (source.y ?? 0) : 0;
      })
      .attr("x2", d => {
        const target = typeof d.target === 'object' && d.target ? d.target : null;
        return target ? (target.x ?? 0) : 0;
      })
      .attr("y2", d => {
        const target = typeof d.target === 'object' && d.target ? d.target : null;
        return target ? (target.y ?? 0) : 0;
      });

    node
      .attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity); 

    return () => {
      simulation.stop();
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters]);// Only strictly depend on clusters; callbacks are handled via refs

  return (
    <div ref={containerRef} className="w-full h-full bg-background rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-surface/80 backdrop-blur p-2 rounded text-xs text-muted border border-border">
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div>Root</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div>Cluster</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500"></div>Note</div>
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted/70">
           Drag notes to other clusters to reorganize
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default ClusterGraph;