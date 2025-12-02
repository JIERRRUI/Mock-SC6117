import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ClusterNode, Note } from '../types';

interface ClusterGraphProps {
  clusters: ClusterNode[];
  onNoteSelect: (noteId: string) => void;
}

// Convert hierarchical cluster data to flat nodes/links for D3
const processData = (clusters: ClusterNode[]) => {
  const nodes: any[] = [];
  const links: any[] = [];

  // Root node
  const rootId = 'root';
  nodes.push({ id: rootId, name: 'Knowledge Base', type: 'root', r: 30 });

  clusters.forEach(cluster => {
    // Cluster Node
    nodes.push({ id: cluster.id, name: cluster.name, type: 'cluster', r: 20 });
    links.push({ source: rootId, target: cluster.id });

    // Note Nodes
    if (cluster.children) {
      cluster.children.forEach(noteNode => {
        nodes.push({ 
          id: noteNode.id, 
          name: noteNode.name, 
          type: 'note', 
          noteId: noteNode.noteId,
          r: 10 
        });
        links.push({ source: cluster.id, target: noteNode.id });
      });
    }
  });

  return { nodes, links };
};

const ClusterGraph: React.FC<ClusterGraphProps> = ({ clusters, onNoteSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clusters.length || !svgRef.current || !containerRef.current) return;

    const { nodes, links } = processData(clusters);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.r + 5));

    // Links
    const link = svg.append("g")
      .attr("stroke", "#2e323e")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5);

    // Node Groups
    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call((d3.drag() as any)
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circles
    node.append("circle")
      .attr("r", (d: any) => d.r)
      .attr("fill", (d: any) => {
        if (d.type === 'root') return '#a855f7';
        if (d.type === 'cluster') return '#3b82f6';
        return '#64748b';
      })
      .attr("cursor", "pointer")
      .on("click", (event, d: any) => {
        if (d.type === 'note' && d.noteId) {
          onNoteSelect(d.noteId);
        }
      });

    // Labels
    node.append("text")
      .text((d: any) => d.name)
      .attr("x", (d: any) => d.r + 5)
      .attr("y", 4)
      .attr("stroke", "none")
      .attr("fill", "#e2e8f0")
      .attr("font-size", (d: any) => d.type === 'note' ? "10px" : "12px")
      .attr("font-weight", (d: any) => d.type === 'note' ? "normal" : "bold")
      .attr("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        svg.selectAll("g").attr("transform", event.transform);
      });

    svg.call(zoom as any);

  }, [clusters, onNoteSelect]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-surface/80 p-2 rounded text-xs text-muted">
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div>Root</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div>Cluster</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500"></div>Note</div>
      </div>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default ClusterGraph;