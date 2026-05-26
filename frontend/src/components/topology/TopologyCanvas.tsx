import type { TopologyEdge, TopologyNode } from "../../types/topology";

interface TopologyCanvasProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

function edgeTone(health: TopologyEdge["health"]) {
  switch (health) {
    case "failed":
      return "#f97316";
    case "degraded":
      return "#f59e0b";
    default:
      return "#5eead4";
  }
}

function nodeTone(status: TopologyNode["status"]) {
  switch (status) {
    case "critical":
      return "#fb923c";
    case "warning":
      return "#fbbf24";
    case "offline":
      return "#ef4444";
    case "degraded":
      return "#2dd4bf";
    default:
      return "#86efac";
  }
}

export function TopologyCanvas({ nodes, edges }: TopologyCanvasProps) {
  const nodeIndex = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <svg className="topology" viewBox="0 0 920 620" role="img" aria-label="Network topology">
      {edges.map((edge) => {
        const source = nodeIndex[edge.source];
        const target = nodeIndex[edge.target];

        return (
          <g key={edge.id}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={edgeTone(edge.health)}
              strokeOpacity="0.85"
              strokeWidth={edge.health === "failed" ? 5 : 3}
              strokeDasharray={edge.health === "failed" ? "10 8" : undefined}
            />
            <text
              x={(source.x + target.x) / 2}
              y={(source.y + target.y) / 2 - 10}
              fill="#fef3c7"
              fontSize="12"
              textAnchor="middle"
            >
              {edge.latencyMs} ms
            </text>
          </g>
        );
      })}

      {nodes.map((node) => (
        <g key={node.id}>
          <circle
            cx={node.x}
            cy={node.y}
            r="34"
            fill="rgba(255,255,255,0.06)"
            stroke={nodeTone(node.status)}
            strokeWidth="4"
          />
          <circle cx={node.x} cy={node.y} r="8" fill={nodeTone(node.status)} />
          <text x={node.x} y={node.y + 58} fill="#fff8eb" fontSize="16" textAnchor="middle">
            {node.label}
          </text>
          <text
            x={node.x}
            y={node.y + 76}
            fill="rgba(255,248,235,0.74)"
            fontSize="12"
            textAnchor="middle"
          >
            {node.role}
          </text>
        </g>
      ))}
    </svg>
  );
}
